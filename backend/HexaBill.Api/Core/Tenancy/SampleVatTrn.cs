namespace HexaBill.Api.Core.Tenancy;

/// <summary>
/// Synthetic VAT TRNs for local/test/staging fixtures only.
/// Never use real third-party TRNs (e.g. Crystal Freeze) and never allow these in Production Tax Invoices.
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

    private static readonly HashSet<string> ForbiddenInProduction = new(StringComparer.Ordinal)
    {
        FrozenHub1,
        FrozenHub2,
        GulfHarvest,
        UnitFixture,
        "543210987654321",
        // Crystal Freeze reference TRN — layout sample only, never a HexaBill default/fixture.
        "104825619000003"
    };

    public static bool IsSample(string? vatTrn) =>
        !string.IsNullOrEmpty(vatTrn) && ForbiddenInProduction.Contains(vatTrn);

    public static bool IsProductionEnvironment(string? environmentName) =>
        string.Equals(environmentName, "Production", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Validates a VAT TRN for Tax Invoice finalization/printing.
    /// Empty/invalid always fail. Sample values fail in Production.
    /// </summary>
    public static void RequireTaxInvoiceVatTrn(string? vatTrn, string? environmentName = null)
    {
        if (string.IsNullOrEmpty(vatTrn) || vatTrn.Length != 15 || vatTrn.Any(c => c < '0' || c > '9'))
            throw new Models.TaxInvoiceSettingsException(
                "Add a valid 15-digit VAT TRN in Settings before finalizing or printing a Tax Invoice.");

        if (IsProductionEnvironment(environmentName) && IsSample(vatTrn))
            throw new Models.TaxInvoiceSettingsException(
                "Sample VAT TRNs cannot be used on Tax Invoices in Production. Enter the client's real VAT TRN in Settings.");
    }
}
