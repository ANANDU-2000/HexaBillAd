/*
 * Maintenance Mode Middleware - Returns 503 when platform is under maintenance.
 * SuperAdmin and /api/superadmin/*, /api/auth/*, /api/maintenance-check bypass.
 */
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;

namespace HexaBill.Api.Shared.Middleware
{
    public class MaintenanceMiddleware
    {
        private readonly RequestDelegate _next;

        public MaintenanceMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, AppDbContext dbContext)
        {
            var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";

            // Bypass: SuperAdmin API (SA must access to turn off maintenance)
            if (path.StartsWith("/api/superadmin"))
            {
                await _next(context);
                return;
            }

            // Bypass: Auth endpoints (login, forgot) - SA needs to log in
            if (path.StartsWith("/api/auth"))
            {
                await _next(context);
                return;
            }

            // Bypass: Maintenance check endpoint (anonymous, so frontend can show message)
            if (path.StartsWith("/api/maintenance-check"))
            {
                await _next(context);
                return;
            }

            // Bypass: Health, swagger, static
            if (path.StartsWith("/health") || path.StartsWith("/swagger") || path == "/" || path.StartsWith("/uploads"))
            {
                await _next(context);
                return;
            }

            // Bypass: Authenticated SystemAdmin
            if (context.User?.Identity?.IsAuthenticated == true)
            {
                var tenantIdClaim = context.User.FindFirst("tenant_id")?.Value ?? context.User.FindFirst("owner_id")?.Value;
                if (!string.IsNullOrEmpty(tenantIdClaim) && int.TryParse(tenantIdClaim, out int tid) && tid == 0)
                {
                    await _next(context);
                    return;
                }
            }

            // Check maintenance mode from Settings
            try
            {
                var maintenanceMode = await dbContext.Settings
                    .AsNoTracking()
                    .Where(s => s.OwnerId == 0 && s.Key == "PLATFORM_MAINTENANCE_MODE")
                    .Select(s => s.Value)
                    .FirstOrDefaultAsync();

                if (string.Equals(maintenanceMode, "true", StringComparison.OrdinalIgnoreCase))
                {
                    var messageSetting = await dbContext.Settings
                        .AsNoTracking()
                        .Where(s => s.OwnerId == 0 && s.Key == "PLATFORM_MAINTENANCE_MESSAGE")
                        .Select(s => s.Value)
                        .FirstOrDefaultAsync();

                    var message = !string.IsNullOrEmpty(messageSetting) ? messageSetting : "System under maintenance. Back shortly.";

                    context.Response.StatusCode = 503;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(new
                    {
                        success = false,
                        message,
                        maintenanceMode = true,
                        code = 503
                    }));
                    return;
                }
            }
            catch
            {
                // On DB error, allow request to proceed
            }

            await _next(context);
        }
    }
}
