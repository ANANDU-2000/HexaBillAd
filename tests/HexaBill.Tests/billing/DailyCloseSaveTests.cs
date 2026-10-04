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

public class DailyCloseSaveTests
{
    [Fact]
    public async Task SubmitClose_VarianceWithoutReason_Throws()
    {
        await using var db = await DatabaseAsync();
        var day = new DateTime(2026, 3, 20, 0, 0, 0, DateTimeKind.Utc);
        var service = Service(db, new CaptureAlerts());

        var error = await Assert.ThrowsAsync<ArgumentException>(() => service.SaveCloseAsync(
            new SaveDailyCloseRequest
            {
                BusinessDate = day,
                OpeningCash = 100m,
                CountedCash = 90m,
                SubmitClose = true
            },
            tenantId: 10,
            userId: 1,
            canSubmitClose: true));

        Assert.Contains("Variance reason", error.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(await db.DailyCashCloses.ToListAsync());
    }

    [Fact]
    public async Task SubmitClose_WithVarianceReason_LocksDayAndRaisesVarianceAlert()
    {
        await using var db = await DatabaseAsync();
        var alerts = new CaptureAlerts();
        var service = Service(db, alerts);
        var day = new DateTime(2026, 3, 21, 0, 0, 0, DateTimeKind.Utc);

        var dto = await service.SaveCloseAsync(
            new SaveDailyCloseRequest
            {
                BusinessDate = day,
                OpeningCash = 100m,
                CountedCash = 90m,
                VarianceReason = "Drawer short after petrol run",
                SubmitClose = true
            },
            tenantId: 10,
            userId: 1,
            canSubmitClose: true);

        Assert.Equal("Closed", dto.Status, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(100m, dto.ExpectedCash);
        Assert.Equal(-10m, dto.Variance);
        Assert.Single(alerts.Created);
        Assert.Equal(AlertType.DailyCloseVariance, alerts.Created[0].Type);

        var status = await service.GetStatusAsync(10, day);
        Assert.True(status.IsLocked);
        Assert.False(status.CanEdit);
    }

    [Fact]
    public async Task SaveAfterClosed_ThrowsUntilReopened()
    {
        await using var db = await DatabaseAsync();
        var service = Service(db, new CaptureAlerts());
        var day = new DateTime(2026, 3, 22, 0, 0, 0, DateTimeKind.Utc);

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

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.SaveCloseAsync(
            new SaveDailyCloseRequest
            {
                BusinessDate = day,
                OpeningCash = 50m,
                CountedCash = 50m,
                SubmitClose = false
            },
            tenantId: 10,
            userId: 1,
            canSubmitClose: true));

        await service.ReopenAsync(
            new ReopenDailyCloseRequest { BusinessDate = day, Reason = "Correct count entry" },
            tenantId: 10,
            userId: 1,
            canReopen: true);

        var draft = await service.SaveCloseAsync(
            new SaveDailyCloseRequest
            {
                BusinessDate = day,
                OpeningCash = 50m,
                CountedCash = 48m,
                VarianceReason = "Two dirhams found in drawer",
                SubmitClose = false
            },
            tenantId: 10,
            userId: 1,
            canSubmitClose: true);

        Assert.Equal("Draft", draft.Status, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(2, draft.Version);
        Assert.Equal(-2m, draft.Variance);
        var editable = await service.GetStatusAsync(10, day);
        Assert.False(editable.IsLocked);
    }

    private static DailyCloseService Service(AppDbContext db, IAlertService alerts) =>
        new(db, new GstTime(), new NoopAudit(), alerts, new NoBranchSchema());

    private static async Task<AppDbContext> DatabaseAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var features = JsonSerializer.Serialize(new[] { TenantFeatureFlags.DailyClose });
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant { Id = 10, Name = "Daily close save fixture", Subdomain = "daily-close-save", FeaturesJson = features });
        db.Users.Add(new User
        {
            Id = 1,
            TenantId = 10,
            OwnerId = 10,
            Name = "Owner",
            Email = "owner@daily-close-save.test",
            PasswordHash = "x",
            Role = UserRole.Owner,
            CreatedAt = now
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
    }

    private sealed class CaptureAlerts : IAlertService
    {
        public List<(AlertType Type, string Title)> Created { get; } = new();

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
