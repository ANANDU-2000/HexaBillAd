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
    private readonly AssistantDraftService _drafts;
    private readonly AppDbContext _context;
    private readonly ILogger<AssistantController> _logger;

    public AssistantController(AssistantToolRegistry registry, AssistantDraftService drafts, AppDbContext context, ILogger<AssistantController> logger)
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

    public sealed class ConfirmDraftRequest
    {
        public string? PayloadHash { get; set; }
        public string? IdempotencyKey { get; set; }
    }

    private async Task<IActionResult> RunDraft(Func<AssistantCaller, Task<object>> action, Func<object, int>? statusOf = null)
    {
        if (!TryCaller(out var caller)) return Forbid();
        try
        {
            var data = await action(caller);
            return StatusCode(statusOf?.Invoke(data) ?? 200, new ApiResponse<object> { Success = true, Message = "OK", Data = data });
        }
        catch (DraftException ex)
        {
            return StatusCode(ex.StatusCode, new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Assistant draft action failed for tenant {TenantId}", caller.TenantId);
            // The outcome may be unknown: say so instead of inviting a blind retry.
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Something went wrong and the result is not certain. Check the Customers list before trying again." });
        }
    }

    /// <summary>Propose a new customer. Nothing is created; the response shows the cleaned fields, any field errors and a hash to confirm.</summary>
    [HttpPost("drafts/customer")]
    public Task<IActionResult> CreateCustomerDraft([FromBody] CustomerDraftRequest request, CancellationToken ct) =>
        RunDraft(async c => await _drafts.CreateCustomerDraftAsync(c.TenantId, c.UserId, request ?? new CustomerDraftRequest(), ct),
            data => data is DraftView { Status: "Invalid" } ? 200 : 201);

    [HttpGet("drafts/{id:guid}")]
    public Task<IActionResult> GetDraft(Guid id, CancellationToken ct) =>
        RunDraft(async c => await _drafts.GetAsync(c.TenantId, c.UserId, id, ct));

    [HttpPost("drafts/{id:guid}/cancel")]
    public Task<IActionResult> CancelDraft(Guid id, CancellationToken ct) =>
        RunDraft(async c => { await _drafts.CancelAsync(c.TenantId, c.UserId, id, ct); return new { cancelled = true }; });

    /// <summary>Execute a reviewed draft. Needs the hash the person saw and an idempotency key; the same key returns the first result.</summary>
    [HttpPost("drafts/{id:guid}/confirm")]
    public Task<IActionResult> ConfirmDraft(Guid id, [FromBody] ConfirmDraftRequest request, CancellationToken ct) =>
        RunDraft(async c => await _drafts.ConfirmAsync(c.TenantId, c.UserId, id, request?.PayloadHash ?? string.Empty, request?.IdempotencyKey ?? string.Empty, ct));
}
