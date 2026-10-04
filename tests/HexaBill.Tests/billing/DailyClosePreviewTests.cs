using System.Text.Json;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.DailyClose;
using HexaBill.Api.Modules.Notifications;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

public class DailyClosePreviewTests
{
    [Fact]
    public async Task Preview_ExcludesSettlementAdjustmentFromCashReceived()
    {
        await using var db = await DatabaseAsync(enableDailyClose: true);
        var day = new DateTime(2026, 3, 15, 0, 0, 0, DateTimeKind.Utc);
        var at = day.AddHours(10);
        db.Payments.AddRange(
            new Payment
            {
                TenantId = 10,
                OwnerId = 10,
                Amount = 200m,
                Mode = PaymentMode.CASH,
                Status = PaymentStatus.CLEARED,
                PaymentDate = at,
                CreatedBy = 1,
                CreatedAt = at,
                UpdatedAt = at
            },
            new Payment
            {
                TenantId = 10,
                OwnerId = 10,
                Amount = 5m,
                Mode = PaymentMode.CASH,
                Status = PaymentStatus.CLEARED,
                IsSettlementAdjustment = true,
                PaymentDate = at,
                CreatedBy = 1,
                CreatedAt = at,
                UpdatedAt = at
            });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var preview = await Service(db).GetPreviewAsync(10, day, openingCash: 100m);

        Assert.Equal(200m, preview.CashReceived);
        Assert.Equal(300m, preview.ExpectedCash);
    }

    [Fact]
    public async Task Preview_CashPetrolExpense_ReducesExpectedCash()
    {
        await using var db = await DatabaseAsync(enableDailyClose: true);
        var day = new DateTime(2026, 3, 16, 0, 0, 0, DateTimeKind.Utc);
        var at = day.AddHours(14);
        db.ExpenseCategories.Add(new ExpenseCategory { Id = 1, TenantId = 10, Name = "Fuel", CreatedAt = at });
        db.Expenses.Add(new Expense
        {
            TenantId = 10,
            OwnerId = 10,
            CategoryId = 1,
            Amount = 80m,
            TotalAmount = 80m,
            TaxType = "Petroleum",
            Status = ExpenseStatus.Approved,
            PaidFrom = ExpensePaidFrom.Cash,
            Date = at,
            CreatedBy = 1,
            CreatedAt = at
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var preview = await Service(db).GetPreviewAsync(10, day, openingCash: 500m);

        Assert.Equal(80m, preview.CashPaidOut);
        Assert.Equal(1, preview.ExpenseCount);
        Assert.Equal(420m, preview.ExpectedCash);
    }

    [Fact]
    public async Task Preview_FeatureDisabled_Throws()
    {
        await using var db = await DatabaseAsync(enableDailyClose: false);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service(db).GetPreviewAsync(10, DateTime.UtcNow.Date, openingCash: 0m));
    }

    private static DailyCloseService Service(AppDbContext db) =>
        new(db, new GstTime(), null!, new NoopAlerts(), new NoBranchSchema());

    private static async Task<AppDbContext> DatabaseAsync(bool enableDailyClose)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var features = enableDailyClose
            ? JsonSerializer.Serialize(new[] { TenantFeatureFlags.DailyClose })
            : null;
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant { Id = 10, Name = "Daily close fixture", Subdomain = "daily-close-fix", FeaturesJson = features });
        db.Users.Add(new User
        {
            Id = 1,
            TenantId = 10,
            OwnerId = 10,
            Name = "Owner",
            Email = "owner@daily-close.test",
            PasswordHash = "x",
            Role = UserRole.Owner,
            CreatedAt = now
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
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
}
