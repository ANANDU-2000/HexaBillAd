/*
 * Platform Settings - SuperAdmin-only global platform configuration.
 * Stores in Settings table with OwnerId=0 (platform-level).
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.SuperAdmin
{
    [ApiController]
    [Route("api/superadmin/platform-settings")]
    [Authorize]
    public class PlatformSettingsController : TenantScopedController
    {
        private const int PLATFORM_OWNER_ID = 0;
        private readonly AppDbContext _context;

        public PlatformSettingsController(AppDbContext context)
        {
            _context = context;
        }

        private async Task UpsertSetting(string key, string value, DateTime now)
        {
            var existing = await _context.Settings.FindAsync(key, PLATFORM_OWNER_ID);
            if (existing != null)
            {
                existing.Value = value;
                existing.UpdatedAt = now;
            }
            else
            {
                _context.Settings.Add(new Setting { Key = key, OwnerId = PLATFORM_OWNER_ID, Value = value, CreatedAt = now, UpdatedAt = now });
            }
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<PlatformSettingsDto>>> Get()
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var settings = await _context.Settings
                    .Where(s => s.OwnerId == PLATFORM_OWNER_ID)
                    .ToDictionaryAsync(s => s.Key, s => s.Value ?? "");

                var dto = new PlatformSettingsDto
                {
                    DefaultTrialDays = int.TryParse(settings.GetValueOrDefault("PLATFORM_DEFAULT_TRIAL_DAYS"), out var td) ? td : 14,
                    DefaultCurrency = settings.GetValueOrDefault("PLATFORM_DEFAULT_CURRENCY") ?? "AED",
                    InvoicePrefix = settings.GetValueOrDefault("PLATFORM_INVOICE_PREFIX") ?? "INV",
                    EnableBranches = settings.GetValueOrDefault("PLATFORM_ENABLE_BRANCHES", "true") != "false",
                    EnableRoutes = settings.GetValueOrDefault("PLATFORM_ENABLE_ROUTES", "true") != "false",
                    EnableAIInsights = settings.GetValueOrDefault("PLATFORM_ENABLE_AI_INSIGHTS", "false") == "true",
                    EnableWhatsApp = settings.GetValueOrDefault("PLATFORM_ENABLE_WHATSAPP", "false") == "true",
                    WelcomeEmail = settings.GetValueOrDefault("PLATFORM_WELCOME_EMAIL") ?? "",
                    SuspensionEmail = settings.GetValueOrDefault("PLATFORM_SUSPENSION_EMAIL") ?? "",
                    TrialExpiryEmail = settings.GetValueOrDefault("PLATFORM_TRIAL_EXPIRY_EMAIL") ?? "",
                    AnnouncementText = settings.GetValueOrDefault("PLATFORM_ANNOUNCEMENT_TEXT") ?? "",
                    AnnouncementStart = settings.GetValueOrDefault("PLATFORM_ANNOUNCEMENT_START"),
                    AnnouncementEnd = settings.GetValueOrDefault("PLATFORM_ANNOUNCEMENT_END"),
                    SessionTimeoutHours = int.TryParse(settings.GetValueOrDefault("PLATFORM_SESSION_TIMEOUT_HOURS"), out var sth) ? sth : 24,
                    MaxLoginAttempts = int.TryParse(settings.GetValueOrDefault("PLATFORM_MAX_LOGIN_ATTEMPTS"), out var mla) ? mla : 5,
                    MaintenanceMode = settings.GetValueOrDefault("PLATFORM_MAINTENANCE_MODE", "false") == "true",
                    MaintenanceMessage = settings.GetValueOrDefault("PLATFORM_MAINTENANCE_MESSAGE") ?? "System under maintenance. Back shortly.",
                    SubscriptionGracePeriodDays = int.TryParse(settings.GetValueOrDefault("PLATFORM_SUBSCRIPTION_GRACE_DAYS"), out var sgp) ? sgp : 5
                };
                return Ok(new ApiResponse<PlatformSettingsDto> { Success = true, Data = dto });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Platform settings get error: {ex.Message}");
                return StatusCode(500, new ApiResponse<PlatformSettingsDto> { Success = false, Message = ex.Message });
            }
        }

        [HttpPut]
        public async Task<ActionResult<ApiResponse<object>>> Put([FromBody] PlatformSettingsDto dto)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var now = DateTime.UtcNow;
                await UpsertSetting("PLATFORM_DEFAULT_TRIAL_DAYS", dto.DefaultTrialDays.ToString(), now);
                await UpsertSetting("PLATFORM_DEFAULT_CURRENCY", dto.DefaultCurrency ?? "AED", now);
                await UpsertSetting("PLATFORM_INVOICE_PREFIX", dto.InvoicePrefix ?? "INV", now);
                await UpsertSetting("PLATFORM_ENABLE_BRANCHES", dto.EnableBranches.ToString().ToLower(), now);
                await UpsertSetting("PLATFORM_ENABLE_ROUTES", dto.EnableRoutes.ToString().ToLower(), now);
                await UpsertSetting("PLATFORM_ENABLE_AI_INSIGHTS", dto.EnableAIInsights.ToString().ToLower(), now);
                await UpsertSetting("PLATFORM_ENABLE_WHATSAPP", dto.EnableWhatsApp.ToString().ToLower(), now);
                await UpsertSetting("PLATFORM_WELCOME_EMAIL", dto.WelcomeEmail ?? "", now);
                await UpsertSetting("PLATFORM_SUSPENSION_EMAIL", dto.SuspensionEmail ?? "", now);
                await UpsertSetting("PLATFORM_TRIAL_EXPIRY_EMAIL", dto.TrialExpiryEmail ?? "", now);
                await UpsertSetting("PLATFORM_ANNOUNCEMENT_TEXT", dto.AnnouncementText ?? "", now);
                await UpsertSetting("PLATFORM_ANNOUNCEMENT_START", dto.AnnouncementStart ?? "", now);
                await UpsertSetting("PLATFORM_ANNOUNCEMENT_END", dto.AnnouncementEnd ?? "", now);
                await UpsertSetting("PLATFORM_SESSION_TIMEOUT_HOURS", dto.SessionTimeoutHours.ToString(), now);
                await UpsertSetting("PLATFORM_MAX_LOGIN_ATTEMPTS", dto.MaxLoginAttempts.ToString(), now);
                await UpsertSetting("PLATFORM_MAINTENANCE_MODE", dto.MaintenanceMode.ToString().ToLower(), now);
                await UpsertSetting("PLATFORM_MAINTENANCE_MESSAGE", dto.MaintenanceMessage ?? "System under maintenance. Back shortly.", now);
                await UpsertSetting("PLATFORM_SUBSCRIPTION_GRACE_DAYS", dto.SubscriptionGracePeriodDays.ToString(), now);

                await _context.SaveChangesAsync();
                return Ok(new ApiResponse<object> { Success = true, Message = "Platform settings updated" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Platform settings put error: {ex.Message}");
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = ex.Message });
            }
        }
    }

    public class PlatformSettingsDto
    {
        public int DefaultTrialDays { get; set; } = 14;
        public string DefaultCurrency { get; set; } = "AED";
        public string InvoicePrefix { get; set; } = "INV";
        public bool EnableBranches { get; set; } = true;
        public bool EnableRoutes { get; set; } = true;
        public bool EnableAIInsights { get; set; }
        public bool EnableWhatsApp { get; set; }
        public string WelcomeEmail { get; set; } = "";
        public string SuspensionEmail { get; set; } = "";
        public string TrialExpiryEmail { get; set; } = "";
        public string AnnouncementText { get; set; } = "";
        public string? AnnouncementStart { get; set; }
        public string? AnnouncementEnd { get; set; }
        public int SessionTimeoutHours { get; set; } = 24;
        public int MaxLoginAttempts { get; set; } = 5;
        public bool MaintenanceMode { get; set; }
        public string MaintenanceMessage { get; set; } = "System under maintenance. Back shortly.";
        /// <summary>Days of full access after subscription expires before blocking. Default 5.</summary>
        public int SubscriptionGracePeriodDays { get; set; } = 5;
    }
}
