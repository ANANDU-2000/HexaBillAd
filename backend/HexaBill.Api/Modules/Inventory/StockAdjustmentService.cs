/*
Purpose: Stock adjustment service for manual stock corrections
Author: AI Assistant
Date: 2025
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Inventory
{
    public interface IStockAdjustmentService
    {
        Task<StockAdjustmentDto> CreateAdjustmentAsync(CreateStockAdjustmentRequest request, int userId, int tenantId);
        Task<List<StockAdjustmentDto>> GetAdjustmentsAsync(int? productId = null, DateTime? fromDate = null, DateTime? toDate = null, int? tenantId = null);
    }

    public class StockAdjustmentService : IStockAdjustmentService
    {
        private readonly AppDbContext _context;

        public StockAdjustmentService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<StockAdjustmentDto> CreateAdjustmentAsync(CreateStockAdjustmentRequest request, int userId, int tenantId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var product = await _context.Products
                    .FirstOrDefaultAsync(p => p.Id == request.ProductId && p.TenantId == tenantId);
                if (product == null)
                    throw new InvalidOperationException("Product not found or does not belong to your company.");

                var oldStock = product.StockQty;
                var adjustment = request.NewStock - oldStock;

                // Update stock
                product.StockQty = request.NewStock;
                product.UpdatedAt = DateTime.UtcNow;

                // Create inventory transaction
                var inventoryTransaction = new InventoryTransaction
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    ProductId = request.ProductId,
                    ChangeQty = adjustment,
                    TransactionType = TransactionType.Adjustment,
                    Reason = $"Stock Adjustment: {request.Reason ?? "Manual correction"}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.InventoryTransactions.Add(inventoryTransaction);

                // Create audit log
                var auditLog = new AuditLog
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    UserId = userId,
                    Action = "Stock Adjusted",
                    Details = $"Product: {product.NameEn}, Old Stock: {oldStock}, New Stock: {request.NewStock}, Reason: {request.Reason}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.AuditLogs.Add(auditLog);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return new StockAdjustmentDto
                {
                    Id = inventoryTransaction.Id,
                    ProductId = product.Id,
                    ProductName = product.NameEn,
                    OldStock = oldStock,
                    NewStock = request.NewStock,
                    Adjustment = adjustment,
                    Reason = request.Reason,
                    AdjustedBy = userId,
                    AdjustedAt = DateTime.UtcNow
                };
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<List<StockAdjustmentDto>> GetAdjustmentsAsync(int? productId = null, DateTime? fromDate = null, DateTime? toDate = null, int? tenantId = null)
        {
            var query = _context.InventoryTransactions
                .Include(it => it.Product)
                .Where(it => it.TransactionType == TransactionType.Adjustment)
                .AsQueryable();

            if (tenantId.HasValue && tenantId.Value > 0)
            {
                query = query.Where(it => it.Product != null && it.Product.TenantId == tenantId.Value);
            }

            if (productId.HasValue)
            {
                query = query.Where(it => it.ProductId == productId.Value);
            }

            if (fromDate.HasValue)
            {
                query = query.Where(it => it.CreatedAt >= fromDate.Value);
            }

            if (toDate.HasValue)
            {
                query = query.Where(it => it.CreatedAt <= toDate.Value.AddDays(1));
            }

            var adjustments = await query
                .OrderByDescending(it => it.CreatedAt)
                .ToListAsync();

            return adjustments.Select(a => new StockAdjustmentDto
            {
                Id = a.Id,
                ProductId = a.ProductId,
                ProductName = a.Product?.NameEn ?? "",
                OldStock = a.Product?.StockQty ?? 0, // Note: This is current stock, not historical
                NewStock = (a.Product?.StockQty ?? 0) - a.ChangeQty, // Calculate old from change
                Adjustment = a.ChangeQty,
                Reason = a.Reason,
                AdjustedAt = a.CreatedAt
            }).ToList();
        }
    }

    // DTOs
    public class CreateStockAdjustmentRequest
    {
        public int ProductId { get; set; }
        public decimal NewStock { get; set; }
        public string? Reason { get; set; }
    }

    public class StockAdjustmentDto
    {
        public int Id { get; set; }
        public int ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public decimal OldStock { get; set; }
        public decimal NewStock { get; set; }
        public decimal Adjustment { get; set; }
        public string? Reason { get; set; }
        public int? AdjustedBy { get; set; }
        public DateTime AdjustedAt { get; set; }
    }
}

