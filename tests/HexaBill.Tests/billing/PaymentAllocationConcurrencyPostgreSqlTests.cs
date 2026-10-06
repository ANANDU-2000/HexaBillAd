using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HexaBill.Tests;

public class PaymentAllocationConcurrencyPostgreSqlTests
{
    [SkippableFact]
    public async Task SimultaneousAllocations_CannotSpendInvoiceOutstandingTwice()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var tenantId = 1_700_000 + Random.Shared.Next(1, 50_000);
        var applicationName = $"allocation-race-{tenantId}";
        var attemptConnection = new NpgsqlConnectionStringBuilder(connection!) { ApplicationName = applicationName }.ConnectionString;
        await using (var seed = Open(connection!, tenantId))
        {
            await PostgresTestSchema.EnsureCreatedAsync(seed);
            PaymentAllocationTests.Seed(seed, tenantId, tenantId);
            await seed.SaveChangesAsync();
        }

        await using var blocker = Open(connection!, tenantId);
        await using var blockerTransaction = await blocker.Database.BeginTransactionAsync();
        await blocker.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT \"Id\" FROM \"Sales\" WHERE \"Id\" = {tenantId} AND \"TenantId\" = {tenantId} FOR NO KEY UPDATE");
        var attempts = Enumerable.Range(0, 2).Select(_ => Task.Run(async () =>
        {
            await using var db = Open(attemptConnection, tenantId);
            try
            {
                await PaymentAllocationTests.Service(db).AllocatePaymentAsync(
                    PaymentAllocationTests.Request(100m, tenantId, tenantId), tenantId, tenantId);
                return true;
            }
            catch (InvalidOperationException) { return false; }
        })).ToArray();

        try
        {
            // Both transactions reach the held invoice before it is released. This
            // exposes stale outstanding reads without relying on thread scheduling.
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
            Assert.True(bothBlocked, "Both allocation transactions must be waiting on the held invoice.");
            await blockerTransaction.CommitAsync();
            var results = await Task.WhenAll(attempts).WaitAsync(TimeSpan.FromSeconds(20));

            await using var verify = Open(connection!, tenantId);
            Assert.Equal(100m, await verify.Payments.Where(p => p.TenantId == tenantId).SumAsync(p => p.Amount));
            Assert.Equal(1, results.Count(result => result));
            Assert.Equal(100m, (await verify.Sales.SingleAsync(s => s.Id == tenantId)).PaidAmount);
            Assert.Single(await verify.AuditLogs.Where(a => a.TenantId == tenantId).ToListAsync());
        }
        finally
        {
            try { await blockerTransaction.RollbackAsync(); } catch { }
            await Task.WhenAll(attempts).WaitAsync(TimeSpan.FromSeconds(20));
            await using var cleanup = Open(connection!, tenantId);
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
