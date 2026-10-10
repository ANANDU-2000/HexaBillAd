using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Reports;

/// <summary>
/// Maps the calculated management report to FTA Form 201 box numbering with explicit data-state per box.
/// Missing source data is null with Unavailable completeness, never 0. Mapping is unverified against the
/// live FTA form and every box is PendingAccountantReview (see VAT-IMPLEMENTATION-TRACKER.md).
/// </summary>
public static class Form201ProjectionBuilder
{
    public static List<Form201BoxDto> Build(VatReturn201Dto r)
    {
        var hasActivity = r.TransactionCount > 0;
        return new List<Form201BoxDto>
        {
            Known("1", "Standard-rated supplies (1a-1g total)", r.Box1a, r.Box1b, complete: false, zeroIsVerified: false,
                note: "Emirate split (1a-1g) is not tracked; total only."),
            Unavailable("2", "Supplies to tourists - tax refunds", "Tourist refund source not tracked."),
            Unavailable("3", "Supplies subject to reverse charge", "Sales-side reverse charge is not tracked."),
            Known("4", "Zero-rated supplies", r.Box2, 0m, complete: true, zeroIsVerified: hasActivity),
            Known("5", "Exempt supplies", r.Box3, 0m, complete: true, zeroIsVerified: hasActivity),
            Unavailable("6", "Goods imported into the UAE", "Import declarations are not tracked."),
            Unavailable("7", "Adjustments to goods imported", "Import declarations are not tracked."),
            new Form201BoxDto
            {
                BoxId = "8", Label = "Total supplies and output tax (partial)",
                Amount = r.Box1a + r.Box2 + r.Box3, VatAmount = r.Box1b,
                CalculationState = "Incomplete", SourceCompleteness = "Partial",
                Note = "Excludes boxes 2, 3, 6, 7 (no source data).",
            },
            Known("9", "Standard-rated expenses (recoverable input VAT)", null, r.Box9b, complete: true, zeroIsVerified: hasActivity,
                note: "VAT only; net amounts are in the transaction detail."),
            Known("10", "Supplies subject to reverse charge (purchases)", r.Box4, r.Box10, complete: true, zeroIsVerified: hasActivity),
            Known("11", "Total recoverable input tax after purchase returns", null, r.Box12, complete: true, zeroIsVerified: hasActivity,
                note: $"Box 9 + 10 less {r.Box11:0.00} purchase-return adjustment."),
            Known("12", "Total due tax (output)", null, r.Box1b, complete: false, zeroIsVerified: false,
                note: "Excludes output tax for boxes 3, 6, 7 (no source data)."),
            Known("13", "Total recoverable tax", null, r.Box12, complete: true, zeroIsVerified: hasActivity),
            Known("14", "Payable / (refundable) tax", null, r.Box13a > 0 ? r.Box13a : -r.Box13b, complete: false, zeroIsVerified: false,
                note: "Payable positive, refundable negative. Depends on incomplete output boxes."),
        };
    }

    private static Form201BoxDto Known(string id, string label, decimal? amount, decimal? vat,
        bool complete, bool zeroIsVerified, string? note = null)
    {
        var isZero = (amount ?? 0m) == 0m && (vat ?? 0m) == 0m;
        return new Form201BoxDto
        {
            BoxId = id, Label = label, Amount = amount, VatAmount = vat,
            CalculationState = !isZero ? "Calculated" : (zeroIsVerified && complete ? "VerifiedZero" : "Incomplete"),
            SourceCompleteness = complete ? "Complete" : "Partial",
            Note = note,
        };
    }

    private static Form201BoxDto Unavailable(string id, string label, string note) => new()
    {
        BoxId = id, Label = label, Amount = null, VatAmount = null,
        CalculationState = "NotCalculable", SourceCompleteness = "Unavailable", Note = note,
    };
}
