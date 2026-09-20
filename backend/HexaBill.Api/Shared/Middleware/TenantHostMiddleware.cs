namespace HexaBill.Api.Shared.Middleware;

using HexaBill.Api.Shared.Hosting;
using HexaBill.Api.Models;
using Microsoft.Extensions.Options;

public sealed class TenantHostMiddleware
{
    public const string ResolutionItemKey = "TenantHostResolution";
    private readonly RequestDelegate _next;
    private readonly ITenantHostResolver _resolver;
    private readonly HostingOptions _options;
    private readonly ILogger<TenantHostMiddleware> _logger;

    public TenantHostMiddleware(RequestDelegate next, ITenantHostResolver resolver, IOptions<HostingOptions> options, ILogger<TenantHostMiddleware> logger)
    {
        _next = next;
        _resolver = resolver;
        _options = options.Value;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var resolution = await _resolver.ResolveAsync(context, context.RequestAborted);
        context.Items[ResolutionItemKey] = resolution;

        if (resolution.HeaderMismatch)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new { error = "TENANT_HOST_MISMATCH" }, context.RequestAborted);
            return;
        }

        if (context.User.Identity?.IsAuthenticated == true)
        {
            var isPlatformToken = string.Equals(context.User.FindFirst("plat")?.Value, "true", StringComparison.OrdinalIgnoreCase);
            var tidClaim = context.User.FindFirst("tid")?.Value;
            var hasMatchingTenant = resolution.Kind == TenantHostKind.Tenant
                && int.TryParse(tidClaim, out var tokenTenantId)
                && tokenTenantId == resolution.TenantId;
            var validHost = resolution.Kind == TenantHostKind.Platform
                ? isPlatformToken
                : resolution.Kind == TenantHostKind.Tenant && !isPlatformToken && hasMatchingTenant;

            if (!validHost && !string.Equals(_options.EnforcementMode, "Off", StringComparison.OrdinalIgnoreCase))
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
