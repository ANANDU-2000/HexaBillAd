using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.Sales;

/// <summary>
/// Server-side guard against accidental sales of catalogue-only products:
/// - a normal (non zero-invoice) line must carry a positive unit price;
/// - a product that is inactive cannot be newly added to a sale.
/// Products imported as catalogue entries are created inactive with no price, so they can be
/// searched and edited in Products but cannot reach an invoice until someone prices and activates them.
/// Lines already on an invoice being edited keep their product even if it was deactivated later.
/// </summary>
internal static class SaleLineSellability
{
    internal readonly record struct ProductState(string Name, bool IsActive);

    internal static List<string> Check(
        IEnumerable<SaleItemRequest> items,
        IReadOnlyDictionary<int, ProductState> products,
        bool isZeroInvoice,
        IReadOnlySet<int>? productsAlreadyOnSale = null)
    {
        var errors = new List<string>();
        foreach (var item in items)
        {
            if (!products.TryGetValue(item.ProductId, out var product))
            {
                errors.Add($"Product with ID {item.ProductId} not found for your account.");
                continue;
            }

            var alreadyOnSale = productsAlreadyOnSale?.Contains(item.ProductId) == true;
            if (!product.IsActive && !alreadyOnSale)
            {
                errors.Add($"{product.Name} is inactive. Set its selling price and activate it in Products before selling it.");
            }

            if (!isZeroInvoice && item.UnitPrice <= 0)
            {
                errors.Add($"{product.Name} has no selling price (AED 0.00). Enter a price, or mark the whole invoice as a zero invoice.");
            }
        }
        return errors;
    }

    internal static async Task<List<string>> CheckAsync(
        AppDbContext context,
        int tenantId,
        IReadOnlyCollection<SaleItemRequest> items,
        bool isZeroInvoice,
        IReadOnlySet<int>? productsAlreadyOnSale = null)
    {
        var ids = items.Select(i => i.ProductId).Distinct().ToList();
        var products = await context.Products.AsNoTracking()
            .Where(p => p.TenantId == tenantId && ids.Contains(p.Id))
            .Select(p => new { p.Id, p.NameEn, p.IsActive })
            .ToDictionaryAsync(p => p.Id, p => new ProductState(p.NameEn, p.IsActive));
        return Check(items, products, isZeroInvoice, productsAlreadyOnSale);
    }
}
