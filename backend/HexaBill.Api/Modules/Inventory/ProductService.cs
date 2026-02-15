/*
Purpose: Product service for inventory management
Author: AI Assistant
Date: 2024
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.Inventory
{
    public interface IProductService
    {
        // MULTI-TENANT: All methods now require tenantId for data isolation
        Task<PagedResponse<ProductDto>> GetProductsAsync(int tenantId, int page = 1, int pageSize = 10, string? search = null, bool lowStock = false, string? unitType = null);
        Task<ProductDto?> GetProductByIdAsync(int id, int tenantId);
        Task<ProductDto> CreateProductAsync(CreateProductRequest request, int tenantId);
        Task<ProductDto?> UpdateProductAsync(int id, CreateProductRequest request, int tenantId, int? userId = null);
        Task<bool> DeleteProductAsync(int id, int tenantId);
        Task<bool> AdjustStockAsync(int productId, decimal changeQty, string reason, int userId, int tenantId);
        Task<List<ProductDto>> GetLowStockProductsAsync(int tenantId);
        Task<List<ProductDto>> SearchProductsAsync(string query, int tenantId, int limit = 20);
        Task<List<PriceChangeLogDto>> GetPriceChangeHistoryAsync(int productId, int tenantId);
        Task<int> ResetAllStockAsync(int userId, int tenantId);
    }

    public class ProductService : IProductService
    {
        private readonly AppDbContext _context;

        public ProductService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<PagedResponse<ProductDto>> GetProductsAsync(int tenantId, int page = 1, int pageSize = 10, string? search = null, bool lowStock = false, string? unitType = null)
        {
            // CRITICAL: Filter by tenantId for data isolation
            var query = _context.Products
                .Where(p => p.TenantId == tenantId)
                .AsQueryable();

            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(p => p.NameEn.Contains(search) || 
                                       p.NameAr!.Contains(search) || 
                                       p.Sku.Contains(search));
            }

            if (lowStock)
            {
                query = query.Where(p => p.StockQty <= p.ReorderLevel);
            }

            if (!string.IsNullOrEmpty(unitType))
            {
                query = query.Where(p => p.UnitType == unitType);
            }

            var totalCount = await query.CountAsync();
            var products = await query
                .OrderBy(p => p.NameEn)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new ProductDto
                {
                    Id = p.Id,
                    Sku = p.Sku,
                    NameEn = p.NameEn,
                    NameAr = p.NameAr,
                    UnitType = p.UnitType,
                    ConversionToBase = p.ConversionToBase,
                    CostPrice = p.CostPrice,
                    SellPrice = p.SellPrice,
                    StockQty = p.StockQty,
                    ReorderLevel = p.ReorderLevel,
                    ExpiryDate = p.ExpiryDate,
                    DescriptionEn = p.DescriptionEn,
                    DescriptionAr = p.DescriptionAr
                })
                .ToListAsync();

            return new PagedResponse<ProductDto>
            {
                Items = products,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            };
        }

        public async Task<ProductDto?> GetProductByIdAsync(int id, int tenantId)
        {
            // CRITICAL: Verify product belongs to owner
            var product = await _context.Products
                .Where(p => p.Id == id && p.TenantId == tenantId)
                .FirstOrDefaultAsync();
                
            if (product == null) return null;

            return new ProductDto
            {
                Id = product.Id,
                Sku = product.Sku,
                NameEn = product.NameEn,
                NameAr = product.NameAr,
                UnitType = product.UnitType,
                ConversionToBase = product.ConversionToBase,
                CostPrice = product.CostPrice,
                SellPrice = product.SellPrice,
                StockQty = product.StockQty,
                ReorderLevel = product.ReorderLevel,
                ExpiryDate = product.ExpiryDate,
                DescriptionEn = product.DescriptionEn,
                DescriptionAr = product.DescriptionAr
            };
        }

        public async Task<ProductDto> CreateProductAsync(CreateProductRequest request, int tenantId)
        {
            // Validate input
            if (string.IsNullOrWhiteSpace(request.NameEn))
                throw new InvalidOperationException("Product name is required");
            
            if (!InputValidator.ValidateSKU(request.Sku))
                throw new InvalidOperationException("Invalid SKU format");
            
            if (!InputValidator.ValidatePrice(request.SellPrice) || !InputValidator.ValidatePrice(request.CostPrice))
                throw new InvalidOperationException("Invalid price. Prices must be between 0 and 1,000,000");

            // CRITICAL: Check SKU uniqueness within owner's scope only
            if (await _context.Products.AnyAsync(p => p.Sku == request.Sku && p.TenantId == tenantId))
            {
                throw new InvalidOperationException("SKU already exists");
            }

            var product = new Product
            {
                TenantId = tenantId,
                OwnerId = tenantId,
                Sku = InputValidator.SanitizeString(request.Sku, 50),
                NameEn = InputValidator.SanitizeString(request.NameEn, 200),
                NameAr = InputValidator.SanitizeString(request.NameAr, 200),
                UnitType = InputValidator.SanitizeString(request.UnitType, 50),
                ConversionToBase = request.ConversionToBase > 0 ? request.ConversionToBase : 1,
                CostPrice = request.CostPrice >= 0 ? request.CostPrice : 0,
                SellPrice = request.SellPrice >= 0 ? request.SellPrice : 0,
                StockQty = request.StockQty >= 0 ? request.StockQty : 0,
                ReorderLevel = request.ReorderLevel >= 0 ? request.ReorderLevel : 0,
                ExpiryDate = request.ExpiryDate.HasValue ? request.ExpiryDate.Value.ToUtcKind() : null,
                DescriptionEn = InputValidator.SanitizeString(request.DescriptionEn, 1000),
                DescriptionAr = InputValidator.SanitizeString(request.DescriptionAr, 1000),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Products.Add(product);
            await _context.SaveChangesAsync();

            return new ProductDto
            {
                Id = product.Id,
                Sku = product.Sku,
                NameEn = product.NameEn,
                NameAr = product.NameAr,
                UnitType = product.UnitType,
                ConversionToBase = product.ConversionToBase,
                CostPrice = product.CostPrice,
                SellPrice = product.SellPrice,
                StockQty = product.StockQty,
                ReorderLevel = product.ReorderLevel,
                ExpiryDate = product.ExpiryDate,
                DescriptionEn = product.DescriptionEn,
                DescriptionAr = product.DescriptionAr
            };
        }

        public async Task<ProductDto?> UpdateProductAsync(int id, CreateProductRequest request, int tenantId, int? userId = null)
        {
            // Validate input
            if (string.IsNullOrWhiteSpace(request.NameEn))
                throw new InvalidOperationException("Product name is required");
            
            if (!InputValidator.ValidateSKU(request.Sku))
                throw new InvalidOperationException("Invalid SKU format");
            
            if (!InputValidator.ValidatePrice(request.SellPrice) || !InputValidator.ValidatePrice(request.CostPrice))
                throw new InvalidOperationException("Invalid price. Prices must be between 0 and 1,000,000");

            // CRITICAL: Verify product belongs to owner before updating
            var product = await _context.Products
                .Where(p => p.Id == id && p.TenantId == tenantId)
                .FirstOrDefaultAsync();
                
            if (product == null) return null;

            // CRITICAL: Check SKU uniqueness within owner's scope
            if (await _context.Products.AnyAsync(p => p.Sku == request.Sku && p.Id != id && p.TenantId == tenantId))
            {
                throw new InvalidOperationException("SKU already exists");
            }

            // Log price change if sell price changed
            if (product.SellPrice != request.SellPrice && userId.HasValue)
            {
                var priceChange = request.SellPrice - product.SellPrice;
                var percentageChange = product.SellPrice > 0 ? (priceChange / product.SellPrice) * 100 : 0;
                
                var priceLog = new PriceChangeLog
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    ProductId = id,
                    OldPrice = product.SellPrice,
                    NewPrice = request.SellPrice,
                    PriceDifference = percentageChange,
                    ChangedBy = userId.Value,
                    Reason = $"Product price updated",
                    ChangedAt = DateTime.UtcNow
                };
                
                _context.PriceChangeLogs.Add(priceLog);
                
                // Optional: Notify admin if price change > 10%
                if (Math.Abs(percentageChange) > 10)
                {
                    Console.WriteLine($"?? PRICE ALERT: Product {product.NameEn} price changed by {percentageChange:F2}% (was {product.SellPrice:C}, now {request.SellPrice:C})");
                }
            }

            product.Sku = InputValidator.SanitizeString(request.Sku, 50);
            product.NameEn = InputValidator.SanitizeString(request.NameEn, 200);
            product.NameAr = InputValidator.SanitizeString(request.NameAr, 200);
            product.UnitType = InputValidator.SanitizeString(request.UnitType, 50);
            product.ConversionToBase = request.ConversionToBase > 0 ? request.ConversionToBase : product.ConversionToBase;
            product.CostPrice = request.CostPrice >= 0 ? request.CostPrice : product.CostPrice;
            product.SellPrice = request.SellPrice >= 0 ? request.SellPrice : product.SellPrice;
            product.StockQty = request.StockQty >= 0 ? request.StockQty : product.StockQty;
            product.ReorderLevel = request.ReorderLevel >= 0 ? request.ReorderLevel : product.ReorderLevel;
            product.ExpiryDate = request.ExpiryDate.HasValue ? request.ExpiryDate.Value.ToUtcKind() : null;
            product.DescriptionEn = InputValidator.SanitizeString(request.DescriptionEn, 1000);
            product.DescriptionAr = InputValidator.SanitizeString(request.DescriptionAr, 1000);
            product.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return new ProductDto
            {
                Id = product.Id,
                Sku = product.Sku,
                NameEn = product.NameEn,
                NameAr = product.NameAr,
                UnitType = product.UnitType,
                ConversionToBase = product.ConversionToBase,
                CostPrice = product.CostPrice,
                SellPrice = product.SellPrice,
                StockQty = product.StockQty,
                ReorderLevel = product.ReorderLevel,
                ExpiryDate = product.ExpiryDate,
                DescriptionEn = product.DescriptionEn,
                DescriptionAr = product.DescriptionAr
            };
        }

        public async Task<bool> DeleteProductAsync(int id, int tenantId)
        {
            // CRITICAL: Verify product belongs to owner before deletion
            var product = await _context.Products
                .Where(p => p.Id == id && p.TenantId == tenantId)
                .FirstOrDefaultAsync();
                
            if (product == null) return false;

            _context.Products.Remove(product);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> AdjustStockAsync(int productId, decimal changeQty, string reason, int userId, int tenantId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // CRITICAL: Verify product belongs to owner
                var product = await _context.Products
                    .Where(p => p.Id == productId && p.TenantId == tenantId)
                    .FirstOrDefaultAsync();
                    
                if (product == null) return false;

                product.StockQty += changeQty;
                product.UpdatedAt = DateTime.UtcNow;

                // Create inventory transaction
                var inventoryTransaction = new InventoryTransaction
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    ProductId = productId,
                    ChangeQty = changeQty,
                    TransactionType = TransactionType.Adjustment,
                    Reason = reason,
                    CreatedAt = DateTime.UtcNow
                };

                _context.InventoryTransactions.Add(inventoryTransaction);

                // Create audit log
                var auditLog = new AuditLog
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    UserId = userId,
                    Action = "Stock Adjustment",
                    Details = $"Product: {product.NameEn}, Change: {changeQty}, Reason: {reason}",
                    CreatedAt = DateTime.UtcNow
                };

                _context.AuditLogs.Add(auditLog);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                return true;
            }
            catch
            {
                await transaction.RollbackAsync();
                return false;
            }
        }

        public async Task<List<ProductDto>> GetLowStockProductsAsync(int tenantId)
        {
            // CRITICAL: Filter by tenantId
            var products = await _context.Products
                .Where(p => p.TenantId == tenantId && p.StockQty <= p.ReorderLevel)
                .Select(p => new ProductDto
                {
                    Id = p.Id,
                    Sku = p.Sku,
                    NameEn = p.NameEn,
                    NameAr = p.NameAr,
                    UnitType = p.UnitType,
                    ConversionToBase = p.ConversionToBase,
                    CostPrice = p.CostPrice,
                    SellPrice = p.SellPrice,
                    StockQty = p.StockQty,
                    ReorderLevel = p.ReorderLevel,
                    ExpiryDate = p.ExpiryDate,
                    DescriptionEn = p.DescriptionEn,
                    DescriptionAr = p.DescriptionAr
                })
                .ToListAsync();

            return products.OrderBy(p => p.StockQty).ToList();
        }

        public async Task<List<ProductDto>> SearchProductsAsync(string query, int tenantId, int limit = 20)
        {
            var searchTerm = query.ToLower();
            // CRITICAL: Filter by tenantId
            var products = await _context.Products
                .Where(p => p.TenantId == tenantId &&
                           (p.NameEn.ToLower().Contains(searchTerm) || 
                           (p.NameAr != null && p.NameAr.ToLower().Contains(searchTerm)) || 
                           p.Sku.ToLower().Contains(searchTerm)))
                .OrderBy(p => p.NameEn)
                .Take(limit)
                .Select(p => new ProductDto
                {
                    Id = p.Id,
                    Sku = p.Sku,
                    NameEn = p.NameEn,
                    NameAr = p.NameAr,
                    UnitType = p.UnitType,
                    ConversionToBase = p.ConversionToBase,
                    CostPrice = p.CostPrice,
                    SellPrice = p.SellPrice,
                    StockQty = p.StockQty,
                    ReorderLevel = p.ReorderLevel,
                    ExpiryDate = p.ExpiryDate,
                    DescriptionEn = p.DescriptionEn,
                    DescriptionAr = p.DescriptionAr
                })
                .ToListAsync();

            return products;
        }

        public async Task<List<PriceChangeLogDto>> GetPriceChangeHistoryAsync(int productId, int tenantId)
        {
            // CRITICAL: Filter by tenantId
            var logs = await _context.PriceChangeLogs
                .Where(p => p.ProductId == productId && p.TenantId == tenantId)
                .OrderByDescending(p => p.ChangedAt)
                .Include(p => p.ChangedByUser)
                .Select(p => new PriceChangeLogDto
                {
                    Id = p.Id,
                    ProductId = p.ProductId,
                    OldPrice = p.OldPrice,
                    NewPrice = p.NewPrice,
                    PriceDifference = p.PriceDifference,
                    ChangedBy = p.ChangedBy,
                    ChangedByName = p.ChangedByUser != null ? p.ChangedByUser.Name : "Unknown",
                    Reason = p.Reason,
                    ChangedAt = p.ChangedAt
                })
                .ToListAsync();

            return logs;
        }

        public async Task<int> ResetAllStockAsync(int userId, int tenantId)
        {
            // CRITICAL: Only reset products owned by this owner
            var products = await _context.Products
                .Where(p => p.TenantId == tenantId)
                .ToListAsync();
            var count = 0;

            foreach (var product in products)
            {
                if (product.StockQty != 0)
                {
                    // Log stock adjustment
                    var adjustment = new InventoryTransaction
                    {
                        OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                        TenantId = tenantId, // CRITICAL: Set new TenantId
                        ProductId = product.Id,
                        ChangeQty = -product.StockQty,
                        TransactionType = TransactionType.Adjustment,
                        Reason = "Admin stock reset - All stock reset to zero",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.InventoryTransactions.Add(adjustment);

                    product.StockQty = 0;
                    product.UpdatedAt = DateTime.UtcNow;
                    count++;
                }
            }

            await _context.SaveChangesAsync();
            return count;
        }
    }
}

