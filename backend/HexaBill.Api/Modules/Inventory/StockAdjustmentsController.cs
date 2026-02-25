/*
Purpose: Stock adjustments controller
Author: AI Assistant
Date: 2025
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Modules.Inventory;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.Inventory
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Owner,Admin,Staff")]
    public class StockAdjustmentsController : TenantScopedController // MULTI-TENANT: Owner-scoped stock
    {
        private readonly IStockAdjustmentService _adjustmentService;

        public StockAdjustmentsController(IStockAdjustmentService adjustmentService)
        {
            _adjustmentService = adjustmentService;
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<StockAdjustmentDto>>> CreateAdjustment([FromBody] CreateStockAdjustmentRequest request)
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId) || userId <= 0)
                {
                    return Unauthorized(new ApiResponse<StockAdjustmentDto> { Success = false, Message = "Invalid user" });
                }
                var tenantId = CurrentTenantId;
                var result = await _adjustmentService.CreateAdjustmentAsync(request, userId, tenantId);
                return Ok(new ApiResponse<StockAdjustmentDto>
                {
                    Success = true,
                    Message = "Stock adjustment created successfully",
                    Data = result
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ApiResponse<StockAdjustmentDto>
                {
                    Success = false,
                    Message = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<StockAdjustmentDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<StockAdjustmentDto>>>> GetAdjustments(
            [FromQuery] int? productId = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var result = await _adjustmentService.GetAdjustmentsAsync(productId, fromDate, toDate, tenantId);
                return Ok(new ApiResponse<List<StockAdjustmentDto>>
                {
                    Success = true,
                    Message = "Stock adjustments retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<StockAdjustmentDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }
    }
}

