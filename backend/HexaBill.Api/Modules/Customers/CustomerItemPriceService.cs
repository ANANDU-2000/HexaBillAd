using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HexaBill.Api.Modules.Customers
{
    public class CustomerItemPriceDto
    {
        public int ProductId { get; set; }
        public decimal LastUnitPrice { get; set; }
        public int? LastSaleId { get; set; }
        public DateTime LastSaleDate { get; set; }
    }

    public interface ICustomerItemPriceService
    {
        Task<List<CustomerItemPriceDto>> GetPricesAsync(int tenantId, int customerId, IReadOnlyList<int>? productIds, CancellationToken ct = default);
        Task UpsertFromSaleItemsAsync(int tenantId, int customerId, int saleId, DateTime saleDate, IEnumerable<(int ProductId, decimal UnitPrice)> lines, CancellationToken ct = default);
    }

    public class CustomerItemPriceService : ICustomerItemPriceService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<CustomerItemPriceService> _logger;

        public CustomerItemPriceService(AppDbContext context, ILogger<CustomerItemPriceService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<CustomerItemPriceDto>> GetPricesAsync(
            int tenantId,
            int customerId,
            IReadOnlyList<int>? productIds,
            CancellationToken ct = default)
        {
            var q = _context.CustomerItemPrices.AsNoTracking()
                .Where(p => p.TenantId == tenantId && p.CustomerId == customerId);
            if (productIds != null && productIds.Count > 0)
            {
                var ids = productIds.Distinct().ToList();
                q = q.Where(p => ids.Contains(p.ProductId));
            }

            return await q
                .Select(p => new CustomerItemPriceDto
                {
                    ProductId = p.ProductId,
                    LastUnitPrice = p.LastUnitPrice,
                    LastSaleId = p.LastSaleId,
                    LastSaleDate = p.LastSaleDate
                })
                .ToListAsync(ct);
        }

        /// <summary>
        /// Upsert last exclusive unit price per product. Call inside the sale create transaction.
        /// Sale returns / voids must NOT call this to roll back (by design).
        /// </summary>
        public async Task UpsertFromSaleItemsAsync(
            int tenantId,
            int customerId,
            int saleId,
            DateTime saleDate,
            IEnumerable<(int ProductId, decimal UnitPrice)> lines,
            CancellationToken ct = default)
        {
            try
            {
                var byProduct = lines
                    .Where(l => l.ProductId > 0)
                    .GroupBy(l => l.ProductId)
                    .Select(g => g.Last())
                    .ToList();
                if (byProduct.Count == 0) return;

                var productIds = byProduct.Select(x => x.ProductId).ToList();
                var existing = await _context.CustomerItemPrices
                    .Where(p => p.TenantId == tenantId && p.CustomerId == customerId && productIds.Contains(p.ProductId))
                    .ToListAsync(ct);
                var map = existing.ToDictionary(e => e.ProductId);
                var now = DateTime.UtcNow;

                foreach (var line in byProduct)
                {
                    if (map.TryGetValue(line.ProductId, out var row))
                    {
                        row.LastUnitPrice = line.UnitPrice;
                        row.LastSaleId = saleId;
                        row.LastSaleDate = saleDate;
                        row.UpdatedAt = now;
                    }
                    else
                    {
                        _context.CustomerItemPrices.Add(new CustomerItemPrice
                        {
                            TenantId = tenantId,
                            CustomerId = customerId,
                            ProductId = line.ProductId,
                            LastUnitPrice = line.UnitPrice,
                            LastSaleId = saleId,
                            LastSaleDate = saleDate,
                            UpdatedAt = now
                        });
                    }
                }

                await _context.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CustomerItemPrice upsert failed tenant={TenantId} customer={CustomerId} sale={SaleId}",
                    tenantId, customerId, saleId);
                throw;
            }
        }
    }
}
