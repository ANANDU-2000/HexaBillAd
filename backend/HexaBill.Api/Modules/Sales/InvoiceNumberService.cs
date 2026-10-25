/*
Purpose: Invoice number management service with auto-generation and manual edit support
Author: AI Assistant
Date: 2025
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using System.Text.RegularExpressions;
using Npgsql;

namespace HexaBill.Api.Modules.Sales
{
    public interface IInvoiceNumberService
    {
        // MULTI-TENANT: Invoice number generation is now tenant-scoped
        Task<string> GenerateNextInvoiceNumberAsync(int tenantId);
        /// <summary>Call only when caller holds pg_advisory_xact_lock(1000000 + tenantId) in the current transaction. No lock is taken here.</summary>
        Task<string> GenerateNextInvoiceNumberInTransactionAsync(int tenantId);
        Task<bool> ValidateInvoiceNumberAsync(string invoiceNumber, int tenantId, int? excludeSaleId = null);
        /// <summary>Why a typed invoice number cannot be used, or null when it can.</summary>
        Task<string?> GetManualInvoiceNumberProblemAsync(string invoiceNumber, int tenantId, int? excludeSaleId = null);
        Task<string> FormatInvoiceNumberAsync(int number);
        Task<string> FormatInvoiceNumberForTenantAsync(int number, int tenantId);
        Task<bool> IsInvoiceNumberDuplicateAsync(string invoiceNumber, int tenantId, int? excludeSaleId = null);
    }

    public class InvoiceNumberService : IInvoiceNumberService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private static readonly SemaphoreSlim _semaphore = new SemaphoreSlim(1, 1);
        private static readonly Random _random = new Random();
        public const string SeriesStartSettingKey = "INVOICE_SERIES_START";
        private const int SeriesWidth = 1_000_000;
        public const string NumberWidthSettingKey = "INVOICE_NUMBER_WIDTH";
        private const int DefaultWidth = 4;

        public InvoiceNumberService(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public async Task<string> GenerateNextInvoiceNumberAsync(int tenantId)
        {
            // MULTI-TENANT: Generate invoice numbers per owner
            // Each owner has their own invoice number sequence
            await _semaphore.WaitAsync();
            try
            {
                return await GenerateNextInvoiceNumberFallbackAsync(tenantId);
            }
            finally
            {
                _semaphore.Release();
            }
        }

        /// <summary>Generate next invoice number. Caller MUST hold pg_advisory_xact_lock(1000000 + tenantId) in the current transaction. No lock is taken or released here.</summary>
        public async Task<string> GenerateNextInvoiceNumberInTransactionAsync(int tenantId)
        {
            const int DEFAULT_STARTING_NUMBER = 1;
            const string ZAYOGA_EMAIL = "info@zayoga.ae";
            var tenant = await _context.Tenants.AsNoTracking()
                .Where(t => t.Id == tenantId)
                .Select(t => new { t.Email, t.Name })
                .FirstOrDefaultAsync();
            var isZayoga = tenant != null && (
                string.Equals(tenant.Email?.Trim(), ZAYOGA_EMAIL, StringComparison.OrdinalIgnoreCase) ||
                (tenant.Name != null && tenant.Name.Trim().Contains("Zayoga", StringComparison.OrdinalIgnoreCase)) ||
                (tenant.Name != null && tenant.Name.Trim().Contains("Zayorga", StringComparison.OrdinalIgnoreCase)));
            var seriesStart = await GetSeriesStartAsync(tenantId);
            if (seriesStart.HasValue)
                return await FormatInvoiceNumberForTenantAsync(await GetNextSeriesNumberAsync(tenantId, seriesStart.Value), tenantId);
            // Every issued number counts (deleted, voided and draft included) so none is ever handed out twice.
            var maxInvoiceNumeric = await _context.Sales.IgnoreQueryFilters()
                .Where(s => s.TenantId == tenantId && !string.IsNullOrEmpty(s.InvoiceNo))
                .Select(s => s.InvoiceNo)
                .ToListAsync();
            var maxNumber = MaxPurelyNumericInvoice(maxInvoiceNumeric, DEFAULT_STARTING_NUMBER - 1);
            int nextNumber = isZayoga ? (maxNumber + 1) : Math.Max(maxNumber + 1, DEFAULT_STARTING_NUMBER);
            return await FormatInvoiceNumberForTenantAsync(nextNumber, tenantId);
        }

        private bool IsPostgres()
        {
            if (!_context.Database.IsRelational())
                return false;
            var conn = _context.Database.GetConnectionString() ?? "";
            return conn.TrimStart().StartsWith("Host=", StringComparison.OrdinalIgnoreCase) ||
                   conn.TrimStart().StartsWith("Server=", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Tenant setting that starts a fresh numbering series (FrozenHub: 7000). 0 is allowed so a tenant can issue a literal first number such as 00000. Absent or invalid keeps the legacy max+1 rule.
        /// </summary>
        private async Task<int?> GetSeriesStartAsync(int tenantId)
        {
            var value = await _context.Settings.AsNoTracking()
                .Where(s => s.Key == SeriesStartSettingKey && (s.TenantId == tenantId || (s.TenantId == null && s.OwnerId == tenantId)))
                .OrderByDescending(s => s.TenantId == tenantId)
                .Select(s => s.Value)
                .FirstOrDefaultAsync();
            return int.TryParse(value?.Trim(), out var start) && start >= 0 && start <= int.MaxValue - SeriesWidth ? start : null;
        }

        /// <summary>
        /// Next number inside [start, start + SeriesWidth). Only purely numeric invoice numbers count, so digits embedded in
        /// test/legacy references (e.g. "FH-SMK-1791254849") or older out-of-range sequences cannot move the series.
        /// Deleted and draft sales are included so an issued number is never handed out again.
        /// </summary>
        private async Task<int> GetNextSeriesNumberAsync(int tenantId, int start)
        {
            var invoiceNumbers = await _context.Sales.IgnoreQueryFilters().AsNoTracking()
                .Where(s => s.TenantId == tenantId && s.InvoiceNo != null && s.InvoiceNo != "")
                .Select(s => s.InvoiceNo)
                .ToListAsync();
            long max = start - 1L;
            foreach (var invoice in invoiceNumbers)
            {
                var trimmed = invoice.Trim();
                if (trimmed.Length == 0 || !trimmed.All(char.IsAsciiDigit) || !long.TryParse(trimmed, out var number))
                    continue;
                if (number >= start && number < (long)start + SeriesWidth)
                    max = Math.Max(max, number);
            }
            if (max + 1 >= (long)start + SeriesWidth)
                throw new InvalidOperationException($"Invoice series starting at {start} is exhausted for tenant {tenantId}.");
            return (int)(max + 1);
        }

        private async Task<string> GenerateNextInvoiceNumberFallbackAsync(int tenantId)
        {
            // New companies: start at 0001. Existing company Zayoga: do not change — use only existing sequence (max+1).
            const int DEFAULT_STARTING_NUMBER = 1;
            const string ZAYOGA_EMAIL = "info@zayoga.ae";
            const int MAX_RETRIES = 50;

            int startingNumber = DEFAULT_STARTING_NUMBER;
            var tenant = await _context.Tenants.AsNoTracking()
                .Where(t => t.Id == tenantId)
                .Select(t => new { t.Email, t.Name })
                .FirstOrDefaultAsync();
            // Zayoga: keep existing sequence (1000, 1001, …); do not apply any minimum
            var isZayoga = tenant != null && (
                string.Equals(tenant.Email?.Trim(), ZAYOGA_EMAIL, StringComparison.OrdinalIgnoreCase) ||
                (tenant.Name != null && tenant.Name.Trim().Contains("Zayoga", StringComparison.OrdinalIgnoreCase)) ||
                (tenant.Name != null && tenant.Name.Trim().Contains("Zayorga", StringComparison.OrdinalIgnoreCase)));

            for (int attempt = 0; attempt < MAX_RETRIES; attempt++)
            {
                try
                {
                    var lockId = 1000000 + tenantId;
                    if (IsPostgres())
                    {
                        // Without the lock two requests could compute the same number, so fail instead of carrying on.
                        try { await _context.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_lock({lockId})"); }
                        catch (Exception lockEx)
                        {
                            throw new InvoiceNumberLockException(
                                $"Could not lock invoice numbering for tenant {tenantId}. The invoice was not numbered; please try again.", lockEx);
                        }
                    }

                    try
                    {
                        var seriesStart = await GetSeriesStartAsync(tenantId);
                        if (seriesStart.HasValue)
                            return await FormatInvoiceNumberForTenantAsync(await GetNextSeriesNumberAsync(tenantId, seriesStart.Value), tenantId);

                        // Every issued number counts (deleted, voided and draft included) so none is ever handed out twice.
                        var maxInvoiceNumeric = await _context.Sales.IgnoreQueryFilters()
                            .Where(s => s.TenantId == tenantId && !string.IsNullOrEmpty(s.InvoiceNo))
                            .Select(s => s.InvoiceNo)
                            .ToListAsync();

                        // Zayoga: use existing sequence only (max+1). Others: at least startingNumber (0001).
                        var maxNumber = MaxPurelyNumericInvoice(maxInvoiceNumeric, startingNumber - 1);
                        int nextNumber = isZayoga ? (maxNumber + 1) : Math.Max(maxNumber + 1, startingNumber);

                        var generatedInvoice = await FormatInvoiceNumberForTenantAsync(nextNumber, tenantId);
                        // Any issued number (deleted, voided or draft included) is never handed out again.
                        var exists = await _context.Sales.IgnoreQueryFilters()
                            .Where(s => s.TenantId == tenantId && s.InvoiceNo == generatedInvoice)
                            .AnyAsync();

                        if (!exists)
                            return generatedInvoice;

                        await Task.Delay(_random.Next(10, 100));
                    }
                    finally
                    {
                        if (IsPostgres())
                        {
                            try { await _context.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_unlock({lockId})"); }
                            catch { /* ignore */ }
                        }
                    }
                }
                catch (Exception ex) when (ex is not InvoiceNumberLockException)
                {
                    if (attempt == MAX_RETRIES - 1) throw;
                    _ = ex; // avoid CS0168 unused variable
                    await Task.Delay(_random.Next(50, 150));
                }
            }

            throw new InvalidOperationException($"Unable to generate unique invoice number for owner {tenantId} after {MAX_RETRIES} attempts. This may be due to high concurrent activity. Please try again.");
        }

        public Task<string> FormatInvoiceNumberAsync(int number)
        {
            // Format as 0001, 0002, etc. (no INV prefix)
            return Task.FromResult(number.ToString("D" + DefaultWidth));
        }

        /// <summary>Pads to the tenant's INVOICE_NUMBER_WIDTH (4-9 digits, default 4). Longer numbers are never truncated.</summary>
        public async Task<string> FormatInvoiceNumberForTenantAsync(int number, int tenantId)
        {
            var value = await _context.Settings.AsNoTracking()
                .Where(s => s.Key == NumberWidthSettingKey && (s.TenantId == tenantId || (s.TenantId == null && s.OwnerId == tenantId)))
                .OrderByDescending(s => s.TenantId == tenantId)
                .Select(s => s.Value)
                .FirstOrDefaultAsync();
            var width = int.TryParse(value?.Trim(), out var w) && w >= DefaultWidth && w <= 9 ? w : DefaultWidth;
            return number.ToString("D" + width);
        }

        /// <summary>
        /// Highest invoice number that is digits only. References with embedded digits (e.g. smoke "FH-SMK-1791254849")
        /// or prefixes never move the sequence.
        /// </summary>
        internal static int MaxPurelyNumericInvoice(IEnumerable<string> invoiceNumbers, int floor)
        {
            var max = floor;
            foreach (var invoice in invoiceNumbers)
            {
                var trimmed = invoice?.Trim() ?? "";
                if (trimmed.Length > 0 && trimmed.All(char.IsAsciiDigit) && int.TryParse(trimmed, out var n))
                    max = Math.Max(max, n);
            }
            return max;
        }

        public async Task<bool> ValidateInvoiceNumberAsync(string invoiceNumber, int tenantId, int? excludeSaleId = null) =>
            await GetManualInvoiceNumberProblemAsync(invoiceNumber, tenantId, excludeSaleId) == null;

        public async Task<string?> GetManualInvoiceNumberProblemAsync(string invoiceNumber, int tenantId, int? excludeSaleId = null)
        {
            if (string.IsNullOrWhiteSpace(invoiceNumber))
                return "Enter an invoice number.";

            // Check format: #### (4 or more digits, no prefix required)
            var trimmed = invoiceNumber.Trim();
            if (!Regex.IsMatch(trimmed, @"^\d{4,}$"))
                return "Invoice numbers use digits only, at least 4 (for example 7000).";
            if (!long.TryParse(trimmed, out var invoiceNum) || invoiceNum < 1)
                return "Invoice number must be 1 or higher.";

            var seriesStart = await GetSeriesStartAsync(tenantId);
            if (seriesStart.HasValue)
            {
                // Numbers below the series belong to earlier (e.g. migrated Starplus) invoices and stay theirs.
                if (invoiceNum < seriesStart.Value)
                    return $"Numbers below {seriesStart.Value} are kept for earlier invoices. Use {seriesStart.Value} or higher.";
                // An issued number is never handed out again, even after the invoice was deleted or voided.
                var issued = _context.Sales.IgnoreQueryFilters().Where(s => s.TenantId == tenantId && s.InvoiceNo == trimmed);
                if (excludeSaleId.HasValue) issued = issued.Where(s => s.Id != excludeSaleId.Value);
                if (await issued.AnyAsync())
                    return $"Invoice number {trimmed} was already issued (including deleted or voided invoices) and cannot be used again.";
                return null;
            }

            // CRITICAL: Check for duplicates within owner's scope
            return await IsInvoiceNumberDuplicateAsync(trimmed, tenantId, excludeSaleId)
                ? $"Invoice number {trimmed} is already used by another invoice."
                : null;
        }

        public async Task<bool> IsInvoiceNumberDuplicateAsync(string invoiceNumber, int tenantId, int? excludeSaleId = null)
        {
            if (string.IsNullOrWhiteSpace(invoiceNumber))
                return false;

            var normalizedInvoice = invoiceNumber.Trim();

            // CRITICAL: Check duplicates only within owner's scope
            // Deleted and voided invoices keep their numbers: a number is issued once per tenant, forever.
            var query = _context.Sales.IgnoreQueryFilters()
                .Where(s => s.TenantId == tenantId && s.InvoiceNo == normalizedInvoice);

            if (excludeSaleId.HasValue)
            {
                query = query.Where(s => s.Id != excludeSaleId.Value);
            }

            return await query.AnyAsync();
        }
    }

    /// <summary>Raised when the per-tenant numbering lock cannot be taken; numbering must not proceed unlocked.</summary>
    public class InvoiceNumberLockException : InvalidOperationException
    {
        public InvoiceNumberLockException(string message, Exception inner) : base(message, inner) { }
    }
}
