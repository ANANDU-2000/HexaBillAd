/*
 * Purpose: Profit calculation service - Gross & Net Profit, COGS
 * SINGLE DEFINITION (PRODUCTION_MASTER_TODO #6, #38): Profit = GrandTotal(Sales) - COGS - Expenses.
 * COGS = from SaleItems (Qty × ConversionToBase × CostPrice). Use same in ReportService dashboard and P&L.
 */
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;
using HexaBill.Api.Shared.Services;

namespace HexaBill.Api.Modules.Reports
{
    public interface IProfitService
    {
        Task<ProfitReportDto> CalculateProfitAsync(int tenantId, DateTime fromDate, DateTime toDate);
        Task<List<ProductProfitDto>> CalculateProductProfitAsync(int tenantId, DateTime fromDate, DateTime toDate);
        Task<DailyProfitDto> GetDailyProfitAsync(int tenantId, DateTime date);
        /// <summary>Branch-wise profit for multi-branch tenants (#57). Profit = Sales - COGS - Expenses per branch.</summary>
        Task<List<BranchProfitDto>> CalculateBranchProfitAsync(int tenantId, DateTime fromDate, DateTime toDate);
    }

    public class ProfitService : IProfitService
    {
        private readonly AppDbContext _context;
        private readonly ISalesSchemaService _salesSchema;

        public ProfitService(AppDbContext context, ISalesSchemaService salesSchema)
        {
            _context = context;
            _salesSchema = salesSchema;
        }

        /// <summary>Single definition: Profit = GrandTotal(Sales) - COGS - Expenses. COGS from SaleItems (Qty×ConversionToBase×CostPrice).</summary>
        public async Task<ProfitReportDto> CalculateProfitAsync(int tenantId, DateTime fromDate, DateTime toDate)
        {
            // CRITICAL: Ensure date range includes full days
            // CRITICAL FIX: Never use .Date property, it creates Unspecified
            var from = new DateTime(fromDate.Year, fromDate.Month, fromDate.Day, 0, 0, 0, DateTimeKind.Utc);
            var to = toDate.AddDays(1).AddTicks(-1).ToUtcKind(); // End of day - FIX: Don't use .Date
            
            Console.WriteLine($"?? CalculateProfitAsync: tenantId={tenantId} (SuperAdmin: {tenantId == 0}), fromDate={from:yyyy-MM-dd}, toDate={to:yyyy-MM-dd HH:mm:ss}");
            
            // CRITICAL: Total Sales - use GrandTotal (includes VAT) for accurate reporting + OWNER FILTER
            // SUPER ADMIN (TenantId = 0): See ALL owners' data
            var salesQuery = _context.Sales
                .Where(s => s.InvoiceDate >= from && s.InvoiceDate <= to && !s.IsDeleted);
            if (tenantId > 0)
            {
                salesQuery = salesQuery.Where(s => s.TenantId == tenantId);
            }
            var totalSales = await salesQuery.SumAsync(s => (decimal?)s.GrandTotal) ?? 0;

            // Sales Subtotal (excluding VAT) for COGS calculation + OWNER FILTER
            var totalSalesSubtotal = await salesQuery.SumAsync(s => (decimal?)s.Subtotal) ?? 0;

            var totalSalesVat = await salesQuery.SumAsync(s => (decimal?)s.VatTotal) ?? 0;

            // CRITICAL: COGS - get sale IDs by projection only (avoid Include(Sale) which would SELECT Sales.BranchId and fail when column missing)
            var saleIdsInRange = await _context.Sales
                .Where(s => s.InvoiceDate >= from && s.InvoiceDate <= to && !s.IsDeleted && (tenantId <= 0 || s.TenantId == tenantId))
                .Select(s => s.Id)
                .ToListAsync();
            var saleItems = await _context.SaleItems
                .Include(si => si.Product)
                .Where(si => saleIdsInRange.Contains(si.SaleId))
                .ToListAsync();
            
            // COGS = SaleItems (Qty × conversion × CostPrice) — same as ReportService dashboard (no VAT on COGS for consistency)
            var cogs = saleItems.Sum(si =>
            {
                var conversionFactor = si.Product.ConversionToBase > 0 ? si.Product.ConversionToBase : 1;
                var baseQty = si.Qty * conversionFactor;
                return baseQty * si.Product.CostPrice;
            });

            // CRITICAL: Total Expenses - filter by date range + OWNER FILTER
            // SUPER ADMIN (TenantId = 0): See ALL owners' data
            var expensesQuery = _context.Expenses
                .Where(e => e.Date >= from && e.Date <= to);
            if (tenantId > 0)
            {
                expensesQuery = expensesQuery.Where(e => e.TenantId == tenantId);
            }
            var totalExpenses = await expensesQuery.SumAsync(e => (decimal?)e.Amount) ?? 0;

            // CRITICAL: Total Purchases (for reference) - filter by date range + OWNER FILTER
            // SUPER ADMIN (TenantId = 0): See ALL owners' data
            var purchasesQuery = _context.Purchases
                .Where(p => p.PurchaseDate >= from && p.PurchaseDate <= to);
            if (tenantId > 0)
            {
                purchasesQuery = purchasesQuery.Where(p => p.TenantId == tenantId);
            }
            var totalPurchases = await purchasesQuery.SumAsync(p => (decimal?)p.TotalAmount) ?? 0;

            // Single definition: Profit = GrandTotal(Sales) - COGS - Expenses (PRODUCTION_MASTER_TODO #38)
            // Gross Profit = Sales - COGS; Net Profit = Gross - Expenses
            var grossProfit = totalSales - cogs;
            var netProfit = grossProfit - totalExpenses;
            
            // Margins calculated against total revenue
            var grossProfitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
            var netProfitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

            // CRITICAL: Calculate daily profit array for chart
            var dailyProfit = new List<DailyProfitDto>();
            var currentDate = from;
            while (currentDate <= toDate)
            {
                // CRITICAL FIX: Never use .Date property, it creates Unspecified
                var dayStart = new DateTime(currentDate.Year, currentDate.Month, currentDate.Day, 0, 0, 0, DateTimeKind.Utc);
                var dayEnd = dayStart.AddDays(1).AddTicks(-1);
                
                var daySalesQuery = _context.Sales
                    .Where(s => s.InvoiceDate >= dayStart && s.InvoiceDate <= dayEnd && !s.IsDeleted);
                if (tenantId > 0)
                {
                    daySalesQuery = daySalesQuery.Where(s => s.TenantId == tenantId);
                }
                var daySales = await daySalesQuery.SumAsync(s => (decimal?)s.GrandTotal) ?? 0;
                
                var daySaleItemsQuery = _context.SaleItems
                    .Include(si => si.Sale)
                    .Include(si => si.Product)
                    .Where(si => si.Sale.InvoiceDate >= dayStart && 
                                si.Sale.InvoiceDate <= dayEnd && 
                                !si.Sale.IsDeleted);
                if (tenantId > 0)
                {
                    daySaleItemsQuery = daySaleItemsQuery.Where(si => si.Sale.TenantId == tenantId);
                }
                var daySaleItems = await daySaleItemsQuery.ToListAsync();
                
                var dayCogs = daySaleItems.Sum(si => {
                    var baseQty = si.Qty * (si.Product.ConversionToBase > 0 ? si.Product.ConversionToBase : 1);
                    return baseQty * si.Product.CostPrice;
                });
                
                var dayExpensesQuery = _context.Expenses
                    .Where(e => e.Date >= dayStart && e.Date <= dayEnd);
                if (tenantId > 0)
                {
                    dayExpensesQuery = dayExpensesQuery.Where(e => e.TenantId == tenantId);
                }
                var dayExpenses = await dayExpensesQuery.SumAsync(e => (decimal?)e.Amount) ?? 0;
                
                var dayProfit = daySales - dayCogs - dayExpenses;
                
                dailyProfit.Add(new DailyProfitDto
                {
                    Date = currentDate,
                    Sales = daySales,
                    Expenses = dayExpenses,
                    Profit = dayProfit
                });
                
                currentDate = currentDate.AddDays(1);
            }

            Console.WriteLine($"? Profit (UNIFIED): Sales={totalSales:C}, COGS={cogs:C}, Gross={grossProfit:C}, Expenses={totalExpenses:C}, Net={netProfit:C}");
            Console.WriteLine($"? Daily Profit entries: {dailyProfit.Count} days");

            return new ProfitReportDto
            {
                FromDate = from,
                ToDate = toDate,
                TotalSales = totalSales, // Total Revenue (GrandTotal with VAT)
                TotalSalesVat = totalSalesVat,
                TotalSalesWithVat = totalSales, // Same as TotalSales (GrandTotal includes VAT)
                CostOfGoodsSold = cogs, // UNIFIED: COGS from sale items (same as ReportService dashboard)
                GrossProfit = grossProfit, // Sales (GrandTotal) - COGS
                GrossProfitMargin = grossProfitMargin,
                TotalExpenses = totalExpenses,
                NetProfit = netProfit,
                NetProfitMargin = netProfitMargin,
                TotalPurchases = totalPurchases,
                DailyProfit = dailyProfit // CRITICAL: Include daily profit array
            };
        }

        public async Task<List<ProductProfitDto>> CalculateProductProfitAsync(int tenantId, DateTime fromDate, DateTime toDate)
        {
            // CRITICAL: Super admin (TenantId = 0) sees ALL owners
            var query = _context.SaleItems
                .Include(si => si.Sale)
                .Include(si => si.Product)
                .Where(si => si.Sale.InvoiceDate >= fromDate && 
                            si.Sale.InvoiceDate <= toDate && 
                            !si.Sale.IsDeleted);
            
            if (tenantId > 0)
            {
                query = query.Where(si => si.Sale.TenantId == tenantId);
            }
            
            var productProfits = await query
                .GroupBy(si => new { si.ProductId, si.Product.NameEn, si.Product.CostPrice, si.Product.SellPrice })
                .Select(g => new ProductProfitDto
                {
                    ProductId = g.Key.ProductId,
                    ProductName = g.Key.NameEn,
                    QuantitySold = g.Sum(si => si.Qty),
                    TotalSales = g.Sum(si => si.LineTotal),
                    TotalCost = g.Sum(si => si.Qty * g.Key.CostPrice),
                    Profit = g.Sum(si => si.LineTotal) - g.Sum(si => si.Qty * g.Key.CostPrice),
                    ProfitMargin = g.Sum(si => si.LineTotal) > 0 
                        ? ((g.Sum(si => si.LineTotal) - g.Sum(si => si.Qty * g.Key.CostPrice)) / g.Sum(si => si.LineTotal)) * 100 
                        : 0
                })
                .OrderByDescending(p => p.Profit)
                .ToListAsync();

            return productProfits;
        }

        /// <summary>Daily profit using same formula: Profit = GrandTotal(Sales) - COGS - Expenses (via CalculateProfitAsync).</summary>
        public async Task<DailyProfitDto> GetDailyProfitAsync(int tenantId, DateTime date)
        {
            // CRITICAL FIX: Never use .Date property, it creates Unspecified
            var fromDate = new DateTime(date.Year, date.Month, date.Day, 0, 0, 0, DateTimeKind.Utc);
            var toDate = fromDate.AddDays(1);

            var profitReport = await CalculateProfitAsync(tenantId, fromDate, toDate);

            return new DailyProfitDto
            {
                Date = date,
                Sales = profitReport.TotalSales,
                Expenses = profitReport.TotalExpenses,
                Profit = profitReport.NetProfit
            };
        }

        /// <summary>Branch-wise profit breakdown (#57). Same formula: Net = Sales - COGS - Expenses per branch.</summary>
        public async Task<List<BranchProfitDto>> CalculateBranchProfitAsync(int tenantId, DateTime fromDate, DateTime toDate)
        {
            if (tenantId <= 0) return new List<BranchProfitDto>();
            if (!await _salesSchema.SalesHasBranchIdAndRouteIdAsync())
                return new List<BranchProfitDto>();

            var from = new DateTime(fromDate.Year, fromDate.Month, fromDate.Day, 0, 0, 0, DateTimeKind.Utc);
            var to = toDate.AddDays(1).AddTicks(-1).ToUtcKind();

            // Schema-safe: select only Id, Name to avoid missing ManagerId column (42703) on some DBs
            var branches = await _context.Branches
                .AsNoTracking()
                .Where(b => b.TenantId == tenantId)
                .OrderBy(b => b.Name)
                .Select(b => new { b.Id, b.Name })
                .ToListAsync();

            var result = new List<BranchProfitDto>();
            foreach (var branch in branches)
            {
                var salesQuery = _context.Sales
                    .Where(s => !s.IsDeleted && s.TenantId == tenantId && s.BranchId == branch.Id
                        && s.InvoiceDate >= from && s.InvoiceDate <= to);
                var branchSales = await salesQuery.SumAsync(s => (decimal?)s.GrandTotal) ?? 0m;
                var invoiceCount = await salesQuery.CountAsync();

                var saleIdsQuery = _context.Sales
                    .Where(s => !s.IsDeleted && s.TenantId == tenantId && s.BranchId == branch.Id
                        && s.InvoiceDate >= from && s.InvoiceDate <= to)
                    .Select(s => s.Id);
                var saleItemsQuery = _context.SaleItems
                    .Include(si => si.Product)
                    .Where(si => saleIdsQuery.Contains(si.SaleId));
                var saleItems = await saleItemsQuery.ToListAsync();
                var cogs = saleItems.Sum(si =>
                {
                    var conversionFactor = si.Product.ConversionToBase > 0 ? si.Product.ConversionToBase : 1;
                    return si.Qty * conversionFactor * si.Product.CostPrice;
                });

                var expensesQuery = _context.Expenses
                    .Where(e => e.TenantId == tenantId && e.BranchId == branch.Id && e.Date >= from && e.Date <= to);
                var branchExpenses = await expensesQuery.SumAsync(e => (decimal?)e.Amount) ?? 0m;

                var grossProfit = branchSales - cogs;
                var netProfit = grossProfit - branchExpenses;
                var grossMargin = branchSales > 0 ? (grossProfit / branchSales) * 100 : 0;
                var netMargin = branchSales > 0 ? (netProfit / branchSales) * 100 : 0;

                result.Add(new BranchProfitDto
                {
                    BranchId = branch.Id,
                    BranchName = branch.Name,
                    Sales = branchSales,
                    CostOfGoodsSold = cogs,
                    GrossProfit = grossProfit,
                    Expenses = branchExpenses,
                    NetProfit = netProfit,
                    GrossProfitMarginPercent = grossMargin,
                    NetProfitMarginPercent = netMargin,
                    InvoiceCount = invoiceCount
                });
            }

            return result.OrderByDescending(b => b.Sales).ToList();
        }
    }
}

