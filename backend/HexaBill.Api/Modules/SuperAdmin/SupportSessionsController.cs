using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace HexaBill.Api.Modules.SuperAdmin;

[ApiController]
[Route("api/superadmin/support-sessions")]
[Authorize]
public sealed class SupportSessionsController : TenantScopedController
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;

    public SupportSessionsController(AppDbContext db, IConfiguration configuration)
    {
        _db = db;
        _configuration = configuration;
    }

    [HttpPost]
    public async Task<IActionResult> Start([FromBody] StartSupportSessionRequest request)
    {
        if (!IsSystemAdmin || request == null || request.TenantId <= 0 || string.IsNullOrWhiteSpace(request.Reason))
            return Forbid();

        var platformUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == request.TenantId);
        if (tenant == null)
            return NotFound(new { success = false, message = "Tenant not found" });

        var session = new SupportSession
        {
            TenantId = tenant.Id,
            PlatformUserId = platformUserId,
            Reason = request.Reason.Trim(),
            StartedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddMinutes(30),
            ReadOnly = true
        };
        _db.SupportSessions.Add(session);
        _db.AuditLogs.Add(new AuditLog
        {
            TenantId = tenant.Id,
            OwnerId = tenant.Id,
            UserId = platformUserId,
            Action = "SUPPORT_SESSION_STARTED",
            Details = $"Read-only support session requested. Reason: {session.Reason}",
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var token = CreateSupportToken(platformUserId, tenant.Id, tenant.Subdomain, session);
        return Ok(new
        {
            success = true,
            data = new { sessionId = session.Id, tenantId = tenant.Id, subdomain = tenant.Subdomain, token, expiresAt = session.ExpiresAt }
        });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> End(int id)
    {
        if (!IsSystemAdmin)
            return Forbid();

        var platformUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var session = await _db.SupportSessions.FirstOrDefaultAsync(s => s.Id == id && s.PlatformUserId == platformUserId);
        if (session == null)
            return NotFound(new { success = false, message = "Support session not found" });

        session.EndedAt = DateTime.UtcNow;
        _db.AuditLogs.Add(new AuditLog
        {
            TenantId = session.TenantId,
            OwnerId = session.TenantId,
            UserId = platformUserId,
            Action = "SUPPORT_SESSION_ENDED",
            Details = $"Support session {session.Id} ended.",
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    private string CreateSupportToken(int platformUserId, int tenantId, string subdomain, SupportSession session)
    {
        var jwt = _configuration.GetSection("JwtSettings");
        var secret = jwt["SecretKey"] ?? throw new InvalidOperationException("JWT secret is not configured");
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, platformUserId.ToString()),
            new Claim("UserId", platformUserId.ToString()),
            new Claim(ClaimTypes.Role, "Owner"),
            new Claim("plat", "false"),
            new Claim("tid", tenantId.ToString()),
            new Claim("tenant_id", tenantId.ToString()),
            new Claim("tslug", subdomain),
            new Claim("support_session", session.Id.ToString()),
            new Claim("support_readonly", "true")
        };
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = jwt["Issuer"] ?? "HexaBill.Api",
            Audience = jwt["Audience"] ?? "HexaBill.Api",
            Expires = session.ExpiresAt,
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)), SecurityAlgorithms.HmacSha256Signature)
        };
        return new JwtSecurityTokenHandler().WriteToken(new JwtSecurityTokenHandler().CreateToken(descriptor));
    }
}

public sealed class StartSupportSessionRequest
{
    public int TenantId { get; set; }
    public string Reason { get; set; } = string.Empty;
}
