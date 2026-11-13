using System.Security.Claims;
using System.Text.Encodings.Web;
using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HexaBill.Api.Core.Authorization;

/// <summary>
/// Accepts a company MCP token (Authorization: Bearer hbmcp_...). It is only wired onto the MCP endpoint, so the token is
/// useless anywhere else. The token must be active, unexpired, used on its own company's host, and its user must still be an
/// active member of that company; the role comes from the user's current record, not from the token.
/// </summary>
public sealed class McpTokenAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public McpTokenAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var header = Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(header) || !header.StartsWith("Bearer " + McpTokenSecrets.TokenPrefix, StringComparison.Ordinal))
            return AuthenticateResult.NoResult();

        var token = header["Bearer ".Length..].Trim();
        if (token.Length < 20 || token.Length > 100) return AuthenticateResult.Fail("Invalid token.");

        // The token only works on its own company's host, so the database scope is already that company.
        if (!Context.Items.TryGetValue(TenantHostMiddleware.ResolutionItemKey, out var hostObj)
            || hostObj is not TenantHostResolution host || host.Kind != TenantHostKind.Tenant || !host.TenantId.HasValue)
            return AuthenticateResult.Fail("Use your company address.");

        var hash = McpTokenSecrets.Hash(token);
        var now = DateTime.UtcNow;
        var db = Context.RequestServices.GetRequiredService<AppDbContext>();
        var row = await db.McpAccessTokens.IgnoreQueryFilters().AsNoTracking()
            .Where(t => t.TokenHash == hash && t.RevokedAt == null && (t.ExpiresAt == null || t.ExpiresAt > now))
            .Select(t => new { t.Id, t.TenantId, t.UserId, t.LastUsedAt })
            .FirstOrDefaultAsync(Context.RequestAborted);
        if (row == null || row.TenantId != host.TenantId.Value) return AuthenticateResult.Fail("Invalid token.");

        var user = await db.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(u => u.Id == row.UserId && u.TenantId == row.TenantId && u.IsActive && !u.IsPlatformAdmin)
            .Select(u => new { u.Id, u.Email, u.Name, u.Role, u.SessionVersion })
            .FirstOrDefaultAsync(Context.RequestAborted);
        if (user == null) return AuthenticateResult.Fail("Invalid token.");

        // Record use at most every 5 minutes, so reads do not turn into a write per call.
        if (row.LastUsedAt == null || now - row.LastUsedAt.Value > TimeSpan.FromMinutes(5))
        {
            try
            {
                await db.McpAccessTokens.IgnoreQueryFilters().Where(t => t.Id == row.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.LastUsedAt, now), Context.RequestAborted);
            }
            catch (Exception ex)
            {
                Logger.LogDebug(ex, "MCP token last-used update skipped");
            }
        }

        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim("UserId", user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("sv", user.SessionVersion.ToString()),
            new Claim("plat", "false"),
            new Claim("tid", row.TenantId.ToString()),
            new Claim("tenant_id", row.TenantId.ToString()),
            new Claim("auth_via", "mcp-token"),
        }, McpTokenSecrets.Scheme);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), McpTokenSecrets.Scheme));
    }
}
