namespace HexaBill.Api.Core.Platform;

/// <summary>
/// Platform monitoring metric with source / unit / as-of (MASTER-LOOP §12.7).
/// Never invent a green zero when the underlying signal is unavailable.
/// </summary>
public sealed record PlatformMetric(
    string Key,
    object? Value,
    string Unit,
    string Source,
    DateTime AsOf,
    string Availability = "available");

public static class PlatformMetrics
{
    public static object BuildResourceUsage(
        DateTime asOf,
        double memoryUsedMb,
        double workingSetMb,
        int? activeConnections,
        int maxConnections,
        bool connectionStatsAvailable)
    {
        var memoryPct = workingSetMb > 0 ? (memoryUsedMb / workingSetMb) * 100 : 0;
        double? poolPct = connectionStatsAvailable && maxConnections > 0 && activeConnections.HasValue
            ? (double)activeConnections.Value / maxConnections * 100
            : null;

        var limitsHint =
            memoryPct > 90 || (poolPct is > 90) ? "critical"
            : memoryPct > 75 || (poolPct is > 75) ? "warning"
            : "ok";

        var metrics = new List<PlatformMetric>
        {
            new("heapMemoryMb", Math.Round(memoryUsedMb, 2), "MB", "GC.GetTotalMemory", asOf),
            new("processWorkingSetMb", Math.Round(workingSetMb, 2), "MB", "Environment.WorkingSet", asOf),
            new("heapVsWorkingSetPercent", Math.Round(memoryPct, 2), "percent", "derived(heap/workingSet)", asOf),
            new(
                "activeDbConnections",
                connectionStatsAvailable ? activeConnections : null,
                "connections",
                "pg_stat_activity",
                asOf,
                connectionStatsAvailable ? "available" : "unavailable"),
            new(
                "maxDbConnections",
                connectionStatsAvailable ? maxConnections : null,
                "connections",
                "config.default_or_pg",
                asOf,
                connectionStatsAvailable ? "available" : "unavailable"),
            new(
                "connectionPoolUsagePercent",
                poolPct.HasValue ? Math.Round(poolPct.Value, 2) : null,
                "percent",
                "derived(active/max)",
                asOf,
                connectionStatsAvailable ? "available" : "unavailable"),
        };

        return new
        {
            asOf,
            // Flat fields retained for existing Super Admin UI.
            memoryUsedMb = Math.Round(memoryUsedMb, 2),
            workingSetMb = Math.Round(workingSetMb, 2),
            memoryUsagePercent = Math.Round(memoryPct, 2),
            activeConnections = connectionStatsAvailable ? activeConnections : null,
            maxConnections = connectionStatsAvailable ? maxConnections : (int?)null,
            connectionPoolUsagePercent = poolPct.HasValue ? Math.Round(poolPct.Value, 2) : (double?)null,
            connectionStatsAvailable,
            limitsHint,
            metrics,
        };
    }
}
