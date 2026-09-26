using HexaBill.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace HexaBill.Tests;

public class UpstreamApiGuardTests
{
    private const string EdgeSecret = "test-edge-secret";

    private static HostingOptions HostingConfig => new()
    {
        BaseDomain = "hexabill.company",
        PlatformHost = "admin.hexabill.company",
        ApiHost = "api.hexabill.company",
        EdgeProxySecret = EdgeSecret,
    };

    [Fact]
    public async Task ValidEdgeSecret_OnUpstream_AllowsApi()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(() => nextCalled = true);
        var context = CreateContext("hexabill.onrender.com", "/api/sales", withEdge: true, originalHost: "tenanta.hexabill.company");

        await middleware.InvokeAsync(context);

        Assert.True(nextCalled);
        Assert.Equal(200, context.Response.StatusCode);
    }

    [Fact]
    public async Task MissingEdgeSecret_OnUpstream_BlocksApi()
    {
        var middleware = CreateMiddleware(() => { });
        var context = CreateContext("hexabill.onrender.com", "/api/sales", withEdge: false);

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }

    [Fact]
    public async Task WrongEdgeSecret_OnUpstream_BlocksApi()
    {
        var middleware = CreateMiddleware(() => { });
        var context = CreateContext("hexabill.onrender.com", "/api/sales", withEdge: true, originalHost: "tenanta.hexabill.company", secret: "wrong");

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }

    [Fact]
    public async Task SpoofedOriginalHost_WithoutValidSecret_BlocksApi()
    {
        var middleware = CreateMiddleware(() => { });
        var context = CreateContext("hexabill.onrender.com", "/api/sales", withEdge: false);
        context.Request.Headers[RequestHostAuthority.OriginalHostHeader] = "tenanta.hexabill.company";

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }

    [Fact]
    public async Task SpoofedForwardedHost_DoesNotBypassGuard()
    {
        var middleware = CreateMiddleware(() => { });
        var context = CreateContext("hexabill.onrender.com", "/api/sales", withEdge: false);
        context.Request.Headers["X-Forwarded-Host"] = "admin.hexabill.company";

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }

    [Fact]
    public async Task Health_OnUpstream_AllowedWithoutEdge()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(() => nextCalled = true);
        var context = CreateContext("hexabill.onrender.com", "/health", withEdge: false);

        await middleware.InvokeAsync(context);

        Assert.True(nextCalled);
    }

    [Fact]
    public async Task DirectTenantHost_AllowedWithoutEdge()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(() => nextCalled = true);
        var context = CreateContext("tenanta.hexabill.company", "/api/sales", withEdge: false);

        await middleware.InvokeAsync(context);

        Assert.True(nextCalled);
    }

    [Fact]
    public void HasValidEdgeProxy_RejectsOriginSpoofingAlone()
    {
        var context = new DefaultHttpContext();
        context.Request.Host = new HostString("hexabill.onrender.com");
        context.Request.Headers.Origin = "https://admin.hexabill.company";

        Assert.False(RequestHostAuthority.HasValidEdgeProxy(context, HostingConfig));
    }

    private static UpstreamApiGuardMiddleware CreateMiddleware(Action onNext) =>
        new(_ =>
        {
            onNext();
            return Task.CompletedTask;
        }, Microsoft.Extensions.Options.Options.Create(HostingConfig), NullLogger<UpstreamApiGuardMiddleware>.Instance);

    private static HttpContext CreateContext(
        string host,
        string path,
        bool withEdge,
        string? originalHost = null,
        string? secret = null)
    {
        var context = new DefaultHttpContext();
        context.Request.Host = new HostString(host);
        context.Request.Path = path;
        if (withEdge)
        {
            context.Request.Headers[RequestHostAuthority.OriginalHostHeader] = originalHost ?? "tenanta.hexabill.company";
            context.Request.Headers[RequestHostAuthority.EdgeSecretHeader] = secret ?? EdgeSecret;
        }
        return context;
    }
}
