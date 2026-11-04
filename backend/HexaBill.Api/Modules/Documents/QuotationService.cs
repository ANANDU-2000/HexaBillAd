/*
Purpose: Quotation CRUD with server-side line/tax totals (never trust client grand total)
Feature flag: Feature_QuotesAgreements (default off until enabled in Settings)
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;

namespace HexaBill.Api.Modules.Documents
{
    public interface IQuotationService
    {
        Task<List<QuotationDto>> ListAsync(int tenantId);
        Task<QuotationDto?> GetByIdAsync(int id, int tenantId);
        Task<QuotationDto> CreateAsync(CreateQuotationRequest request, int userId, int tenantId);
        Task<QuotationDto?> UpdateAsync(int id, UpdateQuotationRequest request, int userId, int tenantId);
        Task<bool> DeleteAsync(int id, int userId, int tenantId);
        Task<string> PeekNextQuoteNoAsync(int tenantId);
        Task<QuotationDefaultsDto> GetDefaultsAsync(int tenantId);
    }

    public class QuotationService : IQuotationService
    {
        private readonly AppDbContext _context;
        private readonly IQuoteNumberService _quoteNumbers;
        private readonly ISettingsService _settings;
        private readonly ILogger<QuotationService> _logger;

        public QuotationService(
            AppDbContext context,
            IQuoteNumberService quoteNumbers,
            ISettingsService settings,
            ILogger<QuotationService> logger)
        {
            _context = context;
            _quoteNumbers = quoteNumbers;
            _settings = settings;
            _logger = logger;
        }

        public async Task<string> PeekNextQuoteNoAsync(int tenantId)
            => await _quoteNumbers.GenerateNextQuoteNumberAsync(tenantId);

        public async Task<QuotationDefaultsDto> GetDefaultsAsync(int tenantId)
        {
            var validRaw = await _settings.GetSettingValueAsync(tenantId, "QUOTE_VALID_DAYS");
            var terms = await _settings.GetSettingValueAsync(tenantId, "QUOTE_TERMS");
            return new QuotationDefaultsDto
            {
                NextQuoteNo = await _quoteNumbers.GenerateNextQuoteNumberAsync(tenantId),
                ValidDays = int.TryParse(validRaw, out var d) && d > 0 && d <= 365 ? d : 30,
                Terms = terms?.Trim() ?? string.Empty,
                VatPercent = await GetVatPercentAsync(tenantId)
            };
        }

        public async Task<List<QuotationDto>> ListAsync(int tenantId)
        {
            var list = await _context.Quotations
                .AsNoTracking()
                .Include(q => q.Items)
                .Where(q => q.TenantId == tenantId && !q.IsDeleted)
                .OrderByDescending(q => q.QuoteDate)
                .ThenByDescending(q => q.Id)
                .ToListAsync();
            return list.Select(Map).ToList();
        }

        public async Task<QuotationDto?> GetByIdAsync(int id, int tenantId)
        {
            var q = await _context.Quotations
                .AsNoTracking()
                .Include(x => x.Items)
                .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && !x.IsDeleted);
            return q == null ? null : Map(q);
        }

        public async Task<QuotationDto> CreateAsync(CreateQuotationRequest request, int userId, int tenantId)
        {
            try
            {
                var vatPercent = await GetVatPercentAsync(tenantId);
                var (items, subtotal, vatTotal, grandTotal) = ComputeTotals(request.Items, request.Discount, vatPercent);
                var quoteNo = await _quoteNumbers.GenerateNextQuoteNumberAsync(tenantId);
                var status = NormalizeStatus(request.Status);

                var entity = new Quotation
                {
                    OwnerId = tenantId,
                    TenantId = tenantId,
                    QuoteNo = quoteNo,
                    QuoteDate = ToUtcDate(request.QuoteDate),
                    CustomerName = request.CustomerName?.Trim(),
                    CustomerAddress = request.CustomerAddress?.Trim(),
                    CustomerPhone = request.CustomerPhone?.Trim(),
                    CustomerEmail = request.CustomerEmail?.Trim(),
                    CustomerId = request.CustomerId,
                    CustomerTrn = request.CustomerTrn?.Trim(),
                    ValidUntil = request.ValidUntil.HasValue ? ToUtcDate(request.ValidUntil) : null,
                    Subject = request.Subject?.Trim(),
                    TermsAndConditions = string.IsNullOrWhiteSpace(request.TermsAndConditions) ? null : request.TermsAndConditions.Trim(),
                    Subtotal = subtotal,
                    VatTotal = vatTotal,
                    Discount = request.Discount,
                    GrandTotal = grandTotal,
                    Status = status,
                    Notes = request.Notes,
                    Salutation = NormalizeText(request.Salutation, QuotationDefaults.Salutation),
                    IntroLine = NormalizeText(request.IntroLine, QuotationDefaults.IntroLine),
                    ClosingLine = NormalizeText(request.ClosingLine, QuotationDefaults.ClosingLine),
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow,
                    Items = items
                };

                // Max+1 numbering can race with a concurrent save; retry on the unique (TenantId, QuoteNo) index.
                for (var attempt = 1; ; attempt++)
                {
                    _context.Quotations.Add(entity);
                    try
                    {
                        await _context.SaveChangesAsync();
                        break;
                    }
                    catch (DbUpdateException ex) when (attempt < 5 && ex.InnerException is Npgsql.PostgresException { SqlState: "23505" })
                    {
                        _context.ChangeTracker.Clear();
                        entity.Id = 0;
                        foreach (var it in entity.Items) it.Id = 0;
                        entity.QuoteNo = await _quoteNumbers.GenerateNextQuoteNumberAsync(tenantId);
                        quoteNo = entity.QuoteNo;
                    }
                }
                _logger.LogInformation("Quotation {QuoteNo} created for tenant {TenantId}", quoteNo, tenantId);
                return Map(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create quotation for tenant {TenantId}", tenantId);
                throw;
            }
        }

        public async Task<QuotationDto?> UpdateAsync(int id, UpdateQuotationRequest request, int userId, int tenantId)
        {
            try
            {
                var entity = await _context.Quotations
                    .Include(q => q.Items)
                    .FirstOrDefaultAsync(q => q.Id == id && q.TenantId == tenantId && !q.IsDeleted);
                if (entity == null) return null;

                var vatPercent = await GetVatPercentAsync(tenantId);
                var (items, subtotal, vatTotal, grandTotal) = ComputeTotals(request.Items, request.Discount, vatPercent);

                entity.QuoteDate = request.QuoteDate.HasValue
                    ? ToUtcDate(request.QuoteDate)
                    : ToUtcDate(entity.QuoteDate);
                entity.CustomerName = request.CustomerName?.Trim();
                entity.CustomerAddress = request.CustomerAddress?.Trim();
                entity.CustomerPhone = request.CustomerPhone?.Trim();
                entity.CustomerEmail = request.CustomerEmail?.Trim();
                entity.CustomerId = request.CustomerId;
                entity.CustomerTrn = request.CustomerTrn?.Trim();
                entity.ValidUntil = request.ValidUntil.HasValue ? ToUtcDate(request.ValidUntil) : null;
                entity.Subject = request.Subject?.Trim();
                entity.TermsAndConditions = string.IsNullOrWhiteSpace(request.TermsAndConditions) ? null : request.TermsAndConditions.Trim();
                entity.Subtotal = subtotal;
                entity.VatTotal = vatTotal;
                entity.Discount = request.Discount;
                entity.GrandTotal = grandTotal;
                entity.Status = NormalizeStatus(request.Status);
                entity.Notes = request.Notes;
                entity.Salutation = NormalizeText(request.Salutation, QuotationDefaults.Salutation);
                entity.IntroLine = NormalizeText(request.IntroLine, QuotationDefaults.IntroLine);
                entity.ClosingLine = NormalizeText(request.ClosingLine, QuotationDefaults.ClosingLine);
                entity.LastModifiedBy = userId;
                entity.LastModifiedAt = DateTime.UtcNow;

                _context.QuotationItems.RemoveRange(entity.Items);
                entity.Items = items;

                await _context.SaveChangesAsync();
                return Map(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update quotation {Id} for tenant {TenantId}", id, tenantId);
                throw;
            }
        }

        public async Task<bool> DeleteAsync(int id, int userId, int tenantId)
        {
            try
            {
                var entity = await _context.Quotations
                    .FirstOrDefaultAsync(q => q.Id == id && q.TenantId == tenantId && !q.IsDeleted);
                if (entity == null) return false;
                entity.IsDeleted = true;
                entity.DeletedBy = userId;
                entity.DeletedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete quotation {Id} for tenant {TenantId}", id, tenantId);
                throw;
            }
        }

        /// <summary>
        /// Line VAT uses MidpointRounding.ToEven so 10×4.25@5% → Tax 2.12, Line 44.62 (matches sample Quote).
        /// </summary>
        internal static (List<QuotationItem> items, decimal subtotal, decimal vatTotal, decimal grandTotal)
            ComputeTotals(List<QuotationItemRequest> requests, decimal discount, decimal defaultVatPercent)
        {
            var items = new List<QuotationItem>();
            decimal subtotal = 0;
            decimal vatTotal = 0;
            var order = 0;
            foreach (var r in requests)
            {
                var rate = r.VatRate.HasValue && r.VatRate.Value > 0 ? r.VatRate.Value : defaultVatPercent;
                var lineNet = Math.Round(r.Qty * r.UnitPrice, 2, MidpointRounding.AwayFromZero);
                var vatAmount = Math.Round(lineNet * (rate / 100m), 2, MidpointRounding.ToEven);
                var lineTotal = Math.Round(lineNet + vatAmount, 2, MidpointRounding.AwayFromZero);
                items.Add(new QuotationItem
                {
                    ProductId = r.ProductId,
                    Description = r.Description.Trim(),
                    DescriptionSubtitle = string.IsNullOrWhiteSpace(r.DescriptionSubtitle) ? null : r.DescriptionSubtitle.Trim(),
                    UnitLabel = string.IsNullOrWhiteSpace(r.UnitLabel) ? "Pcs" : r.UnitLabel.Trim(),
                    Qty = r.Qty,
                    UnitPrice = r.UnitPrice,
                    VatRate = rate,
                    VatAmount = vatAmount,
                    LineTotal = lineTotal,
                    SortOrder = order++
                });
                subtotal += lineNet;
                vatTotal += vatAmount;
            }
            subtotal = Math.Round(subtotal, 2, MidpointRounding.AwayFromZero);
            vatTotal = Math.Round(vatTotal, 2, MidpointRounding.AwayFromZero);
            var grand = Math.Round(subtotal + vatTotal - discount, 2, MidpointRounding.AwayFromZero);
            return (items, subtotal, vatTotal, grand);
        }

        private async Task<decimal> GetVatPercentAsync(int tenantId)
        {
            var raw = await _settings.GetSettingValueAsync(tenantId, "VAT_PERCENT");
            return decimal.TryParse(raw, out var v) && v >= 0 ? v : 5m;
        }

        internal static readonly string[] AllowedStatuses = { "Draft", "Final", "Sent", "Accepted", "Rejected", "Expired" };

        private static string NormalizeStatus(string? status)
        {
            foreach (var allowed in AllowedStatuses)
                if (string.Equals(status, allowed, StringComparison.OrdinalIgnoreCase)) return allowed;
            return "Draft";
        }

        private static string NormalizeText(string? value, string fallback)
            => string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();

        /// <summary>Npgsql timestamptz rejects Unspecified Kind from .Date — always store UTC midnight.</summary>
        private static DateTime ToUtcDate(DateTime? value)
        {
            var d = value ?? DateTime.UtcNow;
            return new DateTime(d.Year, d.Month, d.Day, 0, 0, 0, DateTimeKind.Utc);
        }

        private static QuotationDto Map(Quotation q) => new()
        {
            Id = q.Id,
            QuoteNo = q.QuoteNo,
            QuoteDate = q.QuoteDate,
            CustomerName = q.CustomerName,
            CustomerAddress = q.CustomerAddress,
            CustomerPhone = q.CustomerPhone,
            CustomerEmail = q.CustomerEmail,
            CustomerId = q.CustomerId,
            CustomerTrn = q.CustomerTrn,
            ValidUntil = q.ValidUntil,
            Subject = q.Subject,
            TermsAndConditions = q.TermsAndConditions,
            Subtotal = q.Subtotal,
            VatTotal = q.VatTotal,
            Discount = q.Discount,
            GrandTotal = q.GrandTotal,
            Status = q.Status,
            Notes = q.Notes,
            Salutation = string.IsNullOrWhiteSpace(q.Salutation) ? QuotationDefaults.Salutation : q.Salutation,
            IntroLine = string.IsNullOrWhiteSpace(q.IntroLine) ? QuotationDefaults.IntroLine : q.IntroLine,
            ClosingLine = string.IsNullOrWhiteSpace(q.ClosingLine) ? QuotationDefaults.ClosingLine : q.ClosingLine,
            CreatedAt = q.CreatedAt,
            Items = q.Items.OrderBy(i => i.SortOrder).Select(i => new QuotationItemDto
            {
                Id = i.Id,
                ProductId = i.ProductId,
                Description = i.Description,
                DescriptionSubtitle = i.DescriptionSubtitle,
                UnitLabel = i.UnitLabel,
                Qty = i.Qty,
                UnitPrice = i.UnitPrice,
                VatRate = i.VatRate,
                VatAmount = i.VatAmount,
                LineTotal = i.LineTotal,
                SortOrder = i.SortOrder
            }).ToList()
        };
    }
}
