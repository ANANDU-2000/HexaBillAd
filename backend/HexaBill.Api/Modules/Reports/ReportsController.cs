using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Models;
using HexaBill.Api.Data;
using HexaBill.Api.Shared.Extensions;
using Microsoft.Extensions.DependencyInjection;
using HexaBill.Api.Modules.Payments;
using HexaBill.Api.Modules.Billing;
using HexaBill.Api.Shared.Validation;

namespace HexaBill.Api.Modules.Reports
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ReportsController : TenantScopedController // MULTI-TENANT: Owner-scoped reports
    {
        private readonly IReportService _reportService;
        private readonly AppDbContext _context;
        private readonly ITimeZoneService _timeZoneService;

        public ReportsController(IReportService reportService, AppDbContext context, ITimeZoneService timeZoneService)
        {
            _reportService = reportService;
            _context = context;
            _timeZoneService = timeZoneService;
        }

        // Staff can view reports but cannot export sensitive data
        private bool IsStaffOnly()
        {
            return User.IsInRole("Staff") && !User.IsInRole("Admin");
        }

        [HttpGet("summary")]
        public async Task<ActionResult<ApiResponse<SummaryReportDto>>> GetSummaryReport(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] int? branchId = null,
            [FromQuery] int? routeId = null)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var userId = int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;
                var role = User.FindFirst(ClaimTypes.Role)?.Value;
                var result = await _reportService.GetSummaryReportAsync(tenantId, fromDate, toDate, branchId, routeId, userId, role);
                
                // SECURITY: Hide profit from Staff
                if (IsStaffOnly())
                {
                    result.ProfitToday = null;
                }

                Console.WriteLine($"? GetSummaryReport returning data: Sales={result.SalesToday}, Expenses={result.ExpensesToday}, PendingBills={result.PendingBills}");
                return Ok(new ApiResponse<SummaryReportDto>
                {
                    Success = true,
                    Message = "Summary report retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                // Log the full exception details for debugging
                Console.WriteLine($"Error in GetSummaryReport: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"Inner exception: {ex.InnerException.Message}");
                }
                
                return StatusCode(500, new ApiResponse<SummaryReportDto>
                {
                    Success = false,
                    Message = "An error occurred while generating the summary report",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("sales")]
        public async Task<ActionResult<ApiResponse<PagedResponse<SaleDto>>>> GetSalesReport(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] int? customerId = null,
            [FromQuery] string? status = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] int? branchId = null,
            [FromQuery] int? routeId = null)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var gstNow = _timeZoneService.GetCurrentDate();
                var from = (fromDate ?? gstNow.AddDays(-30)).ToUtcKind();
                var to = ((toDate ?? gstNow).AddDays(1)).ToUtcKind();
                var userId = int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;
                var role = User.FindFirst(ClaimTypes.Role)?.Value;
                var result = await _reportService.GetSalesReportAsync(tenantId, from, to, customerId, status, page, pageSize, branchId, routeId, userId, role);
                return Ok(new ApiResponse<PagedResponse<SaleDto>>
                {
                    Success = true,
                    Message = "Sales report retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                // Log the full exception details for debugging
                Console.WriteLine($"Error in GetSalesReport: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"Inner exception: {ex.InnerException.Message}");
                }
                
                return StatusCode(500, new ApiResponse<PagedResponse<SaleDto>>
                {
                    Success = false,
                    Message = "An error occurred while generating the sales report",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("product-sales")]
        public async Task<ActionResult<ApiResponse<List<ProductSalesDto>>>> GetProductSalesReport(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] int top = 20)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                // CRITICAL FIX: Always add 1 day to toDate for inclusive range
                var from = (fromDate ?? _timeZoneService.GetCurrentDate().AddDays(-30)).ToUtcKind();
                var to = ((toDate ?? _timeZoneService.GetCurrentDate()).AddDays(1)).ToUtcKind();
                var result = await _reportService.GetProductSalesReportAsync(tenantId, from, to, top);

                // SECURITY: Hide profit from Staff
                if (IsStaffOnly())
                {
                    foreach (var p in result)
                    {
                        p.CostValue = null;
                        p.GrossProfit = null;
                        p.MarginPercent = null;
                    }
                }

                return Ok(new ApiResponse<List<ProductSalesDto>>
                {
                    Success = true,
                    Message = "Product sales report retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                // Log the full exception details for debugging
                Console.WriteLine($"Error in GetProductSalesReport: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"Inner exception: {ex.InnerException.Message}");
                }
                
                return StatusCode(500, new ApiResponse<List<ProductSalesDto>>
                {
                    Success = false,
                    Message = "An error occurred while generating the product sales report",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("outstanding")]
        public async Task<ActionResult<ApiResponse<List<CustomerDto>>>> GetOutstandingCustomers(
            [FromQuery] int days = 30)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var result = await _reportService.GetOutstandingCustomersAsync(tenantId, days);
                return Ok(new ApiResponse<List<CustomerDto>>
                {
                    Success = true,
                    Message = "Outstanding customers retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<CustomerDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("cheque")]
        public async Task<ActionResult<ApiResponse<List<PaymentDto>>>> GetChequeReport()
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var result = await _reportService.GetChequeReportAsync(tenantId);
                return Ok(new ApiResponse<List<PaymentDto>>
                {
                    Success = true,
                    Message = "Cheque report retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<PaymentDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("ai-suggestions")]
        public async Task<ActionResult<ApiResponse<AISuggestionsDto>>> GetAISuggestions(
            [FromQuery] int periodDays = 30)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var result = await _reportService.GetAISuggestionsAsync(tenantId, periodDays);

                // SECURITY: Hide profit-sensitive suggestions from Staff
                if (IsStaffOnly())
                {
                    result.LowMarginProducts = new List<ProductDto>();
                    result.PromotionCandidates = new List<ProductDto>();
                }

                return Ok(new ApiResponse<AISuggestionsDto>
                {
                    Success = true,
                    Message = "AI suggestions retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<AISuggestionsDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("pending")]
        [HttpGet("pending-bills")] // Alternative route name per spec
        public async Task<ActionResult<ApiResponse<List<PendingBillDto>>>> GetPendingBills(
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] int? customerId = null,
            [FromQuery] int days = 30, // Legacy parameter for backward compatibility
            [FromQuery] string? search = null,
            [FromQuery] string? status = null)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                // CRITICAL: Only apply date filter when BOTH from and to are explicitly provided.
                // When omitted, show ALL pending/overdue bills (no date filter) so overdue is visible.
                DateTime? fromDate = (from.HasValue && to.HasValue) ? from.Value.ToUtcKind() : null;
                DateTime? toDate = (from.HasValue && to.HasValue) ? to.Value.ToUtcKind() : null;
                var result = await _reportService.GetPendingBillsAsync(
                    tenantId,
                    fromDate,
                    toDate,
                    customerId,
                    search,
                    status);
                return Ok(new ApiResponse<List<PendingBillDto>>
                {
                    Success = true,
                    Message = "Pending bills retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<PendingBillDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("expenses")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<List<ExpenseByCategoryDto>>>> GetExpensesByCategory(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] int? branchId = null)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var from = (fromDate ?? _timeZoneService.GetCurrentDate().AddDays(-30)).ToUtcKind();
                var to = (toDate ?? _timeZoneService.GetCurrentDate()).ToUtcKind();
                var result = await _reportService.GetExpensesByCategoryAsync(tenantId, from, to, branchId);
                return Ok(new ApiResponse<List<ExpenseByCategoryDto>>
                {
                    Success = true,
                    Message = "Expense breakdown retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<ExpenseByCategoryDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("sales-vs-expenses")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<List<SalesVsExpensesDto>>>> GetSalesVsExpenses(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] string groupBy = "day")
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var from = (fromDate ?? _timeZoneService.GetCurrentDate().AddDays(-30)).ToUtcKind();
                var to = (toDate ?? _timeZoneService.GetCurrentDate()).ToUtcKind();
                var result = await _reportService.GetSalesVsExpensesAsync(tenantId, from, to, groupBy);

                // SECURITY: Hide profit from Staff
                if (IsStaffOnly())
                {
                    foreach (var item in result)
                    {
                        item.Profit = null;
                    }
                }

                return Ok(new ApiResponse<List<SalesVsExpensesDto>>
                {
                    Success = true,
                    Message = "Sales vs Expenses data retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<SalesVsExpensesDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("export/pdf")]
        [Authorize(Roles = "Admin,Owner")] // MULTI-TENANT: Both Admin and Owner can export
        public Task<ActionResult> ExportReportPdf(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            var from = (fromDate ?? _timeZoneService.GetCurrentDate().AddDays(-30)).ToUtcKind();
            var to = (toDate ?? _timeZoneService.GetCurrentDate()).ToUtcKind();

            // Generate PDF report using existing PdfService or create summary
            // For now, return a simple response - can be enhanced with QuestPDF
            return Task.FromResult<ActionResult>(Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "PDF export endpoint ready. Implementation requires PDF generation library.",
                Data = new { fromDate = from, toDate = to, message = "Use GET /api/reports/summary for data" }
            }));
        }

        [HttpGet("export/excel")]
        [Authorize(Roles = "Admin,Owner")] // MULTI-TENANT: Both Admin and Owner can export
        public Task<ActionResult> ExportReportExcel(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            var from = (fromDate ?? _timeZoneService.GetCurrentDate().AddDays(-30)).ToUtcKind();
            var to = (toDate ?? _timeZoneService.GetCurrentDate()).ToUtcKind();

            // Excel export would use EPPlus or ClosedXML
            // For now, return a response indicating endpoint is ready
            return Task.FromResult<ActionResult>(Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Excel export endpoint ready. Implementation requires EPPlus library.",
                Data = new { fromDate = from, toDate = to, message = "Use GET /api/reports/summary for data" }
            }));
        }

        [HttpGet("export/csv")]
        [Authorize(Roles = "Admin,Owner")] // MULTI-TENANT: Both Admin and Owner can export
        public async Task<ActionResult> ExportReportCsv(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var from = (fromDate ?? _timeZoneService.GetCurrentDate().AddDays(-30)).ToUtcKind();
                var to = (toDate ?? _timeZoneService.GetCurrentDate()).ToUtcKind();

                // Get sales data
                var salesData = await _reportService.GetSalesReportAsync(tenantId, from, to, null, null, 1, 1000);
                var csvContent = "InvoiceNo,InvoiceDate,CustomerName,GrandTotal,PaymentStatus\n";
                
                foreach (var sale in salesData.Items)
                {
                    csvContent += $"{sale.InvoiceNo},{sale.InvoiceDate:yyyy-MM-dd},{sale.CustomerName ?? ""},{sale.GrandTotal},{sale.PaymentStatus}\n";
                }

                var bytes = System.Text.Encoding.UTF8.GetBytes(csvContent);
                return File(bytes, "text/csv", $"reports_{from:yyyy-MM-dd}_{to:yyyy-MM-dd}.csv");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("sales-enhanced")]
        public async Task<ActionResult<ApiResponse<EnhancedSalesReportDto>>> GetEnhancedSalesReport(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] string granularity = "day",
            [FromQuery] int? productId = null,
            [FromQuery] int? customerId = null,
            [FromQuery] string? status = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var from = (fromDate ?? _timeZoneService.GetCurrentDate().AddDays(-30)).ToUtcKind();
                var to = (toDate ?? _timeZoneService.GetCurrentDate()).ToUtcKind();
                var result = await _reportService.GetEnhancedSalesReportAsync(tenantId, from, to, granularity, productId, customerId, status, page, pageSize);
                return Ok(new ApiResponse<EnhancedSalesReportDto>
                {
                    Success = true,
                    Message = "Enhanced sales report retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<EnhancedSalesReportDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("products-enhanced")]
        public async Task<ActionResult<ApiResponse<List<ProductSalesDto>>>> GetEnhancedProductSalesReport(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] int? productId = null,
            [FromQuery] string? unitType = null,
            [FromQuery] bool lowStockOnly = false)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var from = (fromDate ?? _timeZoneService.GetCurrentDate().AddDays(-30)).ToUtcKind();
                var to = (toDate ?? _timeZoneService.GetCurrentDate()).ToUtcKind();
                var result = await _reportService.GetEnhancedProductSalesReportAsync(tenantId, from, to, productId, unitType, lowStockOnly);
                return Ok(new ApiResponse<List<ProductSalesDto>>
                {
                    Success = true,
                    Message = "Enhanced product sales report retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<ProductSalesDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("customers-enhanced")]
        public async Task<ActionResult<ApiResponse<CustomerReportDto>>> GetCustomerReport(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] decimal? minOutstanding = null)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var from = (fromDate ?? _timeZoneService.GetCurrentDate().AddDays(-30)).ToUtcKind();
                var to = (toDate ?? _timeZoneService.GetCurrentDate()).ToUtcKind();
                var result = await _reportService.GetCustomerReportAsync(tenantId, from, to, minOutstanding);
                return Ok(new ApiResponse<CustomerReportDto>
                {
                    Success = true,
                    Message = "Customer report retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<CustomerReportDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("aging")]
        public async Task<ActionResult<ApiResponse<AgingReportDto>>> GetAgingReport(
            [FromQuery] DateTime? asOfDate = null,
            [FromQuery] int? customerId = null)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var asOf = (asOfDate ?? _timeZoneService.GetCurrentDate()).ToUtcKind();
                var result = await _reportService.GetAgingReportAsync(tenantId, asOf, customerId);
                return Ok(new ApiResponse<AgingReportDto>
                {
                    Success = true,
                    Message = "Aging report retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<AgingReportDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("stock")]
        public async Task<ActionResult<ApiResponse<StockReportDto>>> GetStockReport(
            [FromQuery] bool lowOnly = false)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var result = await _reportService.GetStockReportAsync(tenantId, lowOnly);
                return Ok(new ApiResponse<StockReportDto>
                {
                    Success = true,
                    Message = "Stock report retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<StockReportDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("sales-ledger")]
        public async Task<ActionResult<ApiResponse<SalesLedgerReportDto>>> GetComprehensiveSalesLedger(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] int? branchId = null,
            [FromQuery] int? routeId = null)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var userId = int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;
                var role = User.FindFirst(ClaimTypes.Role)?.Value;
                var result = await _reportService.GetComprehensiveSalesLedgerAsync(tenantId, fromDate, toDate, branchId, routeId, userId, role);
                return Ok(new ApiResponse<SalesLedgerReportDto>
                {
                    Success = true,
                    Message = "Comprehensive sales ledger retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetComprehensiveSalesLedger: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                return StatusCode(500, new ApiResponse<SalesLedgerReportDto>
                {
                    Success = false,
                    Message = "An error occurred while generating the sales ledger",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("sales-ledger/export/pdf")]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<ActionResult> ExportSalesLedgerPdf(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] string? type = null)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var from = (fromDate ?? _timeZoneService.GetCurrentDate().AddDays(-30)).ToUtcKind();
                var to = (toDate ?? _timeZoneService.GetCurrentDate()).ToUtcKind();
                
                var ledgerReport = await _reportService.GetComprehensiveSalesLedgerAsync(tenantId, from, to);
                
                // Filter by type if provided
                if (!string.IsNullOrWhiteSpace(type) && (type.Equals("Sale", StringComparison.OrdinalIgnoreCase) || type.Equals("Payment", StringComparison.OrdinalIgnoreCase)))
                {
                    var filteredEntries = ledgerReport.Entries
                        .Where(e => e.Type.Equals(type, StringComparison.OrdinalIgnoreCase))
                        .ToList();
                    
                    // Recalculate summary for filtered entries
                    var totalRealPending = filteredEntries.Sum(e => e.RealPending);
                    var totalRealGotPayment = filteredEntries.Sum(e => e.RealGotPayment);
                    var totalSales = filteredEntries.Where(e => e.Type == "Sale").Sum(e => e.RealPending);
                    var totalPayments = filteredEntries.Where(e => e.Type == "Payment").Sum(e => e.RealGotPayment);
                    
                    ledgerReport = new SalesLedgerReportDto
                    {
                        Entries = filteredEntries,
                        Summary = new SalesLedgerSummary
                        {
                            TotalDebit = totalRealPending,
                            TotalCredit = totalRealGotPayment,
                            OutstandingBalance = 0, // Not used anymore
                            TotalSales = totalSales,
                            TotalPayments = totalPayments
                        }
                    };
                }
                
                var pdfService = HttpContext.RequestServices.GetRequiredService<IPdfService>();
                var pdfBytes = await pdfService.GenerateSalesLedgerPdfAsync(ledgerReport, from, to, tenantId);
                
                var fileName = !string.IsNullOrWhiteSpace(type)
                    ? $"sales_ledger_{type.ToLower()}_{from:yyyy-MM-dd}_{to:yyyy-MM-dd}.pdf"
                    : $"sales_ledger_{from:yyyy-MM-dd}_{to:yyyy-MM-dd}.pdf";
                
                return File(pdfBytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error exporting sales ledger PDF: {ex.Message}");
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred while exporting the sales ledger",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("pending-bills/export/pdf")]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<ActionResult> ExportPendingBillsPdf(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] int? customerId = null,
            [FromQuery] string? status = null)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var from = (fromDate ?? _timeZoneService.GetCurrentDate().AddDays(-30)).ToUtcKind();
                var to = (toDate ?? _timeZoneService.GetCurrentDate()).ToUtcKind();
                
                var pendingBills = await _reportService.GetPendingBillsAsync(tenantId, from, to, customerId, null, status);
                
                if (pendingBills == null || !pendingBills.Any())
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "No pending bills found for the specified period"
                    });
                }
                
                var pdfService = HttpContext.RequestServices.GetRequiredService<IPdfService>();
                var pdfBytes = await pdfService.GeneratePendingBillsPdfAsync(pendingBills, from, to, tenantId);
                
                var fileName = $"pending_bills_{from:yyyy-MM-dd}_{to:yyyy-MM-dd}.pdf";
                
                return File(pdfBytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error exporting pending bills PDF: {ex.Message}");
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred while exporting the pending bills report",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("sales/export/html")]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<ActionResult> ExportSalesReportHtml(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var from = fromDate ?? _timeZoneService.GetCurrentDate().AddDays(-30);
                var to = toDate ?? _timeZoneService.GetCurrentDate();
                
                var salesData = await _reportService.GetSalesReportAsync(tenantId, from, to, null, null, 1, 10000);
                var settings = await GetCompanySettingsAsync(tenantId);
                
                var html = await GenerateSalesReportHtmlAsync(salesData, settings, from, to);
                var bytes = System.Text.Encoding.UTF8.GetBytes(html);
                
                return File(bytes, "text/html", $"sales_report_{from:yyyy-MM-dd}_{to:yyyy-MM-dd}.html");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("cash/export/html")]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<ActionResult> ExportCashReportHtml(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var from = fromDate ?? _timeZoneService.GetCurrentDate().AddDays(-30);
                var to = toDate ?? _timeZoneService.GetCurrentDate();
                
                var payments = await _context.Payments
                    .Include(p => p.Customer)
                    .Where(p => p.TenantId == CurrentTenantId && p.PaymentDate >= from && p.PaymentDate <= to) // MULTI-TENANT
                    .OrderBy(p => p.PaymentDate)
                    .ToListAsync();
                
                var expenses = await _context.Expenses
                    .Where(e => e.TenantId == CurrentTenantId && e.Date >= from && e.Date <= to) // MULTI-TENANT
                    .OrderBy(e => e.Date)
                    .ToListAsync();
                
                var settings = await GetCompanySettingsAsync(CurrentTenantId);
                var html = await GenerateCashReportHtmlAsync(payments, expenses, settings, from, to);
                var bytes = System.Text.Encoding.UTF8.GetBytes(html);
                
                return File(bytes, "text/html", $"cash_report_{from:yyyy-MM-dd}_{to:yyyy-MM-dd}.html");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        private async Task<InvoiceTemplateService.CompanySettings> GetCompanySettingsAsync(int tenantId)
        {
            var settings = await _context.Settings
                .Where(s => s.TenantId == tenantId)  // CRITICAL: Filter by owner
                .ToDictionaryAsync(s => s.Key, s => s.Value ?? "");
            return new InvoiceTemplateService.CompanySettings
            {
                CompanyNameEn = settings.GetValueOrDefault("COMPANY_NAME_EN", ""),
                CompanyNameAr = settings.GetValueOrDefault("COMPANY_NAME_AR", ""),
                CompanyAddress = settings.GetValueOrDefault("COMPANY_ADDRESS", ""),
                CompanyPhone = settings.GetValueOrDefault("COMPANY_PHONE", ""),
                CompanyTrn = settings.GetValueOrDefault("COMPANY_TRN", ""),
                Currency = settings.GetValueOrDefault("CURRENCY", "AED")
            };
        }

        private async Task<string> GenerateSalesReportHtmlAsync(PagedResponse<SaleDto> salesData, InvoiceTemplateService.CompanySettings settings, DateTime from, DateTime to)
        {
            var templatePath = Path.Combine(Directory.GetCurrentDirectory(), "Templates", "sales-report-template.html");
            var template = await System.IO.File.ReadAllTextAsync(templatePath);
            
            var salesRows = new System.Text.StringBuilder();
            foreach (var sale in salesData.Items)
            {
                var itemsCount = sale.Items?.Count ?? 0;
                salesRows.AppendLine($@"
                <tr>
                    <td>{sale.InvoiceDate:dd-MM-yyyy}</td>
                    <td>{sale.InvoiceNo}</td>
                    <td>{System.Net.WebUtility.HtmlEncode(sale.CustomerName ?? "Cash")}</td>
                    <td class=""text-center"">{itemsCount}</td>
                    <td class=""text-right"">{sale.Subtotal:N2}</td>
                    <td class=""text-right"">{sale.VatTotal:N2}</td>
                    <td class=""text-right"">{sale.Discount:N2}</td>
                    <td class=""text-right"">{sale.GrandTotal:N2}</td>
                    <td class=""text-center"">{sale.PaymentStatus}</td>
                </tr>");
            }
            
            var totalSubtotal = salesData.Items.Sum(s => s.Subtotal);
            var totalVat = salesData.Items.Sum(s => s.VatTotal);
            var totalDiscount = salesData.Items.Sum(s => s.Discount);
            var totalGrandTotal = salesData.Items.Sum(s => s.GrandTotal);
            
            return template
                .Replace("{{company_name_en}}", settings.CompanyNameEn)
                .Replace("{{company_name_ar}}", settings.CompanyNameAr)
                .Replace("{{company_address}}", settings.CompanyAddress)
                .Replace("{{company_phone}}", settings.CompanyPhone)
                .Replace("{{company_trn}}", settings.CompanyTrn)
                .Replace("{{from_date}}", from.ToString("dd-MM-yyyy"))
                .Replace("{{to_date}}", to.ToString("dd-MM-yyyy"))
                .Replace("{{generated_date}}", DateTime.UtcNow.ToString("dd-MM-yyyy HH:mm"))
                .Replace("{{sales_rows}}", salesRows.ToString())
                .Replace("{{total_subtotal}}", totalSubtotal.ToString("N2"))
                .Replace("{{total_vat}}", totalVat.ToString("N2"))
                .Replace("{{total_discount}}", totalDiscount.ToString("N2"))
                .Replace("{{total_grand_total}}", totalGrandTotal.ToString("N2"))
                .Replace("{{currency}}", settings.Currency);
        }

        private async Task<string> GenerateCashReportHtmlAsync(List<Payment> payments, List<Expense> expenses, InvoiceTemplateService.CompanySettings settings, DateTime from, DateTime to)
        {
            var templatePath = Path.Combine(Directory.GetCurrentDirectory(), "Templates", "cash-report-template.html");
            var template = await System.IO.File.ReadAllTextAsync(templatePath);
            
            var cashRows = new System.Text.StringBuilder();
            decimal runningBalance = 0;
            
            // Add payments (cash in)
            foreach (var payment in payments.Where(p => p.Mode == PaymentMode.CASH))
            {
                runningBalance += payment.Amount;
                cashRows.AppendLine($@"
                <tr>
                    <td>{payment.PaymentDate:dd-MM-yyyy}</td>
                    <td>Payment</td>
                    <td>{payment.Reference ?? payment.Sale?.InvoiceNo ?? "-"}</td>
                    <td>{System.Net.WebUtility.HtmlEncode(payment.Customer?.Name ?? "Cash Customer")}</td>
                    <td class=""text-center"">CASH</td>
                    <td class=""text-right"">{payment.Amount:N2}</td>
                    <td class=""text-right"">0.00</td>
                    <td class=""text-right"">{runningBalance:N2}</td>
                </tr>");
            }
            
            // Add expenses (cash out)
            foreach (var expense in expenses)
            {
                runningBalance -= expense.Amount;
                cashRows.AppendLine($@"
                <tr>
                    <td>{expense.Date:dd-MM-yyyy}</td>
                    <td>Expense</td>
                    <td>{expense.Note ?? "-"}</td>
                    <td>{System.Net.WebUtility.HtmlEncode(expense.Category?.Name ?? "General")}</td>
                    <td class=""text-center"">CASH</td>
                    <td class=""text-right"">0.00</td>
                    <td class=""text-right"">{expense.Amount:N2}</td>
                    <td class=""text-right"">{runningBalance:N2}</td>
                </tr>");
            }
            
            var totalCashIn = payments.Where(p => p.Mode == PaymentMode.CASH).Sum(p => p.Amount);
            var totalCashOut = expenses.Sum(e => e.Amount);
            var netCashFlow = totalCashIn - totalCashOut;
            
            return template
                .Replace("{{company_name_en}}", settings.CompanyNameEn)
                .Replace("{{company_name_ar}}", settings.CompanyNameAr)
                .Replace("{{company_address}}", settings.CompanyAddress)
                .Replace("{{company_phone}}", settings.CompanyPhone)
                .Replace("{{company_trn}}", settings.CompanyTrn)
                .Replace("{{from_date}}", from.ToString("dd-MM-yyyy"))
                .Replace("{{to_date}}", to.ToString("dd-MM-yyyy"))
                .Replace("{{generated_date}}", DateTime.UtcNow.ToString("dd-MM-yyyy HH:mm"))
                .Replace("{{cash_rows}}", cashRows.ToString())
                .Replace("{{total_cash_in}}", totalCashIn.ToString("N2"))
                .Replace("{{total_cash_out}}", totalCashOut.ToString("N2"))
                .Replace("{{net_cash_flow}}", netCashFlow.ToString("N2"))
                .Replace("{{closing_balance}}", runningBalance.ToString("N2"))
                .Replace("{{currency}}", settings.Currency);
        }
    }
}

