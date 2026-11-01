using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace HexaBill.Api.Modules.Products;

/// <summary>
/// Pure planning logic for copying product MASTER data (names, units, SKUs) from a source catalogue
/// into another tenant. It never carries stock, prices, costs or any transaction history.
/// Every source row receives exactly one classification; only NEW_PRODUCT rows are proposed for import.
/// Ambiguous rows are REVIEW, never guessed.
/// </summary>
public static partial class CatalogueImportPlanner
{
    public const string DecisionImport = "IMPORT";
    public const string DecisionSkip = "SKIP";
    public const string DecisionReview = "REVIEW";
    public const string DecisionExclude = "EXCLUDE";

    public sealed record SourceProduct(
        string Origin,          // "FH1" (operating) or "STARPLUS" (historical master)
        int SourceId,
        string Sku,
        string NameEn,
        string? NameAr,
        string UnitType,
        decimal ConversionToBase,
        string? Barcode,
        bool IsActive);

    public sealed record DestinationProduct(int Id, string Sku, string NameEn, string UnitType, string? Barcode, bool IsActive);

    public sealed record PlanRow(
        string Origin,
        int SourceId,
        string SourceSku,
        string NameEn,
        string? NameAr,
        string UnitType,
        decimal ConversionToBase,
        string Classification,
        string Decision,
        string? ProposedSku,
        int? MatchedDestinationId,
        string Reason);

    public static string NormalizeName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return string.Empty;
        var s = name.Normalize(NormalizationForm.FormKC)
            .Replace('’', '\'').Replace('‘', '\'').Replace('“', '"').Replace('”', '"')
            .Replace(' ', ' ');
        s = Whitespace().Replace(s.Trim(), " ");
        return s.ToUpperInvariant();
    }

    public static string NormalizeSku(string? sku) => string.IsNullOrWhiteSpace(sku) ? string.Empty : sku.Trim().ToUpperInvariant();

    /// <summary>Unit comparison key only; the stored unit keeps the source spelling.</summary>
    public static string NormalizeUnit(string? unit)
    {
        var u = (unit ?? string.Empty).Trim().ToUpperInvariant();
        return u switch
        {
            "PC" or "PCS" or "PIECE" or "PIECES" or "NOS" => "PCS",
            "CTN" or "CRTN" or "CARTON" or "CARTONS" => "CRTN",
            "KGS" or "KG" or "KILO" => "KG",
            _ => u
        };
    }

    public static bool LooksLikeTestProduct(string? name) => TestName().IsMatch(name ?? string.Empty);

    public static IReadOnlyList<PlanRow> Plan(IEnumerable<SourceProduct> source, IEnumerable<DestinationProduct> destination)
    {
        var dest = destination.ToList();
        var destByName = dest.GroupBy(d => NormalizeName(d.NameEn)).ToDictionary(g => g.Key, g => g.ToList());
        var destBySku = dest.Where(d => NormalizeSku(d.Sku) != string.Empty)
            .GroupBy(d => NormalizeSku(d.Sku)).ToDictionary(g => g.Key, g => g.First());
        var destByBarcode = dest.Where(d => !string.IsNullOrWhiteSpace(d.Barcode))
            .GroupBy(d => d.Barcode!.Trim()).ToDictionary(g => g.Key, g => g.First());

        // Operating FH1 rows first: they are the current master; then historical rows by source id.
        var ordered = source
            .OrderBy(s => s.Origin == "FH1" ? 0 : 1)
            .ThenBy(s => s.SourceId)
            .ToList();

        var rows = new List<PlanRow>(ordered.Count);
        var plannedSkus = new Dictionary<string, string>(); // sku -> normalized name of the planned import
        var plannedBarcodes = new HashSet<string>();

        foreach (var group in ordered.GroupBy(s => NormalizeName(s.NameEn)))
        {
            var members = group.ToList();
            var nameKey = group.Key;
            var units = members.Select(m => NormalizeUnit(m.UnitType)).Distinct().ToList();

            if (nameKey.Length == 0)
            {
                rows.AddRange(members.Select(m => Row(m, "NAME_MISSING", DecisionReview, null, null, "Source product has no English name.")));
                continue;
            }

            if (units.Count > 1)
            {
                var list = string.Join("/", members.Select(m => m.UnitType).Distinct());
                rows.AddRange(members.Select(m => Row(m, "UNIT_CONFLICT", DecisionReview, null, null,
                    $"Same name appears with different units in the source ({list}); choose the correct unit or keep both with distinct names.")));
                continue;
            }

            var lead = members[0];
            foreach (var dup in members.Skip(1))
            {
                rows.Add(Row(dup, "DUPLICATE_IN_SOURCE", DecisionSkip, null, null,
                    $"Same name and unit as {lead.Origin} #{lead.SourceId}; one product master is enough."));
            }

            if (LooksLikeTestProduct(lead.NameEn))
            {
                rows.Add(Row(lead, "TEST_PRODUCT", DecisionExclude, null, null, "Name looks like a test/demo item."));
                continue;
            }

            if (destByName.TryGetValue(nameKey, out var existing))
            {
                var sameUnit = existing.FirstOrDefault(d => NormalizeUnit(d.UnitType) == units[0]);
                rows.Add(sameUnit != null
                    ? Row(lead, "ALREADY_EXISTS", DecisionSkip, null, sameUnit.Id,
                        $"Destination already has this product (#{sameUnit.Id}, {sameUnit.UnitType}); it is left unchanged.")
                    : Row(lead, "UNIT_CONFLICT", DecisionReview, null, existing[0].Id,
                        $"Destination has the same name with unit {existing[0].UnitType}; source unit is {lead.UnitType}."));
                continue;
            }

            // Any source row for this name whose SKU already belongs to a differently named destination
            // product suggests the destination stocks the same item under another name.
            var siblingSkuOwner = members.Skip(1)
                .Select(m => NormalizeSku(m.Sku))
                .Where(s => s.Length > 0 && destBySku.ContainsKey(s))
                .Select(s => destBySku[s])
                .FirstOrDefault();
            if (siblingSkuOwner != null)
            {
                rows.Add(Row(lead, "POSSIBLE_DUPLICATE", DecisionReview, null, siblingSkuOwner.Id,
                    $"Another source row for this name uses SKU {siblingSkuOwner.Sku}, which belongs to destination product #{siblingSkuOwner.Id} \"{siblingSkuOwner.NameEn}\"; it may be the same item."));
                continue;
            }

            if (!lead.IsActive)
            {
                rows.Add(Row(lead, "INACTIVE_SOURCE", DecisionReview, null, null, "Source product is inactive; confirm it is still sold."));
                continue;
            }

            var sku = NormalizeSku(lead.Sku);
            if (sku.Length == 0)
            {
                rows.Add(Row(lead, "SKU_MISSING", DecisionReview, null, null, "Source product has no SKU; assign one before import."));
                continue;
            }
            if (destBySku.TryGetValue(sku, out var skuOwner))
            {
                rows.Add(Row(lead, "SKU_CONFLICT", DecisionReview, null, skuOwner.Id,
                    $"SKU {lead.Sku.Trim()} already belongs to destination product #{skuOwner.Id} \"{skuOwner.NameEn}\"."));
                continue;
            }
            if (plannedSkus.TryGetValue(sku, out var otherName))
            {
                rows.Add(Row(lead, "SKU_CONFLICT", DecisionReview, null, null,
                    $"SKU {lead.Sku.Trim()} is also used by another source product \"{otherName}\"."));
                continue;
            }

            var barcode = string.IsNullOrWhiteSpace(lead.Barcode) ? null : lead.Barcode.Trim();
            if (barcode != null && (destByBarcode.TryGetValue(barcode, out _) || plannedBarcodes.Contains(barcode)))
            {
                rows.Add(Row(lead, "BARCODE_CONFLICT", DecisionReview, null, destByBarcode.GetValueOrDefault(barcode)?.Id,
                    $"Barcode {barcode} is already used."));
                continue;
            }

            plannedSkus[sku] = lead.NameEn.Trim();
            if (barcode != null) plannedBarcodes.Add(barcode);
            rows.Add(Row(lead, "NEW_PRODUCT", DecisionImport, lead.Sku.Trim(), null,
                "New product master: name, unit and SKU only; stock 0, no price, inactive until priced."));
        }

        return rows;
    }

    private static PlanRow Row(SourceProduct s, string classification, string decision, string? proposedSku, int? matched, string reason) =>
        new(s.Origin, s.SourceId, s.Sku, s.NameEn.Trim(), string.IsNullOrWhiteSpace(s.NameAr) ? null : s.NameAr.Trim(),
            s.UnitType.Trim(), s.ConversionToBase <= 0 ? 1 : s.ConversionToBase, classification, decision, proposedSku, matched, reason);

    // ---- CSV (RFC 4180) ----

    public static readonly string[] CsvHeader =
    {
        "Origin", "SourceId", "SourceSku", "NameEn", "NameAr", "UnitType", "ConversionToBase",
        "Classification", "Decision", "ProposedSku", "MatchedDestinationId", "Reason"
    };

    public static string ToCsv(IEnumerable<PlanRow> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(",", CsvHeader));
        foreach (var r in rows)
        {
            sb.AppendLine(string.Join(",", new[]
            {
                r.Origin, r.SourceId.ToString(CultureInfo.InvariantCulture), r.SourceSku, r.NameEn, r.NameAr ?? string.Empty,
                r.UnitType, r.ConversionToBase.ToString(CultureInfo.InvariantCulture), r.Classification, r.Decision,
                r.ProposedSku ?? string.Empty, r.MatchedDestinationId?.ToString(CultureInfo.InvariantCulture) ?? string.Empty, r.Reason
            }.Select(Escape)));
        }
        return sb.ToString();
    }

    public static IReadOnlyList<PlanRow> FromCsv(string csv)
    {
        var records = ParseCsv(csv);
        if (records.Count == 0 || !records[0].SequenceEqual(CsvHeader))
            throw new InvalidDataException("Manifest header does not match the expected catalogue import columns.");
        return records.Skip(1).Where(r => r.Count > 1 || (r.Count == 1 && r[0].Length > 0)).Select(raw =>
        {
            var r = raw.Select(Unescape).ToList();
            if (r.Count != CsvHeader.Length) throw new InvalidDataException($"Manifest row has {r.Count} columns, expected {CsvHeader.Length}.");
            return new PlanRow(r[0], int.Parse(r[1], CultureInfo.InvariantCulture), r[2], r[3], r[4].Length == 0 ? null : r[4], r[5],
                decimal.Parse(r[6], CultureInfo.InvariantCulture), r[7], r[8].Trim().ToUpperInvariant(), r[9].Length == 0 ? null : r[9],
                r[10].Length == 0 ? null : int.Parse(r[10], CultureInfo.InvariantCulture), r[11]);
        }).ToList();
    }

    private static string Escape(string value)
    {
        // Neutralise spreadsheet formula injection, then quote when needed.
        if (value.Length > 0 && "=+-@".Contains(value[0]) && !decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out _))
            value = "'" + value;
        return value.IndexOfAny(new[] { ',', '"', '\r', '\n' }) >= 0 ? "\"" + value.Replace("\"", "\"\"") + "\"" : value;
    }

    private static string Unescape(string value) =>
        value.Length > 1 && value[0] == '\'' &&"=+-@".Contains(value[1]) ? value[1..] : value;

    private static List<List<string>> ParseCsv(string text)
    {
        var rows = new List<List<string>>();
        var row = new List<string>();
        var field = new StringBuilder();
        var quoted = false;
        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (quoted)
            {
                if (c == '"' && i + 1 < text.Length && text[i + 1] == '"') { field.Append('"'); i++; }
                else if (c == '"') quoted = false;
                else field.Append(c);
                continue;
            }
            switch (c)
            {
                case '"': quoted = true; break;
                case ',': row.Add(field.ToString()); field.Clear(); break;
                case '\r': break;
                case '\n': row.Add(field.ToString()); field.Clear(); rows.Add(row); row = new List<string>(); break;
                default: field.Append(c); break;
            }
        }
        if (field.Length > 0 || row.Count > 0) { row.Add(field.ToString()); rows.Add(row); }
        return rows;
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex(@"(^ZZ-|\bTEST\b|\bE2E\b|\bDUMMY\b|\bSAMPLE\b|\bDEMO\b)", RegexOptions.IgnoreCase)]
    private static partial Regex TestName();
}
