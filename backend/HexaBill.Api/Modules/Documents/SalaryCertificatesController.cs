/*
Purpose: Salary Certificate API — CRUD + blank preview + PDF (Zayoga letterhead-body pattern)
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
    [Route("api/salary-certificates")]
    [Authorize(Roles = "Admin,Owner,Staff")]
    public class SalaryCertificatesController : TenantScopedController
    {
        private readonly ISalaryCertificateService _service;
        private readonly IPdfService _pdf;
        private readonly ISettingsService _settings;
        private readonly ILogger<SalaryCertificatesController> _logger;

        public SalaryCertificatesController(
            ISalaryCertificateService service,
            IPdfService pdf,
            ISettingsService settings,
            ILogger<SalaryCertificatesController> logger)
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
                return Ok(new ApiResponse<List<SalaryCertificateDto>> { Success = true, Data = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "List salary certificates failed");
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to list salary certificates" });
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
                return Ok(new ApiResponse<SalaryCertificateDto> { Success = true, Data = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Blank salary certificate preview failed");
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
                return Ok(new ApiResponse<SalaryCertificateDto> { Success = true, Data = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Get salary certificate {Id} failed", id);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to load salary certificate" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateSalaryCertificateRequest request)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var blocked = await EnsureFeatureAsync(tenantId);
                if (blocked != null) return blocked;
                var userId = CurrentUserId;
                if (userId == 0) return Unauthorized();
                var data = await _service.CreateAsync(request ?? new CreateSalaryCertificateRequest(), userId, tenantId);
                return Ok(new ApiResponse<SalaryCertificateDto> { Success = true, Data = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Create salary certificate failed");
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to create salary certificate" });
            }
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateSalaryCertificateRequest request)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var blocked = await EnsureFeatureAsync(tenantId);
                if (blocked != null) return blocked;
                var userId = CurrentUserId;
                if (userId == 0) return Unauthorized();
                var data = await _service.UpdateAsync(id, request ?? new UpdateSalaryCertificateRequest(), userId, tenantId);
                if (data == null) return NotFound(new ApiResponse<object> { Success = false, Message = "Not found" });
                return Ok(new ApiResponse<SalaryCertificateDto> { Success = true, Data = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Update salary certificate {Id} failed", id);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to update salary certificate" });
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
                _logger.LogError(ex, "Delete salary certificate {Id} failed", id);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to delete salary certificate" });
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
                var cert = await _service.GetByIdAsync(id, tenantId);
                if (cert == null) return NotFound(new ApiResponse<object> { Success = false, Message = "Not found" });
                var bytes = await _pdf.GenerateSalaryCertificatePdfAsync(cert, tenantId, format, layout);
                var fmt = (format ?? "A4").Trim().ToUpperInvariant();
                return File(bytes, "application/pdf", $"{cert.CertificateNo}_{fmt}.pdf");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Salary certificate PDF {Id} failed", id);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "Failed to generate PDF" });
            }
        }
    }
}
