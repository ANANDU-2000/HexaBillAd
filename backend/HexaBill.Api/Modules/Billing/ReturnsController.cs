/*
Purpose: Returns controller for sales and purchase returns
Author: AI Assistant
Date: 2025
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Modules.Billing;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.Billing
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ReturnsController : TenantScopedController // MULTI-TENANT: Owner-scoped returns
    {
        private readonly IReturnService _returnService;

        public ReturnsController(IReturnService returnService)
        {
            _returnService = returnService;
        }

        [HttpPost("sales")]
        public async Task<ActionResult<ApiResponse<SaleReturnDto>>> CreateSaleReturn([FromBody] CreateSaleReturnRequest request)
        {
            try
            {
                var userId = int.Parse(User.FindFirst("UserId")?.Value ?? "0");
                var result = await _returnService.CreateSaleReturnAsync(request, userId, CurrentTenantId);
                return Ok(new ApiResponse<SaleReturnDto>
                {
                    Success = true,
                    Message = "Sale return created successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<SaleReturnDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("purchases")]
        public async Task<ActionResult<ApiResponse<PurchaseReturnDto>>> CreatePurchaseReturn([FromBody] CreatePurchaseReturnRequest request)
        {
            try
            {
                var userId = int.Parse(User.FindFirst("UserId")?.Value ?? "0");
                var result = await _returnService.CreatePurchaseReturnAsync(request, userId, CurrentTenantId);
                return Ok(new ApiResponse<PurchaseReturnDto>
                {
                    Success = true,
                    Message = "Purchase return created successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<PurchaseReturnDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("sales")]
        public async Task<ActionResult<ApiResponse<object>>> GetSaleReturns(
            [FromQuery] int? saleId = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] int? branchId = null,
            [FromQuery] int? routeId = null,
            [FromQuery] int? damageCategoryId = null,
            [FromQuery] int? staffId = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                if (saleId.HasValue && !fromDate.HasValue && !toDate.HasValue)
                {
                    var list = await _returnService.GetSaleReturnsAsync(CurrentTenantId, saleId);
                    return Ok(new ApiResponse<List<SaleReturnDto>>
                    {
                        Success = true,
                        Message = "Sale returns retrieved successfully",
                        Data = list
                    });
                }
                var userId = int.TryParse(User.FindFirst("UserId")?.Value ?? "0", out var uid) ? uid : (int?)null;
                var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? User.FindFirst("Role")?.Value;
                var paged = await _returnService.GetSaleReturnsPagedAsync(CurrentTenantId, fromDate, toDate, branchId, routeId, damageCategoryId, staffId ?? null, page, pageSize, role, userId);
                return Ok(new ApiResponse<PagedResponse<SaleReturnDto>>
                {
                    Success = true,
                    Message = "Sale returns retrieved successfully",
                    Data = paged
                });
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

        [HttpGet("feature-flags")]
        public async Task<ActionResult<ApiResponse<object>>> GetReturnsFeatureFlags()
        {
            try
            {
                var requireApproval = await _returnService.GetReturnsRequireApprovalAsync(CurrentTenantId);
                var enabled = await _returnService.GetReturnsEnabledAsync(CurrentTenantId);
                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Data = new { returnsRequireApproval = requireApproval, returnsEnabled = enabled }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = ex.Message });
            }
        }

        [HttpPatch("sales/{id}/approve")]
        [Authorize(Policy = "AdminOrOwner")]
        public async Task<ActionResult<ApiResponse<SaleReturnDto>>> ApproveSaleReturn(int id)
        {
            try
            {
                var result = await _returnService.ApproveSaleReturnAsync(id, CurrentTenantId);
                return Ok(new ApiResponse<SaleReturnDto> { Success = true, Message = "Return approved", Data = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new ApiResponse<SaleReturnDto> { Success = false, Message = ex.Message });
            }
        }

        [HttpPatch("sales/{id}/reject")]
        [Authorize(Policy = "AdminOrOwner")]
        public async Task<ActionResult<ApiResponse<SaleReturnDto>>> RejectSaleReturn(int id)
        {
            try
            {
                var result = await _returnService.RejectSaleReturnAsync(id, CurrentTenantId);
                return Ok(new ApiResponse<SaleReturnDto> { Success = true, Message = "Return rejected", Data = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new ApiResponse<SaleReturnDto> { Success = false, Message = ex.Message });
            }
        }

        [HttpGet("damage-categories")]
        public async Task<ActionResult<ApiResponse<List<DamageCategoryDto>>>> GetDamageCategories()
        {
            try
            {
                var list = await _returnService.GetDamageCategoriesAsync(CurrentTenantId);
                return Ok(new ApiResponse<List<DamageCategoryDto>>
                {
                    Success = true,
                    Message = "Damage categories retrieved successfully",
                    Data = list
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<DamageCategoryDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("purchases")]
        public async Task<ActionResult<ApiResponse<List<PurchaseReturnDto>>>> GetPurchaseReturns([FromQuery] int? purchaseId = null)
        {
            try
            {
                var result = await _returnService.GetPurchaseReturnsAsync(CurrentTenantId, purchaseId);
                return Ok(new ApiResponse<List<PurchaseReturnDto>>
                {
                    Success = true,
                    Message = "Purchase returns retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<PurchaseReturnDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }
    }
}

