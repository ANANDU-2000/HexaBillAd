/*
Purpose: Audit service for tracking user actions with IP address and field-level change tracking
Author: AI Assistant
Date: 2026
*/
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace HexaBill.Api.Shared.Services
{
    /// <summary>
    /// Service for audit logging with automatic IP address and user ID capture
    /// </summary>
    public interface IAuditService
    {
        /// <summary>
        /// Log an audit event with automatic user ID and IP address capture
        /// </summary>
        /// <param name="action">Action description (e.g., "Product Created", "Sale Updated")</param>
        /// <param name="entityType">Type of entity being audited (e.g., "Product", "Sale", "Customer")</param>
        /// <param name="entityId">ID of the entity being audited (nullable)</param>
        /// <param name="oldValues">Previous values (will be serialized to JSON)</param>
        /// <param name="newValues">New values (will be serialized to JSON)</param>
        /// <param name="details">Additional details (optional, for backward compatibility)</param>
        Task LogAsync(
            string action,
            string? entityType = null,
            int? entityId = null,
            object? oldValues = null,
            object? newValues = null,
            string? details = null);
    }

    public class AuditService : IAuditService
    {
        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ITenantContextService _tenantContextService;
        private readonly ILogger<AuditService> _logger;

        public AuditService(
            AppDbContext context,
            IHttpContextAccessor httpContextAccessor,
            ITenantContextService tenantContextService,
            ILogger<AuditService> logger)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
            _tenantContextService = tenantContextService;
            _logger = logger;
        }

        public async Task LogAsync(
            string action,
            string? entityType = null,
            int? entityId = null,
            object? oldValues = null,
            object? newValues = null,
            string? details = null)
        {
            try
            {
                var httpContext = _httpContextAccessor.HttpContext;
                
                // Get user ID from HttpContext claims
                int? userId = null;
                if (httpContext?.User?.Identity?.IsAuthenticated == true)
                {
                    var userIdClaim = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                        ?? httpContext.User.FindFirst("id")?.Value
                        ?? httpContext.User.FindFirst("UserId")?.Value;
                    
                    if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int parsedUserId))
                    {
                        userId = parsedUserId;
                    }
                }

                // If no user ID found, skip audit logging (might be system operation or unauthenticated request)
                if (!userId.HasValue)
                {
                    _logger.LogWarning("Audit log skipped: No user ID found in HttpContext for action: {Action}", action);
                    return;
                }

                // Get IP address from HttpContext
                string? ipAddress = GetIpAddress(httpContext);

                // Get tenant ID
                int? tenantId = _tenantContextService.GetCurrentTenantId();
                int ownerId = tenantId ?? 0; // Legacy OwnerId for backward compatibility

                // Serialize old/new values to JSON
                string? oldValuesJson = null;
                string? newValuesJson = null;

                if (oldValues != null)
                {
                    try
                    {
                        oldValuesJson = JsonSerializer.Serialize(oldValues, new JsonSerializerOptions
                        {
                            WriteIndented = false,
                            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                        });
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to serialize oldValues for audit log");
                        oldValuesJson = oldValues.ToString();
                    }
                }

                if (newValues != null)
                {
                    try
                    {
                        newValuesJson = JsonSerializer.Serialize(newValues, new JsonSerializerOptions
                        {
                            WriteIndented = false,
                            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                        });
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to serialize newValues for audit log");
                        newValuesJson = newValues.ToString();
                    }
                }

                // Create audit log entry
                var auditLog = new AuditLog
                {
                    OwnerId = ownerId,
                    TenantId = tenantId,
                    UserId = userId.Value,
                    Action = action,
                    EntityType = entityType,
                    EntityId = entityId,
                    OldValues = oldValuesJson,
                    NewValues = newValuesJson,
                    IpAddress = ipAddress,
                    Details = details,
                    CreatedAt = DateTime.UtcNow
                };

                _context.AuditLogs.Add(auditLog);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // Audit logging should not throw exceptions - log and continue
                _logger.LogError(ex, "Failed to create audit log for action: {Action}", action);
            }
        }

        /// <summary>
        /// Extract IP address from HttpContext, handling proxies and load balancers
        /// </summary>
        private string? GetIpAddress(HttpContext? httpContext)
        {
            if (httpContext == null)
                return null;

            // Check X-Forwarded-For header first (for proxies/load balancers)
            var forwardedFor = httpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault();
            if (!string.IsNullOrEmpty(forwardedFor))
            {
                // X-Forwarded-For can contain multiple IPs, take the first one
                var ips = forwardedFor.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (ips.Length > 0)
                {
                    return ips[0];
                }
            }

            // Check X-Real-IP header (alternative proxy header)
            var realIp = httpContext.Request.Headers["X-Real-IP"].FirstOrDefault();
            if (!string.IsNullOrEmpty(realIp))
            {
                return realIp;
            }

            // Fallback to Connection.RemoteIpAddress
            var remoteIp = httpContext.Connection.RemoteIpAddress;
            if (remoteIp != null)
            {
                // Handle IPv4-mapped IPv6 addresses
                if (remoteIp.IsIPv4MappedToIPv6)
                {
                    return remoteIp.MapToIPv4().ToString();
                }
                return remoteIp.ToString();
            }

            return null;
        }
    }
}
