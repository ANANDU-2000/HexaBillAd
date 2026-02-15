/*
Purpose: Tenant context middleware for multi-tenant SaaS isolation
Author: AI Assistant
Date: 2026
*/
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Shared.Middleware
{
    /// <summary>
    /// Middleware that validates tenant and sets context for every request
    /// MUST be registered AFTER authentication, BEFORE authorization
    /// </summary>
    public class TenantContextMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<TenantContextMiddleware> _logger;

        public TenantContextMiddleware(RequestDelegate next, ILogger<TenantContextMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context, AppDbContext dbContext)
        {
            // Skip for public endpoints
            var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";
            if (path.StartsWith("/api/auth") ||
                path.StartsWith("/health") ||
                path == "/" ||
                path.StartsWith("/swagger"))
            {
                await _next(context);
                return;
            }

            // Skip if not authenticated
            if (!context.User.Identity?.IsAuthenticated ?? true)
            {
                await _next(context);
                return;
            }

            try
            {
                // Extract tenant_id from JWT claim (or owner_id during migration)
                var tenantIdClaim = context.User.FindFirst("tenant_id")?.Value
                    ?? context.User.FindFirst("owner_id")?.Value; // Migration fallback

                if (string.IsNullOrEmpty(tenantIdClaim))
                {
                    _logger.LogWarning("No tenant_id or owner_id claim found in token for user {UserId}",
                        context.User.FindFirst("id")?.Value);
                    
                    // SystemAdmin may not have tenant_id - allow to proceed
                    context.Items["TenantId"] = 0; // 0 = SystemAdmin
                    await _next(context);
                    return;
                }

                if (!int.TryParse(tenantIdClaim, out int tenantId))
                {
                    _logger.LogError("Invalid tenant_id format in token: {TenantIdClaim}", tenantIdClaim);
                    context.Response.StatusCode = 401;
                    await context.Response.WriteAsync("Invalid tenant context");
                    return;
                }

                // SystemAdmin has TenantId = 0 (or null in database)
                if (tenantId == 0)
                {
                    context.Items["TenantId"] = 0;
                    await _next(context);
                    return;
                }

                // Validate tenant exists and is active
                var tenant = await dbContext.Tenants
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.Id == tenantId);

                if (tenant == null)
                {
                    _logger.LogWarning("Tenant {TenantId} not found in database", tenantId);
                    context.Response.StatusCode = 403;
                    await context.Response.WriteAsync("Tenant not found");
                    return;
                }

                // Check tenant status
                if (tenant.Status == TenantStatus.Suspended)
                {
                    _logger.LogWarning("Tenant {TenantId} is suspended", tenantId);
                    context.Response.StatusCode = 403;
                    await context.Response.WriteAsync("Tenant account is suspended");
                    return;
                }

                if (tenant.Status == TenantStatus.Expired)
                {
                    _logger.LogWarning("Tenant {TenantId} trial has expired", tenantId);
                    context.Response.StatusCode = 403;
                    await context.Response.WriteAsync("Tenant trial has expired");
                    return;
                }

                // Check trial expiration
                if (tenant.Status == TenantStatus.Trial && tenant.TrialEndDate.HasValue)
                {
                    if (tenant.TrialEndDate.Value < DateTime.UtcNow)
                    {
                        _logger.LogWarning("Tenant {TenantId} trial expired on {TrialEndDate}", 
                            tenantId, tenant.TrialEndDate);
                        context.Response.StatusCode = 403;
                        await context.Response.WriteAsync("Tenant trial has expired");
                        return;
                    }
                }

                // Set tenant context
                context.Items["TenantId"] = tenantId;

                // Set PostgreSQL session variable for RLS only when using PostgreSQL (SQLite does not support SET)
                var connString = (dbContext.Database.GetConnectionString() ?? "").Trim();
                var isSqlite = connString.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase) ||
                              connString.Contains(".db", StringComparison.OrdinalIgnoreCase);
                var isPostgres = connString.StartsWith("Host=", StringComparison.OrdinalIgnoreCase) ||
                                connString.StartsWith("Server=", StringComparison.OrdinalIgnoreCase);
                if (!isSqlite && isPostgres)
                {
                    try
                    {
                        // PostgreSQL SET does not accept parameterized $1; use set_config which does
                        await dbContext.Database.ExecuteSqlRawAsync(
                            "SELECT set_config('app.tenant_id', {0}, true)",
                            tenantId.ToString());
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to set PostgreSQL session variable app.tenant_id");
                    }
                }

                await _next(context);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in TenantContextMiddleware");
                context.Response.StatusCode = 500;
                await context.Response.WriteAsync("Internal server error");
            }
        }
    }

    public static class TenantContextMiddlewareExtensions
    {
        public static IApplicationBuilder UseTenantContext(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<TenantContextMiddleware>();
        }
    }
}
