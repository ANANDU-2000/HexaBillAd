using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.DailyClose;
using HexaBill.Api.Modules.Notifications;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

public class DailyCloseExpectedCashTests
{
    private static DailyCloseService Service(AppDbContext db, IAlertService? alerts = null, ISalesSchemaService? salesSchema = null) =>
        new(db, new TimeZoneService(), new AuditNoop(), alerts ?? new AlertNoop(), salesSchema ?? new SalesSchemaBranchesEnabled());

    [Fact]
    public async Task GetPreview_RejectsBranchFromAnotherTenant()
    {
        await using var db = await DatabaseAsync();
        db.SetRequestTenantScope(null, isPlatformScope: true);
        db.Tenants.Add(new Tenant { Id = 20, Name = "Other", Subdomain = "other-tenant", FeaturesJson = "[]" });
        db.Branches.Add(new Branch { Id = 99, TenantId = 20, Name = "Other tenant branch", CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        db.SetRequestTenantScope(10, false);
        var service = Service(db);
        var businessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        await Assert.ThrowsAsync<ArgumentException>(() => service.GetPreviewAsync(10, businessDate, 0m, branchId: 99));
    }

    [Fact]
    public async Task GetStatus_ReportsLocked_AfterSubmitClose()
    {
        await using var db = await DatabaseAsync();
        var service = Service(db);
        var businessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        await service.SaveCloseAsync(new SaveDailyCloseRequest
        {
            BusinessDate = businessDate,
            OpeningCash = 100m,
            CountedCash = 1580m,
            VarianceReason = "matched",
            SubmitClose = true
        }, 10, 1, canSubmitClose: true);
        var status = await service.GetStatusAsync(10, businessDate);
        Assert.True(status.IsLocked);
        Assert.False(status.CanEdit);
        Assert.Equal("Closed", status.Current?.Status);
    }

    [Fact]
    public async Task Preview_BankPaidExpense_DoesNotReduceDrawerCash()
    {
        await using var db = await DatabaseAsync();
        var noonGstAsUtcStorage = new DateTime(2026, 10, 3, 12, 0, 0, DateTimeKind.Utc);
        db.Expenses.Add(new Expense
        {
            TenantId = 10, OwnerId = 10, CategoryId = 1, BranchId = 1, Amount = 30m, TotalAmount = 30m,
            PaidFrom = ExpensePaidFrom.Bank,
            Date = noonGstAsUtcStorage, Status = ExpenseStatus.Approved, CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var service = Service(db);
        var businessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var preview = await service.GetPreviewAsync(10, businessDate, openingCash: 100m);
        Assert.Equal(50m, preview.CashPaidOut);
        Assert.Equal(105m, preview.BankPaidOut);
        Assert.Equal(1580m, preview.ExpectedCash);
    }

    [Fact]
    public async Task Preview_OwnerCapitalIn_IncreasesExpectedDrawerCash()
    {
        await using var db = await DatabaseAsync();
        var noonGstAsUtcStorage = new DateTime(2026, 10, 3, 12, 0, 0, DateTimeKind.Utc);
        db.CashDrawerMovements.Add(new CashDrawerMovement
        {
            TenantId = 10, OwnerId = 10, Amount = 200m, Kind = CashDrawerMovementKind.OwnerCapitalIn,
            MovementDate = noonGstAsUtcStorage, CreatedByUserId = 1, CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var service = Service(db);
        var businessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var preview = await service.GetPreviewAsync(10, businessDate, openingCash: 100m);
        Assert.Equal(200m, preview.OwnerCapitalIn);
        Assert.Equal(1780m, preview.ExpectedCash);
    }

    [Fact]
    public async Task Preview_PetrolExpense_ReducesExpectedDrawerCash()
    {
        await using var db = await DatabaseAsync();
        var service = Service(db);
        var businessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var preview = await service.GetPreviewAsync(10, businessDate, openingCash: 100m);
        Assert.Equal(50m, preview.CashPaidOut);
        Assert.Equal(1580m, preview.ExpectedCash);
    }

    [Fact]
    public async Task Preview_ExcludesSettlementAdjustments_FromCashReceived()
    {
        await using var db = await DatabaseAsync();
        var service = Service(db);
        var businessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var preview = await service.GetPreviewAsync(10, businessDate, openingCash: 100m);
        Assert.Equal(1530m, preview.CashReceived);
        Assert.Equal(50m, preview.CashPaidOut);
        Assert.Equal(1580m, preview.ExpectedCash);
    }

    [Fact]
    public async Task SaveClose_RequiresVarianceReason_WhenCountedDiffers()
    {
        await using var db = await DatabaseAsync();
        var service = Service(db);
        var businessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        await Assert.ThrowsAsync<ArgumentException>(() => service.SaveCloseAsync(new SaveDailyCloseRequest
        {
            BusinessDate = businessDate,
            OpeningCash = 100m,
            CountedCash = 1000m,
            SubmitClose = true
        }, 10, 1, canSubmitClose: true));
    }

    [Fact]
    public async Task Preview_BranchFilter_OnlyIncludesMatchingSalePayments()
    {
        await using var db = await DatabaseAsync();
        var service = Service(db);
        var businessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var all = await service.GetPreviewAsync(10, businessDate, openingCash: 100m);
        var branchA = await service.GetPreviewAsync(10, businessDate, openingCash: 100m, branchId: 1);
        var branchB = await service.GetPreviewAsync(10, businessDate, openingCash: 0m, branchId: 2);
        Assert.Equal(1530m, all.CashReceived);
        Assert.Equal(1330m, branchA.CashReceived);
        Assert.Equal(200m, branchB.CashReceived);
        Assert.Equal(50m, branchA.CashPaidOut);
        Assert.Equal(0m, branchB.CashPaidOut);
    }

    [Fact]
    public async Task Preview_IncludesBankTransfers_SeparateFromDrawerCash()
    {
        await using var db = await DatabaseAsync();
        var service = Service(db);
        var businessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var preview = await service.GetPreviewAsync(10, businessDate, openingCash: 100m);
        Assert.Equal(400m, preview.BankReceived);
        Assert.Equal(75m, preview.BankPaidOut);
        var closed = await service.SaveCloseAsync(new SaveDailyCloseRequest
        {
            BusinessDate = businessDate,
            OpeningCash = 100m,
            CountedCash = 1580m,
            VarianceReason = "matched",
            SubmitClose = true
        }, 10, 1, canSubmitClose: true);
        Assert.Equal(400m, closed.BankReceived);
        Assert.Equal(75m, closed.BankPaidOut);
    }

    [Fact]
    public async Task SubmitClose_WithVariance_CreatesDailyCloseVarianceAlert()
    {
        await using var db = await DatabaseAsync();
        var alerts = new AlertSpy();
        var service = Service(db, alerts);
        var businessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        await service.SaveCloseAsync(new SaveDailyCloseRequest
        {
            BusinessDate = businessDate,
            OpeningCash = 100m,
            CountedCash = 1300m,
            VarianceReason = "Petty cash used",
            SubmitClose = true
        }, 10, 1, canSubmitClose: true);
        Assert.Contains(alerts.Created, a => a.type == AlertType.DailyCloseVariance);
    }

    [Fact]
    public async Task Reopen_AllowsNewCloseVersion_AfterLockedDay()
    {
        await using var db = await DatabaseAsync();
        var service = Service(db);
        var businessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var closed = await service.SaveCloseAsync(new SaveDailyCloseRequest
        {
            BusinessDate = businessDate,
            OpeningCash = 100m,
            CountedCash = 1580m,
            VarianceReason = "matched",
            SubmitClose = true
        }, 10, 1, canSubmitClose: true);
        Assert.Equal("Closed", closed.Status);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.SaveCloseAsync(new SaveDailyCloseRequest
        {
            BusinessDate = businessDate,
            OpeningCash = 100m,
            CountedCash = 1580m,
            SubmitClose = false
        }, 10, 1, canSubmitClose: true));

        await service.ReopenAsync(new ReopenDailyCloseRequest { BusinessDate = businessDate, Reason = "Late petrol expense entry" }, 10, 1, canReopen: true);

        var next = await service.SaveCloseAsync(new SaveDailyCloseRequest
        {
            BusinessDate = businessDate,
            OpeningCash = 100m,
            CountedCash = 1580m,
            SubmitClose = true,
            VarianceReason = "matched"
        }, 10, 1, canSubmitClose: true);
        Assert.Equal(2, next.Version);
        Assert.Equal("Closed", next.Status);
    }

    private sealed class AuditNoop : IAuditService
    {
        public Task LogAsync(string action, string? entityType = null, int? entityId = null, object? oldValues = null, object? newValues = null, string? details = null, int? actingUserId = null)
            => Task.CompletedTask;
    }

    private sealed class SalesSchemaBranchesEnabled : ISalesSchemaService
    {
        public Task<bool> SalesHasBranchIdAndRouteIdAsync() => Task.FromResult(true);
        public void ClearColumnCheckCache() { }
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

    private sealed class AlertSpy : IAlertService
    {
        public List<(AlertType type, string title)> Created { get; } = new();
        public Task CreateAlertAsync(AlertType type, string title, string? message = null, AlertSeverity severity = AlertSeverity.Info, Dictionary<string, object>? metadata = null, int? tenantId = null)
        {
            Created.Add((type, title));
            return Task.CompletedTask;
        }
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
        db.Tenants.Add(new Tenant
        {
            Id = 10,
            Name = "Close fixture",
            Subdomain = "close-fixture",
            FeaturesJson = """["daily_close"]"""
        });
        db.Users.Add(new User { Id = 1, TenantId = 10, OwnerId = 10, Name = "Owner", Email = "o@test", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = DateTime.UtcNow });
        db.Customers.Add(new Customer { Id = 1, TenantId = 10, OwnerId = 10, Name = "Buyer", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        db.Branches.Add(new Branch { Id = 1, TenantId = 10, Name = "Branch A", CreatedAt = DateTime.UtcNow });
        db.Branches.Add(new Branch { Id = 2, TenantId = 10, Name = "Branch B", CreatedAt = DateTime.UtcNow });
        db.Sales.Add(new Sale { Id = 1, TenantId = 10, OwnerId = 10, CustomerId = 1, BranchId = 1, InvoiceNo = "INV-1", GrandTotal = 1331m, InvoiceDate = DateTime.UtcNow, CreatedBy = 1 });
        db.Sales.Add(new Sale { Id = 2, TenantId = 10, OwnerId = 10, CustomerId = 1, BranchId = 2, InvoiceNo = "INV-2", GrandTotal = 200m, InvoiceDate = DateTime.UtcNow, CreatedBy = 1 });
        db.ExpenseCategories.Add(new ExpenseCategory { Id = 1, TenantId = 10, Name = "Petrol", CreatedAt = DateTime.UtcNow });
        var noonGstAsUtcStorage = new DateTime(2026, 10, 3, 12, 0, 0, DateTimeKind.Utc);
        db.Payments.Add(new Payment
        {
            TenantId = 10, OwnerId = 10, CustomerId = 1, SaleId = 1,
            Amount = 1330m, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED,
            PaymentDate = noonGstAsUtcStorage, CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        db.Payments.Add(new Payment
        {
            TenantId = 10, OwnerId = 10, CustomerId = 1, SaleId = 1,
            Amount = 400m, Mode = PaymentMode.ONLINE, Status = PaymentStatus.CLEARED,
            PaymentDate = noonGstAsUtcStorage, CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        db.SupplierPayments.Add(new SupplierPayment
        {
            TenantId = 10, SupplierName = "Fuel Co", Amount = 75m,
            Mode = SupplierPaymentMode.Bank, PaymentDate = noonGstAsUtcStorage,
            CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        db.Payments.Add(new Payment
        {
            TenantId = 10, OwnerId = 10, CustomerId = 1, SaleId = 1,
            Amount = 1m, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED,
            IsSettlementAdjustment = true,
            PaymentDate = noonGstAsUtcStorage, CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        db.Payments.Add(new Payment
        {
            TenantId = 10, OwnerId = 10, CustomerId = 1, SaleId = 2,
            Amount = 200m, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED,
            PaymentDate = noonGstAsUtcStorage, CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        db.Expenses.Add(new Expense
        {
            TenantId = 10, OwnerId = 10, CategoryId = 1, BranchId = 1, Amount = 50m, TotalAmount = 50m,
            PaidFrom = ExpensePaidFrom.Cash,
            Date = noonGstAsUtcStorage, Status = ExpenseStatus.Approved, CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return db;
    }
}
