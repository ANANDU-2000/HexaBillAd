namespace HexaBill.Api.Modules.Reports;

/// <summary>
/// The one gross-profit rule used by every profit figure (dashboard, P&amp;L, daily, product, branch, route).
/// Gross profit = (Sales excl. VAT - Returns excl. VAT) - COGS.
/// Sales excl. VAT = GrandTotal - VatTotal, i.e. Subtotal - Discount + RoundOff.
/// Output VAT is collected for the FTA; it is never profit (PROFIT-2, 2026-11-03: the FrozenHub dashboard showed
/// 1,562.20 for a day whose gross profit was 771.65, because 790.55 of output VAT was counted as profit).
/// </summary>
public static class ProfitMath
{
    public static decimal SalesExcludingVat(decimal grandTotal, decimal vatTotal) => grandTotal - vatTotal;

    public static decimal GrossProfit(decimal salesGrandTotal, decimal salesVat, decimal returnsGrandTotal, decimal returnsVat, decimal cogs) =>
        SalesExcludingVat(salesGrandTotal, salesVat) - SalesExcludingVat(returnsGrandTotal, returnsVat) - cogs;
}
