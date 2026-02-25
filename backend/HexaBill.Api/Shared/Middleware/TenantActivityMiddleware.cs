/*
 * Records tenant API request for SuperAdmin Live Activity monitor
 */
using HexaBill.Api.Shared.Services;

namespace HexaBill.Api.Shared.Middleware
{
    public class TenantActivityMiddleware
    {
        private readonly RequestDelegate _next;

        public TenantActivityMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, ITenantActivityService activityService)
        {
            if (context.Items.TryGetValue("TenantId", out var tid) && tid is int tenantId && tenantId > 0)
            {
                activityService.RecordRequest(tenantId);
            }
            await _next(context);
        }
    }

    public static class TenantActivityMiddlewareExtensions
    {
        public static IApplicationBuilder UseTenantActivity(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<TenantActivityMiddleware>();
        }
    }
}
