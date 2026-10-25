using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.Notifications;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Core.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>
/// P0-FIN-002: production invoice 1791254857 (create 4, edit, edit, delete) left the stock movement log with
/// one extra "Sale Updated" deduction per edit, while Products.StockQty stayed right. After every create/edit/delete
/// the net Sale-linked movements per product must equal -(current line qty) (0 once deleted) and match StockQty.
/// UpdateSaleAsync is the only edit path (A4 and POS both call PUT /api/sales/{id}).
/// </summary>
public class SaleEditStockLedgerTests
{
    private const decimal Initial = 50m;

    [Fact]
    public async Task CreateEditTwiceDelete_Sqlite_LogNetsToCurrentQuantitiesAndStockMatches()
    {
        const int t = 10;
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(t, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var products = await SeedAsync(db, t);
        await RunScenarioAsync(() => db, t, products);
    }

    [SkippableFact]
    public async Task CreateEditTwiceDelete_PostgreSql_LogNetsToCurrentQuantitiesAndStockMatches()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var t = 1_850_000 + Random.Shared.Next(1, 50_000);
        int[] products;
        await using (var seed = Open(connection!, t))
        {
            await PostgresTestSchema.EnsureCreatedAsync(seed);
            products = await SeedAsync(seed, t);
        }
        try
        {
            await RunScenarioAsync(() => Open(connection!, t), t, products, disposeEach: true);
        }
        finally
        {
            await using var c = Open(connection!, t);
            await c.AuditLogs.IgnoreQueryFilters().Where(a => a.TenantId == t).ExecuteDeleteAsync();
            await c.InvoiceVersions.IgnoreQueryFilters().Where(v => c.Sales.IgnoreQueryFilters().Any(s => s.TenantId == t && s.Id == v.SaleId)).ExecuteDeleteAsync();
            await c.PaymentReceipts.IgnoreQueryFilters().Where(r => r.TenantId == t).ExecuteDeleteAsync();
            await c.Payments.IgnoreQueryFilters().Where(x => x.TenantId == t).ExecuteDeleteAsync();
            await c.InventoryTransactions.IgnoreQueryFilters().Where(x => x.TenantId == t).ExecuteDeleteAsync();
            await c.SaleItems.IgnoreQueryFilters().Where(i => c.Sales.IgnoreQueryFilters().Any(s => s.TenantId == t && s.Id == i.SaleId)).ExecuteDeleteAsync();
            await c.Sales.IgnoreQueryFilters().Where(s => s.TenantId == t).ExecuteDeleteAsync();
            await c.Products.IgnoreQueryFilters().Where(p => p.TenantId == t).ExecuteDeleteAsync();
            await c.Users.IgnoreQueryFilters().Where(u => u.TenantId == t).ExecuteDeleteAsync();
            await c.Tenants.Where(x => x.Id == t).ExecuteDeleteAsync();
        }
    }

    private static async Task RunScenarioAsync(Func<AppDbContext> ctx, int t, int[] p, bool disposeEach = false)
    {
        async Task<T> With<T>(Func<AppDbContext, Task<T>> f)
        {
            var db = ctx();
            try { db.ChangeTracker.Clear(); return await f(db); }
            finally { if (disposeEach) await db.DisposeAsync(); }
        }
        CreateSaleRequest Req(params decimal[] q) => new()
        {
            InvoiceNo = "1791254857",
            Items = p.Select((id, i) => new SaleItemRequest { ProductId = id, UnitType = "CRTN", Qty = q[i], UnitPrice = 10 }).ToList()
        };
        async Task AssertState(int saleId, decimal[] current, string step)
        {
            await With(async db =>
            {
                for (var i = 0; i < p.Length; i++)
                {
                    var stock = (await db.Products.IgnoreQueryFilters().AsNoTracking().SingleAsync(x => x.Id == p[i])).StockQty;
                    Assert.True(Initial - current[i] == stock, $"{step}: product {i} StockQty {stock}, expected {Initial - current[i]}");
                    var moves = await db.InventoryTransactions.IgnoreQueryFilters().AsNoTracking()
                        .Where(x => x.TenantId == t && x.ProductId == p[i]).ToListAsync();
                    Assert.All(moves, m => Assert.Equal(saleId, m.RefId));
                    var net = moves.Sum(m => m.ChangeQty);
                    Assert.True(-current[i] == net, $"{step}: product {i} net movement {net}, expected {-current[i]}");
                }
                return 0;
            });
        }

        // Real edits happen later than the 30-second "another user is editing" window; age the stamp instead of sleeping.
        Task Age(int id) => With(db => db.Sales.IgnoreQueryFilters().Where(s => s.Id == id)
            .ExecuteUpdateAsync(u => u.SetProperty(s => s.LastModifiedAt, DateTime.UtcNow.AddMinutes(-5))));
        var sale = await With(db => Service(db).CreateSaleAsync(Req(4, 2, 2), t, t));
        await AssertState(sale.Id, new[] { 4m, 2m, 2m }, "create");
        await Age(sale.Id);
        await With(db => Service(db).UpdateSaleAsync(sale.Id, Req(4, 2, 2), t, t, "same qty"));
        await AssertState(sale.Id, new[] { 4m, 2m, 2m }, "edit 1 (same)");
        await Age(sale.Id);
        await With(db => Service(db).UpdateSaleAsync(sale.Id, Req(3, 5, 1), t, t, "changed qty"));
        await AssertState(sale.Id, new[] { 3m, 5m, 1m }, "edit 2 (changed)");
        Assert.True(await With(db => Service(db).DeleteSaleAsync(sale.Id, t, t)));
        await AssertState(sale.Id, new[] { 0m, 0m, 0m }, "delete");
    }

    private static async Task<int[]> SeedAsync(AppDbContext db, int t)
    {
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant { Id = t, Name = "Edit ledger", Subdomain = $"edit-ledger-{t}" });
        db.Users.Add(new User { Id = t, TenantId = t, OwnerId = t, Name = "Owner", Email = $"ledger-{t}@example.test", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now });
        var ps = Enumerable.Range(1, 3).Select(i => new Product { TenantId = t, OwnerId = t, NameEn = $"Synthetic {i}", Sku = $"EL-{t}-{i}", StockQty = Initial, ConversionToBase = 1, CostPrice = 5, SellPrice = 10, UnitType = "CRTN", CreatedAt = now, UpdatedAt = now }).ToList();
        db.Products.AddRange(ps);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return ps.Select(x => x.Id).ToArray();
    }

    private static AppDbContext Open(string connection, int tenantId)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options);
        db.SetRequestTenantScope(tenantId, false);
        return db;
    }

    private static SaleService Service(AppDbContext db) =>
        new(db, null!, null!, new InvoiceNumbers().Object, new ValidationService(db), new AlertNoop(), new BalanceService(db, NullLogger<BalanceService>.Instance, new AlertNoop()),
            new UtcTime(), null!, new NoBranchSchema(), null!, new VatUnlocked().Object, new NoNegativeStock(), null!, NullLogger<SaleService>.Instance);

    private sealed class NoBranchSchema : ISalesSchemaService
    {
        public Task<bool> SalesHasBranchIdAndRouteIdAsync() => Task.FromResult(false);
        public void ClearColumnCheckCache() { }
    }

    private sealed class NoNegativeStock : ISettingsService
    {
        public Task<Dictionary<string, string>> GetOwnerSettingsAsync(int tenantId) => Task.FromResult(new Dictionary<string, string>());
        public Task<string?> GetSettingValueAsync(int tenantId, string key) =>
            Task.FromResult<string?>(string.Equals(key, "ALLOW_NEGATIVE_STOCK", StringComparison.OrdinalIgnoreCase) ? "false" : null);
        public Task<bool> UpdateOwnerSettingAsync(int tenantId, string key, string value) => throw new NotSupportedException();
        public Task<bool> UpdateOwnerSettingsBulkAsync(int tenantId, Dictionary<string, string> settings) => throw new NotSupportedException();
        public Task<CompanySettings> GetCompanySettingsAsync(int tenantId) => Task.FromResult(new CompanySettings { VatNumber = "123456789012345" });
        public Task<LogoMetadata?> GetLogoMetadataAsync(int tenantId) => throw new NotSupportedException();
        public Task ClearLogoAsync(int tenantId) => throw new NotSupportedException();
        public Task ClearStampAsync(int tenantId) => throw new NotSupportedException();
        public Task ClearSignatureAsync(int tenantId) => throw new NotSupportedException();
        public Task<int> CountOtherTenantsSharingVatTrnAsync(int tenantId, string? vatTrn) => Task.FromResult(0);
    }

    private sealed class VatUnlocked : InterfaceStub<IVatReturnValidationService>
    {
        public VatUnlocked() => When(nameof(IVatReturnValidationService.IsTransactionDateInLockedPeriodAsync), _ => Task.FromResult(false));
    }

    private sealed class InvoiceNumbers : InterfaceStub<IInvoiceNumberService>
    {
        public InvoiceNumbers()
        {
            When(nameof(IInvoiceNumberService.ValidateInvoiceNumberAsync), _ => Task.FromResult(true));
            When(nameof(IInvoiceNumberService.GenerateNextInvoiceNumberInTransactionAsync), _ => Task.FromResult("INV-AUTO"));
        }
    }

    private sealed class UtcTime : ITimeZoneService
    {
        public DateTime GetCurrentTime() => DateTime.UtcNow;
        public DateTime GetCurrentDate() => DateTime.UtcNow.Date;
        public DateTime GetDefaultInvoiceDateUtc() => DateTime.UtcNow;
        public DateTime ConvertToGst(DateTime utcDateTime) => utcDateTime;
        public DateTime ConvertToUtc(DateTime gstDateTime) => gstDateTime;
        public TimeZoneInfo GetGstTimeZone() => TimeZoneInfo.Utc;
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
