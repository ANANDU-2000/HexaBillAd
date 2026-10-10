using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.Reports;

/// <summary>
/// Tenant-configured VAT filing periods (Monthly, or Quarterly anchored on the first month of a quarter).
/// Calendar quarters/years remain available as analysis ranges but are not filing periods unless configured.
/// </summary>
public sealed record VatTaxPeriodConfig(string Frequency, int AnchorMonth, bool Configured)
{
    public const string FrequencyKey = "VAT_PERIOD_FREQUENCY";
    public const string AnchorMonthKey = "VAT_PERIOD_ANCHOR_MONTH";

    public static VatTaxPeriodConfig Unconfigured => new("Quarterly", 2, false);

    public static async Task<VatTaxPeriodConfig> LoadAsync(AppDbContext context, int tenantId)
    {
        var rows = await context.Settings
            .Where(s => s.TenantId == tenantId && (s.Key == FrequencyKey || s.Key == AnchorMonthKey))
            .Select(s => new { s.Key, s.Value })
            .ToListAsync();
        var frequency = rows.FirstOrDefault(r => r.Key == FrequencyKey)?.Value;
        var anchorText = rows.FirstOrDefault(r => r.Key == AnchorMonthKey)?.Value;
        if (!TryValidate(frequency, anchorText, out var cfg, out _)) return Unconfigured;
        return cfg;
    }

    public static bool TryValidate(string? frequency, string? anchorMonth, out VatTaxPeriodConfig config, out string error)
    {
        config = Unconfigured;
        error = string.Empty;
        var freq = frequency?.Trim();
        if (!string.Equals(freq, "Monthly", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(freq, "Quarterly", StringComparison.OrdinalIgnoreCase))
        {
            error = "Frequency must be Monthly or Quarterly.";
            return false;
        }
        var monthly = string.Equals(freq, "Monthly", StringComparison.OrdinalIgnoreCase);
        var anchor = 1;
        if (!monthly && (!int.TryParse(anchorMonth, out anchor) || anchor < 1 || anchor > 12))
        {
            error = "Anchor month must be 1-12 (the first month of the tenant's VAT quarter).";
            return false;
        }
        config = new VatTaxPeriodConfig(monthly ? "Monthly" : "Quarterly", monthly ? 1 : anchor, true);
        return true;
    }

    /// <summary>Inclusive filing period containing <paramref name="date"/>.</summary>
    public (DateTime Start, DateTime End) PeriodContaining(DateTime date)
    {
        var d = date.Date;
        if (Frequency == "Monthly")
        {
            var start = new DateTime(d.Year, d.Month, 1);
            return (start, start.AddMonths(1).AddDays(-1));
        }
        var monthsSinceAnchor = ((d.Month - AnchorMonth) % 12 + 12) % 12;
        var quarterStartMonth = d.AddMonths(-(monthsSinceAnchor % 3));
        var qStart = new DateTime(quarterStartMonth.Year, quarterStartMonth.Month, 1);
        return (qStart, qStart.AddMonths(3).AddDays(-1));
    }

    public bool IsFilingPeriod(DateTime from, DateTime to)
    {
        if (!Configured) return false;
        var (s, e) = PeriodContaining(from);
        return s == from.Date && e == to.Date;
    }
}
