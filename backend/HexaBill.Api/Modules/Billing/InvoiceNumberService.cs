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

namespace HexaBill.Api.Modules.Billing
{
    public interface IInvoiceNumberService
    {
        // MULTI-TENANT: Invoice number generation is now tenant-scoped
        Task<string> GenerateNextInvoiceNumberAsync(int tenantId);
        Task<bool> ValidateInvoiceNumberAsync(string invoiceNumber, int tenantId, int? excludeSaleId = null);
        Task<string> FormatInvoiceNumberAsync(int number);
        Task<bool> IsInvoiceNumberDuplicateAsync(string invoiceNumber, int tenantId, int? excludeSaleId = null);
    }

    public class InvoiceNumberService : IInvoiceNumberService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private static readonly SemaphoreSlim _semaphore = new SemaphoreSlim(1, 1);
        private static readonly Random _random = new Random();

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
        
        private bool IsPostgres()
        {
            var conn = _context.Database.GetConnectionString() ?? "";
            return conn.TrimStart().StartsWith("Host=", StringComparison.OrdinalIgnoreCase) ||
                   conn.TrimStart().StartsWith("Server=", StringComparison.OrdinalIgnoreCase);
        }

        private async Task<string> GenerateNextInvoiceNumberFallbackAsync(int tenantId)
        {
            const int STARTING_INVOICE_NUMBER = 1000;
            const int MAX_RETRIES = 50;

            for (int attempt = 0; attempt < MAX_RETRIES; attempt++)
            {
                try
                {
                    var lockId = 1000000 + tenantId;
                    if (IsPostgres())
                    {
                        try { await _context.Database.ExecuteSqlRawAsync($"SELECT pg_advisory_lock({lockId})"); }
                        catch { /* ignore */ }
                    }

                    try
                    {
                        var maxInvoiceNumeric = await _context.Sales
                            .Where(s => s.TenantId == tenantId && !s.IsDeleted && s.IsFinalized && !string.IsNullOrEmpty(s.InvoiceNo))
                            .Select(s => s.InvoiceNo)
                            .ToListAsync();

                        int nextNumber = STARTING_INVOICE_NUMBER;
                        if (maxInvoiceNumeric.Any())
                        {
                            int maxNumber = STARTING_INVOICE_NUMBER - 1;
                            foreach (var invoice in maxInvoiceNumeric)
                            {
                                var numericPart = new string(invoice.Trim().Where(char.IsDigit).ToArray());
                                if (!string.IsNullOrEmpty(numericPart) && int.TryParse(numericPart, out int invoiceNum))
                                    maxNumber = Math.Max(maxNumber, invoiceNum);
                            }
                            nextNumber = Math.Max(maxNumber + 1, STARTING_INVOICE_NUMBER);
                        }

                        var generatedInvoice = await FormatInvoiceNumberAsync(nextNumber);
                        var exists = await _context.Sales
                            .Where(s => s.TenantId == tenantId && !s.IsDeleted && s.IsFinalized && s.InvoiceNo == generatedInvoice)
                            .AnyAsync();

                        if (!exists)
                            return generatedInvoice;

                        await Task.Delay(_random.Next(10, 100));
                    }
                    finally
                    {
                        if (IsPostgres())
                        {
                            try { await _context.Database.ExecuteSqlRawAsync($"SELECT pg_advisory_unlock({lockId})"); }
                            catch { /* ignore */ }
                        }
                    }
                }
                catch (Exception ex)
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
            return Task.FromResult($"{number:D4}");
        }

        public async Task<bool> ValidateInvoiceNumberAsync(string invoiceNumber, int tenantId, int? excludeSaleId = null)
        {
            if (string.IsNullOrWhiteSpace(invoiceNumber))
                return false;

            // Check format: #### (4 or more digits, no prefix required)
            var isValidFormat = Regex.IsMatch(invoiceNumber.Trim(), @"^\d{4,}$", RegexOptions.IgnoreCase);
            if (!isValidFormat)
                return false;

            // Extract numeric value to check minimum
            var numericPart = new string(invoiceNumber.Trim().Where(char.IsDigit).ToArray());
            if (int.TryParse(numericPart, out int invoiceNum))
            {
                // CLIENT REQUIREMENT: Invoice numbers must be >= 1000
                if (invoiceNum < 1000)
                    return false;
            }

            // CRITICAL: Check for duplicates within owner's scope
            var isDuplicate = await IsInvoiceNumberDuplicateAsync(invoiceNumber, tenantId, excludeSaleId);
            return !isDuplicate;
        }

        public async Task<bool> IsInvoiceNumberDuplicateAsync(string invoiceNumber, int tenantId, int? excludeSaleId = null)
        {
            if (string.IsNullOrWhiteSpace(invoiceNumber))
                return false;

            var normalizedInvoice = invoiceNumber.Trim();

            // CRITICAL: Check duplicates only within owner's scope
            var query = _context.Sales
                .Where(s => s.TenantId == tenantId && !s.IsDeleted && s.InvoiceNo == normalizedInvoice);

            if (excludeSaleId.HasValue)
            {
                query = query.Where(s => s.Id != excludeSaleId.Value);
            }

            return await query.AnyAsync();
        }
    }
}

