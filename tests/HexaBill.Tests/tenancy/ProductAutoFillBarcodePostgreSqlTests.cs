using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>
/// POST /api/products/barcodes/auto-fill-missing opened a user transaction. Production registers
/// Npgsql EnableRetryOnFailure (Program.cs), and that strategy rejects user-initiated transactions,
/// so the endpoint returned 500. These tests use the production retry options. Skips without HEXABILL_TEST_POSTGRES.
/// </summary>
[Collection("HttpPostgresIntegration")]
public class ProductAutoFillBarcodePostgreSqlTests
{
    [SkippableFact]
    public async Task AutoFill_UnderProductionRetryPolicy_AssignsMissingBarcode()
    {
        var tenantId = 1_900_000 + Random.Shared.Next(1, 100_000);
        await using var db = await FixtureAsync(tenantId);
        db.Products.Add(NewProduct(tenantId, "AF-SKU-1", "Missing barcode item", barcode: null, active: true));
        await db.SaveChangesAsync();

        var service = new ProductService(db, NullLogger<ProductService>.Instance);
        var updated = await service.AutoFillMissingBarcodesAsync(tenantId);

        Assert.Equal(1, updated);
        var stored = await db.Products.AsNoTracking().SingleAsync(p => p.TenantId == tenantId);
        Assert.Equal("AF-SKU-1", stored.Barcode);
    }

    [SkippableFact]
    public async Task AutoFill_SkipsBarcodesHeldByDeactivatedProducts()
    {
        var tenantId = 1_900_000 + Random.Shared.Next(1, 100_000);
        await using var db = await FixtureAsync(tenantId);
        db.Products.Add(NewProduct(tenantId, "AF-OLD", "Deactivated holder", barcode: "AF-SKU-2", active: false));
        db.Products.Add(NewProduct(tenantId, "AF-SKU-2", "Missing barcode item", barcode: null, active: true));
        await db.SaveChangesAsync();

        var service = new ProductService(db, NullLogger<ProductService>.Instance);
        var updated = await service.AutoFillMissingBarcodesAsync(tenantId);

        Assert.Equal(1, updated);
        var stored = await db.Products.AsNoTracking().SingleAsync(p => p.TenantId == tenantId && p.Sku == "AF-SKU-2");
        Assert.NotEqual("AF-SKU-2", stored.Barcode);
        Assert.StartsWith($"HB{tenantId}-", stored.Barcode);
    }

    private static Product NewProduct(int tenantId, string sku, string name, string? barcode, bool active) => new()
    {
        TenantId = tenantId, OwnerId = tenantId, Sku = sku, Barcode = barcode, NameEn = name, UnitType = "PCS",
        ConversionToBase = 1, CostPrice = 1, SellPrice = 2, StockQty = 0, IsActive = active,
        CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
    };

    private static async Task<AppDbContext> FixtureAsync(int tenantId)
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        // Same retry policy as Program.cs, so the test reproduces the production failure.
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connection!, npgsql =>
            {
                npgsql.CommandTimeout(30);
                npgsql.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorCodesToAdd: null);
            })
            .Options;
        var db = new AppDbContext(options);
        db.SetRequestTenantScope(tenantId, false);
        await PostgresTestSchema.EnsureCreatedAsync(db);
        db.Tenants.Add(new Tenant { Id = tenantId, Name = "Synthetic barcode auto-fill", Subdomain = $"autofill-{tenantId}" });
        await db.SaveChangesAsync();
        return db;
    }
}
