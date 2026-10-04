using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Purchases;

public static class PurchaseCostBasis
{
    public static bool HasSnapshot(PurchaseItem item) =>
        item.CostCapturedAt.HasValue && item.ConversionAtPurchase.HasValue;

    public static void Capture(PurchaseItem item, Product product, int tenantId, bool enabled, IEnumerable<PurchaseItem>? previous = null)
    {
        if (tenantId <= 0 || product.TenantId != tenantId || item.ProductId != product.Id)
            throw new InvalidOperationException("The purchase cost basis must belong to its workspace and product.");

        var matches = previous?.Where(p => p.ProductId == item.ProductId &&
            string.Equals(p.UnitType, item.UnitType, StringComparison.OrdinalIgnoreCase)).ToList();
        if (matches?.Count > 0)
        {
            if (matches.Select(p => (p.UnitCost, p.UnitCostExclVat, p.VatAmount, p.ConversionAtPurchase, Saved: HasSnapshot(p))).Distinct().Count() > 1)
                throw new InvalidOperationException("Purchase lines have different saved costs. A line-specific correction is required.");
            var original = matches[0];
            item.UnitCost = original.UnitCost;
            item.UnitCostExclVat = original.UnitCostExclVat;
            item.VatAmount = original.VatAmount;
            item.ConversionAtPurchase = original.ConversionAtPurchase;
            item.CostCapturedAt = original.CostCapturedAt;
            return;
        }

        if (!enabled)
            return;

        if (product.ConversionToBase <= 0)
            throw new InvalidOperationException("Product unit conversion must be positive before posting a purchase.");
        item.ConversionAtPurchase = product.ConversionToBase;
        item.CostCapturedAt = DateTime.UtcNow;
    }

    public static decimal? CostPerBaseUnitExclVat(PurchaseItem item, Product? product, decimal unitCostExclVat)
    {
        if (unitCostExclVat <= 0)
            return null;
        var factor = item.ConversionAtPurchase ?? product?.ConversionToBase;
        if (!factor.HasValue || factor <= 0)
            return null;
        return unitCostExclVat / factor.Value;
    }
}
