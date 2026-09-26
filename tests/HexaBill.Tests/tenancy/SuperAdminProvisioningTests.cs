using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Modules.Subscription;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using System.Security.Claims;

namespace HexaBill.Tests;

public class SuperAdminProvisioningTests
{
    [Theory]
    [InlineData("admin")]
    [InlineData("api")]
    [InlineData("www")]
    [InlineData("ftp")]
    [InlineData("localhost")]
    public async Task CreateTenant_RejectsReservedSlug(string slug)
    {
        await using var db = await CreateDbAsync();
        var service = CreateService(db);
        var request = new CreateTenantRequest
        {
            Name = "Reserved Test",
            Subdomain = slug,
            Email = $"{slug}@example.com",
            OwnerName = "Owner"
        };

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateTenantAsync(request, 1));
    }

    [Fact]
    public async Task CreateTenant_RejectsDuplicateSlug()
    {
        await using var db = await CreateDbAsync();
        db.Tenants.Add(new Tenant
        {
            Id = 5,
            Name = "Existing",
            Subdomain = "client-a",
            Country = "AE",
            Currency = "AED",
            Status = TenantStatus.Active,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var request = new CreateTenantRequest
        {
            Name = "New Co",
            Subdomain = "client-a",
            Email = "new@example.com",
            OwnerName = "Owner"
        };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateTenantAsync(request, 1));
        Assert.Contains("already in use", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateTenant_CreatesRecordOwnerAndInviteUrl()
    {
        await using var db = await CreateDbAsync();
        var service = CreateService(db);
        var request = new CreateTenantRequest
        {
            Name = "Hexa Test Co",
            Subdomain = "hexa-test",
            Email = "owner@hexa-test.example",
            OwnerName = "Test Owner"
        };

        var (tenant, _, inviteUrl) = await service.CreateTenantAsync(request, 1);

        Assert.True(tenant.Id > 0);
        Assert.Equal("hexa-test", tenant.Subdomain);
        Assert.Equal("https://hexa-test.hexabill.company/login", tenant.LoginUrl);
        Assert.StartsWith("https://hexa-test.hexabill.company/login?invite=", inviteUrl, StringComparison.Ordinal);

        var owner = await db.Users.SingleAsync(u => u.TenantId == tenant.Id);
        Assert.Equal(UserRole.Owner, owner.Role);
        Assert.Equal(tenant.Id, owner.OwnerId);
        Assert.True(owner.MustChangePassword);

        var invite = await db.TenantInvites.SingleAsync(i => i.TenantId == tenant.Id);
        Assert.Equal("hexa-test", invite.HostSubdomain);
    }

    [Fact]
    public void TenantName_IsNotAuthorizationIdentity()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("tid", "6"),
            new Claim("tslug", "zayoga"),
        }, "Test"));

        Assert.Equal(6, user.GetTenantIdFromToken());
        Assert.False(TenantIdExtensions.IsSystemAdmin(user));
    }

    [Fact]
    public void TenantAdmin_CannotObtainPlatformScope()
    {
        var tenantAdmin = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("tid", "6"),
            new Claim("plat", "false"),
            new Claim(ClaimTypes.Role, "Owner"),
        }, "Test"));

        Assert.False(TenantIdExtensions.IsSystemAdmin(tenantAdmin));
        Assert.False(tenantAdmin.IsPlatformScope(TenantHostResolution.Platform()));
    }

    private static SuperAdminTenantService CreateService(AppDbContext db)
    {
        var hosting = Options.Create(new HostingOptions
        {
            BaseDomain = "hexabill.company",
            PlatformHost = "admin.hexabill.company"
        });
        var resolver = new TenantHostResolver(db, new MemoryCache(new MemoryCacheOptions()), hosting, NullLogger<TenantHostResolver>.Instance);
        return new SuperAdminTenantService(db, new StubSubscriptionService(), hosting, resolver);
    }

    private static async Task<AppDbContext> CreateDbAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("SuperAdminProv_" + Guid.NewGuid())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        var db = new AppDbContext(options);
        db.SetRequestTenantScope(null, isPlatformScope: true);
        await db.Database.EnsureCreatedAsync();

        db.SubscriptionPlans.Add(new SubscriptionPlan
        {
            Id = 1,
            Name = "Basic",
            MonthlyPrice = 99,
            YearlyPrice = 990,
            Currency = "AED",
            IsActive = true,
            DisplayOrder = 1,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return db;
    }

    private sealed class StubSubscriptionService : ISubscriptionService
    {
        public Task<List<SubscriptionPlanDto>> GetPlansAsync() => Task.FromResult(new List<SubscriptionPlanDto>());
        public Task<SubscriptionPlanDto?> GetPlanByIdAsync(int planId) => Task.FromResult<SubscriptionPlanDto?>(null);
        public Task<SubscriptionDto?> GetTenantSubscriptionAsync(int tenantId) => Task.FromResult<SubscriptionDto?>(null);
        public Task<SubscriptionDto> CreateSubscriptionAsync(int tenantId, int planId, BillingCycle billingCycle, SubscriptionStatus? initialStatus = null, string? paymentGatewaySessionId = null, string? paymentMethod = null)
            => Task.FromResult(new SubscriptionDto { TenantId = tenantId, Plan = new SubscriptionPlanDto { Id = planId } });
        public Task<SubscriptionDto> UpdateSubscriptionAsync(int subscriptionId, int? planId, BillingCycle? billingCycle) => throw new NotImplementedException();
        public Task<bool> CancelSubscriptionAsync(int subscriptionId, string reason) => throw new NotImplementedException();
        public Task<bool> RenewSubscriptionAsync(int subscriptionId) => throw new NotImplementedException();
        public Task<bool> CheckSubscriptionStatusAsync(int tenantId) => Task.FromResult(true);
        public Task<bool> IsFeatureAllowedAsync(int tenantId, string feature) => Task.FromResult(true);
        public Task<SubscriptionLimitsDto> GetTenantLimitsAsync(int tenantId) => throw new NotImplementedException();
        public Task<bool> CheckLimitAsync(int tenantId, string limitType, int currentUsage) => Task.FromResult(true);
        public Task<List<SubscriptionDto>> GetExpiringSubscriptionsAsync(int daysAhead = 7) => throw new NotImplementedException();
        public Task<SubscriptionMetricsDto> GetPlatformMetricsAsync() => throw new NotImplementedException();
        public Task<PlatformRevenueReportDto> GetPlatformRevenueReportAsync() => throw new NotImplementedException();
        public Task<StripeCheckoutResult?> CreateStripeCheckoutSessionAsync(int tenantId, int planId, BillingCycle billingCycle, string successUrl, string cancelUrl) => throw new NotImplementedException();
        public Task<bool> ActivateSubscriptionFromStripePaymentAsync(int tenantId, int planId, BillingCycle billingCycle, string stripeSessionId) => throw new NotImplementedException();
    }
}
