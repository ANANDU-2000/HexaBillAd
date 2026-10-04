using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.DailyClose;
using HexaBill.Api.Modules.Notifications;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

/// <summary>
/// Requires PostgreSQL: set HEXABILL_TEST_POSTGRES to a connection string (dedicated test DB).
/// Skips when unset so CI/SQLite-only runs stay green.
/// </summary>
public class DailyCloseConcurrencyPostgreSqlTests
{
    [Fact]
    public async Task ParallelSubmitClose_OnlyOneSucceeds()
    {
        var connectionString = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var tenantId = 920_000 + Random.Shared.Next(1, 50_000);
        var businessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        await using (var seed = await OpenPostgresAsync(connectionString, tenantId))
        {
            await SeedDailyCloseTenantAsync(seed, tenantId);
        }

        var successCount = 0;
        var failCount = 0;
        var tasks = Enumerable.Range(0, 4).Select(_ => Task.Run(async () =>
        {
            await using var db = await OpenPostgresAsync(connectionString, tenantId);
            var service = CreateService(db);
            try
            {
                await service.SaveCloseAsync(new SaveDailyCloseRequest
                {
                    BusinessDate = businessDate,
                    OpeningCash = 0m,
                    CountedCash = 0m,
                    SubmitClose = true
                }, tenantId, tenantId, canSubmitClose: true);
                Interlocked.Increment(ref successCount);
            }
            catch (InvalidOperationException)
            {
                Interlocked.Increment(ref failCount);
            }
        }));
        await Task.WhenAll(tasks);

        await using (var verify = await OpenPostgresAsync(connectionString, tenantId))
        {
            Assert.Equal(1, successCount);
            Assert.Equal(3, failCount);
            var closed = await verify.DailyCashCloses
                .Where(c => c.TenantId == tenantId && c.Status == DailyCashCloseStatus.Closed)
                .ToListAsync();
            Assert.Single(closed);
            await CleanupTenantAsync(verify, tenantId);
        }
    }

    private static DailyCloseService CreateService(AppDbContext db) =>
        new(db, new TimeZoneService(), new AuditNoop(), new AlertNoop(), new SalesSchemaBranchesEnabled());

    private static async Task<AppDbContext> OpenPostgresAsync(string connectionString, int tenantId)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options);
        db.SetRequestTenantScope(tenantId, false);
        await PostgresTestSchema.EnsureCreatedAsync(db);
        return db;
    }

    private static async Task SeedDailyCloseTenantAsync(AppDbContext db, int tenantId)
    {
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            Name = $"PG close {tenantId}",
            Subdomain = $"pg-close-{tenantId}",
            FeaturesJson = """["daily_close"]"""
        });
        db.Users.Add(new User
        {
            Id = tenantId,
            TenantId = tenantId,
            OwnerId = tenantId,
            Name = "PG fixture",
            Email = $"pg-close-{tenantId}@example.test",
            PasswordHash = "fixture",
            Role = UserRole.Owner,
            CreatedAt = now
        });
        await db.SaveChangesAsync();
    }

    private static async Task CleanupTenantAsync(AppDbContext db, int tenantId)
    {
        await db.DailyCashCloses.Where(c => c.TenantId == tenantId).ExecuteDeleteAsync();
        await db.Users.Where(u => u.TenantId == tenantId).ExecuteDeleteAsync();
        await db.Tenants.Where(t => t.Id == tenantId).ExecuteDeleteAsync();
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
}
