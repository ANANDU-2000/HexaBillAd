using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>
/// The unique index IX_Products_TenantId_Barcode covers deactivated products too, but the
/// create path only checked active rows. A new product then hit a raw unique violation that
/// surfaced as a misleading "SKU already exists" 409. Skips without HEXABILL_TEST_POSTGRES.
/// </summary>
[Collection("HttpPostgresIntegration")]
public class ProductBarcodeConflictPostgreSqlTests
{
    [SkippableFact]
    public async Task ExplicitBarcode_HeldByDeactivatedProduct_IsRejectedWithNamedProduct()
    {
        var tenantId = 1_800_000 + Random.Shared.Next(1, 100_000);
        await using var db = await FixtureAsync(tenantId);
        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            db.Products.Add(NewProduct(tenantId, "OLD-BC-1", "Old retired item", barcode: "BC-100", active: false));
            await db.SaveChangesAsync();

            var service = new ProductService(db, NullLogger<ProductService>.Instance);
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateProductAsync(new CreateProductRequest
            {
                Sku = "NEW-BC-1", NameEn = "New item", UnitType = "PCS", ConversionToBase = 1, CostPrice = 1, SellPrice = 2,
                Barcode = "BC-100",
            }, tenantId));

            Assert.Contains("deactivated product", ex.Message);
            Assert.Contains("Old retired item", ex.Message);
            Assert.DoesNotContain("SKU already exists", ex.Message);
        }
        finally { await transaction.RollbackAsync(); }
    }

    [SkippableTheory]
    [InlineData(true)]  // control: an active holder of the barcode already skips the auto-barcode
    [InlineData(false)] // regression: a deactivated holder must also skip it instead of failing the insert
    public async Task SkuDerivedBarcode_HeldByAnyProduct_IsSkippedNotInserted(bool holderActive)
    {
        var tenantId = 1_800_000 + Random.Shared.Next(1, 100_000);
        await using var db = await FixtureAsync(tenantId);
        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            db.Products.Add(NewProduct(tenantId, "HOLDER-1", "Holder item", barcode: "BC-200", active: holderActive));
            await db.SaveChangesAsync();

            var service = new ProductService(db, NullLogger<ProductService>.Instance);
            var created = await service.CreateProductAsync(new CreateProductRequest
            {
                Sku = "BC-200", NameEn = "Sku as barcode item", UnitType = "PCS", ConversionToBase = 1, CostPrice = 1, SellPrice = 2,
            }, tenantId);

            // The SKU must not be taken as the barcode; the service falls back to a generated HB barcode.
            var stored = await db.Products.AsNoTracking().SingleAsync(p => p.Id == created.Id);
            Assert.NotEqual("BC-200", stored.Barcode);
            Assert.StartsWith($"HB{tenantId}-", stored.Barcode);
            Assert.Equal("BC-200", stored.Sku);
            Assert.True(stored.IsActive);
        }
        finally { await transaction.RollbackAsync(); }
    }

    private static Product NewProduct(int tenantId, string sku, string name, string barcode, bool active) => new()
    {
        TenantId = tenantId, OwnerId = tenantId, Sku = sku, Barcode = barcode, NameEn = name, UnitType = "PCS",
        ConversionToBase = 1, CostPrice = 1, SellPrice = 2, StockQty = 0, IsActive = active,
        CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
    };

    private static async Task<AppDbContext> FixtureAsync(int tenantId)
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection!).Options);
        db.SetRequestTenantScope(tenantId, false);
        await PostgresTestSchema.EnsureCreatedAsync(db);
        db.Tenants.Add(new Tenant { Id = tenantId, Name = "Synthetic barcode conflict", Subdomain = $"barcode-{tenantId}" });
        await db.SaveChangesAsync();
        return db;
    }
}
