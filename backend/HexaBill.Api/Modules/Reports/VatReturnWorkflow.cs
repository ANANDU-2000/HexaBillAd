using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Reports;

/// <summary>Legal VAT management-period transitions and the stale-calculation fingerprint.</summary>
public static class VatReturnWorkflow
{
    private static readonly Dictionary<string, string[]> Transitions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Draft"] = new[] { "Calculated" },
        ["Calculated"] = new[] { "Calculated", "Reviewed" },
        ["Reviewed"] = new[] { "Calculated", "Locked" },
        ["Locked"] = new[] { "Submitted", "Amended" },
        ["Submitted"] = new[] { "Amended" },
        // Amend re-opens the period as Calculated; "Amended" is kept as a legacy value only.
        ["Amended"] = new[] { "Calculated" },
    };

    public static bool CanTransition(string from, string to) =>
        Transitions.TryGetValue(from ?? "", out var allowed) && allowed.Contains(to, StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// SHA-256 over the full calculated report (boxes, every source line, warnings) excluding
    /// volatile fields, so any change to a source transaction changes the fingerprint.
    /// </summary>
    public static string Fingerprint(VatReturn201Dto report)
    {
        var copy = JsonSerializer.Deserialize<VatReturn201Dto>(JsonSerializer.Serialize(report))!;
        copy.Status = string.Empty;
        copy.PeriodId = null;
        copy.CalculatedAt = null;
        copy.SnapshotAt = null;
        copy.SnapshotVersion = 0;
        copy.ValidationIssues = new();
        // Company identity and TRN status are filing metadata, not source transactions.
        copy.CompanyName = copy.CompanyNameAr = copy.VatTrn = copy.TrnStatus = copy.Address = copy.Phone = null;
        copy.CanFreezeVatReport = false;
        copy.Warnings = new();
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(copy))));
    }

    /// <summary>Clears review state after the underlying data changed or the period was recalculated.</summary>
    public static void InvalidateReview(VatReturnPeriod period, string reason)
    {
        if (period.ReviewedAt != null)
        {
            period.ReviewInvalidatedAt = DateTime.UtcNow;
            period.ReviewInvalidatedReason = reason;
        }
        period.ReviewedAt = null;
        period.ReviewedByUserId = null;
        period.ReviewedCalculationVersion = null;
    }
}
