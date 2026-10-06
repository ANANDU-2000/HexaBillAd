namespace HexaBill.Api.Core.Tenancy;

/// <summary>
/// Synthetic VAT TRNs for local fixtures. Never print a sample as a real Tax Invoice TRN.
/// Document rules (APPROVED 2026-10-05):
/// - empty TRN → print "INVOICE", omit TRN, owner banner "VAT TRN missing"
/// - sample TRN kept → print "SAMPLE INVOICE"; never "TAX INVOICE" alone
/// - real 15-digit non-sample → TAX INVOICE
/// Zayogya is not auto-seeded with samples.
/// </summary>
public static class SampleVatTrn
{
    public const string FrozenHub1 = "900000000000001";
    public const string FrozenHub2 = "900000000000002";
    public const string GulfHarvest = "900000000000003";
    public const string UnitFixture = "123456789012345";

    private static readonly HashSet<string> HexaBillSamples = new(StringComparer.Ordinal)
    {
        FrozenHub1,
        FrozenHub2,
        GulfHarvest,
        UnitFixture,
        "543210987654321"
    };

    public static bool IsSample(string? vatTrn) =>
        !string.IsNullOrEmpty(vatTrn) && HexaBillSamples.Contains(vatTrn);

    public static bool IsProductionEnvironment(string? environmentName) =>
        string.Equals(environmentName, "Production", StringComparison.OrdinalIgnoreCase);

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

    public static bool IsRealVatTrn(string? vatTrn) =>
        !string.IsNullOrEmpty(vatTrn)
        && vatTrn.Length == 15
        && vatTrn.All(c => c is >= '0' and <= '9')
        && !IsSample(vatTrn);

    public static bool IsMissingOrSample(string? vatTrn) =>
        string.IsNullOrWhiteSpace(vatTrn) || IsSample(vatTrn);

    /// <summary>Document title for PDF/print. Never "TAX INVOICE" for empty or sample TRNs.</summary>
    public static string DocumentTitle(string? vatTrn)
    {
        if (IsRealVatTrn(vatTrn)) return "TAX INVOICE";
        if (IsSample(vatTrn)) return "SAMPLE INVOICE";
        return "INVOICE";
    }

    /// <summary>TRN line for documents. Empty when missing; SAMPLE-prefixed when sample.</summary>
    public static string? DocumentTrnDisplay(string? vatTrn)
    {
        if (string.IsNullOrWhiteSpace(vatTrn)) return null;
        if (IsSample(vatTrn)) return $"SAMPLE {vatTrn}";
        if (vatTrn.Length == 15 && vatTrn.All(c => c is >= '0' and <= '9')) return vatTrn;
        return null;
    }

    /// <summary>
    /// Legacy gate for callers that still require a real TRN before Tax Invoice finalize.
    /// Empty and samples fail (they must use Invoice / SAMPLE INVOICE path instead).
    /// </summary>
    public static void RequireTaxInvoiceVatTrn(string? vatTrn, string? environmentName = null)
    {
        _ = environmentName;
        if (!IsRealVatTrn(vatTrn))
        {
            if (IsSample(vatTrn))
                throw new Models.TaxInvoiceSettingsException(
                    "Sample VAT TRNs cannot be used on Tax Invoices. The document will print as SAMPLE INVOICE, or enter the real VAT TRN in Settings.");
            throw new Models.TaxInvoiceSettingsException(
                "Add a valid 15-digit VAT TRN in Settings before finalizing or printing a Tax Invoice.");
        }
    }
}
