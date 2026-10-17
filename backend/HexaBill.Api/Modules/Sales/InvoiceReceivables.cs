using HexaBill.Api.Data;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Sales;

/// <summary>Approved returns reduce invoice debt, independently of money received.</summary>
internal static class InvoiceReceivables
{
    public static IQueryable<SaleReturn> ApprovedReturns(AppDbContext db, int tenantId) =>
        db.SaleReturns.Where(r => r.TenantId == tenantId && r.Status == ReturnStatus.Approved);

    public static decimal Outstanding(decimal grandTotal, decimal paidAmount, decimal approvedReturns) =>
        Math.Max(0m, grandTotal - paidAmount - approvedReturns);
}
