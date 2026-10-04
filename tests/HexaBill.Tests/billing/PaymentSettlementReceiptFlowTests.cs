using System.Text.Json;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.DailyClose;
using HexaBill.Api.Modules.Notifications;
using HexaBill.Api.Modules.Payments;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>Phase 3: payment post with explicit adjustment, then receipt on cash line only.</summary>
public class PaymentSettlementReceiptFlowTests
{
    [Fact]
    public async Task CreatePaymentWithAdjustment_ReceiptOnCashLine_IncludesPairedShortfall()
    {
        await using var db = await DatabaseAsync();
        var validation = new ValidationService(db);
        var payments = new PaymentService(db, NullLogger<PaymentService>.Instance, validation, null!, null!);
        var receipts = new PaymentReceiptService(db, NullLogger<PaymentReceiptService>.Instance);

        var created = await payments.CreatePaymentAsync(
            new CreatePaymentRequest
            {
                SaleId = 1,
                CustomerId = 1,
                Amount = 1330m,
                Mode = "CASH",
                SettlementAdjustmentAmount = 1m,
                SettlementAdjustmentReason = "Counter rounding"
            },
            userId: 1,
            tenantId: 10);

        Assert.NotNull(created.SettlementAdjustment);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            receipts.GenerateReceiptAsync(10, created.SettlementAdjustment!.Id, 1));

        var detail = await receipts.GenerateReceiptAsync(10, created.Payment.Id, 1);
        Assert.Equal(1330m, detail.AmountReceived);
        Assert.Equal(1331m, detail.AmountPaid);
        Assert.Equal(1m, detail.SettlementAdjustmentAmount);
        Assert.Equal("Counter rounding", detail.SettlementAdjustmentReason);

        var sale = await db.Sales.SingleAsync(s => s.Id == 1);
        Assert.Equal(SalePaymentStatus.Paid, sale.PaymentStatus);

        var cashPayment = await db.Payments.AsNoTracking().SingleAsync(p => p.Id == created.Payment.Id);
        var businessDate = cashPayment.PaymentDate.Date;
        var close = DailyClose(db);
        var preview = await close.GetPreviewAsync(10, businessDate, openingCash: 0m);
        Assert.Equal(1330m, preview.CashReceived);
        Assert.Equal(1330m, preview.ExpectedCash);

        var petrolAt = businessDate.AddHours(16);
        db.ExpenseCategories.Add(new ExpenseCategory { Id = 1, TenantId = 10, Name = "Fuel", CreatedAt = petrolAt });
        db.Expenses.Add(new Expense
        {
            TenantId = 10,
            OwnerId = 10,
            CategoryId = 1,
            Amount = 75m,
            TotalAmount = 75m,
            TaxType = "Petroleum",
            Status = ExpenseStatus.Approved,
            PaidFrom = ExpensePaidFrom.Cash,
            Date = petrolAt,
            CreatedBy = 1,
            CreatedAt = petrolAt
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var afterPetrol = await close.GetPreviewAsync(10, businessDate, openingCash: 0m);
        Assert.Equal(1330m, afterPetrol.CashReceived);
        Assert.Equal(75m, afterPetrol.CashPaidOut);
        Assert.Equal(1255m, afterPetrol.ExpectedCash);

        var closed = await close.SaveCloseAsync(
            new SaveDailyCloseRequest
            {
                BusinessDate = businessDate,
                OpeningCash = 0m,
                CountedCash = 1255m,
                SubmitClose = true,
                VarianceReason = "matched"
            },
            tenantId: 10,
            userId: 1,
            canSubmitClose: true);

        Assert.Equal("Closed", closed.Status, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(0m, closed.Variance);
        Assert.Equal(1255m, closed.CountedCash);
        Assert.Equal(1255m, closed.ExpectedCash);
    }

    private static DailyCloseService DailyClose(AppDbContext db) =>
        new(db, new GstTime(), new NoopAudit(), new NoopAlerts(), new NoBranchSchema());

    private sealed class NoopAudit : IAuditService
    {
        public Task LogAsync(string action, string? entityType = null, int? entityId = null, object? oldValues = null, object? newValues = null, string? details = null, int? actingUserId = null) =>
            Task.CompletedTask;
    }

    private sealed class NoBranchSchema : ISalesSchemaService
    {
        public Task<bool> SalesHasBranchIdAndRouteIdAsync() => Task.FromResult(false);
        public void ClearColumnCheckCache() { }
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

    private sealed class NoopAlerts : IAlertService
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

    private static async Task<AppDbContext> DatabaseAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var now = DateTime.UtcNow;
        var features = JsonSerializer.Serialize(new[]
        {
            TenantFeatureFlags.SettlementAdjustments,
            TenantFeatureFlags.ReceiptSnapshots,
            TenantFeatureFlags.DailyClose
        });
        db.Tenants.Add(new Tenant { Id = 10, Name = "Flow fixture", Subdomain = "pay-rcpt-flow", FeaturesJson = features });
        db.Users.Add(new User
        {
            Id = 1,
            TenantId = 10,
            OwnerId = 10,
            Name = "Owner",
            Email = "owner@flow.test",
            PasswordHash = "x",
            Role = UserRole.Owner,
            CreatedAt = now
        });
        db.Customers.Add(new Customer
        {
            Id = 1,
            TenantId = 10,
            OwnerId = 10,
            Name = "Ledger customer",
            Balance = 1331m,
            CreatedAt = now,
            UpdatedAt = now
        });
        db.Sales.Add(new Sale
        {
            Id = 1,
            TenantId = 10,
            OwnerId = 10,
            CustomerId = 1,
            InvoiceNo = "INV-1331",
            InvoiceDate = now,
            GrandTotal = 1331m,
            TotalAmount = 1331m,
            PaidAmount = 0,
            PaymentStatus = SalePaymentStatus.Pending,
            CreatedBy = 1,
            CreatedAt = now
        });
        db.Settings.Add(new Setting { TenantId = 10, OwnerId = 10, Key = "COMPANY_NAME_EN", Value = "Flow fixture company" });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
    }
}
