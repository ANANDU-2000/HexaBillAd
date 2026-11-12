/*
Purpose: Profit controller for profit calculations and reports
Author: AI Assistant
Date: 2025
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Reports
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin,Owner,SystemAdmin")]
    public class ProfitController : TenantScopedController // MULTI-TENANT: Owner-scoped profit
    {
        private readonly IProfitService _profitService;
        private readonly IProfitBreakdownService _breakdown;
        private readonly ILogger<ProfitController> _logger;

        public ProfitController(IProfitService profitService, IProfitBreakdownService breakdown, ILogger<ProfitController> logger)
        {
            _profitService = profitService;
            _breakdown = breakdown;
            _logger = logger;
        }

        /// <summary>Profit &amp; Margin Inspector: summary, daily trend and invoice -> line cost drill-down (Dubai business dates).</summary>
        [HttpGet("breakdown")]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<ActionResult<ApiResponse<ProfitBreakdownDto>>> GetBreakdown(
            [FromQuery] DateTime? fromDate = null, [FromQuery] DateTime? toDate = null,
            [FromQuery] int? branchId = null, [FromQuery] string? search = null)
        {
            var today = HexaBill.Api.Core.Infrastructure.BusinessDateRange.BusinessDateOf(DateTime.UtcNow);
            var from = (fromDate ?? today).Date;
            var to = (toDate ?? from).Date;
            if (to < from) return BadRequest(new ApiResponse<ProfitBreakdownDto> { Success = false, Message = "To date must not be before From date." });
            if ((to - from).TotalDays > 366) return BadRequest(new ApiResponse<ProfitBreakdownDto> { Success = false, Message = "Choose a range of one year or less." });
            var data = await _breakdown.GetBreakdownAsync(CurrentTenantId, from, to, branchId, search);
            return Ok(new ApiResponse<ProfitBreakdownDto> { Success = true, Data = data });
        }

        /// <summary>Re-syncs sale cost snapshots in a date range from the latest verified purchase cost (VAT-exclusive).</summary>
        [HttpPost("recalculate-costs")]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<ActionResult<ApiResponse<RecalculateCostsResultDto>>> RecalculateCosts(
            [FromQuery] DateTime fromDate, [FromQuery] DateTime toDate)
        {
            var from = fromDate.Date; var to = toDate.Date;
            if (to < from || (to - from).TotalDays > 92)
                return BadRequest(new ApiResponse<RecalculateCostsResultDto> { Success = false, Message = "Choose a valid range of 92 days or less." });
            var data = await _breakdown.RecalculateCostsAsync(CurrentTenantId, from, to, int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : 0);
            return Ok(new ApiResponse<RecalculateCostsResultDto> { Success = true, Message = $"{data.LinesUpdated} of {data.LinesChecked} lines updated.", Data = data });
        }

        /// <summary>Export P&amp;L as PDF for accountant (#58).</summary>
        [HttpGet("export/pdf")]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<IActionResult> ExportProfitLossPdf(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var from = (fromDate ?? DateTime.UtcNow.AddDays(-30)).ToUtcKind();
                var to = (toDate ?? DateTime.UtcNow).ToUtcKind();
                var report = await _profitService.CalculateProfitAsync(tenantId, from, to);
                var pdfService = HttpContext.RequestServices.GetService(typeof(IPdfService)) as IPdfService;
                if (pdfService == null)
                    return StatusCode(500, "PDF service unavailable.");
                var pdfBytes = await pdfService.GenerateProfitLossPdfAsync(report, from, to, tenantId);
                return File(pdfBytes, "application/pdf", $"profit_loss_{from:yyyy-MM-dd}_{to:yyyy-MM-dd}.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpGet("report")]
        public async Task<ActionResult<ApiResponse<ProfitReportDto>>> GetProfitReport(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var from = (fromDate ?? DateTime.UtcNow.AddDays(-30)).ToUtcKind();
                var to = (toDate ?? DateTime.UtcNow).ToUtcKind();
                var result = await _profitService.CalculateProfitAsync(tenantId, from, to);
                return Ok(new ApiResponse<ProfitReportDto>
                {
                    Success = true,
                    Message = "Profit report generated successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<ProfitReportDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("products")]
        public async Task<ActionResult<ApiResponse<List<ProductProfitDto>>>> GetProductProfit(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var from = (fromDate ?? DateTime.UtcNow.AddDays(-30)).ToUtcKind();
                var to = (toDate ?? DateTime.UtcNow).ToUtcKind();
                var result = await _profitService.CalculateProductProfitAsync(tenantId, from, to);
                return Ok(new ApiResponse<List<ProductProfitDto>>
                {
                    Success = true,
                    Message = "Product profit report generated successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<ProductProfitDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("daily")]
        public async Task<ActionResult<ApiResponse<DailyProfitDto>>> GetDailyProfit([FromQuery] DateTime? date = null)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var targetDate = (date ?? DateTime.UtcNow).ToUtcKind();
                var result = await _profitService.GetDailyProfitAsync(tenantId, targetDate);
                return Ok(new ApiResponse<DailyProfitDto>
                {
                    Success = true,
                    Message = "Daily profit retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<DailyProfitDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>Branch-wise profit breakdown for multi-branch tenants (#57).</summary>
        [HttpGet("branch-breakdown")]
        public async Task<ActionResult<ApiResponse<List<BranchProfitDto>>>> GetBranchProfit(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var from = (fromDate ?? DateTime.UtcNow.AddDays(-30)).ToUtcKind();
                var to = (toDate ?? DateTime.UtcNow).ToUtcKind();
                var result = await _profitService.CalculateBranchProfitAsync(tenantId, from, to);
                return Ok(new ApiResponse<List<BranchProfitDto>>
                {
                    Success = true,
                    Message = "Branch profit breakdown generated successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetBranchProfit");
                return Ok(new ApiResponse<List<BranchProfitDto>> { Success = true, Data = new List<BranchProfitDto>() });
            }
        }
    }
}

