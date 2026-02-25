/*
Purpose: Global exception handler middleware for unhandled exceptions
Author: AI Assistant
Date: 2026-02-14
Task: 98 - Global error handler middleware
Production: Persist 500s to ErrorLogs for Super Admin (SQLite + PostgreSQL).
*/
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.Security.Claims;
using System.Text.Json;
using System;
using HexaBill.Api.Shared.Services;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Shared.Middleware
{
    /// <summary>
    /// Global exception handler middleware that catches all unhandled exceptions,
    /// logs them with a correlation ID, persists to ErrorLogs, and returns user-friendly JSON.
    /// MUST be registered FIRST in the middleware pipeline.
    /// </summary>
    public class GlobalExceptionHandlerMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<GlobalExceptionHandlerMiddleware> _logger;

        public GlobalExceptionHandlerMiddleware(RequestDelegate next, ILogger<GlobalExceptionHandlerMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                await HandleExceptionAsync(context, ex);
            }
        }

        private async Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            // PROD-18: Reuse correlation ID from RequestLoggingMiddleware if available
            var correlationId = context.GetCorrelationIdOrNull() ?? Guid.NewGuid().ToString("N")[..12];
            context.SetCorrelationId(correlationId); // Ensure it's set for response

            _logger.LogError(
                exception,
                "Unhandled exception occurred. CorrelationId: {CorrelationId}, Path: {Path}, Method: {Method}",
                correlationId,
                context.Request.Path,
                context.Request.Method
            );

            // Persist to ErrorLogs for Super Admin (works with both SQLite and PostgreSQL)
            try
            {
                var errorLogService = context.RequestServices.GetService<IErrorLogService>();
                if (errorLogService != null)
                {
                    int? tenantId = null;
                    int? userId = null;
                    if (context.User?.Identity?.IsAuthenticated == true)
                    {
                        tenantId = context.User.GetTenantIdOrNullForSystemAdmin();
                        if (int.TryParse(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid))
                            userId = uid;
                    }
                    var path = context.Request.Path.Value;
                    var method = context.Request.Method;
                    await errorLogService.LogAsync(
                        correlationId,
                        "500",
                        exception.Message?.Length > 2000 ? exception.Message[..2000] : exception.Message ?? "Unhandled exception",
                        exception.StackTrace,
                        path?.Length > 500 ? path[..500] : path,
                        method?.Length > 16 ? method[..16] : method,
                        tenantId,
                        userId,
                        context.RequestAborted
                    );
                }
            }
            catch
            {
                // Do not let logging failure affect the response
            }

            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json";
            
            // CRITICAL FIX: Add CORS headers even on errors so frontend can read the error response
            var origin = context.Request.Headers.Origin.ToString();
            var isLocalhost = origin.StartsWith("http://localhost:", StringComparison.OrdinalIgnoreCase) || 
                             origin.StartsWith("http://127.0.0.1:", StringComparison.OrdinalIgnoreCase);
            var isAllowed = !string.IsNullOrEmpty(origin) && (
                isLocalhost || 
                origin.EndsWith(".vercel.app", StringComparison.OrdinalIgnoreCase) ||
                origin.Contains("hexabill.company", StringComparison.OrdinalIgnoreCase));
            if (isAllowed)
            {
                context.Response.Headers.Append("Access-Control-Allow-Origin", origin);
                context.Response.Headers.Append("Access-Control-Allow-Credentials", "true");
            }

            var response = new
            {
                success = false,
                message = "An unexpected error occurred.",
                correlationId = correlationId
            };

            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true
            };

            await context.Response.WriteAsJsonAsync(response, jsonOptions);
        }
    }
}
