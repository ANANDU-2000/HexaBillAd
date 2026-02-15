/*
Purpose: Return service for sales and purchase returns
Author: AI Assistant
Date: 2025
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Customers;

namespace HexaBill.Api.Modules.Billing
{
    public interface IReturnService
    {
        Task<SaleReturnDto> CreateSaleReturnAsync(CreateSaleReturnRequest request, int userId, int tenantId);
        Task<PurchaseReturnDto> CreatePurchaseReturnAsync(CreatePurchaseReturnRequest request, int userId, int tenantId);
        Task<List<SaleReturnDto>> GetSaleReturnsAsync(int tenantId, int? saleId = null);
        Task<List<PurchaseReturnDto>> GetPurchaseReturnsAsync(int tenantId, int? purchaseId = null);
    }

    public class ReturnService : IReturnService
    {
        private readonly AppDbContext _context;
        private readonly ICustomerService _customerService;

        public ReturnService(AppDbContext context, ICustomerService customerService)
        {
            _context = context;
            _customerService = customerService;
        }

        public async Task<SaleReturnDto> CreateSaleReturnAsync(CreateSaleReturnRequest request, int userId, int tenantId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Get original sale
                var sale = await _context.Sales
                    .Include(s => s.Items)
                    .ThenInclude(i => i.Product)
                    .FirstOrDefaultAsync(s => s.Id == request.SaleId && s.TenantId == tenantId);

                if (sale == null)
                    throw new InvalidOperationException("Original sale not found");

                // Generate return number
                var returnNo = await GenerateSaleReturnNumberAsync(tenantId);

                decimal subtotal = 0;
                decimal vatTotal = 0;

                var returnItems = new List<SaleReturnItem>();
                var inventoryTransactions = new List<InventoryTransaction>();

                foreach (var item in request.Items)
                {
                    var saleItem = sale.Items.FirstOrDefault(si => si.Id == item.SaleItemId);
                    if (saleItem == null)
                        throw new InvalidOperationException($"Sale item {item.SaleItemId} not found");

                    var product = await _context.Products.FindAsync(saleItem.ProductId);
                    if (product == null)
                        throw new InvalidOperationException("Product not found");

                    // Calculate return totals
                    var lineTotal = item.Qty * saleItem.UnitPrice;
                    var vatAmount = Math.Round(lineTotal * 0.05m, 2);
                    var lineAmount = lineTotal + vatAmount;

                    subtotal += lineTotal;
                    vatTotal += vatAmount;

                    // Create return item
                    var returnItem = new SaleReturnItem
                    {
                        SaleItemId = saleItem.Id,
                        ProductId = product.Id,
                        UnitType = saleItem.UnitType,
                        Qty = item.Qty,
                        UnitPrice = saleItem.UnitPrice,
                        VatAmount = vatAmount,
                        LineTotal = lineAmount,
                        Reason = item.Reason
                    };
                    returnItems.Add(returnItem);

                    // Restore stock if not bad item
                    if (!request.IsBadItem && request.RestoreStock)
                    {
                        var baseQty = item.Qty * product.ConversionToBase;
                        product.StockQty += baseQty;
                        product.UpdatedAt = DateTime.UtcNow;

                        // Create inventory transaction (Return increases stock)
                        inventoryTransactions.Add(new InventoryTransaction
                        {
                            OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                            TenantId = tenantId, // CRITICAL: Set new TenantId
                            ProductId = product.Id,
                            ChangeQty = baseQty,
                            TransactionType = TransactionType.Return,
                            Reason = $"Sale Return: {returnNo}",
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }

                var grandTotal = subtotal + vatTotal - (request.Discount ?? 0);

                // Create sale return
                var saleReturn = new SaleReturn
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    SaleId = request.SaleId,
                    CustomerId = sale.CustomerId,
                    ReturnNo = returnNo,
                    ReturnDate = DateTime.UtcNow,
                    Subtotal = subtotal,
                    VatTotal = vatTotal,
                    Discount = request.Discount ?? 0,
                    GrandTotal = grandTotal,
                    Reason = request.Reason,
                    Status = ReturnStatus.Approved,
                    RestoreStock = request.RestoreStock,
                    IsBadItem = request.IsBadItem,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                };

                _context.SaleReturns.Add(saleReturn);
                await _context.SaveChangesAsync();

                // Update return items with return ID
                foreach (var item in returnItems)
                {
                    item.SaleReturnId = saleReturn.Id;
                }
                _context.SaleReturnItems.AddRange(returnItems);

                // Update inventory transactions with return ID
                foreach (var invTx in inventoryTransactions)
                {
                    invTx.RefId = saleReturn.Id;
                }
                _context.InventoryTransactions.AddRange(inventoryTransactions);

                // Recalculate customer balance (credit customer)
                if (sale.CustomerId.HasValue)
                {
                    var customer = await _context.Customers.FindAsync(sale.CustomerId.Value);
                    if (customer != null)
                    {
                        await _customerService.RecalculateCustomerBalanceAsync(sale.CustomerId.Value, customer.TenantId ?? 0);
                    }
                }

                // Create audit log
                var auditLog = new AuditLog
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    UserId = userId,
                    Action = "Sale Return Created",
                    Details = $"Return No: {returnNo}, Sale ID: {request.SaleId}, Amount: {grandTotal:C}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.AuditLogs.Add(auditLog);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return await GetSaleReturnByIdAsync(saleReturn.Id);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<PurchaseReturnDto> CreatePurchaseReturnAsync(CreatePurchaseReturnRequest request, int userId, int tenantId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Get original purchase
                var purchase = await _context.Purchases
                    .Include(p => p.Items)
                    .ThenInclude(i => i.Product)
                    .FirstOrDefaultAsync(p => p.Id == request.PurchaseId && p.TenantId == tenantId);

                if (purchase == null)
                    throw new InvalidOperationException("Original purchase not found");

                // Generate return number
                var returnNo = await GeneratePurchaseReturnNumberAsync(tenantId);

                decimal subtotal = 0;
                decimal vatTotal = 0;

                var returnItems = new List<PurchaseReturnItem>();
                var inventoryTransactions = new List<InventoryTransaction>();

                foreach (var item in request.Items)
                {
                    var purchaseItem = purchase.Items.FirstOrDefault(pi => pi.Id == item.PurchaseItemId);
                    if (purchaseItem == null)
                        throw new InvalidOperationException($"Purchase item {item.PurchaseItemId} not found");

                    var product = await _context.Products.FindAsync(purchaseItem.ProductId);
                    if (product == null)
                        throw new InvalidOperationException("Product not found");

                    // Calculate return totals
                    var lineTotal = item.Qty * purchaseItem.UnitCost;
                    var vatAmount = Math.Round(lineTotal * 0.05m, 2);
                    var lineAmount = lineTotal + vatAmount;

                    subtotal += lineTotal;
                    vatTotal += vatAmount;

                    // Create return item
                    var returnItem = new PurchaseReturnItem
                    {
                        PurchaseItemId = purchaseItem.Id,
                        ProductId = product.Id,
                        UnitType = purchaseItem.UnitType,
                        Qty = item.Qty,
                        UnitCost = purchaseItem.UnitCost,
                        LineTotal = lineAmount,
                        Reason = item.Reason
                    };
                    returnItems.Add(returnItem);

                    // Decrease stock (returning to supplier)
                    var baseQty = item.Qty * product.ConversionToBase;
                    product.StockQty -= baseQty;
                    product.UpdatedAt = DateTime.UtcNow;

                    // Create inventory transaction
                    inventoryTransactions.Add(new InventoryTransaction
                    {
                        OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                        TenantId = tenantId, // CRITICAL: Set new TenantId
                        ProductId = product.Id,
                        ChangeQty = -baseQty,
                        TransactionType = TransactionType.PurchaseReturn,
                        Reason = $"Purchase Return: {returnNo}",
                        CreatedAt = DateTime.UtcNow
                    });
                }

                var grandTotal = subtotal + vatTotal;

                // Create purchase return
                var purchaseReturn = new PurchaseReturn
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    PurchaseId = request.PurchaseId,
                    ReturnNo = returnNo,
                    ReturnDate = DateTime.UtcNow,
                    Subtotal = subtotal,
                    VatTotal = vatTotal,
                    GrandTotal = grandTotal,
                    Reason = request.Reason,
                    Status = ReturnStatus.Approved,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                };

                _context.PurchaseReturns.Add(purchaseReturn);
                await _context.SaveChangesAsync();

                // Update return items with return ID
                foreach (var item in returnItems)
                {
                    item.PurchaseReturnId = purchaseReturn.Id;
                }
                _context.PurchaseReturnItems.AddRange(returnItems);

                // Update inventory transactions
                foreach (var invTx in inventoryTransactions)
                {
                    invTx.RefId = purchaseReturn.Id;
                }
                _context.InventoryTransactions.AddRange(inventoryTransactions);

                // Create audit log
                var auditLog = new AuditLog
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    UserId = userId,
                    Action = "Purchase Return Created",
                    Details = $"Return No: {returnNo}, Purchase ID: {request.PurchaseId}, Amount: {grandTotal:C}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.AuditLogs.Add(auditLog);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return await GetPurchaseReturnByIdAsync(purchaseReturn.Id);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<List<SaleReturnDto>> GetSaleReturnsAsync(int tenantId, int? saleId = null)
        {
            var query = _context.SaleReturns
                .Where(r => r.TenantId == tenantId) // CRITICAL: Multi-tenant filter
                .Include(r => r.Sale)
                .Include(r => r.Customer)
                .AsQueryable();

            if (saleId.HasValue)
            {
                query = query.Where(r => r.SaleId == saleId.Value);
            }

            var returns = await query.OrderByDescending(r => r.ReturnDate).ToListAsync();

            return returns.Select(r => new SaleReturnDto
            {
                Id = r.Id,
                SaleId = r.SaleId,
                SaleInvoiceNo = r.Sale?.InvoiceNo ?? "",
                CustomerId = r.CustomerId,
                CustomerName = r.Customer?.Name,
                ReturnNo = r.ReturnNo,
                ReturnDate = r.ReturnDate,
                GrandTotal = r.GrandTotal,
                Reason = r.Reason,
                Status = r.Status.ToString(),
                IsBadItem = r.IsBadItem
            }).ToList();
        }

        public async Task<List<PurchaseReturnDto>> GetPurchaseReturnsAsync(int tenantId, int? purchaseId = null)
        {
            var query = _context.PurchaseReturns
                .Where(r => r.TenantId == tenantId) // CRITICAL: Multi-tenant filter
                .Include(r => r.Purchase)
                .AsQueryable();

            if (purchaseId.HasValue)
            {
                query = query.Where(r => r.PurchaseId == purchaseId.Value);
            }

            var returns = await query.OrderByDescending(r => r.ReturnDate).ToListAsync();

            return returns.Select(r => new PurchaseReturnDto
            {
                Id = r.Id,
                PurchaseId = r.PurchaseId,
                PurchaseInvoiceNo = r.Purchase?.InvoiceNo ?? "",
                ReturnNo = r.ReturnNo,
                ReturnDate = r.ReturnDate,
                GrandTotal = r.GrandTotal,
                Reason = r.Reason,
                Status = r.Status.ToString()
            }).ToList();
        }

        private async Task<string> GenerateSaleReturnNumberAsync(int tenantId)
        {
            var today = DateTime.Today.ToString("yyyyMMdd");
            var lastReturn = await _context.SaleReturns
                .Where(r => r.TenantId == tenantId && r.ReturnNo.StartsWith($"RET-{today}"))
                .OrderByDescending(r => r.ReturnNo)
                .FirstOrDefaultAsync();

            int nextNumber = 1;
            if (lastReturn != null)
            {
                var parts = lastReturn.ReturnNo.Split('-');
                if (parts.Length >= 3 && int.TryParse(parts[2], out int lastNum))
                {
                    nextNumber = lastNum + 1;
                }
            }

            return $"RET-{today}-{nextNumber:D4}";
        }

        private async Task<string> GeneratePurchaseReturnNumberAsync(int tenantId)
        {
            var today = DateTime.Today.ToString("yyyyMMdd");
            var lastReturn = await _context.PurchaseReturns
                .Where(r => r.TenantId == tenantId && r.ReturnNo.StartsWith($"PUR-RET-{today}"))
                .OrderByDescending(r => r.ReturnNo)
                .FirstOrDefaultAsync();

            int nextNumber = 1;
            if (lastReturn != null)
            {
                var parts = lastReturn.ReturnNo.Split('-');
                if (parts.Length >= 4 && int.TryParse(parts[3], out int lastNum))
                {
                    nextNumber = lastNum + 1;
                }
            }

            return $"PUR-RET-{today}-{nextNumber:D4}";
        }

        private async Task<SaleReturnDto> GetSaleReturnByIdAsync(int id)
        {
            var saleReturn = await _context.SaleReturns
                .Include(r => r.Sale)
                .Include(r => r.Customer)
                .Include(r => r.Items)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (saleReturn == null) throw new InvalidOperationException("Return not found");

            return new SaleReturnDto
            {
                Id = saleReturn.Id,
                SaleId = saleReturn.SaleId,
                SaleInvoiceNo = saleReturn.Sale?.InvoiceNo ?? "",
                CustomerId = saleReturn.CustomerId,
                CustomerName = saleReturn.Customer?.Name,
                ReturnNo = saleReturn.ReturnNo,
                ReturnDate = saleReturn.ReturnDate,
                GrandTotal = saleReturn.GrandTotal,
                Reason = saleReturn.Reason,
                Status = saleReturn.Status.ToString(),
                IsBadItem = saleReturn.IsBadItem
            };
        }

        private async Task<PurchaseReturnDto> GetPurchaseReturnByIdAsync(int id)
        {
            var purchaseReturn = await _context.PurchaseReturns
                .Include(r => r.Purchase)
                .Include(r => r.Items)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (purchaseReturn == null) throw new InvalidOperationException("Return not found");

            return new PurchaseReturnDto
            {
                Id = purchaseReturn.Id,
                PurchaseId = purchaseReturn.PurchaseId,
                PurchaseInvoiceNo = purchaseReturn.Purchase?.InvoiceNo ?? "",
                ReturnNo = purchaseReturn.ReturnNo,
                ReturnDate = purchaseReturn.ReturnDate,
                GrandTotal = purchaseReturn.GrandTotal,
                Reason = purchaseReturn.Reason,
                Status = purchaseReturn.Status.ToString()
            };
        }
    }
}

