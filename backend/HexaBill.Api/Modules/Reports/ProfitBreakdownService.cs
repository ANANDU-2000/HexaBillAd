/*
 * Purpose: Profit & Margin Inspector. One authoritative profit calculation with invoice -> line drill-down.
 * Formula (same as dashboard "Profit Today", ProfitMath and the profit-based VAT estimate):
 *   Net sales excl. VAT = SUM(Sale.GrandTotal - Sale.VatTotal)   (= Subtotal - Discount + RoundOff)
 *   COGS                = SUM(SaleCostBasis.Calculate(line))     (Qty x ConversionAtSale x UnitCostAtSale, VAT-exclusive)
 *   Gross profit        = Net sales - Returns excl. VAT - COGS
 *   Net profit          = Gross profit - Approved expenses
 *   5% profit VAT       = max(0, round(Net profit x 5%, 2))   (informational estimate, not a filing figure)
 * Business days are Asia/Dubai (BusinessDateRange).
 */
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Purchases;
using HexaBill.Api.Modules.Sales;

namespace HexaBill.Api.Modules.Reports
{
    public class ProfitBreakdownDto
    {
        public string FromDate { get; set; } = "";
        public string ToDate { get; set; } = "";
        public ProfitBreakdownSummaryDto Summary { get; set; } = new();
        public List<ProfitBreakdownDayDto> DailyTrend { get; set; } = new();
        public List<ProfitBreakdownInvoiceDto> Invoices { get; set; } = new();
        public List<string> Notes { get; set; } = new();
    }

    public class ProfitBreakdownSummaryDto
    {
        public decimal GrossSalesInclVat { get; set; }
        public decimal OutputVatExcluded { get; set; }
        public decimal DiscountsAndRoundOff { get; set; }
        public decimal ReturnsExclVat { get; set; }
        public decimal NetSalesExclVat { get; set; }
        public decimal TotalCogsExclVat { get; set; }
        public decimal GrossProfit { get; set; }
        public decimal GrossMarginPercent { get; set; }
        public decimal TotalExpenses { get; set; }
        public decimal NetProfit { get; set; }
        public decimal NetMarginPercent { get; set; }
        public decimal VatOnNetProfit5Percent { get; set; }
        public int InvoiceCount { get; set; }
        public int AnomalousMarginCount { get; set; }
    }

    public class ProfitBreakdownDayDto
    {
        public string Date { get; set; } = "";
        public decimal NetSales { get; set; }
        public decimal Cogs { get; set; }
        public decimal GrossProfit { get; set; }
        public decimal Expenses { get; set; }
        public decimal NetProfit { get; set; }
        public decimal MarginPercent { get; set; }
    }

    public class ProfitBreakdownInvoiceDto
    {
        public int SaleId { get; set; }
        public string InvoiceNo { get; set; } = "";
        public DateTime InvoiceDate { get; set; }
        public string InvoiceDateDubai { get; set; } = "";
        public string CustomerName { get; set; } = "";
        public decimal NetSalesExclVat { get; set; }
        public decimal Discount { get; set; }
        public decimal TotalCost { get; set; }
        public decimal GrossProfit { get; set; }
        public decimal MarginPercent { get; set; }
        public bool HasMarginWarning { get; set; }
        public string? WarningReason { get; set; }
        public List<ProfitBreakdownItemDto> Items { get; set; } = new();
    }

    public class ProfitBreakdownItemDto
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; } = "";
        public string Unit { get; set; } = "";
        public decimal Qty { get; set; }
        public decimal SaleUnitPriceExclVat { get; set; }
        public decimal LineNetRevenue { get; set; }
        public decimal PurchaseUnitCostExclVat { get; set; }
        public decimal LineTotalCost { get; set; }
        public string CostSource { get; set; } = "";
        public bool CostDiffersFromLatestPurchase { get; set; }
        public decimal? LatestPurchaseUnitCostExclVat { get; set; }
        public decimal LineProfit { get; set; }
        public decimal LineMarginPercent { get; set; }
    }

    public class RecalculateCostsResultDto
    {
        public int LinesChecked { get; set; }
        public int LinesUpdated { get; set; }
        public decimal CogsBefore { get; set; }
        public decimal CogsAfter { get; set; }
    }

    public interface IProfitBreakdownService
    {
        Task<ProfitBreakdownDto> GetBreakdownAsync(int tenantId, DateTime fromDate, DateTime toDate, int? branchId, string? search);
        Task<RecalculateCostsResultDto> RecalculateCostsAsync(int tenantId, DateTime fromDate, DateTime toDate, int userId);
    }

    public class ProfitBreakdownService : IProfitBreakdownService
    {
        public const decimal LowMarginPercent = 3m;
        public const decimal ProfitVatRate = 0.05m;
        private readonly AppDbContext _context;

        public ProfitBreakdownService(AppDbContext context) { _context = context; }

        private static decimal Pct(decimal profit, decimal revenue) => revenue > 0 ? Math.Round(profit / revenue * 100m, 1) : 0m;

        public static decimal ProfitVat(decimal netProfit) => Math.Max(0m, Math.Round(netProfit * ProfitVatRate, 2));

        private record PurchaseCostRow(int ProductId, DateTime PurchaseDate, int PurchaseId, string? InvoiceNo, decimal CostPerBase);

        private async Task<List<PurchaseCostRow>> LoadPurchaseCostsAsync(int tenantId, IEnumerable<int> productIds, DateTime endUtc)
        {
            var ids = productIds.Distinct().ToList();
            if (ids.Count == 0) return new();
            var rows = await (from pi in _context.PurchaseItems.AsNoTracking()
                              join pu in _context.Purchases.AsNoTracking() on pi.PurchaseId equals pu.Id
                              where pu.TenantId == tenantId && ids.Contains(pi.ProductId) && pu.PurchaseDate < endUtc
                              select new { pi.ProductId, pu.PurchaseDate, PurchaseId = pu.Id, pu.InvoiceNo, pi.UnitCostExclVat, pi.ConversionAtPurchase }).ToListAsync();
            var products = await _context.Products.AsNoTracking()
                .Where(p => p.TenantId == tenantId && ids.Contains(p.Id))
                .Select(p => new { p.Id, p.ConversionToBase }).ToDictionaryAsync(p => p.Id, p => p.ConversionToBase);
            var result = new List<PurchaseCostRow>();
            foreach (var r in rows)
            {
                if (!r.UnitCostExclVat.HasValue || r.UnitCostExclVat <= 0) continue;
                var factor = r.ConversionAtPurchase ?? products.GetValueOrDefault(r.ProductId);
                if (factor <= 0) continue;
                result.Add(new PurchaseCostRow(r.ProductId, r.PurchaseDate, r.PurchaseId, r.InvoiceNo, r.UnitCostExclVat.Value / factor));
            }
            return result;
        }

        /// <summary>Latest purchase on or before the sale's business day (same day wins over earlier days).</summary>
        private static PurchaseCostRow? LatestPurchaseFor(List<PurchaseCostRow> rows, int productId, DateTime saleUtc)
        {
            var day = BusinessDateRange.BusinessDateOf(saleUtc);
            return rows.Where(r => r.ProductId == productId && BusinessDateRange.BusinessDateOf(r.PurchaseDate) <= day)
                .OrderByDescending(r => r.PurchaseDate).ThenByDescending(r => r.PurchaseId).FirstOrDefault();
        }

        public async Task<ProfitBreakdownDto> GetBreakdownAsync(int tenantId, DateTime fromDate, DateTime toDate, int? branchId, string? search)
        {
            if (tenantId <= 0) throw new InvalidOperationException("A company context is required.");
            var startUtc = BusinessDateRange.StartUtc(fromDate);
            var endUtc = BusinessDateRange.EndExclusiveUtc(toDate);

            var salesQuery = _context.Sales.AsNoTracking()
                .Where(s => s.TenantId == tenantId && !s.IsDeleted && s.InvoiceDate >= startUtc && s.InvoiceDate < endUtc);
            if (branchId.HasValue) salesQuery = salesQuery.Where(s => s.BranchId == branchId.Value);
            var sales = await salesQuery.Include(s => s.Customer).Include(s => s.Items).ThenInclude(i => i.Product)
                .OrderBy(s => s.InvoiceDate).ToListAsync();

            var purchaseCosts = await LoadPurchaseCostsAsync(tenantId, sales.SelectMany(s => s.Items).Select(i => i.ProductId), endUtc);

            var returnsQuery = _context.SaleReturns.AsNoTracking()
                .Where(r => r.TenantId == tenantId && r.ReturnDate >= startUtc && r.ReturnDate < endUtc);
            if (branchId.HasValue) returnsQuery = returnsQuery.Where(r => r.BranchId == null || r.BranchId == branchId.Value);
            var returnRows = await returnsQuery.Select(r => new { r.ReturnDate, r.GrandTotal, r.VatTotal }).ToListAsync();

            var expenseQuery = _context.Expenses.AsNoTracking()
                .Where(e => (e.TenantId == tenantId || (!e.TenantId.HasValue && e.OwnerId == tenantId))
                            && e.Date >= startUtc && e.Date < endUtc && e.Status == ExpenseStatus.Approved);
            if (branchId.HasValue) expenseQuery = expenseQuery.Where(e => e.BranchId == null || e.BranchId == branchId.Value);
            var expenseRows = await expenseQuery.Select(e => new { e.Date, e.Amount }).ToListAsync();

            var dto = new ProfitBreakdownDto { FromDate = fromDate.ToString("yyyy-MM-dd"), ToDate = toDate.ToString("yyyy-MM-dd") };
            var all = new List<ProfitBreakdownInvoiceDto>();
            foreach (var s in sales)
            {
                var invoiceNet = ProfitMath.SalesExcludingVat(s.GrandTotal, s.VatTotal);
                var rawLines = s.Items.Select(i => (Item: i, Net: i.LineTotal - i.VatAmount)).ToList();
                var rawSum = rawLines.Sum(x => x.Net);
                var scale = rawSum > 0 ? invoiceNet / rawSum : 1m; // spreads invoice discount / round-off over lines
                var inv = new ProfitBreakdownInvoiceDto
                {
                    SaleId = s.Id, InvoiceNo = s.InvoiceNo, InvoiceDate = s.InvoiceDate,
                    InvoiceDateDubai = (s.InvoiceDate.Kind == DateTimeKind.Utc ? s.InvoiceDate : DateTime.SpecifyKind(s.InvoiceDate, DateTimeKind.Utc)).Add(BusinessDateRange.DubaiOffset).ToString("yyyy-MM-dd HH:mm"),
                    CustomerName = s.Customer?.Name ?? "Cash customer",
                    NetSalesExclVat = invoiceNet, Discount = s.Discount
                };
                var missing = false;
                foreach (var (item, rawNet) in rawLines)
                {
                    var lineNet = Math.Round(rawNet * scale, 2);
                    var cost = SaleCostBasis.Calculate(item);
                    var snapshot = SaleCostBasis.HasSnapshot(item);
                    var perBase = snapshot ? item.UnitCostAtSale!.Value : item.Product?.CostPrice ?? 0m;
                    var factor = snapshot ? item.ConversionAtSale!.Value : (item.Product?.ConversionToBase > 0 ? item.Product.ConversionToBase : 1m);
                    var latest = LatestPurchaseFor(purchaseCosts, item.ProductId, s.InvoiceDate);
                    string source; var differs = false;
                    if (perBase <= 0) { source = "Missing cost"; missing = true; }
                    else if (latest != null && Math.Abs(latest.CostPerBase - perBase) <= 0.005m)
                        source = $"Purchase #{latest.InvoiceNo ?? latest.PurchaseId.ToString()} ({BusinessDateRange.BusinessDateOf(latest.PurchaseDate).ToString("dd/MM/yyyy", System.Globalization.CultureInfo.InvariantCulture)})";
                    else
                    {
                        source = snapshot ? "Sale-time cost snapshot" : "Product master cost (estimate)";
                        differs = latest != null;
                    }
                    inv.Items.Add(new ProfitBreakdownItemDto
                    {
                        ProductId = item.ProductId, ProductName = item.Product?.NameEn ?? $"Product {item.ProductId}",
                        Unit = item.UnitType, Qty = item.Qty,
                        SaleUnitPriceExclVat = item.UnitPrice,
                        LineNetRevenue = lineNet,
                        PurchaseUnitCostExclVat = Math.Round(perBase * factor, 4),
                        LineTotalCost = Math.Round(cost, 2),
                        CostSource = source, CostDiffersFromLatestPurchase = differs,
                        LatestPurchaseUnitCostExclVat = latest == null ? null : Math.Round(latest.CostPerBase * factor, 4),
                        LineProfit = Math.Round(lineNet - cost, 2),
                        LineMarginPercent = Pct(lineNet - cost, lineNet)
                    });
                }
                inv.TotalCost = Math.Round(inv.Items.Sum(i => i.LineTotalCost), 2);
                inv.GrossProfit = Math.Round(invoiceNet - rawLines.Sum(x => SaleCostBasis.Calculate(x.Item)), 2);
                inv.MarginPercent = Pct(inv.GrossProfit, invoiceNet);
                if (missing) inv.WarningReason = "Missing cost snapshot";
                else if (inv.GrossProfit < 0) inv.WarningReason = inv.Items.Any(i => i.LineProfit < 0) ? "Purchase cost higher than sale price" : "Loss after discount";
                else if (inv.MarginPercent < LowMarginPercent) inv.WarningReason = $"Low margin ({inv.MarginPercent:0.0}%)";
                inv.HasMarginWarning = inv.WarningReason != null;
                all.Add(inv);
            }

            // Totals use the unrounded per-line costs so they match the dashboard to the cent.
            var cogs = sales.SelectMany(s => s.Items).Sum(SaleCostBasis.Calculate);
            var netSales = sales.Sum(s => ProfitMath.SalesExcludingVat(s.GrandTotal, s.VatTotal));
            var returnsNet = returnRows.Sum(r => ProfitMath.SalesExcludingVat(r.GrandTotal, r.VatTotal));
            var expenses = expenseRows.Sum(e => e.Amount);
            var gross = netSales - returnsNet - cogs;
            var net = gross - expenses;
            dto.Summary = new ProfitBreakdownSummaryDto
            {
                GrossSalesInclVat = sales.Sum(s => s.GrandTotal),
                OutputVatExcluded = sales.Sum(s => s.VatTotal),
                DiscountsAndRoundOff = sales.Sum(s => s.Discount - s.RoundOff),
                ReturnsExclVat = returnsNet,
                NetSalesExclVat = netSales,
                TotalCogsExclVat = cogs,
                GrossProfit = gross,
                GrossMarginPercent = Pct(gross, netSales - returnsNet),
                TotalExpenses = expenses,
                NetProfit = net,
                NetMarginPercent = Pct(net, netSales - returnsNet),
                VatOnNetProfit5Percent = ProfitVat(net),
                InvoiceCount = sales.Count,
                AnomalousMarginCount = all.Count(i => i.HasMarginWarning)
            };

            var days = new SortedDictionary<DateTime, (decimal Sales, decimal Cogs, decimal Exp)>();
            void Add(DateTime d, decimal sl, decimal cg, decimal ex) { days.TryGetValue(d, out var c); days[d] = (c.Sales + sl, c.Cogs + cg, c.Exp + ex); }
            foreach (var s in sales)
                Add(BusinessDateRange.BusinessDateOf(s.InvoiceDate), ProfitMath.SalesExcludingVat(s.GrandTotal, s.VatTotal), s.Items.Sum(SaleCostBasis.Calculate), 0m);
            foreach (var r in returnRows) Add(BusinessDateRange.BusinessDateOf(r.ReturnDate), -ProfitMath.SalesExcludingVat(r.GrandTotal, r.VatTotal), 0m, 0m);
            foreach (var e in expenseRows) Add(BusinessDateRange.BusinessDateOf(e.Date), 0m, 0m, e.Amount);
            dto.DailyTrend = days.Select(kv =>
            {
                var g = kv.Value.Sales - kv.Value.Cogs;
                return new ProfitBreakdownDayDto
                {
                    Date = kv.Key.ToString("yyyy-MM-dd"), NetSales = kv.Value.Sales, Cogs = kv.Value.Cogs, GrossProfit = g,
                    Expenses = kv.Value.Exp, NetProfit = g - kv.Value.Exp, MarginPercent = Pct(g, kv.Value.Sales)
                };
            }).ToList();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var q = search.Trim();
                all = all.Where(i => i.InvoiceNo.Contains(q, StringComparison.OrdinalIgnoreCase) || i.CustomerName.Contains(q, StringComparison.OrdinalIgnoreCase)).ToList();
            }
            dto.Invoices = all.OrderByDescending(i => i.InvoiceDate).ToList();
            if (tenantId == 20 && startUtc < new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc))
                dto.Notes.Add("Dates before 1 Nov 2026 include imported legacy history on the dashboard that is not itemised here.");
            if (sales.SelectMany(s => s.Items).Any(i => !SaleCostBasis.HasSnapshot(i)))
                dto.Notes.Add("Some lines have no saved cost snapshot; their cost is estimated from the current product cost.");
            return dto;
        }

        public async Task<RecalculateCostsResultDto> RecalculateCostsAsync(int tenantId, DateTime fromDate, DateTime toDate, int userId)
        {
            if (tenantId <= 0) throw new InvalidOperationException("A company context is required.");
            var startUtc = BusinessDateRange.StartUtc(fromDate);
            var endUtc = BusinessDateRange.EndExclusiveUtc(toDate);
            var sales = await _context.Sales
                .Where(s => s.TenantId == tenantId && !s.IsDeleted && s.InvoiceDate >= startUtc && s.InvoiceDate < endUtc)
                .Include(s => s.Items).ThenInclude(i => i.Product).ToListAsync();
            var costs = await LoadPurchaseCostsAsync(tenantId, sales.SelectMany(s => s.Items).Select(i => i.ProductId), endUtc);
            var result = new RecalculateCostsResultDto();
            foreach (var s in sales)
                foreach (var item in s.Items)
                {
                    result.LinesChecked++;
                    result.CogsBefore += SaleCostBasis.Calculate(item);
                    var latest = LatestPurchaseFor(costs, item.ProductId, s.InvoiceDate);
                    if (latest != null && (!item.UnitCostAtSale.HasValue || Math.Abs(item.UnitCostAtSale.Value - latest.CostPerBase) > 0.0005m))
                    {
                        item.UnitCostAtSale = latest.CostPerBase;
                        item.ConversionAtSale ??= item.Product?.ConversionToBase > 0 ? item.Product.ConversionToBase : 1m;
                        item.CostCapturedAt = DateTime.UtcNow;
                        result.LinesUpdated++;
                    }
                    result.CogsAfter += SaleCostBasis.Calculate(item);
                }
            if (result.LinesUpdated > 0)
            {
                _context.AuditLogs.Add(new AuditLog
                {
                    OwnerId = tenantId, TenantId = tenantId, UserId = userId, Action = "Sale costs recalculated",
                    Details = $"{fromDate:yyyy-MM-dd}..{toDate:yyyy-MM-dd}: {result.LinesUpdated} of {result.LinesChecked} lines; COGS {result.CogsBefore:0.00} -> {result.CogsAfter:0.00}",
                    CreatedAt = DateTime.UtcNow
                });
                _context.AllowAuditedSaleCostCorrection = true;
                try { await _context.SaveChangesAsync(); }
                finally { _context.AllowAuditedSaleCostCorrection = false; }
            }
            return result;
        }
    }

    /// <summary>When a purchase is posted after sales of the same Dubai business day, re-cost those earlier sales from it.</summary>
    public static class SaleCostSync
    {
        public static async Task<int> ApplyPurchaseAsync(AppDbContext context, int tenantId, Purchase purchase, IEnumerable<PurchaseItem> items)
        {
            var startUtc = BusinessDateRange.StartUtc(purchase.PurchaseDate);
            var endUtc = BusinessDateRange.EndExclusiveUtc(purchase.PurchaseDate);
            var updated = 0;
            foreach (var pi in items)
            {
                if (!pi.UnitCostExclVat.HasValue || pi.UnitCostExclVat <= 0) continue;
                var product = await context.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == pi.ProductId && p.TenantId == tenantId);
                if (product == null) continue;
                var perBase = PurchaseCostBasis.CostPerBaseUnitExclVat(pi, product, pi.UnitCostExclVat.Value);
                if (!perBase.HasValue) continue;
                var lines = await context.SaleItems
                    .Where(si => si.ProductId == pi.ProductId && si.Sale.TenantId == tenantId && !si.Sale.IsDeleted
                                 && si.Sale.InvoiceDate >= startUtc && si.Sale.InvoiceDate < endUtc
                                 && (si.Sale.CreatedAt <= purchase.CreatedAt || !si.UnitCostAtSale.HasValue || si.UnitCostAtSale <= 0))
                    .ToListAsync();
                foreach (var line in lines)
                {
                    if (line.UnitCostAtSale.HasValue && Math.Abs(line.UnitCostAtSale.Value - perBase.Value) <= 0.0005m) continue;
                    line.UnitCostAtSale = perBase.Value;
                    line.ConversionAtSale ??= product.ConversionToBase > 0 ? product.ConversionToBase : 1m;
                    line.CostCapturedAt = DateTime.UtcNow;
                    updated++;
                }
            }
            if (updated > 0)
            {
                context.AuditLogs.Add(new AuditLog
                {
                    OwnerId = tenantId, TenantId = tenantId, UserId = purchase.CreatedBy, Action = "Sale costs synced from purchase",
                    Details = $"Purchase {purchase.InvoiceNo}: {updated} earlier same-day sale line(s) re-costed (VAT-exclusive, per base unit).",
                    CreatedAt = DateTime.UtcNow
                });
                context.AllowAuditedSaleCostCorrection = true;
                try { await context.SaveChangesAsync(); }
                finally { context.AllowAuditedSaleCostCorrection = false; }
            }
            return updated;
        }
    }
}
