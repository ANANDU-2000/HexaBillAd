namespace HexaBill.Api.Core.Tenancy;

/// <summary>
/// Synthetic VAT TRNs for FrozenHub1/2 and GulfHarvest until clients enter real numbers.
/// Crystal Freeze TRN is a real third-party number and is never allowed as a HexaBill default.
/// Zayogya is excluded from sample seeding (tax/print unchanged).
/// </summary>
public static class SampleVatTrn
{
    /// <summary>FrozenHub owner 1 fixture.</summary>
    public const string FrozenHub1 = "900000000000001";

    /// <summary>FrozenHub owner 2 fixture.</summary>
    public const string FrozenHub2 = "900000000000002";

    /// <summary>GulfHarvest fixture.</summary>
    public const string GulfHarvest = "900000000000003";

    /// <summary>Generic unit-test fixture (also used by DocumentHeaderTests).</summary>
    public const string UnitFixture = "123456789012345";

    /// <summary>Crystal Freeze reference TRN — layout sample only, never a HexaBill default/fixture.</summary>
    public const string CrystalFreezeForbidden = "104825619000003";

    private static readonly HashSet<string> HexaBillSamples = new(StringComparer.Ordinal)
    {
        FrozenHub1,
        FrozenHub2,
        GulfHarvest,
        UnitFixture,
        "543210987654321"
    };

    private static readonly HashSet<string> AlwaysForbidden = new(StringComparer.Ordinal)
    {
        CrystalFreezeForbidden
    };

    public static bool IsSample(string? vatTrn) =>
        !string.IsNullOrEmpty(vatTrn) && HexaBillSamples.Contains(vatTrn);

    public static bool IsProductionEnvironment(string? environmentName) =>
        string.Equals(environmentName, "Production", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Maps a tenant subdomain/slug to its dedicated sample TRN. Returns null for Zayogya and unknown tenants.
    /// </summary>
    public static string? SampleForSlug(string? slug)
    {
        if (string.IsNullOrWhiteSpace(slug)) return null;
        var s = slug.Trim().ToLowerInvariant();
        if (s is "zayoga" or "zayogya" or "zayogya-test") return null;
        if (s is "frozenhub1" or "frozenhub") return FrozenHub1;
        if (s == "frozenhub2") return FrozenHub2;
        if (s is "gulfharvest" or "gulfhub") return GulfHarvest;
        return null;
    }

    /// <summary>
    /// Validates a VAT TRN for Tax Invoice finalization/printing.
    /// Empty/invalid always fail. HexaBill samples are allowed in all environments (clients update later).
    /// Crystal Freeze and other third-party reference TRNs are always rejected.
    /// </summary>
    public static void RequireTaxInvoiceVatTrn(string? vatTrn, string? environmentName = null)
    {
        _ = environmentName; // retained for call-site compatibility; samples are no longer env-gated

        if (string.IsNullOrEmpty(vatTrn) || vatTrn.Length != 15 || vatTrn.Any(c => c < '0' || c > '9'))
            throw new Models.TaxInvoiceSettingsException(
                "Add a valid 15-digit VAT TRN in Settings before finalizing or printing a Tax Invoice.");

        if (AlwaysForbidden.Contains(vatTrn))
            throw new Models.TaxInvoiceSettingsException(
                "This VAT TRN is reserved as a layout reference and cannot be used on Tax Invoices. Enter the client's real VAT TRN in Settings.");
    }
}
