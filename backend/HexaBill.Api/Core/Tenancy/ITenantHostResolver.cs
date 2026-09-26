using HexaBill.Api.Models;

namespace HexaBill.Api.Core.Tenancy;

public interface ITenantHostResolver
{
    Task<TenantHostResolution> ResolveAsync(HttpContext context, CancellationToken cancellationToken = default);
    void Invalidate(string? slug);
}
