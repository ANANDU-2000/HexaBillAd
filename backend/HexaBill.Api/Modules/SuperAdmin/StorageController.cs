/*
 * Secure tenant-isolated file serving. Only serves when path tenantId matches JWT tenantId.
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Shared.Extensions;
using HexaBill.Api.Shared.Services;

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
    [ResponseCache(Duration = 86400, Location = ResponseCacheLocation.Client, VaryByHeader = "Authorization")]
    public async Task<IActionResult> GetTenantLogo(int tenantId, string filename, CancellationToken ct)
    {
        var currentTenantId = CurrentTenantId;
        if (currentTenantId <= 0)
        {
            _logger.LogWarning("Storage: Unauthenticated or invalid tenant.");
            return Forbid();
        }
        if (tenantId != currentTenantId)
        {
            _logger.LogWarning("Storage: Tenant mismatch. Path tenantId={PathTenantId}, JWT tenantId={JwtTenantId}.", tenantId, currentTenantId);
            return Forbid();
        }

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
    [ResponseCache(Duration = 86400, Location = ResponseCacheLocation.Client, VaryByHeader = "Authorization")]
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
        if (currentTenantId <= 0)
            return Forbid();
        if (pathTenantId != currentTenantId)
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
            Response.Headers.CacheControl = "public, max-age=86400";
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
}
