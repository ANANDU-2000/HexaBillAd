/*
 * Settings Service - Owner-Specific Company Settings Management
 * Purpose: Allow each owner to configure their company details for invoices/statements
 * Author: AI Assistant
 * Date: 2024-12-24
 */

using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.SuperAdmin
{
    public interface ISettingsService
    {
        Task<Dictionary<string, string>> GetOwnerSettingsAsync(int tenantId);
        Task<bool> UpdateOwnerSettingAsync(int tenantId, string key, string value);
        Task<bool> UpdateOwnerSettingsBulkAsync(int tenantId, Dictionary<string, string> settings);
        Task<CompanySettings> GetCompanySettingsAsync(int tenantId);
    }

    public class SettingsService : ISettingsService
    {
        private readonly AppDbContext _context;

        public SettingsService(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Get all settings for a specific owner/tenant.
        /// Settings table has composite PK (Key, OwnerId); we also store TenantId. Query by OwnerId or TenantId so legacy and new rows both work.
        /// </summary>
        public async Task<Dictionary<string, string>> GetOwnerSettingsAsync(int tenantId)
        {
            var list = await _context.Settings
                .Where(s => s.OwnerId == tenantId || s.TenantId == tenantId)
                .ToListAsync();

            // Prefer OwnerId match when same Key exists for both (e.g. after migration)
            var settings = list
                .GroupBy(s => s.Key)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(s => s.OwnerId == tenantId).First().Value ?? string.Empty);

            if (!settings.Any())
            {
                return GetDefaultSettings();
            }

            return settings;
        }

        /// <summary>
        /// Update a single setting. Table PK is (Key, OwnerId). Find by OwnerId first, then TenantId; when adding use OwnerId = tenantId.
        /// </summary>
        public async Task<bool> UpdateOwnerSettingAsync(int tenantId, string key, string value)
        {
            try
            {
                var setting = await _context.Settings
                    .FirstOrDefaultAsync(s => s.Key == key && s.OwnerId == tenantId);
                if (setting == null)
                    setting = await _context.Settings
                        .FirstOrDefaultAsync(s => s.Key == key && s.TenantId == tenantId);

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

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error updating setting {key} for tenant {tenantId}: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Update multiple settings in bulk. PK is (Key, OwnerId). Find by OwnerId then TenantId; when adding set OwnerId = tenantId to avoid duplicate key.
        /// </summary>
        public async Task<bool> UpdateOwnerSettingsBulkAsync(int tenantId, Dictionary<string, string> settings)
        {
            if (settings == null || settings.Count == 0)
                return true;

            foreach (var kvp in settings)
            {
                var key = kvp.Key?.Trim();
                if (string.IsNullOrEmpty(key) || key.Length > 100)
                    continue;

                var setting = await _context.Settings
                    .FirstOrDefaultAsync(s => s.Key == key && s.OwnerId == tenantId);
                if (setting == null)
                    setting = await _context.Settings
                        .FirstOrDefaultAsync(s => s.Key == key && s.TenantId == tenantId);

                var value = kvp.Value ?? string.Empty;

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

        /// <summary>
        /// Get company settings as CompanySettings object for invoice generation
        /// </summary>
        public async Task<CompanySettings> GetCompanySettingsAsync(int tenantId)
        {
            var settingsDict = await GetOwnerSettingsAsync(tenantId);
            
            // DEBUG: Log settings being used for PDF
            Console.WriteLine($"📄 Loading company settings for owner {tenantId}:");
            Console.WriteLine($"   Company Phone: {settingsDict.GetValueOrDefault("COMPANY_PHONE", "NOT SET")}");
            Console.WriteLine($"   Company Name: {settingsDict.GetValueOrDefault("COMPANY_NAME_EN", "NOT SET")}");

            return new CompanySettings
            {
                LegalNameEn = settingsDict.GetValueOrDefault("COMPANY_NAME_EN", "HexaBill"),
                LegalNameAr = settingsDict.GetValueOrDefault("COMPANY_NAME_AR", "فروزن ماجيك لتجارة العامة - ذ.م.م - ش.ش.و"),
                VatNumber = settingsDict.GetValueOrDefault("COMPANY_TRN", "105274438800003"),
                Address = settingsDict.GetValueOrDefault("COMPANY_ADDRESS", "Abu Dhabi, United Arab Emirates"),
                Mobile = settingsDict.GetValueOrDefault("COMPANY_PHONE", "+971 56 955 22 52"),
                VatEffectiveDate = settingsDict.GetValueOrDefault("VAT_EFFECTIVE_DATE", "01-01-2026"),
                VatLegalText = settingsDict.GetValueOrDefault("VAT_LEGAL_TEXT", "VAT registered under Federal Decree-Law No. 8 of 2017, UAE"),
                Currency = settingsDict.GetValueOrDefault("CURRENCY", "AED"),
                VatPercent = decimal.TryParse(settingsDict.GetValueOrDefault("VAT_PERCENT", "5"), out var vat) ? vat : 5.0m,
                InvoicePrefix = settingsDict.GetValueOrDefault("INVOICE_PREFIX", "FM"),
                LogoPath = settingsDict.GetValueOrDefault("LOGO_PATH", "/uploads/logo.png")
            };
        }

        /// <summary>
        /// Get default settings template
        /// </summary>
        private Dictionary<string, string> GetDefaultSettings()
        {
            return new Dictionary<string, string>
            {
                { "COMPANY_NAME_EN", "HexaBill" },
                { "COMPANY_NAME_AR", "فروزن ماجيك لتجارة العامة - ذ.م.م - ش.ش.و" },
                { "COMPANY_TRN", "105274438800003" },
                { "COMPANY_ADDRESS", "Abu Dhabi, United Arab Emirates" },
                { "COMPANY_PHONE", "+971 56 955 22 52" },
                { "VAT_PERCENT", "5" },
                { "CURRENCY", "AED" },
                { "INVOICE_PREFIX", "FM" },
                { "VAT_EFFECTIVE_DATE", "01-01-2026" },
                { "VAT_LEGAL_TEXT", "VAT registered under Federal Decree-Law No. 8 of 2017, UAE" },
                { "LOGO_PATH", "/uploads/logo.png" }
            };
        }
    }
}
