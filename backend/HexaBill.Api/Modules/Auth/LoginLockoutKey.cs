using System.Security.Cryptography;
using System.Text;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Auth;

/// <summary>
/// Scopes login lockout to the workspace resolved from the request host, so the same email in two
/// tenant workspaces cannot lock out or clear each other (PS-010). Unknown hosts keep the legacy email key.
/// </summary>
public static class LoginLockoutKey
{
    private const int MaxLength = 100; // FailedLoginAttempt.Email column length

    public static string For(TenantHostResolution? host, string email)
    {
        var normalized = (email ?? "").Trim().ToLowerInvariant();
        var prefix = host?.Kind switch
        {
            TenantHostKind.Tenant when host.TenantId.HasValue => $"t{host.TenantId.Value}:",
            TenantHostKind.Platform => "p:",
            _ => "",
        };
        var key = prefix + normalized;
        if (key.Length <= MaxLength) return key;
        return prefix + HashSuffix(normalized);
    }

    /// <summary>Form used when prefix + email exceeds the column length.</summary>
    public static string HashSuffix(string email) =>
        "#" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes((email ?? "").Trim().ToLowerInvariant())))[..40].ToLowerInvariant();
}
