/*
 * Local filesystem implementation of IStorageService.
 * Uses tenant-isolated keys: tenants/{tenantId}/logos/{guid}.png
 * Base path: DATA_PATH env, or {ContentRoot}/data/uploads (persistent volume in Docker).
 */
using Microsoft.AspNetCore.Hosting;

namespace HexaBill.Api.Shared.Services;

public class LocalStorageService : IStorageService
{
    private readonly string _basePath;
    private readonly ILogger<LocalStorageService> _logger;

    public LocalStorageService(IWebHostEnvironment env, IConfiguration configuration, ILogger<LocalStorageService> logger)
    {
        _logger = logger;
        var dataPath = Environment.GetEnvironmentVariable("DATA_PATH")
            ?? configuration["Storage:BasePath"];
        if (!string.IsNullOrWhiteSpace(dataPath))
        {
            _basePath = Path.IsPathRooted(dataPath) ? dataPath : Path.Combine(env.ContentRootPath, dataPath);
        }
        else
        {
            _basePath = Path.Combine(env.ContentRootPath, "data", "uploads");
        }

        if (!Directory.Exists(_basePath))
        {
            Directory.CreateDirectory(_basePath);
            _logger.LogInformation("Created storage base directory: {Path}", _basePath);
        }
    }

    public Task<string> UploadAsync(string key, byte[] data, string contentType)
    {
        if (string.IsNullOrWhiteSpace(key))
            throw new ArgumentException("Storage key cannot be empty.", nameof(key));
        if (!key.Replace("\\", "/").StartsWith("tenants/", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Storage key must start with tenants/{tenantId}/.", nameof(key));

        var fullPath = Path.Combine(_basePath, key.Replace("/", Path.DirectorySeparatorChar.ToString()));
        var dir = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            Directory.CreateDirectory(dir);

        File.WriteAllBytes(fullPath, data);
        return Task.FromResult(key);
    }

    public Task<byte[]> ReadBytesAsync(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
            throw new ArgumentException("Storage key cannot be empty.", nameof(key));

        var fullPath = Path.Combine(_basePath, key.Replace("/", Path.DirectorySeparatorChar.ToString()));
        if (!File.Exists(fullPath))
            throw new FileNotFoundException("Storage file not found.", key);

        return Task.FromResult(File.ReadAllBytes(fullPath));
    }

    /// <summary>Returns path for use with secure endpoint: /api/storage/{key}</summary>
    public string GetPublicUrl(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return string.Empty;
        var normalized = key.TrimStart('/').Replace("\\", "/");
        return $"/api/storage/{normalized}";
    }
}
