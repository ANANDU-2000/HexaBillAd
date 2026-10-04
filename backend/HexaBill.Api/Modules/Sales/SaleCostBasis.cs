using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Sales;

public static class SaleCostBasis
{
    public static bool HasSnapshot(SaleItem item) =>
        item.UnitCostAtSale.HasValue && item.ConversionAtSale.HasValue && item.CostCapturedAt.HasValue;

    public static void Capture(SaleItem item, Product product, int tenantId, bool enabled, IEnumerable<SaleItem>? previous = null)
    {
        if (tenantId <= 0 || product.TenantId != tenantId || item.ProductId != product.Id)
            throw new InvalidOperationException("The invoice cost basis must belong to its workspace and product.");

        // A price/contact edit must retain the original cost, even after flag rollback.
        // Duplicate old lines with different cost bases cannot be matched by the legacy request DTO.
        var matches = previous?.Where(p => p.ProductId == item.ProductId &&
            string.Equals(p.UnitType, item.UnitType, StringComparison.OrdinalIgnoreCase)).ToList();
        if (matches?.Count > 0)
        {
            if (matches.Select(p => (p.UnitCostAtSale, p.ConversionAtSale, Saved: HasSnapshot(p))).Distinct().Count() > 1)
                throw new InvalidOperationException("Invoice lines have different saved costs. A line-specific correction is required.");
            var original = matches[0];
            item.UnitCostAtSale = original.UnitCostAtSale;
            item.ConversionAtSale = original.ConversionAtSale;
            item.CostCapturedAt = original.CostCapturedAt;
            return;
        }

        if (!enabled) return;
        if (product.CostPrice < 0 || product.ConversionToBase <= 0)
            throw new InvalidOperationException("Product cost must be nonnegative and its unit conversion must be positive before invoicing.");
        item.UnitCostAtSale = product.CostPrice;
        item.ConversionAtSale = product.ConversionToBase;
        item.CostCapturedAt = DateTime.UtcNow;
    }

    public static decimal Calculate(SaleItem item)
    {
        if (HasSnapshot(item))
        {
            if (item.UnitCostAtSale < 0 || item.ConversionAtSale <= 0)
                throw new InvalidOperationException("The saved invoice cost basis is invalid.");
            return item.Qty * item.ConversionAtSale!.Value * item.UnitCostAtSale!.Value;
        }
        if (item.UnitCostAtSale.HasValue || item.ConversionAtSale.HasValue || item.CostCapturedAt.HasValue)
            throw new InvalidOperationException("The saved invoice cost basis is incomplete.");
        // Compatibility estimate for legacy lines; report consumers must expose its provenance.
        if (item.Product == null) throw new InvalidOperationException("No cost evidence is available for this invoice line.");
        return item.Qty * (item.Product.ConversionToBase > 0 ? item.Product.ConversionToBase : 1) * item.Product.CostPrice;
    }

    public static decimal BaseQuantity(SaleItem item, decimal quantity)
    {
        if (item == null) throw new InvalidOperationException("The original invoice line is unavailable.");
        if (quantity < 0) throw new InvalidOperationException("Stock quantity cannot be negative.");
        var saved = HasSnapshot(item);
        if (!saved && (item.UnitCostAtSale.HasValue || item.ConversionAtSale.HasValue || item.CostCapturedAt.HasValue))
            throw new InvalidOperationException("The saved invoice cost basis is incomplete.");
        var factor = saved ? item.ConversionAtSale!.Value : item.Product?.ConversionToBase;
        if (!factor.HasValue || factor <= 0)
            throw new InvalidOperationException("The invoice unit conversion is unavailable or invalid.");
        return quantity * factor.Value;
    }
}
