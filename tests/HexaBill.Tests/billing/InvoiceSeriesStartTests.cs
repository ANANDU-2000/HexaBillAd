using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HexaBill.Tests;

/// <summary>
/// FrozenHub asked for new invoices to start at 7000. Production tenant 20 currently issues 10-digit numbers because
/// the legacy max+1 rule extracted digits from a smoke invoice "FH-SMK-1791254849". These tests pin the legacy rule
/// and prove the opt-in INVOICE_SERIES_START setting starts a clean, tenant-scoped series without reusing numbers.
/// </summary>
public class InvoiceSeriesStartTests
{
    private const int TenantId = 20;
    private const int OtherTenantId = 22;
    private static readonly DateTime Day = new(2026, 10, 24, 0, 0, 0, DateTimeKind.Utc);

    private static AppDbContext NewDb()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("InvoiceSeries_" + Guid.NewGuid()).Options);
        db.SetRequestTenantScope(null, true);
        db.Tenants.AddRange(
            new Tenant { Id = TenantId, Name = "FrozenHub QA", Subdomain = "frozenhub" },
            new Tenant { Id = OtherTenantId, Name = "Other QA", Subdomain = "other" });
        return db;
    }

    private static int _nextId = 1;

    private static void AddSale(AppDbContext db, int tenantId, string invoiceNo, bool deleted = false, bool finalized = true) =>
        db.Sales.Add(new Sale
        {
            Id = Interlocked.Increment(ref _nextId), TenantId = tenantId, OwnerId = tenantId, CreatedBy = 1,
            InvoiceNo = invoiceNo, InvoiceDate = Day, CreatedAt = Day, Subtotal = 10, GrandTotal = 10.5m,
            TotalAmount = 10.5m, IsDeleted = deleted, IsFinalized = finalized
        });

    private static void SetSeriesStart(AppDbContext db, int tenantId, string value) =>
        db.Settings.Add(new Setting { TenantId = tenantId, OwnerId = tenantId, Key = InvoiceNumberService.SeriesStartSettingKey, Value = value });

    private static void SeedProductionShape(AppDbContext db)
    {
        // Mirrors tenant 20 read-only evidence (2026-10-24): smoke invoice, 10-digit sequence, an early 0001.
        AddSale(db, TenantId, "0001", deleted: true);
        AddSale(db, TenantId, "FH-SMK-1791254849");
        AddSale(db, TenantId, "1791254858");
        AddSale(db, TenantId, "1791254859");
    }

    private static InvoiceNumberService Service(AppDbContext db) =>
        new(db, new ConfigurationBuilder().Build());

    [Fact]
    public async Task WithoutSeriesSetting_LegacyMaxPlusOneRuleIsUnchanged()
    {
        await using var db = NewDb();
        SeedProductionShape(db);
        await db.SaveChangesAsync();

        Assert.Equal("1791254860", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(TenantId));
        Assert.Equal("1791254860", await Service(db).GenerateNextInvoiceNumberAsync(TenantId));
    }

    [Fact]
    public async Task SeriesStart_IgnoresSmokeDigitsAndOutOfRangeLegacyNumbers()
    {
        await using var db = NewDb();
        SeedProductionShape(db);
        // Migrated Starplus numbers (2000-6889) stay below the new series.
        AddSale(db, TenantId, "2000");
        AddSale(db, TenantId, "6889");
        SetSeriesStart(db, TenantId, "7000");
        await db.SaveChangesAsync();

        Assert.Equal("7000", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(TenantId));
        Assert.Equal("7000", await Service(db).GenerateNextInvoiceNumberAsync(TenantId));
    }

    [Fact]
    public async Task SeriesStart_ContinuesAfterHighestIssuedNumberIncludingDeletedAndDrafts()
    {
        await using var db = NewDb();
        SeedProductionShape(db);
        SetSeriesStart(db, TenantId, "7000");
        AddSale(db, TenantId, "7000");
        AddSale(db, TenantId, "7001", deleted: true);
        AddSale(db, TenantId, "7002", finalized: false);
        await db.SaveChangesAsync();

        Assert.Equal("7003", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(TenantId));
    }

    [Fact]
    public async Task SeriesStart_AdvancesPastMigratedNumbersInsideTheSeries()
    {
        await using var db = NewDb();
        SetSeriesStart(db, TenantId, "7000");
        // If Starplus reaches 7000+ before cutover, imported numbers must push the series forward, never collide.
        AddSale(db, TenantId, "7004");
        await db.SaveChangesAsync();

        Assert.Equal("7005", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(TenantId));
    }

    [Fact]
    public async Task SeriesStart_IsTenantScoped()
    {
        await using var db = NewDb();
        SetSeriesStart(db, TenantId, "7000");
        AddSale(db, OtherTenantId, "7050");
        AddSale(db, OtherTenantId, "0009");
        await db.SaveChangesAsync();

        Assert.Equal("7000", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(TenantId));
        // The other tenant has no series setting, so it keeps the legacy max+1 rule over its own numbers only.
        Assert.Equal("7051", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(OtherTenantId));
    }

    [Theory]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("0")]
    [InlineData("-7000")]
    public async Task InvalidSeriesSetting_FallsBackToLegacyRule(string value)
    {
        await using var db = NewDb();
        SeedProductionShape(db);
        SetSeriesStart(db, TenantId, value);
        await db.SaveChangesAsync();

        Assert.Equal("1791254860", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(TenantId));
    }
}
