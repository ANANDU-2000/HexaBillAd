using System.Data.Common;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

[Collection("HttpPostgresIntegration")]
public class ProductStockConcurrencyPostgreSqlTests
{
    [SkippableFact]
    public async Task ConcurrentWithdrawals_CannotOverdraw_AndOnlyCommittedMovementIsRecorded()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var tenantId = 1_500_000 + Random.Shared.Next(1, 100_000);
        await using var seed = Open(connection!, tenantId);
        await PostgresTestSchema.EnsureCreatedAsync(seed);
        seed.Tenants.Add(new Tenant { Id = tenantId, Name = "Synthetic stock concurrency", Subdomain = $"stock-{tenantId}" });
        seed.Users.Add(new User { Id = tenantId, TenantId = tenantId, OwnerId = tenantId, Name = "QA Owner", Email = $"stock-{tenantId}@example.invalid", PasswordHash = "synthetic-unused", Role = UserRole.Owner, CreatedAt = DateTime.UtcNow });
        var product = new Product { TenantId = tenantId, OwnerId = tenantId, Sku = $"STOCK-{tenantId}", NameEn = "Synthetic stock", UnitType = "PCS", ConversionToBase = 1m, StockQty = 10m, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        seed.Products.Add(product);
        await seed.SaveChangesAsync();
        try
        {
            var barrier = new BothStockReads();
            async Task<bool> Withdraw()
            {
                await using var db = Open(connection!, tenantId, barrier);
                return await new ProductService(db, NullLogger<ProductService>.Instance)
                    .AdjustStockAsync(product.Id, -7m, "Synthetic concurrent withdrawal", tenantId, tenantId);
            }
            var results = await Task.WhenAll(Withdraw(), Withdraw());
            await seed.Entry(product).ReloadAsync();
            Assert.Equal(3m, product.StockQty);
            Assert.Equal(1, results.Count(success => success));
            Assert.Equal(1, await seed.InventoryTransactions.CountAsync(t => t.ProductId == product.Id));
            Assert.Equal(1, await seed.AuditLogs.CountAsync(t => t.UserId == tenantId && t.Action == "Stock Adjustment"));

            // A forged tenant cannot adjust this product.
            Assert.False(await new ProductService(seed, NullLogger<ProductService>.Instance)
                .AdjustStockAsync(product.Id, 100m, "Forged tenant", tenantId, tenantId + 1));
            await seed.Entry(product).ReloadAsync();
            Assert.Equal(3m, product.StockQty);
        }
        finally
        {
            seed.InventoryTransactions.RemoveRange(seed.InventoryTransactions.Where(t => t.ProductId == product.Id));
            seed.AuditLogs.RemoveRange(seed.AuditLogs.Where(t => t.UserId == tenantId));
            seed.Products.Remove(product);
            seed.Users.RemoveRange(seed.Users.Where(u => u.Id == tenantId));
            seed.Tenants.RemoveRange(seed.Tenants.Where(t => t.Id == tenantId));
            await seed.SaveChangesAsync();
        }
    }

    private static AppDbContext Open(string connection, int tenantId, DbCommandInterceptor? interceptor = null)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection);
        if (interceptor != null) options.AddInterceptors(interceptor);
        var db = new AppDbContext(options.Options);
        db.SetRequestTenantScope(tenantId, false);
        return db;
    }

    // Synchronize the actual PostgreSQL reads so both attempts see the same starting stock.
    private sealed class BothStockReads : DbCommandInterceptor
    {
        private int reads;
        private readonly TaskCompletionSource ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand command,
            CommandExecutedEventData eventData, DbDataReader result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.StartsWith("SELECT") && command.CommandText.Contains("FROM \"Products\""))
            {
                if (Interlocked.Increment(ref reads) == 2) ready.TrySetResult();
                await ready.Task.WaitAsync(TimeSpan.FromSeconds(10), cancellationToken);
            }
            return result;
        }
    }
}
