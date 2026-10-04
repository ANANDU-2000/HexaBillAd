using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class InvoiceVersionTests
{
    [Fact]
    public async Task UnimplementedRestore_LeavesInvoiceLinesStockAndHistoryUnchanged()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("VersionRestore_" + Guid.NewGuid()).Options);
        db.SetRequestTenantScope(10, isPlatformScope: false);
        var sale = new Sale { Id = 1, TenantId = 10, OwnerId = 10, InvoiceNo = "INV-1", GrandTotal = 105, Version = 2 };
        var product = new Product { Id = 1, TenantId = 10, OwnerId = 10, NameEn = "Fixture", StockQty = 8, ConversionToBase = 1 };
        db.Sales.Add(sale);
        db.Products.Add(product);
        db.SaleItems.Add(new SaleItem { Id = 1, SaleId = 1, ProductId = 1, Qty = 2, UnitPrice = 50, LineTotal = 105 });
        db.InvoiceVersions.Add(new InvoiceVersion { Id = 1, TenantId = 10, OwnerId = 10, SaleId = 1, VersionNumber = 1,
            DataJson = "{\"Sale\":{\"GrandTotal\":50},\"Items\":[{\"ProductId\":1,\"Qty\":1}]}" });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var service = new SaleService(db, null!, null!, null!, null!, null!, null!, null!, null!, null!, null!, null!, null!, null!,
            NullLogger<SaleService>.Instance);
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => service.RestoreInvoiceVersionAsync(1, 1, 1, 10));

        Assert.Contains("temporarily unavailable", error.Message);
        Assert.Empty(db.ChangeTracker.Entries());
        Assert.Equal(8m, (await db.Products.AsNoTracking().SingleAsync()).StockQty);
        var persisted = await db.Sales.AsNoTracking().SingleAsync();
        Assert.Equal(105m, persisted.GrandTotal);
        Assert.Equal(2, persisted.Version);
        Assert.Equal(2m, (await db.SaleItems.AsNoTracking().SingleAsync()).Qty);
        Assert.Single(await db.InvoiceVersions.AsNoTracking().ToListAsync());
        Assert.Empty(await db.InventoryTransactions.AsNoTracking().ToListAsync());
        Assert.Empty(await db.AuditLogs.AsNoTracking().ToListAsync());
    }
}
