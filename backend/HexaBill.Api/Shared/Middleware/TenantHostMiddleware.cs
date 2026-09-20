namespace HexaBill.Api.Shared.Middleware;

using HexaBill.Api.Shared.Hosting;

public sealed class TenantHostMiddleware
{
    public const string ResolutionItemKey = "TenantHostResolution";
    private readonly RequestDelegate _next;
    private readonly ITenantHostResolver _resolver;

    public TenantHostMiddleware(RequestDelegate next, ITenantHostResolver resolver)
    {
        _next = next;
        _resolver = resolver;
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

        await _next(context);
    }
}
