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

public class DailyCloseMovementTests
{
    [Fact]
    public async Task Preview_OwnerCapitalIn_IncreasesExpectedCash()
    {
        await using var db = await DatabaseAsync();
        var service = Service(db);
        var day = new DateTime(2026, 3, 25, 0, 0, 0, DateTimeKind.Utc);

        await service.CreateMovementAsync(
            new CreateCashDrawerMovementRequest
            {
                BusinessDate = day,
                Kind = "OwnerCapitalIn",
                Amount = 25m,
                MovementDate = day.AddHours(11)
            },
            tenantId: 10,
            userId: 1,
            canManage: true);

        var preview = await service.GetPreviewAsync(10, day, openingCash: 100m);

        Assert.Equal(25m, preview.OwnerCapitalIn);
        Assert.Equal(125m, preview.ExpectedCash);
    }

    [Fact]
    public async Task CreateMovement_OnClosedDay_Throws()
    {
        await using var db = await DatabaseAsync();
        var service = Service(db);
        var day = new DateTime(2026, 3, 26, 0, 0, 0, DateTimeKind.Utc);

        await service.SaveCloseAsync(
            new SaveDailyCloseRequest
            {
                BusinessDate = day,
                OpeningCash = 50m,
                CountedCash = 50m,
                SubmitClose = true
            },
            tenantId: 10,
            userId: 1,
            canSubmitClose: true);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateMovementAsync(
            new CreateCashDrawerMovementRequest
            {
                BusinessDate = day,
                Kind = "OwnerCapitalIn",
                Amount = 10m,
                MovementDate = day.AddHours(9)
            },
            tenantId: 10,
            userId: 1,
            canManage: true));
    }

    [Fact]
    public async Task DeleteMovement_OnClosedDay_Throws()
    {
        await using var db = await DatabaseAsync();
        var service = Service(db);
        var day = new DateTime(2026, 3, 27, 0, 0, 0, DateTimeKind.Utc);

        var movement = await service.CreateMovementAsync(
            new CreateCashDrawerMovementRequest
            {
                BusinessDate = day,
                Kind = "BankToDrawer",
                Amount = 40m,
                MovementDate = day.AddHours(10)
            },
            tenantId: 10,
            userId: 1,
            canManage: true);

        await service.SaveCloseAsync(
            new SaveDailyCloseRequest
            {
                BusinessDate = day,
                OpeningCash = 0m,
                CountedCash = 40m,
                SubmitClose = true
            },
            tenantId: 10,
            userId: 1,
            canSubmitClose: true);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.DeleteMovementAsync(movement.Id, tenantId: 10, userId: 1, canManage: true));
    }

    private static DailyCloseService Service(AppDbContext db) =>
        new(db, new GstTime(), new NoopAudit(), new NoopAlerts(), new NoBranchSchema());

    private static async Task<AppDbContext> DatabaseAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var features = JsonSerializer.Serialize(new[] { TenantFeatureFlags.DailyClose });
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant { Id = 10, Name = "Daily close movement fixture", Subdomain = "daily-close-mv", FeaturesJson = features });
        db.Users.Add(new User
        {
            Id = 1,
            TenantId = 10,
            OwnerId = 10,
            Name = "Owner",
            Email = "owner@daily-close-mv.test",
            PasswordHash = "x",
            Role = UserRole.Owner,
            CreatedAt = now
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
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
}
