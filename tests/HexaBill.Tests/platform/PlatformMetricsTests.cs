using HexaBill.Api.Core.Platform;

namespace HexaBill.Tests.Platform;

public class PlatformMetricsTests
{
    [Fact]
    public void BuildResourceUsage_IncludesSourceUnitAndAsOf_OnEveryMetric()
    {
        var asOf = new DateTime(2026, 10, 4, 12, 0, 0, DateTimeKind.Utc);
        dynamic usage = PlatformMetrics.BuildResourceUsage(asOf, 32.5, 200, 4, 100, connectionStatsAvailable: true);

        Assert.Equal(asOf, (DateTime)usage.asOf);
        var metrics = (IEnumerable<PlatformMetric>)usage.metrics;
        var list = metrics.ToList();
        Assert.True(list.Count >= 4);
        foreach (var m in list)
        {
            Assert.False(string.IsNullOrWhiteSpace(m.Key));
            Assert.False(string.IsNullOrWhiteSpace(m.Unit));
            Assert.False(string.IsNullOrWhiteSpace(m.Source));
            Assert.Equal(asOf, m.AsOf);
            Assert.Equal("available", m.Availability);
        }
    }

    [Fact]
    public void BuildResourceUsage_MarksConnectionMetricsUnavailable_WhenStatsMissing()
    {
        var asOf = DateTime.UtcNow;
        dynamic usage = PlatformMetrics.BuildResourceUsage(asOf, 10, 100, null, 100, connectionStatsAvailable: false);

        Assert.False((bool)usage.connectionStatsAvailable);
        Assert.Null((int?)usage.activeConnections);
        Assert.Null((double?)usage.connectionPoolUsagePercent);

        var metrics = ((IEnumerable<PlatformMetric>)usage.metrics).ToList();
        var conn = metrics.Single(m => m.Key == "activeDbConnections");
        Assert.Equal("unavailable", conn.Availability);
        Assert.Null(conn.Value);
    }

    [Fact]
    public void BuildResourceUsage_DoesNotTreatMissingPoolAsGreenZero()
    {
        var asOf = DateTime.UtcNow;
        dynamic usage = PlatformMetrics.BuildResourceUsage(asOf, 10, 100, 0, 100, connectionStatsAvailable: false);
        Assert.Null((double?)usage.connectionPoolUsagePercent);
        Assert.Equal("ok", (string)usage.limitsHint);
    }
}
