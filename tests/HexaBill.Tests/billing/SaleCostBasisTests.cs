using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.Branches;
using HexaBill.Api.Modules.Products;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class SaleCostBasisTests
{
    [Fact]
    public async Task FinancialReportQueryFailure_PropagatesUnavailableInsteadOfEmptySuccess()
    {
        await using var db = Database();
        await db.DisposeAsync();
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var reports = new ReportService(db, null!, null!, null!, new Schema(), cache,
            NullLogger<ReportService>.Instance, new TimeZoneService());

        var products = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            reports.GetProductSalesReportAsync(10, DateTime.UtcNow.AddDays(-1), DateTime.UtcNow));
        var outstanding = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            reports.GetOutstandingCustomersAsync(10));

        Assert.Equal("Product sales report is unavailable. Please retry.", products.Message);
        Assert.Equal("Outstanding customer report is unavailable. Please retry.", outstanding.Message);
    }

    [Fact(DisplayName = "FIN11_ProductCostEdit_DoesNotRewriteSavedHistoricMargin")]
    public async Task ProductCostAndConversionEdit_DoesNotRewriteSavedProfit()
    {
        await using var db = Database();
        var date = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var product = Product();
        var line = Line();
        SaleCostBasis.Capture(line, product, 10, enabled: true);
        db.Products.Add(product);
        db.Sales.Add(new Sale { Id = 1, TenantId = 10, OwnerId = 10, InvoiceNo = "COST-1", InvoiceDate = date, GrandTotal = 1000 });
        db.SaleItems.Add(line);
        await db.SaveChangesAsync();
        product.CostPrice = 40;
        product.ConversionToBase = 24;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var reports = new ProfitService(db, null!, NullLogger<ProfitService>.Instance);
        var report = await reports.CalculateProfitAsync(10, date, date);
        var products = await reports.CalculateProductProfitAsync(10, date, date.AddDays(1));

        Assert.Equal(600m, report.CostOfGoodsSold);
        Assert.Equal(400m, report.GrossProfit);
        Assert.Equal(400m, Assert.Single(report.DailyProfit).Profit);
        Assert.Equal(600m, Assert.Single(products).TotalCost);
        Assert.Equal(0, report.EstimatedCostLineCount);
        Assert.Equal(0, products[0].EstimatedCostLineCount);
    }

    [Fact]
    public async Task LegacyReport_ExposesEstimatedCostInsteadOfBackfillingHistory()
    {
        await using var db = Database();
        var date = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        db.Products.Add(Product());
        db.Sales.Add(new Sale { Id = 1, TenantId = 10, OwnerId = 10, InvoiceNo = "LEGACY-1", InvoiceDate = date, GrandTotal = 1000 });
        db.SaleItems.Add(Line());
        await db.SaveChangesAsync();
        var report = await new ProfitService(db, null!, NullLogger<ProfitService>.Instance).CalculateProfitAsync(10, date, date);
        Assert.Equal(600m, report.CostOfGoodsSold);
        Assert.Equal(1, report.EstimatedCostLineCount);
        Assert.Equal(1, Assert.Single(report.DailyProfit).EstimatedCostLineCount);
        Assert.Null((await db.SaleItems.SingleAsync()).CostCapturedAt);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task DashboardBranchAndRoute_UseSavedCostAndExposeLegacyEstimates(bool captured)
    {
        await using var db = Database();
        var date = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var product = Product();
        var line = Line();
        SaleCostBasis.Capture(line, product, 10, captured);
        db.Products.Add(product);
        db.Branches.Add(new Branch { Id = 1, TenantId = 10, Name = "Cost branch" });
        db.Routes.Add(new HexaBill.Api.Models.Route { Id = 1, TenantId = 10, BranchId = 1, Name = "Cost route" });
        db.Sales.Add(new Sale { Id = 1, TenantId = 10, OwnerId = 10, BranchId = 1, RouteId = 1, InvoiceNo = "COST-1", InvoiceDate = date, GrandTotal = 1000 });
        db.SaleItems.Add(line);
        await db.SaveChangesAsync();
        product.CostPrice = 40;
        product.ConversionToBase = 24;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var schema = new Schema();
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var dashboard = new ReportService(db, null!, null!, null!, schema, cache,
            NullLogger<ReportService>.Instance, new TimeZoneService());
        var result = await dashboard.GetSummaryReportAsync(10, date, date, skipCache: true);
        var branch = await new BranchService(db, schema, null!, NullLogger<BranchService>.Instance).GetBranchSummaryAsync(1, 10, date, date);
        var route = await new RouteService(db, schema, new ConfigurationBuilder().Build(), NullLogger<RouteService>.Instance).GetRouteSummaryAsync(1, 10, date, date);
        var expectedCost = captured ? 600m : 1920m;
        var estimated = captured ? 0 : 1;
        Assert.Equal(expectedCost, result.CogsToday);
        Assert.Equal(estimated, result.EstimatedCostLineCount);
        Assert.Equal(expectedCost, branch!.CostOfGoodsSold);
        Assert.Equal(estimated, branch.EstimatedCostLineCount);
        Assert.Equal(expectedCost, Assert.Single(branch.Routes).CostOfGoodsSold);
        Assert.Equal(expectedCost, route!.CostOfGoodsSold);
        Assert.Equal(estimated, route.EstimatedCostLineCount);
        var productReport = Assert.Single(await dashboard.GetEnhancedProductSalesReportAsync(10, date, date.AddDays(1)));
        Assert.Equal(expectedCost, productReport.CostValue);
        Assert.Equal(estimated, productReport.EstimatedCostLineCount);
    }

    [Fact]
    public async Task BranchInvoiceWithoutRoute_StillContributesItsCost()
    {
        await using var db = Database();
        var date = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var product = Product();
        var line = Line();
        SaleCostBasis.Capture(line, product, 10, true);
        db.Products.Add(product);
        db.Branches.Add(new Branch { Id = 1, TenantId = 10, Name = "Cost branch" });
        db.Sales.Add(new Sale { Id = 1, TenantId = 10, OwnerId = 10, BranchId = 1, InvoiceNo = "NO-ROUTE", InvoiceDate = date, GrandTotal = 1000 });
        db.SaleItems.Add(line);
        await db.SaveChangesAsync();
        var branch = await new BranchService(db, new Schema(), null!, NullLogger<BranchService>.Instance).GetBranchSummaryAsync(1, 10, date, date);
        Assert.Equal(600m, branch!.CostOfGoodsSold);
        Assert.Equal(400m, branch.Profit);
        Assert.Empty(branch.Routes);
    }

    [Fact]
    public async Task UnassignedComparison_IncludesSavedCostInsteadOfTreatingSalesAsProfit()
    {
        await using var db = Database();
        var date = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var product = Product();
        var line = Line();
        SaleCostBasis.Capture(line, product, 10, true);
        db.Products.Add(product);
        db.Sales.Add(new Sale { Id = 1, TenantId = 10, OwnerId = 10, InvoiceNo = "UNASSIGNED", InvoiceDate = date, GrandTotal = 1000 });
        db.SaleItems.Add(line);
        await db.SaveChangesAsync();
        var result = await new BranchService(db, new Schema(), null!, NullLogger<BranchService>.Instance).GetUnassignedSalesSummaryAsync(10, date, date.AddDays(1));
        Assert.Equal(600m, result!.CostOfGoodsSold);
        Assert.Equal(400m, result.Profit);
        Assert.Equal(0, result.EstimatedCostLineCount);
    }

    [Fact]
    public async Task CorruptCost_DashboardDoesNotReturnSuccessfulZeroProfit()
    {
        await using var db = Database();
        var date = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var line = Line();
        line.UnitCostAtSale = 25;
        db.Products.Add(Product());
        db.Sales.Add(new Sale { Id = 1, TenantId = 10, OwnerId = 10, InvoiceNo = "BAD-COST", InvoiceDate = date, GrandTotal = 1000 });
        db.SaleItems.Add(line);
        await db.SaveChangesAsync();
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var reports = new ReportService(db, null!, null!, null!, new Schema(), cache, NullLogger<ReportService>.Instance, new TimeZoneService());
        await Assert.ThrowsAsync<InvalidOperationException>(() => reports.GetSummaryReportAsync(10, date, date, skipCache: true));
        await Assert.ThrowsAsync<InvalidOperationException>(() => reports.GetEnhancedProductSalesReportAsync(10, date, date.AddDays(1)));
    }

    [Fact]
    public async Task ProfitBasisVatCost_DoesNotChangeAfterProductEdit()
    {
        await using var db = Database();
        var date = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var product = Product();
        var line = Line();
        SaleCostBasis.Capture(line, product, 10, true);
        db.Tenants.Add(new Tenant { Id = 10, Name = "Cost workspace", Subdomain = "cost-workspace", VatCalculationBasis = VatCalculationBasis.ProfitBased });
        db.TenantVatBasisHistory.Add(new TenantVatBasisHistory { TenantId = 10, Basis = VatCalculationBasis.ProfitBased, EffectiveFrom = date.AddDays(-1), SetByUserId = 1, CreatedAt = date });
        db.Products.Add(product);
        db.Sales.Add(new Sale { Id = 1, TenantId = 10, OwnerId = 10, InvoiceNo = "VAT-COST", InvoiceDate = date, GrandTotal = 1000, Subtotal = 950, VatTotal = 50, VatScenario = "Standard" });
        db.SaleItems.Add(line);
        await db.SaveChangesAsync();
        var service = new VatReturnReportService(db, NullLogger<VatReturnReportService>.Instance);
        var before = await service.GetVatReturn201Async(10, date, date.AddDays(1));
        product.CostPrice = 40;
        product.ConversionToBase = 24;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var after = await service.GetVatReturn201Async(10, date, date.AddDays(1));
        Assert.Equal(600m, before.ProfitCogs);
        Assert.Equal(before.ProfitCogs, after.ProfitCogs);
        Assert.Equal(0, after.EstimatedCostLineCount);
        // This checks cost provenance only, not legal eligibility or statutory margin-tax arithmetic.
    }

    [Fact]
    public async Task SummaryFailure_ControllerReturnsErrorWithoutInventedFiguresOrInternalDetails()
    {
        var controller = new ReportsController(new FailedReports().Object, null!, null!, null!, null!, null!, null!, NullLogger<ReportsController>.Instance);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim("plat", "false"), new Claim("tid", "10"), new Claim(ClaimTypes.Role, "Owner"), new Claim(ClaimTypes.NameIdentifier, "1")
            }, "Test"))
        } };
        var response = await controller.GetSummaryReport();
        var result = Assert.IsType<ObjectResult>(response.Result);
        Assert.Equal(500, result.StatusCode);
        var body = Assert.IsType<ApiResponse<SummaryReportDto>>(result.Value);
        Assert.False(body.Success);
        Assert.Null(body.Data);
        Assert.DoesNotContain("PRIVATE_FAILURE", body.Message);
        Assert.True(body.Errors == null || body.Errors.Count == 0);
    }

    [Fact]
    public void InvoiceEditAfterFlagRollback_RetainsOriginalBasis()
    {
        var product = Product();
        var oldLine = Line();
        SaleCostBasis.Capture(oldLine, product, 10, true);
        product.CostPrice = 40;
        product.ConversionToBase = 24;
        var edited = Line();
        edited.Qty = 3;
        SaleCostBasis.Capture(edited, product, 10, false, [oldLine]);
        Assert.Equal(oldLine.CostCapturedAt, edited.CostCapturedAt);
        Assert.Equal(900m, SaleCostBasis.Calculate(edited));
    }

    [Fact]
    public void LegacyEditAndDisabledCapture_DoNotClaimNewHistoricalEvidence()
    {
        var edited = Line();
        SaleCostBasis.Capture(edited, Product(), 10, true, [Line()]);
        Assert.False(SaleCostBasis.HasSnapshot(edited));
        SaleCostBasis.Capture(edited, Product(), 10, false);
        Assert.False(SaleCostBasis.HasSnapshot(edited));
        Assert.False(TenantFeatureFlags.IsEnabled(null, TenantFeatureFlags.SaleCostSnapshots));
    }

    [Fact]
    public void ForeignProductAndAmbiguousOldLines_AreRejected()
    {
        Assert.Throws<InvalidOperationException>(() => SaleCostBasis.Capture(Line(), Product(), 20, true));
        var first = Line();
        var second = Line();
        SaleCostBasis.Capture(first, Product(), 10, true);
        var otherCost = Product();
        otherCost.CostPrice = 30;
        SaleCostBasis.Capture(second, otherCost, 10, true);
        Assert.Throws<InvalidOperationException>(() => SaleCostBasis.Capture(Line(), Product(), 10, true, [first, second]));
    }

    [Fact]
    public void ZeroCost_IsEvidenceButPartialSnapshotIsRejected()
    {
        var product = Product();
        product.CostPrice = 0;
        var line = Line();
        SaleCostBasis.Capture(line, product, 10, true);
        Assert.True(SaleCostBasis.HasSnapshot(line));
        Assert.Equal(0m, SaleCostBasis.Calculate(line));
        line.CostCapturedAt = null;
        Assert.Throws<InvalidOperationException>(() => SaleCostBasis.Calculate(line));
    }

    [Fact]
    public void DuplicateLinesWithSameCost_CanBeEditedDespiteDifferentCaptureInstants()
    {
        var first = Line();
        var second = Line();
        SaleCostBasis.Capture(first, Product(), 10, true);
        SaleCostBasis.Capture(second, Product(), 10, true);
        second.CostCapturedAt = first.CostCapturedAt!.Value.AddSeconds(1);
        var edited = Line();
        SaleCostBasis.Capture(edited, Product(), 10, false, [first, second]);
        Assert.Equal(600m, SaleCostBasis.Calculate(edited));
    }

    [Fact]
    public void PostgreSqlMigration_UsesNullableNumericAndUtcTimestampWithoutBackfill()
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=not_connected;Username=fixture;Password=fixture").Options);
        var migration = new HexaBill.Api.Migrations.AddSaleItemCostBasis();
        var sql = string.Join("\n", db.GetService<IMigrationsSqlGenerator>().Generate(migration.UpOperations).Select(c => c.CommandText));
        Assert.Contains("decimal(18,6)", sql);
        Assert.Contains("timestamp with time zone", sql);
        Assert.DoesNotContain("NOT NULL", sql);
        Assert.DoesNotContain("UPDATE", sql);
    }

    [Theory]
    [InlineData("cost")]
    [InlineData("conversion")]
    [InlineData("captured")]
    [InlineData("product")]
    public async Task SavedEvidence_CannotBeOverwritten(string change)
    {
        await using var db = Database();
        var line = Line();
        SaleCostBasis.Capture(line, Product(), 10, true);
        db.SaleItems.Add(line);
        await db.SaveChangesAsync();
        if (change == "cost") line.UnitCostAtSale = 99;
        if (change == "conversion") line.ConversionAtSale = 99;
        if (change == "captured") line.CostCapturedAt = null;
        if (change == "product") line.ProductId = 99;
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task AdditiveMigration_PreservesLegacyRowsAndAllowsOldWrites()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        await db.Database.OpenConnectionAsync();
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE SaleItems (Id INTEGER PRIMARY KEY, Qty decimal(18,2) NOT NULL); INSERT INTO SaleItems VALUES (1, 2);");
        var migration = new HexaBill.Api.Migrations.AddSaleItemCostBasis();
        var sql = db.GetService<IMigrationsSqlGenerator>().Generate(migration.UpOperations);
        foreach (var command in sql) await db.Database.ExecuteSqlRawAsync(command.CommandText);
        await db.Database.ExecuteSqlRawAsync("INSERT INTO SaleItems (Id, Qty) VALUES (2, 3);");
        var connection = db.Database.GetDbConnection();
        await using var read = connection.CreateCommand();
        read.CommandText = "SELECT COUNT(*) FROM SaleItems WHERE UnitCostAtSale IS NULL AND ConversionAtSale IS NULL AND CostCapturedAt IS NULL";
        Assert.Equal(2L, await read.ExecuteScalarAsync());
        Assert.Throws<NotSupportedException>(() => migration.DownOperations);
    }

    private static AppDbContext Database()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase("Cost_" + Guid.NewGuid()).Options);
        db.SetRequestTenantScope(10, false);
        return db;
    }
    private static Product Product() => new() { Id = 1, TenantId = 10, OwnerId = 10, NameEn = "Cost fixture", CostPrice = 25, ConversionToBase = 12 };
    private static SaleItem Line() => new() { Id = 1, SaleId = 1, ProductId = 1, UnitType = "CRTN", Qty = 2, LineTotal = 1000 };
    private sealed class Schema : ISalesSchemaService
    {
        public Task<bool> SalesHasBranchIdAndRouteIdAsync() => Task.FromResult(true);
        public void ClearColumnCheckCache() { }
    }
    private sealed class FailedReports : InterfaceStub<IReportService>
    {
        public FailedReports() => When(nameof(IReportService.GetSummaryReportAsync), _ => Task.FromException<SummaryReportDto>(new InvalidOperationException("PRIVATE_FAILURE")));
    }
}
