using System.Text.Json;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.Sales
{
    public class ChangeInvoiceNumberRequest
    {
        public string NewInvoiceNumber { get; set; } = string.Empty;
        public string? Reason { get; set; }
    }

    public class InvoiceNumberChangeResult
    {
        public int SaleId { get; set; }
        public string OldInvoiceNo { get; set; } = string.Empty;
        public string NewInvoiceNo { get; set; } = string.Empty;
        public bool DryRun { get; set; }
        public bool Changed { get; set; }
        /// <summary>Stock movement rows whose Reason text carried the old number and is (or would be) updated.</summary>
        public int InventoryTransactionsUpdated { get; set; }
    }

    public enum InvoiceNumberChangeOutcome { Ok, NotFound, Invalid }

    public interface IInvoiceRenumberService
    {
        Task<(InvoiceNumberChangeOutcome Outcome, string? Problem, InvoiceNumberChangeResult? Result)> ChangeAsync(
            int saleId, int tenantId, int userId, ChangeInvoiceNumberRequest request, bool dryRun);
    }

    /// <summary>
    /// Owner/Admin correction of an issued invoice number (P0-NUM-004). Payments, returns, credit notes and the customer ledger
    /// reference the sale by SaleId and read Sale.InvoiceNo live, so only Sale.InvoiceNo and the free-text stock movement
    /// Reason ("Sale Updated: 1791254852") hold copies. Receipt SnapshotJson, InvoiceVersion.DataJson and earlier audit rows are
    /// historical records and are deliberately not rewritten; the old number stays findable through the InvoiceNumberChanged audit row.
    /// </summary>
    public class InvoiceRenumberService : IInvoiceRenumberService
    {
        public const string AuditAction = "InvoiceNumberChanged";
        private readonly AppDbContext _context;
        private readonly IInvoiceNumberService _numbers;

        public InvoiceRenumberService(AppDbContext context, IInvoiceNumberService numbers)
        {
            _context = context;
            _numbers = numbers;
        }

        public async Task<(InvoiceNumberChangeOutcome Outcome, string? Problem, InvoiceNumberChangeResult? Result)> ChangeAsync(
            int saleId, int tenantId, int userId, ChangeInvoiceNumberRequest request, bool dryRun)
        {
            var newNo = (request?.NewInvoiceNumber ?? "").Trim();
            var relational = _context.Database.IsRelational();
            await using var tx = relational && !dryRun ? await _context.Database.BeginTransactionAsync() : null;
            if (tx != null && _context.Database.IsNpgsql())
                await _context.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock({0})", 1000000 + tenantId);

            // Deleted sales are loaded on purpose so they can be refused with a clear message instead of a 404.
            var sale = await _context.Sales.IgnoreQueryFilters()
                .FirstOrDefaultAsync(s => s.Id == saleId && s.TenantId == tenantId);
            if (sale == null)
                return (InvoiceNumberChangeOutcome.NotFound, "Invoice not found.", null);
            if (sale.IsDeleted)
                return (InvoiceNumberChangeOutcome.Invalid, "Deleted invoices cannot be renumbered.", null);
            if (sale.ExternalReference != null && sale.ExternalReference.StartsWith("starplus:", StringComparison.OrdinalIgnoreCase))
                return (InvoiceNumberChangeOutcome.Invalid, "Imported invoices keep their original number and cannot be renumbered.", null);

            var oldNo = sale.InvoiceNo;
            var result = new InvoiceNumberChangeResult { SaleId = sale.Id, OldInvoiceNo = oldNo, NewInvoiceNo = newNo, DryRun = dryRun };
            if (string.Equals(oldNo?.Trim(), newNo, StringComparison.Ordinal))
                return (InvoiceNumberChangeOutcome.Ok, null, result);

            var problem = await _numbers.GetManualInvoiceNumberProblemAsync(newNo, tenantId, excludeSaleId: sale.Id);
            if (problem != null)
                return (InvoiceNumberChangeOutcome.Invalid, problem, null);

            var movements = string.IsNullOrEmpty(oldNo)
                ? new List<InventoryTransaction>()
                : (await _context.InventoryTransactions
                    .Where(t => t.TenantId == tenantId && t.RefId == sale.Id && t.TransactionType == TransactionType.Sale && t.Reason != null)
                    .ToListAsync())
                    .Where(t => t.Reason!.EndsWith(": " + oldNo, StringComparison.Ordinal))
                    .ToList();
            result.InventoryTransactionsUpdated = movements.Count;
            if (dryRun)
                return (InvoiceNumberChangeOutcome.Ok, null, result);

            foreach (var m in movements)
                m.Reason = m.Reason!.Substring(0, m.Reason.Length - oldNo!.Length) + newNo;

            sale.InvoiceNo = newNo;
            sale.LastModifiedAt = DateTime.UtcNow;
            sale.LastModifiedBy = userId;
            _context.AuditLogs.Add(new AuditLog
            {
                OwnerId = tenantId,
                TenantId = tenantId,
                UserId = userId,
                Action = AuditAction,
                EntityType = "Sale",
                EntityId = sale.Id,
                OldValues = JsonSerializer.Serialize(new { InvoiceNo = oldNo }),
                NewValues = JsonSerializer.Serialize(new { InvoiceNo = newNo }),
                Details = $"Invoice number {oldNo} changed to {newNo}." + (string.IsNullOrWhiteSpace(request?.Reason) ? "" : $" Reason: {request!.Reason!.Trim()}"),
                CreatedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();
            if (tx != null) await tx.CommitAsync();
            result.Changed = true;
            return (InvoiceNumberChangeOutcome.Ok, null, result);
        }
    }
}
