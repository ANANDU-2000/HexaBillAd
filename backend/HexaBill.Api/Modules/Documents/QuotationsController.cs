/*
Purpose: Quotation API — CRUD + next number + PDF
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Billing;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.Documents
{
    [ApiController]
    [Route("api/quotations")]
    [Authorize(Roles = "Admin,Owner,Staff")]
    public class QuotationsController : TenantScopedController
    {
        private readonly IQuotationService _service;
        private readonly IPdfService _pdf;
        private readonly ISettingsService _settings;
        private readonly ILogger<QuotationsController> _logger;

        public QuotationsController(
            IQuotationService service,
            IPdfService pdf,
            ISettingsService settings,
            ILogger<QuotationsController> logger)
        {
            _service = service;
            _pdf = pdf;
            _settings = settings;
            _logger = logger;
        }

        private async Task<IActionResult?> EnsureFeatureAsync(int tenantId)
        {
            if (tenantId <= 0) return Forbid();
            if (!await DocumentsFeature.IsEnabledAsync(_settings, tenantId))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new ApiResponse<object>
                {
                    Success = false,
                    Message = $"Feature disabled. Enable setting '{DocumentsFeature.FlagKey}' for this tenant."
                });
            }
            return null;
        }

        private int CurrentUserId =>
            int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : 0;

        [HttpGet]
        public async Task<IActionResult> List()
        {
            try
            {
                var tenantId = CurrentTenantId;
                var blocked = await EnsureFeatureAsync(tenantId);
                if (blocked != null) return blocked;
                var data = await _service.ListAsync(tenantId);
                return Ok(new ApiResponse<List<QuotationDto>> { Success = true, Data = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "List quotations failed");
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to list quotations" });
            }
        }

        [HttpGet("next-number")]
        public async Task<IActionResult> NextNumber()
        {
            try
            {
                var tenantId = CurrentTenantId;
                var blocked = await EnsureFeatureAsync(tenantId);
                if (blocked != null) return blocked;
                var no = await _service.PeekNextQuoteNoAsync(tenantId);
                return Ok(new ApiResponse<string> { Success = true, Data = no });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Peek quote number failed");
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to get next quote number" });
            }
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var blocked = await EnsureFeatureAsync(tenantId);
                if (blocked != null) return blocked;
                var data = await _service.GetByIdAsync(id, tenantId);
                if (data == null) return NotFound(new ApiResponse<object> { Success = false, Message = "Not found" });
                return Ok(new ApiResponse<QuotationDto> { Success = true, Data = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Get quotation {Id} failed", id);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to load quotation" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateQuotationRequest request)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var blocked = await EnsureFeatureAsync(tenantId);
                if (blocked != null) return blocked;
                var userId = CurrentUserId;
                if (userId == 0) return Unauthorized();
                if (request.Items == null || request.Items.Count == 0)
                    return BadRequest(new ApiResponse<object> { Success = false, Message = "At least one line item is required" });
                var data = await _service.CreateAsync(request, userId, tenantId);
                return Ok(new ApiResponse<QuotationDto> { Success = true, Data = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Create quotation failed");
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to create quotation" });
            }
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateQuotationRequest request)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var blocked = await EnsureFeatureAsync(tenantId);
                if (blocked != null) return blocked;
                var userId = CurrentUserId;
                if (userId == 0) return Unauthorized();
                if (request.Items == null || request.Items.Count == 0)
                    return BadRequest(new ApiResponse<object> { Success = false, Message = "At least one line item is required" });
                var data = await _service.UpdateAsync(id, request, userId, tenantId);
                if (data == null) return NotFound(new ApiResponse<object> { Success = false, Message = "Not found" });
                return Ok(new ApiResponse<QuotationDto> { Success = true, Data = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Update quotation {Id} failed", id);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to update quotation" });
            }
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var blocked = await EnsureFeatureAsync(tenantId);
                if (blocked != null) return blocked;
                var userId = CurrentUserId;
                if (userId == 0) return Unauthorized();
                var ok = await _service.DeleteAsync(id, userId, tenantId);
                if (!ok) return NotFound(new ApiResponse<object> { Success = false, Message = "Not found" });
                return Ok(new ApiResponse<bool> { Success = true, Data = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Delete quotation {Id} failed", id);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to delete quotation" });
            }
        }

        [HttpGet("{id:int}/pdf")]
        public async Task<IActionResult> Pdf(int id, [FromQuery] string format = "A4", [FromQuery] string? layout = null)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var blocked = await EnsureFeatureAsync(tenantId);
                if (blocked != null) return blocked;
                var quote = await _service.GetByIdAsync(id, tenantId);
                if (quote == null) return NotFound(new ApiResponse<object> { Success = false, Message = "Not found" });
                var layoutNorm = string.IsNullOrWhiteSpace(layout) ? "full" : layout.Trim().ToLowerInvariant();
                if (layoutNorm != "body" && layoutNorm != "full") layoutNorm = "full";
                var bytes = await _pdf.GenerateQuotationPdfAsync(quote, tenantId, format, layoutNorm);
                var fmt = (format ?? "A4").Trim().ToUpperInvariant();
                return File(bytes, "application/pdf", $"{quote.QuoteNo}_{fmt}.pdf");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Quotation PDF {Id} failed", id);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to generate PDF" });
            }
        }
    }
}
