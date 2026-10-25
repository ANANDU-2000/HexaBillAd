namespace HexaBill.Tests;

/// <summary>
/// QA-HARNESS-001: process-wide environment variables are shared by every test in the run. Factories that boot the API
/// lease the integration environment here; the first lease snapshots the prior values and the last release restores them,
/// so nothing leaks into later tests. Per-factory values (storage path, connection string) do not live in the environment.
/// </summary>
internal static class TestProcessEnvironment
{
    public static readonly object Lock = new();

    private static readonly string[] IntegrationKeys =
    [
        "ConnectionStrings__DefaultConnection", "DATABASE_URL", "ConnectionStrings__PostgreSQL",
        "HEXABILL_HTTP_INTEGRATION_TEST", "DATA_PATH", "R2_ENDPOINT", "R2_ACCESS_KEY", "R2_SECRET_KEY",
    ];

    private static int _leases;
    private static Dictionary<string, string?>? _snapshot;

    /// <summary>Takes a lease on the shared integration environment. Call under <see cref="Lock"/>.</summary>
    public static void Acquire()
    {
        if (_leases++ == 0)
            _snapshot = Snapshot(IntegrationKeys);
        Environment.SetEnvironmentVariable("DATABASE_URL", string.Empty);
        Environment.SetEnvironmentVariable("ConnectionStrings__PostgreSQL", string.Empty);
        Environment.SetEnvironmentVariable("HEXABILL_HTTP_INTEGRATION_TEST", "1");
        // Storage path comes from each factory's own configuration (Storage:BasePath); an env value would win over it.
        Environment.SetEnvironmentVariable("DATA_PATH", null);
        Environment.SetEnvironmentVariable("R2_ENDPOINT", string.Empty);
        Environment.SetEnvironmentVariable("R2_ACCESS_KEY", string.Empty);
        Environment.SetEnvironmentVariable("R2_SECRET_KEY", string.Empty);
    }

    public static void Release()
    {
        lock (Lock)
        {
            if (_leases == 0) return;
            if (--_leases == 0 && _snapshot != null)
            {
                Restore(_snapshot);
                _snapshot = null;
            }
        }
    }

    public static Dictionary<string, string?> Snapshot(params string[] keys) =>
        keys.ToDictionary(k => k, Environment.GetEnvironmentVariable);

    public static void Restore(Dictionary<string, string?> snapshot)
    {
        foreach (var (key, value) in snapshot)
            Environment.SetEnvironmentVariable(key, value);
    }
}

/// <summary>Classes that change process environment variables run here, never alongside other collections.</summary>
[CollectionDefinition("ProcessEnvironment", DisableParallelization = true)]
public sealed class ProcessEnvironmentCollection;
