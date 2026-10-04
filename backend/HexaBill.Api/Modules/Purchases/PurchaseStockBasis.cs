using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Purchases;

public static class PurchaseStockBasis
{
    public static decimal BaseQuantity(PurchaseItem line, Product? product, decimal quantity)
    {
        if (line == null) throw new InvalidOperationException("The original purchase line is unavailable.");
        if (quantity < 0) throw new InvalidOperationException("Stock quantity cannot be negative.");
        var factor = line.ConversionAtPurchase ?? product?.ConversionToBase;
        if (!factor.HasValue || factor <= 0)
            throw new InvalidOperationException("The purchase unit conversion is unavailable or invalid.");
        return quantity * factor.Value;
    }
}
