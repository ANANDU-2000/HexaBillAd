using System.Security.Cryptography;
using System.Text;

namespace HexaBill.Api.Models;

/// <summary>
/// A long-lived access token for ONE company's MCP endpoint (/api/mcp). It acts as the user who created it, with that user's
/// current role, and only the MCP tools (read lookups and drafts); it is not accepted by any other API. Only a hash is stored.
/// </summary>
public sealed class McpAccessToken
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    /// <summary>The user this token acts as. Their live role and active flag are checked on every call.</summary>
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string TokenHash { get; set; } = string.Empty;
    /// <summary>First characters of the token, so people can tell connections apart. Not a secret.</summary>
    public string TokenPrefix { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
}

public static class McpTokenSecrets
{
    public const string TokenPrefix = "hbmcp_";
    public const string Scheme = "McpToken";
    public const string EntryScheme = "McpAuth";

    public static string CreateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return TokenPrefix + Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    /// <summary>SHA-256 of a high-entropy random token; no salt is needed.</summary>
    public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
}
