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
    [Fact]
    public async Task SharedVatWarning_UsesCurrentSettingsAcrossPages_AndClearedVatOverridesLegacy()
    {
        await using var db = await CreateDbAsync();
        foreach (var id in new[] { 5, 6 })
        {
            db.Tenants.Add(new Tenant { Id = id, Name = $"Company {id}", Subdomain = $"company-{id}",
                Country = "AE", Currency = "AED", VatNumber = "999999999999999", CreatedAt = DateTime.UtcNow });
            db.Settings.Add(new Setting { TenantId = id, OwnerId = id, Key = "COMPANY_TRN", Value = "123456789012345" });
        }
        await db.SaveChangesAsync();
        var firstPage = await CreateService(db).GetTenantsAsync(pageSize: 1);
        Assert.Single(firstPage.Items);
        Assert.Equal("123456789012345", firstPage.Items.Single().VatNumber);
        Assert.Equal(2, firstPage.Items.Single().SharedVatTenantCount);
        db.Settings.Single(s => s.TenantId == 6).Value = "";
        await db.SaveChangesAsync();
        var directory = await CreateService(db).GetTenantsAsync();
        Assert.Equal(1, directory.Items.Single(t => t.Id == 5).SharedVatTenantCount);
        Assert.Equal("", directory.Items.Single(t => t.Id == 6).VatNumber);
        Assert.Equal(0, directory.Items.Single(t => t.Id == 6).SharedVatTenantCount);
    }

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

    [Fact]
    public async Task SharedOwnerSetup_CopiesOnlyLegalIdentityAndCreatesAnIsolatedOwner()
    {
        await using var db = await CreateDbAsync();
        await SeedLegalSourceAsync(db);
        var request = SharedOwnerRequest();
        // Browser edits cannot replace the approved source identity.
        request.ExpectedLegalIdentityFingerprint = (await CreateService(db).GetTenantByIdAsync(5))!.LegalIdentityFingerprint;
        request.Name = "Tampered name";
        request.CompanyNameEn = "Tampered legal name";
        request.VatNumber = "Tampered TRN";
        request.CompanyLicense = "Tampered licence";
        var (tenant, _, invite) = await CreateService(db).CreateTenantAsync(request, 1);

        Assert.NotEqual(5, tenant.Id);
        Assert.Equal("Legal Trading Company", tenant.Name);
        Assert.Equal("Registered Trading LLC", tenant.CompanyNameEn);
        Assert.Equal("100123456789012", tenant.VatNumber);
        Assert.Equal("owner-two", tenant.Subdomain);
        Assert.StartsWith("https://owner-two.hexabill.company/login?invite=", invite);
        var owner = await db.Users.SingleAsync(u => u.TenantId == tenant.Id);
        Assert.Equal("Second Owner", owner.Name);
        Assert.Equal("second@example.com", owner.Email);
        Assert.Equal("+971502222222", owner.Phone);
        Assert.Equal(tenant.Id, owner.OwnerId);
        var settings = await db.Settings.Where(s => s.TenantId == tenant.Id).ToDictionaryAsync(s => s.Key, s => s.Value);
        Assert.Equal("LIC-123", settings["COMPANY_LICENSE"]);
        Assert.Equal("Empty", settings["OPENING_DATA_CHOICE"]);
        Assert.Equal("+971502222222", settings["COMPANY_PHONE"]);
        Assert.Equal("INV", settings["INVOICE_PREFIX"]);
        Assert.False(settings.ContainsKey("BANK_ACCOUNT"));
        Assert.False(settings.ContainsKey("AI_PROVIDER_KEY"));
        Assert.Null((await db.Tenants.SingleAsync(t => t.Id == tenant.Id)).FeaturesJson);
        Assert.Equal("owner-one", (await db.Tenants.SingleAsync(t => t.Id == 5)).Subdomain);

        db.SetRequestTenantScope(tenant.Id, isPlatformScope: false);
        Assert.Empty(await db.Products.ToListAsync());
        Assert.Empty(await db.Customers.ToListAsync());
        Assert.Empty(await db.Sales.ToListAsync());
        Assert.Empty(await db.Payments.ToListAsync());
        Assert.All(await db.Settings.ToListAsync(), s => Assert.Equal(tenant.Id, s.TenantId));
        db.SetRequestTenantScope(5, isPlatformScope: false);
        Assert.Single(await db.Products.ToListAsync());
        Assert.Single(await db.Customers.ToListAsync());
        Assert.DoesNotContain(await db.Users.ToListAsync(), u => u.Id == owner.Id);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("[]")]
    [InlineData("{broken")]
    public async Task SharedOwnerSetup_IsOffWithoutAnExplicitSourceFlag(string? flags)
    {
        await using var db = await CreateDbAsync();
        await SeedLegalSourceAsync(db, flags);
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => CreateService(db).CreateTenantAsync(SharedOwnerRequest(), 1));
        Assert.Contains("Enable shared legal owner setup", error.Message);
        Assert.Single(await db.Tenants.ToListAsync());
    }

    [Fact]
    public async Task SharedOwnerSetup_RequiresReviewedIdentityAndCompleteLicence()
    {
        await using var db = await CreateDbAsync();
        await SeedLegalSourceAsync(db);
        var request = SharedOwnerRequest();
        request.ConfirmSharedLegalIdentity = false;
        await Assert.ThrowsAsync<InvalidOperationException>(() => CreateService(db).CreateTenantAsync(request, 1));
        request.ConfirmSharedLegalIdentity = true;
        var licence = await db.Settings.SingleAsync(s => s.TenantId == 5 && s.Key == "COMPANY_LICENSE");
        licence.Value = "";
        await db.SaveChangesAsync();
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => CreateService(db).CreateTenantAsync(request, 1));
        Assert.Contains("licence before owner setup", error.Message);
        Assert.Single(await db.Tenants.ToListAsync());
    }

    [Fact]
    public async Task CompanySetup_RejectsTenantScopedCallerEvenWithSourceId()
    {
        await using var db = await CreateDbAsync();
        await SeedLegalSourceAsync(db);
        db.SetRequestTenantScope(5, isPlatformScope: false);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => CreateService(db).CreateTenantAsync(SharedOwnerRequest(), 1));
        Assert.Single(await db.Tenants.ToListAsync());
    }

    [Fact]
    public async Task SharedOwnerSetup_RejectsAStaleLegalReview()
    {
        await using var db = await CreateDbAsync();
        await SeedLegalSourceAsync(db);
        var service = CreateService(db);
        var preview = await service.GetTenantByIdAsync(5);
        Assert.True(preview!.SharedLegalWorkspaceEnabled);
        Assert.Equal("LIC-123", preview.CompanyLicense);
        var request = SharedOwnerRequest();
        request.ExpectedLegalIdentityFingerprint = preview.LegalIdentityFingerprint;
        var licence = await db.Settings.SingleAsync(s => s.TenantId == 5 && s.Key == "COMPANY_LICENSE");
        licence.Value = "LIC-UPDATED";
        await db.SaveChangesAsync();
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateTenantAsync(request, 1));
        Assert.Contains("legal details changed", error.Message);
        Assert.Single(await db.Tenants.ToListAsync());
    }

    private static CreateTenantRequest SharedOwnerRequest() => new()
    {
        Name = "Legal Trading Company", Subdomain = "owner-two", OwnerName = "Second Owner",
        Email = "second@example.com", Phone = "+971502222222",
        SharedLegalIdentityFromTenantId = 5, ConfirmSharedLegalIdentity = true, OpeningDataChoice = "Empty"
    };

    [Theory]
    [InlineData(null)]
    [InlineData("Import")]
    [InlineData("unexpected")]
    public async Task SharedOwnerSetup_DoesNotProvisionWithoutExplicitSupportedOpeningChoice(string? choice)
    {
        await using var db = await CreateDbAsync();
        await SeedLegalSourceAsync(db);
        var service = CreateService(db);
        var request = SharedOwnerRequest();
        request.ExpectedLegalIdentityFingerprint = (await service.GetTenantByIdAsync(5))!.LegalIdentityFingerprint;
        request.OpeningDataChoice = choice;
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateTenantAsync(request, 1));
        Assert.Contains("Choose an empty workspace explicitly", error.Message);
        Assert.Single(await db.Tenants.ToListAsync());
        Assert.Empty(await db.TenantInvites.ToListAsync());
    }

    private static async Task SeedLegalSourceAsync(AppDbContext db,
        string? flags = "[\"shared_legal_workspace\"]")
    {
        db.Tenants.Add(new Tenant
        {
            Id = 5, Name = "Legal Trading Company", CompanyNameEn = "Registered Trading LLC",
            Subdomain = "owner-one", Country = "AE", Currency = "AED", VatNumber = "100123456789012",
            Email = "first@example.com", Phone = "+971501111111", Status = TenantStatus.Active, FeaturesJson = flags
        });
        var sourceSettings = new Dictionary<string, string>
        {
            ["COMPANY_NAME_EN"] = "Registered Trading LLC", ["COMPANY_TRN"] = "100123456789012",
            ["COMPANY_LICENSE"] = "LIC-123", ["BANK_ACCOUNT"] = "Owner one private bank",
            ["AI_PROVIDER_KEY"] = "test-only-private-value", ["INVOICE_PREFIX"] = "OWNER1"
        };
        foreach (var entry in sourceSettings)
            db.Settings.Add(new Setting { TenantId = 5, OwnerId = 5, Key = entry.Key, Value = entry.Value });
        db.Products.Add(new Product { TenantId = 5, OwnerId = 5, NameEn = "Source private stock", Sku = "SOURCE", StockQty = 8 });
        db.Customers.Add(new Customer { TenantId = 5, OwnerId = 5, Name = "Source private customer" });
        db.Users.Add(new User { TenantId = 5, OwnerId = 5, Name = "First Owner", Email = "first@example.com", Role = UserRole.Owner, PasswordHash = "test-only" });
        db.Sales.Add(new Sale { TenantId = 5, OwnerId = 5, InvoiceNo = "OWNER1-1", GrandTotal = 1331m, CreatedAt = DateTime.UtcNow, InvoiceDate = DateTime.UtcNow });
        await db.SaveChangesAsync();
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
