/*
Purpose: Agreement API — CRUD + blank preview + PDF
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
    [Route("api/agreements")]
    [Authorize(Roles = "Admin,Owner,Staff")]
    public class AgreementsController : TenantScopedController
    {
        private readonly IAgreementService _service;
        private readonly IPdfService _pdf;
        private readonly ISettingsService _settings;
        private readonly ILogger<AgreementsController> _logger;

        public AgreementsController(
            IAgreementService service,
            IPdfService pdf,
            ISettingsService settings,
            ILogger<AgreementsController> logger)
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
                return Ok(new ApiResponse<List<AgreementDto>> { Success = true, Data = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "List agreements failed");
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to list agreements" });
            }
        }

        [HttpGet("preview-blank")]
        public async Task<IActionResult> PreviewBlank()
        {
            try
            {
                var tenantId = CurrentTenantId;
                var blocked = await EnsureFeatureAsync(tenantId);
                if (blocked != null) return blocked;
                var data = await _service.GetBlankPreviewAsync(tenantId);
                return Ok(new ApiResponse<AgreementDto> { Success = true, Data = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Blank agreement preview failed");
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to load preview" });
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
                return Ok(new ApiResponse<AgreementDto> { Success = true, Data = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Get agreement {Id} failed", id);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to load agreement" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateAgreementRequest request)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var blocked = await EnsureFeatureAsync(tenantId);
                if (blocked != null) return blocked;
                var userId = CurrentUserId;
                if (userId == 0) return Unauthorized();
                var data = await _service.CreateAsync(request ?? new CreateAgreementRequest(), userId, tenantId);
                return Ok(new ApiResponse<AgreementDto> { Success = true, Data = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Create agreement failed");
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to create agreement" });
            }
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateAgreementRequest request)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var blocked = await EnsureFeatureAsync(tenantId);
                if (blocked != null) return blocked;
                var userId = CurrentUserId;
                if (userId == 0) return Unauthorized();
                var data = await _service.UpdateAsync(id, request ?? new UpdateAgreementRequest(), userId, tenantId);
                if (data == null) return NotFound(new ApiResponse<object> { Success = false, Message = "Not found" });
                return Ok(new ApiResponse<AgreementDto> { Success = true, Data = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Update agreement {Id} failed", id);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to update agreement" });
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
                _logger.LogError(ex, "Delete agreement {Id} failed", id);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to delete agreement" });
            }
        }

        [HttpGet("{id:int}/pdf")]
        public async Task<IActionResult> Pdf(int id, [FromQuery] string format = "A4")
        {
            try
            {
                var tenantId = CurrentTenantId;
                var blocked = await EnsureFeatureAsync(tenantId);
                if (blocked != null) return blocked;
                var agreement = await _service.GetByIdAsync(id, tenantId);
                if (agreement == null) return NotFound(new ApiResponse<object> { Success = false, Message = "Not found" });
                var bytes = await _pdf.GenerateAgreementPdfAsync(agreement, format);
                var fmt = (format ?? "A4").Trim().ToUpperInvariant();
                return File(bytes, "application/pdf", $"{agreement.AgreementNo}_{fmt}.pdf");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Agreement PDF {Id} failed", id);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to generate PDF" });
            }
        }
    }
}
