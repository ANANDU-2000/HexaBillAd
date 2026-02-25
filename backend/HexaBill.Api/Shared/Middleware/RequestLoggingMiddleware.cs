/*
Purpose: Request logging middleware - Logs TenantId, endpoint, duration, status code, correlation ID
Author: AI Assistant
Date: 2026-02-18
PROD-2: Add structured request logging for production monitoring
*/
using System.Diagnostics;
using Microsoft.Extensions.Logging;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Shared.Middleware
{
    /// <summary>
    /// PROD-2: Request logging middleware for production monitoring
    /// Logs: TenantId, endpoint, duration, status code, correlation ID
    /// </summary>
    public class RequestLoggingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<RequestLoggingMiddleware> _logger;

        public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var correlationId = Guid.NewGuid().ToString("N")[..12];
            context.Items["CorrelationId"] = correlationId;

            var stopwatch = Stopwatch.StartNew();
            var path = context.Request.Path.Value ?? "";
            var method = context.Request.Method;

            // Skip logging for health checks and static files
            if (path.StartsWith("/health") || 
                path.StartsWith("/swagger") || 
                path.StartsWith("/uploads") ||
                path == "/" ||
                path.StartsWith("/api/health"))
            {
                await _next(context);
                return;
            }

            // Get tenant ID if available
            int? tenantId = null;
            int? userId = null;

            if (context.User?.Identity?.IsAuthenticated == true)
            {
                tenantId = context.User.GetTenantIdOrNullForSystemAdmin();
                if (int.TryParse(context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid))
                    userId = uid;
            }
            else if (context.Items.TryGetValue("TenantId", out var tid) && tid is int tidInt)
            {
                tenantId = tidInt;
            }

            try
            {
                await _next(context);
            }
            finally
            {
                stopwatch.Stop();
                var statusCode = context.Response.StatusCode;
                var duration = stopwatch.ElapsedMilliseconds;

                // Log slow requests (>500ms) and errors (4xx, 5xx)
                if (duration > 500 || statusCode >= 400)
                {
                    _logger.LogWarning(
                        "Request: {Method} {Path} | Status: {StatusCode} | Duration: {Duration}ms | TenantId: {TenantId} | UserId: {UserId} | CorrelationId: {CorrelationId}",
                        method,
                        path,
                        statusCode,
                        duration,
                        tenantId ?? 0,
                        userId ?? 0,
                        correlationId
                    );
                }
                else
                {
                    _logger.LogDebug(
                        "Request: {Method} {Path} | Status: {StatusCode} | Duration: {Duration}ms | TenantId: {TenantId} | UserId: {UserId} | CorrelationId: {CorrelationId}",
                        method,
                        path,
                        statusCode,
                        duration,
                        tenantId ?? 0,
                        userId ?? 0,
                        correlationId
                    );
                }
            }
        }
    }

    public static class RequestLoggingMiddlewareExtensions
    {
        public static IApplicationBuilder UseRequestLogging(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<RequestLoggingMiddleware>();
        }
    }
}
