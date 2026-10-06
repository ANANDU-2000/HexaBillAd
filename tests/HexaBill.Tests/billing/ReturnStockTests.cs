using System.Text.Json;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Modules.DailyClose;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class ReturnStockTests
{
    [Fact]
    public async Task ApprovalAfterProductConversionEdit_RestoresOriginalBaseQuantity()
    {
        await using var db = await Database(ReturnStatus.Pending);
        await new ReturnService(db, null!, null!, null!).ApproveSaleReturnAsync(1, 10);
        db.ChangeTracker.Clear();
        Assert.Equal(20m, (await db.Products.SingleAsync()).StockQty);
        Assert.Equal(12m, (await db.InventoryTransactions.SingleAsync()).ChangeQty);
        Assert.Equal(ReturnStatus.Approved, (await db.SaleReturns.SingleAsync()).Status);
    }

    [Theory]
    [InlineData(ReturnStatus.Pending, 8)]
    [InlineData(ReturnStatus.Rejected, 8)]
    public async Task DeleteReturn_ReversesStockOnlyIfAppliedAndUsesOriginalConversion(ReturnStatus status, int expected)
    {
        await using var db = await Database(status);
        await new ReturnService(db, null!, null!, null!).DeleteSaleReturnAsync(1, 10);
        db.ChangeTracker.Clear();
        Assert.Equal((decimal)expected, (await db.Products.SingleAsync()).StockQty);
        Assert.Empty(await db.SaleReturns.ToListAsync());
        Assert.Single(await db.SaleItems.ToListAsync());
    }

    [Fact]
    public async Task ApprovedReturn_CannotBeDeleted_MustUseAuditedReversal()
    {
        await using var db = await Database(ReturnStatus.Approved);
        var service = new ReturnService(db, null!, null!, null!);
        var deleteError = await Assert.ThrowsAsync<InvalidOperationException>(() => service.DeleteSaleReturnAsync(1, 10));
        Assert.Contains("audited reversal", deleteError.Message);
        await service.ReverseSaleReturnAsync(1, "Fixture correction", 1, 10);
        db.ChangeTracker.Clear();
        Assert.Equal(8m, (await db.Products.SingleAsync()).StockQty);
        Assert.Equal(ReturnStatus.Reversed, (await db.SaleReturns.SingleAsync()).Status);
        Assert.Single(await db.SaleItems.ToListAsync());
    }

    [Fact]
    public async Task ReverseReturn_OnClosedWriteOffExpenseDay_IsRejectedAtomically()
    {
        await using var db = await Database(ReturnStatus.Approved);
        var expenseDate = new DateTime(2026, 10, 2, 10, 0, 0, DateTimeKind.Utc);
        var tenant = await db.Tenants.SingleAsync(t => t.Id == 10);
        tenant.FeaturesJson = JsonSerializer.Serialize(new[] { TenantFeatureFlags.DailyClose });
        db.ExpenseCategories.Add(new ExpenseCategory { Id = 1, TenantId = 10, Name = "Return write-off" });
        db.Expenses.Add(new Expense
        {
            Id = 1, TenantId = 10, OwnerId = 10, CategoryId = 1, Amount = 25m, Date = expenseDate,
            Note = "Return write-off: RETURN-1 - damaged item", CreatedBy = 1, CreatedAt = expenseDate,
            Status = ExpenseStatus.Approved
        });
        db.DailyCashCloses.Add(new DailyCashClose
        {
            Id = 1, TenantId = 10, OwnerId = 10,
            BusinessDate = DailyClosePostingGuard.ToBusinessDate(expenseDate),
            Status = DailyCashCloseStatus.Closed, CreatedByUserId = 1,
            CreatedAt = expenseDate, UpdatedAt = expenseDate
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        Assert.True(TenantFeatureFlags.IsEnabled((await db.Tenants.SingleAsync(t => t.Id == 10)).FeaturesJson, TenantFeatureFlags.DailyClose));
        Assert.Single(await db.Expenses.Where(e => e.TenantId == 10 && e.Note!.StartsWith("Return write-off: RETURN-1")).ToListAsync());
        Assert.Single(await db.DailyCashCloses.Where(c => c.TenantId == 10 && c.BusinessDate == DailyClosePostingGuard.ToBusinessDate(expenseDate)).ToListAsync());

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new ReturnService(db, null!, null!, null!).ReverseSaleReturnAsync(1, "Fixture correction", 1, 10));

        Assert.Contains("business day is closed", error.Message);
        db.ChangeTracker.Clear();
        Assert.Equal(ExpenseStatus.Approved, (await db.Expenses.SingleAsync(e => e.Id == 1)).Status);
        Assert.Equal(ReturnStatus.Approved, (await db.SaleReturns.SingleAsync(r => r.Id == 1)).Status);
        Assert.Equal(20m, (await db.Products.SingleAsync()).StockQty);
        Assert.Empty(await db.InventoryTransactions.ToListAsync());
    }

    [Fact]
    public async Task DeleteReturn_DoesNotDeleteLinkedRowsFromAnotherTenant()
    {
        await using var db = await Database(ReturnStatus.Pending);
        var now = DateTime.UtcNow;
        db.ChangeTracker.Clear();
        db.SetRequestTenantScope(null, isPlatformScope: true);
        db.Tenants.Add(new Tenant { Id = 11, Name = "Other tenant", Subdomain = "other-return-fixture" });
        db.Customers.Add(new Customer { Id = 2, TenantId = 11, OwnerId = 11, Name = "Other customer", CreatedAt = now, UpdatedAt = now });
        db.Payments.Add(new Payment
        {
            Id = 2, OwnerId = 11, TenantId = 11, SaleReturnId = 1, CustomerId = 2, Amount = 15m,
            Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, PaymentDate = now, CreatedBy = 1, CreatedAt = now
        });
        db.CreditNotes.Add(new CreditNote
        {
            Id = 2, TenantId = 11, CustomerId = 2, LinkedReturnId = 1, Amount = 15m, AppliedAmount = 0m,
            Currency = "AED", Status = "unused", CreatedAt = now, CreatedBy = 1
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        db.SetRequestTenantScope(null, isPlatformScope: true);

        var error = await Assert.ThrowsAsync<InvalidOperationException>(
            () => new ReturnService(db, null!, null!, null!).DeleteSaleReturnAsync(1, 10));
        Assert.Contains("linked payments or credit notes", error.Message);

        db.ChangeTracker.Clear();
        Assert.Equal(15m, (await db.Payments.IgnoreQueryFilters().SingleAsync(p => p.Id == 2)).Amount);
        Assert.Equal("unused", (await db.CreditNotes.IgnoreQueryFilters().SingleAsync(c => c.Id == 2)).Status);
        Assert.Single(await db.SaleReturns.IgnoreQueryFilters().Where(r => r.Id == 1).ToListAsync());
    }

    [Fact]
    public async Task ReverseReturn_WithCrossTenantCustomerReference_DoesNotRecalculateOtherTenantCustomer()
    {
        await using var db = await Database(ReturnStatus.Approved);
        db.ChangeTracker.Clear();
        db.SetRequestTenantScope(null, isPlatformScope: true);
        db.Tenants.Add(new Tenant { Id = 11, Name = "Other tenant", Subdomain = "other-return-customer" });
        db.Customers.Add(new Customer
        {
            Id = 2, TenantId = 11, OwnerId = 11, Name = "Other customer", Balance = 777m,
            PendingBalance = 777m, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        });
        var sale = await db.Sales.IgnoreQueryFilters().SingleAsync(s => s.Id == 1);
        sale.CustomerId = 2;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        // Emulate a platform-scoped service context: the explicit tenantId passed to
        // the operation must remain authoritative even when global query filters are broad.
        db.SetRequestTenantScope(null, isPlatformScope: true);

        var service = new ReturnService(db, new CustomerService(db), null!, null!);
        await service.ReverseSaleReturnAsync(1, "Cross-tenant reference regression", 1, 10);

        db.ChangeTracker.Clear();
        var otherCustomer = await db.Customers.IgnoreQueryFilters().SingleAsync(c => c.Id == 2);
        Assert.Equal(777m, otherCustomer.Balance);
        Assert.Equal(777m, otherCustomer.PendingBalance);
    }

    [Fact]
    public async Task DuplicateOrEmptyRequest_IsRejectedBeforeDatabaseAccess()
    {
        var service = new ReturnService(null!, null!, null!, null!);
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateSaleReturnAsync(new CreateSaleReturnRequest(), 1, 10));
        var duplicate = new CreateSaleReturnRequest { SaleId = 1, Items = [new() { SaleItemId = 1, Qty = 2 }, new() { SaleItemId = 1, Qty = 2 }] };
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateSaleReturnAsync(duplicate, 1, 10));
        Assert.Contains("each invoice line once", error.Message);
    }

    [Fact]
    public async Task InvoiceWithReturnHistory_CannotDeleteReferencedLinesOrRestoreStockTwice()
    {
        await using var db = await Database(ReturnStatus.Approved);
        var service = new SaleService(db, null!, null!, null!, null!, null!, null!, null!, null!, null!, null!, null!, null!, null!, NullLogger<SaleService>.Instance);
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => service.DeleteSaleAsync(1, 1, 10));
        Assert.Contains("return history", error.Message);
        db.ChangeTracker.Clear();
        Assert.False((await db.Sales.SingleAsync()).IsDeleted);
        Assert.Single(await db.SaleItems.ToListAsync());
        Assert.Single(await db.SaleReturnItems.ToListAsync());
        Assert.Equal(20m, (await db.Products.SingleAsync()).StockQty);
    }

    [Fact]
    public async Task InvoiceWithReturnHistory_CannotReplaceOriginalLinesOnEdit()
    {
        await using var db = await Database(ReturnStatus.Pending);
        var service = new SaleService(db, null!, null!, null!, null!, null!, null!, null!, null!, null!, null!, new VatValidation().Object, null!, null!, NullLogger<SaleService>.Instance);
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => service.UpdateSaleAsync(1, new CreateSaleRequest(), 1, 10));
        Assert.Contains("return history", error.Message);
        db.ChangeTracker.Clear();
        Assert.Single(await db.SaleItems.ToListAsync());
        Assert.Single(await db.SaleReturnItems.ToListAsync());
        Assert.Empty(await db.InvoiceVersions.ToListAsync());
        Assert.Equal(8m, (await db.Products.SingleAsync()).StockQty);
    }

    [Fact]
    public async Task RepeatedApproval_IsRejectedWithoutAnotherStockMovement()
    {
        await using var db = await Database(ReturnStatus.Pending);
        var service = new ReturnService(db, null!, null!, null!);
        await service.ApproveSaleReturnAsync(1, 10);
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.ApproveSaleReturnAsync(1, 10));
        db.ChangeTracker.Clear();
        Assert.Equal(20m, (await db.Products.SingleAsync()).StockQty);
        Assert.Single(await db.InventoryTransactions.ToListAsync());
    }

    [Fact]
    public async Task ApprovingRefundForAnonymousSale_CreatesCashRefundPayment()
    {
        await using var db = await Database(ReturnStatus.Pending);
        var ret = await db.SaleReturns.SingleAsync();
        ret.RefundStatus = "Refunded";
        await db.SaveChangesAsync();

        await new ReturnService(db, null!, null!, null!).ApproveSaleReturnAsync(1, 10);

        var refund = await db.Payments.SingleAsync(p => p.SaleReturnId == 1);
        Assert.Null(refund.CustomerId);
        Assert.Equal(50m, refund.Amount);
        Assert.Equal(PaymentMode.CASH, refund.Mode);
        Assert.Equal(PaymentStatus.CLEARED, refund.Status);
    }

    [Fact]
    public async Task ImmediateRefundForAnonymousSale_CreatesCashRefundPayment()
    {
        await using var db = await Database(ReturnStatus.Rejected);
        var service = new ReturnService(db, null!, new SettingsService(db), new SalesSchemaService(db));

        await service.CreateSaleReturnAsync(new CreateSaleReturnRequest
        {
            SaleId = 1,
            ReturnType = "RefundNow",
            Items = [new SaleReturnItemRequest { SaleItemId = 1, Qty = 1, StockEffect = false }]
        }, userId: 1, tenantId: 10);

        var refund = await db.Payments.SingleAsync(p => p.SaleReturnId != null);
        Assert.Null(refund.CustomerId);
        Assert.Equal(52.5m, refund.Amount);
        Assert.Equal(PaymentMode.CASH, refund.Mode);
        Assert.Equal(PaymentStatus.CLEARED, refund.Status);
    }

    [Fact]
    public void InvalidOrIncompleteOriginalConversion_CannotMintStock()
    {
        var line = new SaleItem { Product = new Product { ConversionToBase = 24 }, ConversionAtSale = 12 };
        Assert.Throws<InvalidOperationException>(() => SaleCostBasis.BaseQuantity(line, 1));
        line.ConversionAtSale = null;
        line.Product.ConversionToBase = 0;
        Assert.Throws<InvalidOperationException>(() => SaleCostBasis.BaseQuantity(line, 1));
        Assert.Throws<InvalidOperationException>(() => SaleCostBasis.BaseQuantity(line, -1));
    }

    private static async Task<AppDbContext> Database(ReturnStatus status)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant { Id = 10, Name = "Return fixture", Subdomain = "return-fixture" });
        db.Users.Add(new User { Id = 1, TenantId = 10, OwnerId = 10, Name = "Fixture owner", Email = "fixture@example.test", PasswordHash = "fixture", Role = UserRole.Owner, CreatedAt = now });
        var product = new Product { Id = 1, TenantId = 10, OwnerId = 10, NameEn = "Return product", Sku = "RETURN-1", StockQty = status == ReturnStatus.Approved ? 20 : 8, CostPrice = 25, ConversionToBase = 12, CreatedAt = now, UpdatedAt = now };
        var line = new SaleItem { Id = 1, SaleId = 1, ProductId = 1, Qty = 2, UnitPrice = 50, LineTotal = 100 };
        SaleCostBasis.Capture(line, product, 10, true);
        db.Products.Add(product);
        db.Sales.Add(new Sale { Id = 1, TenantId = 10, OwnerId = 10, CreatedBy = 1, InvoiceNo = "RETURN-INV", InvoiceDate = now, CreatedAt = now, GrandTotal = 100 });
        db.SaleItems.Add(line);
        db.SaleReturns.Add(new SaleReturn { Id = 1, TenantId = 10, OwnerId = 10, SaleId = 1, CreatedBy = 1, ReturnNo = "RETURN-1", ReturnDate = now, CreatedAt = now, Status = status, GrandTotal = 50 });
        db.SaleReturnItems.Add(new SaleReturnItem { Id = 1, SaleReturnId = 1, SaleItemId = 1, ProductId = 1, Qty = 1, UnitPrice = 50, LineTotal = 50, StockEffect = true, Condition = "resellable" });
        await db.SaveChangesAsync();
        product.ConversionToBase = 24;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
    }
    private sealed class VatValidation : InterfaceStub<IVatReturnValidationService>
    {
        public VatValidation() => When(nameof(IVatReturnValidationService.IsTransactionDateInLockedPeriodAsync), _ => Task.FromResult(false));
    }
}
