using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.DailyClose;
using HexaBill.Api.Modules.Notifications;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

/// <summary>
/// PostgreSQL global query filters and tenant write guards (defense in depth for HTTP-scoped requests).
/// Set HEXABILL_TEST_POSTGRES to a dedicated test database connection string.
/// </summary>
public class TenantIsolationPostgreSqlTests
{
    [Fact]
    public async Task TenantA_CannotReadTenantB_FinancialRows_ViaQueryFilter()
    {
        var connectionString = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var tenantA = 910_000 + Random.Shared.Next(1, 40_000);
        var tenantB = tenantA + 1;
        FixtureIds ids;
        await using (var seed = await OpenPostgresAsync(connectionString, null, true))
        {
            ids = await SeedPairAsync(seed, tenantA, tenantB);
        }

        await using (var dbA = await OpenPostgresAsync(connectionString, tenantA, false))
        {
            Assert.Null(await dbA.Customers.FindAsync(ids.CustomerB));
            Assert.Null(await dbA.Payments.FindAsync(ids.PaymentB));
            Assert.Null(await dbA.DailyCashCloses.FindAsync(ids.CloseB));
            Assert.Null(await dbA.CashDrawerMovements.FindAsync(ids.MovementB));
            Assert.False(await TenantEntityAccess.CustomerBelongsToTenantAsync(dbA, ids.CustomerB, tenantA));
            Assert.False(await TenantEntityAccess.CashDrawerMovementBelongsToTenantAsync(dbA, ids.MovementB, tenantA));
        }

        await using (var cleanup = await OpenPostgresAsync(connectionString, null, true))
            await CleanupPairAsync(cleanup, tenantA, tenantB);
    }

    [Fact]
    public async Task TenantB_CannotReadTenantA_FinancialRows_ViaQueryFilter()
    {
        var connectionString = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var tenantA = 920_000 + Random.Shared.Next(1, 40_000);
        var tenantB = tenantA + 1;
        FixtureIds ids;
        await using (var seed = await OpenPostgresAsync(connectionString, null, true))
        {
            ids = await SeedPairAsync(seed, tenantA, tenantB);
        }

        await using (var dbB = await OpenPostgresAsync(connectionString, tenantB, false))
        {
            Assert.Null(await dbB.Customers.FindAsync(ids.CustomerA));
            Assert.Null(await dbB.Payments.FindAsync(ids.PaymentA));
            Assert.Null(await dbB.DailyCashCloses.FindAsync(ids.CloseA));
            Assert.Null(await dbB.CashDrawerMovements.FindAsync(ids.MovementA));
            Assert.False(await TenantEntityAccess.PaymentBelongsToTenantAsync(dbB, ids.PaymentA, tenantB));
            Assert.False(await TenantEntityAccess.DailyCashCloseBelongsToTenantAsync(dbB, ids.CloseA, tenantB));
        }

        await using (var cleanup = await OpenPostgresAsync(connectionString, null, true))
            await CleanupPairAsync(cleanup, tenantA, tenantB);
    }

    [Fact]
    public async Task TenantA_CannotWriteEntityTaggedForTenantB()
    {
        var connectionString = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var tenantA = 930_000 + Random.Shared.Next(1, 40_000);
        var tenantB = tenantA + 1;
        await using (var seed = await OpenPostgresAsync(connectionString, null, true))
        {
            seed.Tenants.AddRange(
                new Tenant { Id = tenantA, Name = "Iso A", Subdomain = $"iso-a-{tenantA}", FeaturesJson = "[]" },
                new Tenant { Id = tenantB, Name = "Iso B", Subdomain = $"iso-b-{tenantB}", FeaturesJson = "[]" });
            await seed.SaveChangesAsync();
        }

        await using (var dbA = await OpenPostgresAsync(connectionString, tenantA, false))
        {
            dbA.CashDrawerMovements.Add(new CashDrawerMovement
            {
                TenantId = tenantB,
                OwnerId = tenantB,
                MovementDate = DateTime.UtcNow,
                Kind = CashDrawerMovementKind.OwnerCapitalIn,
                Amount = 10m,
                CreatedByUserId = tenantA,
                CreatedAt = DateTime.UtcNow
            });
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => dbA.SaveChangesAsync());
        }

        await using (var cleanup = await OpenPostgresAsync(connectionString, null, true))
            await CleanupPairAsync(cleanup, tenantA, tenantB);
    }

    [Fact]
    public async Task DailyCloseService_TenantB_CannotDeleteTenantAMovement()
    {
        var connectionString = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var tenantA = 940_000 + Random.Shared.Next(1, 40_000);
        var tenantB = tenantA + 1;
        FixtureIds ids;
        await using (var seed = await OpenPostgresAsync(connectionString, null, true))
        {
            ids = await SeedPairAsync(seed, tenantA, tenantB);
        }

        await using (var dbB = await OpenPostgresAsync(connectionString, tenantB, false))
        {
            var service = CreateDailyCloseService(dbB);
            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.DeleteMovementAsync(ids.MovementA, tenantB, tenantB, canManage: true));
        }

        await using (var cleanup = await OpenPostgresAsync(connectionString, null, true))
            await CleanupPairAsync(cleanup, tenantA, tenantB);
    }

    private readonly record struct FixtureIds(
        int CustomerA, int CustomerB,
        int PaymentA, int PaymentB,
        int CloseA, int CloseB,
        int MovementA, int MovementB);

    private static DailyCloseService CreateDailyCloseService(AppDbContext db) =>
        new(db, new TimeZoneService(), new AuditNoop(), new AlertNoop(), new SalesSchemaBranchesEnabled());

    private static async Task<AppDbContext> OpenPostgresAsync(string connectionString, int? tenantId, bool platformScope)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options);
        db.SetRequestTenantScope(tenantId, platformScope);
        await PostgresTestSchema.EnsureCreatedAsync(db);
        return db;
    }

    private static async Task<FixtureIds> SeedPairAsync(AppDbContext db, int tenantA, int tenantB)
    {
        var now = DateTime.UtcNow;
        var biz = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var moveAt = biz.AddHours(12);
        db.Tenants.AddRange(
            new Tenant { Id = tenantA, Name = "Iso A", Subdomain = $"iso-a-{tenantA}", FeaturesJson = """["daily_close"]""" },
            new Tenant { Id = tenantB, Name = "Iso B", Subdomain = $"iso-b-{tenantB}", FeaturesJson = """["daily_close"]""" });
        db.Users.AddRange(
            new User { Id = tenantA, TenantId = tenantA, OwnerId = tenantA, Name = "A", Email = $"a-{tenantA}@t.test", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now },
            new User { Id = tenantB, TenantId = tenantB, OwnerId = tenantB, Name = "B", Email = $"b-{tenantB}@t.test", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now });

        var customerA = new Customer { TenantId = tenantA, OwnerId = tenantA, Name = "Cust A", CreatedAt = now, UpdatedAt = now };
        var customerB = new Customer { TenantId = tenantB, OwnerId = tenantB, Name = "Cust B", CreatedAt = now, UpdatedAt = now };
        db.Customers.AddRange(customerA, customerB);
        await db.SaveChangesAsync();

        var paymentA = new Payment { TenantId = tenantA, OwnerId = tenantA, CustomerId = customerA.Id, Amount = 5m, PaymentDate = moveAt, CreatedAt = now, CreatedBy = tenantA };
        var paymentB = new Payment { TenantId = tenantB, OwnerId = tenantB, CustomerId = customerB.Id, Amount = 7m, PaymentDate = moveAt, CreatedAt = now, CreatedBy = tenantB };
        db.Payments.AddRange(paymentA, paymentB);

        var closeA = new DailyCashClose
        {
            TenantId = tenantA, OwnerId = tenantA, BusinessDate = biz, Version = 1, Status = DailyCashCloseStatus.Draft,
            OpeningCash = 0, CashReceived = 0, CashPaidOut = 0, BankReceived = 0, BankPaidOut = 0,
            ExpectedCash = 0, CountedCash = 0, Variance = 0, CreatedByUserId = tenantA, CreatedAt = now, UpdatedAt = now
        };
        var closeB = new DailyCashClose
        {
            TenantId = tenantB, OwnerId = tenantB, BusinessDate = biz, Version = 1, Status = DailyCashCloseStatus.Draft,
            OpeningCash = 0, CashReceived = 0, CashPaidOut = 0, BankReceived = 0, BankPaidOut = 0,
            ExpectedCash = 0, CountedCash = 0, Variance = 0, CreatedByUserId = tenantB, CreatedAt = now, UpdatedAt = now
        };
        db.DailyCashCloses.AddRange(closeA, closeB);

        var moveA = new CashDrawerMovement
        {
            TenantId = tenantA, OwnerId = tenantA, MovementDate = moveAt, Kind = CashDrawerMovementKind.OwnerCapitalIn,
            Amount = 100m, CreatedByUserId = tenantA, CreatedAt = now
        };
        var moveB = new CashDrawerMovement
        {
            TenantId = tenantB, OwnerId = tenantB, MovementDate = moveAt, Kind = CashDrawerMovementKind.OwnerDrawing,
            Amount = 50m, CreatedByUserId = tenantB, CreatedAt = now
        };
        db.CashDrawerMovements.AddRange(moveA, moveB);
        await db.SaveChangesAsync();

        return new FixtureIds(customerA.Id, customerB.Id, paymentA.Id, paymentB.Id, closeA.Id, closeB.Id, moveA.Id, moveB.Id);
    }

    private static async Task CleanupPairAsync(AppDbContext db, int tenantA, int tenantB)
    {
        await db.CashDrawerMovements.Where(m => m.TenantId == tenantA || m.TenantId == tenantB).ExecuteDeleteAsync();
        await db.DailyCashCloses.Where(c => c.TenantId == tenantA || c.TenantId == tenantB).ExecuteDeleteAsync();
        await db.Payments.Where(p => p.TenantId == tenantA || p.TenantId == tenantB).ExecuteDeleteAsync();
        await db.Customers.Where(c => c.TenantId == tenantA || c.TenantId == tenantB).ExecuteDeleteAsync();
        await db.Users.Where(u => u.TenantId == tenantA || u.TenantId == tenantB).ExecuteDeleteAsync();
        await db.Tenants.Where(t => t.Id == tenantA || t.Id == tenantB).ExecuteDeleteAsync();
    }

    private sealed class AuditNoop : IAuditService
    {
        public Task LogAsync(string action, string? entityType = null, int? entityId = null, object? oldValues = null, object? newValues = null, string? details = null, int? actingUserId = null)
            => Task.CompletedTask;
    }

    private sealed class SalesSchemaBranchesEnabled : ISalesSchemaService
    {
        public Task<bool> SalesHasBranchIdAndRouteIdAsync() => Task.FromResult(false);
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
