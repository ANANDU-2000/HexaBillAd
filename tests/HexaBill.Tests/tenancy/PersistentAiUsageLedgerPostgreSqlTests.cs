using HexaBill.Api.Data;
using HexaBill.Api.Modules.Assistant.Ai;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>The AI budget on real PostgreSQL: the limit check and the increment are one statement, so concurrent callers cannot overshoot.</summary>
public class PersistentAiUsageLedgerPostgreSqlTests
{
    [SkippableFact]
    public async Task ConcurrentReservations_NeverGoPastTheDailyLimit_OnPostgreSql()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection!).Options;
        await using (var setup = new AppDbContext(options))
        {
            setup.SetRequestTenantScope(null, true);
            await PostgresTestSchema.EnsureCreatedAsync(setup);
        }
        var services = new ServiceCollection();
        services.AddScoped(_ => { var db = new AppDbContext(options); db.SetRequestTenantScope(null, true); return db; });
        using var provider = services.BuildServiceProvider();
        var ledger = new PersistentAiUsageLedger(provider.GetRequiredService<IServiceScopeFactory>());

        var tenant = 5_000_000 + Random.Shared.Next(1, 90_000_000);
        var day = DateTime.UtcNow;
        var results = await Task.WhenAll(Enumerable.Range(0, 24).Select(_ => Task.Run(() => ledger.TryReserve(tenant, 7, 5, 1000, day))));
        Assert.Equal(5, results.Count(r => r));
        Assert.Equal((5, 35), ledger.Snapshot(tenant, day));

        // The token limit holds too: 35 used, 40 allowed, an estimate of 7 no longer fits.
        Assert.False(ledger.TryReserve(tenant, 7, 100, 40, day));
        Assert.True(ledger.TryReserve(tenant, 5, 100, 40, day));
        ledger.Settle(tenant, 5, 1, day);
        Assert.Equal((6, 36), ledger.Snapshot(tenant, day));

        // A second ledger object (another instance, or after a restart) sees the same numbers.
        var other = new PersistentAiUsageLedger(provider.GetRequiredService<IServiceScopeFactory>());
        Assert.Equal((6, 36), other.Snapshot(tenant, day));
        // Settling can never drive the count below zero.
        other.Settle(tenant, 0, 0, day);
        other.Settle(tenant, 1000, 0, day);
        Assert.Equal(0, other.Snapshot(tenant, day).Tokens);
    }
}
