using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace HexaBill.Api.Shared.Hosting;

public sealed class TenantHostResolver : ITenantHostResolver
{
    private const string ResolutionCachePrefix = "tenant-host-resolution:";
    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;
    private readonly HostingOptions _options;
    private readonly ILogger<TenantHostResolver> _logger;

    public TenantHostResolver(AppDbContext db, IMemoryCache cache, IOptions<HostingOptions> options, ILogger<TenantHostResolver> logger)
    {
        _db = db;
        _cache = cache;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<TenantHostResolution> ResolveAsync(HttpContext context, CancellationToken cancellationToken = default)
    {
        // Authoritative host: direct tenant/platform hostname, or edge-proxy
        // original host when the trusted edge secret matches.
        var authorityHost = RequestHostAuthority.ResolveAuthorityHost(context, _options);
        var hostResolution = ResolveHost(authorityHost);

        if (hostResolution.Kind != TenantHostKind.Tenant || hostResolution.Slug is null)
            return hostResolution;

        var cacheKey = ResolutionCachePrefix + hostResolution.Slug;
        if (_cache.TryGetValue(cacheKey, out TenantHostResolution? cached) && cached is not null)
            return cached;

        var tenant = await _db.Tenants.AsNoTracking()
            .Where(t => t.Subdomain.ToLower() == hostResolution.Slug)
            .Select(t => new { t.Id, t.Subdomain, t.Status })
            .SingleOrDefaultAsync(cancellationToken);

        var resolved = tenant is null
            ? TenantHostResolution.Unknown()
            : new TenantHostResolution(TenantHostKind.Tenant, tenant.Subdomain, tenant.Id, tenant.Status);

        _cache.Set(cacheKey, resolved, TimeSpan.FromSeconds(60));
        return resolved;
    }

    public void Invalidate(string? slug)
    {
        var normalized = TenantSlugValidator.Normalize(slug);
        if (normalized is not null)
            _cache.Remove(ResolutionCachePrefix + normalized);
    }

    private TenantHostResolution ResolveHost(string? host)
    {
        var normalizedHost = host?.TrimEnd('.').ToLowerInvariant();
        if (string.IsNullOrEmpty(normalizedHost))
            return TenantHostResolution.Unknown();

        var platformHost = _options.PlatformHost.TrimEnd('.').ToLowerInvariant();
        var baseDomain = _options.BaseDomain.Trim('.').ToLowerInvariant();

        if (normalizedHost == platformHost)
            return TenantHostResolution.Platform();
        if (normalizedHost == baseDomain || normalizedHost == "www." + baseDomain
            || normalizedHost == "localhost" || normalizedHost == "127.0.0.1")
            return TenantHostResolution.Marketing();

        var baseSuffix = "." + baseDomain;
        if (normalizedHost.EndsWith(baseSuffix, StringComparison.Ordinal))
        {
            var slug = normalizedHost[..^baseSuffix.Length];
            return TenantSlugValidator.IsValid(slug)
                ? new TenantHostResolution(TenantHostKind.Tenant, slug)
                : TenantHostResolution.Unknown();
        }

        if (normalizedHost.EndsWith(".localhost", StringComparison.Ordinal))
        {
            var slug = normalizedHost[..^".localhost".Length];
            return TenantSlugValidator.IsValid(slug)
                ? new TenantHostResolution(TenantHostKind.Tenant, slug)
                : TenantHostResolution.Unknown();
        }

        _logger.LogDebug("Unknown host received for tenant resolution: {Host}", normalizedHost);
        return TenantHostResolution.Unknown();
    }

}
