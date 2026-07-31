/*
Purpose: Generate payment receipts (proof of payment, not tax invoice).

Business logic:
- Single payment: one receipt with one invoice line (invoice no, date, total, amount applied).
- Multiple payments (multi-bill): one combined receipt with total amount received and a table of
  all invoices/bills and amount applied to each. Optional – print only when customer requests.
- Receipt shows: received from, amount received (and in words), payment method, optional reference,
  and per-invoice breakdown when multiple payments/invoices are included.
- Idempotent: reopening a receipt for the same payment reuses the existing PaymentReceipts row
  (does not mint a new REC- number on every preview).
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;

namespace HexaBill.Api.Modules.Payments
{
    public interface IPaymentReceiptService
    {
        Task<PaymentReceiptDetailDto> GenerateReceiptAsync(int tenantId, int paymentId, int userId);
        Task<(PaymentReceiptDetailDto Detail, List<PaymentReceiptDto> Receipts)> GenerateBatchReceiptAsync(int tenantId, List<int> paymentIds, int userId);
        Task<PaymentReceiptDto?> GetReceiptByPaymentIdAsync(int paymentId, int tenantId);
        Task<List<PaymentReceiptDto>> GetReceiptsByCustomerAsync(int customerId, int tenantId);
    }

    public class PaymentReceiptService : IPaymentReceiptService
    {
        private readonly AppDbContext _context;
        private readonly ISettingsService _settingsService;
        private readonly ILogger<PaymentReceiptService> _logger;

        public PaymentReceiptService(AppDbContext context, ISettingsService settingsService, ILogger<PaymentReceiptService> logger)
        {
            _context = context;
            _settingsService = settingsService;
            _logger = logger;
        }

        public async Task<PaymentReceiptDetailDto> GenerateReceiptAsync(int tenantId, int paymentId, int userId)
        {
            var (detail, _) = await GenerateBatchReceiptAsync(tenantId, new List<int> { paymentId }, userId);
            return detail;
        }

        public async Task<(PaymentReceiptDetailDto Detail, List<PaymentReceiptDto> Receipts)> GenerateBatchReceiptAsync(int tenantId, List<int> paymentIds, int userId)
        {
            if (paymentIds == null || !paymentIds.Any())
                throw new ArgumentException("At least one payment ID is required.");

            var distinctIds = paymentIds.Distinct().ToList();
            var payments = await _context.Payments
                .Where(p => p.TenantId == tenantId && distinctIds.Contains(p.Id))
                .Include(p => p.Sale)
                .Include(p => p.Customer)
                .OrderBy(p => p.PaymentDate)
                .ToListAsync();

            if (payments.Count != distinctIds.Count)
                throw new InvalidOperationException("One or more payments not found or do not belong to your tenant.");

            // Same customer for multi-bill combined receipt (ledger group select).
            if (payments.Count > 1)
            {
                var customerIds = payments.Select(p => p.CustomerId).Distinct().ToList();
                if (customerIds.Count > 1)
                    throw new InvalidOperationException("Selected payments belong to different customers. Generate a receipt per customer.");
            }

            var settings = await _settingsService.GetCompanySettingsAsync(tenantId);
            var receipts = new List<PaymentReceiptDto>();
            var invoiceLines = new List<PaymentReceiptInvoiceLineDto>();
            decimal totalAmount = 0;
            string receivedFrom = "";
            int? customerId = null;

            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                // Clear so a retry after transient failure does not double-append.
                receipts.Clear();
                invoiceLines.Clear();
                totalAmount = 0;
                receivedFrom = "";
                customerId = null;

                await using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    var existingByPaymentId = await _context.PaymentReceipts
                        .Where(r => r.TenantId == tenantId && distinctIds.Contains(r.PaymentId))
                        .OrderByDescending(r => r.GeneratedAt)
                        .ToListAsync();

                    var latestExisting = existingByPaymentId
                        .GroupBy(r => r.PaymentId)
                        .ToDictionary(g => g.Key, g => g.First());

                    foreach (var pay in payments)
                    {
                        PaymentReceipt rec;
                        if (latestExisting.TryGetValue(pay.Id, out var existing))
                        {
                            rec = existing;
                        }
                        else
                        {
                            var receiptNo = await GetNextReceiptNumberAsync(tenantId);
                            rec = new PaymentReceipt
                            {
                                TenantId = tenantId,
                                ReceiptNumber = receiptNo,
                                PaymentId = pay.Id,
                                GeneratedAt = DateTime.UtcNow,
                                GeneratedByUserId = userId
                            };
                            _context.PaymentReceipts.Add(rec);
                            await _context.SaveChangesAsync();
                        }

                        receipts.Add(new PaymentReceiptDto
                        {
                            Id = rec.Id,
                            ReceiptNumber = rec.ReceiptNumber,
                            PaymentId = rec.PaymentId,
                            GeneratedAt = rec.GeneratedAt
                        });

                        totalAmount += pay.Amount;
                        if (pay.Customer != null)
                        {
                            receivedFrom = pay.Customer.Name ?? "";
                            customerId = pay.CustomerId;
                        }

                        if (pay.Sale != null)
                        {
                            invoiceLines.Add(new PaymentReceiptInvoiceLineDto
                            {
                                InvoiceNo = pay.Sale.InvoiceNo ?? "",
                                InvoiceDate = pay.Sale.InvoiceDate,
                                InvoiceTotal = pay.Sale.GrandTotal,
                                AmountApplied = pay.Amount
                            });
                        }
                        else
                        {
                            // Advance / on-account payment with no linked invoice.
                            invoiceLines.Add(new PaymentReceiptInvoiceLineDto
                            {
                                InvoiceNo = "On account",
                                InvoiceDate = pay.PaymentDate,
                                InvoiceTotal = pay.Amount,
                                AmountApplied = pay.Amount
                            });
                        }
                    }

                    await transaction.CommitAsync();
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "Payment receipt persist failed for tenant {TenantId}", tenantId);
                    throw;
                }
            });

            if (payments.Count == 1 && payments[0].Customer != null)
                receivedFrom = payments[0].Customer.Name ?? "";
            else if (payments.Count > 1 && customerId.HasValue)
            {
                var cust = await _context.Customers.FindAsync(customerId.Value);
                receivedFrom = cust?.Name ?? "Multiple";
            }

            decimal? previousBalance = null;
            decimal? remainingBalance = null;
            if (customerId.HasValue)
            {
                var balance = await _context.Customers.Where(c => c.Id == customerId.Value).Select(c => c.PendingBalance).FirstOrDefaultAsync();
                // After payment, PendingBalance is already post-payment. Show remaining as-is;
                // previous ≈ remaining + this receipt total.
                remainingBalance = balance;
                previousBalance = balance + totalAmount;
            }

            if (receipts.Count == 0)
                throw new InvalidOperationException("Receipt could not be created.");

            var detail = new PaymentReceiptDetailDto
            {
                ReceiptNumber = receipts.Count == 1 ? receipts[0].ReceiptNumber : $"{receipts[0].ReceiptNumber} (+{receipts.Count - 1} more)",
                ReceiptDate = payments[0].PaymentDate,
                CompanyName = settings.LegalNameEn ?? "Company",
                CompanyNameAr = settings.LegalNameAr,
                CompanyTrn = settings.VatNumber,
                CompanyAddress = settings.Address,
                CompanyPhone = settings.Mobile,
                ReceivedFrom = receivedFrom,
                CustomerTrn = customerId.HasValue ? (await _context.Customers.Where(c => c.Id == customerId.Value).Select(c => c.Trn).FirstOrDefaultAsync()) : null,
                AmountReceived = totalAmount,
                AmountInWords = AmountToWords(totalAmount),
                PaymentMethod = payments.Count == 1 ? payments[0].Mode.ToString() : "Multiple",
                Reference = payments.Count == 1 ? payments[0].Reference : null,
                Invoices = invoiceLines,
                PreviousBalance = previousBalance,
                AmountPaid = totalAmount,
                RemainingBalance = remainingBalance
            };
            return (detail, receipts);
        }

        public async Task<PaymentReceiptDto?> GetReceiptByPaymentIdAsync(int paymentId, int tenantId)
        {
            return await _context.PaymentReceipts
                .Where(r => r.PaymentId == paymentId && r.TenantId == tenantId)
                .OrderByDescending(r => r.GeneratedAt)
                .Select(r => new PaymentReceiptDto { Id = r.Id, ReceiptNumber = r.ReceiptNumber, PaymentId = r.PaymentId, GeneratedAt = r.GeneratedAt })
                .FirstOrDefaultAsync();
        }

        public async Task<List<PaymentReceiptDto>> GetReceiptsByCustomerAsync(int customerId, int tenantId)
        {
            return await _context.PaymentReceipts
                .Where(r => r.TenantId == tenantId && r.Payment.CustomerId == customerId)
                .OrderByDescending(r => r.GeneratedAt)
                .Select(r => new PaymentReceiptDto { Id = r.Id, ReceiptNumber = r.ReceiptNumber, PaymentId = r.PaymentId, GeneratedAt = r.GeneratedAt })
                .ToListAsync();
        }

        private async Task<string> GetNextReceiptNumberAsync(int tenantId)
        {
            var year = DateTime.UtcNow.Year;
            var prefix = $"REC-{year}-";
            // Prefer MAX parse in-memory; table is small. For concurrency, unique index on (TenantId, ReceiptNumber) guards races.
            var max = await _context.PaymentReceipts
                .Where(r => r.TenantId == tenantId && r.ReceiptNumber.StartsWith(prefix))
                .Select(r => r.ReceiptNumber)
                .ToListAsync();
            var maxNum = max
                .Select(s => s.Length > prefix.Length && int.TryParse(s.AsSpan(prefix.Length), out var n) ? n : 0)
                .DefaultIfEmpty(0)
                .Max();
            return prefix + (maxNum + 1).ToString("D4");
        }

        private static string AmountToWords(decimal amount) => HexaBill.Api.Shared.AmountToWords.Dirhams(amount);
    }
}
