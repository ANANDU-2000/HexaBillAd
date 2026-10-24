using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HexaBill.Tests;

public class InvoiceSeriesStartPostgreSqlTests
{
    [SkippableFact]
    public async Task ConcurrentSalesUnderTenantLock_ReceiveUniqueContiguousSeriesNumbers()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var tenantId = 1_750_000 + Random.Shared.Next(1, 50_000);
        var now = DateTime.UtcNow;
        await using (var seed = Open(connection!, tenantId))
        {
            await PostgresTestSchema.EnsureCreatedAsync(seed);
            seed.Tenants.Add(new Tenant { Id = tenantId, Name = "Series fixture", Subdomain = $"series-{tenantId}" });
            seed.Users.Add(new User { Id = tenantId, TenantId = tenantId, OwnerId = tenantId, Name = "Fixture owner", Email = $"series-{tenantId}@example.test", PasswordHash = "fixture", Role = UserRole.Owner, CreatedAt = now });
            seed.Settings.Add(new Setting { TenantId = tenantId, OwnerId = tenantId, Key = InvoiceNumberService.SeriesStartSettingKey, Value = "7000" });
            // Production shape: smoke reference, 10-digit legacy numbers, migrated Starplus range, a deleted 7001.
            foreach (var (invoiceNo, deleted) in new[] { ("FH-SMK-1791254849", false), ("1791254859", false), ("6889", false), ("7000", false), ("7001", true) })
                seed.Sales.Add(NewSale(tenantId, invoiceNo, now, deleted));
            await seed.SaveChangesAsync();
        }

        try
        {
            const int workers = 8;
            var issued = await Task.WhenAll(Enumerable.Range(0, workers).Select(_ => Task.Run(async () =>
            {
                // Same contract as SaleService.CreateSaleInternalAsync: xact lock, generate, insert, commit.
                await using var db = Open(connection!, tenantId);
                await using var transaction = await db.Database.BeginTransactionAsync();
                await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock({0})", 1000000 + tenantId);
                var invoiceNo = await new InvoiceNumberService(db, new ConfigurationBuilder().Build())
                    .GenerateNextInvoiceNumberInTransactionAsync(tenantId);
                db.Sales.Add(NewSale(tenantId, invoiceNo, DateTime.UtcNow, false));
                await db.SaveChangesAsync();
                await transaction.CommitAsync();
                return invoiceNo;
            })));

            Assert.Equal(Enumerable.Range(7002, workers).Select(n => n.ToString()), issued.OrderBy(n => n));
        }
        finally
        {
            await using var cleanup = Open(connection!, tenantId);
            await cleanup.Sales.IgnoreQueryFilters().Where(s => s.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Settings.Where(s => s.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Users.Where(u => u.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Tenants.Where(t => t.Id == tenantId).ExecuteDeleteAsync();
        }
    }

    private static Sale NewSale(int tenantId, string invoiceNo, DateTime at, bool deleted) => new()
    {
        TenantId = tenantId, OwnerId = tenantId, CreatedBy = tenantId, InvoiceNo = invoiceNo, InvoiceDate = at, CreatedAt = at,
        Subtotal = 10m, GrandTotal = 10.5m, TotalAmount = 10.5m, PaymentStatus = SalePaymentStatus.Pending,
        IsDeleted = deleted, IsFinalized = true
    };

    private static AppDbContext Open(string connection, int tenantId)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options);
        db.SetRequestTenantScope(tenantId, false);
        return db;
    }
}
