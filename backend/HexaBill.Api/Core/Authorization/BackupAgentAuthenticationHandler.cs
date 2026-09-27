using System.Security.Claims;
using System.Text.Encodings.Web;
using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HexaBill.Api.Core.Authorization;

public class BackupAgentAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string AgentScheme = "BackupAgent";

    public BackupAgentAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var header = Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(header) ||
            !header.StartsWith("Bearer " + BackupAgentSecrets.TokenPrefix, StringComparison.Ordinal))
        {
            return AuthenticateResult.NoResult();
        }

        var token = header["Bearer ".Length..].Trim();
        if (token.Length < 20)
            return AuthenticateResult.Fail("Invalid backup agent token.");

        var hash = BackupAgentSecrets.Hash(token);
        var db = Context.RequestServices.GetRequiredService<AppDbContext>();
        var row = await db.BackupDeviceTokens.IgnoreQueryFilters().AsNoTracking()
            .Where(t => t.TokenHash == hash && t.RevokedAt == null && t.ExpiresAt > DateTime.UtcNow)
            .Select(t => new { t.TenantId, t.DeviceId })
            .FirstOrDefaultAsync(Context.RequestAborted);
        if (row == null)
            return AuthenticateResult.Fail("Invalid backup agent token.");

        var device = await db.BackupDevices.IgnoreQueryFilters().AsNoTracking()
            .Where(d => d.Id == row.DeviceId && d.TenantId == row.TenantId && d.RevokedAt == null)
            .Select(d => new { d.Id })
            .FirstOrDefaultAsync(Context.RequestAborted);
        if (device == null)
            return AuthenticateResult.Fail("Backup device is revoked.");

        if (Context.Items.TryGetValue(TenantHostMiddleware.ResolutionItemKey, out var hostObj) &&
            hostObj is TenantHostResolution host &&
            host.Kind == TenantHostKind.Tenant &&
            host.TenantId != row.TenantId)
        {
            return AuthenticateResult.Fail("Backup device is not valid for this company.");
        }

        var identity = new ClaimsIdentity(new[]
        {
            new Claim("tid", row.TenantId.ToString()),
            new Claim("tenant_id", row.TenantId.ToString()),
            new Claim("did", row.DeviceId.ToString()),
            new Claim("scope", BackupAgentSecrets.Scope),
            new Claim(ClaimTypes.NameIdentifier, "agent:" + row.DeviceId)
        }, AgentScheme);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), AgentScheme));
    }
}
