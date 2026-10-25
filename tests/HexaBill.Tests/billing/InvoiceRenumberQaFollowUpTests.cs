using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace HexaBill.Tests;

/// <summary>P0-NUM-004 QA follow-up: VAT period guard on renumber (in-memory provider).</summary>
public class InvoiceRenumberVatPeriodTests
{
    private const int TenantId = 20;
    private static readonly DateTime Day = new(2026, 10, 20, 9, 0, 0, DateTimeKind.Utc);

    private static (AppDbContext Db, Sale Sale) Seed(string? periodStatus)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase("RenumVat_" + Guid.NewGuid()).Options);
        db.SetRequestTenantScope(null, true);
        db.Tenants.Add(new Tenant { Id = TenantId, Name = "FrozenHub QA", Subdomain = "frozenhub" });
        db.Settings.Add(new Setting { TenantId = TenantId, OwnerId = TenantId, Key = InvoiceNumberService.SeriesStartSettingKey, Value = "7000" });
        var sale = new Sale
        {
            Id = 61_001, TenantId = TenantId, OwnerId = TenantId, CreatedBy = 1, InvoiceNo = "1791254852", InvoiceDate = Day, CreatedAt = Day,
            Subtotal = 685.71m, VatTotal = 34.29m, GrandTotal = 720m, TotalAmount = 720m, IsFinalized = true
        };
        db.Sales.Add(sale);
        if (periodStatus != null)
            db.VatReturnPeriods.Add(new VatReturnPeriod
            {
                TenantId = TenantId, PeriodLabel = "Q4-2026", PeriodStart = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc),
                PeriodEnd = new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc), DueDate = new DateTime(2027, 1, 28, 0, 0, 0, DateTimeKind.Utc), Status = periodStatus
            });
        db.SaveChanges();
        return (db, sale);
    }

    private static Task<(InvoiceNumberChangeOutcome Outcome, string? Problem, InvoiceNumberChangeResult? Result)> Change(AppDbContext db, int id, bool dryRun) =>
        new InvoiceRenumberService(db, new InvoiceNumberService(db, new ConfigurationBuilder().Build()))
            .ChangeAsync(id, TenantId, 77, new ChangeInvoiceNumberRequest { NewInvoiceNumber = "7000" }, dryRun);

    [Theory]
    [InlineData("Submitted", false)]
    [InlineData("Locked", false)]
    [InlineData("Submitted", true)]
    [InlineData("Locked", true)]
    public async Task FiledOrLockedPeriod_IsRefused_AndNothingChanges(string status, bool dryRun)
    {
        var (db, sale) = Seed(status);
        await using var _ = db;
        var (outcome, problem, _) = await Change(db, sale.Id, dryRun);
        Assert.Equal(InvoiceNumberChangeOutcome.Invalid, outcome);
        Assert.Equal(InvoiceRenumberService.VatPeriodClosedMessage, problem);
        Assert.Equal("1791254852", (await db.Sales.AsNoTracking().SingleAsync(s => s.Id == sale.Id)).InvoiceNo);
        Assert.Equal(0, await db.AuditLogs.CountAsync());
    }

    private sealed class AlwaysLockedVat : HexaBill.Api.Modules.Reports.IVatReturnValidationService
    {
        public Task<bool> IsTransactionDateInLockedPeriodAsync(int tenantId, DateTime transactionDate) => Task.FromResult(true);
        public Task<List<HexaBill.Api.Models.ValidationIssueDto>> ValidatePeriodAsync(int tenantId, DateTime from, DateTime to, HexaBill.Api.Models.VatReturn201Dto? precomputed = null) => throw new NotSupportedException();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task SaleEditVatCheckAlone_RefusesWithSaleEditWording(bool dryRun)
    {
        var (db, sale) = Seed(null); // no frozen period, so VatReturnWriteGuard passes; only the sale-edit check refuses
        await using var _ = db;
        var (outcome, problem, _) = await new InvoiceRenumberService(db, new InvoiceNumberService(db, new ConfigurationBuilder().Build()), new AlwaysLockedVat())
            .ChangeAsync(sale.Id, TenantId, 77, new ChangeInvoiceNumberRequest { NewInvoiceNumber = "7000" }, dryRun);
        Assert.Equal(InvoiceNumberChangeOutcome.Invalid, outcome);
        Assert.Equal("VAT return period is locked for this invoice date. You cannot add or edit transactions in a locked period.", problem);
        Assert.Equal("1791254852", (await db.Sales.AsNoTracking().SingleAsync(s => s.Id == sale.Id)).InvoiceNo);
        Assert.Equal(0, await db.AuditLogs.CountAsync());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("Draft")]
    [InlineData("Calculated")]
    public async Task OpenPeriod_IsAllowed(string? status)
    {
        var (db, sale) = Seed(status);
        await using var _ = db;
        var (outcome, problem, _) = await Change(db, sale.Id, dryRun: false);
        Assert.True(outcome == InvoiceNumberChangeOutcome.Ok, problem);
        Assert.Equal("7000", (await db.Sales.AsNoTracking().SingleAsync(s => s.Id == sale.Id)).InvoiceNo);
    }
}

[Collection("HttpIntegration")]
public class InvoiceRenumberCrossTenantHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;
    public InvoiceRenumberCrossTenantHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task RealPut_OnOtherTenantsSale_Returns404_AndSaleIsUnchanged_WhileOwnSaleRouteWorks()
    {
        using var attacker = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        using var victim = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var before = await victim.GetStringAsync("/api/sales/2");
        Assert.Contains("B-2001", before);

        // Not a dry run: a real write attempt against tenant B's sale from tenant A's owner token.
        var response = await attacker.PutAsJsonAsync("/api/sales/2/invoice-number", new { newInvoiceNumber = "987001", reason = "cross-tenant probe" });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(before, await victim.GetStringAsync("/api/sales/2"));

        // The route itself exists and answers for the caller's own sale, so the 404 above is tenant isolation, not a missing route.
        var own = await attacker.PutAsJsonAsync("/api/sales/1/invoice-number?dryRun=true", new { newInvoiceNumber = "987002" });
        Assert.Equal(HttpStatusCode.OK, own.StatusCode);
    }
}

/// <summary>P0-NUM-004 QA follow-up on real Postgres: renumber race and the next-number advisory-lock connection fix.</summary>
public class InvoiceRenumberPostgresConcurrencyTests
{
    private static AppDbContext Open(string connection, int tenantId, params IInterceptor[] interceptors)
    {
        var b = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection);
        if (interceptors.Length > 0) b.AddInterceptors(interceptors);
        var db = new AppDbContext(b.Options);
        db.SetRequestTenantScope(tenantId, false);
        return db;
    }

    private static async Task<int[]> SeedAsync(string connection, int tenantId, int sales)
    {
        await using var seed = Open(connection, tenantId);
        await PostgresTestSchema.EnsureCreatedAsync(seed);
        var now = DateTime.UtcNow;
        seed.Tenants.Add(new Tenant { Id = tenantId, Name = "Renumber race", Subdomain = $"renrace-{tenantId}" });
        seed.Users.Add(new User { Id = tenantId, TenantId = tenantId, OwnerId = tenantId, Name = "Owner", Email = $"renrace-{tenantId}@example.test", PasswordHash = "fixture", Role = UserRole.Owner, CreatedAt = now });
        seed.Settings.Add(new Setting { TenantId = tenantId, OwnerId = tenantId, Key = InvoiceNumberService.SeriesStartSettingKey, Value = "7000" });
        var list = Enumerable.Range(0, sales).Select(i => new Sale
        {
            TenantId = tenantId, OwnerId = tenantId, CreatedBy = tenantId, InvoiceNo = $"17912548{60 + i}", InvoiceDate = now, CreatedAt = now,
            Subtotal = 100m, VatTotal = 5m, GrandTotal = 105m, TotalAmount = 105m, PaymentStatus = SalePaymentStatus.Pending, IsFinalized = true
        }).ToList();
        seed.Sales.AddRange(list);
        await seed.SaveChangesAsync();
        return list.Select(s => s.Id).ToArray();
    }

    private static async Task CleanupAsync(string connection, int tenantId)
    {
        await using var c = Open(connection, tenantId);
        await c.AuditLogs.Where(a => a.TenantId == tenantId).ExecuteDeleteAsync();
        await c.Sales.IgnoreQueryFilters().Where(s => s.TenantId == tenantId).ExecuteDeleteAsync();
        await c.Settings.Where(s => s.TenantId == tenantId).ExecuteDeleteAsync();
        await c.Users.Where(u => u.TenantId == tenantId).ExecuteDeleteAsync();
        await c.Tenants.Where(t => t.Id == tenantId).ExecuteDeleteAsync();
    }

    [SkippableFact]
    public async Task ConcurrentRenumbersOfDifferentSalesToSameNumber_ExactlyOneWins_RestAre400Or409()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var tenantId = 1_850_000 + Random.Shared.Next(1, 50_000);
        var ids = await SeedAsync(connection!, tenantId, 6);
        try
        {
            using var gate = new SemaphoreSlim(0);
            var tasks = ids.Select(id => Task.Run(async () =>
            {
                await gate.WaitAsync();
                await using var db = Open(connection!, tenantId);
                try
                {
                    var r = await new InvoiceRenumberService(db, new InvoiceNumberService(db, new ConfigurationBuilder().Build()))
                        .ChangeAsync(id, tenantId, tenantId, new ChangeInvoiceNumberRequest { NewInvoiceNumber = "7000" }, dryRun: false);
                    return r.Outcome == InvoiceNumberChangeOutcome.Ok ? 200 : r.Outcome == InvoiceNumberChangeOutcome.Invalid ? 400 : 404;
                }
                catch (DbUpdateException) { return 409; } // the controller maps this to 409
            })).ToArray();
            gate.Release(ids.Length);
            var codes = await Task.WhenAll(tasks);

            Assert.Equal(1, codes.Count(c => c == 200));
            Assert.All(codes.Where(c => c != 200), c => Assert.True(c is 400 or 409, $"unexpected {c}"));
            await using var check = Open(connection!, tenantId);
            Assert.Equal(1, await check.Sales.CountAsync(s => s.TenantId == tenantId && s.InvoiceNo == "7000"));
            Assert.Equal(1, await check.AuditLogs.CountAsync(a => a.TenantId == tenantId && a.Action == InvoiceRenumberService.AuditAction));
        }
        finally { await CleanupAsync(connection!, tenantId); }
    }

    /// <summary>Records connection open/close and every command so the lock..unlock window can be inspected.</summary>
    private sealed class Recorder : DbCommandInterceptor, IDbConnectionInterceptor
    {
        public readonly List<string> Events = new();
        public override InterceptionResult<DbDataReader> ReaderExecuting(DbCommand c, CommandEventData e, InterceptionResult<DbDataReader> r) { Add(c); return r; }
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand c, CommandEventData e, InterceptionResult<DbDataReader> r, CancellationToken t = default) { Add(c); return ValueTask.FromResult(r); }
        public override InterceptionResult<int> NonQueryExecuting(DbCommand c, CommandEventData e, InterceptionResult<int> r) { Add(c); return r; }
        public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand c, CommandEventData e, InterceptionResult<int> r, CancellationToken t = default) { Add(c); return ValueTask.FromResult(r); }
        public override InterceptionResult<object> ScalarExecuting(DbCommand c, CommandEventData e, InterceptionResult<object> r) { Add(c); return r; }
        public override ValueTask<InterceptionResult<object>> ScalarExecutingAsync(DbCommand c, CommandEventData e, InterceptionResult<object> r, CancellationToken t = default) { Add(c); return ValueTask.FromResult(r); }
        private void Add(DbCommand c)
        {
            var pid = (c.Connection as NpgsqlConnection)?.ProcessID ?? 0;
            var sql = c.CommandText.Contains("pg_advisory_lock") ? "LOCK" : c.CommandText.Contains("pg_advisory_unlock") ? "UNLOCK" : "SQL";
            lock (Events) Events.Add($"{sql}:{pid}");
        }
        public void ConnectionClosed(DbConnection connection, ConnectionEndEventData eventData) { lock (Events) Events.Add("CLOSE"); }
        public Task ConnectionClosedAsync(DbConnection connection, ConnectionEndEventData eventData) { ConnectionClosed(connection, eventData); return Task.CompletedTask; }
    }

    [SkippableFact]
    public async Task NextNumber_HoldsOnePhysicalConnectionFromLockToUnlock_AndLeavesNoAdvisoryLock()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var tenantId = 1_900_000 + Random.Shared.Next(1, 50_000);
        await SeedAsync(connection!, tenantId, 1);
        try
        {
            var rec = new Recorder();
            await using (var db = Open(connection!, tenantId, rec))
            {
                Assert.Equal("7000", await new InvoiceNumberService(db, new ConfigurationBuilder().Build()).GenerateNextInvoiceNumberAsync(tenantId));
            }

            var lockAt = rec.Events.FindIndex(e => e.StartsWith("LOCK:"));
            var unlockAt = rec.Events.FindIndex(e => e.StartsWith("UNLOCK:"));
            Assert.True(lockAt >= 0 && unlockAt > lockAt, string.Join(", ", rec.Events));
            var window = rec.Events.Skip(lockAt).Take(unlockAt - lockAt + 1).ToList();
            // A session-level advisory lock belongs to one backend: the connection must not be returned to the pool inside the window,
            // and every statement in it (including the unlock) must run on the backend that took the lock.
            Assert.DoesNotContain("CLOSE", window);
            var lockPid = rec.Events[lockAt].Split(':')[1];
            Assert.All(window, e => Assert.Equal(lockPid, e.Split(':')[1]));

            await using var probe = new NpgsqlConnection(connection);
            await probe.OpenAsync();
            await using var cmd = new NpgsqlCommand("SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND objid = @k", probe);
            cmd.Parameters.AddWithValue("k", (long)(1000000 + tenantId));
            Assert.Equal(0L, (long)(await cmd.ExecuteScalarAsync())!);
        }
        finally { await CleanupAsync(connection!, tenantId); }
    }
}
