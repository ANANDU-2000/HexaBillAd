using HexaBill.Api.Core.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public sealed class CorrelationIdResponseHeaderTests
{
    [Fact]
    public async Task RequestLoggingMiddleware_ExposesServerCorrelationIdOnResponse()
    {
        var context = new DefaultHttpContext();
        context.Request.Method = "GET";
        context.Request.Path = "/api/Reports/vat-return";
        var middleware = new RequestLoggingMiddleware(
            next: http => http.Response.WriteAsync("ok"),
            NullLogger<RequestLoggingMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        var correlationId = context.Response.Headers["X-Correlation-ID"].ToString();
        Assert.Matches("^[0-9a-f]{12}$", correlationId);
    }
}
