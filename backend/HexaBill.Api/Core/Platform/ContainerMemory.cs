namespace HexaBill.Api.Core.Platform;

/// <summary>
/// Memory reading against the limit the host actually enforces (cgroup), not against the process's own working set.
/// When no limit can be read the reading is unavailable; callers must not show a percentage then.
/// </summary>
public sealed record ContainerMemoryReading(bool Available, double? LimitMb, double? UsedMb, string Source)
{
    public static ContainerMemoryReading Unavailable(string source = "unavailable") => new(false, null, null, source);
}

public static class ContainerMemory
{
    // cgroup v1 reports "unlimited" as a huge number (about 2^63); anything this large is not a real limit.
    private const double UnlimitedBytes = 1L << 60;

    /// <summary>Parses a cgroup memory limit file value into MB. Null for "max", empty, invalid or unlimited.</summary>
    public static double? ParseLimitMb(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var text = raw.Trim();
        if (text.Equals("max", StringComparison.OrdinalIgnoreCase)) return null;
        if (!double.TryParse(text, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var bytes)) return null;
        if (bytes <= 0 || bytes >= UnlimitedBytes) return null;
        return bytes / (1024.0 * 1024.0);
    }

    public static ContainerMemoryReading Read(double processWorkingSetMb, Func<string, string?>? readFile = null)
    {
        readFile ??= path => { try { return File.Exists(path) ? File.ReadAllText(path) : null; } catch { return null; } };
        var v2 = ParseLimitMb(readFile("/sys/fs/cgroup/memory.max"));
        if (v2.HasValue)
            return new ContainerMemoryReading(true, Math.Round(v2.Value, 2), Math.Round(processWorkingSetMb, 2), "cgroup-v2 memory.max vs process working set");
        var v1 = ParseLimitMb(readFile("/sys/fs/cgroup/memory/memory.limit_in_bytes"));
        if (v1.HasValue)
            return new ContainerMemoryReading(true, Math.Round(v1.Value, 2), Math.Round(processWorkingSetMb, 2), "cgroup-v1 memory.limit_in_bytes vs process working set");
        return ContainerMemoryReading.Unavailable("no cgroup memory limit found");
    }
}
