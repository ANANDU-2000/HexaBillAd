using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Sales;

/// <summary>
/// Single place for payment-line cleared vs pending rules and sale payment state from cleared totals only.
/// All sale invoice settlement (API, reports, ledgers) should use <see cref="SettlementToleranceAed"/> for "fully paid" vs rounding drift.
/// </summary>
internal static class SalePaymentHelpers
{
    /// <summary>Max AED shortfall between GrandTotal and cleared sum to still treat invoice as fully paid (VAT/rounding).</summary>
    internal const decimal SettlementToleranceAed = 0.05m;

    /// <summary>Max explicit settlement adjustment per invoice payment when flag is on (not tolerance auto-fill).</summary>
    internal const decimal MaxExplicitSettlementAdjustmentAed = 50m;

    public static PaymentStatus GetPaymentLineStatus(PaymentMode mode)
    {
        return mode == PaymentMode.CHEQUE
            ? PaymentStatus.PENDING
            : (mode == PaymentMode.CASH || mode == PaymentMode.ONLINE || mode == PaymentMode.DEBIT
                ? PaymentStatus.CLEARED
                : PaymentStatus.PENDING);
    }

    public static bool IsClearedMode(PaymentMode mode) => GetPaymentLineStatus(mode) == PaymentStatus.CLEARED;

    /// <summary>
    /// Derives sale PaidAmount and PaymentStatus from the sum of cleared payment lines only.
    /// </summary>
    public static (decimal PaidAmount, SalePaymentStatus Status, DateTime? LastPaymentDate) ComputeSalePaymentStateFromClearedTotal(
        decimal clearedSumTotal,
        decimal grandTotal,
        DateTime? lastClearedPaymentDate) =>
        ComputeSalePaymentStateFromClearedAndAdjustments(clearedSumTotal, 0m, grandTotal, lastClearedPaymentDate);

    public static (decimal PaidAmount, SalePaymentStatus Status, DateTime? LastPaymentDate) ComputeSalePaymentStateFromClearedAndAdjustments(
        decimal clearedCashTotal,
        decimal clearedAdjustmentTotal,
        decimal grandTotal,
        DateTime? lastClearedPaymentDate)
    {
        clearedCashTotal = Math.Round(clearedCashTotal, 2, MidpointRounding.AwayFromZero);
        clearedAdjustmentTotal = Math.Round(clearedAdjustmentTotal, 2, MidpointRounding.AwayFromZero);
        grandTotal = Math.Round(grandTotal, 2, MidpointRounding.AwayFromZero);

        if (grandTotal <= 0)
            return (0, SalePaymentStatus.Paid, lastClearedPaymentDate);

        var applied = clearedCashTotal + clearedAdjustmentTotal;

        if (clearedAdjustmentTotal > 0)
        {
            if (applied >= grandTotal)
                return (grandTotal, SalePaymentStatus.Paid, lastClearedPaymentDate);
            if (applied > 0)
                return (applied, SalePaymentStatus.Partial, lastClearedPaymentDate);
            return (0, SalePaymentStatus.Pending, null);
        }

        var shortfall = grandTotal - clearedCashTotal;
        if (shortfall <= SettlementToleranceAed)
            return (grandTotal, SalePaymentStatus.Paid, lastClearedPaymentDate);

        var paidAmount = Math.Min(clearedCashTotal, grandTotal);
        if (clearedCashTotal >= grandTotal)
            return (paidAmount, SalePaymentStatus.Paid, lastClearedPaymentDate);
        if (paidAmount > 0)
            return (paidAmount, SalePaymentStatus.Partial, lastClearedPaymentDate);
        return (0, SalePaymentStatus.Pending, null);
    }

    /// <summary>Compare last payment instants for reconcile (ignore sub-second noise).</summary>
    public static bool LastPaymentDatesMatch(DateTime? a, DateTime? b)
    {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return Math.Abs((a.Value - b.Value).TotalSeconds) < 1.5;
    }
}
