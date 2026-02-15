/*
Purpose: Subscription Middleware - Enforce subscription limits and status
Author: AI Assistant
Date: 2026-02-11
Updated: 2026-02-14 - Task 96: Block all requests from tenants with expired subscriptions
*/
using HexaBill.Api.Modules.Subscription;
using HexaBill.Api.Shared.Extensions;
using HexaBill.Api.Shared.Services;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Shared.Middleware
{
    /// <summary>
    /// Middleware that blocks requests from tenants whose subscription has expired.
    /// Skips checks for: login/auth endpoints, super admin requests, and public endpoints.
    /// If no subscription exists or it's active, allows the request through.
    /// </summary>
    public class SubscriptionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<SubscriptionMiddleware> _logger;

        public SubscriptionMiddleware(RequestDelegate next, ILogger<SubscriptionMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(
            HttpContext context, 
            ISubscriptionService subscriptionService, 
            ITenantContextService tenantContextService,
            AppDbContext dbContext)
        {
            var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";

            // Skip for public endpoints (auth, health, swagger, root)
            if (IsPublicEndpoint(path))
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

            // Skip subscription check for SystemAdmin
            if (tenantContextService.IsSystemAdmin())
            {
                await _next(context);
                return;
            }

            var tenantId = tenantContextService.GetCurrentTenantId();
            if (tenantId == null || tenantId == 0)
            {
                await _next(context);
                return;
            }

            // Allow access to subscription/onboarding endpoints even if expired
            if (IsSubscriptionManagementEndpoint(path))
            {
                await _next(context);
                return;
            }

            // Check subscription status
            var subscription = await dbContext.Subscriptions
                .Where(s => s.TenantId == tenantId.Value)
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync();

            // If no subscription exists, allow the request through (as per requirement)
            if (subscription == null)
            {
                _logger.LogDebug("Tenant {TenantId} has no subscription - allowing request", tenantId.Value);
                await _next(context);
                return;
            }

            // Check if subscription is expired or inactive
            bool isExpired = false;
            string? reason = null;

            // Check subscription status
            if (subscription.Status == SubscriptionStatus.Expired || 
                subscription.Status == SubscriptionStatus.Cancelled || 
                subscription.Status == SubscriptionStatus.Suspended)
            {
                isExpired = true;
                reason = $"Subscription status is {subscription.Status}";
            }
            // Check if trial expired
            else if (subscription.Status == SubscriptionStatus.Trial && subscription.TrialEndDate.HasValue)
            {
                if (DateTime.UtcNow > subscription.TrialEndDate.Value)
                {
                    isExpired = true;
                    reason = "Trial period has expired";
                }
            }
            // Check if subscription expired (ExpiresAt date)
            else if (subscription.ExpiresAt.HasValue && DateTime.UtcNow > subscription.ExpiresAt.Value)
            {
                isExpired = true;
                reason = "Subscription expiration date has passed";
            }
            // Check if subscription is PastDue
            else if (subscription.Status == SubscriptionStatus.PastDue)
            {
                isExpired = true;
                reason = "Subscription payment is past due";
            }

            // If subscription is expired or inactive, block ALL requests
            if (isExpired)
            {
                _logger.LogWarning(
                    "Blocking request for tenant {TenantId} - Subscription expired. Reason: {Reason}. Path: {Path}",
                    tenantId.Value, reason, path);

                context.Response.StatusCode = 402; // Payment Required
                await context.Response.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Your subscription has expired. Please renew to continue.",
                    code = "SUBSCRIPTION_EXPIRED",
                    redirectTo = "/subscription"
                });
                return;
            }

            // Subscription is active or in trial - allow request
            await _next(context);
        }

        /// <summary>
        /// Check if the endpoint is a public endpoint that should skip subscription checks
        /// </summary>
        private bool IsPublicEndpoint(string path)
        {
            return path.StartsWith("/api/auth") ||
                   path.StartsWith("/health") ||
                   path == "/" ||
                   path.StartsWith("/swagger") ||
                   path.StartsWith("/api/cors-check");
        }

        /// <summary>
        /// Check if the endpoint is a subscription management endpoint that should be accessible even if expired
        /// </summary>
        private bool IsSubscriptionManagementEndpoint(string path)
        {
            return path.Contains("/subscription") ||
                   path.Contains("/onboarding") ||
                   path.StartsWith("/api/subscription") ||
                   path.StartsWith("/api/auth/logout") ||
                   path.StartsWith("/api/auth/validate");
        }
    }

    public static class SubscriptionMiddlewareExtensions
    {
        public static IApplicationBuilder UseSubscriptionMiddleware(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<SubscriptionMiddleware>();
        }
    }
}
