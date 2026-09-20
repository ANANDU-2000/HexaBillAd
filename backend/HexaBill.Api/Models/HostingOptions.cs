namespace HexaBill.Api.Models;

public sealed class HostingOptions
{
    public string BaseDomain { get; set; } = "hexabill.company";
    public string PlatformHost { get; set; } = "admin.hexabill.company";
    public string ApiHost { get; set; } = "api.hexabill.company";
    public string EnforcementMode { get; set; } = "LogOnly";
    /// <summary>Shared secret injected by the trusted edge proxy (Vercel middleware / Vite dev proxy).</summary>
    public string EdgeProxySecret { get; set; } = string.Empty;
}

public enum TenantHostKind
{
    Platform,
    Tenant,
    Marketing,
    Unknown
}

public sealed record TenantHostResolution(
    TenantHostKind Kind,
    string? Slug = null,
    int? TenantId = null,
    TenantStatus? Status = null,
    bool HeaderMismatch = false)
{
    public static TenantHostResolution Platform() => new(TenantHostKind.Platform);
    public static TenantHostResolution Marketing() => new(TenantHostKind.Marketing);
    public static TenantHostResolution Unknown() => new(TenantHostKind.Unknown);
}
