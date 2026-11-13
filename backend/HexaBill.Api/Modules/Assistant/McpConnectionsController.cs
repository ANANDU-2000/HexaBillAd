using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.Assistant;

/// <summary>
/// Owner-only management of the company's MCP connections (AI tools such as Claude, ChatGPT or Gemini reading this company's
/// data). Needs a normal signed-in session: an MCP token cannot create or revoke tokens. The secret is shown once, only a hash
/// is stored, and every create and revoke is audited (name only).
/// </summary>
[ApiController]
[Route("api/mcp-connections")]
[Authorize(Roles = "Owner")]
public class McpConnectionsController : TenantScopedController
{
    public const int MaxActiveConnections = 10;
    private static readonly int[] AllowedDays = { 30, 90, 365 };

    private readonly AppDbContext _context;

    public McpConnectionsController(AppDbContext context) => _context = context;

    private int CurrentUserId =>
        int.TryParse((User.FindFirst("UserId") ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier))?.Value, out var id) ? id : 0;

    public sealed class CreateRequest
    {
        public string? Name { get; set; }
        /// <summary>30, 90 or 365 days. Omitted means 365.</summary>
        public int? ExpiresInDays { get; set; }
    }

    private static object View(McpAccessToken t, DateTime now) => new
    {
        id = t.Id,
        name = t.Name,
        prefix = t.TokenPrefix,
        createdAt = t.CreatedAt,
        expiresAt = t.ExpiresAt,
        lastUsedAt = t.LastUsedAt,
        status = t.RevokedAt != null ? "Revoked" : (t.ExpiresAt != null && t.ExpiresAt <= now ? "Expired" : "Active"),
    };

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var tenantId = CurrentTenantId;
        if (tenantId <= 0 || IsSystemAdmin) return Forbid();
        Response.Headers["Cache-Control"] = "no-store";
        var now = DateTime.UtcNow;
        var rows = await _context.McpAccessTokens.AsNoTracking().Where(t => t.TenantId == tenantId)
            .OrderByDescending(t => t.CreatedAt).Take(50).ToListAsync(ct);
        return Ok(new ApiResponse<object> { Success = true, Data = rows.Select(r => View(r, now)).ToList() });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRequest request, CancellationToken ct)
    {
        var tenantId = CurrentTenantId;
        var userId = CurrentUserId;
        if (tenantId <= 0 || IsSystemAdmin || userId <= 0) return Forbid();

        var name = (request?.Name ?? string.Empty).Trim();
        if (name.Length < 2 || name.Length > 80)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Give the connection a name of 2 to 80 characters, for example \"Claude on my laptop\"." });
        var days = request?.ExpiresInDays ?? 365;
        if (!AllowedDays.Contains(days))
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Choose 30, 90 or 365 days." });

        var now = DateTime.UtcNow;
        var active = await _context.McpAccessTokens.CountAsync(t => t.TenantId == tenantId && t.RevokedAt == null && (t.ExpiresAt == null || t.ExpiresAt > now), ct);
        if (active >= MaxActiveConnections)
            return Conflict(new ApiResponse<object> { Success = false, Message = $"You already have {MaxActiveConnections} active connections. Revoke one you no longer use first." });

        var secret = McpTokenSecrets.CreateToken();
        var row = new McpAccessToken
        {
            TenantId = tenantId,
            UserId = userId,
            Name = name,
            TokenHash = McpTokenSecrets.Hash(secret),
            TokenPrefix = secret[..12],
            CreatedAt = now,
            ExpiresAt = now.AddDays(days),
        };
        _context.McpAccessTokens.Add(row);
        _context.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId, OwnerId = tenantId, UserId = userId, Action = "McpConnectionCreated",
            Details = $"name={name}; days={days}", CreatedAt = now,
        });
        await _context.SaveChangesAsync(ct);
        Response.Headers["Cache-Control"] = "no-store";
        // The only time the secret is returned.
        return StatusCode(201, new ApiResponse<object> { Success = true, Message = "Copy the token now. It will not be shown again.", Data = new { connection = View(row, now), token = secret } });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Revoke(int id, CancellationToken ct)
    {
        var tenantId = CurrentTenantId;
        var userId = CurrentUserId;
        if (tenantId <= 0 || IsSystemAdmin) return Forbid();
        var row = await _context.McpAccessTokens.FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId, ct);
        if (row == null) return NotFound(new ApiResponse<object> { Success = false, Message = "Connection not found." });
        if (row.RevokedAt == null)
        {
            row.RevokedAt = DateTime.UtcNow;
            _context.AuditLogs.Add(new AuditLog
            {
                TenantId = tenantId, OwnerId = tenantId, UserId = userId, Action = "McpConnectionRevoked",
                Details = $"name={row.Name}", CreatedAt = DateTime.UtcNow,
            });
            await _context.SaveChangesAsync(ct);
        }
        return Ok(new ApiResponse<object> { Success = true, Message = "Connection revoked. It stops working immediately." });
    }
}
