using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.Customers;

/// <summary>
/// One row per customer with open bills: live invoices (GrandTotal − PaidAmount − approved returns) plus historical
/// Starplus invoices (OutstandingCalculated). Receivables include output VAT, because the customer owes the gross amount.
/// (Profit excludes VAT; receivables do not.) Due date: DueDate, else 30 days after the invoice date (same rule as the
/// outstanding-invoices list).
/// </summary>
public static class PendingBillsSummary
{
    public const int DefaultDueDays = 30;
    private const decimal Tolerance = 0.005m;

    public static async Task<List<PendingCustomerDto>> BuildAsync(AppDbContext db, int tenantId, DateTime todayUtc)
    {
        var liveSales = await db.Sales.AsNoTracking()
            .Where(s => s.TenantId == tenantId && !s.IsDeleted && s.CustomerId != null)
            .Select(s => new { s.Id, CustomerId = s.CustomerId!.Value, s.InvoiceNo, s.InvoiceDate, s.DueDate, s.GrandTotal, s.PaidAmount })
            .ToListAsync();

        var returnsBySale = await InvoiceReceivables.ApprovedReturns(db, tenantId)
            .GroupBy(r => r.SaleId)
            .Select(g => new { SaleId = g.Key, Total = g.Sum(r => r.GrandTotal) })
            .ToDictionaryAsync(x => x.SaleId, x => x.Total);

        var legacy = await db.LegacyInvoices.AsNoTracking()
            .Where(l => l.TenantId == tenantId && !l.IsDeleted && l.DestinationCustomerId != null && l.OutstandingCalculated > Tolerance)
            .Select(l => new { CustomerId = l.DestinationCustomerId!.Value, l.Id, l.LegacyInvoiceNumber, l.InvoiceDate, l.DueDate, l.OutstandingCalculated })
            .ToListAsync();

        var bills = new List<PendingBillDto>();
        foreach (var s in liveSales)
        {
            var returns = returnsBySale.GetValueOrDefault(s.Id, 0m);
            var balance = InvoiceReceivables.Outstanding(s.GrandTotal, s.PaidAmount, returns);
            if (balance <= Tolerance) continue;
            bills.Add(new PendingBillDto
            {
                CustomerId = s.CustomerId, Source = "Live", SaleId = s.Id, InvoiceNo = s.InvoiceNo,
                InvoiceDate = s.InvoiceDate, DueDate = DueOf(s.DueDate, s.InvoiceDate),
                GrandTotal = s.GrandTotal, PaidAmount = s.PaidAmount, BalanceDue = balance,
            });
        }
        foreach (var l in legacy)
        {
            bills.Add(new PendingBillDto
            {
                CustomerId = l.CustomerId, Source = "Historical", SaleId = null, LegacyInvoiceId = l.Id, InvoiceNo = l.LegacyInvoiceNumber,
                InvoiceDate = l.InvoiceDate, DueDate = DueOf(l.DueDate, l.InvoiceDate),
                GrandTotal = l.OutstandingCalculated, PaidAmount = 0m, BalanceDue = l.OutstandingCalculated,
            });
        }

        var customers = await db.Customers.AsNoTracking()
            .Where(c => c.TenantId == tenantId && bills.Select(b => b.CustomerId).Contains(c.Id))
            .Select(c => new { c.Id, c.Name, c.Phone, c.Trn })
            .ToDictionaryAsync(c => c.Id);

        return bills
            .GroupBy(b => b.CustomerId)
            .Select(g =>
            {
                customers.TryGetValue(g.Key, out var c);
                var oldestDue = g.Min(b => b.DueDate);
                var overdueDays = Math.Max(0, (int)(todayUtc.Date - oldestDue.Date).TotalDays);
                return new PendingCustomerDto
                {
                    CustomerId = g.Key,
                    CustomerName = c?.Name ?? "",
                    Phone = c?.Phone,
                    Trn = c?.Trn,
                    PendingBillCount = g.Count(),
                    TotalOutstanding = Math.Round(g.Sum(b => b.BalanceDue), 2, MidpointRounding.AwayFromZero),
                    OldestInvoiceDate = g.Min(b => b.InvoiceDate),
                    OldestDueDate = oldestDue,
                    OverdueDays = overdueDays,
                    Bills = g.OrderBy(b => b.DueDate).ThenBy(b => b.InvoiceDate).ToList(),
                };
            })
            .Where(p => p.TotalOutstanding > Tolerance)
            .OrderByDescending(p => p.TotalOutstanding)
            .ThenByDescending(p => p.OverdueDays)
            .ToList();
    }

    internal static DateTime DueOf(DateTime? dueDate, DateTime invoiceDate) =>
        dueDate ?? invoiceDate.AddDays(DefaultDueDays);
}

public class PendingCustomerDto
{
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Trn { get; set; }
    public int PendingBillCount { get; set; }
    public decimal TotalOutstanding { get; set; }
    public DateTime OldestInvoiceDate { get; set; }
    public DateTime OldestDueDate { get; set; }
    public int OverdueDays { get; set; }
    public List<PendingBillDto> Bills { get; set; } = new();
}

public class PendingBillDto
{
    public int CustomerId { get; set; }
    public string Source { get; set; } = "Live";
    public int? SaleId { get; set; }
    public int? LegacyInvoiceId { get; set; }
    public string? InvoiceNo { get; set; }
    public DateTime InvoiceDate { get; set; }
    public DateTime DueDate { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal BalanceDue { get; set; }
}
