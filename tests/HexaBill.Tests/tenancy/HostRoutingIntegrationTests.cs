using System.Security.Claims;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace HexaBill.Tests;

/// <summary>
/// Host-aligned routing: authority host → TenantHostResolver → middleware enforcement.
/// </summary>
public class HostRoutingIntegrationTests
{
    private const string EdgeSecret = "test-edge-secret";

    private static HostingOptions CreateOptions() => new()
    {
        BaseDomain = "hexabill.company",
        PlatformHost = "admin.hexabill.company",
        ApiHost = "api.hexabill.company",
        EnforcementMode = "Enforce",
        EdgeProxySecret = EdgeSecret,
    };

    private static ClaimsPrincipal TenantUser(int tenantId, string slug) =>
        new(new ClaimsIdentity(new[]
        {
            new Claim("tid", tenantId.ToString()),
            new Claim("tslug", slug),
        }, "Test"));

    private static ClaimsPrincipal PlatformUser() =>
        new(new ClaimsIdentity(new[]
        {
            new Claim("plat", "true"),
            new Claim(ClaimTypes.Role, "SystemAdmin"),
        }, "Test"));

    [Fact]
    public async Task TenantA_Host_With_TenantA_Jwt_Succeeds()
    {
        var nextCalled = false;
        var (middleware, context, resolver) = await CreatePipelineAsync(
            "tenanta.hexabill.company",
            TenantUser(1, "tenanta"),
            () => nextCalled = true);

        await middleware.InvokeAsync(context, resolver);

        Assert.True(nextCalled);
        Assert.Equal(200, context.Response.StatusCode);
    }

    [Fact]
    public async Task TenantA_Host_With_TenantB_Jwt_Fails()
    {
        var (middleware, context, resolver) = await CreatePipelineAsync("tenanta.hexabill.company", TenantUser(2, "tenantb"));
        await middleware.InvokeAsync(context, resolver);
        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }

    [Fact]
    public async Task TenantB_Host_With_TenantA_Jwt_Fails()
    {
        var (middleware, context, resolver) = await CreatePipelineAsync("tenantb.hexabill.company", TenantUser(1, "tenanta"));
        await middleware.InvokeAsync(context, resolver);
        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }

    [Fact]
    public async Task Admin_Host_With_Platform_Jwt_Succeeds()
    {
        var nextCalled = false;
        var (middleware, context, resolver) = await CreatePipelineAsync(
            "admin.hexabill.company",
            PlatformUser(),
            () => nextCalled = true);
        await middleware.InvokeAsync(context, resolver);
        Assert.True(nextCalled);
    }

    [Fact]
    public async Task Admin_Host_With_Tenant_Jwt_Fails()
    {
        var (middleware, context, resolver) = await CreatePipelineAsync("admin.hexabill.company", TenantUser(1, "tenanta"));
        await middleware.InvokeAsync(context, resolver);
        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }

    [Fact]
    public async Task SpoofedOrigin_DoesNotChangeTenantResolution()
    {
        await using var db = await CreateTenantDbAsync();
        var resolver = CreateResolver(db);
        var context = CreateHttpContext("hexabill.onrender.com", db);
        context.Request.Headers.Origin = "https://tenanta.hexabill.company";

        var resolution = await resolver.ResolveAsync(context);
        Assert.Equal(TenantHostKind.Unknown, resolution.Kind);
    }

    [Fact]
    public async Task SpoofedForwardedHost_WithoutEdgeSecret_DoesNotChangeTenant()
    {
        await using var db = await CreateTenantDbAsync();
        var resolver = CreateResolver(db);
        var context = CreateHttpContext("hexabill.onrender.com", db);
        context.Request.Headers["X-Forwarded-Host"] = "tenanta.hexabill.company";

        var resolution = await resolver.ResolveAsync(context);
        Assert.Equal(TenantHostKind.Unknown, resolution.Kind);
    }

    [Fact]
    public async Task SpoofedOriginalHost_WithoutEdgeSecret_DoesNotChangeTenant()
    {
        await using var db = await CreateTenantDbAsync();
        var resolver = CreateResolver(db);
        var context = CreateHttpContext("hexabill.onrender.com", db);
        context.Request.Headers[RequestHostAuthority.OriginalHostHeader] = "tenanta.hexabill.company";

        var resolution = await resolver.ResolveAsync(context);
        Assert.Equal(TenantHostKind.Unknown, resolution.Kind);
    }

    [Fact]
    public async Task TrustedEdgeProxy_PreservesTenantHost()
    {
        await using var db = await CreateTenantDbAsync();
        var resolver = CreateResolver(db);
        var context = CreateHttpContext("hexabill.onrender.com", db);
        context.Request.Headers[RequestHostAuthority.OriginalHostHeader] = "tenanta.hexabill.company";
        context.Request.Headers[RequestHostAuthority.EdgeSecretHeader] = EdgeSecret;

        var resolution = await resolver.ResolveAsync(context);
        Assert.Equal(TenantHostKind.Tenant, resolution.Kind);
        Assert.Equal(1, resolution.TenantId);
        Assert.Equal("tenanta", resolution.Slug);
    }

    [Fact]
    public async Task TrustedEdgeProxy_PreservesPlatformHost()
    {
        await using var db = await CreateTenantDbAsync();
        var resolver = CreateResolver(db);
        var context = CreateHttpContext("hexabill.onrender.com", db);
        context.Request.Headers[RequestHostAuthority.OriginalHostHeader] = "admin.hexabill.company";
        context.Request.Headers[RequestHostAuthority.EdgeSecretHeader] = EdgeSecret;

        var resolution = await resolver.ResolveAsync(context);
        Assert.Equal(TenantHostKind.Platform, resolution.Kind);
    }

    [Fact]
    public async Task Unknown_Hostname_Fails_Middleware()
    {
        var (middleware, context, resolver) = await CreatePipelineAsync("evil.example.com", TenantUser(1, "tenanta"));
        await middleware.InvokeAsync(context, resolver);
        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }

    [Fact]
    public async Task EdgeProxy_OnLocalhostBackend_UsesOriginalHost()
    {
        await using var db = await CreateTenantDbAsync();
        var resolver = CreateResolver(db);
        var context = CreateHttpContext("localhost", db);
        context.Request.Headers[RequestHostAuthority.OriginalHostHeader] = "tenanta.hexabill.company";
        context.Request.Headers[RequestHostAuthority.EdgeSecretHeader] = EdgeSecret;

        var resolution = await resolver.ResolveAsync(context);
        Assert.Equal(TenantHostKind.Tenant, resolution.Kind);
        Assert.Equal(1, resolution.TenantId);
    }

    [Fact]
    public async Task DirectTenantHost_StillWorks_WithoutEdgeHeaders()
    {
        await using var db = await CreateTenantDbAsync();
        var resolver = CreateResolver(db);
        var context = CreateHttpContext("tenanta.hexabill.company", db);

        var resolution = await resolver.ResolveAsync(context);
        Assert.Equal(TenantHostKind.Tenant, resolution.Kind);
        Assert.Equal(1, resolution.TenantId);
    }

    private static async Task<(TenantHostMiddleware middleware, HttpContext context, ITenantHostResolver resolver)> CreatePipelineAsync(
        string authorityHost,
        ClaimsPrincipal user,
        Action? onNext = null)
    {
        var db = await CreateTenantDbAsync();
        var services = new ServiceCollection();
        services.AddSingleton(db);
        var provider = services.BuildServiceProvider();

        var context = new DefaultHttpContext
        {
            RequestServices = provider,
            User = user,
        };
        context.Request.Host = new HostString(authorityHost);

        var resolver = CreateResolver(db);
        var middleware = new TenantHostMiddleware(
            _ =>
            {
                onNext?.Invoke();
                return Task.CompletedTask;
            },
            Options.Create(CreateOptions()),
            NullLogger<TenantHostMiddleware>.Instance);

        return (middleware, context, resolver);
    }

    private static TenantHostResolver CreateResolver(AppDbContext db) =>
        new(db, new MemoryCache(new MemoryCacheOptions()), Options.Create(CreateOptions()), NullLogger<TenantHostResolver>.Instance);

    private static HttpContext CreateHttpContext(string requestHost, AppDbContext db)
    {
        var services = new ServiceCollection();
        services.AddSingleton(db);
        var context = new DefaultHttpContext { RequestServices = services.BuildServiceProvider() };
        context.Request.Host = new HostString(requestHost);
        return context;
    }

    private static async Task<AppDbContext> CreateTenantDbAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("HostRouting_" + Guid.NewGuid())
            .Options;
        var db = new AppDbContext(options);
        db.SetRequestTenantScope(null, isPlatformScope: true);
        await db.Database.EnsureCreatedAsync();
        db.Tenants.AddRange(
            new Tenant { Id = 1, Name = "Tenant A", Subdomain = "tenanta", Country = "AE", Currency = "AED", Status = TenantStatus.Active, CreatedAt = DateTime.UtcNow },
            new Tenant { Id = 2, Name = "Tenant B", Subdomain = "tenantb", Country = "AE", Currency = "AED", Status = TenantStatus.Active, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        return db;
    }
}
