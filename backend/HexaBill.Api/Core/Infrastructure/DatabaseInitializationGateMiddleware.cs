using System.Text.Json;

namespace HexaBill.Api.Core.Infrastructure;

/// <summary>Prevents application traffic from reaching routes before required schema initialization succeeds.</summary>
public sealed class DatabaseInitializationGateMiddleware
{
    private readonly RequestDelegate _next;

    public DatabaseInitializationGateMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, DatabaseInitializationStatus initializationStatus)
    {
        var path = context.Request.Path;
        if (HttpMethods.IsOptions(context.Request.Method)
            || path.Equals("/health", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/health/ready", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        if (initializationStatus.State == DatabaseInitializationState.Ready)
        {
            await _next(context);
            return;
        }

        context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        context.Response.Headers.CacheControl = "no-store";
        context.Response.ContentType = "application/json";
        var schemaState = initializationStatus.State == DatabaseInitializationState.Failed
            ? "InitializationFailed"
            : "InitializationPending";
        await JsonSerializer.SerializeAsync(context.Response.Body, new
        {
            status = "Unavailable",
            schema = schemaState,
            timestamp = DateTime.UtcNow
        });
    }
}
