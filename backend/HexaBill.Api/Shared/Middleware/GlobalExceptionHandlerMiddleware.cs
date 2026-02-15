/*
Purpose: Global exception handler middleware for unhandled exceptions
Author: AI Assistant
Date: 2026-02-14
Task: 98 - Global error handler middleware
*/
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace HexaBill.Api.Shared.Middleware
{
    /// <summary>
    /// Global exception handler middleware that catches all unhandled exceptions,
    /// logs them with a correlation ID, and returns user-friendly JSON responses.
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
            // Generate correlation ID
            var correlationId = Guid.NewGuid().ToString();

            // Log the full exception with correlation ID
            _logger.LogError(
                exception,
                "Unhandled exception occurred. CorrelationId: {CorrelationId}, Path: {Path}, Method: {Method}",
                correlationId,
                context.Request.Path,
                context.Request.Method
            );

            // Prepare user-friendly response
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json";

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
