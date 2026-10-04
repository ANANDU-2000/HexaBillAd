using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.DailyClose;
using HexaBill.Api.Modules.Notifications;
using HexaBill.Api.Modules.Purchases;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.Sales;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

public class PurchaseCashPaymentTests
{
    [Fact]
    public async Task CreatePurchase_Cash_RecordsSupplierPaymentAndFifoPaidStatus()
    {
        await using var db = await DatabaseAsync();
        var vat = new VatStub();
        var service = new PurchaseService(db, vat.Object);
        var dto = await service.CreatePurchaseAsync(
            new CreatePurchaseRequest
            {
                SupplierName = "Cash supplier",
                InvoiceNo = "CASH-UNIT-1",
                PurchaseDate = DateTime.UtcNow,
                PaymentType = "Cash",
                Items =
                [
                    new PurchaseItemRequest { ProductId = 1, UnitType = "PIECE", Qty = 1m, UnitCost = 10m }
                ]
            },
            userId: 1,
            tenantId: 10);

        Assert.Equal("Paid", dto.PaymentStatus, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(dto.TotalAmount, dto.PaidAmount);
        var payment = await db.SupplierPayments.SingleAsync();
        Assert.Equal(dto.TotalAmount, payment.Amount);
        Assert.Equal(SupplierPaymentMode.Cash, payment.Mode);
        var purchase = await db.Purchases.SingleAsync();
        Assert.Equal("Cash", purchase.PaymentType, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreatePurchase_Credit_DoesNotRecordSupplierPayment()
    {
        await using var db = await DatabaseAsync();
        var vat = new VatStub();
        var service = new PurchaseService(db, vat.Object);
        var dto = await service.CreatePurchaseAsync(
            new CreatePurchaseRequest
            {
                SupplierName = "Credit supplier",
                InvoiceNo = "CREDIT-UNIT-1",
                PurchaseDate = DateTime.UtcNow,
                PaymentType = "Credit",
                Items =
                [
                    new PurchaseItemRequest { ProductId = 1, UnitType = "PIECE", Qty = 1m, UnitCost = 10m }
                ]
            },
            userId: 1,
            tenantId: 10);

        Assert.Equal("Unpaid", dto.PaymentStatus, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(0m, dto.PaidAmount);
        Assert.Empty(await db.SupplierPayments.ToListAsync());
    }

    [Fact]
    public async Task CreatePurchase_Partial_RecordsSupplierPaymentForAmountPaidOnly()
    {
        await using var db = await DatabaseAsync();
        var vat = new VatStub();
        var service = new PurchaseService(db, vat.Object);
        var dto = await service.CreatePurchaseAsync(
            new CreatePurchaseRequest
            {
                SupplierName = "Partial supplier",
                InvoiceNo = "PARTIAL-UNIT-1",
                PurchaseDate = DateTime.UtcNow,
                PaymentType = "Partial",
                AmountPaid = 4m,
                Items =
                [
                    new PurchaseItemRequest { ProductId = 1, UnitType = "PIECE", Qty = 1m, UnitCost = 10m }
                ]
            },
            userId: 1,
            tenantId: 10);

        Assert.Equal("Partial", dto.PaymentStatus, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(4m, dto.PaidAmount);
        Assert.True(dto.BalanceAmount > 0);
        var payment = await db.SupplierPayments.SingleAsync();
        Assert.Equal(4m, payment.Amount);
    }

    [Fact]
    public async Task CreatePurchase_Cash_ReducesDailyCloseExpectedCash()
    {
        await using var db = await DatabaseAsync(enableDailyClose: true);
        var purchaseAt = new DateTime(2026, 10, 5, 12, 0, 0, DateTimeKind.Utc);
        var businessDate = new DateTime(2026, 10, 5, 0, 0, 0, DateTimeKind.Utc);
        var vat = new VatStub();
        var dto = await new PurchaseService(db, vat.Object).CreatePurchaseAsync(
            new CreatePurchaseRequest
            {
                SupplierName = "Cash supplier",
                InvoiceNo = "CASH-CLOSE-1",
                PurchaseDate = purchaseAt,
                PaymentType = "Cash",
                Items =
                [
                    new PurchaseItemRequest { ProductId = 1, UnitType = "PIECE", Qty = 1m, UnitCost = 10m }
                ]
            },
            userId: 1,
            tenantId: 10);

        var close = new DailyCloseService(db, new TimeZoneService(), new AuditNoop(), new AlertNoop(), new SalesSchemaNoBranch());
        var preview = await close.GetPreviewAsync(10, businessDate, openingCash: 500m);

        Assert.Equal(dto.TotalAmount, preview.CashPaidOut);
        Assert.Equal(1, preview.SupplierCashPaymentCount);
        Assert.Equal(500m - dto.TotalAmount, preview.ExpectedCash);
    }

    private static async Task<AppDbContext> DatabaseAsync(bool enableDailyClose = false)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant
        {
            Id = 10,
            Name = "Purchase cash fixture",
            Subdomain = "purch-cash",
            FeaturesJson = enableDailyClose ? """["daily_close"]""" : null
        });
        db.Users.Add(new User
        {
            Id = 1,
            TenantId = 10,
            OwnerId = 10,
            Name = "Owner",
            Email = "owner@example.test",
            PasswordHash = "x",
            Role = UserRole.Owner,
            CreatedAt = now
        });
        db.Products.Add(new Product
        {
            Id = 1,
            TenantId = 10,
            OwnerId = 10,
            NameEn = "Fixture product",
            Sku = "P-1",
            StockQty = 0,
            CostPrice = 5,
            ConversionToBase = 1,
            CreatedAt = now,
            UpdatedAt = now
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
    }

    private sealed class VatStub : InterfaceStub<IVatReturnValidationService>
    {
        public VatStub() =>
            When(nameof(IVatReturnValidationService.IsTransactionDateInLockedPeriodAsync), _ => Task.FromResult(false));
    }

    private sealed class AuditNoop : IAuditService
    {
        public Task LogAsync(string action, string? entityType = null, int? entityId = null, object? oldValues = null, object? newValues = null, string? details = null, int? actingUserId = null) =>
            Task.CompletedTask;
    }

    private sealed class AlertNoop : IAlertService
    {
        public Task CreateAlertAsync(AlertType type, string title, string? message = null, AlertSeverity severity = AlertSeverity.Info, Dictionary<string, object>? metadata = null, int? tenantId = null) => Task.CompletedTask;
        public Task<List<Alert>> GetAlertsAsync(bool unreadOnly = false, int limit = 50, int? tenantId = null) => Task.FromResult(new List<Alert>());
        public Task<Alert?> GetAlertByIdAsync(int id, int? tenantId = null) => Task.FromResult<Alert?>(null);
        public Task MarkAsReadAsync(int id, int? tenantId = null) => Task.CompletedTask;
        public Task MarkAsResolvedAsync(int id, int userId, int? tenantId = null) => Task.CompletedTask;
        public Task<int> GetUnreadCountAsync(int? tenantId = null) => Task.FromResult(0);
        public Task<int> MarkAllAsReadAsync(int? tenantId = null) => Task.FromResult(0);
        public Task<int> MarkAllAsResolvedAsync(int userId, int? tenantId = null) => Task.FromResult(0);
        public Task<int> ClearResolvedAlertsAsync(int? tenantId = null) => Task.FromResult(0);
        public Task CheckAndCreateAlertsAsync() => Task.CompletedTask;
        public Task DismissSimilarAlertsAsync(AlertType type, DateTime cutoffTime) => Task.CompletedTask;
    }

    private sealed class SalesSchemaNoBranch : ISalesSchemaService
    {
        public Task<bool> SalesHasBranchIdAndRouteIdAsync() => Task.FromResult(false);
        public void ClearColumnCheckCache() { }
    }
}
