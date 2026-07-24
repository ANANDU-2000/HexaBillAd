/*
 * Stamp / signature upload for document PDFs.
 * Mirrors LogoUploadService: validate, resize, store under tenants/{id}/stamps|signatures/, Settings keys.
 * Does not convert to grayscale (colour stamps/signatures must stay blue).
 */
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Services;
using Microsoft.EntityFrameworkCore;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;

namespace HexaBill.Api.Modules.SuperAdmin;

public enum DocumentAssetKind
{
    Stamp,
    Signature
}

public interface IDocumentAssetUploadService
{
    Task<DocumentAssetUploadResult> UploadAsync(IFormFile file, int tenantId, int? userId, DocumentAssetKind kind, CancellationToken ct = default);
}

public class DocumentAssetUploadResult
{
    public string Url { get; set; } = "";
    public string StorageKey { get; set; } = "";
    public int Width { get; set; }
    public int Height { get; set; }
    public double FileSizeKb { get; set; }
}

public class DocumentAssetUploadService : IDocumentAssetUploadService
{
    private const int MaxBytes = 5 * 1024 * 1024;
    private const int MaxWidth = 800;
    private const int MaxHeight = 800;
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
        { "image/png", "image/jpeg", "image/jpg", "image/webp" };

    private readonly IStorageService _storage;
    private readonly AppDbContext _context;
    private readonly ILogger<DocumentAssetUploadService> _logger;

    public DocumentAssetUploadService(IStorageService storage, AppDbContext context, ILogger<DocumentAssetUploadService> logger)
    {
        _storage = storage;
        _context = context;
        _logger = logger;
    }

    public async Task<DocumentAssetUploadResult> UploadAsync(IFormFile file, int tenantId, int? userId, DocumentAssetKind kind, CancellationToken ct = default)
    {
        if (file == null || file.Length == 0)
            throw new ArgumentException("No file provided.");
        if (file.Length > MaxBytes)
            throw new ArgumentException("File too large. Maximum size is 5MB.");

        var contentType = (file.ContentType ?? "").Split(';')[0].Trim();
        if (!AllowedContentTypes.Contains(contentType))
            throw new ArgumentException("Invalid file type. Please upload PNG, JPG or WEBP only.");

        await using var stream = file.OpenReadStream();
        var header = new byte[12];
        var read = await stream.ReadAsync(header, 0, header.Length, ct);
        stream.Position = 0;
        if (!IsValidImageMagicBytes(header, read))
            throw new ArgumentException("Invalid image file.");

        using var image = await Image.LoadAsync(stream, ct);
        if (image.Width > MaxWidth || image.Height > MaxHeight)
        {
            image.Mutate(x => x.Resize(new ResizeOptions
            {
                Size = new Size(MaxWidth, MaxHeight),
                Mode = ResizeMode.Max
            }));
        }

        var png = new MemoryStream();
        await image.SaveAsPngAsync(png, ct);
        var bytes = png.ToArray();

        var folder = kind == DocumentAssetKind.Stamp ? "stamps" : "signatures";
        var prefix = kind == DocumentAssetKind.Stamp ? "STAMP" : "SIGNATURE";
        var guid = Guid.NewGuid();
        var storageKey = $"tenants/{tenantId}/{folder}/{guid}.png";

        await _storage.UploadAsync(storageKey, bytes, "image/png");
        var publicUrl = _storage.GetPublicUrl(storageKey);

        var previousKey = await GetSettingValueAsync(tenantId, $"{prefix}_STORAGE_KEY", ct);
        if (!string.IsNullOrWhiteSpace(previousKey))
        {
            var prevListKey = $"{prefix}_PREVIOUS_KEYS";
            var previousKeysJson = await GetSettingValueAsync(tenantId, prevListKey, ct);
            var list = string.IsNullOrWhiteSpace(previousKeysJson)
                ? new List<string>()
                : System.Text.Json.JsonSerializer.Deserialize<List<string>>(previousKeysJson) ?? new List<string>();
            list.Add(previousKey);
            await SetOrAddAsync(tenantId, prevListKey, System.Text.Json.JsonSerializer.Serialize(list), ct);
        }

        await SetOrAddAsync(tenantId, $"{prefix}_STORAGE_KEY", storageKey, ct);
        await SetOrAddAsync(tenantId, $"{prefix}_PUBLIC_URL", publicUrl, ct);
        await SetOrAddAsync(tenantId, $"{prefix}_ORIGINAL_NAME", file.FileName ?? $"{folder}.png", ct);
        await SetOrAddAsync(tenantId, $"{prefix}_MIME_TYPE", "image/png", ct);
        await SetOrAddAsync(tenantId, $"{prefix}_FILE_SIZE_BYTES", bytes.Length.ToString(), ct);
        await SetOrAddAsync(tenantId, $"{prefix}_UPLOADED_AT", DateTime.UtcNow.ToString("O"), ct);
        await SetOrAddAsync(tenantId, $"{prefix}_UPLOADED_BY_USER_ID", userId?.ToString() ?? "", ct);

        if (bytes.Length <= 500_000)
        {
            var dataUri = $"data:image/png;base64,{Convert.ToBase64String(bytes)}";
            await SetOrAddAsync(tenantId, $"{prefix}_BASE64_DATA_URI", dataUri, ct);
        }

        await _context.SaveChangesAsync(ct);
        _logger.LogInformation("Document asset uploaded: kind={Kind} tenant={TenantId} key={Key} bytes={Bytes}",
            kind, tenantId, storageKey, bytes.Length);

        return new DocumentAssetUploadResult
        {
            Url = publicUrl,
            StorageKey = storageKey,
            Width = image.Width,
            Height = image.Height,
            FileSizeKb = Math.Round(bytes.Length / 1024.0, 2)
        };
    }

    private static bool IsValidImageMagicBytes(byte[] header, int length)
    {
        if (length < 4) return false;
        if (length >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47)
            return true;
        if (length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
            return true;
        if (length >= 12 && header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46
            && header[8] == 0x57 && header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50)
            return true;
        return false;
    }

    private async Task<string> GetSettingValueAsync(int tenantId, string key, CancellationToken ct)
    {
        var setting = await _context.Settings
            .AsNoTracking()
            .Where(s => s.Key == key && (s.OwnerId == tenantId || s.TenantId == tenantId))
            .OrderByDescending(s => s.OwnerId == tenantId)
            .FirstOrDefaultAsync(ct);
        return setting?.Value ?? "";
    }

    private async Task SetOrAddAsync(int tenantId, string key, string value, CancellationToken ct)
    {
        var setting = await _context.Settings
            .FirstOrDefaultAsync(s => s.Key == key && (s.OwnerId == tenantId || s.TenantId == tenantId), ct);
        if (setting != null)
        {
            setting.Value = value;
            setting.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _context.Settings.Add(new Setting
            {
                Key = key,
                OwnerId = tenantId,
                TenantId = tenantId,
                Value = value,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }
    }
}
