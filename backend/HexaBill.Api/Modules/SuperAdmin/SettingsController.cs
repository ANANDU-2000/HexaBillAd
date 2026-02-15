/*
 * Settings Controller - Owner Company Settings Management
 * Purpose: API endpoints for owners to view/update their company details
 * Author: AI Assistant
 * Date: 2024-12-24
 */

using HexaBill.Api.Shared.Extensions;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HexaBill.Api.Modules.SuperAdmin
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class SettingsController : TenantScopedController
    {
        private readonly ISettingsService _settingsService;
        private readonly ISuperAdminTenantService _tenantService;

        public SettingsController(ISettingsService settingsService, ISuperAdminTenantService tenantService)
        {
            _settingsService = settingsService;
            _tenantService = tenantService;
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
                var settings = await _settingsService.GetOwnerSettingsAsync(tenantId);
                
                return Ok(new ServiceResponse<Dictionary<string, string>>
                {
                    Success = true,
                    Message = "Settings retrieved successfully",
                    Data = settings
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"? Error getting settings: {ex.Message}");
                return StatusCode(500, new ServiceResponse<object>
                {
                    Success = false,
                    Message = "Failed to retrieve settings"
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
                Console.WriteLine($"? Error getting company settings: {ex.Message}");
                return StatusCode(500, new ServiceResponse<object>
                {
                    Success = false,
                    Message = "Failed to retrieve company settings"
                });
            }
        }

        /// <summary>
        /// Update company settings (bulk update)
        /// PUT: api/settings
        /// </summary>
        [HttpPut]
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
                Console.WriteLine($"? Error updating settings: {ex.Message}\n{ex.StackTrace}");
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
                Console.WriteLine($"? Error updating setting {key}: {ex.Message}");
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
                Console.WriteLine($"? Error clearing tenant data: {ex.Message}");
                return StatusCode(500, new ServiceResponse<object> { Success = false, Message = ex.Message ?? "Failed to clear data" });
            }
        }
    }
}
