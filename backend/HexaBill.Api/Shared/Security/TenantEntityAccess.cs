using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Shared.Security;

/// <summary>
/// Tenant ownership checks for top-level entities with TenantId columns.
/// </summary>
public static class TenantEntityAccess
{
    public static Task<bool> CustomerBelongsToTenantAsync(AppDbContext db, int customerId, int tenantId, CancellationToken ct = default)
        => db.Customers.AnyAsync(c => c.Id == customerId && c.TenantId == tenantId, ct);

    public static Task<bool> ProductBelongsToTenantAsync(AppDbContext db, int productId, int tenantId, CancellationToken ct = default)
        => db.Products.AnyAsync(p => p.Id == productId && p.TenantId == tenantId, ct);

    public static Task<bool> PurchaseBelongsToTenantAsync(AppDbContext db, int purchaseId, int tenantId, CancellationToken ct = default)
        => TenantChildAccess.PurchaseBelongsToTenantAsync(db, purchaseId, tenantId, ct);

    public static Task<bool> SaleBelongsToTenantAsync(AppDbContext db, int saleId, int tenantId, CancellationToken ct = default)
        => TenantChildAccess.SaleBelongsToTenantAsync(db, saleId, tenantId, ct);

    public static Task<bool> PaymentBelongsToTenantAsync(AppDbContext db, int paymentId, int tenantId, CancellationToken ct = default)
        => db.Payments.AnyAsync(p => p.Id == paymentId && p.TenantId == tenantId, ct);

    public static Task<bool> PaymentReceiptBelongsToTenantAsync(AppDbContext db, int receiptId, int tenantId, CancellationToken ct = default)
        => db.PaymentReceipts.AnyAsync(r => r.Id == receiptId && r.TenantId == tenantId, ct);

    public static Task<bool> QuotationBelongsToTenantAsync(AppDbContext db, int quotationId, int tenantId, CancellationToken ct = default)
        => TenantChildAccess.QuotationBelongsToTenantAsync(db, quotationId, tenantId, ct);

    public static Task<bool> UserBelongsToTenantAsync(AppDbContext db, int userId, int tenantId, CancellationToken ct = default)
        => db.Users.AnyAsync(u => u.Id == userId && u.TenantId == tenantId, ct);
}
