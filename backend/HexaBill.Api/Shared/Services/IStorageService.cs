/*
 * Tenant-isolated file storage for logos and other assets.
 * Key format: tenants/{tenantId}/logos/{guid}.png
 */
namespace HexaBill.Api.Shared.Services;

public interface IStorageService
{
    /// <summary>Upload bytes to storage. Key must start with tenants/{tenantId}/.</summary>
    Task<string> UploadAsync(string key, byte[] data, string contentType);

    /// <summary>Read file bytes by key.</summary>
    Task<byte[]> ReadBytesAsync(string key);

    /// <summary>Public or secure URL for browser display (e.g. /api/storage/{key}).</summary>
    string GetPublicUrl(string key);
}
