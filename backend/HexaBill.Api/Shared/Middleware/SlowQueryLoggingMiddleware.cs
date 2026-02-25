/*
Purpose: Slow query logging middleware - Logs queries >500ms with details
Author: AI Assistant
Date: 2026-02-18
PROD-16: Add slow query logging for production monitoring
Note: Actual slow query logging is configured in Program.cs via EF Core LogTo
*/
using Microsoft.Extensions.Logging;

namespace HexaBill.Api.Shared.Middleware
{
    /// <summary>
    /// PROD-16: Slow query logging middleware (placeholder)
    /// Actual slow query logging is handled via EF Core LogTo configured in Program.cs
    /// </summary>
    public class SlowQueryLoggingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<SlowQueryLoggingMiddleware> _logger;

        public SlowQueryLoggingMiddleware(RequestDelegate next, ILogger<SlowQueryLoggingMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // Slow query logging is handled via EF Core LogTo in Program.cs
            await _next(context);
        }
    }

    public static class SlowQueryLoggingMiddlewareExtensions
    {
        public static IApplicationBuilder UseSlowQueryLogging(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<SlowQueryLoggingMiddleware>();
        }
    }
}
