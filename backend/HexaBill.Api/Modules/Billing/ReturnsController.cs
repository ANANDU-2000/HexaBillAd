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
        public async Task<ActionResult<ApiResponse<List<SaleReturnDto>>>> GetSaleReturns([FromQuery] int? saleId = null)
        {
            try
            {
                var result = await _returnService.GetSaleReturnsAsync(CurrentTenantId, saleId);
                return Ok(new ApiResponse<List<SaleReturnDto>>
                {
                    Success = true,
                    Message = "Sale returns retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<SaleReturnDto>>
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

