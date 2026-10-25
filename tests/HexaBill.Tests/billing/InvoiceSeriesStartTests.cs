using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
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
    [InlineData("-7000")]
    public async Task InvalidSeriesSetting_FallsBackToLegacyRule(string value)
    {
        await using var db = NewDb();
        SeedProductionShape(db);
        SetSeriesStart(db, TenantId, value);
        await db.SaveChangesAsync();

        Assert.Equal("1791254860", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(TenantId));
    }

    [Fact]
    public async Task ManualNumber_InSeriesTenant_RefusesStarplusRangeAndReusedNumbersWithReasons()
    {
        await using var db = NewDb();
        SeedProductionShape(db);
        SetSeriesStart(db, TenantId, "7000");
        AddSale(db, TenantId, "7000");
        AddSale(db, TenantId, "7001", deleted: true);
        await db.SaveChangesAsync();
        var service = Service(db);

        Assert.Contains("below 7000", await service.GetManualInvoiceNumberProblemAsync("6500", TenantId));
        Assert.Contains("already issued", await service.GetManualInvoiceNumberProblemAsync("7000", TenantId));
        // A deleted/voided invoice's number is never handed out again.
        Assert.Contains("already issued", await service.GetManualInvoiceNumberProblemAsync("7001", TenantId));
        Assert.Contains("digits only", await service.GetManualInvoiceNumberProblemAsync("FH-7002", TenantId));
        Assert.Null(await service.GetManualInvoiceNumberProblemAsync("7002", TenantId));
        Assert.Null(await service.GetManualInvoiceNumberProblemAsync("7050", TenantId));
        Assert.True(await service.ValidateInvoiceNumberAsync("7002", TenantId));
        Assert.False(await service.ValidateInvoiceNumberAsync("6500", TenantId));
    }

    [Fact]
    public async Task ManualNumber_WithoutSeries_KeepsLegacyRules()
    {
        await using var db = NewDb();
        AddSale(db, OtherTenantId, "1000");
        AddSale(db, OtherTenantId, "1001", deleted: true);
        await db.SaveChangesAsync();
        var service = Service(db);

        Assert.Contains("already used", await service.GetManualInvoiceNumberProblemAsync("1000", OtherTenantId));
        // A deleted invoice's number is not reusable either (no renumbering, no duplicate on paper).
        Assert.Contains("already used", await service.GetManualInvoiceNumberProblemAsync("1001", OtherTenantId));
        Assert.Null(await service.GetManualInvoiceNumberProblemAsync("0500", OtherTenantId));
    }

    [Fact]
    public async Task OwnerSetsSeriesStartInSettings_ValidatedAndCannotBeRemovedOnceUsed()
    {
        await using var db = NewDb();
        SeedProductionShape(db);
        await db.SaveChangesAsync();
        var settings = new SettingsService(db);

        await Assert.ThrowsAsync<ArgumentException>(() => settings.UpdateOwnerSettingsBulkAsync(TenantId, new() { [InvoiceNumberService.SeriesStartSettingKey] = "abc" }));
        await Assert.ThrowsAsync<ArgumentException>(() => settings.UpdateOwnerSettingsBulkAsync(TenantId, new() { [InvoiceNumberService.SeriesStartSettingKey] = "-1" }));
        await settings.UpdateOwnerSettingsBulkAsync(TenantId, new() { [InvoiceNumberService.SeriesStartSettingKey] = " 7000 " });
        Assert.Equal("7000", await settings.GetSettingValueAsync(TenantId, InvoiceNumberService.SeriesStartSettingKey));
        Assert.Equal("7000", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(TenantId));

        AddSale(db, TenantId, "7000");
        await db.SaveChangesAsync();
        var error = await Assert.ThrowsAsync<ArgumentException>(() => settings.UpdateOwnerSettingsBulkAsync(TenantId, new() { [InvoiceNumberService.SeriesStartSettingKey] = "" }));
        Assert.Contains("cannot be removed", error.Message);
        Assert.Equal("7001", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(TenantId));
    }

    [Fact]
    public async Task Legacy_IgnoresDigitsEmbeddedInNonNumericReferences()
    {
        await using var db = NewDb();
        AddSale(db, OtherTenantId, "0041");
        AddSale(db, OtherTenantId, "FH-SMK-1791254849");
        AddSale(db, OtherTenantId, "INV-2026-0005");
        await db.SaveChangesAsync();

        Assert.Equal("0042", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(OtherTenantId));
        Assert.Equal("0042", await Service(db).GenerateNextInvoiceNumberAsync(OtherTenantId));
    }

    [Fact]
    public async Task Legacy_DoesNotHandOutADeletedInvoicesNumber()
    {
        await using var db = NewDb();
        AddSale(db, OtherTenantId, "0041");
        AddSale(db, OtherTenantId, "0042", deleted: true);
        await db.SaveChangesAsync();

        Assert.Equal("0043", await Service(db).GenerateNextInvoiceNumberAsync(OtherTenantId));
    }

    [Fact]
    public async Task NumberWidth_FiveDigitsPerTenant_OtherTenantsUnchanged()
    {
        await using var db = NewDb();
        db.Settings.Add(new Setting { TenantId = OtherTenantId, OwnerId = OtherTenantId, Key = InvoiceNumberService.NumberWidthSettingKey, Value = "5" });
        AddSale(db, TenantId, "0007");
        await db.SaveChangesAsync();

        Assert.Equal("00001", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(OtherTenantId));
        Assert.Equal("00001", await Service(db).GenerateNextInvoiceNumberAsync(OtherTenantId));
        Assert.Equal("0008", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(TenantId));
    }

    [Theory]
    [InlineData("3")]
    [InlineData("10")]
    [InlineData("abc")]
    public async Task NumberWidth_InvalidValueKeepsFourDigits(string value)
    {
        await using var db = NewDb();
        db.Settings.Add(new Setting { TenantId = OtherTenantId, OwnerId = OtherTenantId, Key = InvoiceNumberService.NumberWidthSettingKey, Value = value });
        await db.SaveChangesAsync();

        Assert.Equal("0001", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(OtherTenantId));
    }

    // P0-NUM-001: FrozenHub 2 / Gulf Harvest want a literal first invoice 00000 (width 5, start 0).
    private static void SetWidth(AppDbContext db, int tenantId, string value) =>
        db.Settings.Add(new Setting { TenantId = tenantId, OwnerId = tenantId, Key = InvoiceNumberService.NumberWidthSettingKey, Value = value });

    [Fact]
    public async Task SeriesStartZero_FirstNumberIsLiteral00000_ThenSecondIs00001()
    {
        await using var db = NewDb();
        SetWidth(db, OtherTenantId, "5");
        SetSeriesStart(db, OtherTenantId, "0");
        await db.SaveChangesAsync();

        Assert.Equal("00000", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(OtherTenantId));
        Assert.Equal("00000", await Service(db).GenerateNextInvoiceNumberAsync(OtherTenantId));
        AddSale(db, OtherTenantId, "00000");
        await db.SaveChangesAsync();
        Assert.Equal("00001", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(OtherTenantId));
        Assert.Equal("00001", await Service(db).GenerateNextInvoiceNumberAsync(OtherTenantId));
    }

    [Fact]
    public async Task SeriesStartZero_DeletedLiteral00000_IsNeverReissued()
    {
        await using var db = NewDb();
        SetWidth(db, OtherTenantId, "5");
        SetSeriesStart(db, OtherTenantId, "0");
        AddSale(db, OtherTenantId, "00000", deleted: true);
        await db.SaveChangesAsync();

        Assert.Equal("00001", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(OtherTenantId));
    }

    [Fact]
    public async Task SeriesStartZero_ExistingTenantWith0001_Continues()
    {
        await using var db = NewDb();
        SetSeriesStart(db, OtherTenantId, "0");
        AddSale(db, OtherTenantId, "0001");
        await db.SaveChangesAsync();

        Assert.Equal("0002", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(OtherTenantId));
    }

    [Fact]
    public async Task SeriesStartZero_IsAcceptedBySettings_AndStart7000StillWorks()
    {
        await using var db = NewDb();
        SetWidth(db, OtherTenantId, "5");
        await db.SaveChangesAsync();
        var settings = new SettingsService(db);

        await settings.UpdateOwnerSettingsBulkAsync(OtherTenantId, new() { [InvoiceNumberService.SeriesStartSettingKey] = "0" });
        Assert.Equal("0", await settings.GetSettingValueAsync(OtherTenantId, InvoiceNumberService.SeriesStartSettingKey));
        Assert.Equal("00000", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(OtherTenantId));

        await settings.UpdateOwnerSettingsBulkAsync(TenantId, new() { [InvoiceNumberService.SeriesStartSettingKey] = "7000" });
        Assert.Equal("7000", await Service(db).GenerateNextInvoiceNumberInTransactionAsync(TenantId));
    }

    [Fact]
    public async Task SeriesStartZero_CannotBeRemovedOnceUsed()
    {
        await using var db = NewDb();
        SetSeriesStart(db, OtherTenantId, "0");
        AddSale(db, OtherTenantId, "00000");
        await db.SaveChangesAsync();
        var settings = new SettingsService(db);

        var error = await Assert.ThrowsAsync<ArgumentException>(() => settings.UpdateOwnerSettingsBulkAsync(OtherTenantId, new() { [InvoiceNumberService.SeriesStartSettingKey] = "" }));
        Assert.Contains("cannot be removed", error.Message);
    }
}
