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

public class TenantSecurityTests
{
    private static ClaimsPrincipal TenantUser(int tenantId, string slug = "tenanta") =>
        new(new ClaimsIdentity(new[]
        {
            new Claim("tid", tenantId.ToString()),
            new Claim("tslug", slug),
            new Claim(ClaimTypes.NameIdentifier, "10"),
        }, "Test"));

    private static ClaimsPrincipal PlatformUser() =>
        new(new ClaimsIdentity(new[]
        {
            new Claim("plat", "true"),
            new Claim(ClaimTypes.Role, "SystemAdmin"),
            new Claim(ClaimTypes.NameIdentifier, "1"),
        }, "Test"));

    [Fact]
    public void IsSystemAdmin_RequiresPlatClaim_NotZeroTid()
    {
        var zeroTidOnly = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("tid", "0") }, "Test"));
        Assert.False(TenantIdExtensions.IsSystemAdmin(zeroTidOnly));
        Assert.True(TenantIdExtensions.IsSystemAdmin(PlatformUser()));
    }

    [Fact]
    public void IsPlatformScope_RequiresPlatformHostAndPlatClaim()
    {
        var platformHost = TenantHostResolution.Platform();
        var tenantHost = new TenantHostResolution(TenantHostKind.Tenant, "tenanta", 1, TenantStatus.Active);

        Assert.True(PlatformUser().IsPlatformScope(platformHost));
        Assert.False(TenantUser(1).IsPlatformScope(platformHost));
        Assert.False(PlatformUser().IsPlatformScope(tenantHost));
    }

    [Fact]
    public void BackupTenantAccess_TenantCannotAccessOtherTenantBackup()
    {
        const string tenantBBackup = "HexaBill_Backup_Tenant2_20260810_120000.zip";
        Assert.False(BackupTenantAccess.CanAccess(tenantBBackup, 1, isPlatformAdmin: false));
        Assert.True(BackupTenantAccess.CanAccess(tenantBBackup, 2, isPlatformAdmin: false));
    }

    [Fact]
    public void BackupTenantAccess_TidZeroWithoutPlatformDenied()
    {
        const string backup = "HexaBill_Backup_Tenant2_20260810_120000.zip";
        Assert.False(BackupTenantAccess.CanAccess(backup, 0, isPlatformAdmin: false));
        Assert.False(BackupTenantAccess.CanAccess(backup, null, isPlatformAdmin: false));
        Assert.True(BackupTenantAccess.CanAccess(backup, null, isPlatformAdmin: true));
    }

    [Fact]
    public async Task TenantHostResolver_IgnoresOriginHeader()
    {
        var options = CreateResolverOptions();
        await using var db = await CreateTenantDbAsync("tenanta", 1);
        var resolver = new TenantHostResolver(db, new MemoryCache(new MemoryCacheOptions()), options, NullLogger<TenantHostResolver>.Instance);

        var context = new DefaultHttpContext();
        context.Request.Host = new HostString("api.hexabill.company");
        context.Request.Headers.Origin = "https://tenanta.hexabill.company";

        var resolution = await resolver.ResolveAsync(context);
        Assert.Equal(TenantHostKind.Unknown, resolution.Kind);
        Assert.Null(resolution.TenantId);
    }

    [Fact]
    public async Task TenantHostResolver_ResolvesTenantFromHostOnly()
    {
        var options = CreateResolverOptions();
        await using var db = await CreateTenantDbAsync("tenanta", 1);
        var resolver = new TenantHostResolver(db, new MemoryCache(new MemoryCacheOptions()), options, NullLogger<TenantHostResolver>.Instance);

        var context = new DefaultHttpContext();
        context.Request.Host = new HostString("tenanta.hexabill.company");

        var resolution = await resolver.ResolveAsync(context);
        Assert.Equal(TenantHostKind.Tenant, resolution.Kind);
        Assert.Equal(1, resolution.TenantId);
        Assert.Equal("tenanta", resolution.Slug);
    }

    [Fact]
    public async Task TenantHostMiddleware_RejectsXTenantIdHeader()
    {
        var (middleware, context) = await CreateHostMiddlewareAsync("tenanta.hexabill.company", TenantUser(1), "Enforce");
        context.Request.Headers["X-Tenant-Id"] = "2";

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }

    [Fact]
    public async Task TenantHostMiddleware_RejectsTenantJwtOnWrongHost()
    {
        var (middleware, context) = await CreateHostMiddlewareAsync("tenantb.hexabill.company", TenantUser(1, "tenanta"), "Enforce");

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }

    [Fact]
    public async Task TenantHostMiddleware_RejectsPlatformJwtOnTenantHost()
    {
        var (middleware, context) = await CreateHostMiddlewareAsync("tenanta.hexabill.company", PlatformUser(), "Enforce");

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }

    [Fact]
    public async Task TenantHostMiddleware_AllowsMatchingTenantHostAndJwt()
    {
        var nextCalled = false;
        var (middleware, context) = await CreateHostMiddlewareAsync(
            "tenanta.hexabill.company",
            TenantUser(1),
            "Enforce",
            () => nextCalled = true);

        await middleware.InvokeAsync(context);

        Assert.Equal(200, context.Response.StatusCode);
        Assert.True(nextCalled);
    }

    [Fact]
    public async Task TenantChildAccess_BlocksCrossTenantSaleItems()
    {
        await using var db = await CreateSalesDbAsync();
        Assert.True(await TenantChildAccess.SaleBelongsToTenantAsync(db, 1, 1));
        Assert.False(await TenantChildAccess.SaleBelongsToTenantAsync(db, 1, 2));
        Assert.True(await TenantChildAccess.SaleItemsBelongToTenantAsync(db, new[] { 1 }, 1));
        Assert.False(await TenantChildAccess.SaleItemsBelongToTenantAsync(db, new[] { 1 }, 2));
    }

    private static IOptions<HostingOptions> CreateResolverOptions() =>
        Options.Create(new HostingOptions
        {
            BaseDomain = "hexabill.company",
            PlatformHost = "admin.hexabill.company",
            ApiHost = "api.hexabill.company",
            EnforcementMode = "Enforce"
        });

    private static async Task<AppDbContext> CreateTenantDbAsync(string slug, int id)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("TenantHost_" + Guid.NewGuid())
            .Options;
        var db = new AppDbContext(options);
        db.SetRequestTenantScope(null, isPlatformScope: true);
        await db.Database.EnsureCreatedAsync();
        db.Tenants.Add(new Tenant
        {
            Id = id,
            Name = slug,
            Subdomain = slug,
            Country = "AE",
            Currency = "AED",
            Status = TenantStatus.Active,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return db;
    }

    private static async Task<AppDbContext> CreateSalesDbAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("TenantChild_" + Guid.NewGuid())
            .Options;
        var db = new AppDbContext(options);
        db.SetRequestTenantScope(null, isPlatformScope: true);
        await db.Database.EnsureCreatedAsync();

        db.Sales.Add(new Sale
        {
            Id = 1,
            TenantId = 1,
            OwnerId = 1,
            InvoiceNo = "INV-1",
            InvoiceDate = DateTime.UtcNow,
            GrandTotal = 100,
            TotalAmount = 100,
            IsDeleted = false,
            CreatedBy = 1,
            CreatedAt = DateTime.UtcNow
        });
        db.SaleItems.Add(new SaleItem { Id = 1, SaleId = 1, ProductId = 1, Qty = 1, UnitPrice = 100, LineTotal = 100 });
        await db.SaveChangesAsync();
        return db;
    }

    private static async Task<(TenantHostMiddleware middleware, HttpContext context)> CreateHostMiddlewareAsync(
        string host,
        ClaimsPrincipal user,
        string enforcementMode,
        Action? onNext = null)
    {
        var dbOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("HostMw_" + Guid.NewGuid())
            .Options;
        var db = new AppDbContext(dbOptions);
        await db.Database.EnsureCreatedAsync();

        var services = new ServiceCollection();
        services.AddSingleton(db);
        var provider = services.BuildServiceProvider();

        var context = new DefaultHttpContext
        {
            RequestServices = provider,
            User = user
        };
        context.Request.Host = new HostString(host);

        var resolution = host.Contains("admin.")
            ? TenantHostResolution.Platform()
            : new TenantHostResolution(TenantHostKind.Tenant, host.Split('.')[0], host.StartsWith("tenanta") ? 1 : 2, TenantStatus.Active);

        var middleware = new TenantHostMiddleware(
            _ =>
            {
                onNext?.Invoke();
                return Task.CompletedTask;
            },
            new StubResolver(resolution),
            Options.Create(new HostingOptions { EnforcementMode = enforcementMode }),
            NullLogger<TenantHostMiddleware>.Instance);

        return (middleware, context);
    }

    private sealed class StubResolver(TenantHostResolution resolution) : ITenantHostResolver
    {
        public Task<TenantHostResolution> ResolveAsync(HttpContext context, CancellationToken cancellationToken = default)
            => Task.FromResult(resolution);

        public void Invalidate(string? slug) { }
    }
}
