using HexaBill.Api.Models;
using Microsoft.Extensions.Options;

namespace HexaBill.Api.Core.Authorization;

/// <summary>
/// Blocks /api traffic that arrives on upstream backend hostnames (e.g. Render)
/// without a trusted Vercel edge proxy signature. Prevents hostname spoofing on
/// direct backend access.
/// </summary>
public sealed class UpstreamApiGuardMiddleware
{
    private static readonly string[] AllowedWithoutEdge =
    [
        "/health",
        "/swagger",
    ];

    private readonly RequestDelegate _next;
    private readonly HostingOptions _options;
    private readonly ILogger<UpstreamApiGuardMiddleware> _logger;

    public UpstreamApiGuardMiddleware(
        RequestDelegate next,
        IOptions<HostingOptions> options,
        ILogger<UpstreamApiGuardMiddleware> logger)
    {
        _next = next;
        _options = options.Value;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        if (!path.StartsWith("/api", StringComparison.OrdinalIgnoreCase)
            || IsAllowedWithoutEdge(path))
        {
            await _next(context);
            return;
        }

        var requestHost = RequestHostAuthority.NormalizeHost(context.Request.Host.Host) ?? string.Empty;
        if (!RequestHostAuthority.IsUpstreamBackendHost(requestHost, _options))
        {
            await _next(context);
            return;
        }

        if (RequestHostAuthority.HasValidEdgeProxy(context, _options))
        {
            await _next(context);
            return;
        }

        _logger.LogWarning(
            "Blocked direct upstream API access to {Path} from host {Host} without trusted edge proxy",
            path,
            requestHost);

        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new { error = "UPSTREAM_API_FORBIDDEN" }, context.RequestAborted);
    }

    private static bool IsAllowedWithoutEdge(string path)
    {
        foreach (var allowed in AllowedWithoutEdge)
        {
            if (path.Equals(allowed, StringComparison.OrdinalIgnoreCase)
                || path.StartsWith(allowed + "/", StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }
}

public static class UpstreamApiGuardMiddlewareExtensions
{
    public static IApplicationBuilder UseUpstreamApiGuard(this IApplicationBuilder builder)
        => builder.UseMiddleware<UpstreamApiGuardMiddleware>();
}
