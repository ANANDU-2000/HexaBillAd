using System.Security.Claims;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace HexaBill.Tests;

/// <summary>
/// Cross-tenant isolation matrix: each tenant may only access its own data.
/// </summary>
public class TenantIsolationTests
{
    private const int TenantAId = 1;
    private const int TenantBId = 2;

    [Theory]
    [InlineData(nameof(TenantEntityAccess.CustomerBelongsToTenantAsync), 1)]
    [InlineData(nameof(TenantEntityAccess.ProductBelongsToTenantAsync), 1)]
    [InlineData(nameof(TenantEntityAccess.SaleBelongsToTenantAsync), 1)]
    [InlineData(nameof(TenantEntityAccess.PurchaseBelongsToTenantAsync), 1)]
    [InlineData(nameof(TenantEntityAccess.PaymentBelongsToTenantAsync), 1)]
    [InlineData(nameof(TenantEntityAccess.PaymentReceiptBelongsToTenantAsync), 1)]
    [InlineData(nameof(TenantEntityAccess.QuotationBelongsToTenantAsync), 1)]
    public async Task TenantA_CanAccessOwnEntity(string method, int entityId)
    {
        await using var db = await CreateIsolationDbAsync();
        Assert.True(await InvokeBelongsCheck(db, method, entityId, TenantAId));
    }

    [Theory]
    [InlineData(nameof(TenantEntityAccess.CustomerBelongsToTenantAsync), 1)]
    [InlineData(nameof(TenantEntityAccess.ProductBelongsToTenantAsync), 1)]
    [InlineData(nameof(TenantEntityAccess.SaleBelongsToTenantAsync), 1)]
    [InlineData(nameof(TenantEntityAccess.PurchaseBelongsToTenantAsync), 1)]
    [InlineData(nameof(TenantEntityAccess.PaymentBelongsToTenantAsync), 1)]
    [InlineData(nameof(TenantEntityAccess.PaymentReceiptBelongsToTenantAsync), 1)]
    [InlineData(nameof(TenantEntityAccess.QuotationBelongsToTenantAsync), 1)]
    public async Task TenantA_CannotAccessTenantBEntity(string method, int entityId)
    {
        await using var db = await CreateIsolationDbAsync();
        Assert.False(await InvokeBelongsCheck(db, method, entityId, TenantBId));
    }

    [Fact]
    public async Task TenantA_CanAccessOwnStaffUser()
    {
        await using var db = await CreateIsolationDbAsync();
        Assert.True(await TenantEntityAccess.UserBelongsToTenantAsync(db, 10, TenantAId));
    }

    [Fact]
    public async Task TenantA_CannotAccessTenantBStaffUser()
    {
        await using var db = await CreateIsolationDbAsync();
        Assert.False(await TenantEntityAccess.UserBelongsToTenantAsync(db, 20, TenantAId));
    }

    [Fact]
    public async Task TenantA_CannotAccessTenantBBackup()
    {
        const string backup = "HexaBill_Backup_Tenant2_20260810_120000.zip";
        Assert.False(BackupTenantAccess.CanAccess(backup, TenantAId, isPlatformAdmin: false));
    }

    [Fact]
    public void TenantA_CannotAccessTenantBLegacyUpload()
    {
        var context = new DefaultHttpContext();
        context.Request.Path = "/uploads/2/logo.png";
        context.Request.Headers.Authorization = $"Bearer {TestJwtFactory.CreateTenantToken(TenantAId)}";
        Assert.False(LegacyUploadsAccess.CanAccess(context, TestJwtFactory.CreateConfig()));
    }

    [Fact]
    public async Task TenantHostMiddleware_RejectsTenantIdInUrlBodySpoofViaHeader()
    {
        var (middleware, context, resolver) = await CreateHostMiddlewareAsync("tenanta.hexabill.company", TenantUser(TenantAId), "Enforce");
        context.Request.Headers["X-Tenant-Id"] = TenantBId.ToString();
        await middleware.InvokeAsync(context, resolver);
        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }

    [Fact]
    public async Task TenantHostMiddleware_RejectsOriginSpoof()
    {
        await using var db = await CreateTenantDbAsync("tenanta", TenantAId);
        var resolver = new TenantHostResolver(db, new MemoryCache(new MemoryCacheOptions()), HostingOptions(), NullLogger<TenantHostResolver>.Instance);
        var context = new DefaultHttpContext();
        context.Request.Host = new HostString("tenanta.hexabill.company");
        context.Request.Headers.Origin = "https://tenantb.hexabill.company";
        var resolution = await resolver.ResolveAsync(context);
        Assert.Equal(TenantAId, resolution.TenantId);
    }

    [Fact]
    public async Task TenantHostMiddleware_RejectsRefererSpoofForWrongHostJwt()
    {
        var (middleware, context, resolver) = await CreateHostMiddlewareAsync("tenantb.hexabill.company", TenantUser(TenantAId, "tenanta"), "Enforce");
        context.Request.Headers.Referer = "https://tenanta.hexabill.company/sales";
        await middleware.InvokeAsync(context, resolver);
        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }

    [Fact]
    public async Task TenantHostResolver_IgnoresForwardedHostOnDirectTenantRequest()
    {
        await using var db = await CreateTenantDbAsync("tenanta", TenantAId);
        var resolver = new TenantHostResolver(db, new MemoryCache(new MemoryCacheOptions()), HostingOptions(), NullLogger<TenantHostResolver>.Instance);
        var context = new DefaultHttpContext();
        context.Request.Host = new HostString("tenanta.hexabill.company");
        context.Request.Headers["X-Forwarded-Host"] = "tenantb.hexabill.company";
        var resolution = await resolver.ResolveAsync(context);
        Assert.Equal(TenantAId, resolution.TenantId);
        Assert.Equal("tenanta", resolution.Slug);
    }

    [Fact]
    public void EdgeHeadersWithoutSecret_DoNotGrantTenantScope()
    {
        var context = new DefaultHttpContext();
        context.Request.Host = new HostString("hexabill.onrender.com");
        context.Request.Headers[RequestHostAuthority.OriginalHostHeader] = "tenanta.hexabill.company";
        Assert.False(RequestHostAuthority.HasValidEdgeProxy(context, HostingOptions(edgeSecret: "prod-secret").Value));
    }

    [Fact]
    public void TenantJwt_CannotObtainPlatformScope()
    {
        var tenant = TenantUser(TenantAId);
        Assert.False(TenantIdExtensions.IsSystemAdmin(tenant));
        Assert.False(tenant.IsPlatformScope(TenantHostResolution.Platform()));
    }

    private static async Task<bool> InvokeBelongsCheck(AppDbContext db, string method, int entityId, int tenantId)
    {
        return method switch
        {
            nameof(TenantEntityAccess.CustomerBelongsToTenantAsync) => await TenantEntityAccess.CustomerBelongsToTenantAsync(db, entityId, tenantId),
            nameof(TenantEntityAccess.ProductBelongsToTenantAsync) => await TenantEntityAccess.ProductBelongsToTenantAsync(db, entityId, tenantId),
            nameof(TenantEntityAccess.SaleBelongsToTenantAsync) => await TenantEntityAccess.SaleBelongsToTenantAsync(db, entityId, tenantId),
            nameof(TenantEntityAccess.PurchaseBelongsToTenantAsync) => await TenantEntityAccess.PurchaseBelongsToTenantAsync(db, entityId, tenantId),
            nameof(TenantEntityAccess.PaymentBelongsToTenantAsync) => await TenantEntityAccess.PaymentBelongsToTenantAsync(db, entityId, tenantId),
            nameof(TenantEntityAccess.PaymentReceiptBelongsToTenantAsync) => await TenantEntityAccess.PaymentReceiptBelongsToTenantAsync(db, entityId, tenantId),
            nameof(TenantEntityAccess.QuotationBelongsToTenantAsync) => await TenantEntityAccess.QuotationBelongsToTenantAsync(db, entityId, tenantId),
            nameof(TenantEntityAccess.UserBelongsToTenantAsync) => await TenantEntityAccess.UserBelongsToTenantAsync(db, entityId, tenantId),
            _ => throw new ArgumentOutOfRangeException(nameof(method), method, null)
        };
    }

    private static async Task<AppDbContext> CreateIsolationDbAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("TenantIso_" + Guid.NewGuid())
            .Options;
        var db = new AppDbContext(options);
        db.SetRequestTenantScope(null, isPlatformScope: true);
        await db.Database.EnsureCreatedAsync();

        db.Tenants.AddRange(
            new Tenant { Id = TenantAId, Name = "Tenant A", Subdomain = "tenanta", Country = "AE", Currency = "AED", Status = TenantStatus.Active, CreatedAt = DateTime.UtcNow },
            new Tenant { Id = TenantBId, Name = "Tenant B", Subdomain = "tenantb", Country = "AE", Currency = "AED", Status = TenantStatus.Active, CreatedAt = DateTime.UtcNow });

        db.Customers.AddRange(
            new Customer { Id = 1, TenantId = TenantAId, OwnerId = TenantAId, Name = "A Customer" },
            new Customer { Id = 2, TenantId = TenantBId, OwnerId = TenantBId, Name = "B Customer" });
        db.Products.AddRange(
            new Product { Id = 1, TenantId = TenantAId, OwnerId = TenantAId, NameEn = "A Product", Sku = "A-1", UnitType = "PIECE", CostPrice = 1, SellPrice = 2 },
            new Product { Id = 2, TenantId = TenantBId, OwnerId = TenantBId, NameEn = "B Product", Sku = "B-1", UnitType = "PIECE", CostPrice = 1, SellPrice = 2 });
        db.Sales.Add(new Sale { Id = 1, TenantId = TenantAId, OwnerId = TenantAId, InvoiceNo = "A-1", InvoiceDate = DateTime.UtcNow, GrandTotal = 10, TotalAmount = 10, CreatedBy = 1, CreatedAt = DateTime.UtcNow });
        db.Sales.Add(new Sale { Id = 2, TenantId = TenantBId, OwnerId = TenantBId, InvoiceNo = "B-1", InvoiceDate = DateTime.UtcNow, GrandTotal = 10, TotalAmount = 10, CreatedBy = 2, CreatedAt = DateTime.UtcNow });
        db.Purchases.AddRange(
            new Purchase { Id = 1, TenantId = TenantAId, OwnerId = TenantAId, SupplierName = "Sup A", InvoiceNo = "PA-1", PurchaseDate = DateTime.UtcNow, TotalAmount = 5, CreatedBy = 1, CreatedAt = DateTime.UtcNow },
            new Purchase { Id = 2, TenantId = TenantBId, OwnerId = TenantBId, SupplierName = "Sup B", InvoiceNo = "PB-1", PurchaseDate = DateTime.UtcNow, TotalAmount = 5, CreatedBy = 2, CreatedAt = DateTime.UtcNow });
        db.Payments.AddRange(
            new Payment { Id = 1, TenantId = TenantAId, OwnerId = TenantAId, Amount = 10, PaymentDate = DateTime.UtcNow, CreatedAt = DateTime.UtcNow, CreatedBy = 1 },
            new Payment { Id = 2, TenantId = TenantBId, OwnerId = TenantBId, Amount = 10, PaymentDate = DateTime.UtcNow, CreatedAt = DateTime.UtcNow, CreatedBy = 2 });
        db.PaymentReceipts.AddRange(
            new PaymentReceipt { Id = 1, TenantId = TenantAId, PaymentId = 1, ReceiptNumber = "RA-1", GeneratedAt = DateTime.UtcNow, GeneratedByUserId = 10 },
            new PaymentReceipt { Id = 2, TenantId = TenantBId, PaymentId = 2, ReceiptNumber = "RB-1", GeneratedAt = DateTime.UtcNow, GeneratedByUserId = 20 });
        db.Quotations.AddRange(
            new Quotation { Id = 1, TenantId = TenantAId, OwnerId = TenantAId, QuoteNo = "QA-1", QuoteDate = DateTime.UtcNow, GrandTotal = 10, CreatedBy = 1, CreatedAt = DateTime.UtcNow },
            new Quotation { Id = 2, TenantId = TenantBId, OwnerId = TenantBId, QuoteNo = "QB-1", QuoteDate = DateTime.UtcNow, GrandTotal = 10, CreatedBy = 2, CreatedAt = DateTime.UtcNow });
        db.Users.AddRange(
            new User { Id = 10, TenantId = TenantAId, OwnerId = TenantAId, Name = "A Admin", Email = "a@test.com", PasswordHash = "x", Role = UserRole.Owner },
            new User { Id = 20, TenantId = TenantBId, OwnerId = TenantBId, Name = "B Admin", Email = "b@test.com", PasswordHash = "x", Role = UserRole.Owner });

        await db.SaveChangesAsync();
        return db;
    }

    private static ClaimsPrincipal TenantUser(int tenantId, string slug = "tenanta") =>
        new(new ClaimsIdentity(new[]
        {
            new Claim("tid", tenantId.ToString()),
            new Claim("tslug", slug),
            new Claim(ClaimTypes.NameIdentifier, "10"),
        }, "Test"));

    private static IOptions<HostingOptions> HostingOptions(string? edgeSecret = null) =>
        Options.Create(new HostingOptions
        {
            BaseDomain = "hexabill.company",
            PlatformHost = "admin.hexabill.company",
            ApiHost = "api.hexabill.company",
            EnforcementMode = "Enforce",
            EdgeProxySecret = edgeSecret ?? "prod-secret"
        });

    private static async Task<AppDbContext> CreateTenantDbAsync(string slug, int id)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("TenantHostIso_" + Guid.NewGuid())
            .Options;
        var db = new AppDbContext(options);
        db.SetRequestTenantScope(null, isPlatformScope: true);
        await db.Database.EnsureCreatedAsync();
        db.Tenants.Add(new Tenant { Id = id, Name = slug, Subdomain = slug, Country = "AE", Currency = "AED", Status = TenantStatus.Active, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        return db;
    }

    private static async Task<(TenantHostMiddleware middleware, HttpContext context, ITenantHostResolver resolver)> CreateHostMiddlewareAsync(
        string host,
        ClaimsPrincipal user,
        string enforcementMode,
        Action? onNext = null)
    {
        var dbOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("HostMwIso_" + Guid.NewGuid())
            .Options;
        var db = new AppDbContext(dbOptions);
        await db.Database.EnsureCreatedAsync();

        var services = new ServiceCollection();
        services.AddSingleton(db);
        var provider = services.BuildServiceProvider();

        var context = new DefaultHttpContext { RequestServices = provider, User = user };
        context.Request.Host = new HostString(host);

        var slug = host.Split('.')[0];
        var tenantId = slug == "tenanta" ? TenantAId : TenantBId;
        var resolution = host.Contains("admin.")
            ? TenantHostResolution.Platform()
            : new TenantHostResolution(TenantHostKind.Tenant, slug, tenantId, TenantStatus.Active);

        var resolver = new StubResolver(resolution);
        var middleware = new TenantHostMiddleware(
            _ => { onNext?.Invoke(); return Task.CompletedTask; },
            Options.Create(new HostingOptions { EnforcementMode = enforcementMode }),
            NullLogger<TenantHostMiddleware>.Instance);

        return (middleware, context, resolver);
    }

    private sealed class StubResolver(TenantHostResolution resolution) : ITenantHostResolver
    {
        public Task<TenantHostResolution> ResolveAsync(HttpContext context, CancellationToken cancellationToken = default) => Task.FromResult(resolution);
        public void Invalidate(string? slug) { }
    }
}

internal static class TestJwtFactory
{
    private const string Secret = "YourSuperSecretKeyThatIsAtLeast32CharactersLong!";

    public static Microsoft.Extensions.Configuration.IConfiguration CreateConfig()
    {
        var data = new Dictionary<string, string?>
        {
            ["JwtSettings:SecretKey"] = Secret,
            ["JwtSettings:Issuer"] = "HexaBill.Api",
            ["JwtSettings:Audience"] = "HexaBill.Api",
        };
        return new Microsoft.Extensions.Configuration.ConfigurationBuilder()
            .AddInMemoryCollection(data!)
            .Build();
    }

    public static string CreateTenantToken(int tenantId)
    {
        var key = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(Secret));
        var creds = new Microsoft.IdentityModel.Tokens.SigningCredentials(key, Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256);
        var token = new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(
            issuer: "HexaBill.Api",
            audience: "HexaBill.Api",
            claims: new[] { new Claim("tid", tenantId.ToString()) },
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds);
        return new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().WriteToken(token);
    }
}
