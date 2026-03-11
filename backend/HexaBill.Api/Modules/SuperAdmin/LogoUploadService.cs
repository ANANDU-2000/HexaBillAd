/*
 * Logo upload: validation (size, type, magic bytes), resize + B&W via ImageSharp,
 * tenant-isolated storage keys, never delete old files.
 */
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Services;
using Microsoft.EntityFrameworkCore;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;

namespace HexaBill.Api.Modules.SuperAdmin;

public interface ILogoUploadService
{
    Task<LogoUploadResult> UploadAsync(IFormFile file, int tenantId, int? userId, CancellationToken ct = default);
}

public class LogoUploadResult
{
    public string LogoUrl { get; set; } = "";
    public int Width { get; set; }
    public int Height { get; set; }
    public double FileSizeKb { get; set; }
}

public class LogoUploadService : ILogoUploadService
{
    private const int MaxBytes = 5 * 1024 * 1024; // 5MB
    private const int MaxWidth = 400;
    private const int MaxHeight = 200;
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
        { "image/png", "image/jpeg", "image/jpg", "image/webp" };

    private readonly IStorageService _storage;
    private readonly AppDbContext _context;
    private readonly ILogger<LogoUploadService> _logger;

    public LogoUploadService(IStorageService storage, AppDbContext context, ILogger<LogoUploadService> logger)
    {
        _storage = storage;
        _context = context;
        _logger = logger;
    }

    public async Task<LogoUploadResult> UploadAsync(IFormFile file, int tenantId, int? userId, CancellationToken ct = default)
    {
        if (file == null || file.Length == 0)
            throw new ArgumentException("No file provided.");

        if (file.Length > MaxBytes)
            throw new ArgumentException("File too large. Maximum size is 5MB.");

        var contentType = (file.ContentType ?? "").Split(';')[0].Trim();
        if (!AllowedContentTypes.Contains(contentType))
            throw new ArgumentException("Invalid file type. Please upload PNG, JPG or WEBP only.");

        // Magic bytes: PNG 89 50 4E 47, JPEG FF D8 FF, WEBP RIFF....WEBP
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

        var colourPng = new MemoryStream();
        await image.SaveAsPngAsync(colourPng, ct);
        var colourBytes = colourPng.ToArray();

        image.Mutate(x => x.Grayscale());
        var bwPng = new MemoryStream();
        await image.SaveAsPngAsync(bwPng, ct);
        var bwBytes = bwPng.ToArray();

        var guid = Guid.NewGuid();
        var colourKey = $"tenants/{tenantId}/logos/{guid}.png";
        var bwKey = $"tenants/{tenantId}/logos/{guid}_bw.png";

        await _storage.UploadAsync(colourKey, colourBytes, "image/png");
        await _storage.UploadAsync(bwKey, bwBytes, "image/png");

        var publicUrl = _storage.GetPublicUrl(colourKey);
        var fileSizeKb = colourBytes.Length / 1024.0;

        // Archive previous key and update settings
        var settingsList = await _context.Settings
            .Where(s => (s.TenantId == tenantId || s.OwnerId == tenantId) &&
                (s.Key == "LOGO_STORAGE_KEY" || s.Key == "LOGO_PUBLIC_URL" || s.Key == "LOGO_ORIGINAL_NAME" ||
                 s.Key == "LOGO_MIME_TYPE" || s.Key == "LOGO_FILE_SIZE_BYTES" || s.Key == "LOGO_UPLOADED_AT" ||
                 s.Key == "LOGO_UPLOADED_BY_USER_ID" || s.Key == "LOGO_PREVIOUS_KEYS"))
            .ToListAsync(ct);

        var dict = settingsList.ToDictionary(s => s.Key, s => s);
        var previousKey = GetSettingValue(dict, "LOGO_STORAGE_KEY");
        if (!string.IsNullOrWhiteSpace(previousKey))
        {
            var previousKeysJson = GetSettingValue(dict, "LOGO_PREVIOUS_KEYS");
            var list = string.IsNullOrWhiteSpace(previousKeysJson)
                ? new List<string>()
                : System.Text.Json.JsonSerializer.Deserialize<List<string>>(previousKeysJson) ?? new List<string>();
            list.Add(previousKey);
            await SetOrAddAsync(tenantId, "LOGO_PREVIOUS_KEYS", System.Text.Json.JsonSerializer.Serialize(list), ct);
        }

        await SetOrAddAsync(tenantId, "LOGO_STORAGE_KEY", colourKey, ct);
        await SetOrAddAsync(tenantId, "LOGO_PUBLIC_URL", publicUrl, ct);
        await SetOrAddAsync(tenantId, "LOGO_ORIGINAL_NAME", file.FileName ?? "logo.png", ct);
        await SetOrAddAsync(tenantId, "LOGO_MIME_TYPE", "image/png", ct);
        await SetOrAddAsync(tenantId, "LOGO_FILE_SIZE_BYTES", colourBytes.Length.ToString(), ct);
        await SetOrAddAsync(tenantId, "LOGO_UPLOADED_AT", DateTime.UtcNow.ToString("O"), ct);
        await SetOrAddAsync(tenantId, "LOGO_UPLOADED_BY_USER_ID", userId?.ToString() ?? "", ct);
        // Backward compat: also set COMPANY_LOGO / LOGO_PATH so existing code that reads LogoPath still gets a URL
        await SetOrAddAsync(tenantId, "COMPANY_LOGO", publicUrl, ct);
        await SetOrAddAsync(tenantId, "LOGO_PATH", publicUrl, ct);

        await _context.SaveChangesAsync(ct);

        return new LogoUploadResult
        {
            LogoUrl = publicUrl,
            Width = image.Width,
            Height = image.Height,
            FileSizeKb = Math.Round(fileSizeKb, 2)
        };
    }

    private static bool IsValidImageMagicBytes(byte[] header, int length)
    {
        if (length < 4) return false;
        // PNG
        if (length >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47)
            return true;
        // JPEG
        if (length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
            return true;
        // WEBP: RIFF....WEBP
        if (length >= 12 && header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46
            && header[8] == 0x57 && header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50)
            return true;
        return false;
    }

    private static string GetSettingValue(Dictionary<string, Setting> dict, string key)
    {
        return dict.TryGetValue(key, out var s) && s?.Value != null ? s.Value : "";
    }

    private async Task SetOrAddAsync(int tenantId, string key, string value, CancellationToken ct)
    {
        var setting = await _context.Settings
            .FirstOrDefaultAsync(s => s.Key == key && (s.OwnerId == tenantId || s.TenantId == tenantId), ct);
        if (setting != null)
        {
            setting.Value = value;
            setting.UpdatedAt = DateTime.UtcNow;
            // Do not change OwnerId (part of PK); read path prefers OwnerId=tenantId when duplicates exist
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
