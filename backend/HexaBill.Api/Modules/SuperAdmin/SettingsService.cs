/*
 * Settings Service - Owner-Specific Company Settings Management
 * Purpose: Allow each owner to configure their company details for invoices/statements
 * Author: AI Assistant
 * Date: 2024-12-24
 */

using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.SuperAdmin
{
    public class LogoMetadata
    {
        public string LogoUrl { get; set; } = "";
        public DateTime? UploadedAt { get; set; }
        public double FileSizeKb { get; set; }
        public string OriginalName { get; set; } = "";
    }

        public interface ISettingsService
        {
            Task<Dictionary<string, string>> GetOwnerSettingsAsync(int tenantId);
            Task<string?> GetSettingValueAsync(int tenantId, string key);
            Task<bool> UpdateOwnerSettingAsync(int tenantId, string key, string value);
            Task<bool> UpdateOwnerSettingsBulkAsync(int tenantId, Dictionary<string, string> settings);
            Task<CompanySettings> GetCompanySettingsAsync(int tenantId);
            Task<LogoMetadata?> GetLogoMetadataAsync(int tenantId);
            Task ClearLogoAsync(int tenantId);
            Task ClearStampAsync(int tenantId);
            Task ClearSignatureAsync(int tenantId);
            /// <summary>Count other tenants that store the same VAT TRN (shared TRNs are allowed).</summary>
            Task<int> CountOtherTenantsSharingVatTrnAsync(int tenantId, string? vatTrn);
        }

    public class SettingsService : ISettingsService
    {
        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor? _http;

        public SettingsService(AppDbContext context, IHttpContextAccessor? http = null)
        {
            _context = context;
            _http = http;
        }

        private void EnsureTenant(int tenantId)
        {
            if (tenantId <= 0 || (_context.RequestScopeEstablished && !_context.RequestIsPlatformScope && _context.RequestTenantId != tenantId))
                throw new UnauthorizedAccessException("Settings require a verified workspace.");
        }

        public async Task<Dictionary<string, string>> GetOwnerSettingsAsync(int tenantId)
        {
            EnsureTenant(tenantId);
            // TenantId is authoritative; OwnerId is only a fallback for unmigrated rows.
            // Reads must never alter schema or hide a database failure behind defaults.
            var rows = await _context.Settings.AsNoTracking()
                .Where(s => s.TenantId == tenantId || (s.TenantId == null && s.OwnerId == tenantId))
                .ToListAsync();
            var settings = GetDefaultSettings();
            foreach (var group in rows.GroupBy(s => s.Key))
                settings[group.Key] = group.OrderByDescending(s => s.TenantId == tenantId)
                    .ThenByDescending(s => s.OwnerId == tenantId).First().Value ?? "";
            settings["vat_trn"] = settings["COMPANY_TRN"];
            settings["corporate_tax_trn"] = settings.GetValueOrDefault("CORPORATE_TAX_TRN", "");
            EnsureCompanyLogoFromLogoUrl(settings);
            return settings;
        }

        private static string NormalizeKey(string key) => key.Trim() switch
        {
            "vat_trn" => "COMPANY_TRN",
            "corporate_tax_trn" => "CORPORATE_TAX_TRN",
            var other => other
        };

        private static Dictionary<string, string> ValidateSettings(Dictionary<string, string> settings)
        {
            var result = new Dictionary<string, string>();
            foreach (var pair in settings)
            {
                if (string.IsNullOrWhiteSpace(pair.Key) || pair.Key.Trim().Length > 100)
                    throw new ArgumentException("Setting name is invalid.");
                var key = NormalizeKey(pair.Key);
                var value = pair.Value ?? "";
                if (key == "COMPANY_TRN")
                {
                    value = value.Trim();
                    if (value.Length != 0 && (value.Length != 15 || value.Any(c => c < '0' || c > '9')))
                        throw new ArgumentException("VAT TRN must contain exactly 15 digits, or be empty.");
                }
                if (key == "INVOICE_HEADER_STYLE" && value != "Legacy" && value != "BilingualMonochrome")
                    throw new ArgumentException("Select a supported document header style.");
                if (result.TryGetValue(key, out var existing) && existing != value)
                    throw new ArgumentException("Conflicting values supplied for the same setting.");
                result[key] = value;
            }
            return result;
        }

        private void AuditSetting(int tenantId, string key, string? oldValue, string newValue)
        {
            if (oldValue == newValue) return;
            var principal = _http?.HttpContext?.User;
            var id = principal?.FindFirst("UserId")?.Value
                ?? principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? principal?.FindFirst("sub")?.Value ?? principal?.FindFirst("id")?.Value;
            if (!int.TryParse(id, out var actor) || actor <= 0)
            {
                if (_http?.HttpContext != null)
                    throw new UnauthorizedAccessException("An authenticated user is required to change settings.");
                return; // Internal provisioning has its own provisioning audit.
            }
            // Never copy credentials or token values into the audit trail.
            var sensitive = key.Contains("SECRET", StringComparison.OrdinalIgnoreCase)
                || key.Contains("TOKEN", StringComparison.OrdinalIgnoreCase)
                || key.Contains("PASSWORD", StringComparison.OrdinalIgnoreCase)
                || key.Contains("API_KEY", StringComparison.OrdinalIgnoreCase);
            _context.AuditLogs.Add(new AuditLog {
                TenantId = tenantId, OwnerId = tenantId, UserId = actor,
                Action = "SettingsChanged", EntityType = "Setting", CreatedAt = DateTime.UtcNow,
                Details = key,
                OldValues = System.Text.Json.JsonSerializer.Serialize(new { key, value = sensitive ? "[redacted]" : oldValue }),
                NewValues = System.Text.Json.JsonSerializer.Serialize(new { key, value = sensitive ? "[redacted]" : newValue })
            });
        }

        /// <summary>Get a single setting value by key for the tenant. Returns null if not found.</summary>
        public async Task<string?> GetSettingValueAsync(int tenantId, string key)
        {
            if (string.IsNullOrWhiteSpace(key)) return null;
            var dict = await GetOwnerSettingsAsync(tenantId);
            return dict.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v : null;
        }

        /// <summary>
        /// Update a single setting. Table PK is (Key, OwnerId). Find by OwnerId first, then TenantId; when adding use OwnerId = tenantId.
        /// </summary>
        public Task<bool> UpdateOwnerSettingAsync(int tenantId, string key, string value) =>
            UpdateOwnerSettingsBulkAsync(tenantId, new Dictionary<string, string> { [key] = value });

        /// <summary>
        /// Update multiple settings in bulk. PK is (Key, OwnerId). Find by OwnerId then TenantId; when adding set OwnerId = tenantId to avoid duplicate key.
        /// </summary>
        public async Task<bool> UpdateOwnerSettingsBulkAsync(int tenantId, Dictionary<string, string> settings)
        {
            EnsureTenant(tenantId);
            if (settings == null || settings.Count == 0) return true;
            settings = ValidateSettings(settings);

            // Logo keys: do not overwrite with empty when user saves other company settings (e.g. name only) so logo persists after refresh
            var logoKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    "LOGO_STORAGE_KEY", "LOGO_PUBLIC_URL", "COMPANY_LOGO", "LOGO_PATH", "LOGO_ORIGINAL_NAME", "LOGO_MIME_TYPE", "LOGO_FILE_SIZE_BYTES", "LOGO_UPLOADED_AT", "LOGO_UPLOADED_BY_USER_ID", "LOGO_PREVIOUS_KEYS", "LOGO_BASE64_DATA_URI",
                    "STAMP_STORAGE_KEY", "STAMP_PUBLIC_URL", "STAMP_ORIGINAL_NAME", "STAMP_MIME_TYPE", "STAMP_FILE_SIZE_BYTES", "STAMP_UPLOADED_AT", "STAMP_UPLOADED_BY_USER_ID", "STAMP_PREVIOUS_KEYS", "STAMP_BASE64_DATA_URI",
                    "SIGNATURE_STORAGE_KEY", "SIGNATURE_PUBLIC_URL", "SIGNATURE_ORIGINAL_NAME", "SIGNATURE_MIME_TYPE", "SIGNATURE_FILE_SIZE_BYTES", "SIGNATURE_UPLOADED_AT", "SIGNATURE_UPLOADED_BY_USER_ID", "SIGNATURE_PREVIOUS_KEYS", "SIGNATURE_BASE64_DATA_URI"
                };
            foreach (var kvp in settings)
            {
                var key = kvp.Key?.Trim();
                if (string.IsNullOrEmpty(key) || key.Length > 100)
                    continue;
                var value = kvp.Value ?? string.Empty;
                if (logoKeys.Contains(key) && string.IsNullOrWhiteSpace(value))
                    continue; // preserve existing logo when bulk update sends empty

                var setting = await _context.Settings
                    .FirstOrDefaultAsync(s => s.Key == key && s.TenantId == tenantId);
                if (setting == null)
                    setting = await _context.Settings
                        .FirstOrDefaultAsync(s => s.Key == key && s.TenantId == null && s.OwnerId == tenantId);

                AuditSetting(tenantId, key, setting?.Value, value);
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

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<int> CountOtherTenantsSharingVatTrnAsync(int tenantId, string? vatTrn)
        {
            if (string.IsNullOrWhiteSpace(vatTrn) || vatTrn.Length != 15)
                return 0;
            return await _context.Settings.AsNoTracking()
                .Where(s => s.Key == "COMPANY_TRN" && s.Value == vatTrn && s.TenantId != null && s.TenantId != tenantId)
                .Select(s => s.TenantId!.Value)
                .Distinct()
                .CountAsync();
        }

        /// <summary>
        /// Get company settings as CompanySettings object for invoice generation. Data isolation: settings (including logo key) are for the given tenantId only.
        /// </summary>
        public async Task<CompanySettings> GetCompanySettingsAsync(int tenantId)
        {
            var settingsDict = await GetOwnerSettingsAsync(tenantId);

            var logoKey = GetLogoStorageKeyForInvoice(settingsDict);
            ValidateAssetKey(logoKey, tenantId, "logos");
            var stampKey = NullIfEmpty(settingsDict.GetValueOrDefault("STAMP_STORAGE_KEY", ""));
            var signatureKey = NullIfEmpty(settingsDict.GetValueOrDefault("SIGNATURE_STORAGE_KEY", ""));
            ValidateAssetKey(stampKey, tenantId, "stamps");
            ValidateAssetKey(signatureKey, tenantId, "signatures");
            return new CompanySettings
            {
                LegalNameEn = settingsDict.GetValueOrDefault("COMPANY_NAME_EN", ""),
                LegalNameAr = settingsDict.GetValueOrDefault("COMPANY_NAME_AR", ""),
                VatNumber = settingsDict.GetValueOrDefault("COMPANY_TRN", ""),
                CorporateTaxTrn = settingsDict.GetValueOrDefault("CORPORATE_TAX_TRN", ""),
                Email = settingsDict.GetValueOrDefault("COMPANY_EMAIL", ""),
                Website = settingsDict.GetValueOrDefault("COMPANY_WEBSITE", ""),
                LogoDataUri = NullIfEmpty(settingsDict.GetValueOrDefault("LOGO_BASE64_DATA_URI", "")),
                BilingualMonochromeHeader = settingsDict.GetValueOrDefault("INVOICE_HEADER_STYLE", "") == "BilingualMonochrome",
                SettingsVersion = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(System.Text.Json.JsonSerializer.Serialize(settingsDict.Where(p => p.Key.StartsWith("COMPANY_") || p.Key.StartsWith("LOGO_") || p.Key == "INVOICE_HEADER_STYLE").OrderBy(p => p.Key))))),
                Address = settingsDict.GetValueOrDefault("COMPANY_ADDRESS", ""),
                Mobile = settingsDict.GetValueOrDefault("COMPANY_PHONE", ""),
                VatEffectiveDate = settingsDict.GetValueOrDefault("VAT_EFFECTIVE_DATE", "01-01-2026"),
                VatLegalText = settingsDict.GetValueOrDefault("VAT_LEGAL_TEXT", "VAT registered under Federal Decree-Law No. 8 of 2017, UAE"),
                Currency = settingsDict.GetValueOrDefault("CURRENCY", "AED"),
                VatPercent = decimal.TryParse(settingsDict.GetValueOrDefault("VAT_PERCENT", "5"), out var vat) ? vat : 5.0m,
                InvoicePrefix = settingsDict.GetValueOrDefault("INVOICE_PREFIX", "FM"),
                LogoPath = string.IsNullOrEmpty(logoKey) ? "" : $"/api/storage/{logoKey}",
                LogoStorageKey = logoKey,
                LetterheadOnlyPrint = IsTruthy(settingsDict.GetValueOrDefault("Feature_LetterheadOnlyPrint", "false")),
                DocumentStampSignatureEnabled = IsTruthy(settingsDict.GetValueOrDefault("Feature_DocumentStampSignature", "false")),
                PrintMarginTopMm = ParseFloatSetting(settingsDict, "PRINT_MARGIN_TOP_MM", 5f),
                PrintMarginBottomMm = ParseFloatSetting(settingsDict, "PRINT_MARGIN_BOTTOM_MM", 5f),
                StampStorageKey = stampKey,
                StampPublicUrl = NullIfEmpty(settingsDict.GetValueOrDefault("STAMP_PUBLIC_URL", "")),
                SignatureStorageKey = signatureKey,
                SignaturePublicUrl = NullIfEmpty(settingsDict.GetValueOrDefault("SIGNATURE_PUBLIC_URL", "")),
                StampWidthMm = ParseFloatSetting(settingsDict, "STAMP_WIDTH_MM", 38f),
                SignatureWidthMm = ParseFloatSetting(settingsDict, "SIGNATURE_WIDTH_MM", 42f),
                StampAlign = (settingsDict.GetValueOrDefault("STAMP_ALIGN", "right") ?? "right").Trim().ToLowerInvariant() == "left" ? "left" : "right",
                StampOffsetRightMm = ParseFloatSetting(settingsDict, "STAMP_OFFSET_RIGHT_MM", 55f),
                StampOffsetBottomMm = ParseFloatSetting(settingsDict, "STAMP_OFFSET_BOTTOM_MM", 18f),
                SignatureOffsetRightMm = ParseFloatSetting(settingsDict, "SIGNATURE_OFFSET_RIGHT_MM", 12f),
                SignatureOffsetBottomMm = ParseFloatSetting(settingsDict, "SIGNATURE_OFFSET_BOTTOM_MM", 14f),
            };
        }

        /// <summary>
        /// When COMPANY_TRN is empty, assign the tenant's sample TRN (FrozenHub/GulfHarvest).
        /// Zayogya and unknown slugs are never auto-filled (D6 / SampleForSlug null).
        /// </summary>

        private static void ValidateAssetKey(string? key, int tenantId, string folder)
        {
            if (string.IsNullOrEmpty(key)) return;
            if (!key.StartsWith($"tenants/{tenantId}/{folder}/", StringComparison.Ordinal)
                || key.Contains('\\') || key.Split('/').Any(segment => segment is "." or ".."))
                throw new InvalidOperationException("A document image is unavailable in this workspace. Upload it again in Settings.");
        }

        private static bool IsTruthy(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return false;
            return raw.Equals("true", StringComparison.OrdinalIgnoreCase)
                || raw.Equals("1", StringComparison.OrdinalIgnoreCase)
                || raw.Equals("yes", StringComparison.OrdinalIgnoreCase);
        }

        private static float ParseFloatSetting(Dictionary<string, string> dict, string key, float fallback)
        {
            if (dict.TryGetValue(key, out var raw) && float.TryParse(raw, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var v))
                return v;
            return fallback;
        }

        private static string? NullIfEmpty(string? s) => string.IsNullOrWhiteSpace(s) ? null : s;

        /// <summary>Resolve logo storage key for PDF: prefer LOGO_STORAGE_KEY; fallback to key derived from COMPANY_LOGO / LOGO_PUBLIC_URL / LOGO_PATH when it looks like a storage path (so invoice header shows uploaded logo).</summary>
        private static string? GetLogoStorageKeyForInvoice(Dictionary<string, string> settingsDict)
        {
            if (settingsDict.TryGetValue("LOGO_STORAGE_KEY", out var keyVal) && !string.IsNullOrWhiteSpace(keyVal))
                return keyVal;
            var companyLogo = settingsDict.GetValueOrDefault("COMPANY_LOGO", settingsDict.GetValueOrDefault("LOGO_PUBLIC_URL", settingsDict.GetValueOrDefault("LOGO_PATH", "")));
            if (!string.IsNullOrWhiteSpace(companyLogo) && companyLogo.Contains("tenants/", StringComparison.OrdinalIgnoreCase) && companyLogo.Contains("logos/", StringComparison.OrdinalIgnoreCase))
            {
                var idx = companyLogo.IndexOf("tenants/", StringComparison.OrdinalIgnoreCase);
                return companyLogo.Substring(idx).Split('?')[0].Trim();
            }
            return null;
        }

        /// <summary>Get logo metadata for GET /api/settings/logo or GET /api/Admin/logo.</summary>
        public async Task<LogoMetadata?> GetLogoMetadataAsync(int tenantId)
        {
            var dict = await GetOwnerSettingsAsync(tenantId);
            var url = dict.GetValueOrDefault("LOGO_PUBLIC_URL", dict.GetValueOrDefault("COMPANY_LOGO", ""));
            if (string.IsNullOrWhiteSpace(url)) return null;
            var bytesStr = dict.GetValueOrDefault("LOGO_FILE_SIZE_BYTES", "");
            var fileSizeKb = double.TryParse(bytesStr, out var b) ? Math.Round(b / 1024.0, 2) : 0;
            var uploadedAt = dict.GetValueOrDefault("LOGO_UPLOADED_AT", "");
            DateTime? dt = DateTime.TryParse(uploadedAt, out var parsed) ? parsed : null;
            return new LogoMetadata
            {
                LogoUrl = url,
                UploadedAt = dt,
                FileSizeKb = fileSizeKb,
                OriginalName = dict.GetValueOrDefault("LOGO_ORIGINAL_NAME", "")
            };
        }

        /// <summary>Clear logo settings. Does NOT delete files from storage.</summary>
        public async Task ClearLogoAsync(int tenantId)
        {
            var keys = new[] { "LOGO_STORAGE_KEY", "LOGO_PUBLIC_URL", "LOGO_ORIGINAL_NAME", "LOGO_MIME_TYPE", "LOGO_FILE_SIZE_BYTES", "LOGO_UPLOADED_AT", "LOGO_UPLOADED_BY_USER_ID", "COMPANY_LOGO", "LOGO_PATH", "LOGO_BASE64_DATA_URI" };
            await ClearSettingKeysAsync(tenantId, keys);
        }

        public async Task ClearStampAsync(int tenantId)
        {
            var keys = new[] { "STAMP_STORAGE_KEY", "STAMP_PUBLIC_URL", "STAMP_ORIGINAL_NAME", "STAMP_MIME_TYPE", "STAMP_FILE_SIZE_BYTES", "STAMP_UPLOADED_AT", "STAMP_UPLOADED_BY_USER_ID", "STAMP_BASE64_DATA_URI" };
            await ClearSettingKeysAsync(tenantId, keys);
        }

        public async Task ClearSignatureAsync(int tenantId)
        {
            var keys = new[] { "SIGNATURE_STORAGE_KEY", "SIGNATURE_PUBLIC_URL", "SIGNATURE_ORIGINAL_NAME", "SIGNATURE_MIME_TYPE", "SIGNATURE_FILE_SIZE_BYTES", "SIGNATURE_UPLOADED_AT", "SIGNATURE_UPLOADED_BY_USER_ID", "SIGNATURE_BASE64_DATA_URI" };
            await ClearSettingKeysAsync(tenantId, keys);
        }

        private async Task ClearSettingKeysAsync(int tenantId, IEnumerable<string> keys)
        {
            EnsureTenant(tenantId);
            foreach (var key in keys)
            {
                var setting = await _context.Settings
                    .FirstOrDefaultAsync(s => s.Key == key && (s.TenantId == tenantId || (s.TenantId == null && s.OwnerId == tenantId)));
                if (setting != null)
                {
                    AuditSetting(tenantId, key, setting.Value, "");
                    setting.Value = "";
                    setting.UpdatedAt = DateTime.UtcNow;
                }
            }
            await _context.SaveChangesAsync();
        }

        /// <summary>Ensure COMPANY_LOGO is set from LOGO_PUBLIC_URL or LOGO_PATH so frontend/branding always get a logo URL after refresh.</summary>
        private static void EnsureCompanyLogoFromLogoUrl(Dictionary<string, string> settings)
        {
            if (settings.TryGetValue("COMPANY_LOGO", out var companyLogo) && !string.IsNullOrWhiteSpace(companyLogo))
                return;
            var logoUrl = (settings.TryGetValue("LOGO_PUBLIC_URL", out var u) ? u : null) ?? (settings.TryGetValue("LOGO_PATH", out var p) ? p : null) ?? "";
            if (!string.IsNullOrWhiteSpace(logoUrl))
                settings["COMPANY_LOGO"] = logoUrl.StartsWith("/") || logoUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? logoUrl : "/uploads/" + logoUrl;
        }

        /// <summary>
        /// Get default settings template
        /// </summary>
        private Dictionary<string, string> GetDefaultSettings()
        {
            return new Dictionary<string, string>
            {
                { "COMPANY_NAME_EN", "" },
                { "COMPANY_NAME_AR", "" },
                { "COMPANY_TRN", "" },
                { "CORPORATE_TAX_TRN", "" },
                { "COMPANY_EMAIL", "" },
                { "INVOICE_HEADER_STYLE", "Legacy" },
                { "COMPANY_ADDRESS", "" },
                { "COMPANY_PHONE", "" },
                { "VAT_PERCENT", "5" },
                { "CURRENCY", "AED" },
                { "INVOICE_PREFIX", "INV" },
                { "VAT_EFFECTIVE_DATE", "01-01-2026" },
                { "VAT_LEGAL_TEXT", "VAT registered under Federal Decree-Law No. 8 of 2017, UAE" },
                { "LOGO_PATH", "" },
                { "LOW_STOCK_GLOBAL_THRESHOLD", "" },
                { "ALLOW_NEGATIVE_STOCK", "true" },
                { "Feature_QuotesAgreements", "true" },
                { "Feature_LetterheadOnlyPrint", "false" },
                { "Feature_DocumentStampSignature", "false" },
                { "COMPANY_LICENSE", "" }
            };
        }
    }
}
