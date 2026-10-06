using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HexaBill.Tests;

public class PaymentIdempotencyConcurrencyPostgreSqlTests
{
    [SkippableTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task TenantSharedKey_DoesNotReplayOrBlockForeignPayment(bool allocate)
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var tenantA = 1_900_000 + Random.Shared.Next(1, 20_000);
        var tenantB = tenantA + 25_000;
        var key = $"shared-key-fixture-{tenantA}";
        try
        {
            foreach (var tenant in new[] { tenantA, tenantB })
            {
                await using var seed = Open(connection!, tenant);
                await PostgresTestSchema.EnsureCreatedAsync(seed);
                PaymentAllocationTests.Seed(seed, tenant, tenant);
                await seed.SaveChangesAsync();
            }
            int firstId, secondId;
            await using (var first = Open(connection!, tenantA))
                firstId = (await PaymentIdempotencyTests.PostAsync(first, allocate, tenantA, tenantA, 20m, key)).Payment.Id;
            await using (var second = Open(connection!, tenantB))
                secondId = (await PaymentIdempotencyTests.PostAsync(second, allocate, tenantB, tenantB, 20m, key)).Payment.Id;
            Assert.NotEqual(firstId, secondId);
            foreach (var (tenant, paymentId) in new[] { (tenantA, firstId), (tenantB, secondId) })
            {
                await using var retry = Open(connection!, tenant);
                var replay = await PaymentIdempotencyTests.PostAsync(retry, allocate, tenant, tenant, 20m, key);
                Assert.Equal(paymentId, replay.Payment.Id);
                Assert.Equal(tenant, replay.Payment.CustomerId);
                Assert.Single(await retry.Payments.Where(p => p.TenantId == tenant).ToListAsync());
            }
        }
        finally
        {
            foreach (var tenant in new[] { tenantA, tenantB })
            {
                await using var cleanup = Open(connection!, tenant);
                await cleanup.PaymentIdempotencies.Where(p => p.Payment.TenantId == tenant).ExecuteDeleteAsync();
                await cleanup.AuditLogs.Where(a => a.TenantId == tenant).ExecuteDeleteAsync();
                await cleanup.Payments.Where(p => p.TenantId == tenant).ExecuteDeleteAsync();
                await cleanup.Sales.Where(s => s.TenantId == tenant).ExecuteDeleteAsync();
                await cleanup.Customers.Where(c => c.TenantId == tenant).ExecuteDeleteAsync();
                await cleanup.Users.Where(u => u.TenantId == tenant).ExecuteDeleteAsync();
                await cleanup.Tenants.Where(t => t.Id == tenant).ExecuteDeleteAsync();
            }
        }
    }

    [SkippableTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task SimultaneousSameKey_ReturnsSamePaymentAndCommitsOnce(bool allocate)
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var tenantId = 1_800_000 + Random.Shared.Next(1, 50_000);
        var applicationName = $"payment-retry-{tenantId}";
        var key = $"retry-fixture-{tenantId}";
        var attemptConnection = new NpgsqlConnectionStringBuilder(connection!) { ApplicationName = applicationName }.ConnectionString;
        await using (var seed = Open(connection!, tenantId))
        {
            await PostgresTestSchema.EnsureCreatedAsync(seed);
            PaymentAllocationTests.Seed(seed, tenantId, tenantId);
            await seed.SaveChangesAsync();
        }

        await using var blocker = Open(connection!, tenantId);
        await using var transaction = await blocker.Database.BeginTransactionAsync();
        await blocker.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT \"Id\" FROM \"Sales\" WHERE \"Id\" = {tenantId} AND \"TenantId\" = {tenantId} FOR NO KEY UPDATE");
        var attempts = Enumerable.Range(0, 2).Select(_ => Task.Run(async () =>
        {
            await using var db = Open(attemptConnection, tenantId);
            try
            {
                var result = await PaymentIdempotencyTests.PostAsync(db, allocate, tenantId, tenantId, 20m, key);
                return (Id: result.Payment.Id, Error: (string?)null);
            }
            catch (Exception ex) { return (Id: 0, Error: (string?)ex.GetType().Name); }
        })).ToArray();

        try
        {
            await using var observer = new NpgsqlConnection(connection);
            await observer.OpenAsync();
            var bothBlocked = false;
            for (var i = 0; i < 200; i++)
            {
                await using var command = new NpgsqlCommand(
                    "SELECT COUNT(*) FROM pg_stat_activity WHERE application_name = @name AND wait_event_type = 'Lock'", observer);
                command.Parameters.AddWithValue("name", applicationName);
                if (Convert.ToInt64(await command.ExecuteScalarAsync()) >= 2) { bothBlocked = true; break; }
                await Task.Delay(50);
            }
            Assert.True(bothBlocked, "Both retry requests must wait before the held invoice is released.");
            await transaction.CommitAsync();
            var results = await Task.WhenAll(attempts).WaitAsync(TimeSpan.FromSeconds(20));
            Assert.All(results, result => Assert.Null(result.Error));
            Assert.Equal(results[0].Id, results[1].Id);
            await using var verify = Open(connection!, tenantId);
            Assert.Equal(20m, await verify.Payments.Where(p => p.TenantId == tenantId).SumAsync(p => p.Amount));
            Assert.Single(await verify.AuditLogs.Where(a => a.TenantId == tenantId).ToListAsync());
        }
        finally
        {
            try { await transaction.RollbackAsync(); } catch { }
            await Task.WhenAll(attempts).WaitAsync(TimeSpan.FromSeconds(20));
            await using var cleanup = Open(connection!, tenantId);
            await cleanup.PaymentIdempotencies.Where(p => p.Payment.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.AuditLogs.Where(a => a.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Payments.Where(p => p.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Sales.Where(s => s.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Customers.Where(c => c.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Users.Where(u => u.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Tenants.Where(t => t.Id == tenantId).ExecuteDeleteAsync();
        }
    }

    private static AppDbContext Open(string connection, int tenantId)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options);
        db.SetRequestTenantScope(tenantId, false);
        return db;
    }
}
