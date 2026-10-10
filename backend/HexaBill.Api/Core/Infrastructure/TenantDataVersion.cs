using System.Collections.Concurrent;

namespace HexaBill.Api.Core.Infrastructure;

/// <summary>
/// In-process per-tenant change counter, bumped whenever tenant-owned rows are saved. Report caches include it
/// in their key so dashboards reflect a new sale/expense/payment immediately instead of after cache expiry.
/// Single-instance deployment assumption (Render starter, 1 instance); with several instances use a shared store.
/// </summary>
public static class TenantDataVersion
{
    private static readonly ConcurrentDictionary<int, long> Versions = new();

    public static long Get(int tenantId) => Versions.TryGetValue(tenantId, out var v) ? v : 0;

    public static void Bump(IEnumerable<int> tenantIds)
    {
        foreach (var id in tenantIds.Distinct())
            Versions.AddOrUpdate(id, 1, (_, v) => v + 1);
    }
}
