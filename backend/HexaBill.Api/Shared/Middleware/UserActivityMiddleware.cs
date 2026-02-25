/*
Purpose: User Activity Middleware - Updates LastActiveAt timestamp for authenticated users
Author: AI Assistant
Date: 2026-02-18
*/
using System.Security.Claims;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Shared.Middleware
{
    /// <summary>
    /// BUG #2.9 FIX: Automatically updates User.LastActiveAt on authenticated API requests
    /// Enables online/offline indicator on Users page
    /// </summary>
    public class UserActivityMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<UserActivityMiddleware> _logger;

        public UserActivityMiddleware(RequestDelegate next, ILogger<UserActivityMiddleware> logger)
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
                path.StartsWith("/swagger") ||
                path.StartsWith("/api/users/activity")) // Skip the activity endpoint itself to avoid recursion
            {
                await _next(context);
                return;
            }

            // Only update for authenticated users
            if (context.User?.Identity?.IsAuthenticated == true)
            {
                try
                {
                    var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                        ?? context.User.FindFirst("id")?.Value
                        ?? context.User.FindFirst("sub")?.Value;

                    if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int userId) && userId > 0)
                    {
                        // Update LastActiveAt asynchronously (fire and forget to avoid blocking request)
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                // Use a separate scope to avoid DbContext disposal issues
                                using var scope = context.RequestServices.CreateScope();
                                var scopedContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                                
                                var user = await scopedContext.Users.FindAsync(userId);
                                if (user != null)
                                {
                                    // Only update if more than 30 seconds have passed since last update (reduce DB writes)
                                    var shouldUpdate = !user.LastActiveAt.HasValue || 
                                                      (DateTime.UtcNow - user.LastActiveAt.Value).TotalSeconds > 30;
                                    
                                    if (shouldUpdate)
                                    {
                                        user.LastActiveAt = DateTime.UtcNow;
                                        await scopedContext.SaveChangesAsync();
                                    }
                                }
                            }
                            catch (Exception ex)
                            {
                                // Silently fail - activity tracking is best-effort
                                _logger.LogDebug(ex, "Failed to update LastActiveAt for user {UserId}", userId);
                            }
                        });
                    }
                }
                catch (Exception ex)
                {
                    // Silently fail - activity tracking is best-effort
                    _logger.LogDebug(ex, "Error in UserActivityMiddleware: {Message}", ex.Message);
                }
            }

            await _next(context);
        }
    }

    public static class UserActivityMiddlewareExtensions
    {
        public static IApplicationBuilder UseUserActivity(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<UserActivityMiddleware>();
        }
    }
}
