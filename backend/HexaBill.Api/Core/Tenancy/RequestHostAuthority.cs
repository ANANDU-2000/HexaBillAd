using HexaBill.Api.Models;

namespace HexaBill.Api.Core.Tenancy;

/// <summary>
/// Resolves the authoritative application hostname for tenant/platform routing.
/// Trust boundary: <see cref="OriginalHostHeader"/> is honored only when
/// <see cref="EdgeSecretHeader"/> matches the configured edge proxy secret
/// (set by Vercel middleware / local Vite dev proxy). Client-supplied
/// Origin, Referer, X-Forwarded-Host, and X-Tenant-Id are never used.
/// </summary>
public static class RequestHostAuthority
{
    public const string OriginalHostHeader = "X-HexaBill-Original-Host";
    public const string EdgeSecretHeader = "X-HexaBill-Edge-Secret";

    public static string ResolveAuthorityHost(HttpContext context, HostingOptions options)
    {
        var requestHost = NormalizeHost(context.Request.Host.Host);
        if (string.IsNullOrEmpty(requestHost))
            return string.Empty;

        // Trusted edge proxy always wins (Vercel middleware / Vite dev proxy).
        if (HasValidEdgeProxy(context, options))
        {
            var originalHost = NormalizeHost(context.Request.Headers[OriginalHostHeader].FirstOrDefault());
            if (!string.IsNullOrEmpty(originalHost))
                return originalHost;
        }

        if (IsDirectApplicationHost(requestHost, options))
            return requestHost;

        return requestHost;
    }

    public static bool HasValidEdgeProxy(HttpContext context, HostingOptions options)
    {
        var originalHost = NormalizeHost(context.Request.Headers[OriginalHostHeader].FirstOrDefault());
        var edgeSecret = context.Request.Headers[EdgeSecretHeader].FirstOrDefault();
        return !string.IsNullOrEmpty(originalHost)
            && !string.IsNullOrEmpty(options.EdgeProxySecret)
            && !string.IsNullOrEmpty(edgeSecret)
            && string.Equals(edgeSecret, options.EdgeProxySecret, StringComparison.Ordinal);
    }

    /// <summary>
    /// Hostnames that identify the upstream backend (Render), not a tenant/platform app host.
    /// </summary>
    public static bool IsUpstreamBackendHost(string? host, HostingOptions options)
    {
        var normalized = NormalizeHost(host);
        if (string.IsNullOrEmpty(normalized))
            return false;

        var apiHost = NormalizeHost(options.ApiHost);
        if (!string.IsNullOrEmpty(apiHost) && normalized == apiHost)
            return true;

        return normalized.EndsWith(".onrender.com", StringComparison.Ordinal);
    }

    internal static bool IsDirectApplicationHost(string host, HostingOptions options)
    {
        var platformHost = NormalizeHost(options.PlatformHost);
        var baseDomain = options.BaseDomain.Trim('.').ToLowerInvariant();

        if (host == platformHost)
            return true;
        if (host == baseDomain || host == $"www.{baseDomain}")
            return true;
        if (host is "localhost" or "127.0.0.1")
            return true;
        if (host.EndsWith($".{baseDomain}", StringComparison.Ordinal))
            return true;
        if (host.EndsWith(".localhost", StringComparison.Ordinal))
            return true;

        return false;
    }

    internal static string? NormalizeHost(string? host)
    {
        if (string.IsNullOrWhiteSpace(host))
            return null;
        return host.TrimEnd('.').ToLowerInvariant();
    }
}
