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
    private readonly IConfiguration _config;
    private readonly IHostEnvironment _env;
    private readonly ILogger<Tier0TenantProvisioning> _logger;

    public Tier0TenantProvisioning(
        AppDbContext db,
        ISettingsService settings,
        IConfiguration config,
        IHostEnvironment env,
        ILogger<Tier0TenantProvisioning> logger)
    {
        _db = db;
        _settings = settings;
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
        return log;
    }

    private async Task<string> EnsureFrozenHubOwner1Async(Tier0ProvisioningOptions options, CancellationToken ct)
    {
        var spec = options.FrozenHub1!;
        var tenant = await FindTenantAsync(spec.ExistingTenantId, spec.LegacySlug, spec.Slug, ct);
        if (tenant is null)
            throw new InvalidOperationException(
                $"FrozenHub owner 1 tenant was not found (id={spec.ExistingTenantId}, slug={spec.LegacySlug}/{spec.Slug}). Create/map it before re-running.");

        // Host migration: legacy slug → canonical slug; keep legacy as redirect alias setting.
        if (!string.IsNullOrWhiteSpace(spec.LegacySlug) &&
            string.Equals(tenant.Subdomain, spec.LegacySlug, StringComparison.OrdinalIgnoreCase) &&
            !string.IsNullOrWhiteSpace(spec.Slug) &&
            !string.Equals(spec.Slug, spec.LegacySlug, StringComparison.OrdinalIgnoreCase))
        {
            var slugTaken = await _db.Tenants.AnyAsync(t => t.Id != tenant.Id && t.Subdomain.ToLower() == spec.Slug!.ToLower(), ct);
            if (slugTaken)
                throw new InvalidOperationException($"Cannot rename FrozenHub to '{spec.Slug}' — subdomain already in use.");
            var old = tenant.Subdomain;
            tenant.Subdomain = spec.Slug!;
            await UpsertSettingIfEmptyAsync(tenant.Id, "LEGACY_SUBDOMAIN", spec.LegacySlug!, ct);
            await UpsertSettingIfEmptyAsync(tenant.Id, "CANONICAL_HOST", $"{spec.Slug}.{options.Domain}", ct);
            _logger.LogInformation("FrozenHub owner 1 subdomain {Old} → {New}; LEGACY_SUBDOMAIN redirect recorded", old, spec.Slug);
        }
        else if (!string.IsNullOrWhiteSpace(spec.LegacySlug))
        {
            await UpsertSettingIfEmptyAsync(tenant.Id, "LEGACY_SUBDOMAIN", spec.LegacySlug!, ct);
        }

        await ApplyVerifiedIdentityAsync(tenant, spec, allowSampleVat: !_env.IsProduction(), sampleVat: SampleVatTrn.FrozenHub1, ct);
        await _db.SaveChangesAsync(ct);
        return $"frozenhub1 tenantId={tenant.Id} slug={tenant.Subdomain}";
    }

    private async Task<string> EnsureFrozenHubOwner2Async(Tier0ProvisioningOptions options, CancellationToken ct)
    {
        var spec = options.FrozenHub2!;
        if (string.IsNullOrWhiteSpace(spec.OpeningDataChoice))
            throw new InvalidOperationException("FrozenHub owner 2 requires an explicit OpeningDataChoice before provisioning completes.");

        var existing = await FindTenantAsync(null, null, spec.Slug, ct);
        if (existing is not null)
        {
            // Idempotent: never reset credentials or overwrite established settings.
            await UpsertSettingIfEmptyAsync(existing.Id, "OPENING_DATA_CHOICE", spec.OpeningDataChoice!, ct);
            await _db.SaveChangesAsync(ct);
            return $"frozenhub2 already exists tenantId={existing.Id} slug={existing.Subdomain} (settings preserved)";
        }

        var owner1 = await FindTenantAsync(options.FrozenHub1?.ExistingTenantId, options.FrozenHub1?.LegacySlug, options.FrozenHub1?.Slug, ct)
            ?? throw new InvalidOperationException("FrozenHub owner 1 must exist before creating owner 2.");

        if (string.IsNullOrWhiteSpace(spec.OwnerEmail) || string.IsNullOrWhiteSpace(spec.OwnerName) || string.IsNullOrWhiteSpace(spec.Phone))
            throw new InvalidOperationException("FrozenHub owner 2 requires OwnerEmail, OwnerName and Phone in configuration.");

        // Create via existing platform path semantics without inventing passwords in config.
        // This method only prepares identity settings once the tenant row exists through SuperAdmin CreateTenant.
        throw new InvalidOperationException(
            "FrozenHub owner 2 tenant does not exist yet. Create it once via SuperAdmin with " +
            $"Subdomain='{spec.Slug}', SharedLegalIdentityFromTenantId={owner1.Id}, OpeningDataChoice='{spec.OpeningDataChoice}', " +
            "ConfirmSharedLegalIdentity=true, then re-run Tier0 provisioning to fill empty verified fields without overwrite.");
    }

    private async Task<string> EnsureGulfHarvestAsync(Tier0ProvisioningOptions options, CancellationToken ct)
    {
        var spec = options.GulfHarvest!;
        var tenant = await FindTenantAsync(spec.ExistingTenantId, null, spec.Slug, ct);
        if (tenant is null)
            throw new InvalidOperationException(
                $"GulfHarvest tenant was not found (id={spec.ExistingTenantId}, slug={spec.Slug}).");

        await ApplyVerifiedIdentityAsync(tenant, spec, allowSampleVat: !_env.IsProduction(), sampleVat: SampleVatTrn.GulfHarvest, ct);
        // Corporate tax TRN from certificate — never written into VAT field.
        if (!string.IsNullOrWhiteSpace(spec.CorporateTaxTrn))
            await UpsertSettingIfEmptyAsync(tenant.Id, "CORPORATE_TAX_TRN", spec.CorporateTaxTrn!.Trim(), ct);
        await _db.SaveChangesAsync(ct);
        return $"gulfharvest tenantId={tenant.Id} slug={tenant.Subdomain}";
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

        // VAT TRN: never invent. Optionally seed sample in non-Production only when explicitly requested.
        if (allowSampleVat && spec.SeedSampleVatTrn && string.IsNullOrWhiteSpace(tenant.VatNumber))
        {
            var current = await _settings.GetSettingValueAsync(tenant.Id, "COMPANY_TRN");
            if (string.IsNullOrWhiteSpace(current))
            {
                await UpsertSettingIfEmptyAsync(tenant.Id, "COMPANY_TRN", sampleVat, ct);
                _logger.LogWarning("Seeded sample VAT TRN for tenant {TenantId} (non-Production only)", tenant.Id);
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

    private Task<Tenant?> FindTenantAsync(int? id, string? legacySlug, string? slug, CancellationToken ct)
    {
        if (id is > 0)
            return _db.Tenants.FirstOrDefaultAsync(t => t.Id == id.Value, ct);
        if (!string.IsNullOrWhiteSpace(slug))
            return _db.Tenants.FirstOrDefaultAsync(t => t.Subdomain.ToLower() == slug.ToLower(), ct);
        if (!string.IsNullOrWhiteSpace(legacySlug))
            return _db.Tenants.FirstOrDefaultAsync(t => t.Subdomain.ToLower() == legacySlug.ToLower(), ct);
        return Task.FromResult<Tenant?>(null);
    }
}

public sealed class Tier0ProvisioningOptions
{
    public string Domain { get; set; } = "hexabill.company";
    public Tier0TenantSpec? FrozenHub1 { get; set; }
    public Tier0TenantSpec? FrozenHub2 { get; set; }
    public Tier0TenantSpec? GulfHarvest { get; set; }
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
