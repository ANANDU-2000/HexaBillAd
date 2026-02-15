/*
Purpose: Super Admin Tenant Management Controller
Author: AI Assistant
Date: 2026-02-11
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Subscription;
using HexaBill.Api.Shared.Extensions;
using Microsoft.Extensions.Logging;

namespace HexaBill.Api.Modules.SuperAdmin
{
    [ApiController]
    [Route("api/superadmin/[controller]")]
    [Authorize] // Only authenticated users
    public class TenantController : TenantScopedController
    {
        private readonly ISuperAdminTenantService _tenantService;
        private readonly ILogger<TenantController> _logger;
        private readonly IConfiguration _configuration;

        public TenantController(ISuperAdminTenantService tenantService, ILogger<TenantController> logger, IConfiguration configuration)
        {
            _tenantService = tenantService;
            _logger = logger;
            _configuration = configuration;
        }

        /// <summary>
        /// Get platform dashboard metrics (SystemAdmin only)
        /// </summary>
        [HttpGet("dashboard")]
        public async Task<ActionResult<ApiResponse<PlatformDashboardDto>>> GetPlatformDashboard()
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var dashboard = await _tenantService.GetPlatformDashboardAsync();
                return Ok(new ApiResponse<PlatformDashboardDto> { Success = true, Message = "Platform dashboard retrieved successfully", Data = dashboard });
            }
            catch (Exception ex)
            {
                // Log the full exception for debugging
                _logger.LogError(ex, "Error getting platform dashboard: {Message}", ex.Message);
                if (ex.InnerException != null)
                {
                    _logger.LogError("Inner exception: {InnerMessage}", ex.InnerException.Message);
                }
                
                // Return detailed error for debugging
                return StatusCode(500, new ApiResponse<PlatformDashboardDto> 
                { 
                    Success = false, 
                    Message = $"An error occurred: {ex.Message}", 
                    Errors = new List<string> { ex.Message, ex.InnerException?.Message ?? "No inner exception" } 
                });
            }
        }

        /// <summary>
        /// Platform metrics (goal lock: docs/HEXABILL_GOAL_AND_PROMPT.md). SystemAdmin only.
        /// </summary>
        [HttpGet("/api/superadmin/platform-metrics")]
        public async Task<ActionResult<ApiResponse<object>>> GetPlatformMetrics()
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var d = await _tenantService.GetPlatformDashboardAsync();
                var payload = new
                {
                    totalTenants = d.TotalTenants,
                    activeTenants = d.ActiveTenants,
                    trialTenants = d.TrialTenants,
                    suspendedTenants = d.SuspendedTenants,
                    totalInvoices = d.TotalInvoices,
                    totalUsers = d.TotalUsers,
                    totalPlatformSales = d.PlatformRevenue,
                    avgSalesPerTenant = d.AvgSalesPerTenant,
                    topTenants = d.TopTenants.Select(t => new { tenantId = t.TenantId, tenantName = t.TenantName, totalSales = t.TotalSales }),
                    estimatedStorageUsed = d.EstimatedStorageUsedMb,
                    mrr = d.Mrr,
                    lastUpdated = d.LastUpdated
                };
                return Ok(new ApiResponse<object> { Success = true, Data = payload });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>
        /// Get all tenants with pagination (SystemAdmin only)
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<ApiResponse<PagedResponse<TenantDto>>>> GetTenants(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? search = null,
            [FromQuery] string? status = null)
        {
            // CRITICAL: Only SystemAdmin can access
            if (!IsSystemAdmin)
            {
                return Forbid();
            }

            try
            {
                TenantStatus? statusFilter = null;
                if (!string.IsNullOrEmpty(status) && Enum.TryParse<TenantStatus>(status, true, out var statusEnum))
                {
                    statusFilter = statusEnum;
                }

                var result = await _tenantService.GetTenantsAsync(page, pageSize, search, statusFilter);
                return Ok(new ApiResponse<PagedResponse<TenantDto>>
                {
                    Success = true,
                    Message = "Tenants retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<PagedResponse<TenantDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Get tenant details by ID (SystemAdmin only)
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<TenantDetailDto>>> GetTenant(int id)
        {
            // CRITICAL: Only SystemAdmin can access
            if (!IsSystemAdmin)
            {
                return Forbid();
            }

            try
            {
                var tenant = await _tenantService.GetTenantByIdAsync(id);
                if (tenant == null)
                {
                    return NotFound(new ApiResponse<TenantDetailDto>
                    {
                        Success = false,
                        Message = "Tenant not found"
                    });
                }

                return Ok(new ApiResponse<TenantDetailDto>
                {
                    Success = true,
                    Message = "Tenant retrieved successfully",
                    Data = tenant
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<TenantDetailDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// <summary>
        /// Create new tenant (SystemAdmin only). Returns tenant + client credentials (link, ID, email, password) to give to the client.
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<ApiResponse<CreateTenantResponseDto>>> CreateTenant([FromBody] CreateTenantRequest request)
        {
            // CRITICAL: Only SystemAdmin can access
            if (!IsSystemAdmin)
            {
                return Forbid();
            }

            try
            {
                if (string.IsNullOrWhiteSpace(request.Name))
                {
                    return BadRequest(new ApiResponse<CreateTenantResponseDto>
                    {
                        Success = false,
                        Message = "Tenant name is required"
                    });
                }

                var tenant = await _tenantService.CreateTenantAsync(request);
                var clientAppLink = _configuration["ClientApp:BaseUrl"] ?? "http://localhost:5176";
                var clientEmail = tenant.Email ?? request.Email ?? "";

                var response = new CreateTenantResponseDto
                {
                    Tenant = tenant,
                    ClientCredentials = new ClientCredentialsDto
                    {
                        ClientAppLink = clientAppLink,
                        TenantId = tenant.Id,
                        Email = clientEmail,
                        Password = "Owner123!" // Default password for new tenant owner (must match SuperAdminTenantService)
                    }
                };

                return CreatedAtAction(nameof(GetTenant), new { id = tenant.Id }, new ApiResponse<CreateTenantResponseDto>
                {
                    Success = true,
                    Message = "Tenant created successfully. Give the client the link, email, and password below.",
                    Data = response
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ApiResponse<CreateTenantResponseDto>
                {
                    Success = false,
                    Message = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<CreateTenantResponseDto>
                {
                    Success = false,
                    Message = "An error occurred while creating tenant",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Update tenant (SystemAdmin only)
        /// </summary>
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<TenantDto>>> UpdateTenant(int id, [FromBody] UpdateTenantRequest request)
        {
            // CRITICAL: Only SystemAdmin can access
            if (!IsSystemAdmin)
            {
                return Forbid();
            }

            try
            {
                var tenant = await _tenantService.UpdateTenantAsync(id, request);
                return Ok(new ApiResponse<TenantDto>
                {
                    Success = true,
                    Message = "Tenant updated successfully",
                    Data = tenant
                });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new ApiResponse<TenantDto>
                {
                    Success = false,
                    Message = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<TenantDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Suspend tenant (SystemAdmin only)
        /// </summary>
        [HttpPut("{id}/suspend")]
        public async Task<ActionResult<ApiResponse<object>>> SuspendTenant(int id, [FromBody] SuspendTenantRequest request)
        {
            // CRITICAL: Only SystemAdmin can access
            if (!IsSystemAdmin)
            {
                return Forbid();
            }

            try
            {
                var success = await _tenantService.SuspendTenantAsync(id, request.Reason ?? "Suspended by Super Admin");
                if (!success)
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Tenant not found"
                    });
                }

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Tenant suspended successfully"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Activate tenant (SystemAdmin only)
        /// </summary>
        [HttpPut("{id}/activate")]
        public async Task<ActionResult<ApiResponse<object>>> ActivateTenant(int id)
        {
            // CRITICAL: Only SystemAdmin can access
            if (!IsSystemAdmin)
            {
                return Forbid();
            }

            try
            {
                var success = await _tenantService.ActivateTenantAsync(id);
                if (!success)
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Tenant not found"
                    });
                }

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Tenant activated successfully"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Get tenant usage metrics (SystemAdmin only)
        /// </summary>
        [HttpGet("{id}/usage")]
        public async Task<ActionResult<ApiResponse<TenantUsageMetricsDto>>> GetTenantUsage(int id)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var metrics = await _tenantService.GetTenantUsageMetricsAsync(id);
                return Ok(new ApiResponse<TenantUsageMetricsDto> { Success = true, Message = "Usage metrics retrieved successfully", Data = metrics });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<TenantUsageMetricsDto> { Success = false, Message = "An error occurred", Errors = new List<string> { ex.Message } });
            }
        }

        /// <summary>Tenant health score 0-100, Green/Yellow/Red, riskFactors (goal doc Step 2).</summary>
        [HttpGet("{id}/health")]
        public async Task<ActionResult<ApiResponse<TenantHealthDto>>> GetTenantHealth(int id)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var health = await _tenantService.GetTenantHealthAsync(id);
                return Ok(new ApiResponse<TenantHealthDto> { Success = true, Data = health });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<TenantHealthDto> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>Per-tenant cost estimation vs revenue (goal doc Step 3).</summary>
        [HttpGet("{id}/cost")]
        public async Task<ActionResult<ApiResponse<TenantCostDto>>> GetTenantCost(int id)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var cost = await _tenantService.GetTenantCostAsync(id);
                return Ok(new ApiResponse<TenantCostDto> { Success = true, Data = cost });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<TenantCostDto> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>
        /// Delete tenant (SystemAdmin only) - Soft delete if has data
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteTenant(int id)
        {
            // CRITICAL: Only SystemAdmin can access
            if (!IsSystemAdmin)
            {
                return Forbid();
            }

            try
            {
                var success = await _tenantService.DeleteTenantAsync(id);
                if (!success)
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Tenant not found"
                    });
                }

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Tenant deleted successfully"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Clear all transactional data for a tenant (SystemAdmin only)
        /// </summary>
        [HttpPost("{id}/clear-data")]
        public async Task<ActionResult<ApiResponse<object>>> ClearTenantData(int id)
        {
            if (!IsSystemAdmin) return Forbid();

            try
            {
                var userIdClaim = User.FindFirst("UserId") ?? 
                                  User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? 
                                  User.FindFirst("id");
                                  
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                {
                    return Unauthorized(new ApiResponse<object> { Success = false, Message = "Invalid admin authentication" });
                }

                var success = await _tenantService.ClearTenantDataAsync(id, userId);
                if (!success)
                {
                    return NotFound(new ApiResponse<object> { Success = false, Message = "Tenant not found" });
                }

                return Ok(new ApiResponse<object> { Success = true, Message = "Tenant data cleared successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = ex.Message });
            }
        }

        [HttpPut("{id}/subscription")]
        public async Task<ActionResult<ApiResponse<SubscriptionDto>>> UpdateTenantSubscription(int id, [FromBody] UpdateTenantSubscriptionRequest request)
        {
            if (!IsSystemAdmin) return Forbid();

            try
            {
                var subscription = await _tenantService.UpdateTenantSubscriptionAsync(id, request.PlanId, request.BillingCycle);
                if (subscription == null)
                {
                    return NotFound(new ApiResponse<SubscriptionDto> { Success = false, Message = "Tenant not found" });
                }

                return Ok(new ApiResponse<SubscriptionDto>
                {
                    Success = true,
                    Message = "Tenant subscription updated successfully",
                    Data = subscription
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<SubscriptionDto> { Success = false, Message = ex.Message });
            }
        }

        // --- User Management for Tenants (SystemAdmin only) ---

        [HttpPost("{id}/users")]
        public async Task<ActionResult<ApiResponse<UserDto>>> AddUserToTenant(int id, [FromBody] CreateUserRequest request)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var user = await _tenantService.AddUserToTenantAsync(id, request);
                return Ok(new ApiResponse<UserDto> { Success = true, Message = "User added successfully", Data = user });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ApiResponse<UserDto> { Success = false, Message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<UserDto> { Success = false, Message = ex.Message });
            }
        }

        [HttpPut("{id}/users/{userId}")]
        public async Task<ActionResult<ApiResponse<UserDto>>> UpdateTenantUser(int id, int userId, [FromBody] UpdateUserRequest request)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var user = await _tenantService.UpdateTenantUserAsync(id, userId, request);
                return Ok(new ApiResponse<UserDto> { Success = true, Message = "User updated successfully", Data = user });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ApiResponse<UserDto> { Success = false, Message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<UserDto> { Success = false, Message = ex.Message });
            }
        }

        [HttpDelete("{id}/users/{userId}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteTenantUser(int id, int userId)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var success = await _tenantService.DeleteTenantUserAsync(id, userId);
                if (!success) return NotFound(new ApiResponse<bool> { Success = false, Message = "User not found" });
                return Ok(new ApiResponse<bool> { Success = true, Message = "User deleted successfully", Data = true });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ApiResponse<bool> { Success = false, Message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<bool> { Success = false, Message = ex.Message });
            }
        }

        [HttpPut("{id}/users/{userId}/reset-password")]
        public async Task<ActionResult<ApiResponse<bool>>> ResetTenantUserPassword(int id, int userId, [FromBody] ResetPasswordRequest request)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var success = await _tenantService.ResetTenantUserPasswordAsync(id, userId, request.NewPassword);
                if (!success) return NotFound(new ApiResponse<bool> { Success = false, Message = "User not found" });
                return Ok(new ApiResponse<bool> { Success = true, Message = "Password reset successfully", Data = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<bool> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>Duplicate data from another tenant to this tenant (Products, Settings). SystemAdmin only.</summary>
        [HttpPost("{id}/duplicate-data")]
        public async Task<ActionResult<ApiResponse<DuplicateDataResultDto>>> DuplicateDataToTenant(int id, [FromBody] DuplicateDataRequest request)
        {
            if (!IsSystemAdmin) return Forbid();
            if (request == null || request.SourceTenantId <= 0)
            {
                return BadRequest(new ApiResponse<DuplicateDataResultDto> { Success = false, Message = "SourceTenantId is required." });
            }
            try
            {
                var result = await _tenantService.DuplicateDataToTenantAsync(id, request.SourceTenantId, request.DataTypes ?? new List<string>());
                if (!result.Success)
                {
                    return BadRequest(new ApiResponse<DuplicateDataResultDto> { Success = false, Message = result.Message, Data = result });
                }
                return Ok(new ApiResponse<DuplicateDataResultDto> { Success = true, Message = result.Message, Data = result });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<DuplicateDataResultDto> { Success = false, Message = ex.Message });
            }
        }
    }

    public class DuplicateDataRequest
    {
        public int SourceTenantId { get; set; }
        public List<string>? DataTypes { get; set; }
    }

    public class SuspendTenantRequest
    {
        public string? Reason { get; set; }
    }

    /// <summary>Response when creating a tenant: tenant data + credentials to give to the client.</summary>
    public class UpdateTenantSubscriptionRequest
    {
        public int PlanId { get; set; }
        public BillingCycle BillingCycle { get; set; }
    }

    public class CreateTenantResponseDto
    {
        public TenantDto Tenant { get; set; } = null!;
        public ClientCredentialsDto ClientCredentials { get; set; } = null!;
    }

    /// <summary>Link, tenant ID, email, and password for the client to log in.</summary>
    public class ClientCredentialsDto
    {
        public string ClientAppLink { get; set; } = string.Empty;
        public int TenantId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}
