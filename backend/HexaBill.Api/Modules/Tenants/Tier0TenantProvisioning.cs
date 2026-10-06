using System.Security.Claims;
using System.Text.Json;
using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HexaBill.Api.Modules.Tenants;

/// <summary>
/// Idempotent Tier 0 tenant identity provisioning driven by configuration.
/// Never duplicates tenants, never resets credentials, never overwrites established settings.
/// </summary>
public sealed class Tier0TenantProvisioning
{
    public const string ConfigSection = "Tier0Provisioning";

    private readonly AppDbContext _db;
    private readonly ISettingsService _settings;
    private readonly ISuperAdminTenantService _tenants;
    private readonly IHttpContextAccessor _http;
    private readonly IConfiguration _config;
    private readonly IHostEnvironment _env;
    private readonly ILogger<Tier0TenantProvisioning> _logger;

    public Tier0TenantProvisioning(
        AppDbContext db,
        ISettingsService settings,
        ISuperAdminTenantService tenants,
        IHttpContextAccessor http,
        IConfiguration config,
        IHostEnvironment env,
        ILogger<Tier0TenantProvisioning> logger)
    {
        _db = db;
        _settings = settings;
        _tenants = tenants;
        _http = http;
        _config = config;
        _env = env;
        _logger = logger;
    }

    public async Task<IReadOnlyList<string>> ApplyAsync(CancellationToken ct = default)
    {
        if (!_db.RequestScopeEstablished || !_db.RequestIsPlatformScope)
            throw new UnauthorizedAccessException("Tier 0 provisioning requires a verified platform session.");

        var options = _config.GetSection(ConfigSection).Get<Tier0ProvisioningOptions>()
            ?? throw new InvalidOperationException($"Missing configuration section '{ConfigSection}'.");
        if (string.IsNullOrWhiteSpace(options.Domain))
            throw new InvalidOperationException("Tier0Provisioning:Domain is required.");

        var log = new List<string>();
        if (options.FrozenHub1 is not null)
            log.Add(await EnsureFrozenHubOwner1Async(options, ct));
        if (options.FrozenHub2 is not null)
            log.Add(await EnsureFrozenHubOwner2Async(options, ct));
        if (options.GulfHarvest is not null)
            log.Add(await EnsureGulfHarvestAsync(options, ct));
        if (options.Zayogya is not null)
            log.Add(await EnsureZayogyaAsync(options, ct));
        return log;
    }

    private async Task<string> EnsureFrozenHubOwner1Async(Tier0ProvisioningOptions options, CancellationToken ct)
    {
        var spec = options.FrozenHub1!;
        var tenant = await FindTenantAsync(spec.ExistingTenantId, spec.LegacySlug, spec.Slug, ct);
        if (tenant is null)
        {
            if (_env.IsProduction() || !options.CreateMissingTenants)
                throw new InvalidOperationException(
                    $"FrozenHub owner 1 tenant was not found (id={spec.ExistingTenantId}, slug={spec.LegacySlug}/{spec.Slug}). Create/map it before re-running.");
            if (string.IsNullOrWhiteSpace(spec.Slug) || string.IsNullOrWhiteSpace(spec.Email) || string.IsNullOrWhiteSpace(spec.CompanyNameEn))
                throw new InvalidOperationException("FrozenHub1 CreateMissingTenants requires Slug, Email and CompanyNameEn.");
            var created = await _tenants.CreateTenantAsync(new CreateTenantRequest
            {
                Name = spec.CompanyNameEn!,
                Subdomain = spec.LegacySlug ?? spec.Slug!,
                CompanyNameEn = spec.CompanyNameEn,
                CompanyNameAr = spec.CompanyNameAr,
                CompanyLicense = spec.License,
                Address = spec.Address,
                Phone = spec.Phone,
                Email = spec.Email,
                OwnerName = "FrozenHub Owner 1",
                Status = TenantStatus.Active,
                ClientAppBaseUrl = $"http://{(spec.LegacySlug ?? spec.Slug)}.{options.Domain}:5173"
            }, ResolvePlatformActorId());
            tenant = await _db.Tenants.FirstAsync(t => t.Id == created.Tenant.Id, ct);
            _logger.LogInformation("Created FrozenHub owner 1 tenantId={TenantId} for local bootstrap", tenant.Id);
            // Continue through rename + identity below; invite URL appended after save.
            await ApplyVerifiedIdentityAsync(tenant, spec, allowSampleVat: true, sampleVat: SampleVatTrn.FrozenHub1, ct);
            await EnsureSharedLegalWorkspaceFeatureAsync(tenant, ct);
            if (!string.IsNullOrWhiteSpace(spec.LegacySlug) &&
                string.Equals(tenant.Subdomain, spec.LegacySlug, StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(spec.Slug) &&
                !string.Equals(spec.Slug, spec.LegacySlug, StringComparison.OrdinalIgnoreCase))
            {
                var slugTaken = await _db.Tenants.AnyAsync(t => t.Id != tenant.Id && t.Subdomain.ToLower() == spec.Slug!.ToLower(), ct);
                if (slugTaken)
                    throw new InvalidOperationException($"Cannot rename FrozenHub to '{spec.Slug}' â€” subdomain already in use.");
                var oldSlug = tenant.Subdomain;
                tenant.Subdomain = spec.Slug!;
                await UpsertSettingIfEmptyAsync(tenant.Id, "LEGACY_SUBDOMAIN", spec.LegacySlug!, ct);
                await UpsertSettingIfEmptyAsync(tenant.Id, "CANONICAL_HOST", $"{spec.Slug}.{options.Domain}", ct);
                await RealignInviteHostAsync(tenant.Id, oldSlug, tenant.Subdomain, ct);
            }
            else if (!string.IsNullOrWhiteSpace(spec.LegacySlug))
            {
                await UpsertSettingIfEmptyAsync(tenant.Id, "LEGACY_SUBDOMAIN", spec.LegacySlug!, ct);
            }
            await TrySeedLogoDataUriIfEmptyAsync(tenant.Id, "frozenhub-logo.datauri.txt", ct);
            await _db.SaveChangesAsync(ct);
            return FormatCreateLog("frozenhub1", tenant, RewriteInviteHost(created.InviteUrl, tenant.Subdomain, options.Domain));
        }
        if (!string.IsNullOrWhiteSpace(spec.LegacySlug) &&
            string.Equals(tenant.Subdomain, spec.LegacySlug, StringComparison.OrdinalIgnoreCase) &&
            !string.IsNullOrWhiteSpace(spec.Slug) &&
            !string.Equals(spec.Slug, spec.LegacySlug, StringComparison.OrdinalIgnoreCase))
        {
            var slugTaken = await _db.Tenants.AnyAsync(t => t.Id != tenant.Id && t.Subdomain.ToLower() == spec.Slug!.ToLower(), ct);
            if (slugTaken)
                throw new InvalidOperationException($"Cannot rename FrozenHub to '{spec.Slug}' â€” subdomain already in use.");
            var old = tenant.Subdomain;
            tenant.Subdomain = spec.Slug!;
            await UpsertSettingIfEmptyAsync(tenant.Id, "LEGACY_SUBDOMAIN", spec.LegacySlug!, ct);
            await UpsertSettingIfEmptyAsync(tenant.Id, "CANONICAL_HOST", $"{spec.Slug}.{options.Domain}", ct);
            await RealignInviteHostAsync(tenant.Id, old, tenant.Subdomain, ct);
            _logger.LogInformation("FrozenHub owner 1 subdomain {Old} â†’ {New}; LEGACY_SUBDOMAIN redirect recorded", old, spec.Slug);
        }
        else if (!string.IsNullOrWhiteSpace(spec.LegacySlug))
        {
            await UpsertSettingIfEmptyAsync(tenant.Id, "LEGACY_SUBDOMAIN", spec.LegacySlug!, ct);
        }

        await ApplyVerifiedIdentityAsync(tenant, spec, allowSampleVat: true, sampleVat: SampleVatTrn.FrozenHub1, ct);
        await EnsureSharedLegalWorkspaceFeatureAsync(tenant, ct);
        await TrySeedLogoDataUriIfEmptyAsync(tenant.Id, "frozenhub-logo.datauri.txt", ct);
        await _db.SaveChangesAsync(ct);
        return $"frozenhub1 tenantId={tenant.Id} slug={tenant.Subdomain}";
    }

    private async Task<string> EnsureFrozenHubOwner2Async(Tier0ProvisioningOptions options, CancellationToken ct)
    {
        var spec = options.FrozenHub2!;
        if (!string.Equals(spec.OpeningDataChoice, "Empty", StringComparison.Ordinal))
            throw new InvalidOperationException("FrozenHub owner 2 requires OpeningDataChoice=Empty before provisioning completes.");

        var existing = await FindTenantAsync(null, null, spec.Slug, ct);
        if (existing is not null)
        {
            await UpsertSettingIfEmptyAsync(existing.Id, "OPENING_DATA_CHOICE", "Empty", ct);
            await ApplyVerifiedIdentityAsync(existing, MergeFrozenHubIdentity(options, spec), allowSampleVat: true, sampleVat: SampleVatTrn.FrozenHub2, ct);
            await TrySeedLogoDataUriIfEmptyAsync(existing.Id, "frozenhub-logo.datauri.txt", ct);
            await _db.SaveChangesAsync(ct);
            return $"frozenhub2 already exists tenantId={existing.Id} slug={existing.Subdomain} (settings preserved)";
        }

        var owner1 = await FindTenantAsync(options.FrozenHub1?.ExistingTenantId, options.FrozenHub1?.LegacySlug, options.FrozenHub1?.Slug, ct)
            ?? throw new InvalidOperationException("FrozenHub owner 1 must exist before creating owner 2.");

        if (string.IsNullOrWhiteSpace(spec.OwnerEmail) || string.IsNullOrWhiteSpace(spec.OwnerName) || string.IsNullOrWhiteSpace(spec.Phone))
            throw new InvalidOperationException("FrozenHub owner 2 requires OwnerEmail, OwnerName and Phone in configuration.");

        var identity = MergeFrozenHubIdentity(options, spec);
        // Ensure source has licence + shared-legal flag before CreateTenantAsync validation.
        await ApplyVerifiedIdentityAsync(owner1, options.FrozenHub1 ?? identity, allowSampleVat: true, sampleVat: SampleVatTrn.FrozenHub1, ct);
        await EnsureSharedLegalWorkspaceFeatureAsync(owner1, ct);
        await _db.SaveChangesAsync(ct);

        var detail = await _tenants.GetTenantByIdAsync(owner1.Id)
            ?? throw new InvalidOperationException("Could not load FrozenHub owner 1 for shared legal review.");
        if (string.IsNullOrWhiteSpace(detail.LegalIdentityFingerprint))
            throw new InvalidOperationException("FrozenHub owner 1 legal identity fingerprint is missing.");

        var actorId = ResolvePlatformActorId();
        var created = await _tenants.CreateTenantAsync(new CreateTenantRequest
        {
            Name = identity.CompanyNameEn ?? owner1.Name,
            Subdomain = spec.Slug!,
            OwnerName = spec.OwnerName,
            Email = spec.OwnerEmail,
            Phone = spec.Phone,
            Address = identity.Address ?? owner1.Address,
            SharedLegalIdentityFromTenantId = owner1.Id,
            ConfirmSharedLegalIdentity = true,
            OpeningDataChoice = "Empty",
            ExpectedLegalIdentityFingerprint = detail.LegalIdentityFingerprint,
            Status = TenantStatus.Active,
            ClientAppBaseUrl = $"http://{spec.Slug}.{options.Domain}:5173"
        }, actorId);

        var createdTenant = await _db.Tenants.FirstAsync(t => t.Id == created.Tenant.Id, ct);
        await ApplyVerifiedIdentityAsync(createdTenant, identity, allowSampleVat: true, sampleVat: SampleVatTrn.FrozenHub2, ct);
        await UpsertSettingIfEmptyAsync(createdTenant.Id, "OPENING_DATA_CHOICE", "Empty", ct);
        await TrySeedLogoDataUriIfEmptyAsync(createdTenant.Id, "frozenhub-logo.datauri.txt", ct);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Created frozenhub2 tenantId={TenantId}; invite issued (password not logged)",
            createdTenant.Id);
        return FormatCreateLog("frozenhub2", createdTenant, created.InviteUrl);
    }

    private async Task<string> EnsureGulfHarvestAsync(Tier0ProvisioningOptions options, CancellationToken ct)
    {
        var spec = options.GulfHarvest!;
        var tenant = await FindTenantAsync(spec.ExistingTenantId, null, spec.Slug, ct);
        if (tenant is null)
        {
            if (_env.IsProduction() || !options.CreateMissingTenants)
                throw new InvalidOperationException(
                    $"GulfHarvest tenant was not found (id={spec.ExistingTenantId}, slug={spec.Slug}).");
            if (string.IsNullOrWhiteSpace(spec.Slug) || string.IsNullOrWhiteSpace(spec.Email) || string.IsNullOrWhiteSpace(spec.CompanyNameEn))
                throw new InvalidOperationException("GulfHarvest CreateMissingTenants requires Slug, Email and CompanyNameEn.");
            var created = await _tenants.CreateTenantAsync(new CreateTenantRequest
            {
                Name = spec.CompanyNameEn!,
                Subdomain = spec.Slug!,
                CompanyNameEn = spec.CompanyNameEn,
                CompanyNameAr = spec.CompanyNameAr,
                CompanyLicense = spec.License,
                Address = spec.Address,
                Phone = spec.Phone,
                Email = spec.Email,
                OwnerName = "GulfHarvest Owner",
                Status = TenantStatus.Active,
                ClientAppBaseUrl = $"http://{spec.Slug}.{options.Domain}:5173"
            }, ResolvePlatformActorId());
            tenant = await _db.Tenants.FirstAsync(t => t.Id == created.Tenant.Id, ct);
            await ApplyVerifiedIdentityAsync(tenant, spec, allowSampleVat: true, sampleVat: SampleVatTrn.GulfHarvest, ct);
            await ForceGulfHarvestVerifiedFieldsAsync(tenant.Id, spec, ct);
            await _db.SaveChangesAsync(ct);
            return FormatCreateLog("gulfharvest", tenant, created.InviteUrl);
        }

        await ApplyVerifiedIdentityAsync(tenant, spec, allowSampleVat: true, sampleVat: SampleVatTrn.GulfHarvest, ct);
        await ForceGulfHarvestVerifiedFieldsAsync(tenant.Id, spec, ct);
        await _db.SaveChangesAsync(ct);
        return $"gulfharvest tenantId={tenant.Id} slug={tenant.Subdomain}";
    }

    /// <summary>
    /// Apply verified licence / CT fields for Gulf Harvest. Never writes VAT TRN here (sample/pending path stays separate).
    /// </summary>
    private async Task ForceGulfHarvestVerifiedFieldsAsync(int tenantId, Tier0TenantSpec spec, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(spec.CompanyNameEn))
            await ForceSettingAsync(tenantId, "COMPANY_NAME_EN", spec.CompanyNameEn!.Trim(), ct);
        if (!string.IsNullOrWhiteSpace(spec.CompanyNameAr))
            await ForceSettingAsync(tenantId, "COMPANY_NAME_AR", spec.CompanyNameAr!.Trim(), ct);
        if (!string.IsNullOrWhiteSpace(spec.License))
            await ForceSettingAsync(tenantId, "COMPANY_LICENSE", spec.License!.Trim(), ct);
        if (!string.IsNullOrWhiteSpace(spec.Address))
            await ForceSettingAsync(tenantId, "COMPANY_ADDRESS", spec.Address!.Trim(), ct);
        if (!string.IsNullOrWhiteSpace(spec.Phone))
            await ForceSettingAsync(tenantId, "COMPANY_PHONE", spec.Phone!.Trim(), ct);
        if (!string.IsNullOrWhiteSpace(spec.Email))
            await ForceSettingAsync(tenantId, "COMPANY_EMAIL", spec.Email!.Trim(), ct);
        if (!string.IsNullOrWhiteSpace(spec.CorporateTaxTrn))
            await ForceSettingAsync(tenantId, "CORPORATE_TAX_TRN", spec.CorporateTaxTrn!.Trim(), ct);
        await ForceSettingAsync(tenantId, "INVOICE_HEADER_STYLE", "BilingualMonochrome", ct);

        await TrySeedLogoDataUriIfEmptyAsync(tenantId, "gulfharvest-logo.datauri.txt", ct);
    }

    /// <summary>
    /// Optional App_Data logo seed when LOGO_BASE64_DATA_URI is empty. Never overwrites an existing logo.
    /// </summary>
    private async Task TrySeedLogoDataUriIfEmptyAsync(int tenantId, string fileName, CancellationToken ct)
    {
        try
        {
            var existingLogo = await _settings.GetSettingValueAsync(tenantId, "LOGO_BASE64_DATA_URI");
            if (!string.IsNullOrWhiteSpace(existingLogo))
                return;

            // Prefer published SeedLogos; fall back to App_Data (local gitignored) then project tree.
            string? logoPath = null;
            foreach (var candidate in new[]
                     {
                         Path.Combine(AppContext.BaseDirectory, "SeedLogos", fileName),
                         Path.Combine(AppContext.BaseDirectory, "App_Data", fileName),
                         Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "SeedLogos", fileName)),
                         Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "App_Data", fileName))
                     })
            {
                if (File.Exists(candidate))
                {
                    logoPath = candidate;
                    break;
                }
            }
            if (logoPath is null)
                return;

            var dataUri = (await File.ReadAllTextAsync(logoPath, ct)).Trim();
            if (dataUri.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase) && dataUri.Length < 2_000_000)
                await ForceSettingAsync(tenantId, "LOGO_BASE64_DATA_URI", dataUri, ct);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Optional logo seed skipped for {File} tenant {TenantId}", fileName, tenantId);
        }
    }

    private async Task<string> EnsureZayogyaAsync(Tier0ProvisioningOptions options, CancellationToken ct)
    {
        var spec = options.Zayogya!;
        var tenant = await FindTenantAsync(spec.ExistingTenantId, null, spec.Slug, ct);
        if (tenant is null)
        {
            if (_env.IsProduction() || !options.CreateMissingTenants)
                return "zayogya skipped (not found; CreateMissingTenants off or Production)";
            if (string.IsNullOrWhiteSpace(spec.Slug) || string.IsNullOrWhiteSpace(spec.Email))
                throw new InvalidOperationException("Zayogya CreateMissingTenants requires Slug and Email.");
            var created = await _tenants.CreateTenantAsync(new CreateTenantRequest
            {
                Name = spec.CompanyNameEn ?? "Zayogya",
                Subdomain = spec.Slug!,
                CompanyNameEn = spec.CompanyNameEn ?? "Zayogya",
                CompanyNameAr = spec.CompanyNameAr,
                Address = spec.Address,
                Phone = spec.Phone,
                Email = spec.Email,
                OwnerName = spec.OwnerName ?? "Zayogya Owner",
                Status = TenantStatus.Active,
                ClientAppBaseUrl = $"http://{spec.Slug}.{options.Domain}:5173"
            }, ResolvePlatformActorId());
            tenant = await _db.Tenants.FirstAsync(t => t.Id == created.Tenant.Id, ct);
            // Do not seed sample VAT or overwrite Zayogya tax behavior.
            await UpsertSettingIfEmptyAsync(tenant.Id, "COMPANY_NAME_EN", spec.CompanyNameEn ?? "Zayogya", ct);
            await _db.SaveChangesAsync(ct);
            return FormatCreateLog("zayogya", tenant, created.InviteUrl);
        }
        return $"zayogya tenantId={tenant.Id} slug={tenant.Subdomain} (unchanged)";
    }

    private static string FormatCreateLog(string label, Tenant tenant, string? inviteUrl)
    {
        var invite = string.IsNullOrWhiteSpace(inviteUrl) ? "inviteReady=true" : $"inviteUrl={inviteUrl}";
        return $"{label} created tenantId={tenant.Id} slug={tenant.Subdomain} {invite}";
    }

    private static string? RewriteInviteHost(string? inviteUrl, string slug, string domain)
    {
        if (string.IsNullOrWhiteSpace(inviteUrl)) return inviteUrl;
        try
        {
            var uri = new Uri(inviteUrl);
            var rebuilt = new UriBuilder(uri)
            {
                Scheme = "http",
                Host = $"{slug}.{domain}",
                Port = domain.Equals("localhost", StringComparison.OrdinalIgnoreCase) ? 5173 : uri.Port
            };
            return rebuilt.Uri.ToString();
        }
        catch
        {
            return inviteUrl;
        }
    }

    private async Task RealignInviteHostAsync(int tenantId, string? oldSlug, string newSlug, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(oldSlug) || string.Equals(oldSlug, newSlug, StringComparison.OrdinalIgnoreCase))
            return;
        var invites = await _db.TenantInvites
            .Where(i => i.TenantId == tenantId && i.UsedAt == null && i.RevokedAt == null && i.HostSubdomain == oldSlug)
            .ToListAsync(ct);
        foreach (var invite in invites)
            invite.HostSubdomain = newSlug;
    }

    private static Tier0TenantSpec MergeFrozenHubIdentity(Tier0ProvisioningOptions options, Tier0TenantSpec owner2)
    {
        var src = options.FrozenHub1;
        return new Tier0TenantSpec
        {
            Slug = owner2.Slug,
            OwnerEmail = owner2.OwnerEmail,
            OwnerName = owner2.OwnerName,
            Phone = owner2.Phone,
            Email = owner2.Email,
            OpeningDataChoice = owner2.OpeningDataChoice,
            SeedSampleVatTrn = owner2.SeedSampleVatTrn,
            CompanyNameEn = First(owner2.CompanyNameEn, src?.CompanyNameEn),
            CompanyNameAr = First(owner2.CompanyNameAr, src?.CompanyNameAr),
            License = First(owner2.License, src?.License),
            Address = First(owner2.Address, src?.Address)
        };
    }

    private static string? First(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));

    private async Task EnsureSharedLegalWorkspaceFeatureAsync(Tenant tenant, CancellationToken ct)
    {
        List<string> features;
        try
        {
            features = JsonSerializer.Deserialize<List<string>>(tenant.FeaturesJson ?? "[]") ?? new List<string>();
        }
        catch (JsonException)
        {
            features = new List<string>();
        }

        if (features.Contains(SuperAdminTenantService.SharedLegalWorkspaceFeature, StringComparer.Ordinal))
            return;

        features.Add(SuperAdminTenantService.SharedLegalWorkspaceFeature);
        tenant.FeaturesJson = JsonSerializer.Serialize(features);
        await _db.SaveChangesAsync(ct);
    }

    private int ResolvePlatformActorId()
    {
        var principal = _http.HttpContext?.User;
        var id = principal?.FindFirst("UserId")?.Value
            ?? principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? principal?.FindFirst("sub")?.Value;
        if (int.TryParse(id, out var actor) && actor > 0)
            return actor;
        throw new UnauthorizedAccessException("An authenticated platform admin is required to create FrozenHub owner 2.");
    }

    private async Task ApplyVerifiedIdentityAsync(
        Tenant tenant,
        Tier0TenantSpec spec,
        bool allowSampleVat,
        string sampleVat,
        CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(spec.CompanyNameEn))
        {
            if (string.IsNullOrWhiteSpace(tenant.CompanyNameEn))
                tenant.CompanyNameEn = spec.CompanyNameEn;
            await UpsertSettingIfEmptyAsync(tenant.Id, "COMPANY_NAME_EN", spec.CompanyNameEn!, ct);
        }
        if (!string.IsNullOrWhiteSpace(spec.CompanyNameAr))
        {
            if (string.IsNullOrWhiteSpace(tenant.CompanyNameAr))
                tenant.CompanyNameAr = spec.CompanyNameAr;
            await UpsertSettingIfEmptyAsync(tenant.Id, "COMPANY_NAME_AR", spec.CompanyNameAr!, ct);
        }
        if (!string.IsNullOrWhiteSpace(spec.License))
            await UpsertSettingIfEmptyAsync(tenant.Id, "COMPANY_LICENSE", spec.License!, ct);
        if (!string.IsNullOrWhiteSpace(spec.Address))
        {
            if (string.IsNullOrWhiteSpace(tenant.Address))
                tenant.Address = spec.Address;
            await UpsertSettingIfEmptyAsync(tenant.Id, "COMPANY_ADDRESS", spec.Address!, ct);
        }
        if (!string.IsNullOrWhiteSpace(spec.Phone))
        {
            if (string.IsNullOrWhiteSpace(tenant.Phone))
                tenant.Phone = spec.Phone;
            await UpsertSettingIfEmptyAsync(tenant.Id, "COMPANY_PHONE", spec.Phone!, ct);
        }
        if (!string.IsNullOrWhiteSpace(spec.Email))
            await UpsertSettingIfEmptyAsync(tenant.Id, "COMPANY_EMAIL", spec.Email!, ct);

        await UpsertSettingIfEmptyAsync(tenant.Id, "VAT_PERCENT", "5", ct);
        await UpsertSettingIfEmptyAsync(tenant.Id, "INVOICE_HEADER_STYLE", "BilingualMonochrome", ct);

        if (allowSampleVat && spec.SeedSampleVatTrn)
        {
            var current = await _settings.GetSettingValueAsync(tenant.Id, "COMPANY_TRN");
            if (string.IsNullOrWhiteSpace(current) && string.IsNullOrWhiteSpace(tenant.VatNumber))
            {
                await UpsertSettingIfEmptyAsync(tenant.Id, "COMPANY_TRN", sampleVat, ct);
                tenant.VatNumber = sampleVat;
                _logger.LogWarning("Seeded sample VAT TRN for tenant {TenantId} (replace with real TRN in Settings)", tenant.Id);
            }
            else if (string.IsNullOrWhiteSpace(current) && !string.IsNullOrWhiteSpace(tenant.VatNumber)
                     && SampleVatTrn.IsSample(tenant.VatNumber))
            {
                // Shared-legal create may copy source TRN; align this tenant to its own sample.
                var desired = string.Equals(tenant.VatNumber, sampleVat, StringComparison.Ordinal)
                    ? tenant.VatNumber!
                    : sampleVat;
                await ForceSettingAsync(tenant.Id, "COMPANY_TRN", desired, ct);
                tenant.VatNumber = desired;
            }
            else if (string.IsNullOrWhiteSpace(current))
            {
                // Empty settings row but tenant row already has a value â€” mirror without inventing.
                await UpsertSettingIfEmptyAsync(tenant.Id, "COMPANY_TRN", tenant.VatNumber!.Trim(), ct);
            }
            else if (SampleVatTrn.IsSample(current) && !string.Equals(current, sampleVat, StringComparison.Ordinal))
            {
                // Shared-legal clone left the source sample TRN â€” give this tenant its own fixture.
                await ForceSettingAsync(tenant.Id, "COMPANY_TRN", sampleVat, ct);
                tenant.VatNumber = sampleVat;
                _logger.LogWarning("Realigned sample VAT TRN for tenant {TenantId} to tenant-specific fixture", tenant.Id);
            }
        }
    }

    private async Task UpsertSettingIfEmptyAsync(int tenantId, string key, string value, CancellationToken ct)
    {
        var row = await _db.Settings.FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == key, ct);
        if (row is null)
        {
            _db.Settings.Add(new Setting
            {
                Key = key,
                Value = value,
                OwnerId = tenantId,
                TenantId = tenantId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            return;
        }
        if (string.IsNullOrWhiteSpace(row.Value))
        {
            row.Value = value;
            row.UpdatedAt = DateTime.UtcNow;
        }
    }

    private async Task ForceSettingAsync(int tenantId, string key, string value, CancellationToken ct)
    {
        var row = _db.Settings.Local.FirstOrDefault(s =>
                s.Key == key && (s.TenantId == tenantId || s.OwnerId == tenantId))
            ?? await _db.Settings.FirstOrDefaultAsync(s =>
                s.Key == key && (s.TenantId == tenantId || (s.TenantId == null && s.OwnerId == tenantId)), ct);
        if (row is null)
        {
            _db.Settings.Add(new Setting
            {
                Key = key,
                Value = value,
                OwnerId = tenantId,
                TenantId = tenantId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            return;
        }
        row.Value = value;
        if (row.TenantId is null)
            row.TenantId = tenantId;
        row.UpdatedAt = DateTime.UtcNow;
    }

    private async Task<Tenant?> FindTenantAsync(int? id, string? legacySlug, string? slug, CancellationToken ct)
    {
        // Prefer explicit id, then fall through to slug/legacy so local DBs without
        // production tenant ids (20/22) can still resolve after CreateMissingTenants.
        if (id is > 0)
        {
            var byId = await _db.Tenants.FirstOrDefaultAsync(t => t.Id == id.Value, ct);
            if (byId is not null)
                return byId;
        }
        if (!string.IsNullOrWhiteSpace(slug))
        {
            var bySlug = await _db.Tenants.FirstOrDefaultAsync(t => t.Subdomain.ToLower() == slug.ToLower(), ct);
            if (bySlug is not null)
                return bySlug;
        }
        if (!string.IsNullOrWhiteSpace(legacySlug))
        {
            var byLegacy = await _db.Tenants.FirstOrDefaultAsync(t => t.Subdomain.ToLower() == legacySlug.ToLower(), ct);
            if (byLegacy is not null)
                return byLegacy;
        }
        return null;
    }
}

public sealed class Tier0ProvisioningOptions
{
    public string Domain { get; set; } = "hexabill.company";
    /// <summary>When true (local Development), create FH1/GH/Zayogya if missing. Never in Production.</summary>
    public bool CreateMissingTenants { get; set; }
    public Tier0TenantSpec? FrozenHub1 { get; set; }
    public Tier0TenantSpec? FrozenHub2 { get; set; }
    public Tier0TenantSpec? GulfHarvest { get; set; }
    public Tier0TenantSpec? Zayogya { get; set; }
}

public sealed class Tier0TenantSpec
{
    public int? ExistingTenantId { get; set; }
    public string? Slug { get; set; }
    public string? LegacySlug { get; set; }
    public string? OwnerEmail { get; set; }
    public string? OwnerName { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? CompanyNameEn { get; set; }
    public string? CompanyNameAr { get; set; }
    public string? License { get; set; }
    public string? Address { get; set; }
    public string? CorporateTaxTrn { get; set; }
    public string? OpeningDataChoice { get; set; }
    /// <summary>When true and environment is not Production, seed a synthetic VAT TRN if empty.</summary>
    public bool SeedSampleVatTrn { get; set; }
}
