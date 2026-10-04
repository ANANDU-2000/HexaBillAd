using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.Reports;

internal static class VatBasisResolver
{
    /// <summary>
    /// Resolves VAT profit-form basis for a reporting instant. When <see cref="TenantFeatureFlags.VatBasisEffectiveDating"/>
    /// is enabled, uses the latest history row with EffectiveFrom &lt;= asOfUtc; otherwise uses the tenant column only.
    /// </summary>
    public static async Task<VatCalculationBasis> ResolveProfitBasisAsync(
        AppDbContext context,
        int tenantId,
        DateTime asOfUtc,
        CancellationToken cancellationToken = default)
    {
        var tenantRow = await context.Tenants.AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => new { t.VatCalculationBasis, t.FeaturesJson })
            .FirstOrDefaultAsync(cancellationToken);

        if (tenantRow == null)
            return VatCalculationBasis.SalesBased;

        if (!TenantFeatureFlags.IsEnabled(tenantRow.FeaturesJson, TenantFeatureFlags.VatBasisEffectiveDating))
            return tenantRow.VatCalculationBasis;

        var fromHistory = await context.TenantVatBasisHistory.AsNoTracking()
            .Where(h => h.TenantId == tenantId && h.EffectiveFrom <= asOfUtc)
            .OrderByDescending(h => h.EffectiveFrom)
            .ThenByDescending(h => h.Id)
            .Select(h => (VatCalculationBasis?)h.Basis)
            .FirstOrDefaultAsync(cancellationToken);

        return fromHistory ?? tenantRow.VatCalculationBasis;
    }

    /// <summary>Persists tenant column + immutable history when basis changes (super-admin / accountant activation).</summary>
    public static async Task<bool> ApplyTenantBasisChangeAsync(
        AppDbContext context,
        Tenant tenant,
        VatCalculationBasis newBasis,
        DateTime effectiveFromUtc,
        int setByUserId,
        CancellationToken cancellationToken = default)
    {
        if (tenant.VatCalculationBasis == newBasis)
            return false;

        if (effectiveFromUtc.Kind == DateTimeKind.Unspecified)
            effectiveFromUtc = DateTime.SpecifyKind(effectiveFromUtc, DateTimeKind.Utc);
        else if (effectiveFromUtc.Kind == DateTimeKind.Local)
            effectiveFromUtc = effectiveFromUtc.ToUniversalTime();

        var now = DateTime.UtcNow;
        tenant.VatCalculationBasis = newBasis;
        context.TenantVatBasisHistory.Add(new TenantVatBasisHistory
        {
            TenantId = tenant.Id,
            Basis = newBasis,
            EffectiveFrom = effectiveFromUtc,
            SetByUserId = setByUserId,
            CreatedAt = now
        });
        await context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public static bool TryParseBasis(string? value, out VatCalculationBasis basis)
    {
        basis = VatCalculationBasis.SalesBased;
        return !string.IsNullOrWhiteSpace(value)
            && Enum.TryParse(value.Trim(), ignoreCase: true, out basis);
    }
}
