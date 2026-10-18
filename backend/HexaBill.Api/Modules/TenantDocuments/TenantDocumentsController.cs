using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HexaBill.Api.Modules.TenantDocuments;

/// <summary>
/// Company documents. Scope comes from the token: the request never names a company, and files are reached only by
/// document id, never by storage path. Upload, approve and delete are for owners and admins.
/// </summary>
[ApiController]
[Route("api/tenant-documents")]
[Authorize]
public class TenantDocumentsController : TenantScopedController
{
    private readonly TenantDocumentService _documents;
    private readonly ILogger<TenantDocumentsController> _logger;

    public TenantDocumentsController(TenantDocumentService documents, ILogger<TenantDocumentsController> logger)
    {
        _documents = documents;
        _logger = logger;
    }

    private bool TryCaller(out DocumentCaller caller)
    {
        caller = new DocumentCaller(0, 0, false);
        var tenantId = CurrentTenantId;
        if (tenantId <= 0 || IsSystemAdmin) return false;
        var userClaim = User.FindFirst("UserId") ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? User.FindFirst("id");
        if (userClaim == null || !int.TryParse(userClaim.Value, out var userId)) return false;
        caller = new DocumentCaller(tenantId, userId, User.IsInRole("Owner") || User.IsInRole("Admin"));
        return true;
    }

    private async Task<IActionResult> Run<T>(Func<DocumentCaller, Task<T>> action, int okStatus = 200)
    {
        if (!TryCaller(out var caller)) return Forbid();
        try
        {
            var data = await action(caller);
            return StatusCode(okStatus, new ApiResponse<T> { Success = true, Message = "OK", Data = data });
        }
        catch (DocumentException ex)
        {
            return StatusCode(ex.StatusCode, new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Tenant document action failed for tenant {TenantId}", caller.TenantId);
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "The document action could not be completed. Check the list before trying again." });
        }
    }

    [HttpGet]
    public Task<IActionResult> List(CancellationToken ct) => Run(c => _documents.ListAsync(c, ct));

    [HttpGet("{id:guid}")]
    public Task<IActionResult> Get(Guid id, CancellationToken ct) => Run(c => _documents.GetAsync(c, id, ct));

    public sealed class UploadForm
    {
        public IFormFile? File { get; set; }
        public Guid? DocumentId { get; set; }
        public string? Title { get; set; }
        public string? DocType { get; set; }
        public string? Visibility { get; set; }
        public DateTime? ExpiresOn { get; set; }
    }

    /// <summary>Upload a new document, or a new version of one (pass documentId). The version waits for approval.</summary>
    [HttpPost]
    [RequestSizeLimit(21 * 1024 * 1024)]
    public Task<IActionResult> Upload([FromForm] UploadForm form, CancellationToken ct) => Run(async c =>
    {
        if (form.File == null || form.File.Length == 0) throw new DocumentException(400, "Choose a file to upload.");
        if (form.File.Length > TenantDocumentFileCheck.MaxDocumentBytes) throw new DocumentException(400, "Documents can be at most 20 MB.");
        byte[] data;
        await using (var stream = form.File.OpenReadStream())
        {
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms, ct);
            data = ms.ToArray();
        }
        return await _documents.UploadAsync(c, new TenantDocumentService.UploadRequest
        {
            DocumentId = form.DocumentId, Title = form.Title, DocType = form.DocType, Visibility = form.Visibility,
            ExpiresOn = form.ExpiresOn, FileName = form.File.FileName, Data = data
        }, ct);
    }, 201);

    [HttpPost("{id:guid}/versions/{versionId:guid}/approve")]
    public Task<IActionResult> Approve(Guid id, Guid versionId, CancellationToken ct) => Run(c => _documents.ApproveAsync(c, id, versionId, ct));

    [HttpDelete("{id:guid}")]
    public Task<IActionResult> Delete(Guid id, CancellationToken ct) => Run(async c => { await _documents.DeleteAsync(c, id, ct); return true; });

    /// <summary>Download the approved version (or, for owners and admins, a chosen version). Always an attachment, never rendered inline.</summary>
    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id, [FromQuery] Guid? versionId, CancellationToken ct)
    {
        if (!TryCaller(out var caller)) return Forbid();
        try
        {
            var file = await _documents.DownloadAsync(caller, id, versionId, ct);
            Response.Headers["Cache-Control"] = "private, no-store";
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            Response.Headers["Content-Security-Policy"] = "default-src 'none'; sandbox";
            return File(file.Bytes, file.ContentType, SafeDownloadName(file.FileName));
        }
        catch (DocumentException ex)
        {
            return StatusCode(ex.StatusCode, new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Tenant document download failed for tenant {TenantId}", caller.TenantId);
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "The file could not be downloaded." });
        }
    }

    // File(..., fileDownloadName) sends Content-Disposition: attachment and encodes odd characters.
    private static string SafeDownloadName(string name) => TenantDocumentFileCheck.CleanFileName(name);
}
