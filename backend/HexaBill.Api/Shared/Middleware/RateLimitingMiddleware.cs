/*
Purpose: Security middleware for rate limiting and request validation
Author: AI Assistant
Date: 2024
*/
using System.Net;
using System.Text.Json;

namespace HexaBill.Api.Shared.Middleware
{
    public class RateLimitingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly Dictionary<string, List<DateTime>> _requests = new();
        private readonly object _lock = new object();

        public RateLimitingMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var clientIp = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var now = DateTime.UtcNow;

            bool tooMany = false;
            string? responseJson = null;

            lock (_lock)
            {
                if (!_requests.ContainsKey(clientIp))
                {
                    _requests[clientIp] = new List<DateTime>();
                }

                // Remove requests older than 1 minute
                _requests[clientIp] = _requests[clientIp]
                    .Where(t => now - t < TimeSpan.FromMinutes(1))
                    .ToList();

                // Check rate limit (100 requests per minute)
                if (_requests[clientIp].Count >= 100)
                {
                    tooMany = true;
                    responseJson = JsonSerializer.Serialize(new
                    {
                        success = false,
                        message = "Rate limit exceeded. Please try again later."
                    });
                }
                else
                {
                    _requests[clientIp].Add(now);
                }
            }

            if (tooMany)
            {
                context.Response.StatusCode = (int)HttpStatusCode.TooManyRequests;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync(responseJson ?? string.Empty);
                return;
            }

            await _next(context);
        }
    }

    public static class RateLimitingMiddlewareExtensions
    {
        public static IApplicationBuilder UseRateLimiting(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<RateLimitingMiddleware>();
        }
    }
}

