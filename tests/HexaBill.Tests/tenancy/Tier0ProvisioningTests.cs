using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Subscription;
using HexaBill.Api.Modules.Tenants;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using System.Security.Claims;
using System.Text.Json;

namespace HexaBill.Tests;

public class Tier0ProvisioningTests
{
    [Fact]
    public async Task Apply_CreatesFrozenHub2_WithSharedIdentity_SampleVat_AndEmptyOpeningData()
    {
        await using var db = Database();
        db.Tenants.Add(new Tenant
        {
            Id = 20,
            Name = "FrozenHub Foodstuff",
            Subdomain = "frozenhub",
            Status = TenantStatus.Active,
            FeaturesJson = "[]",
            CreatedAt = DateTime.UtcNow
        });
        db.Tenants.Add(new Tenant
        {
            Id = 22,
            Name = "Gulf Harvest",
            Subdomain = "gulfharvest",
            Status = TenantStatus.Active,
            CreatedAt = DateTime.UtcNow
        });
        db.Users.Add(new User
        {
            Id = 1,
            Name = "Platform Admin",
            Email = "admin@hexabill.company",
            PasswordHash = "x",
            Role = UserRole.Owner,
            IsPlatformAdmin = true,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Tier0Provisioning:Domain"] = "localhost",
            ["Tier0Provisioning:FrozenHub1:ExistingTenantId"] = "20",
            ["Tier0Provisioning:FrozenHub1:Slug"] = "frozenhub1",
            ["Tier0Provisioning:FrozenHub1:LegacySlug"] = "frozenhub",
            ["Tier0Provisioning:FrozenHub1:CompanyNameEn"] = "FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C",
            ["Tier0Provisioning:FrozenHub1:License"] = "CN-6774701",
            ["Tier0Provisioning:FrozenHub1:Phone"] = "971555298878",
            ["Tier0Provisioning:FrozenHub1:SeedSampleVatTrn"] = "true",
            ["Tier0Provisioning:FrozenHub2:Slug"] = "frozenhub2",
            ["Tier0Provisioning:FrozenHub2:OpeningDataChoice"] = "Empty",
            ["Tier0Provisioning:FrozenHub2:OwnerEmail"] = "frozenhub2@hexabill.company",
            ["Tier0Provisioning:FrozenHub2:OwnerName"] = "FrozenHub Owner 2",
            ["Tier0Provisioning:FrozenHub2:Phone"] = "971555298878",
            ["Tier0Provisioning:FrozenHub2:SeedSampleVatTrn"] = "true",
            ["Tier0Provisioning:GulfHarvest:ExistingTenantId"] = "22",
            ["Tier0Provisioning:GulfHarvest:Slug"] = "gulfharvest",
            ["Tier0Provisioning:GulfHarvest:License"] = "CN-6659056",
            ["Tier0Provisioning:GulfHarvest:CorporateTaxTrn"] = "105543085200001",
            ["Tier0Provisioning:GulfHarvest:SeedSampleVatTrn"] = "true",
        }).Build();

        var http = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, "1"),
                    new Claim("UserId", "1")
                }, "test"))
            }
        };

        var fakeTenants = new FakeTenantService(db);
        var provisioner = new Tier0TenantProvisioning(
            db,
            new SettingsService(db, http),
            fakeTenants,
            http,
            config,
            new DevHostEnvironment(),
            NullLogger<Tier0TenantProvisioning>.Instance);

        var log = await provisioner.ApplyAsync();
        Assert.Contains(log, line => line.Contains("frozenhub1"));
        Assert.Contains(log, line => line.Contains("frozenhub2 created") || line.Contains("frozenhub2 already exists"));
        Assert.Contains(log, line => line.Contains("gulfharvest"));

        db.ChangeTracker.Clear();
        var fh1 = await db.Tenants.SingleAsync(t => t.Id == 20);
        Assert.Equal("frozenhub1", fh1.Subdomain);
        Assert.Contains(SuperAdminTenantService.SharedLegalWorkspaceFeature, fh1.FeaturesJson ?? "");
        Assert.Equal(SampleVatTrn.FrozenHub1, await Setting(db, 20, "COMPANY_TRN"));
        Assert.Equal("frozenhub", await Setting(db, 20, "LEGACY_SUBDOMAIN"));

        var fh2 = await db.Tenants.SingleAsync(t => t.Subdomain == "frozenhub2");
        Assert.Equal(SampleVatTrn.FrozenHub2, await Setting(db, fh2.Id, "COMPANY_TRN"));
        Assert.Equal("Empty", await Setting(db, fh2.Id, "OPENING_DATA_CHOICE"));
        Assert.Equal("FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C", await Setting(db, fh2.Id, "COMPANY_NAME_EN"));
        Assert.Equal("CN-6774701", await Setting(db, fh2.Id, "COMPANY_LICENSE"));

        var gh = await db.Tenants.SingleAsync(t => t.Id == 22);
        Assert.Equal(SampleVatTrn.GulfHarvest, await Setting(db, 22, "COMPANY_TRN"));
        Assert.Equal("105543085200001", await Setting(db, 22, "CORPORATE_TAX_TRN"));
        Assert.NotEqual(await Setting(db, 22, "COMPANY_TRN"), await Setting(db, 22, "CORPORATE_TAX_TRN"));

        var again = await provisioner.ApplyAsync();
        Assert.Contains(again, line => line.Contains("already exists") || line.Contains("frozenhub2"));
        Assert.Single(await db.Users.Where(u => u.Email == "frozenhub2@hexabill.company").ToListAsync());
    }

    [Fact]
    public async Task Apply_CreateMissingTenants_CreatesFh1GhAndZayogya_WhenAbsent()
    {
        await using var db = Database();
        db.Users.Add(new User
        {
            Id = 1,
            Name = "Platform Admin",
            Email = "admin@hexabill.com",
            PasswordHash = "x",
            Role = UserRole.Owner,
            IsPlatformAdmin = true,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Tier0Provisioning:Domain"] = "localhost",
            ["Tier0Provisioning:CreateMissingTenants"] = "true",
            ["Tier0Provisioning:FrozenHub1:Slug"] = "frozenhub1",
            ["Tier0Provisioning:FrozenHub1:LegacySlug"] = "frozenhub",
            ["Tier0Provisioning:FrozenHub1:CompanyNameEn"] = "FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C",
            ["Tier0Provisioning:FrozenHub1:License"] = "CN-6774701",
            ["Tier0Provisioning:FrozenHub1:Email"] = "frozenhubfoods@gmail.com",
            ["Tier0Provisioning:FrozenHub1:Phone"] = "971555298878",
            ["Tier0Provisioning:FrozenHub1:SeedSampleVatTrn"] = "true",
            ["Tier0Provisioning:FrozenHub2:Slug"] = "frozenhub2",
            ["Tier0Provisioning:FrozenHub2:OpeningDataChoice"] = "Empty",
            ["Tier0Provisioning:FrozenHub2:OwnerEmail"] = "frozenhub2@hexabill.company",
            ["Tier0Provisioning:FrozenHub2:OwnerName"] = "FrozenHub Owner 2",
            ["Tier0Provisioning:FrozenHub2:Phone"] = "971555298878",
            ["Tier0Provisioning:FrozenHub2:SeedSampleVatTrn"] = "true",
            ["Tier0Provisioning:GulfHarvest:Slug"] = "gulfharvest",
            ["Tier0Provisioning:GulfHarvest:CompanyNameEn"] = "GULF HARVEST GENERAL TRADING - L.L.C - S.P.C",
            ["Tier0Provisioning:GulfHarvest:License"] = "CN-6659056",
            ["Tier0Provisioning:GulfHarvest:Email"] = "gulfharvest@hexabill.company",
            ["Tier0Provisioning:GulfHarvest:CorporateTaxTrn"] = "105543085200001",
            ["Tier0Provisioning:GulfHarvest:SeedSampleVatTrn"] = "true",
            ["Tier0Provisioning:Zayogya:Slug"] = "zayoga",
            ["Tier0Provisioning:Zayogya:CompanyNameEn"] = "Zayogya",
            ["Tier0Provisioning:Zayogya:Email"] = "zayoga@hexabill.company",
        }).Build();

        var http = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, "1"),
                    new Claim("UserId", "1")
                }, "test"))
            }
        };

        var provisioner = new Tier0TenantProvisioning(
            db,
            new SettingsService(db, http),
            new FakeTenantService(db),
            http,
            config,
            new DevHostEnvironment(),
            NullLogger<Tier0TenantProvisioning>.Instance);

        var log = await provisioner.ApplyAsync();
        Assert.Equal(4, log.Count);
        Assert.Contains(await db.Tenants.Select(t => t.Subdomain).ToListAsync(), s => s == "frozenhub1");
        Assert.Contains(await db.Tenants.Select(t => t.Subdomain).ToListAsync(), s => s == "frozenhub2");
        Assert.Contains(await db.Tenants.Select(t => t.Subdomain).ToListAsync(), s => s == "gulfharvest");
        Assert.Contains(await db.Tenants.Select(t => t.Subdomain).ToListAsync(), s => s == "zayoga");

        var fh1 = await db.Tenants.SingleAsync(t => t.Subdomain == "frozenhub1");
        Assert.Equal(SampleVatTrn.FrozenHub1, await Setting(db, fh1.Id, "COMPANY_TRN"));
        Assert.Equal("frozenhub", await Setting(db, fh1.Id, "LEGACY_SUBDOMAIN"));

        var zy = await db.Tenants.SingleAsync(t => t.Subdomain == "zayoga");
        Assert.False(await db.Settings.AnyAsync(s => s.TenantId == zy.Id && s.Key == "COMPANY_TRN"));
    }

    private static async Task<string> Setting(AppDbContext db, int tenantId, string key) =>
        (await db.Settings.AsNoTracking().SingleAsync(s => s.TenantId == tenantId && s.Key == key)).Value ?? "";

    private static AppDbContext Database()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        return db;
    }

    private sealed class DevHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "HexaBill.Tests";
        public string ContentRootPath { get; set; } = ".";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private sealed class FakeTenantService : ISuperAdminTenantService
    {
        private readonly AppDbContext _db;
        public FakeTenantService(AppDbContext db) => _db = db;

        public Task<TenantDetailDto?> GetTenantByIdAsync(int tenantId)
        {
            var tenant = _db.Tenants.AsNoTracking().Single(t => t.Id == tenantId);
            var settings = _db.Settings.AsNoTracking().Where(s => s.TenantId == tenantId)
                .ToDictionary(s => s.Key, s => s.Value ?? "");
            var snapshot = JsonSerializer.Serialize(new
            {
                tenant.Id,
                tenant.Name,
                tenant.Country,
                tenant.Currency,
                NameEn = settings.GetValueOrDefault("COMPANY_NAME_EN", tenant.CompanyNameEn ?? tenant.Name),
                NameAr = settings.GetValueOrDefault("COMPANY_NAME_AR", tenant.CompanyNameAr ?? ""),
                Trn = settings.GetValueOrDefault("COMPANY_TRN", tenant.VatNumber ?? ""),
                Licence = settings.GetValueOrDefault("COMPANY_LICENSE", "")
            });
            var fp = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(snapshot)));
            return Task.FromResult<TenantDetailDto?>(new TenantDetailDto
            {
                Id = tenant.Id,
                Name = tenant.Name,
                Subdomain = tenant.Subdomain,
                SharedLegalWorkspaceEnabled = true,
                LegalIdentityFingerprint = fp
            });
        }

        public async Task<(TenantDto Tenant, string GeneratedPassword, string InviteUrl)> CreateTenantAsync(CreateTenantRequest request, int createdByUserId)
        {
            if (request.SharedLegalIdentityFromTenantId.HasValue)
            {
                Assert.Equal("Empty", request.OpeningDataChoice);
                Assert.True(request.ConfirmSharedLegalIdentity);
                Assert.False(string.IsNullOrWhiteSpace(request.ExpectedLegalIdentityFingerprint));
            }

            var tenant = new Tenant
            {
                Name = request.Name,
                Subdomain = request.Subdomain,
                CompanyNameEn = request.CompanyNameEn ?? request.Name,
                CompanyNameAr = request.CompanyNameAr,
                Status = TenantStatus.Active,
                Email = request.Email,
                Phone = request.Phone,
                Address = request.Address,
                CreatedAt = DateTime.UtcNow
            };
            _db.Tenants.Add(tenant);
            await _db.SaveChangesAsync();
            _db.Users.Add(new User
            {
                Name = request.OwnerName ?? "Owner",
                Email = request.Email!,
                PasswordHash = "fixture",
                Role = UserRole.Owner,
                TenantId = tenant.Id,
                OwnerId = tenant.Id,
                MustChangePassword = true,
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();
            return (new TenantDto { Id = tenant.Id, Name = tenant.Name, Subdomain = tenant.Subdomain }, "unused", "http://invite.test");
        }

        public Task<PlatformDashboardDto> GetPlatformDashboardAsync() => throw new NotSupportedException();
        public Task<PagedResponse<TenantDto>> GetTenantsAsync(int page = 1, int pageSize = 20, string? search = null, TenantStatus? status = null) => throw new NotSupportedException();
        public Task<TenantDto> UpdateTenantAsync(int tenantId, UpdateTenantRequest request) => throw new NotSupportedException();
        public Task<bool> SuspendTenantAsync(int tenantId, string reason) => throw new NotSupportedException();
        public Task<bool> ActivateTenantAsync(int tenantId) => throw new NotSupportedException();
        public Task<TenantUsageMetricsDto> GetTenantUsageMetricsAsync(int tenantId) => throw new NotSupportedException();
        public Task<TenantHealthDto> GetTenantHealthAsync(int tenantId) => throw new NotSupportedException();
        public Task<TenantCostDto> GetTenantCostAsync(int tenantId) => throw new NotSupportedException();
        public Task<bool> DeleteTenantAsync(int tenantId) => throw new NotSupportedException();
        public Task<UserDto> AddUserToTenantAsync(int tenantId, CreateUserRequest request) => throw new NotSupportedException();
        public Task<UserDto> UpdateTenantUserAsync(int tenantId, int userId, UpdateUserRequest request) => throw new NotSupportedException();
        public Task<bool> DeleteTenantUserAsync(int tenantId, int userId) => throw new NotSupportedException();
        public Task<bool> ResetTenantUserPasswordAsync(int tenantId, int userId, string newPassword) => throw new NotSupportedException();
        public Task<bool> ForceLogoutUserAsync(int tenantId, int userId, int adminUserId) => throw new NotSupportedException();
        public Task<bool> ClearTenantDataAsync(int tenantId, int adminUserId) => throw new NotSupportedException();
        public Task<SubscriptionDto?> UpdateTenantSubscriptionAsync(int tenantId, int planId, BillingCycle billingCycle) => throw new NotSupportedException();
        public Task<DuplicateDataResultDto> DuplicateDataToTenantAsync(int targetTenantId, int sourceTenantId, IReadOnlyList<string> dataTypes) => throw new NotSupportedException();
        public Task<DuplicateDataPreviewDto> GetDuplicateDataPreviewAsync(int targetTenantId, int sourceTenantId, IReadOnlyList<string> dataTypes) => throw new NotSupportedException();
        public Task<TenantLimitsDto> GetTenantLimitsAsync(int tenantId) => throw new NotSupportedException();
        public Task UpdateTenantLimitsAsync(int tenantId, TenantLimitsDto dto) => throw new NotSupportedException();
        public Task<OnboardingReportDto> GetOnboardingReportAsync(bool incompleteOnly = false) => throw new NotSupportedException();
        public Task<BulkActionResultDto> ExecuteBulkActionAsync(BulkActionRequest request) => throw new NotSupportedException();
        public Task<PagedResponse<TenantInvoiceListItemDto>> GetTenantInvoicesAsync(int tenantId, int page = 1, int pageSize = 20) => throw new NotSupportedException();
        public Task<List<TenantPaymentHistoryItemDto>> GetTenantPaymentHistoryAsync(int tenantId) => throw new NotSupportedException();
        public Task<(Stream stream, string fileName)> ExportTenantDataAsync(int tenantId) => throw new NotSupportedException();
    }
}
