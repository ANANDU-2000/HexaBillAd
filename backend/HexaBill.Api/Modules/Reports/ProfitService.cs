/*
Purpose: Profit calculation service - Gross & Net Profit, COGS
Author: AI Assistant
Date: 2025
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.Reports
{
    public interface IProfitService
    {
        Task<ProfitReportDto> CalculateProfitAsync(int tenantId, DateTime fromDate, DateTime toDate);
        Task<List<ProductProfitDto>> CalculateProductProfitAsync(int tenantId, DateTime fromDate, DateTime toDate);
        Task<DailyProfitDto> GetDailyProfitAsync(int tenantId, DateTime date);
    }

    public class ProfitService : IProfitService
    {
        private readonly AppDbContext _context;

        public ProfitService(AppDbContext context)
        {
            _context = context;
        }

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

            // CRITICAL: Calculate COGS (Cost of Goods Sold) - use actual product cost prices + OWNER FILTER
            // SUPER ADMIN (TenantId = 0): See ALL owners' data
            var saleItemsQuery = _context.SaleItems
                .Include(si => si.Sale)
                .Include(si => si.Product)
                .Where(si => si.Sale.InvoiceDate >= from && 
                            si.Sale.InvoiceDate <= to && 
                            !si.Sale.IsDeleted);
            if (tenantId > 0)
            {
                saleItemsQuery = saleItemsQuery.Where(si => si.Sale.TenantId == tenantId);
            }
            var saleItems = await saleItemsQuery.ToListAsync();
            
            // Calculate COGS with proper unit conversion and VAT handling
            // CRITICAL: For ACTUAL CASH PROFIT, COGS must include VAT (what you actually paid)
            var cogs = saleItems.Sum(si => {
                // Convert sale quantity to base unit for accurate cost calculation
                // CostPrice is already per base unit, so we need to convert sale qty to base unit
                var conversionFactor = si.Product.ConversionToBase > 0 ? si.Product.ConversionToBase : 1;
                var baseQty = si.Qty * conversionFactor;
                
                // CRITICAL: CostPrice is VAT-excluded, but for cash profit we need actual cash cost
                // Add 5% VAT to get the actual amount paid to suppliers
                var costExclVat = baseQty * si.Product.CostPrice;
                var cogsWithVat = costExclVat * 1.05m; // Add 5% VAT
                return cogsWithVat;
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

            // CRITICAL: For SIMPLIFIED CASH PROFIT (what client wants)
            // Gross Profit = Total Sales - Total Purchases (both with VAT)
            // This shows actual cash in vs cash out, ignoring inventory valuation
            var grossProfit = totalSales - totalPurchases;
            
            // Net Profit = Gross Profit - Operating Expenses
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
                var daySales = await daySalesQuery.SumAsync(s => (decimal?)s.Subtotal) ?? 0;
                
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

            Console.WriteLine($"? Profit Calculation (CASH BASIS): Sales={totalSales:C}, Purchases={totalPurchases:C}, Gross Profit={grossProfit:C}, Expenses={totalExpenses:C}, Net Profit={netProfit:C}");
            Console.WriteLine($"? Daily Profit entries: {dailyProfit.Count} days");

            return new ProfitReportDto
            {
                FromDate = from,
                ToDate = toDate,
                TotalSales = totalSales, // Total Revenue (GrandTotal with VAT)
                TotalSalesVat = totalSalesVat,
                TotalSalesWithVat = totalSales, // Same as TotalSales (GrandTotal includes VAT)
                CostOfGoodsSold = totalPurchases, // SIMPLIFIED: Show purchases instead of calculated COGS
                GrossProfit = grossProfit, // SIMPLIFIED CASH PROFIT: Sales - Purchases
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
    }
}

