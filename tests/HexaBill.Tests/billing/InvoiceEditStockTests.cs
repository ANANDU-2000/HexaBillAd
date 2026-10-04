using HexaBill.Api.Core.Infrastructure;
using System;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class InvoiceEditStockTests
{
    [Fact]
    public async Task CreateSale_DuplicateLinesExceedingStock_IsRejectedWithoutChangingStock()
    {
        await using var db = await CreateDatabaseAsync(10);
        var service = CreateService(db);
        var request = new CreateSaleRequest
        {
            InvoiceNo = "CREATE-STOCK-1",
            Items =
            [
                new SaleItemRequest { ProductId = 1, Qty = 6, UnitPrice = 10 },
                new SaleItemRequest { ProductId = 1, Qty = 6, UnitPrice = 10 }
            ]
        };

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateSaleAsync(request, 1, 10));
        Assert.Contains("Insufficient stock", error.Message, StringComparison.OrdinalIgnoreCase);
        db.ChangeTracker.Clear();
        Assert.Equal(10m, (await db.Products.AsNoTracking().SingleAsync()).StockQty);
        Assert.Empty(await db.Sales.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task CreateSale_DuplicateLinesWithinStock_DeductsAggregateQuantity()
    {
        await using var db = await CreateDatabaseAsync(20);
        var service = CreateService(db);
        var request = new CreateSaleRequest
        {
            InvoiceNo = "CREATE-STOCK-2",
            Items =
            [
                new SaleItemRequest { ProductId = 1, Qty = 6, UnitPrice = 10 },
                new SaleItemRequest { ProductId = 1, Qty = 6, UnitPrice = 10 }
            ]
        };

        await service.CreateSaleAsync(request, 1, 10);
        db.ChangeTracker.Clear();
        Assert.Equal(8m, (await db.Products.AsNoTracking().SingleAsync()).StockQty);
        Assert.Equal(2, await db.SaleItems.AsNoTracking().CountAsync());
    }

    [Fact]
    public async Task UpdateSale_DuplicateLinesExceedingStock_IsRejectedWithoutChangingStock()
    {
        await using var db = await DatabaseAsync(stockQty: 7, oldLineQty: 3);
        var service = CreateService(db);
        var request = new CreateSaleRequest
        {
            Items =
            [
                new SaleItemRequest { ProductId = 1, Qty = 6, UnitPrice = 10 },
                new SaleItemRequest { ProductId = 1, Qty = 6, UnitPrice = 10 }
            ]
        };

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => service.UpdateSaleAsync(1, request, 1, 10));
        Assert.Contains("Insufficient stock", error.Message, StringComparison.OrdinalIgnoreCase);
        db.ChangeTracker.Clear();
        Assert.Equal(7m, (await db.Products.AsNoTracking().SingleAsync()).StockQty);
        Assert.Equal(3m, (await db.SaleItems.AsNoTracking().SingleAsync()).Qty);
    }

    [Fact]
    public async Task UpdateSale_AfterProductConversionChange_UsesSavedLineConversionForStock()
    {
        await using var db = await DatabaseAsync(stockQty: 76, oldLineQty: 2, withCostSnapshot: true);
        var service = CreateService(db);
        var request = new CreateSaleRequest
        {
            Items =
            [
                new SaleItemRequest { ProductId = 1, Qty = 1, UnitPrice = 50 },
                new SaleItemRequest { ProductId = 1, Qty = 1, UnitPrice = 50 }
            ]
        };

        await service.UpdateSaleAsync(1, request, 1, 10);
        db.ChangeTracker.Clear();
        Assert.Equal(76m, (await db.Products.AsNoTracking().SingleAsync()).StockQty);
        var lines = await db.SaleItems.AsNoTracking().ToListAsync();
        Assert.Equal(2, lines.Count);
        Assert.All(lines, line => Assert.Equal(12m, line.ConversionAtSale));
        Assert.Equal(24m, lines.Sum(line => line.Qty * line.ConversionAtSale));
    }

    private static SaleService CreateService(AppDbContext db) =>
        new(db, null!, null!, new InvoiceNumbers().Object, new ValidationService(db), null!, null!, new GstTime(), null!, new NoBranchSchema(), null!,
            new VatValidation().Object, new DisallowNegativeStockSettings(), null!, NullLogger<SaleService>.Instance);

    private static async Task<AppDbContext> CreateDatabaseAsync(decimal stockQty)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant { Id = 10, Name = "Create stock", Subdomain = "create-stock" });
        db.Users.Add(new User { Id = 1, TenantId = 10, OwnerId = 10, Name = "Owner", Email = "create@example.test", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now });
        db.Products.Add(new Product
        {
            Id = 1,
            TenantId = 10,
            OwnerId = 10,
            NameEn = "Milk",
            Sku = "MILK-1",
            StockQty = stockQty,
            ConversionToBase = 1,
            CostPrice = 5,
            UnitType = "CRTN",
            CreatedAt = now,
            UpdatedAt = now
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
    }

    private static async Task<AppDbContext> DatabaseAsync(decimal stockQty, decimal oldLineQty, bool withCostSnapshot = false)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant { Id = 10, Name = "Edit stock", Subdomain = "edit-stock" });
        db.Users.Add(new User { Id = 1, TenantId = 10, OwnerId = 10, Name = "Owner", Email = "edit@example.test", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now });
        var product = new Product
        {
            Id = 1,
            TenantId = 10,
            OwnerId = 10,
            NameEn = "Milk",
            Sku = "MILK-1",
            StockQty = withCostSnapshot ? 100 : stockQty,
            ConversionToBase = 12,
            CostPrice = 5,
            UnitType = "CRTN",
            CreatedAt = now,
            UpdatedAt = now
        };
        var line = new SaleItem { Id = 1, SaleId = 1, ProductId = 1, UnitType = "CRTN", Qty = oldLineQty, UnitPrice = 50, LineTotal = oldLineQty * 50 };
        if (withCostSnapshot)
            SaleCostBasis.Capture(line, product, 10, enabled: true);
        db.Products.Add(product);
        db.Sales.Add(new Sale
        {
            Id = 1,
            TenantId = 10,
            OwnerId = 10,
            CreatedBy = 1,
            InvoiceNo = "EDIT-STOCK-1",
            InvoiceDate = now,
            CreatedAt = now,
            GrandTotal = oldLineQty * 50,
            IsFinalized = true,
            IsLocked = false
        });
        db.SaleItems.Add(line);
        await db.SaveChangesAsync();
        if (withCostSnapshot)
        {
            product.ConversionToBase = 24;
            product.StockQty = stockQty;
            await db.SaveChangesAsync();
        }
        db.ChangeTracker.Clear();
        return db;
    }

    private sealed class NoBranchSchema : ISalesSchemaService
    {
        public Task<bool> SalesHasBranchIdAndRouteIdAsync() => Task.FromResult(false);
        public void ClearColumnCheckCache() { }
    }

    private sealed class DisallowNegativeStockSettings : ISettingsService
    {
        public Task<Dictionary<string, string>> GetOwnerSettingsAsync(int tenantId) => Task.FromResult(new Dictionary<string, string>());
        public Task<string?> GetSettingValueAsync(int tenantId, string key) =>
            Task.FromResult<string?>(string.Equals(key, "ALLOW_NEGATIVE_STOCK", StringComparison.OrdinalIgnoreCase) ? "false" : null);
        public Task<bool> UpdateOwnerSettingAsync(int tenantId, string key, string value) => throw new NotSupportedException();
        public Task<bool> UpdateOwnerSettingsBulkAsync(int tenantId, Dictionary<string, string> settings) => throw new NotSupportedException();
        public Task<CompanySettings> GetCompanySettingsAsync(int tenantId) => Task.FromResult(new CompanySettings { VatNumber = "123456789012345" });
        public Task<LogoMetadata?> GetLogoMetadataAsync(int tenantId) => throw new NotSupportedException();
        public Task ClearLogoAsync(int tenantId) => throw new NotSupportedException();
        public Task ClearStampAsync(int tenantId) => throw new NotSupportedException();
        public Task ClearSignatureAsync(int tenantId) => throw new NotSupportedException();
        public Task<int> CountOtherTenantsSharingVatTrnAsync(int tenantId, string? vatTrn) => Task.FromResult(0);
    }

    private sealed class VatValidation : InterfaceStub<IVatReturnValidationService>
    {
        public VatValidation() => When(nameof(IVatReturnValidationService.IsTransactionDateInLockedPeriodAsync), _ => Task.FromResult(false));
    }

    private sealed class InvoiceNumbers : InterfaceStub<IInvoiceNumberService>
    {
        public InvoiceNumbers()
        {
            When(nameof(IInvoiceNumberService.ValidateInvoiceNumberAsync), _ => Task.FromResult(true));
            When(nameof(IInvoiceNumberService.GenerateNextInvoiceNumberInTransactionAsync), _ => Task.FromResult("INV-AUTO"));
        }
    }

    private sealed class GstTime : ITimeZoneService
    {
        public DateTime GetCurrentTime() => DateTime.UtcNow;
        public DateTime GetCurrentDate() => DateTime.UtcNow.Date;
        public DateTime GetDefaultInvoiceDateUtc() => DateTime.UtcNow;
        public DateTime ConvertToGst(DateTime utcDateTime) => utcDateTime;
        public DateTime ConvertToUtc(DateTime gstDateTime) => gstDateTime;
        public TimeZoneInfo GetGstTimeZone() => TimeZoneInfo.Utc;
    }
}
