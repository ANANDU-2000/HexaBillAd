/*
Purpose: Alerts controller for admin notifications
Author: AI Assistant
Date: 2025
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Modules.Notifications;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.Notifications
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AlertsController : TenantScopedController // MULTI-TENANT: Owner-scoped alerts
    {
        private readonly IAlertService _alertService;

        public AlertsController(IAlertService alertService)
        {
            _alertService = alertService;
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<Alert>>>> GetAlerts([FromQuery] bool unreadOnly = false, [FromQuery] int limit = 50)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var alerts = await _alertService.GetAlertsAsync(unreadOnly, limit, tenantId);
                return Ok(new ApiResponse<List<Alert>>
                {
                    Success = true,
                    Message = "Alerts retrieved successfully",
                    Data = alerts
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<Alert>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("unread-count")]
        public async Task<ActionResult<ApiResponse<int>>> GetUnreadCount()
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0 && !IsSystemAdmin)
                {
                    return Ok(new ApiResponse<int> { Success = true, Data = 0 });
                }
                
                var count = await _alertService.GetUnreadCountAsync(tenantId);
                return Ok(new ApiResponse<int>
                {
                    Success = true,
                    Message = "Unread count retrieved successfully",
                    Data = count
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ GetUnreadCount Error: {ex.Message}");
                if (ex.InnerException != null) Console.WriteLine($"❌ Inner: {ex.InnerException.Message}");
                Console.WriteLine($"❌ Stack Trace: {ex.StackTrace}");
                
                return StatusCode(500, new ApiResponse<int>
                {
                    Success = false,
                    Message = "An error occurred while retrieving unread count",
                    Errors = new List<string> { ex.Message, ex.InnerException?.Message }.Where(s => !string.IsNullOrEmpty(s)).ToList()
                });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<Alert>>> GetAlert(int id)
        {
            try
            {
                var alert = await _alertService.GetAlertByIdAsync(id, CurrentTenantId);
                if (alert == null)
                {
                    return NotFound(new ApiResponse<Alert>
                    {
                        Success = false,
                        Message = "Alert not found"
                    });
                }

                return Ok(new ApiResponse<Alert>
                {
                    Success = true,
                    Message = "Alert retrieved successfully",
                    Data = alert
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<Alert>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("{id}/read")]
        public async Task<ActionResult<ApiResponse<bool>>> MarkAsRead(int id)
        {
            try
            {
                await _alertService.MarkAsReadAsync(id, CurrentTenantId);
                return Ok(new ApiResponse<bool>
                {
                    Success = true,
                    Message = "Alert marked as read",
                    Data = true
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<bool>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("{id}/resolve")]
        public async Task<ActionResult<ApiResponse<bool>>> MarkAsResolved(int id)
        {
            try
            {
                var userIdClaim = User.FindFirst("UserId") ?? 
                                  User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? 
                                  User.FindFirst("id");
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId) || userId == 0)
                {
                    return Unauthorized(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = "Invalid user authentication"
                    });
                }

                await _alertService.MarkAsResolvedAsync(id, userId, CurrentTenantId);
                return Ok(new ApiResponse<bool>
                {
                    Success = true,
                    Message = "Alert marked as resolved",
                    Data = true
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<bool>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("mark-all-read")]
        public async Task<ActionResult<ApiResponse<int>>> MarkAllAsRead()
        {
            try
            {
                var count = await _alertService.MarkAllAsReadAsync(CurrentTenantId);
                return Ok(new ApiResponse<int>
                {
                    Success = true,
                    Message = $"Marked {count} alerts as read",
                    Data = count
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<int>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("resolve-all")]
        public async Task<ActionResult<ApiResponse<int>>> MarkAllAsResolved()
        {
            try
            {
                var userIdClaim = User.FindFirst("UserId") ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? User.FindFirst("id");
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId) || userId == 0)
                {
                    return Unauthorized(new ApiResponse<int> { Success = false, Message = "Invalid user authentication" });
                }
                var count = await _alertService.MarkAllAsResolvedAsync(userId, CurrentTenantId);
                return Ok(new ApiResponse<int>
                {
                    Success = true,
                    Message = $"Marked {count} alerts as resolved",
                    Data = count
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<int>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("clear-resolved")]
        public async Task<ActionResult<ApiResponse<int>>> ClearResolvedAlerts()
        {
            try
            {
                var count = await _alertService.ClearResolvedAlertsAsync(CurrentTenantId);
                return Ok(new ApiResponse<int>
                {
                    Success = true,
                    Message = $"Cleared {count} resolved alerts",
                    Data = count
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<int>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }
    }
}
