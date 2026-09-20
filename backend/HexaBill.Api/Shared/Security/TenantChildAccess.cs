using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Shared.Security;

/// <summary>
/// Parent-scoped tenant checks for child entities that lack a TenantId column.
/// </summary>
public static class TenantChildAccess
{
    public static Task<bool> SaleBelongsToTenantAsync(AppDbContext db, int saleId, int tenantId, CancellationToken ct = default)
        => db.Sales.AnyAsync(s => s.Id == saleId && s.TenantId == tenantId && !s.IsDeleted, ct);

    public static Task<bool> PurchaseBelongsToTenantAsync(AppDbContext db, int purchaseId, int tenantId, CancellationToken ct = default)
        => db.Purchases.AnyAsync(p => p.Id == purchaseId && p.TenantId == tenantId, ct);

    public static Task<bool> QuotationBelongsToTenantAsync(AppDbContext db, int quotationId, int tenantId, CancellationToken ct = default)
        => db.Quotations.AnyAsync(q => q.Id == quotationId && q.TenantId == tenantId, ct);

    public static Task<bool> RecurringInvoiceBelongsToTenantAsync(AppDbContext db, int recurringId, int tenantId, CancellationToken ct = default)
        => db.RecurringInvoices.AnyAsync(r => r.Id == recurringId && r.TenantId == tenantId, ct);

    public static Task<bool> SaleReturnBelongsToTenantAsync(AppDbContext db, int returnId, int tenantId, CancellationToken ct = default)
        => db.SaleReturns.AnyAsync(r => r.Id == returnId && r.TenantId == tenantId, ct);

    public static async Task<bool> SaleItemsBelongToTenantAsync(AppDbContext db, IEnumerable<int> saleItemIds, int tenantId, CancellationToken ct = default)
    {
        var ids = saleItemIds.Distinct().ToList();
        if (ids.Count == 0)
            return true;

        var ownedCount = await db.SaleItems
            .Where(si => ids.Contains(si.Id) && si.Sale.TenantId == tenantId && !si.Sale.IsDeleted)
            .CountAsync(ct);

        return ownedCount == ids.Count;
    }
}
