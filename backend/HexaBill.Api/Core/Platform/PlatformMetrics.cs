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
        bool connectionStatsAvailable,
        ContainerMemoryReading? container = null)
    {
        // heap/workingSet only says how much of this process's own footprint is managed heap. It is not capacity headroom.
        var heapVsWorkingSetPct = workingSetMb > 0 ? (memoryUsedMb / workingSetMb) * 100 : 0;
        // Capacity headroom needs the limit the host enforces. Without one there is no percentage (never a green zero).
        double? limitPct = container is { Available: true, LimitMb: > 0, UsedMb: not null }
            ? container.UsedMb.Value / container.LimitMb.Value * 100
            : null;
        double? poolPct = connectionStatsAvailable && maxConnections > 0 && activeConnections.HasValue
            ? (double)activeConnections.Value / maxConnections * 100
            : null;

        var limitsHint =
            limitPct is > 90 || (poolPct is > 90) ? "critical"
            : limitPct is > 75 || (poolPct is > 75) ? "warning"
            : "ok";

        var metrics = new List<PlatformMetric>
        {
            new("heapMemoryMb", Math.Round(memoryUsedMb, 2), "MB", "GC.GetTotalMemory", asOf),
            new("processWorkingSetMb", Math.Round(workingSetMb, 2), "MB", "Environment.WorkingSet", asOf),
            new("heapVsWorkingSetPercent", Math.Round(heapVsWorkingSetPct, 2), "percent", "derived(heap/workingSet), informational only, not capacity headroom", asOf),
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
        if (container != null)
        {
            var avail = container.Available ? "available" : "unavailable";
            metrics.Add(new("containerMemoryLimitMb", container.LimitMb, "MB", container.Source, asOf, avail));
            metrics.Add(new("containerMemoryUsagePercent", limitPct.HasValue ? Math.Round(limitPct.Value, 2) : null, "percent", container.Source, asOf, avail));
        }

        return new
        {
            asOf,
            // Flat fields retained for existing Super Admin UI.
            memoryUsedMb = Math.Round(memoryUsedMb, 2),
            workingSetMb = Math.Round(workingSetMb, 2),
            // Percent of the enforced container limit; null when no limit could be read.
            memoryUsagePercent = limitPct.HasValue ? Math.Round(limitPct.Value, 2) : (double?)null,
            memoryLimitMb = container?.LimitMb,
            memoryLimitAvailable = container?.Available ?? false,
            memoryLimitSource = container?.Source ?? "not measured",
            heapVsWorkingSetPercent = Math.Round(heapVsWorkingSetPct, 2),
            activeConnections = connectionStatsAvailable ? activeConnections : null,
            maxConnections = connectionStatsAvailable ? maxConnections : (int?)null,
            connectionPoolUsagePercent = poolPct.HasValue ? Math.Round(poolPct.Value, 2) : (double?)null,
            connectionStatsAvailable,
            limitsHint,
            metrics,
        };
    }
}
