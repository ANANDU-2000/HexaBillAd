using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using HexaBill.Api.Core.Infrastructure;

namespace HexaBill.Tests;

// UIX-003: a missing or invalid auth claim is an authentication failure (401), not a server fault (500 GENERAL_ERROR).
public class AuthErrorClassificationTests
{
    private static async Task<(int status, string? errorCode)> InvokeWithThrownAsync(Exception thrown)
    {
        var middleware = new PostgreSqlErrorMonitoringMiddleware(
            _ => throw thrown,
            NullLogger<PostgreSqlErrorMonitoringMiddleware>.Instance);

        var context = new DefaultHttpContext();
        context.Request.Method = "GET";
        context.Request.Path = "/api/storage/tenants/1/logos/logo.png";
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        context.Response.Body.Position = 0;
        using var doc = await JsonDocument.ParseAsync(context.Response.Body);
        var code = doc.RootElement.TryGetProperty("errorCode", out var el) ? el.GetString() : null;
        return (context.Response.StatusCode, code);
    }

    [Fact(DisplayName = "UIX003_UnauthorizedAccess_Returns401_NotServerError")]
    public async Task UnauthorizedAccess_Returns401()
    {
        var (status, _) = await InvokeWithThrownAsync(
            new UnauthorizedAccessException("SECURITY: tenant_id claim missing from token"));

        Assert.Equal(401, status);
    }

    [Fact(DisplayName = "UIX003_UnauthorizedAccess_IsClassifiedAsAuth_NotGeneralError")]
    public async Task UnauthorizedAccess_IsNotGeneralError()
    {
        var (_, code) = await InvokeWithThrownAsync(
            new UnauthorizedAccessException("SECURITY: tenant_id claim missing from token"));

        Assert.Equal("AUTH_UNAUTHORIZED", code);
    }

    [Fact(DisplayName = "UIX003_OtherExceptions_StillReturn500")]
    public async Task OtherExceptions_StillReturn500()
    {
        var (status, code) = await InvokeWithThrownAsync(new InvalidOperationException("boom"));

        Assert.Equal(500, status);
        Assert.Equal("INVALID_OPERATION", code);
    }
}
