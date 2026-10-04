using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.DailyClose;
using HexaBill.Api.Modules.Notifications;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

/// <summary>
/// FIN08 (service-level): drawer expected cash, bank summary, capital/transfers, and close snapshot alignment.
/// </summary>
public class DailyCloseFin08WorksheetTests
{
    [Fact]
    public async Task Fin08_PreviewAndClose_AlignDrawerBankCapitalTransfersAndVariance()
    {
        await using var db = await DatabaseAsync();
        var noon = new DateTime(2026, 10, 3, 12, 0, 0, DateTimeKind.Utc);
        db.CashDrawerMovements.AddRange(
            new CashDrawerMovement
            {
                TenantId = 10, OwnerId = 10, Amount = 200m, Kind = CashDrawerMovementKind.OwnerCapitalIn,
                MovementDate = noon, CreatedByUserId = 1, CreatedAt = DateTime.UtcNow
            },
            new CashDrawerMovement
            {
                TenantId = 10, OwnerId = 10, Amount = 30m, Kind = CashDrawerMovementKind.OwnerDrawing,
                MovementDate = noon, CreatedByUserId = 1, CreatedAt = DateTime.UtcNow
            },
            new CashDrawerMovement
            {
                TenantId = 10, OwnerId = 10, Amount = 50m, Kind = CashDrawerMovementKind.BankToDrawer,
                MovementDate = noon, CreatedByUserId = 1, CreatedAt = DateTime.UtcNow
            },
            new CashDrawerMovement
            {
                TenantId = 10, OwnerId = 10, Amount = 20m, Kind = CashDrawerMovementKind.DrawerToBank,
                MovementDate = noon, CreatedByUserId = 1, CreatedAt = DateTime.UtcNow
            });
        await db.SaveChangesAsync();

        var service = Service(db);
        var businessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var preview = await service.GetPreviewAsync(10, businessDate, openingCash: 100m);

        Assert.Equal(1530m, preview.CollectionsCashReceived);
        Assert.Equal(50m, preview.CollectionsCashPaidOut);
        Assert.Equal(1780m, preview.CashReceived);
        Assert.Equal(100m, preview.CashPaidOut);
        Assert.Equal(200m, preview.OwnerCapitalIn);
        Assert.Equal(30m, preview.OwnerDrawing);
        Assert.Equal(50m, preview.BankToDrawer);
        Assert.Equal(20m, preview.DrawerToBank);
        Assert.Equal(420m, preview.BankReceived);
        Assert.Equal(125m, preview.BankPaidOut);
        Assert.Equal(1780m, preview.ExpectedCash);

        var counted = 1770m;
        var variance = -10m;
        var closed = await service.SaveCloseAsync(new SaveDailyCloseRequest
        {
            BusinessDate = businessDate,
            OpeningCash = 100m,
            CountedCash = counted,
            VarianceReason = "Two 5 AED notes missing from till",
            SubmitClose = true
        }, 10, 1, canSubmitClose: true);

        Assert.Equal("Closed", closed.Status);
        Assert.Equal(preview.CashReceived, closed.CashReceived);
        Assert.Equal(preview.CashPaidOut, closed.CashPaidOut);
        Assert.Equal(preview.BankReceived, closed.BankReceived);
        Assert.Equal(preview.BankPaidOut, closed.BankPaidOut);
        Assert.Equal(preview.ExpectedCash, closed.ExpectedCash);
        Assert.Equal(counted, closed.CountedCash);
        Assert.Equal(variance, closed.Variance);
    }

    private static DailyCloseService Service(AppDbContext db) =>
        new(db, new TimeZoneService(), new AuditNoop(), new AlertNoop(), new SalesSchemaBranchesEnabled());

    private sealed class AuditNoop : IAuditService
    {
        public Task LogAsync(string action, string? entityType = null, int? entityId = null, object? oldValues = null, object? newValues = null, string? details = null, int? actingUserId = null)
            => Task.CompletedTask;
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

    private sealed class SalesSchemaBranchesEnabled : ISalesSchemaService
    {
        public Task<bool> SalesHasBranchIdAndRouteIdAsync() => Task.FromResult(true);
        public void ClearColumnCheckCache() { }
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
        var noon = new DateTime(2026, 10, 3, 12, 0, 0, DateTimeKind.Utc);
        db.Payments.Add(new Payment
        {
            TenantId = 10, OwnerId = 10, CustomerId = 1, SaleId = 1,
            Amount = 1330m, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED,
            PaymentDate = noon, CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        db.Payments.Add(new Payment
        {
            TenantId = 10, OwnerId = 10, CustomerId = 1, SaleId = 1,
            Amount = 400m, Mode = PaymentMode.ONLINE, Status = PaymentStatus.CLEARED,
            PaymentDate = noon, CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        db.Payments.Add(new Payment
        {
            TenantId = 10, OwnerId = 10, CustomerId = 1, SaleId = 1,
            Amount = 1m, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED,
            IsSettlementAdjustment = true,
            PaymentDate = noon, CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        db.Payments.Add(new Payment
        {
            TenantId = 10, OwnerId = 10, CustomerId = 1, SaleId = 2,
            Amount = 200m, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED,
            PaymentDate = noon, CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        db.SupplierPayments.Add(new SupplierPayment
        {
            TenantId = 10, SupplierName = "Fuel Co", Amount = 75m,
            Mode = SupplierPaymentMode.Bank, PaymentDate = noon,
            CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        db.Expenses.Add(new Expense
        {
            TenantId = 10, OwnerId = 10, CategoryId = 1, BranchId = 1, Amount = 50m, TotalAmount = 50m,
            PaidFrom = ExpensePaidFrom.Cash,
            Date = noon, Status = ExpenseStatus.Approved, CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return db;
    }
}
