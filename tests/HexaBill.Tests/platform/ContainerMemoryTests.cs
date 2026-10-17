using HexaBill.Api.Core.Platform;

namespace HexaBill.Tests.Platform;

/// <summary>OPS-02: capacity headroom comes from the enforced container limit, never from heap divided by working set.</summary>
public class ContainerMemoryTests
{
    [Theory]
    [InlineData("536870912", 512.0)]
    [InlineData("536870912\n", 512.0)]
    [InlineData("2147483648", 2048.0)]
    public void ParseLimitMb_ReadsRealLimits(string raw, double expectedMb) =>
        Assert.Equal(expectedMb, ContainerMemory.ParseLimitMb(raw)!.Value, 3);

    [Theory]
    [InlineData("max")]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("abc")]
    [InlineData("0")]
    [InlineData("9223372036854771712")] // cgroup v1 "unlimited"
    public void ParseLimitMb_RejectsNoLimit(string? raw) => Assert.Null(ContainerMemory.ParseLimitMb(raw));

    [Fact]
    public void Read_PrefersCgroupV2_ThenV1_ThenUnavailable()
    {
        var v2 = ContainerMemory.Read(256, p => p.EndsWith("memory.max") ? "536870912" : null);
        Assert.True(v2.Available);
        Assert.Equal(512, v2.LimitMb);
        Assert.Equal(256, v2.UsedMb);

        var v1 = ContainerMemory.Read(100, p => p.EndsWith("memory.limit_in_bytes") ? "1073741824" : null);
        Assert.True(v1.Available);
        Assert.Equal(1024, v1.LimitMb);

        var none = ContainerMemory.Read(100, _ => null);
        Assert.False(none.Available);
        Assert.Null(none.LimitMb);
    }

    [Fact]
    public void Percent_IsWorkingSetOverEnforcedLimit()
    {
        var container = new ContainerMemoryReading(true, 512, 300, "cgroup-v2");
        dynamic usage = PlatformMetrics.BuildResourceUsage(DateTime.UtcNow, 40, 300, 5, 100, true, container);
        Assert.Equal(58.59, (double)usage.memoryUsagePercent, 2);
        Assert.Equal("ok", (string)usage.limitsHint);

        dynamic warn = PlatformMetrics.BuildResourceUsage(DateTime.UtcNow, 40, 400, 5, 100, true, new ContainerMemoryReading(true, 512, 400, "cgroup-v2"));
        Assert.Equal("warning", (string)warn.limitsHint);
        dynamic crit = PlatformMetrics.BuildResourceUsage(DateTime.UtcNow, 40, 480, 5, 100, true, new ContainerMemoryReading(true, 512, 480, "cgroup-v2"));
        Assert.Equal("critical", (string)crit.limitsHint);
    }

    [Fact]
    public void HeapOverWorkingSet_NoLongerDrivesTheHint_AndMissingLimitIsNotAGreenZero()
    {
        // 95 MB heap in a 100 MB working set used to read "critical" with no limit knowledge at all.
        dynamic usage = PlatformMetrics.BuildResourceUsage(DateTime.UtcNow, 95, 100, 5, 100, true, ContainerMemoryReading.Unavailable());
        Assert.Null((double?)usage.memoryUsagePercent);
        Assert.False((bool)usage.memoryLimitAvailable);
        Assert.Equal("ok", (string)usage.limitsHint);

        var metrics = ((IEnumerable<PlatformMetric>)usage.metrics).ToList();
        var pct = metrics.Single(m => m.Key == "containerMemoryUsagePercent");
        Assert.Equal("unavailable", pct.Availability);
        Assert.Null(pct.Value);
        Assert.Contains("not capacity headroom", metrics.Single(m => m.Key == "heapVsWorkingSetPercent").Source);
    }
}
