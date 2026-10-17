/*
 * Secure tenant-isolated file serving. Only serves when path tenantId matches JWT tenantId.
 */
using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HexaBill.Api.Modules.SuperAdmin;

[ApiController]
[Route("api/storage")]
[Authorize]
public class StorageController : TenantScopedController
{
    private readonly IStorageService _storage;
    private readonly ILogger<StorageController> _logger;

    public StorageController(IStorageService storage, ILogger<StorageController> logger)
    {
        _storage = storage;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/storage/tenants/{tenantId}/logos/{filename}
    /// Returns 403 if path tenantId != current user's TenantId.
    /// </summary>
    [HttpGet("tenants/{tenantId:int}/logos/{*filename}")]
    [AllowAnonymous]
    [ResponseCache(Duration = 86400, Location = ResponseCacheLocation.Client, VaryByHeader = "Authorization")]
    public async Task<IActionResult> GetTenantLogo(int tenantId, string filename, CancellationToken ct)
    {
        if (!CanReadTenantFile(tenantId, logoOnly: true))
            return Forbid();

        var key = $"tenants/{tenantId}/logos/{filename?.TrimStart('/')}";
        try
        {
            var bytes = await _storage.ReadBytesAsync(key);
            var contentType = "image/png";
            if (!string.IsNullOrEmpty(filename) && (filename.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) || filename.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase)))
                contentType = "image/jpeg";
            else if (!string.IsNullOrEmpty(filename) && filename.EndsWith(".webp", StringComparison.OrdinalIgnoreCase))
                contentType = "image/webp";

            Response.Headers.CacheControl = "public, max-age=86400";
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            return File(bytes, contentType);
        }
        catch (FileNotFoundException)
        {
            return NotFound();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Storage: Failed to read key {Key}.", key);
            return StatusCode(500);
        }
    }

    /// <summary>
    /// GET /api/storage/{*key} - generic catch-all for keys like tenants/5/logos/guid.png
    /// Validates tenantId from key path matches JWT.
    /// </summary>
    [HttpGet("{*key}")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> GetByKey(string key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key))
            return BadRequest();
        key = key.TrimStart('/').Replace("\\", "/");
        if (!key.StartsWith("tenants/", StringComparison.OrdinalIgnoreCase))
            return BadRequest();

        var parts = key.Split('/');
        if (parts.Length < 4 || !int.TryParse(parts[1], out var pathTenantId))
            return BadRequest();

        var currentTenantId = CurrentTenantId;
        var logoOnly = parts.Length > 2 && parts[2].Equals("logos", StringComparison.OrdinalIgnoreCase);
        if (!CanReadTenantFile(pathTenantId, logoOnly))
        {
            _logger.LogWarning("Storage: Tenant mismatch. Path tenantId={PathTenantId}, JWT tenantId={JwtTenantId}.", pathTenantId, currentTenantId);
            return Forbid();
        }

        try
        {
            var bytes = await _storage.ReadBytesAsync(key);
            var contentType = "application/octet-stream";
            if (key.EndsWith(".png", StringComparison.OrdinalIgnoreCase)) contentType = "image/png";
            else if (key.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) || key.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase)) contentType = "image/jpeg";
            else if (key.EndsWith(".webp", StringComparison.OrdinalIgnoreCase)) contentType = "image/webp";
            // Only brand logos may be cached, and only by this browser. Licences, invoices and other files are never stored.
            Response.Headers.CacheControl = logoOnly ? "private, max-age=86400" : "private, no-store";
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            return File(bytes, contentType);
        }
        catch (FileNotFoundException)
        {
            return NotFound();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Storage: Failed to read key {Key}.", key);
            return StatusCode(500);
        }
    }

    private bool CanReadTenantFile(int pathTenantId, bool logoOnly)
    {
        var currentTenantId = CurrentTenantId;
        if (currentTenantId > 0)
            return currentTenantId == pathTenantId;
        if (!logoOnly)
            return false;
        var resolution = HttpContext.Items[TenantHostMiddleware.ResolutionItemKey] as TenantHostResolution;
        return resolution?.Kind == TenantHostKind.Tenant && resolution.TenantId == pathTenantId;
    }
}
