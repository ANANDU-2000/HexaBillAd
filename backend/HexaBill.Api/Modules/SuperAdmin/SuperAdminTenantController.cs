/*
Purpose: Super Admin Tenant Management Controller
Author: AI Assistant
Date: 2026-02-11
*/
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Subscription;
using HexaBill.Api.Modules.Auth;
using HexaBill.Api.Shared.Extensions;
using HexaBill.Api.Shared.Services;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;

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
        private readonly AppDbContext _context;
        private readonly ITenantActivityService _activityService;
        private readonly ILoginLockoutService _lockoutService;

        public TenantController(ISuperAdminTenantService tenantService, ILogger<TenantController> logger, IConfiguration configuration, AppDbContext context, ITenantActivityService activityService, ILoginLockoutService lockoutService)
        {
            _tenantService = tenantService;
            _logger = logger;
            _configuration = configuration;
            _context = context;
            _activityService = activityService;
            _lockoutService = lockoutService;
        }

        /// <summary>
        /// Unlock a client's login (clear failed attempt lockout). SystemAdmin only.
        /// </summary>
        [HttpPost("/api/superadmin/unlock-login")]
        public async Task<ActionResult<ApiResponse<object>>> UnlockLogin([FromBody] UnlockLoginRequest request)
        {
            if (!IsSystemAdmin) return Forbid();
            if (string.IsNullOrWhiteSpace(request?.Email))
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Email is required" });
            try
            {
                await _lockoutService.ClearAttemptsAsync(request.Email.Trim());
                await WriteSuperAdminAuditAsync("UnlockLogin", null, $"Unlocked login for: {request.Email}");
                return Ok(new ApiResponse<object> { Success = true, Message = $"Login unlocked for {request.Email}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UnlockLogin failed for {Email}", request.Email);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>
        /// Manually lock a client's login. SystemAdmin only.
        /// </summary>
        [HttpPost("/api/superadmin/lock-login")]
        public async Task<ActionResult<ApiResponse<object>>> LockLogin([FromBody] LockLoginRequest request)
        {
            if (!IsSystemAdmin) return Forbid();
            if (string.IsNullOrWhiteSpace(request?.Email))
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Email is required" });
            try
            {
                var duration = request.DurationMinutes > 0 ? request.DurationMinutes : 15;
                await _lockoutService.LockUserAsync(request.Email.Trim(), duration);
                await WriteSuperAdminAuditAsync("LockLogin", null, $"Locked login for: {request.Email} ({duration} min)");
                return Ok(new ApiResponse<object> { Success = true, Message = $"Login locked for {request.Email} ({duration} minutes)" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "LockLogin failed for {Email}", request.Email);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>
        /// Get top tenants by API requests in last 60 minutes (Live Activity). SystemAdmin only.
        /// </summary>
        [HttpGet("/api/superadmin/tenant-activity")]
        public async Task<ActionResult<ApiResponse<object>>> GetTenantActivity()
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var top = _activityService.GetTopTenantsByRequestsLast60Min(10);
                var tenantIds = top.Select(t => t.TenantId).Distinct().ToList();
                var tenants = await _context.Tenants.AsNoTracking()
                    .Where(t => tenantIds.Contains(t.Id))
                    .ToDictionaryAsync(t => t.Id, t => t.Name);
                var result = top.Select(t => new
                {
                    tenantId = t.TenantId,
                    tenantName = tenants.TryGetValue(t.TenantId, out var n) ? n : $"Tenant {t.TenantId}",
                    requestCount = t.RequestCount,
                    lastActiveAt = t.LastActiveAt,
                    isHighVolume = t.IsHighVolume
                }).ToList();
                return Ok(new ApiResponse<object> { Success = true, Data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tenant activity");
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = ex.Message });
            }
        }

        private async Task WriteSuperAdminAuditAsync(string action, int? affectedTenantId, string details)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId)) return;
            try
            {
                _context.AuditLogs.Add(new AuditLog
                {
                    OwnerId = 0,
                    TenantId = affectedTenantId,
                    UserId = userId,
                    Action = $"SuperAdmin:{action}",
                    Details = details,
                    CreatedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to write SuperAdmin audit for {Action}", action);
            }
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
        /// Tenant onboarding tracker: completion steps per tenant; optional filter to incomplete only. SystemAdmin only. See NOT_BUILT.md.
        /// </summary>
        [HttpGet("/api/superadmin/onboarding-report")]
        public async Task<ActionResult<ApiResponse<OnboardingReportDto>>> GetOnboardingReport([FromQuery] bool incompleteOnly = false)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var report = await _tenantService.GetOnboardingReportAsync(incompleteOnly);
                return Ok(new ApiResponse<OnboardingReportDto> { Success = true, Data = report });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<OnboardingReportDto> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>
        /// Log SuperAdmin impersonation start (audit trail). Call before redirecting to tenant workspace.
        /// </summary>
        [HttpPost("impersonate/enter")]
        public async Task<ActionResult<ApiResponse<object>>> ImpersonateEnter([FromBody] ImpersonateRequest request)
        {
            if (!IsSystemAdmin) return Forbid();
            if (request?.TenantId == null || request.TenantId <= 0) return BadRequest(new ApiResponse<object> { Success = false, Message = "Invalid tenantId" });
            try
            {
                var tenant = await _context.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == request.TenantId);
                var tenantName = tenant?.Name ?? $"Tenant {request.TenantId}";
                await WriteSuperAdminAuditAsync("ImpersonateEnter", request.TenantId, $"Entered workspace of: {tenantName}");
                return Ok(new ApiResponse<object> { Success = true, Message = "Logged" });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to log impersonate enter");
                return Ok(new ApiResponse<object> { Success = true, Message = "Logged" }); // Don't block impersonation on audit failure
            }
        }

        /// <summary>
        /// Log SuperAdmin impersonation end (audit trail). Call when exiting tenant workspace.
        /// </summary>
        [HttpPost("impersonate/exit")]
        public async Task<ActionResult<ApiResponse<object>>> ImpersonateExit([FromBody] ImpersonateExitRequest request)
        {
            if (!IsSystemAdmin) return Forbid();
            var tenantId = request?.TenantId ?? 0;
            var details = !string.IsNullOrEmpty(request?.TenantName)
                ? $"Exited workspace of: {request.TenantName}"
                : tenantId > 0 ? $"Exited workspace of tenant {tenantId}" : "Exited impersonation";
            try
            {
                await WriteSuperAdminAuditAsync("ImpersonateExit", tenantId > 0 ? tenantId : null, details);
                return Ok(new ApiResponse<object> { Success = true, Message = "Logged" });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to log impersonate exit");
                return Ok(new ApiResponse<object> { Success = true, Message = "Logged" });
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
                // Log full exception details for debugging
                _logger.LogError(ex, "Error getting tenants: {Message}", ex.Message);
                if (ex.InnerException != null)
                {
                    _logger.LogError("Inner exception: {InnerMessage}", ex.InnerException.Message);
                }
                
                return StatusCode(500, new ApiResponse<PagedResponse<TenantDto>>
                {
                    Success = false,
                    Message = "An error occurred while retrieving tenants",
                    Errors = new List<string> 
                    { 
                        ex.Message,
                        ex.InnerException?.Message ?? "No inner exception"
                    }.Where(e => !string.IsNullOrEmpty(e)).ToList()
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
                var msg = ex.InnerException?.Message ?? ex.Message;
                _logger.LogError(ex, "GetTenant failed for tenant {TenantId}", id);
                return StatusCode(500, new ApiResponse<TenantDetailDto>
                {
                    Success = false,
                    Message = msg,
                    Errors = new List<string> { msg }.Concat(ex.InnerException != null && ex.InnerException.Message != msg ? new[] { ex.Message } : Array.Empty<string>()).Where(e => !string.IsNullOrEmpty(e)).ToList()
                });
            }
        }

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

                var (tenant, generatedPassword) = await _tenantService.CreateTenantAsync(request);
                await WriteSuperAdminAuditAsync("CreateTenant", tenant.Id, $"Tenant: {tenant.Name}, Email: {tenant.Email ?? request.Email ?? "N/A"}");

                // Login URL for credentials modal: prefer frontend-supplied origin, then server env (FRONTEND_URL / ClientApp__BaseUrl), else localhost in dev
                var clientAppLink = request.ClientAppBaseUrl?.Trim()
                    ?? (_configuration["ClientApp:BaseUrl"] ?? Environment.GetEnvironmentVariable("FRONTEND_URL") ?? Environment.GetEnvironmentVariable("ClientApp__BaseUrl"))?.Trim();
                if (string.IsNullOrWhiteSpace(clientAppLink))
                {
                    var isProd = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Production", StringComparison.OrdinalIgnoreCase);
                    clientAppLink = isProd
                        ? "(Set FRONTEND_URL or ClientApp__BaseUrl on server, or ensure frontend sends ClientAppBaseUrl)"
                        : "http://localhost:5176";
                }
                clientAppLink = clientAppLink.TrimEnd('/');
                var clientEmail = tenant.Email ?? request.Email ?? "";

                var response = new CreateTenantResponseDto
                {
                    Tenant = tenant,
                    ClientCredentials = new ClientCredentialsDto
                    {
                        ClientAppLink = clientAppLink,
                        TenantId = tenant.Id,
                        Email = clientEmail,
                        Password = generatedPassword // Randomly generated password - shown once, never stored
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
        /// List tenant invoices (read-only, no impersonation). SystemAdmin only. See NOT_BUILT.md.
        /// </summary>
        [HttpGet("{id}/invoices")]
        public async Task<ActionResult<ApiResponse<PagedResponse<TenantInvoiceListItemDto>>>> GetTenantInvoices(int id, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var result = await _tenantService.GetTenantInvoicesAsync(id, page, pageSize);
                return Ok(new ApiResponse<PagedResponse<TenantInvoiceListItemDto>> { Success = true, Data = result });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<PagedResponse<TenantInvoiceListItemDto>> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>
        /// Subscription/payment history for tenant (when paid, renewals, payment method). SystemAdmin only. See NOT_BUILT.md.
        /// </summary>
        [HttpGet("{id}/payment-history")]
        public async Task<ActionResult<ApiResponse<List<TenantPaymentHistoryItemDto>>>> GetTenantPaymentHistory(int id)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var result = await _tenantService.GetTenantPaymentHistoryAsync(id);
                return Ok(new ApiResponse<List<TenantPaymentHistoryItemDto>> { Success = true, Data = result });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<TenantPaymentHistoryItemDto>> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>
        /// Export tenant key data (invoices, customers, products) as ZIP of CSVs for offboarding/compliance. SystemAdmin only. See NOT_BUILT.md.
        /// </summary>
        [HttpGet("{id}/export")]
        public async Task<IActionResult> ExportTenantData(int id)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var (stream, fileName) = await _tenantService.ExportTenantDataAsync(id);
                return File(stream, "application/zip", fileName);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Export tenant data failed for tenant {TenantId}", id);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>
        /// Bulk tenant actions: extend trial, send announcement. SystemAdmin only. See NOT_BUILT.md.
        /// </summary>
        [HttpPost("bulk-actions")]
        public async Task<ActionResult<ApiResponse<BulkActionResultDto>>> ExecuteBulkAction([FromBody] BulkActionRequest request)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var result = await _tenantService.ExecuteBulkActionAsync(request ?? new BulkActionRequest());
                return Ok(new ApiResponse<BulkActionResultDto> { Success = true, Data = result });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<BulkActionResultDto> { Success = false, Message = ex.Message });
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
                await WriteSuperAdminAuditAsync("SuspendTenant", id, $"Reason: {request.Reason ?? "Suspended by Super Admin"}");

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
                await WriteSuperAdminAuditAsync("ActivateTenant", id, "Tenant reactivated");

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
                var msg = ex.InnerException?.Message ?? ex.Message;
                _logger.LogError(ex, "DeleteTenant failed for tenant {TenantId}", id);
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = msg,
                    Errors = new List<string> { msg }.Concat(ex.InnerException != null && ex.InnerException.Message != msg ? new[] { ex.Message } : Array.Empty<string>()).Where(e => !string.IsNullOrEmpty(e)).ToList()
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
                await WriteSuperAdminAuditAsync("ClearTenantData", id, "All transactional data cleared for tenant");

                return Ok(new ApiResponse<object> { Success = true, Message = "Tenant data cleared successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "ClearTenantData error for tenant {TenantId}. InnerMessage={Inner}",
                    id,
                    ex.InnerException?.Message);

                return StatusCode(500, new ApiResponse<object> 
                { 
                    Success = false, 
                    Message = "An error occurred while clearing tenant data",
                    Errors = new List<string> { ex.Message, ex.InnerException?.Message ?? "" }.Where(e => !string.IsNullOrEmpty(e)).ToList()
                });
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
                await WriteSuperAdminAuditAsync("UpdateTenantSubscription", id, $"PlanId: {request.PlanId}, BillingCycle: {request.BillingCycle}");

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

        [HttpPost("{id}/users/{userId}/force-logout")]
        public async Task<ActionResult<ApiResponse<bool>>> ForceLogoutUser(int id, int userId)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var adminUserId = int.Parse(User.FindFirst("id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
                var success = await _tenantService.ForceLogoutUserAsync(id, userId, adminUserId);
                if (!success) return NotFound(new ApiResponse<bool> { Success = false, Message = "User not found" });
                return Ok(new ApiResponse<bool> { Success = true, Message = "User will be logged out on next request", Data = true });
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

        /// <summary>Get this tenant's API request count (last 60 min). SystemAdmin only. For usage/rate visibility.</summary>
        [HttpGet("{id}/activity")]
        public async Task<ActionResult<ApiResponse<object>>> GetTenantActivity(int id)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var (requestCount, lastActiveAt) = _activityService.GetRequestCountForTenantLast60Min(id);
                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Data = new
                    {
                        requestCountLast60Min = requestCount,
                        isHighVolume = requestCount > 500,
                        lastActiveAt
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tenant activity for {TenantId}", id);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>Get per-tenant rate limits and quotas. SystemAdmin only.</summary>
        [HttpGet("{id}/limits")]
        public async Task<ActionResult<ApiResponse<TenantLimitsDto>>> GetTenantLimits(int id)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var limits = await _tenantService.GetTenantLimitsAsync(id);
                return Ok(new ApiResponse<TenantLimitsDto> { Success = true, Data = limits });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<TenantLimitsDto> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>Update per-tenant rate limits and quotas. SystemAdmin only.</summary>
        [HttpPut("{id}/limits")]
        public async Task<ActionResult<ApiResponse<object>>> UpdateTenantLimits(int id, [FromBody] TenantLimitsDto dto)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                await _tenantService.UpdateTenantLimitsAsync(id, dto);
                return Ok(new ApiResponse<object> { Success = true, Message = "Limits updated" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>Preview what would be copied (product/settings counts) and what target already has. SystemAdmin only.</summary>
        [HttpGet("{id}/duplicate-data/preview")]
        public async Task<ActionResult<ApiResponse<DuplicateDataPreviewDto>>> GetDuplicateDataPreview(int id, [FromQuery] int sourceTenantId, [FromQuery] string? dataTypes = null)
        {
            if (!IsSystemAdmin) return Forbid();
            if (sourceTenantId <= 0)
            {
                return BadRequest(new ApiResponse<DuplicateDataPreviewDto> { Success = false, Message = "sourceTenantId is required." });
            }
            var types = string.IsNullOrEmpty(dataTypes)
                ? new List<string>()
                : dataTypes.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()).ToList();
            if (types.Count == 0) types = new List<string> { "Products", "Settings" };
            try
            {
                var preview = await _tenantService.GetDuplicateDataPreviewAsync(id, sourceTenantId, types);
                return Ok(new ApiResponse<DuplicateDataPreviewDto> { Success = true, Data = preview });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<DuplicateDataPreviewDto> { Success = false, Message = ex.Message });
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

        /// <summary>Get tenant's enabled features (feature flags). SystemAdmin only.</summary>
        [HttpGet("{id}/features")]
        public async Task<ActionResult<ApiResponse<object>>> GetTenantFeatures(int id)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var tenant = await _context.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
                if (tenant == null) return NotFound(new ApiResponse<object> { Success = false, Message = "Tenant not found" });

                // Return as object { features: ["crm", "pos"] }
                var features = new List<string>();
                if (!string.IsNullOrEmpty(tenant.FeaturesJson))
                {
                    try 
                    { 
                        features = System.Text.Json.JsonSerializer.Deserialize<List<string>>(tenant.FeaturesJson) ?? new List<string>(); 
                    }
                    catch { }
                }
                
                return Ok(new ApiResponse<object> { Success = true, Data = new { features } });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>Update tenant's enabled features. SystemAdmin only.</summary>
        [HttpPut("{id}/features")]
        public async Task<ActionResult<ApiResponse<object>>> UpdateTenantFeatures(int id, [FromBody] List<string> features)
        {
            if (!IsSystemAdmin) return Forbid();
            try
            {
                var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == id);
                if (tenant == null) return NotFound(new ApiResponse<object> { Success = false, Message = "Tenant not found" });

                tenant.FeaturesJson = System.Text.Json.JsonSerializer.Serialize(features ?? new List<string>());
                
                // Add audit log for feature change
                await WriteSuperAdminAuditAsync("UpdateFeatures", id, $"Updated features: {string.Join(", ", features ?? new List<string>())}");

                await _context.SaveChangesAsync();
                return Ok(new ApiResponse<object> { Success = true, Message = "Features updated" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = ex.Message });
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

    public class ImpersonateRequest
    {
        public int TenantId { get; set; }
    }

    public class ImpersonateExitRequest
    {
        public int? TenantId { get; set; }
        public string? TenantName { get; set; }
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
