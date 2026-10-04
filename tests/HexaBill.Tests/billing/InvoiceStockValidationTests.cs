using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

public class InvoiceStockValidationTests
{
    [Fact]
    public async Task DuplicateProductLines_AggregateRequiredStock_BeforeRejecting()
    {
        await using var db = Database();
        db.Products.Add(new Product
        {
            Id = 1,
            TenantId = 10,
            NameEn = "Milk",
            StockQty = 10,
            ConversionToBase = 1,
            CostPrice = 5,
            UnitType = "CRTN"
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var validation = new ValidationService(db);
        var lines = new List<SaleItemRequest>
        {
            new() { ProductId = 1, Qty = 6, UnitPrice = 10 },
            new() { ProductId = 1, Qty = 6, UnitPrice = 10 }
        };

        var result = await validation.ValidateSaleStockLinesAsync(lines, tenantId: 10);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("Insufficient stock"));
    }

    [Fact]
    public async Task DuplicateProductLines_WithinAvailableStock_Passes()
    {
        await using var db = Database();
        db.Products.Add(new Product
        {
            Id = 1,
            TenantId = 10,
            NameEn = "Milk",
            StockQty = 20,
            ConversionToBase = 1,
            CostPrice = 5,
            UnitType = "CRTN"
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var validation = new ValidationService(db);
        var lines = new List<SaleItemRequest>
        {
            new() { ProductId = 1, Qty = 6, UnitPrice = 10 },
            new() { ProductId = 1, Qty = 6, UnitPrice = 10 }
        };

        var result = await validation.ValidateSaleStockLinesAsync(lines, tenantId: 10);

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task SaleEdit_DuplicateProductLines_AggregateRequiredStock()
    {
        await using var db = EditDatabase();
        var validation = new ValidationService(db);
        var lines = new List<SaleItemRequest>
        {
            new() { ProductId = 1, Qty = 6, UnitPrice = 10 },
            new() { ProductId = 1, Qty = 6, UnitPrice = 10 }
        };

        var result = await validation.ValidateSaleEditAsync(1, lines, tenantId: 10);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("Insufficient stock"));
    }

    [Fact]
    public async Task MissingWorkspaceProduct_IsRejected()
    {
        await using var db = Database();
        var validation = new ValidationService(db);
        var result = await validation.ValidateSaleStockLinesAsync(
            [new SaleItemRequest { ProductId = 1, Qty = 1, UnitPrice = 1 }], tenantId: 10);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("unavailable in this workspace", StringComparison.OrdinalIgnoreCase));
    }

    private static AppDbContext Database()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.Database.OpenConnection();
        db.Database.EnsureCreated();
        db.SetRequestTenantScope(10, false);
        return db;
    }

    private static AppDbContext EditDatabase()
    {
        var db = Database();
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant { Id = 10, Name = "Stock edit", Subdomain = "stock-edit" });
        db.Users.Add(new User { Id = 1, TenantId = 10, OwnerId = 10, Name = "Owner", Email = "edit@example.test", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now });
        var product = new Product { Id = 1, TenantId = 10, OwnerId = 10, NameEn = "Milk", StockQty = 7, ConversionToBase = 1, CostPrice = 5, UnitType = "CRTN", CreatedAt = now, UpdatedAt = now };
        var line = new SaleItem { Id = 1, SaleId = 1, ProductId = 1, Qty = 3, UnitPrice = 10, LineTotal = 30 };
        db.Products.Add(product);
        db.Sales.Add(new Sale { Id = 1, TenantId = 10, OwnerId = 10, CreatedBy = 1, InvoiceNo = "EDIT-1", InvoiceDate = now, CreatedAt = now, GrandTotal = 30, IsFinalized = true });
        db.SaleItems.Add(line);
        db.SaveChanges();
        db.ChangeTracker.Clear();
        return db;
    }
}
