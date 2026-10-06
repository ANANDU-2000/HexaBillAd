using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Purchases;
using HexaBill.Api.Modules.Returns;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

public class PurchaseReturnStockTests
{
    [Fact]
    public async Task PurchaseReturn_UsesConversionFrozenAtPurchase_NotCurrentProductRatio()
    {
        await using var db = await DatabaseAsync();
        var service = new ReturnService(db, null!, null!, null!);
        await service.CreatePurchaseReturnAsync(new CreatePurchaseReturnRequest
        {
            PurchaseId = 1,
            Items = [new PurchaseReturnItemRequest { PurchaseItemId = 1, Qty = 1 }]
        }, 1, 10);
        db.ChangeTracker.Clear();
        Assert.Equal(88m, (await db.Products.SingleAsync()).StockQty);
        Assert.Equal(-12m, (await db.InventoryTransactions.SingleAsync()).ChangeQty);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(3)]
    public async Task PurchaseReturn_RejectsNonPositiveOrExcessQuantityWithoutChangingStock(decimal qty)
    {
        await using var db = await DatabaseAsync();
        var service = new ReturnService(db, null!, null!, null!);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreatePurchaseReturnAsync(new CreatePurchaseReturnRequest
        {
            PurchaseId = 1,
            Items = [new PurchaseReturnItemRequest { PurchaseItemId = 1, Qty = qty }]
        }, 1, 10));

        db.ChangeTracker.Clear();
        Assert.Equal(100m, (await db.Products.SingleAsync()).StockQty);
        Assert.Empty(await db.PurchaseReturns.ToListAsync());
        Assert.Empty(await db.InventoryTransactions.ToListAsync());
    }

    [Fact]
    public async Task PurchaseReturn_CannotReturnAlreadyReturnedQuantityTwice()
    {
        await using var db = await DatabaseAsync();
        var service = new ReturnService(db, null!, null!, null!);
        var request = new CreatePurchaseReturnRequest
        {
            PurchaseId = 1,
            Items = [new PurchaseReturnItemRequest { PurchaseItemId = 1, Qty = 2 }]
        };

        await service.CreatePurchaseReturnAsync(request, 1, 10);
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreatePurchaseReturnAsync(request, 1, 10));

        db.ChangeTracker.Clear();
        Assert.Equal(76m, (await db.Products.SingleAsync()).StockQty);
        Assert.Single(await db.PurchaseReturns.ToListAsync());
        Assert.Single(await db.InventoryTransactions.ToListAsync());
    }

    [Fact]
    public async Task SavedConversionAtPurchase_CannotBeOverwrittenByApplicationSave()
    {
        await using var db = await DatabaseAsync();
        var line = await db.PurchaseItems.SingleAsync();
        line.ConversionAtPurchase = 99;
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public void PurchaseReturn_WithoutFrozenConversion_FallsBackToProductRatio()
    {
        var line = new PurchaseItem { ConversionAtPurchase = null, Product = new Product { ConversionToBase = 6 } };
        Assert.Equal(18m, PurchaseStockBasis.BaseQuantity(line, line.Product, 3));
    }

    private static async Task<AppDbContext> DatabaseAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant { Id = 10, Name = "Purchase return fixture", Subdomain = "purch-ret" });
        db.Users.Add(new User { Id = 1, TenantId = 10, OwnerId = 10, Name = "Owner", Email = "p@example.test", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now });
        var product = new Product { Id = 1, TenantId = 10, OwnerId = 10, NameEn = "Purchase product", Sku = "P-1", StockQty = 100, CostPrice = 10, ConversionToBase = 12, CreatedAt = now, UpdatedAt = now };
        db.Products.Add(product);
        db.Purchases.Add(new Purchase { Id = 1, TenantId = 10, OwnerId = 10, CreatedBy = 1, SupplierName = "Supplier", InvoiceNo = "PO-1", PurchaseDate = now, CreatedAt = now, TotalAmount = 100 });
        db.PurchaseItems.Add(new PurchaseItem
        {
            Id = 1,
            PurchaseId = 1,
            ProductId = 1,
            Qty = 2,
            UnitCost = 50,
            LineTotal = 100,
            ConversionAtPurchase = 12
        });
        await db.SaveChangesAsync();
        product.ConversionToBase = 24;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
    }
}
