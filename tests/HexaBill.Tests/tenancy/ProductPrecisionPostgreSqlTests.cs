using System.Globalization;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Products;
using HexaBill.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

[Collection("HttpPostgresIntegration")]
public class ProductPrecisionPostgreSqlTests
{
    [SkippableTheory]
    [InlineData("0.0001")]
    [InlineData("1.2345")]
    public async Task SupportedConversion_PersistsExactly_InPostgreSql(string input)
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var tenantId = 1_700_000 + Random.Shared.Next(1, 100_000);
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection!).Options);
        db.SetRequestTenantScope(tenantId, false);
        await PostgresTestSchema.EnsureCreatedAsync(db);
        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            // Rehearse the real forward operation against the old schema. All
            // DDL and synthetic rows roll back; this does not fake EF history.
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Products\" ALTER COLUMN \"ConversionToBase\" TYPE numeric(18,2);");
            db.Tenants.Add(new Tenant { Id = tenantId, Name = "Synthetic precision", Subdomain = $"precision-{tenantId}" });
            var legacy = new Product { TenantId = tenantId, OwnerId = tenantId, Sku = $"LEGACY-{tenantId}", NameEn = "Legacy synthetic item", UnitType = "PCS", ConversionToBase = 1.25m, StockQty = 12.5m, CostPrice = 5.75m, SellPrice = 8.5m, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            db.Products.Add(legacy);
            await db.SaveChangesAsync();
            var upgrade = new PreserveProductConversionPrecision { ActiveProvider = "Npgsql.EntityFrameworkCore.PostgreSQL" };
            foreach (var command in db.GetService<IMigrationsSqlGenerator>().Generate(upgrade.UpOperations, db.Model))
                await db.Database.ExecuteSqlRawAsync(command.CommandText);
            await db.Entry(legacy).ReloadAsync();
            Assert.Equal(1.25m, legacy.ConversionToBase);
            Assert.Equal(12.5m, legacy.StockQty);
            Assert.Equal(5.75m, legacy.CostPrice);
            Assert.Equal(8.5m, legacy.SellPrice);
            var conversion = decimal.Parse(input, CultureInfo.InvariantCulture);
            var service = new ProductService(db, NullLogger<ProductService>.Instance);
            var created = await service.CreateProductAsync(new CreateProductRequest
            {
                Sku = $"PRECISION-{tenantId}", NameEn = "Synthetic precision", UnitType = "KG",
                ConversionToBase = conversion, CostPrice = 1m, SellPrice = 2m,
            }, tenantId);
            var stored = await db.Products.AsNoTracking().SingleAsync(p => p.Id == created.Id);
            Assert.Equal(conversion, stored.ConversionToBase);
            Assert.True(stored.ConversionToBase > 0);
            Assert.Equal(tenantId, stored.TenantId);
            Assert.Equal(0m, stored.StockQty);

            // Roll back the application with the widened schema. A Down operation
            // must refuse to discard precision; recover the test transaction at a savepoint.
            await transaction.CreateSavepointAsync("before_down");
            var downCommands = db.GetService<IMigrationsSqlGenerator>().Generate(upgrade.DownOperations, db.Model);
            var failure = await Assert.ThrowsAsync<Npgsql.PostgresException>(async () =>
            {
                foreach (var command in downCommands) await db.Database.ExecuteSqlRawAsync(command.CommandText);
            });
            Assert.Equal("P0001", failure.SqlState);
            await transaction.RollbackToSavepointAsync("before_down");
            Assert.Equal(conversion, (await db.Products.AsNoTracking().SingleAsync(p => p.Id == created.Id)).ConversionToBase);
        }
        finally { await transaction.RollbackAsync(); }
    }
}
