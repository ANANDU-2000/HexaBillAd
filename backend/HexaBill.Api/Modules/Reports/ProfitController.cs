/*
Purpose: Profit controller for profit calculations and reports
Author: AI Assistant
Date: 2025
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.Reports
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin,Owner,SystemAdmin")]
    public class ProfitController : TenantScopedController // MULTI-TENANT: Owner-scoped profit
    {
        private readonly IProfitService _profitService;

        public ProfitController(IProfitService profitService)
        {
            _profitService = profitService;
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
    }
}

