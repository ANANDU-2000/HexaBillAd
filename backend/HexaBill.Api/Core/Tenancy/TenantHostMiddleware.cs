namespace HexaBill.Api.Core.Tenancy;

using HexaBill.Api.Models;
using HexaBill.Api.Data;
using Microsoft.Extensions.Options;

public sealed class TenantHostMiddleware
{
    public const string ResolutionItemKey = "TenantHostResolution";
    private readonly RequestDelegate _next;
    private readonly HostingOptions _options;
    private readonly ILogger<TenantHostMiddleware> _logger;

    public TenantHostMiddleware(RequestDelegate next, IOptions<HostingOptions> options, ILogger<TenantHostMiddleware> logger)
    {
        _next = next;
        _options = options.Value;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, ITenantHostResolver resolver)
    {
        if (context.Request.Headers.ContainsKey("X-Tenant-Id") || context.Request.Headers.ContainsKey("X-Tenant"))
        {
            _logger.LogWarning("Rejected client-supplied tenant header on {Path}", context.Request.Path);
            if (!string.Equals(_options.EnforcementMode, "Off", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { error = "TENANT_HEADER_FORBIDDEN" }, context.RequestAborted);
                return;
            }
        }

        var resolution = await resolver.ResolveAsync(context, context.RequestAborted);
        context.Items[ResolutionItemKey] = resolution;

        // Establish the database query scope from the verified host before the
        // authentication service queries Users. Client headers are never used.
        var dbContext = context.RequestServices.GetRequiredService<AppDbContext>();
        if (resolution.Kind == TenantHostKind.Platform)
            dbContext.SetRequestTenantScope(null, isPlatformScope: true);
        else if (resolution.Kind == TenantHostKind.Tenant && resolution.TenantId.HasValue)
            dbContext.SetRequestTenantScope(resolution.TenantId.Value, isPlatformScope: false);
        else
            dbContext.SetRequestTenantScope(null, isPlatformScope: false);

        if (resolution.HeaderMismatch)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new { error = "TENANT_HOST_MISMATCH" }, context.RequestAborted);
            return;
        }

        if (context.User.Identity?.IsAuthenticated == true)
        {
            var isPlatformToken = string.Equals(context.User.FindFirst("plat")?.Value, "true", StringComparison.OrdinalIgnoreCase);
            var tidClaim = context.User.FindFirst("tid")?.Value
                ?? context.User.FindFirst("tenant_id")?.Value
                ?? context.User.Claims.FirstOrDefault(c => c.Type.EndsWith("/tenantid", StringComparison.OrdinalIgnoreCase))?.Value;
            var hasMatchingTenant = resolution.Kind == TenantHostKind.Tenant
                && int.TryParse(tidClaim, out var tokenTenantId)
                && tokenTenantId == resolution.TenantId;
            var validHost = resolution.Kind == TenantHostKind.Platform
                ? isPlatformToken
                : resolution.Kind == TenantHostKind.Tenant && !isPlatformToken && hasMatchingTenant;

            var hardInvalidHost = resolution.Kind is TenantHostKind.Unknown or TenantHostKind.Marketing;
            if (!validHost && (hardInvalidHost || !string.Equals(_options.EnforcementMode, "Off", StringComparison.OrdinalIgnoreCase)))
            {
                _logger.LogWarning("Tenant host mismatch for user {UserId}: host kind {HostKind}, host tenant {HostTenantId}, token tenant {TokenTenantId}, mode {Mode}",
                    context.User.FindFirst("sub")?.Value, resolution.Kind, resolution.TenantId, tidClaim, _options.EnforcementMode);
                if (string.Equals(_options.EnforcementMode, "Enforce", StringComparison.OrdinalIgnoreCase))
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    await context.Response.WriteAsJsonAsync(new { error = "TENANT_HOST_MISMATCH" }, context.RequestAborted);
                    return;
                }
            }
        }

        await _next(context);
    }
}
