using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>INS-01: top sellers are ranked by an explicit metric, ignore deleted sales and other tenants, and say how they were derived.</summary>
public class RuleBasedInsightsPostgreSqlTests
{
    private static readonly DateTime Today = DateTime.UtcNow.Date;

    [SkippableFact]
    public async Task TopSellers_AreRankedByRevenue_IgnoringDeletedSalesAndOtherTenants()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options);
        db.SetRequestTenantScope(null, true);
        await PostgresTestSchema.EnsureCreatedAsync(db);

        var t = 3_000_000 + Random.Shared.Next(1, 100_000_000);
        db.Tenants.AddRange(
            new Tenant { Id = t, Name = "Synthetic insights", Subdomain = $"insights-{t}" },
            new Tenant { Id = t + 1, Name = "Other synthetic tenant", Subdomain = $"insights-other-{t}" });
        await db.SaveChangesAsync();
        db.Users.AddRange(
            new User { Id = t, TenantId = t, OwnerId = t, Name = "Fixture owner", Email = $"insights-{t}@example.test", PasswordHash = "fixture", Role = UserRole.Owner, CreatedAt = Today },
            new User { Id = t + 1, TenantId = t + 1, OwnerId = t + 1, Name = "Other owner", Email = $"insights-other-{t}@example.test", PasswordHash = "fixture", Role = UserRole.Owner, CreatedAt = Today });
        await db.SaveChangesAsync();

        Product P(int tenant, string sku, string name) => new()
        {
            TenantId = tenant, OwnerId = tenant, Sku = sku, NameEn = name, UnitType = "PCS", ConversionToBase = 1,
            CostPrice = 1, SellPrice = 2, StockQty = 50, ReorderLevel = 5, IsActive = true, CreatedAt = Today,
        };
        var many = P(t, $"MANY-{t}", "Many cheap units");
        var few = P(t, $"FEW-{t}", "Few dear units");
        var ghost = P(t, $"GHOST-{t}", "Only in a deleted sale");
        var foreign = P(t + 1, $"FOR-{t}", "Other tenant best seller");
        db.Products.AddRange(many, few, ghost, foreign);
        await db.SaveChangesAsync();

        Sale S(int tenant, string no, bool deleted) => new()
        {
            TenantId = tenant, OwnerId = tenant, CreatedBy = tenant, InvoiceNo = $"{no}-{t}", InvoiceDate = Today, CreatedAt = Today,
            GrandTotal = 1, TotalAmount = 1, PaymentStatus = SalePaymentStatus.Paid, IsDeleted = deleted,
        };
        var live = S(t, "LIVE", false);
        var deleted = S(t, "DEL", true);
        var other = S(t + 1, "OTH", false);
        db.Sales.AddRange(live, deleted, other);
        await db.SaveChangesAsync();

        SaleItem I(Sale sale, Product product, decimal qty, decimal price) => new()
        {
            SaleId = sale.Id, ProductId = product.Id, UnitType = "PCS", Qty = qty, UnitPrice = price, LineTotal = qty * price,
        };
        db.SaleItems.AddRange(
            I(live, many, 100, 1),      // 100 units, revenue 100
            I(live, few, 5, 50),        // 5 units, revenue 250  -> must rank first
            I(deleted, ghost, 1000, 10),// deleted sale, revenue 10000 -> must not appear
            I(other, foreign, 1000, 10));// other tenant
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        using var cache = new MemoryCache(new MemoryCacheOptions());
        var reports = new ReportService(db, null!, new SettingsService(db), null!, new SalesSchemaService(db), cache,
            NullLogger<ReportService>.Instance, new TimeZoneService(), new VatReturnReportService(db, NullLogger<VatReturnReportService>.Instance));

        var result = await reports.GetAISuggestionsAsync(t, 30);

        Assert.Equal(new[] { few.Id, many.Id }, result.TopSellers.Select(p => p.Id).ToArray());
        Assert.Equal(new[] { 250m, 100m }, result.TopSellerStats.Select(s => s.Revenue).ToArray());
        Assert.DoesNotContain(result.TopSellers, p => p.Id == ghost.Id || p.Id == foreign.Id);
        Assert.Equal("revenue", result.RankingBasis);
        Assert.Equal("rule-based", result.Method);
        Assert.Equal(30, result.PeriodDays);
    }
}
