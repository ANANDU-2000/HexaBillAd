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
        private readonly ILogger<ReturnsController> _logger;

        public ReturnsController(IReturnService returnService, ILogger<ReturnsController> logger)
        {
            _returnService = returnService;
            _logger = logger;
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
                return Ok(new ApiResponse<SaleReturnDto>
                {
                    Success = false,
                    Message = ex.Message ?? "Failed to create sale return",
                    Errors = new List<string> { ex.Message ?? "" }
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
                return Ok(new ApiResponse<PurchaseReturnDto>
                {
                    Success = false,
                    Message = ex.Message ?? "Failed to create purchase return",
                    Errors = new List<string> { ex.Message ?? "" }
                });
            }
        }

        [HttpGet("sales/{id}/pdf")]
        public async Task<ActionResult> GetReturnBillPdf(int id)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var pdfBytes = await _returnService.GenerateReturnBillPdfAsync(id, tenantId);
                return File(pdfBytes, "application/pdf", $"return_bill_{id}_{DateTime.UtcNow:yyyyMMdd}.pdf");
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new ApiResponse<object> { Success = false, Message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetReturnBillPdf error for return {ReturnId}", id);
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "Failed to generate return bill PDF.",
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
                return Ok(new ApiResponse<object>
                {
                    Success = false,
                    Message = ex.Message ?? "Failed to load sale returns",
                    Data = new PagedResponse<SaleReturnDto> { Items = new List<SaleReturnDto>(), TotalCount = 0, Page = 1, PageSize = 20, TotalPages = 0 },
                    Errors = new List<string> { ex.Message ?? "" }
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
                return Ok(new ApiResponse<object> { Success = false, Message = ex.Message ?? "Failed to load feature flags", Data = new { returnsRequireApproval = false, returnsEnabled = true } });
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

        [HttpDelete("sales/{id}")]
        [Authorize(Policy = "AdminOrOwner")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteSaleReturn(int id)
        {
            try
            {
                await _returnService.DeleteSaleReturnAsync(id, CurrentTenantId);
                return Ok(new ApiResponse<object> { Success = true, Message = "Return deleted successfully" });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new ApiResponse<object> { Success = false, Message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
            }
        }

        [HttpGet("credit-notes")]
        public async Task<ActionResult<ApiResponse<List<CreditNoteDto>>>> GetCreditNotes(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] int? customerId = null)
        {
            try
            {
                var list = await _returnService.GetCreditNotesAsync(CurrentTenantId, fromDate, toDate, customerId);
                return Ok(new ApiResponse<List<CreditNoteDto>>
                {
                    Success = true,
                    Message = "Credit notes retrieved successfully",
                    Data = list
                });
            }
            catch (Exception ex)
            {
                return Ok(new ApiResponse<List<CreditNoteDto>>
                {
                    Success = false,
                    Message = ex.Message ?? "Failed to load credit notes",
                    Data = new List<CreditNoteDto>(),
                    Errors = new List<string> { ex.Message ?? "" }
                });
            }
        }

        [HttpGet("damage-report")]
        public async Task<ActionResult<ApiResponse<List<DamageReportEntryDto>>>> GetDamageReport(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] int? branchId = null,
            [FromQuery] int? routeId = null)
        {
            try
            {
                var list = await _returnService.GetDamageReportAsync(CurrentTenantId, fromDate, toDate, branchId, routeId);
                return Ok(new ApiResponse<List<DamageReportEntryDto>>
                {
                    Success = true,
                    Message = "Damage report retrieved successfully",
                    Data = list
                });
            }
            catch (Exception ex)
            {
                return Ok(new ApiResponse<List<DamageReportEntryDto>>
                {
                    Success = false,
                    Message = ex.Message ?? "Failed to load damage report",
                    Data = new List<DamageReportEntryDto>(),
                    Errors = new List<string> { ex.Message ?? "" }
                });
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
                return Ok(new ApiResponse<List<DamageCategoryDto>>
                {
                    Success = false,
                    Message = ex.Message ?? "Failed to load damage categories",
                    Data = new List<DamageCategoryDto>(),
                    Errors = new List<string> { ex.Message ?? "" }
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
                return Ok(new ApiResponse<List<PurchaseReturnDto>>
                {
                    Success = false,
                    Message = ex.Message ?? "Failed to load purchase returns",
                    Data = new List<PurchaseReturnDto>(),
                    Errors = new List<string> { ex.Message ?? "" }
                });
            }
        }

        [HttpPost("credit-notes/{creditNoteId}/apply")]
        public async Task<ActionResult<ApiResponse<object>>> ApplyCreditNote(int creditNoteId, [FromBody] ApplyCreditRequest request)
        {
            try
            {
                var userId = int.Parse(User.FindFirst("UserId")?.Value ?? "0");
                await _returnService.ApplyCreditNoteAsync(creditNoteId, request.SaleId, request.AmountToApply, userId, CurrentTenantId);
                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Credit applied to invoice successfully."
                });
            }
            catch (InvalidOperationException ex)
            {
                return Ok(new ApiResponse<object> { Success = false, Message = ex.Message, Errors = new List<string> { ex.Message } });
            }
            catch (Exception ex)
            {
                return Ok(new ApiResponse<object> { Success = false, Message = ex.Message ?? "Failed to apply credit", Errors = new List<string> { ex.Message ?? "" } });
            }
        }

        [HttpPost("credit-notes/{creditNoteId}/refund")]
        public async Task<ActionResult<ApiResponse<object>>> RefundCreditNote(int creditNoteId)
        {
            try
            {
                var userId = int.Parse(User.FindFirst("UserId")?.Value ?? "0");
                await _returnService.RefundCreditNoteAsync(creditNoteId, userId, CurrentTenantId);
                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Refund issued successfully."
                });
            }
            catch (InvalidOperationException ex)
            {
                return Ok(new ApiResponse<object> { Success = false, Message = ex.Message, Errors = new List<string> { ex.Message } });
            }
            catch (Exception ex)
            {
                return Ok(new ApiResponse<object> { Success = false, Message = ex.Message ?? "Failed to issue refund", Errors = new List<string> { ex.Message ?? "" } });
            }
        }
    }

    public class ApplyCreditRequest
    {
        public int SaleId { get; set; }
        public decimal AmountToApply { get; set; }
    }
}

