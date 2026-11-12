using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>
/// Profit &amp; Margin Inspector lock. Live FrozenHub (tenant 20) invoice 7149 on 2026-11-12 (Dubai):
/// GrandTotal 1,465.00, VAT 69.76, round-off 0.06, COGS on quantities sold 1,176.66 -> profit 218.58.
/// (265.74 is sales minus TOTAL purchases 1,129.50, not COGS; the dashboard VAT 13.28 is output 69.76 minus input 56.48.)
/// </summary>
public class ProfitBreakdownTests
{
    private const int Tenant = 20;
    private static readonly DateTime Day = new(2026, 11, 12, 12, 0, 0, DateTimeKind.Utc); // 16:00 Dubai
    private static readonly DateTime BusinessDay = new(2026, 11, 12);

    private sealed class Schema : ISalesSchemaService
    {
        public Task<bool> SalesHasBranchIdAndRouteIdAsync() => Task.FromResult(true);
        public void ClearColumnCheckCache() { }
    }

    private static AppDbContext NewDb()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase("ProfitBreakdown_" + Guid.NewGuid()).Options);
        db.SetRequestTenantScope(Tenant, false);
        return db;
    }

    private static void SeedLiveInvoice(AppDbContext db)
    {
        var lines = new (int Id, string Name, string Unit, decimal Qty, decimal Price, decimal Vat, decimal Cost)[]
        {
            (1, "TRIPE", "KG", 10m, 22m, 11.00m, 19m), (2, "MUTTON", "KG", 14.38m, 36m, 25.88m, 32m),
            (3, "CHICKEN", "CRTN", 1m, 125m, 6.25m, 113m), (4, "HAMOOR", "CRTN", 1m, 106m, 5.30m, 89.5m),
            (5, "BREAST", "CRTN", 0.5m, 181m, 4.53m, 120m), (6, "SHEEP FEET", "KG", 12m, 28m, 16.80m, 22m)
        };
        db.Customers.Add(new Customer { Id = 1, TenantId = Tenant, OwnerId = Tenant, Name = "KHAN DARBAR RESTAURANT" });
        db.Sales.Add(new Sale
        {
            Id = 1, TenantId = Tenant, OwnerId = Tenant, CustomerId = 1, InvoiceNo = "7149", InvoiceDate = Day, CreatedAt = Day,
            Subtotal = 1395.18m, RoundOff = 0.06m, VatTotal = 69.76m, GrandTotal = 1465.00m, TotalAmount = 1465.00m
        });
        foreach (var l in lines)
        {
            var product = new Product { Id = l.Id, TenantId = Tenant, OwnerId = Tenant, NameEn = l.Name, CostPrice = l.Cost, ConversionToBase = 1 };
            var item = new SaleItem { Id = l.Id, SaleId = 1, ProductId = l.Id, UnitType = l.Unit, Qty = l.Qty, UnitPrice = l.Price, VatAmount = l.Vat, LineTotal = Math.Round(l.Qty * l.Price + l.Vat, 2) };
            SaleCostBasis.Capture(item, product, Tenant, enabled: true);
            db.Products.Add(product);
            db.SaleItems.Add(item);
        }
        db.SaveChanges();
        db.ChangeTracker.Clear();
    }

    [Fact]
    public async Task Breakdown_MatchesDashboardAndProfitReport_To_TheCent()
    {
        await using var db = NewDb();
        SeedLiveInvoice(db);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var dashboard = new ReportService(db, null!, null!, null!, new Schema(), cache,
            NullLogger<ReportService>.Instance, new TimeZoneService(), new VatReturnReportService(db, NullLogger<VatReturnReportService>.Instance));
        var summary = await dashboard.GetSummaryReportAsync(Tenant, BusinessDay, BusinessDay, skipCache: true);
        var report = await new ProfitService(db, new Schema(), NullLogger<ProfitService>.Instance).CalculateProfitAsync(Tenant, Day, Day);
        var breakdown = await new ProfitBreakdownService(db).GetBreakdownAsync(Tenant, BusinessDay, BusinessDay, null, null);

        Assert.Equal(218.58m, summary.ProfitToday);
        Assert.Equal(summary.ProfitToday, breakdown.Summary.NetProfit);
        Assert.Equal(report.GrossProfit, breakdown.Summary.GrossProfit);
        Assert.Equal(report.NetProfit, breakdown.Summary.NetProfit);
        Assert.Equal(1465.00m, breakdown.Summary.GrossSalesInclVat);
        Assert.Equal(69.76m, breakdown.Summary.OutputVatExcluded);
        Assert.Equal(1395.24m, breakdown.Summary.NetSalesExclVat);
        Assert.Equal(1176.66m, breakdown.Summary.TotalCogsExclVat);
        Assert.Equal(10.93m, breakdown.Summary.VatOnNetProfit5Percent); // 5% x 218.58
        Assert.Equal(1, breakdown.Summary.InvoiceCount);

        var invoice = Assert.Single(breakdown.Invoices);
        Assert.Equal("KHAN DARBAR RESTAURANT", invoice.CustomerName);
        Assert.Equal(1395.24m, invoice.NetSalesExclVat);
        Assert.Equal(6, invoice.Items.Count);
        Assert.Equal(1395.24m, invoice.Items.Sum(i => i.LineNetRevenue), 1);
        Assert.Equal(1176.66m, invoice.Items.Sum(i => i.LineTotalCost), 1);
        Assert.False(invoice.HasMarginWarning);
        var day = Assert.Single(breakdown.DailyTrend);
        Assert.Equal("2026-11-12", day.Date);
        Assert.Equal(218.58m, day.NetProfit);
    }

    [Fact]
    public async Task Breakdown_FlagsLowMargin_Loss_AndMissingCost()
    {
        await using var db = NewDb();
        var product = new Product { Id = 1, TenantId = Tenant, OwnerId = Tenant, NameEn = "Thin", CostPrice = 99m, ConversionToBase = 1 };
        var free = new Product { Id = 2, TenantId = Tenant, OwnerId = Tenant, NameEn = "Free", CostPrice = 0m, ConversionToBase = 1 };
        db.Products.AddRange(product, free);
        void Bill(int id, string no, Product p, decimal net)
        {
            db.Sales.Add(new Sale { Id = id, TenantId = Tenant, OwnerId = Tenant, InvoiceNo = no, InvoiceDate = Day, CreatedAt = Day, Subtotal = net, GrandTotal = net, TotalAmount = net });
            var item = new SaleItem { Id = id, SaleId = id, ProductId = p.Id, UnitType = "KG", Qty = 1, UnitPrice = net, LineTotal = net };
            SaleCostBasis.Capture(item, p, Tenant, enabled: true);
            db.SaleItems.Add(item);
        }
        Bill(1, "LOW", product, 100m);   // 1% margin
        Bill(2, "LOSS", product, 90m);   // -9
        Bill(3, "NOCOST", free, 50m);
        db.SaveChanges(); db.ChangeTracker.Clear();

        var b = await new ProfitBreakdownService(db).GetBreakdownAsync(Tenant, BusinessDay, BusinessDay, null, null);
        Assert.Equal(3, b.Summary.AnomalousMarginCount);
        Assert.StartsWith("Low margin", b.Invoices.Single(i => i.InvoiceNo == "LOW").WarningReason);
        Assert.Equal("Purchase cost higher than sale price", b.Invoices.Single(i => i.InvoiceNo == "LOSS").WarningReason);
        Assert.Equal("Missing cost snapshot", b.Invoices.Single(i => i.InvoiceNo == "NOCOST").WarningReason);
        var filtered = await new ProfitBreakdownService(db).GetBreakdownAsync(Tenant, BusinessDay, BusinessDay, null, "loss");
        Assert.Equal("LOSS", Assert.Single(filtered.Invoices).InvoiceNo);
        Assert.Equal(3, filtered.Summary.InvoiceCount); // summary never narrows with search
    }

    [Fact]
    public async Task PurchaseAfterSale_SameDubaiDay_RecostsEarlierSale_WithCartonConversion_ExcludingVat()
    {
        await using var db = NewDb();
        // Carton of 12 kg. Sale punched at 03:14 UTC with a stale master cost of 5.00 per kg.
        var product = new Product { Id = 1, TenantId = Tenant, OwnerId = Tenant, NameEn = "Carton goods", CostPrice = 5m, ConversionToBase = 12 };
        var earlySale = new Sale { Id = 1, TenantId = Tenant, OwnerId = Tenant, InvoiceNo = "A", InvoiceDate = Day.AddHours(-9), CreatedAt = Day.AddHours(-9), Subtotal = 200m, GrandTotal = 210m, VatTotal = 10m };
        var otherDaySale = new Sale { Id = 2, TenantId = Tenant, OwnerId = Tenant, InvoiceNo = "B", InvoiceDate = Day.AddDays(-1), CreatedAt = Day.AddDays(-1), Subtotal = 200m, GrandTotal = 210m, VatTotal = 10m };
        var lateSale = new Sale { Id = 3, TenantId = Tenant, OwnerId = Tenant, InvoiceNo = "C", InvoiceDate = Day.AddHours(2), CreatedAt = Day.AddHours(2), Subtotal = 200m, GrandTotal = 210m, VatTotal = 10m };
        db.Products.Add(product); db.Sales.AddRange(earlySale, otherDaySale, lateSale);
        foreach (var s in new[] { earlySale, otherDaySale, lateSale })
        {
            var item = new SaleItem { Id = s.Id, SaleId = s.Id, ProductId = 1, UnitType = "CRTN", Qty = 1, UnitPrice = 200m, LineTotal = 210m, VatAmount = 10m };
            SaleCostBasis.Capture(item, product, Tenant, enabled: true);
            db.SaleItems.Add(item);
        }
        // Purchase entered at 05:00 UTC for the same Dubai day: 126.00 per carton INCLUDING 5% VAT -> 120.00 excl. VAT -> 10.00 per kg.
        var purchase = new Purchase { Id = 1, TenantId = Tenant, OwnerId = Tenant, InvoiceNo = "P1", PurchaseDate = Day.Date, CreatedAt = Day.AddHours(-7) };
        var pItem = new PurchaseItem { Id = 1, PurchaseId = 1, ProductId = 1, UnitType = "CRTN", Qty = 1, UnitCost = 126m, UnitCostExclVat = 120m, VatAmount = 6m, LineTotal = 126m, ConversionAtPurchase = 12m };
        db.Purchases.Add(purchase); db.PurchaseItems.Add(pItem);
        db.SaveChanges(); db.ChangeTracker.Clear();

        var updated = await SaleCostSync.ApplyPurchaseAsync(db, Tenant, purchase, new[] { pItem });
        Assert.Equal(1, updated);
        db.ChangeTracker.Clear();
        var early = await db.SaleItems.SingleAsync(i => i.SaleId == 1);
        Assert.Equal(10m, early.UnitCostAtSale);
        Assert.Equal(120m, SaleCostBasis.Calculate(await db.SaleItems.Include(i => i.Product).SingleAsync(i => i.SaleId == 1))); // 1 ctn x 12 x 10
        Assert.Equal(5m, (await db.SaleItems.SingleAsync(i => i.SaleId == 2)).UnitCostAtSale); // other business day untouched
        Assert.Equal(5m, (await db.SaleItems.SingleAsync(i => i.SaleId == 3)).UnitCostAtSale); // sold after the purchase was entered

        // The inspector now names the purchase as the cost source for the re-costed line.
        var b = await new ProfitBreakdownService(db).GetBreakdownAsync(Tenant, BusinessDay, BusinessDay, null, null);
        Assert.Equal("Purchase #P1 (12/11/2026)", Assert.Single(b.Invoices.Single(i => i.InvoiceNo == "A").Items).CostSource);
    }

    [Fact]
    public async Task RecalculateCosts_FixesDrift_AndReportsBeforeAfter()
    {
        await using var db = NewDb();
        var product = new Product { Id = 1, TenantId = Tenant, OwnerId = Tenant, NameEn = "Drift", CostPrice = 8m, ConversionToBase = 1 };
        db.Products.Add(product);
        db.Sales.Add(new Sale { Id = 1, TenantId = Tenant, OwnerId = Tenant, InvoiceNo = "D", InvoiceDate = Day, CreatedAt = Day, Subtotal = 100m, GrandTotal = 100m });
        var item = new SaleItem { Id = 1, SaleId = 1, ProductId = 1, UnitType = "KG", Qty = 10, UnitPrice = 10m, LineTotal = 100m };
        SaleCostBasis.Capture(item, product, Tenant, enabled: true); // stale 8.00
        db.SaleItems.Add(item);
        db.Purchases.Add(new Purchase { Id = 1, TenantId = Tenant, OwnerId = Tenant, InvoiceNo = "P9", PurchaseDate = Day.Date, CreatedAt = Day });
        db.PurchaseItems.Add(new PurchaseItem { Id = 1, PurchaseId = 1, ProductId = 1, UnitType = "KG", Qty = 10, UnitCost = 6.3m, UnitCostExclVat = 6m, ConversionAtPurchase = 1m, LineTotal = 63m });
        db.SaveChanges(); db.ChangeTracker.Clear();

        var result = await new ProfitBreakdownService(db).RecalculateCostsAsync(Tenant, BusinessDay, BusinessDay, 1);
        Assert.Equal(1, result.LinesUpdated);
        Assert.Equal(80m, result.CogsBefore);
        Assert.Equal(60m, result.CogsAfter);
        var again = await new ProfitBreakdownService(db).RecalculateCostsAsync(Tenant, BusinessDay, BusinessDay, 1);
        Assert.Equal(0, again.LinesUpdated); // idempotent
    }
}
