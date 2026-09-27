/*
 * Settings Controller - Owner Company Settings Management
 * Purpose: API endpoints for owners to view/update their company details
 * Author: AI Assistant
 * Date: 2024-12-24
 */

using System.Text.Json.Nodes;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.SuperAdmin
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class SettingsController : TenantScopedController
    {
        private readonly ISettingsService _settingsService;
        private readonly ISuperAdminTenantService _tenantService;
        private readonly ILogger<SettingsController> _logger;
        private readonly AppDbContext _context;
        private readonly ITimeZoneService _timeZoneService;

        public SettingsController(ISettingsService settingsService, ISuperAdminTenantService tenantService, ILogger<SettingsController> logger, AppDbContext context, ITimeZoneService timeZoneService)
        {
            _settingsService = settingsService;
            _tenantService = tenantService;
            _logger = logger;
            _context = context;
            _timeZoneService = timeZoneService;
        }

        /// <summary>
        /// Get all company settings for current owner
        /// GET: api/settings
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetSettings()
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0 && !IsSystemAdmin)
                {
                    return Forbid();
                }
                
                var settings = await _settingsService.GetOwnerSettingsAsync(tenantId);
                if (IsStaff && !User.IsInRole("Admin") && !User.IsInRole("Owner") && !IsSystemAdmin)
                    settings = HexaBill.Api.Core.Storage.R2Configuration.FilterSettingsForStaff(settings);
                
                return Ok(new ServiceResponse<Dictionary<string, string>>
                {
                    Success = true,
                    Message = "Settings retrieved successfully",
                    Data = settings
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting settings: {Message}", ex.Message);
                
                return StatusCode(500, new ServiceResponse<object>
                {
                    Success = false,
                    Message = "Failed to retrieve settings",
                    Errors = new List<string> { ex.Message, ex.InnerException?.Message }.Where(s => !string.IsNullOrEmpty(s)).ToList()
                });
            }
        }

        /// <summary>
        /// Get company settings as CompanySettings object
        /// GET: api/settings/company
        /// </summary>
        [HttpGet("company")]
        public async Task<IActionResult> GetCompanySettings()
        {
            try
            {
                var tenantId = CurrentTenantId;
                var companySettings = await _settingsService.GetCompanySettingsAsync(tenantId);
                
                return Ok(new ServiceResponse<CompanySettings>
                {
                    Success = true,
                    Message = "Company settings retrieved successfully",
                    Data = companySettings
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting company settings: {Message}", ex.Message);
                return StatusCode(500, new ServiceResponse<object>
                {
                    Success = false,
                    Message = "Failed to retrieve company settings"
                });
            }
        }

        /// <summary>
        /// Get logo as data URI for stable display (survives container restarts; no blob revoke).
        /// GET: api/settings/logo-data-uri
        /// </summary>
        [HttpGet("logo-data-uri")]
        public async Task<IActionResult> GetLogoDataUri()
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0 && !IsSystemAdmin)
                    return Forbid();
                var dataUri = await _settingsService.GetSettingValueAsync(tenantId, "LOGO_BASE64_DATA_URI");
                return Ok(new ServiceResponse<string?>
                {
                    Success = true,
                    Data = string.IsNullOrWhiteSpace(dataUri) ? null : dataUri,
                    Message = string.IsNullOrWhiteSpace(dataUri) ? "No logo data URI stored" : "Logo data URI retrieved"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting logo data URI: {Message}", ex.Message);
                return StatusCode(500, new ServiceResponse<object>
                {
                    Success = false,
                    Message = "Failed to retrieve logo data URI"
                });
            }
        }

        /// <summary>
        /// Update company settings (bulk update)
        /// PUT: api/settings
        /// </summary>
        [HttpPut]
        [Authorize(Roles = "Owner,Admin")]
        public async Task<IActionResult> UpdateSettings([FromBody] Dictionary<string, string> settings)
        {
            try
            {
                var tenantId = CurrentTenantId;
                
                // Validate input
                if (settings == null || !settings.Any())
                {
                    return BadRequest(new ServiceResponse<object>
                    {
                        Success = false,
                        Message = "Settings data is required"
                    });
                }

                await _settingsService.UpdateOwnerSettingsBulkAsync(tenantId, settings);
                return Ok(new ServiceResponse<object>
                {
                    Success = true,
                    Message = "Settings updated successfully"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating settings: {Message}", ex.Message);
                return StatusCode(500, new ServiceResponse<object>
                {
                    Success = false,
                    Message = ex.Message ?? "An error occurred while updating settings",
                    Errors = ex.InnerException != null ? new List<string> { ex.InnerException.Message } : null
                });
            }
        }

        /// <summary>
        /// Update a single setting
        /// PUT: api/settings/{key}
        /// </summary>
        [HttpPut("{key}")]
        [Authorize(Roles = "Owner,Admin")]
        public async Task<IActionResult> UpdateSetting(string key, [FromBody] string value)
        {
            try
            {
                var tenantId = CurrentTenantId;
                
                // Validate input
                if (string.IsNullOrWhiteSpace(key))
                {
                    return BadRequest(new ServiceResponse<object>
                    {
                        Success = false,
                        Message = "Setting key is required"
                    });
                }

                var success = await _settingsService.UpdateOwnerSettingAsync(tenantId, key, value);
                
                if (success)
                {
                    return Ok(new ServiceResponse<object>
                    {
                        Success = true,
                        Message = $"Setting '{key}' updated successfully"
                    });
                }
                else
                {
                    return StatusCode(500, new ServiceResponse<object>
                    {
                        Success = false,
                        Message = "Failed to update setting"
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating setting {Key}: {Message}", key, ex.Message);
                return StatusCode(500, new ServiceResponse<object>
                {
                    Success = false,
                    Message = "An error occurred while updating setting"
                });
            }
        }

        /// <summary>
        /// Clear all transactional data for the current tenant (Owner/Admin only). Keeps users, products, customers; resets stock and balances.
        /// POST: api/settings/clear-data
        /// </summary>
        [HttpPost("clear-data")]
        [Authorize(Roles = "Owner,Admin")]
        public async Task<IActionResult> ClearMyTenantData()
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0)
            {
                return Forbid();
            }
            var userIdClaim = User.FindFirst("UserId") ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? User.FindFirst("id");
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
            {
                return Unauthorized(new ServiceResponse<object> { Success = false, Message = "Invalid user" });
            }
            try
            {
                var success = await _tenantService.ClearTenantDataAsync(tenantId, userId);
                if (!success)
                {
                    return NotFound(new ServiceResponse<object> { Success = false, Message = "Tenant not found" });
                }
                return Ok(new ServiceResponse<object> { Success = true, Message = "All transactional data has been cleared. Users, products, and customers are kept; stock and balances are reset." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error clearing tenant data: {Message}", ex.Message);
                return StatusCode(500, new ServiceResponse<object> { Success = false, Message = ex.Message ?? "Failed to clear data" });
            }
        }

        /// <summary>
        /// Get audit logs for the current tenant (who changed what). Admin/Owner/SystemAdmin only.
        /// GET: api/settings/audit-logs
        /// </summary>
        [HttpGet("audit-logs")]
        [Authorize(Roles = "Admin,Owner,SystemAdmin")]
        public async Task<ActionResult<ApiResponse<PagedResponse<TenantAuditLogDto>>>> GetAuditLogs(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? action = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] string? q = null,
            [FromQuery] int? userId = null)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0 && !IsSystemAdmin)
                    return Forbid();

                if (!TryGetGstUtcRange(fromDate, toDate, out var fromUtc, out var toExclusiveUtc, out var dateError))
                {
                    return BadRequest(new ApiResponse<PagedResponse<TenantAuditLogDto>>
                    {
                        Success = false,
                        Message = dateError ?? "From date must be on or before to date."
                    });
                }

                if (page < 1) page = 1;
                if (pageSize < 1) pageSize = 20;
                if (pageSize > 100) pageSize = 100;

                var query = TenantAuditQuery(tenantId);
                query = ApplyAuditFilters(query, action, q, userId, fromUtc, toExclusiveUtc);

                var totalCount = await query.CountAsync();
                var logs = await query
                    .OrderByDescending(a => a.CreatedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(a => new TenantAuditLogDto
                    {
                        Id = a.Id,
                        UserName = a.User.Name,
                        Action = a.Action,
                        Details = a.Details,
                        CreatedAt = a.CreatedAt
                    })
                    .ToListAsync();

                foreach (var log in logs)
                    log.Details = MaskSensitiveJson(log.Details);

                var result = new PagedResponse<TenantAuditLogDto>
                {
                    Items = logs,
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                };
                return Ok(new ApiResponse<PagedResponse<TenantAuditLogDto>>
                {
                    Success = true,
                    Message = "Audit logs retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting audit logs");
                return StatusCode(500, new ApiResponse<PagedResponse<TenantAuditLogDto>>
                {
                    Success = false,
                    Message = "Unable to load activity log."
                });
            }
        }

        /// <summary>
        /// Distinct users who appear in this tenant's activity log.
        /// GET: api/settings/audit-logs/actors
        /// </summary>
        [HttpGet("audit-logs/actors")]
        [Authorize(Roles = "Admin,Owner,SystemAdmin")]
        public async Task<ActionResult<ApiResponse<List<TenantAuditActorDto>>>> GetAuditActors()
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0 && !IsSystemAdmin)
                    return Forbid();

                var actors = await TenantAuditQuery(tenantId)
                    .Where(a => a.User != null)
                    .Select(a => new { a.UserId, Name = a.User.Name })
                    .Distinct()
                    .OrderBy(a => a.Name)
                    .Select(a => new TenantAuditActorDto
                    {
                        UserId = a.UserId,
                        UserName = a.Name ?? ""
                    })
                    .ToListAsync();

                return Ok(new ApiResponse<List<TenantAuditActorDto>>
                {
                    Success = true,
                    Message = "Activity users retrieved successfully",
                    Data = actors
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting audit actors");
                return StatusCode(500, new ApiResponse<List<TenantAuditActorDto>>
                {
                    Success = false,
                    Message = "Unable to load activity users."
                });
            }
        }

        /// <summary>
        /// One tenant activity row, including masked before/after values when stored.
        /// GET: api/settings/audit-logs/{id}
        /// </summary>
        [HttpGet("audit-logs/{id:int}")]
        [Authorize(Roles = "Admin,Owner,SystemAdmin")]
        public async Task<ActionResult<ApiResponse<TenantAuditLogDetailDto>>> GetAuditLog(int id)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0 && !IsSystemAdmin)
                    return Forbid();

                var log = await TenantAuditQuery(tenantId)
                    .Where(a => a.Id == id)
                    .Select(a => new TenantAuditLogDetailDto
                    {
                        Id = a.Id,
                        UserName = a.User.Name,
                        Action = a.Action,
                        Details = a.Details,
                        CreatedAt = a.CreatedAt,
                        EntityType = a.EntityType,
                        OldValues = a.OldValues,
                        NewValues = a.NewValues
                    })
                    .FirstOrDefaultAsync();

                if (log == null)
                {
                    return NotFound(new ApiResponse<TenantAuditLogDetailDto>
                    {
                        Success = false,
                        Message = "Activity not found."
                    });
                }

                log.Details = MaskSensitiveJson(log.Details);
                log.OldValues = MaskSensitiveJson(log.OldValues);
                log.NewValues = MaskSensitiveJson(log.NewValues);

                return Ok(new ApiResponse<TenantAuditLogDetailDto>
                {
                    Success = true,
                    Message = "Activity retrieved successfully",
                    Data = log
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting audit log {AuditLogId}", id);
                return StatusCode(500, new ApiResponse<TenantAuditLogDetailDto>
                {
                    Success = false,
                    Message = "Unable to load this activity."
                });
            }
        }

        private IQueryable<AuditLog> TenantAuditQuery(int tenantId)
        {
            return _context.AuditLogs
                .Where(a => (a.TenantId != null && a.TenantId == tenantId) || (a.TenantId == null && a.OwnerId == tenantId));
        }

        private static IQueryable<AuditLog> ApplyAuditFilters(
            IQueryable<AuditLog> query,
            string? action,
            string? q,
            int? userId,
            DateTime? fromUtc,
            DateTime? toExclusiveUtc)
        {
            if (!string.IsNullOrWhiteSpace(action))
            {
                var actionFilter = action.Trim().ToLower();
                query = query.Where(a => a.Action != null && a.Action.ToLower().Contains(actionFilter));
            }

            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim().ToLower();
                query = query.Where(a =>
                    (a.Action != null && a.Action.ToLower().Contains(term)) ||
                    (a.Details != null && a.Details.ToLower().Contains(term)) ||
                    (a.User != null && a.User.Name != null && a.User.Name.ToLower().Contains(term)));
            }

            if (userId.HasValue && userId.Value > 0)
                query = query.Where(a => a.UserId == userId.Value);

            if (fromUtc.HasValue)
                query = query.Where(a => a.CreatedAt >= fromUtc.Value);

            if (toExclusiveUtc.HasValue)
                query = query.Where(a => a.CreatedAt < toExclusiveUtc.Value);

            return query;
        }

        /// <summary>
        /// Calendar dates are Gulf Standard Time days. CreatedAt is stored as real UTC.
        /// </summary>
        private bool TryGetGstUtcRange(DateTime? fromDate, DateTime? toDate, out DateTime? fromUtc, out DateTime? toExclusiveUtc, out string? error)
        {
            fromUtc = null;
            toExclusiveUtc = null;
            error = null;

            if (fromDate.HasValue && toDate.HasValue && fromDate.Value.Date > toDate.Value.Date)
            {
                error = "From date must be on or before to date.";
                return false;
            }

            if (fromDate.HasValue)
            {
                var gstStart = DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Unspecified);
                fromUtc = DateTime.SpecifyKind(_timeZoneService.ConvertToUtc(gstStart), DateTimeKind.Utc);
            }

            if (toDate.HasValue)
            {
                var gstEnd = DateTime.SpecifyKind(toDate.Value.Date.AddDays(1), DateTimeKind.Unspecified);
                toExclusiveUtc = DateTime.SpecifyKind(_timeZoneService.ConvertToUtc(gstEnd), DateTimeKind.Utc);
            }

            return true;
        }

        private static string? MaskSensitiveJson(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return raw;
            var text = raw.Trim();
            if (text.Length == 0 || (text[0] != '{' && text[0] != '[')) return raw;
            try
            {
                var node = JsonNode.Parse(text);
                if (node == null) return raw;
                MaskNode(node);
                return node.ToJsonString();
            }
            catch
            {
                return raw;
            }
        }

        private static void MaskNode(JsonNode node)
        {
            if (node is JsonObject obj)
            {
                foreach (var key in obj.Select(p => p.Key).ToList())
                {
                    if (IsSensitiveKey(key))
                    {
                        obj[key] = "***";
                        continue;
                    }
                    var child = obj[key];
                    if (child != null) MaskNode(child);
                }
            }
            else if (node is JsonArray arr)
            {
                foreach (var child in arr)
                {
                    if (child != null) MaskNode(child);
                }
            }
        }

        private static bool IsSensitiveKey(string key)
        {
            var n = key.Replace("_", "", StringComparison.Ordinal).Replace("-", "", StringComparison.Ordinal).ToLowerInvariant();
            return n.Contains("password", StringComparison.Ordinal)
                || n.Contains("secret", StringComparison.Ordinal)
                || n.Contains("apikey", StringComparison.Ordinal)
                || n.Contains("token", StringComparison.Ordinal)
                || n.Contains("connectionstring", StringComparison.Ordinal)
                || n.Contains("authorization", StringComparison.Ordinal);
        }
    }

    public class TenantAuditLogDto
    {
        public int Id { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string? Details { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class TenantAuditLogDetailDto : TenantAuditLogDto
    {
        public string? EntityType { get; set; }
        public string? OldValues { get; set; }
        public string? NewValues { get; set; }
    }

    public class TenantAuditActorDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
    }
}
