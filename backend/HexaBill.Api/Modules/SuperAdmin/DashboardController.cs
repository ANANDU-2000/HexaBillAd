using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Shared.Extensions;
using HexaBill.Api.Shared.Services;
using HexaBill.Api.Shared.Validation;
using System.Security.Claims;

namespace HexaBill.Api.Modules.SuperAdmin;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : TenantScopedController // MULTI-TENANT: Owner-scoped dashboard
{
    private readonly AppDbContext _context;
    private readonly ITimeZoneService _timeZoneService;

    public DashboardController(AppDbContext context, ITimeZoneService timeZoneService)
    {
        _context = context;
        _timeZoneService = timeZoneService;
    }

    [HttpGet]
    public async Task<IActionResult> GetDashboardData()
    {
        // CRITICAL: Get owner_id from JWT for data isolation
        // Super Admin (owner_id = 0) sees all data
        var tenantId = CurrentTenantId;
        var isSystemAdmin = IsSystemAdmin;
        
        // Get user role from token
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? "Staff";
        var isAdmin = role == "Admin" || role == "Owner";

        // Get today's date range in Gulf Standard Time (GST, UTC+4)
        var today = _timeZoneService.GetCurrentDate();
        var startOfDay = new DateTime(today.Year, today.Month, today.Day, 0, 0, 0, DateTimeKind.Utc);
        var endOfDay = startOfDay.AddDays(1).AddTicks(-1);
        
        // Already in UTC, no conversion needed
        var startOfDayUtc = startOfDay;
        var endOfDayUtc = endOfDay;

        // Calculate totals (excluding deleted sales) - FILTERED BY OWNER_ID or ALL for SuperAdmin
        var salesQuery = _context.Sales
            .Where(s => !s.IsDeleted && s.InvoiceDate >= startOfDayUtc && s.InvoiceDate <= endOfDayUtc);
        if (!isSystemAdmin) salesQuery = salesQuery.Where(s => s.TenantId == tenantId);
        var totalSales = await salesQuery.SumAsync(s => (decimal?)s.GrandTotal) ?? 0;

        var purchasesQuery = _context.Purchases
            .Where(p => p.PurchaseDate >= startOfDayUtc && p.PurchaseDate <= endOfDayUtc);
        if (!isSystemAdmin) purchasesQuery = purchasesQuery.Where(p => p.TenantId == tenantId);
        var totalPurchases = await purchasesQuery.SumAsync(p => p.TotalAmount);

        var expensesQuery = _context.Expenses
            .Where(e => e.Date >= startOfDayUtc && e.Date <= endOfDayUtc);
        if (!isSystemAdmin) expensesQuery = expensesQuery.Where(e => e.TenantId == tenantId);
        var totalExpenses = await expensesQuery.SumAsync(e => e.Amount);

        // Calculate profit (only for Admin)
        decimal? profitToday = null;
        if (isAdmin || isSystemAdmin)
        {
            // Profit = Sales (Subtotal) - COGS (Cost of Goods Sold) - Expenses
            var subtotalQuery = _context.Sales
                .Where(s => !s.IsDeleted && s.InvoiceDate >= startOfDayUtc && s.InvoiceDate <= endOfDayUtc);
            if (!isSystemAdmin) subtotalQuery = subtotalQuery.Where(s => s.TenantId == tenantId);
            var totalSalesSubtotal = await subtotalQuery.SumAsync(s => (decimal?)s.Subtotal) ?? 0;
            
            // SIMPLIFIED CASH PROFIT: Just use total purchases for the period
            var purchasesCashQuery = _context.Purchases
                .Where(p => p.PurchaseDate >= startOfDayUtc && p.PurchaseDate <= endOfDayUtc);
            if (!isSystemAdmin) purchasesCashQuery = purchasesCashQuery.Where(p => p.TenantId == tenantId);
            var purchasesTodayCash = await purchasesCashQuery.SumAsync(p => (decimal?)p.TotalAmount) ?? 0;
            
            // Gross Profit = Sales - Purchases (simplified cash basis)
            var grossProfit = totalSales - purchasesTodayCash;
            profitToday = grossProfit - totalExpenses;
            
            // CRITICAL LOGGING for debugging profit mismatch
            Console.WriteLine($"\n========== DASHBOARD PROFIT CALCULATION (SIMPLIFIED CASH) ==========");
            Console.WriteLine($"?? User: {(isSystemAdmin ? "SUPER ADMIN (ALL OWNERS)" : $"Owner {tenantId}")}");
            Console.WriteLine($"?? Date Range (UTC): {startOfDayUtc:yyyy-MM-dd HH:mm:ss} to {endOfDayUtc:yyyy-MM-dd HH:mm:ss}");
            Console.WriteLine($"?? Sales (GrandTotal with VAT): {totalSales:C}");
            Console.WriteLine($"?? Purchases (with VAT): {purchasesTodayCash:C}");
            Console.WriteLine($"?? Gross Profit (CASH: Sales - Purchases): {grossProfit:C}");
            Console.WriteLine($"?? Expenses: {totalExpenses:C}");
            Console.WriteLine($"? NET PROFIT (Cash): {profitToday:C}");
            Console.WriteLine($"====================================================================\n");
        }

        // Pending Bills Count (sales where PaymentStatus is Pending or Partial, excluding deleted)
        var pendingCountQuery = _context.Sales
            .Where(s => !s.IsDeleted && (s.PaymentStatus == SalePaymentStatus.Pending || s.PaymentStatus == SalePaymentStatus.Partial));
        if (!isSystemAdmin) pendingCountQuery = pendingCountQuery.Where(s => s.TenantId == tenantId);
        var pendingBillsCount = await pendingCountQuery.CountAsync();
        
        // Pending Payments Amount
        var pendingAmountQuery = _context.Sales
            .Where(s => !s.IsDeleted && (s.PaymentStatus == SalePaymentStatus.Pending || s.PaymentStatus == SalePaymentStatus.Partial));
        if (!isSystemAdmin) pendingAmountQuery = pendingAmountQuery.Where(s => s.TenantId == tenantId);
        var pendingPayments = await pendingAmountQuery.SumAsync(s => (decimal?)(s.GrandTotal - s.PaidAmount)) ?? 0;

        // Low Stock Alerts (products with stock less than 100)
        var lowStockQuery = _context.Products.Where(p => p.StockQty < 100);
        if (!IsSystemAdmin) lowStockQuery = lowStockQuery.Where(p => p.TenantId == tenantId);
        var lowStockProducts = await lowStockQuery
            .Select(p => new LowStockProduct
            {
                Id = p.Id,
                Name = p.NameEn,
                StockQty = p.StockQty,
                UnitType = p.UnitType
            })
            .ToListAsync();

        var response = new DashboardResponse
        {
            TotalSales = totalSales,
            TotalPurchases = totalPurchases,
            TotalExpenses = totalExpenses,
            ProfitToday = profitToday, // null for Staff
            PendingPayments = pendingPayments,
            PendingBillsCount = pendingBillsCount,
            LowStockAlerts = lowStockProducts,
            IsAdmin = isAdmin || isSystemAdmin
        };

        return Ok(response);
    }

    [HttpGet("statistics")]
    public async Task<IActionResult> GetDetailedStatistics()
    {
        // CRITICAL: Get owner_id from JWT for data isolation
        var tenantId = CurrentTenantId;
        var isSystemAdmin = IsSystemAdmin;
        
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? "Staff";
        var isAdmin = role == "Admin";

        var today = _timeZoneService.GetCurrentDate();
        var startOfDay = new DateTime(today.Year, today.Month, today.Day, 0, 0, 0, DateTimeKind.Utc);
        var endOfDay = startOfDay.AddDays(1).AddTicks(-1);
        
        // Already in UTC, no conversion needed
        var startOfDayUtc = startOfDay;
        var endOfDayUtc = endOfDay;

        // Get sales data (excluding deleted) - SuperAdmin sees ALL
        var salesCountQuery = _context.Sales
            .Where(s => !s.IsDeleted && s.InvoiceDate >= startOfDayUtc && s.InvoiceDate <= endOfDayUtc);
        if (!isSystemAdmin) salesCountQuery = salesCountQuery.Where(s => s.TenantId == tenantId);
        var salesCount = await salesCountQuery.CountAsync();

        var purchasesCountQuery = _context.Purchases
            .Where(p => p.PurchaseDate >= startOfDayUtc && p.PurchaseDate <= endOfDayUtc);
        if (!isSystemAdmin) purchasesCountQuery = purchasesCountQuery.Where(p => p.TenantId == tenantId);
        var purchasesCount = await purchasesCountQuery.CountAsync();

        var expensesCountQuery = _context.Expenses
            .Where(e => e.Date >= startOfDayUtc && e.Date <= endOfDayUtc);
        if (!isSystemAdmin) expensesCountQuery = expensesCountQuery.Where(e => e.TenantId == tenantId);
        var expensesCount = await expensesCountQuery.CountAsync();

        var pendingInvoicesQuery = _context.Sales
            .Where(s => !s.IsDeleted && (s.PaymentStatus == SalePaymentStatus.Pending || s.PaymentStatus == SalePaymentStatus.Partial));
        if (!isSystemAdmin) pendingInvoicesQuery = pendingInvoicesQuery.Where(s => s.TenantId == tenantId);
        var pendingInvoicesCount = await pendingInvoicesQuery.CountAsync();

        var lowStockQuery = _context.Products.Where(p => p.StockQty < 100);
        if (!isSystemAdmin) lowStockQuery = lowStockQuery.Where(p => p.TenantId == tenantId);
        var lowStockCount = await lowStockQuery.CountAsync();

        var response = new DashboardStatisticsResponse
        {
            SalesCount = salesCount,
            PurchasesCount = purchasesCount,
            ExpensesCount = expensesCount,
            PendingInvoicesCount = pendingInvoicesCount,
            LowStockCount = lowStockCount
        };

        return Ok(response);
    }
}

// DTOs
public class DashboardResponse
{
    public decimal TotalSales { get; set; }
    public decimal TotalPurchases { get; set; }
    public decimal TotalExpenses { get; set; }
    public decimal? ProfitToday { get; set; } // null for Staff role
    public decimal PendingPayments { get; set; }
    public int PendingBillsCount { get; set; }
    public List<LowStockProduct> LowStockAlerts { get; set; } = new();
    public bool IsAdmin { get; set; }
}

public class LowStockProduct
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal StockQty { get; set; }
    public string UnitType { get; set; } = string.Empty;
}

public class DashboardStatisticsResponse
{
    public int SalesCount { get; set; }
    public int PurchasesCount { get; set; }
    public int ExpensesCount { get; set; }
    public int PendingInvoicesCount { get; set; }
    public int LowStockCount { get; set; }
}
