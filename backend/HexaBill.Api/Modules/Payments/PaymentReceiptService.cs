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
using System.Text.Json;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Data;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Payments
{
    public interface IPaymentReceiptService
    {
        Task<List<int>> GetReceiptPaymentIdsForSaleAsync(int tenantId, int saleId);
        Task<PaymentReceiptDetailDto> GenerateReceiptAsync(int tenantId, int paymentId, int userId);
        Task<(PaymentReceiptDetailDto Detail, List<PaymentReceiptDto> Receipts)> GenerateBatchReceiptAsync(int tenantId, List<int> paymentIds, int userId);
        Task<PaymentReceiptDto?> GetReceiptByPaymentIdAsync(int paymentId, int tenantId);
        Task<List<PaymentReceiptDto>> GetReceiptsByCustomerAsync(int customerId, int tenantId);
    }

    public class PaymentReceiptService : IPaymentReceiptService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<PaymentReceiptService> _logger;
        private readonly ISettingsService _settings;

        public PaymentReceiptService(AppDbContext context, ILogger<PaymentReceiptService> logger, ISettingsService? settings = null)
        {
            _context = context;
            _logger = logger;
            _settings = settings ?? new SettingsService(context);
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
            if (tenantId <= 0 || userId <= 0)
                throw new ArgumentException("A valid workspace and user are required.");
            if (paymentIds.Any(id => id <= 0))
                throw new ArgumentException("Payment IDs must be positive numbers.");

            var distinctIds = paymentIds.Distinct().ToList();
            if (distinctIds.Count > 500)
                throw new ArgumentException("Select up to 500 payments per receipt.");
            var receipts = new List<PaymentReceiptDto>();
            var details = new List<PaymentReceiptDetailDto>();
            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                receipts.Clear();
                details.Clear();
                var attemptRows = new HashSet<PaymentReceipt>();
                await using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    // Serialize receipt number allocation and same-payment capture within this workspace.
                    if (_context.Database.IsNpgsql())
                        await _context.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({726301}, {tenantId})");
                    // Keep payment status/amount stable until this receipt transaction commits.
                    if (_context.Database.IsNpgsql())
                        await _context.Database.ExecuteSqlInterpolatedAsync($"SELECT \"Id\" FROM \"Payments\" WHERE \"TenantId\" = {tenantId} AND \"Id\" = ANY({distinctIds.ToArray()}) ORDER BY \"Id\" FOR SHARE");
                    var payments = await _context.Payments
                        .AsNoTracking()
                        .Where(p => p.TenantId == tenantId && distinctIds.Contains(p.Id))
                        .Include(p => p.Sale)
                        .Include(p => p.Customer)
                        .OrderBy(p => p.PaymentDate)
                        .ThenBy(p => p.Id)
                        .ToListAsync();

                    if (payments.Count != distinctIds.Count)
                        throw new InvalidOperationException("One or more payments not found or do not belong to your tenant.");

                    // Proof of received funds must not include uncleared instruments, credit terms or refunds.
                    if (payments.Any(p => p.Status != PaymentStatus.CLEARED || p.SaleReturnId.HasValue ||
                        p.Amount <= 0 || p.Mode == PaymentMode.CREDIT || p.IsSettlementAdjustment))
                        throw new InvalidOperationException("Select cleared incoming payments only. Pending, returned, void, credit, settlement adjustments and refund entries cannot produce a payment receipt.");
                    if (payments.Any(p =>
                        (p.CustomerId.HasValue && (p.Customer == null || p.Customer.TenantId != tenantId)) ||
                        (p.SaleId.HasValue && (p.Sale == null || p.Sale.TenantId != tenantId || p.Sale.IsDeleted ||
                            p.Sale.CustomerId != p.CustomerId))))
                        throw new InvalidOperationException("Payment references are unavailable or inconsistent. Review the payment before creating a receipt.");

                    // Same customer for multi-bill combined receipt (ledger group select).
                    if (payments.Count > 1)
                    {
                        var customerIds = payments.Select(p => p.CustomerId).Distinct().ToList();
                        var sameCashInvoice = !customerIds[0].HasValue && payments.All(p => p.SaleId.HasValue) &&
                            payments.Select(p => p.SaleId).Distinct().Count() == 1;
                        if (customerIds.Count > 1 || (!customerIds[0].HasValue && !sameCashInvoice))
                            throw new InvalidOperationException("Selected payments belong to different customers. Generate a receipt per customer.");
                    }

                    var settings = await _settings.GetCompanySettingsAsync(tenantId);
                    var companyName = settings.LegalNameEn;
                    var tenant = await _context.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId);
                    var captureEnabled = TenantFeatureFlags.IsEnabled(tenant?.FeaturesJson, TenantFeatureFlags.ReceiptSnapshots);
                    var existingRows = await _context.PaymentReceipts
                        .Where(r => r.TenantId == tenantId && distinctIds.Contains(r.PaymentId))
                        .OrderByDescending(r => r.GeneratedAt).ThenByDescending(r => r.Id).ToListAsync();
                    var existingByPayment = existingRows.GroupBy(r => r.PaymentId).ToDictionary(g => g.Key, g => g.First());
                    var parentIds = payments.Select(p => p.Id).ToList();
                    var settlementByParent = await _context.Payments.AsNoTracking()
                        .Where(p => p.TenantId == tenantId && p.IsSettlementAdjustment && p.ParentPaymentId != null &&
                            parentIds.Contains(p.ParentPaymentId.Value) && p.Status == PaymentStatus.CLEARED)
                        .ToDictionaryAsync(p => p.ParentPaymentId!.Value);
                    var plans = new List<(Payment Payment, PaymentReceipt? Existing, PaymentReceiptDetailDto Detail)>();
                    foreach (var pay in payments)
                    {
                        existingByPayment.TryGetValue(pay.Id, out var existing);
                        PaymentReceiptDetailDto document;
                        if (!string.IsNullOrWhiteSpace(existing?.SnapshotJson))
                        {
                            ReceiptSnapshot snapshot;
                            try { snapshot = JsonSerializer.Deserialize<ReceiptSnapshot>(existing.SnapshotJson)!; }
                            catch (JsonException) { throw new InvalidOperationException("Saved receipt details are invalid. Contact support; no replacement was created."); }
                            if (snapshot == null || snapshot.Version != 1 || snapshot.TenantId != tenantId ||
                                snapshot.PaymentId != pay.Id || snapshot.CustomerId != pay.CustomerId || snapshot.SaleId != pay.SaleId ||
                                snapshot.Detail == null || snapshot.Detail.ReceiptNumber != existing.ReceiptNumber ||
                                snapshot.Detail.AmountReceived <= 0 || snapshot.Detail.Invoices == null || snapshot.Detail.Invoices.Count == 0)
                                throw new InvalidOperationException("Saved receipt details do not match this payment. Contact support; no replacement was created.");
                            document = snapshot.Detail;
                            document.PaymentChangedSinceSnapshot = document.AmountReceived != pay.Amount ||
                                document.PaymentMethod != pay.Mode.ToString() || document.Reference != pay.Reference ||
                                document.ReceiptDate != pay.PaymentDate;
                        }
                        else
                        {
                            if (string.IsNullOrWhiteSpace(companyName))
                                throw new InvalidOperationException("Complete the company name in settings before creating a receipt.");
                            settlementByParent.TryGetValue(pay.Id, out var settlementRow);
                            var settlementAmt = settlementRow?.Amount ?? 0m;
                            var appliedToInvoice = Math.Round(pay.Amount + settlementAmt, 2, MidpointRounding.AwayFromZero);
                            document = new PaymentReceiptDetailDto
                            {
                                ReceiptDate = pay.PaymentDate,
                                CompanyName = settings.LegalNameEn ?? "",
                                CompanyNameAr = settings.LegalNameAr,
                                CompanyTrn = settings.VatNumber,
                                CorporateTaxTrn = settings.CorporateTaxTrn,
                                CompanyAddress = settings.Address,
                                CompanyPhone = settings.Mobile,
                                CompanyEmail = settings.Email,
                                CompanySettingsVersion = settings.SettingsVersion,
                                BilingualMonochromeHeader = settings.BilingualMonochromeHeader,
                                Currency = string.IsNullOrWhiteSpace(tenant?.Currency) ? "AED" : tenant.Currency,
                                ReceivedFrom = pay.Customer?.Name ?? "Cash customer",
                                CustomerTrn = pay.Customer?.Trn,
                                AmountReceived = pay.Amount,
                                AmountPaid = appliedToInvoice,
                                SettlementAdjustmentAmount = settlementAmt > 0 ? settlementAmt : null,
                                SettlementAdjustmentReason = settlementAmt > 0 ? settlementRow?.Reference : null,
                                AmountInWords = tenant?.Currency == null || tenant.Currency == "AED" ? AmountToWords(pay.Amount) : "",
                                PaymentMethod = pay.Mode.ToString(),
                                Reference = pay.Reference,
                                LegacyReconstruction = existing != null || !captureEnabled,
                                Invoices = [new PaymentReceiptInvoiceLineDto
                                {
                                    InvoiceNo = pay.Sale?.InvoiceNo ?? "On account",
                                    InvoiceDate = pay.Sale?.InvoiceDate ?? pay.PaymentDate,
                                    InvoiceTotal = pay.Sale?.GrandTotal ?? appliedToInvoice,
                                    AmountApplied = appliedToInvoice
                                }]
                            };
                        }
                        plans.Add((pay, existing, document));
                    }
                    // Financial/customer snapshots must agree; company identity is resolved at render time.
                    var identities = plans.Select(p => JsonSerializer.Serialize(new {
                        p.Detail.Currency, p.Detail.ReceivedFrom, p.Detail.CustomerTrn
                    })).Distinct().Count();
                    if (identities != 1)
                        throw new InvalidOperationException("Selected receipts have different saved company or customer details. Print them separately.");

                    foreach (var plan in plans)
                    {
                        var rec = plan.Existing;
                        if (rec == null)
                        {
                            rec = new PaymentReceipt
                            {
                                TenantId = tenantId, PaymentId = plan.Payment.Id,
                                ReceiptNumber = await GetNextReceiptNumberAsync(tenantId),
                                GeneratedAt = DateTime.UtcNow, GeneratedByUserId = userId
                            };
                            _context.PaymentReceipts.Add(rec);
                        }
                        attemptRows.Add(rec);
                        plan.Detail.ReceiptNumber = rec.ReceiptNumber;
                        if (captureEnabled && string.IsNullOrWhiteSpace(rec.SnapshotJson))
                        {
                            plan.Detail.IsHistoricalSnapshot = true;
                            plan.Detail.SnapshotCapturedAt = DateTime.UtcNow;
                            rec.SnapshotJson = JsonSerializer.Serialize(new ReceiptSnapshot
                            {
                                TenantId = tenantId, PaymentId = plan.Payment.Id,
                                CustomerId = plan.Payment.CustomerId, SaleId = plan.Payment.SaleId,
                                Detail = plan.Detail
                            });
                        }
                        await _context.SaveChangesAsync();
                        receipts.Add(new PaymentReceiptDto { Id = rec.Id, ReceiptNumber = rec.ReceiptNumber,
                            PaymentId = rec.PaymentId, GeneratedAt = rec.GeneratedAt });
                        // Preserve the stored issue-time snapshot; update only the returned header.
                        plan.Detail.CompanyName = settings.LegalNameEn;
                        plan.Detail.CompanyNameAr = settings.LegalNameAr;
                        plan.Detail.CompanyTrn = settings.VatNumber;
                        plan.Detail.CorporateTaxTrn = settings.CorporateTaxTrn;
                        plan.Detail.CompanyAddress = settings.Address;
                        plan.Detail.CompanyPhone = settings.Mobile;
                        plan.Detail.CompanyEmail = settings.Email;
                        plan.Detail.CompanyLogoDataUri = settings.LogoDataUri;
                        plan.Detail.CompanySettingsVersion = settings.SettingsVersion;
                        plan.Detail.BilingualMonochromeHeader = settings.BilingualMonochromeHeader;
                        details.Add(plan.Detail);
                    }
                    await transaction.CommitAsync();
                }
                catch (Exception ex)
                {
                    try { await transaction.RollbackAsync(); }
                    catch (Exception rollbackError) { _logger.LogWarning(rollbackError, "Receipt transaction rollback failed for tenant {TenantId}", tenantId); }
                    finally
                    {
                        // SaveChanges may have accepted entities before a later failure. Do not let
                        // the next execution-strategy attempt reuse rolled-back rows or snapshots.
                        foreach (var row in attemptRows) _context.Entry(row).State = EntityState.Detached;
                    }
                    _logger.LogError(ex, "Payment receipt persist failed for tenant {TenantId}", tenantId);
                    throw;
                }
            });
            if (details.Count == 0) throw new InvalidOperationException("Receipt could not be created.");
            if (details.Count == 1) return (SealDocument(details[0]), receipts);
            var first = details.OrderBy(d => d.ReceiptDate).ThenBy(d => d.ReceiptNumber).First();
            // Clone the first saved detail before composing a transient combined preview.
            var combined = JsonSerializer.Deserialize<PaymentReceiptDetailDto>(JsonSerializer.Serialize(first))!;
            combined.ReceiptNumber = $"{first.ReceiptNumber} (+{details.Count - 1} more)";
            combined.ReceiptEndDate = details.Max(d => d.ReceiptDate);
            combined.Invoices = details.SelectMany(d => d.Invoices).ToList();
            combined.AmountReceived = details.Sum(d => d.AmountReceived);
            combined.AmountPaid = details.Sum(d => d.AmountPaid);
            combined.SettlementAdjustmentAmount = details.Sum(d => d.SettlementAdjustmentAmount ?? 0m) is var adjSum && adjSum > 0 ? adjSum : null;
            combined.AmountInWords = combined.Currency == "AED" ? AmountToWords(combined.AmountReceived) : "";
            combined.PaymentMethod = "Multiple";
            combined.Reference = null;
            combined.IsHistoricalSnapshot = details.All(d => d.IsHistoricalSnapshot);
            combined.LegacyReconstruction = details.Any(d => d.LegacyReconstruction);
            combined.PaymentChangedSinceSnapshot = details.Any(d => d.PaymentChangedSinceSnapshot);
            combined.SnapshotCapturedAt = details.Max(d => d.SnapshotCapturedAt);
            return (SealDocument(combined), receipts);
        }

        public async Task<List<int>> GetReceiptPaymentIdsForSaleAsync(int tenantId, int saleId)
        {
            if (tenantId <= 0 || saleId <= 0) throw new ArgumentException("A valid invoice is required.");
            if (!await _context.Sales.AnyAsync(s => s.Id == saleId && s.TenantId == tenantId && !s.IsDeleted))
                throw new InvalidOperationException("Invoice not found in this workspace.");
            var ids = await _context.Payments.Where(p => p.TenantId == tenantId && p.SaleId == saleId &&
                p.Status == PaymentStatus.CLEARED && p.SaleReturnId == null && p.Amount > 0 && p.Mode != PaymentMode.CREDIT &&
                !p.IsSettlementAdjustment)
                .OrderBy(p => p.PaymentDate).ThenBy(p => p.Id).Select(p => p.Id).Take(501).ToListAsync();
            if (ids.Count > 500) throw new InvalidOperationException("This invoice has more than 500 eligible payments. Generate receipts from the customer payment list in smaller groups.");
            return ids;
        }

        private static PaymentReceiptDetailDto SealDocument(PaymentReceiptDetailDto detail)
        {
            detail.DocumentFingerprint = "";
            var bytes = System.Text.Encoding.UTF8.GetBytes(JsonSerializer.Serialize(detail));
            detail.DocumentFingerprint = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes));
            return detail;
        }

        private sealed class ReceiptSnapshot
        {
            public int Version { get; set; } = 1;
            public int TenantId { get; set; }
            public int PaymentId { get; set; }
            public int? CustomerId { get; set; }
            public int? SaleId { get; set; }
            public PaymentReceiptDetailDto Detail { get; set; } = null!;
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

        private static string AmountToWords(decimal amount) => HexaBill.Api.Core.Infrastructure.AmountToWords.Dirhams(amount);
    }
}
