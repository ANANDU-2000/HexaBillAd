/*
 * Sales Ledger Import - Upload Excel/CSV, map columns, preview, apply import.
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Import;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.Import
{
    [ApiController]
    [Route("api/import")]
    [Authorize]
    public class SalesLedgerImportController : TenantScopedController
    {
        private readonly ISalesLedgerImportService _importService;

        public SalesLedgerImportController(ISalesLedgerImportService importService)
        {
            _importService = importService;
        }

        /// <summary>
        /// Parse uploaded file (Excel or CSV) and return headers + rows for preview and column mapping.
        /// </summary>
        [HttpPost("sales-ledger/parse")]
        [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB
        public async Task<ActionResult<ApiResponse<SalesLedgerParseResult>>> ParseSalesLedgerFile(IFormFile file, [FromQuery] int maxRows = 500)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new ApiResponse<SalesLedgerParseResult> { Success = false, Message = "No file uploaded. Please select an Excel or CSV file." });

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext == ".pdf")
                return BadRequest(new ApiResponse<SalesLedgerParseResult> { Success = false, Message = "PDF upload is not supported. Please export your sales ledger from the other app as Excel (.xlsx) or CSV and upload that file." });
            if (ext != ".csv" && ext != ".xlsx" && ext != ".xls")
                return BadRequest(new ApiResponse<SalesLedgerParseResult> { Success = false, Message = "Unsupported file type. Use Excel (.xlsx, .xls) or CSV only." });

            try
            {
                await using var stream = file.OpenReadStream();
                var result = await _importService.ParseFileAsync(stream, file.FileName, maxRows);
                if (!string.IsNullOrEmpty(result.Error))
                    return BadRequest(new ApiResponse<SalesLedgerParseResult> { Success = false, Message = result.Error, Data = result });
                return Ok(new ApiResponse<SalesLedgerParseResult>
                {
                    Success = true,
                    Message = "File parsed. Map columns and apply to import.",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<SalesLedgerParseResult>
                {
                    Success = false,
                    Message = "Failed to parse file.",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Apply import: create customers, sales, and payments from mapped rows.
        /// </summary>
        [HttpPost("sales-ledger/apply")]
        public async Task<ActionResult<ApiResponse<SalesLedgerApplyResult>>> ApplySalesLedgerImport([FromBody] SalesLedgerApplyRequest request)
        {
            if (request?.Rows == null || request.Rows.Count == 0)
                return BadRequest(new ApiResponse<SalesLedgerApplyResult> { Success = false, Message = "No rows to import." });

            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)
                ?? User.FindFirst("UserId") ?? User.FindFirst("id");
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId) || userId == 0)
                return Unauthorized(new ApiResponse<SalesLedgerApplyResult> { Success = false, Message = "Invalid user." });

            var tenantId = CurrentTenantId;
            try
            {
                var result = await _importService.ApplyImportAsync(tenantId, userId, request);
                return Ok(new ApiResponse<SalesLedgerApplyResult>
                {
                    Success = true,
                    Message = $"Imported: {result.SalesCreated} sales, {result.CustomersCreated} customers, {result.PaymentsCreated} payments. Skipped: {result.Skipped}. Errors: {result.Errors.Count}",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<SalesLedgerApplyResult>
                {
                    Success = false,
                    Message = "Import failed.",
                    Errors = new List<string> { ex.Message }
                });
            }
        }
    }
}
