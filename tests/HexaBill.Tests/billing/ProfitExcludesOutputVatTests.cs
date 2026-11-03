using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Branches;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>
/// PROFIT-2 lock. Live FrozenHub (tenant 20) on 2026-11-03 before invoice 7043: GrandTotal 16,598.00, output VAT 790.55,
/// COGS 15,035.80. The dashboard showed PROFIT TODAY 1,562.20 because output VAT was counted as profit.
/// Gross profit must be 16,598.00 - 790.55 - 15,035.80 = 771.65 on every profit surface.
/// </summary>
public class ProfitExcludesOutputVatTests
{
    private const decimal Grand = 16598.00m;
    private const decimal Vat = 790.55m;
    private const decimal Cogs = 15035.80m;
    private const decimal Expected = 771.65m;
    private static readonly DateTime Day = new(2026, 11, 3, 6, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void ProfitMath_ExcludesOutputVat_LiveFrozenHubDay()
    {
        Assert.Equal(Expected, ProfitMath.GrossProfit(Grand, Vat, 0m, 0m, Cogs));
        Assert.NotEqual(1562.20m, ProfitMath.GrossProfit(Grand, Vat, 0m, 0m, Cogs));
        // A 105.00 return (5.00 VAT) removes 100.00 of revenue, not 105.00.
        Assert.Equal(Expected - 100m, ProfitMath.GrossProfit(Grand, Vat, 105m, 5m, Cogs));
    }

    [Fact]
    public async Task Dashboard_ProfitReport_ProductAndBranchRoute_AllExcludeOutputVat()
    {
        await using var db = Seed(withReturn: false);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var schema = new Schema();
        var dashboard = new ReportService(db, null!, null!, null!, schema, cache,
            NullLogger<ReportService>.Instance, new TimeZoneService(), new VatReturnReportService(db, NullLogger<VatReturnReportService>.Instance));

        var summary = await dashboard.GetSummaryReportAsync(10, Day, Day, skipCache: true);
        Assert.Equal(Cogs, summary.CogsToday);
        Assert.Equal(Grand, summary.SalesToday);       // the SALES card still shows what customers owe, incl. VAT
        Assert.Equal(Expected, summary.ProfitToday);   // was 1,562.20

        var report = await new ProfitService(db, schema, NullLogger<ProfitService>.Instance).CalculateProfitAsync(10, Day, Day);
        Assert.Equal(Expected, report.GrossProfit);
        Assert.Equal(Expected, report.NetProfit);
        Assert.Equal(Expected, Assert.Single(report.DailyProfit).Profit);

        var products = await new ProfitService(db, schema, NullLogger<ProfitService>.Instance).CalculateProductProfitAsync(10, Day.AddHours(-6), Day.AddDays(1));
        Assert.Equal(Expected, Assert.Single(products).Profit);
        var productReport = Assert.Single(await dashboard.GetEnhancedProductSalesReportAsync(10, Day.AddHours(-6), Day.AddDays(1)));
        Assert.Equal(Expected, productReport.GrossProfit);

        var branch = await new BranchService(db, schema, null!, NullLogger<BranchService>.Instance).GetBranchSummaryAsync(1, 10, Day, Day);
        Assert.Equal(Expected, branch!.Profit);
        Assert.Equal(Expected, Assert.Single(branch.Routes).Profit);
        var route = await new RouteService(db, schema, new ConfigurationBuilder().Build(), NullLogger<RouteService>.Instance).GetRouteSummaryAsync(1, 10, Day, Day);
        Assert.Equal(Expected, route!.Profit);
    }

    [Fact]
    public async Task Dashboard_ReturnRemovesOnlyItsNetOfVatRevenue()
    {
        await using var db = Seed(withReturn: true);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var dashboard = new ReportService(db, null!, null!, null!, new Schema(), cache,
            NullLogger<ReportService>.Instance, new TimeZoneService(), new VatReturnReportService(db, NullLogger<VatReturnReportService>.Instance));
        var summary = await dashboard.GetSummaryReportAsync(10, Day, Day, skipCache: true);
        Assert.Equal(Expected - 100m, summary.ProfitToday);
    }

    private static AppDbContext Seed(bool withReturn)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase("ProfitVat_" + Guid.NewGuid()).Options);
        db.SetRequestTenantScope(10, false);
        var product = new Product { Id = 1, TenantId = 10, OwnerId = 10, NameEn = "Day total", CostPrice = Cogs, ConversionToBase = 1 };
        var line = new SaleItem { Id = 1, SaleId = 1, ProductId = 1, UnitType = "CRTN", Qty = 1, UnitPrice = Grand - Vat, LineTotal = Grand, VatAmount = Vat };
        SaleCostBasis.Capture(line, product, 10, enabled: true);
        db.Products.Add(product);
        db.Branches.Add(new Branch { Id = 1, TenantId = 10, Name = "Main" });
        db.Routes.Add(new HexaBill.Api.Models.Route { Id = 1, TenantId = 10, BranchId = 1, Name = "Route" });
        db.Sales.Add(new Sale
        {
            Id = 1, TenantId = 10, OwnerId = 10, BranchId = 1, RouteId = 1, InvoiceNo = "7028-7042", InvoiceDate = Day,
            Subtotal = Grand - Vat, VatTotal = Vat, GrandTotal = Grand, TotalAmount = Grand
        });
        db.SaleItems.Add(line);
        if (withReturn)
            db.SaleReturns.Add(new SaleReturn
            {
                Id = 1, TenantId = 10, OwnerId = 10, SaleId = 1, ReturnNo = "RET-1", ReturnDate = Day,
                Subtotal = 100m, VatTotal = 5m, GrandTotal = 105m, Status = ReturnStatus.Approved
            });
        db.SaveChanges();
        db.ChangeTracker.Clear();
        return db;
    }

    private sealed class Schema : ISalesSchemaService
    {
        public Task<bool> SalesHasBranchIdAndRouteIdAsync() => Task.FromResult(true);
        public void ClearColumnCheckCache() { }
    }
}
