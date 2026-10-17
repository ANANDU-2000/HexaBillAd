using System.Text.Json;
using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HexaBill.Api.Modules.Assistant;

/// <summary>
/// Read-only assistant tools. No model, no network call, no write. Scope comes from the token, not the request.
/// </summary>
[ApiController]
[Route("api/assistant")]
[Authorize]
public class AssistantController : TenantScopedController
{
    private readonly AssistantToolRegistry _registry;
    private readonly AppDbContext _context;
    private readonly ILogger<AssistantController> _logger;

    public AssistantController(AssistantToolRegistry registry, AppDbContext context, ILogger<AssistantController> logger)
    {
        _registry = registry;
        _context = context;
        _logger = logger;
    }

    private bool TryCaller(out AssistantCaller caller)
    {
        caller = new AssistantCaller(0, 0, false);
        var tenantId = CurrentTenantId;
        // A platform administrator has no company scope here; they use the platform tools, not company data.
        if (tenantId <= 0 || IsSystemAdmin) return false;
        var userClaim = User.FindFirst("UserId") ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? User.FindFirst("id");
        if (userClaim == null || !int.TryParse(userClaim.Value, out var userId)) return false;
        caller = new AssistantCaller(tenantId, userId, User.IsInRole("Owner") || User.IsInRole("Admin"));
        return true;
    }

    [HttpGet("tools")]
    public IActionResult ListTools()
    {
        if (!TryCaller(out var caller)) return Forbid();
        var tools = _registry.ToolsFor(caller).Select(t => new { name = t.Name, description = t.Description, arguments = t.Arguments });
        return Ok(new ApiResponse<object> { Success = true, Message = "Tools", Data = tools });
    }

    [HttpPost("tools/{name}")]
    public async Task<IActionResult> RunTool(string name, [FromBody] JsonElement args, CancellationToken ct)
    {
        if (!TryCaller(out var caller)) return Forbid();
        try
        {
            var result = await _registry.RunAsync(caller, name, args, ct);
            // Audit that a tool ran. The arguments are not stored: they can hold customer names or phone numbers.
            _context.AuditLogs.Add(new AuditLog
            {
                TenantId = caller.TenantId,
                OwnerId = caller.TenantId,
                UserId = caller.UserId,
                Action = "AssistantToolRun",
                Details = $"tool={result.Tool}; sources={result.Sources.Count}",
                CreatedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync(ct);
            return Ok(new ApiResponse<AssistantToolResult> { Success = true, Message = "Result", Data = result });
        }
        catch (AssistantToolException ex)
        {
            return StatusCode(ex.StatusCode, new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Assistant tool {Tool} failed for tenant {TenantId}", name, caller.TenantId);
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "The tool could not run. Use the normal screens." });
        }
    }
}
