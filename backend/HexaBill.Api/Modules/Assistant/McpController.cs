using System.Text.Json;
using System.Text.Json.Nodes;
using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HexaBill.Api.Modules.Assistant;

/// <summary>
/// Remote MCP server (Streamable HTTP, JSON responses, no streaming) for ONE company at a time.
/// The company, user and role come only from the authenticated token, never from the MCP request. It exposes the same fixed
/// read tools as the assistant plus two "draft" tools that create a proposal and change nothing in the books. There is no
/// confirm tool on purpose: a person confirms in the HexaBill app, so a connected AI client cannot approve its own action.
/// </summary>
[ApiController]
[Route("api/mcp")]
[Authorize]
public class McpController : TenantScopedController
{
    private static readonly string[] SupportedVersions = { "2025-06-18", "2025-03-26", "2024-11-05" };
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly AssistantToolRegistry _registry;
    private readonly AssistantDraftService _drafts;
    private readonly AppDbContext _context;
    private readonly ILogger<McpController> _logger;

    public McpController(AssistantToolRegistry registry, AssistantDraftService drafts, AppDbContext context, ILogger<McpController> logger)
    {
        _registry = registry;
        _drafts = drafts;
        _context = context;
        _logger = logger;
    }

    private bool TryCaller(out AssistantCaller caller)
    {
        caller = new AssistantCaller(0, 0, false);
        var tenantId = CurrentTenantId;
        if (tenantId <= 0 || IsSystemAdmin) return false;
        var userClaim = User.FindFirst("UserId") ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? User.FindFirst("id");
        if (userClaim == null || !int.TryParse(userClaim.Value, out var userId) || userId <= 0) return false;
        caller = new AssistantCaller(tenantId, userId, User.IsInRole("Owner") || User.IsInRole("Admin"), IsStaff,
            User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? string.Empty);
        return true;
    }

    /// <summary>This server does not push messages to the client, so a GET stream is not offered.</summary>
    [HttpGet]
    public IActionResult NotOffered() => StatusCode(405, new { error = "POST JSON-RPC messages to this endpoint." });

    [HttpPost]
    public async Task<IActionResult> Handle([FromBody] JsonElement message, CancellationToken ct)
    {
        if (!TryCaller(out var caller)) return Forbid();
        Response.Headers["Cache-Control"] = "no-store";

        if (message.ValueKind != JsonValueKind.Object)
            return Reply(null, error: (-32600, "Send one JSON-RPC request object."));
        message.TryGetProperty("id", out var idElement);
        var hasId = idElement.ValueKind is JsonValueKind.String or JsonValueKind.Number;
        var id = hasId ? idElement.Clone() : (JsonElement?)null;
        var method = message.TryGetProperty("method", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() : null;
        if (method == null) return Reply(id, error: (-32600, "Missing method."));
        message.TryGetProperty("params", out var parameters);

        // Notifications carry no id and get no body back.
        if (!hasId) return Accepted();

        switch (method)
        {
            case "initialize":
                return Reply(id, result: Initialize(parameters));
            case "ping":
                return Reply(id, result: new JsonObject());
            case "tools/list":
                return Reply(id, result: ListTools(caller));
            case "tools/call":
                return Reply(id, result: await CallToolAsync(caller, parameters, ct));
            default:
                return Reply(id, error: (-32601, "Method not found."));
        }
    }

    private static JsonNode Initialize(JsonElement parameters)
    {
        var requested = parameters.ValueKind == JsonValueKind.Object && parameters.TryGetProperty("protocolVersion", out var v)
            && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        var version = requested != null && SupportedVersions.Contains(requested) ? requested : SupportedVersions[0];
        return new JsonObject
        {
            ["protocolVersion"] = version,
            ["capabilities"] = new JsonObject { ["tools"] = new JsonObject { ["listChanged"] = false } },
            ["serverInfo"] = new JsonObject { ["name"] = "hexabill", ["version"] = "1.0.0" },
            ["instructions"] = "Company data for the signed-in HexaBill company only. Read tools return records with their sources. " +
                "Draft tools only create a proposal; a person must review and confirm it in the HexaBill app.",
        };
    }

    private JsonNode ListTools(AssistantCaller caller)
    {
        var tools = new JsonArray();
        foreach (var tool in _registry.ToolsFor(caller))
        {
            var props = new JsonObject();
            foreach (var arg in tool.Arguments)
                props[arg] = new JsonObject { ["type"] = arg.Equals("limit", StringComparison.OrdinalIgnoreCase) ? "integer" : "string" };
            tools.Add(new JsonObject
            {
                ["name"] = tool.Name,
                ["description"] = tool.Description,
                ["inputSchema"] = Schema(props, additional: false),
                ["annotations"] = new JsonObject { ["readOnlyHint"] = true, ["openWorldHint"] = false },
            });
        }
        tools.Add(DraftTool("draft_customer",
            "Propose a new customer. Creates a draft only; a person must confirm it in the HexaBill app.",
            new JsonObject
            {
                ["name"] = Str(), ["phone"] = Str(), ["email"] = Str(), ["trn"] = Str(), ["address"] = Str(),
                ["creditLimit"] = new JsonObject { ["type"] = "number" }, ["paymentTerms"] = Str(), ["customerType"] = Str(),
            }));
        tools.Add(DraftTool("draft_expense",
            "Propose a plain expense. Creates a draft only; a person must confirm it in the HexaBill app.",
            new JsonObject
            {
                ["categoryId"] = new JsonObject { ["type"] = "integer" }, ["amount"] = new JsonObject { ["type"] = "number" },
                ["date"] = new JsonObject { ["type"] = "string", ["description"] = "yyyy-MM-dd" }, ["note"] = Str(),
            }));
        return new JsonObject { ["tools"] = tools };
    }

    private static JsonObject Str() => new() { ["type"] = "string" };

    private static JsonObject Schema(JsonObject props, bool additional) =>
        new() { ["type"] = "object", ["properties"] = props, ["additionalProperties"] = additional };

    private static JsonObject DraftTool(string name, string description, JsonObject props) => new()
    {
        ["name"] = name,
        ["description"] = description,
        ["inputSchema"] = Schema(props, additional: false),
        ["annotations"] = new JsonObject { ["readOnlyHint"] = false, ["destructiveHint"] = false, ["idempotentHint"] = false, ["openWorldHint"] = false },
    };

    private async Task<JsonNode> CallToolAsync(AssistantCaller caller, JsonElement parameters, CancellationToken ct)
    {
        var name = parameters.ValueKind == JsonValueKind.Object && parameters.TryGetProperty("name", out var n) && n.ValueKind == JsonValueKind.String
            ? n.GetString() ?? string.Empty : string.Empty;
        var args = parameters.ValueKind == JsonValueKind.Object && parameters.TryGetProperty("arguments", out var a) ? a : default;
        try
        {
            object data = name switch
            {
                "draft_customer" => await _drafts.CreateCustomerDraftAsync(caller.TenantId, caller.UserId, Bind<CustomerDraftRequest>(args), ct),
                "draft_expense" => await _drafts.CreateExpenseDraftAsync(caller.TenantId, caller.UserId, Bind<ExpenseDraftRequest>(args), ct),
                _ => await _registry.RunAsync(caller, name, args, ct),
            };
            await AuditAsync(caller, name, ct);
            return ToolContent(data, isError: false);
        }
        catch (AssistantToolException ex) { return ToolContent(ex.Message, isError: true); }
        catch (DraftException ex) { return ToolContent(ex.Message, isError: true); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MCP tool {Tool} failed for tenant {TenantId}", name, caller.TenantId);
            return ToolContent("The tool could not run. Use the HexaBill screens.", isError: true);
        }
    }

    /// <summary>Strict binding: unknown fields are refused so a client cannot pass hidden parameters (such as a tenant id).</summary>
    private static T Bind<T>(JsonElement args) where T : new()
    {
        if (args.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null) return new T();
        if (args.ValueKind != JsonValueKind.Object) throw new AssistantToolException(400, "Arguments must be an object.");
        var known = typeof(T).GetProperties().Select(p => p.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var property in args.EnumerateObject())
            if (!known.Contains(property.Name))
                throw new AssistantToolException(400, $"Unexpected argument '{property.Name}'.");
        try { return args.Deserialize<T>(Json) ?? new T(); }
        catch (JsonException) { throw new AssistantToolException(400, "An argument has the wrong type."); }
    }

    private async Task AuditAsync(AssistantCaller caller, string tool, CancellationToken ct)
    {
        // The tool name only: the arguments can hold customer names or phone numbers.
        _context.AuditLogs.Add(new AuditLog
        {
            TenantId = caller.TenantId,
            OwnerId = caller.TenantId,
            UserId = caller.UserId,
            Action = "McpToolCall",
            Details = $"tool={tool}",
            CreatedAt = DateTime.UtcNow,
        });
        await _context.SaveChangesAsync(ct);
    }

    private static JsonNode ToolContent(object data, bool isError)
    {
        var text = data as string ?? JsonSerializer.Serialize(data, Json);
        return new JsonObject
        {
            ["content"] = new JsonArray(new JsonObject { ["type"] = "text", ["text"] = text }),
            ["isError"] = isError,
        };
    }

    private IActionResult Reply(JsonElement? id, JsonNode? result = null, (int Code, string Message)? error = null)
    {
        var body = new JsonObject { ["jsonrpc"] = "2.0", ["id"] = id.HasValue ? JsonNode.Parse(id.Value.GetRawText()) : null };
        if (error.HasValue) body["error"] = new JsonObject { ["code"] = error.Value.Code, ["message"] = error.Value.Message };
        else body["result"] = result;
        return Content(body.ToJsonString(), "application/json");
    }
}
