/*
Purpose: Server-side Quote-{n} numbering (tenant-scoped max+1)
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;

namespace HexaBill.Api.Modules.Documents
{
    public interface IQuoteNumberService
    {
        Task<string> GenerateNextQuoteNumberAsync(int tenantId);
    }

    public class QuoteNumberService : IQuoteNumberService
    {
        private readonly AppDbContext _context;

        public QuoteNumberService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<string> GenerateNextQuoteNumberAsync(int tenantId)
        {
            var existing = await _context.Quotations
                .Where(q => q.TenantId == tenantId && !q.IsDeleted && !string.IsNullOrEmpty(q.QuoteNo))
                .Select(q => q.QuoteNo)
                .ToListAsync();

            var max = 0;
            foreach (var no in existing)
            {
                var digits = no.StartsWith("Quote-", StringComparison.OrdinalIgnoreCase)
                    ? no.Substring(6)
                    : no;
                if (int.TryParse(digits, out var n) && n > max)
                    max = n;
            }

            return $"Quote-{max + 1}";
        }
    }
}
