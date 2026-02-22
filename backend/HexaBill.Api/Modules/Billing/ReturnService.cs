/*
Purpose: Return service for sales and purchase returns
Author: AI Assistant
Date: 2025
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Shared.Services;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace HexaBill.Api.Modules.Billing
{
    /// <summary>Minimal sale data for return creation when Sales.BranchId/RouteId may not exist in DB.</summary>
    internal class SaleInfoForReturn
    {
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int? CustomerId { get; set; }
        public decimal GrandTotal { get; set; }
        public int? BranchId { get; set; }
        public int? RouteId { get; set; }
        public List<SaleItem> Items { get; set; } = new();
    }

    public interface IReturnService
    {
        Task<SaleReturnDto> CreateSaleReturnAsync(CreateSaleReturnRequest request, int userId, int tenantId);
        Task<PurchaseReturnDto> CreatePurchaseReturnAsync(CreatePurchaseReturnRequest request, int userId, int tenantId);
        Task<List<SaleReturnDto>> GetSaleReturnsAsync(int tenantId, int? saleId = null);
        Task<PagedResponse<SaleReturnDto>> GetSaleReturnsPagedAsync(int tenantId, DateTime? fromDate, DateTime? toDate, int? branchId, int? routeId, int? damageCategoryId, int? staffUserId, int page, int pageSize, string? roleForStaff = null, int? userIdForStaff = null);
        Task<List<DamageCategoryDto>> GetDamageCategoriesAsync(int tenantId);
        Task<List<PurchaseReturnDto>> GetPurchaseReturnsAsync(int tenantId, int? purchaseId = null);
        Task<SaleReturnDto> ApproveSaleReturnAsync(int returnId, int tenantId);
        Task<SaleReturnDto> RejectSaleReturnAsync(int returnId, int tenantId);
        Task<bool> GetReturnsRequireApprovalAsync(int tenantId);
        Task<bool> GetReturnsEnabledAsync(int tenantId);
        Task<byte[]> GenerateReturnBillPdfAsync(int returnId, int tenantId);
        Task<List<CreditNoteDto>> GetCreditNotesAsync(int tenantId, DateTime? fromDate = null, DateTime? toDate = null, int? customerId = null);
        Task<List<DamageReportEntryDto>> GetDamageReportAsync(int tenantId, DateTime? fromDate = null, DateTime? toDate = null, int? branchId = null, int? routeId = null);
    }

    public class ReturnService : IReturnService
    {
        private readonly AppDbContext _context;
        private readonly ICustomerService _customerService;
        private readonly ISettingsService _settingsService;
        private readonly ISalesSchemaService _salesSchema;

        public ReturnService(AppDbContext context, ICustomerService customerService, ISettingsService settingsService, ISalesSchemaService salesSchema)
        {
            _context = context;
            _customerService = customerService;
            _settingsService = settingsService;
            _salesSchema = salesSchema;
        }

        public async Task<SaleReturnDto> CreateSaleReturnAsync(CreateSaleReturnRequest request, int userId, int tenantId)
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var settings = await _settingsService.GetOwnerSettingsAsync(tenantId);
                bool returnsEnabled = await GetReturnsEnabledAsync(tenantId);
                if (!returnsEnabled)
                    throw new InvalidOperationException("Sales returns are disabled for your company. Contact your administrator.");
                bool requireApproval = string.Equals(settings.GetValueOrDefault("Returns_RequireApproval", "false"), "true", StringComparison.OrdinalIgnoreCase);

                // Get original sale (schema-safe: when Sales.BranchId/RouteId don't exist, load without them)
                SaleInfoForReturn saleInfo;
                var hasBranchRoute = await _salesSchema.SalesHasBranchIdAndRouteIdAsync();
                if (hasBranchRoute)
                {
                    var sale = await _context.Sales
                        .Include(s => s.Items)
                        .ThenInclude(i => i.Product)
                        .FirstOrDefaultAsync(s => s.Id == request.SaleId && s.TenantId == tenantId);
                    if (sale == null)
                        throw new InvalidOperationException("Original sale not found");
                    saleInfo = new SaleInfoForReturn
                    {
                        Id = sale.Id,
                        TenantId = sale.TenantId ?? tenantId,
                        CustomerId = sale.CustomerId,
                        GrandTotal = sale.GrandTotal,
                        BranchId = sale.BranchId,
                        RouteId = sale.RouteId,
                        Items = sale.Items.ToList()
                    };
                }
                else
                {
                    var header = await _context.Sales
                        .Where(s => s.Id == request.SaleId && s.TenantId == tenantId)
                        .Select(s => new { s.Id, s.TenantId, s.CustomerId, s.GrandTotal })
                        .FirstOrDefaultAsync();
                    if (header == null)
                        throw new InvalidOperationException("Original sale not found");
                    var items = await _context.SaleItems
                        .Where(si => si.SaleId == request.SaleId)
                        .Include(si => si.Product)
                        .ToListAsync();
                    saleInfo = new SaleInfoForReturn
                    {
                        Id = header.Id,
                        TenantId = header.TenantId ?? tenantId,
                        CustomerId = header.CustomerId,
                        GrandTotal = header.GrandTotal,
                        BranchId = null,
                        RouteId = null,
                        Items = items
                    };
                }

                // Already-returned qty per SaleItemId (all returns for this sale, tenant-scoped)
                var alreadyReturnedBySaleItemId = await _context.SaleReturnItems
                    .Where(sri => sri.SaleReturn.SaleId == request.SaleId && sri.SaleReturn.TenantId == tenantId)
                    .GroupBy(sri => sri.SaleItemId)
                    .Select(g => new { SaleItemId = g.Key, Total = g.Sum(x => x.Qty) })
                    .ToDictionaryAsync(x => x.SaleItemId, x => x.Total);

                // Reject if nothing left to return
                var anyRemaining = saleInfo.Items.Any(si =>
                {
                    var returned = alreadyReturnedBySaleItemId.GetValueOrDefault(si.Id, 0m);
                    return returned < si.Qty;
                });
                if (!anyRemaining)
                    throw new InvalidOperationException("This invoice has already been fully returned. No quantity remains to return.");

                // Generate return number
                var returnNo = await GenerateSaleReturnNumberAsync(tenantId);

                decimal subtotal = 0;
                decimal vatTotal = 0;
                var conditionFlags = new HashSet<string>(StringComparer.OrdinalIgnoreCase); // for ReturnCategory

                var returnItems = new List<SaleReturnItem>();
                var inventoryTransactions = new List<InventoryTransaction>();

                foreach (var item in request.Items)
                {
                    var saleItem = saleInfo.Items.FirstOrDefault(si => si.Id == item.SaleItemId);
                    if (saleItem == null)
                        throw new InvalidOperationException($"Sale item {item.SaleItemId} not found");

                    var alreadyReturned = alreadyReturnedBySaleItemId.GetValueOrDefault(saleItem.Id, 0m);
                    var maxReturnable = saleItem.Qty - alreadyReturned;
                    if (item.Qty <= 0)
                        throw new InvalidOperationException($"Return quantity for item {item.SaleItemId} must be greater than 0.");
                    if (item.Qty > maxReturnable)
                        throw new InvalidOperationException($"Return quantity for item {item.SaleItemId} must not exceed quantity remaining to return (sold: {saleItem.Qty}, already returned: {alreadyReturned}, max: {maxReturnable}).");

                    // AUDIT-4 FIX: Add TenantId filter to prevent cross-tenant product access
                    var product = await _context.Products
                        .FirstOrDefaultAsync(p => p.Id == saleItem.ProductId && p.TenantId == tenantId);
                    if (product == null)
                        throw new InvalidOperationException("Product not found or does not belong to your tenant");

                    DamageCategory? damageCategory = null;
                    if (item.DamageCategoryId.HasValue)
                    {
                        damageCategory = await _context.DamageCategories
                            .FirstOrDefaultAsync(dc => dc.Id == item.DamageCategoryId.Value && dc.TenantId == tenantId);
                        if (damageCategory == null)
                            throw new InvalidOperationException($"Damage category {item.DamageCategoryId} not found or does not belong to your tenant");
                    }

                    // Per-item stock effect: Condition wins if provided (resellable/damaged/writeoff), else StockEffect, else DamageCategory, else header
                    string? conditionNormalized = string.IsNullOrWhiteSpace(item.Condition) ? null : item.Condition.Trim().ToLowerInvariant();
                    bool addToStock;
                    if (conditionNormalized == "resellable") { addToStock = true; conditionFlags.Add("resellable"); }
                    else if (conditionNormalized == "damaged") { addToStock = false; conditionFlags.Add("damaged"); }
                    else if (conditionNormalized == "writeoff") { addToStock = false; conditionFlags.Add("writeoff"); }
                    else
                        addToStock = item.StockEffect ?? (damageCategory != null
                            ? (damageCategory.AffectsStock && damageCategory.IsResaleable)
                            : (request.RestoreStock && !request.IsBadItem));

                    // Calculate return totals
                    var lineTotal = item.Qty * saleItem.UnitPrice;
                    var vatAmount = Math.Round(lineTotal * 0.05m, 2);
                    var lineAmount = lineTotal + vatAmount;

                    subtotal += lineTotal;
                    vatTotal += vatAmount;

                    // Create return item with damage category, stock effect, and condition
                    var returnItem = new SaleReturnItem
                    {
                        SaleItemId = saleItem.Id,
                        ProductId = product.Id,
                        UnitType = saleItem.UnitType,
                        Qty = item.Qty,
                        UnitPrice = saleItem.UnitPrice,
                        VatAmount = vatAmount,
                        LineTotal = lineAmount,
                        Reason = item.Reason,
                        DamageCategoryId = item.DamageCategoryId,
                        StockEffect = addToStock,
                        Condition = conditionNormalized ?? (addToStock ? "resellable" : null)
                    };
                    returnItems.Add(returnItem);

                    // Restore stock only when addToStock is true and not requiring approval (or we apply on approve)
                    if (addToStock && !requireApproval)
                    {
                        var baseQty = item.Qty * product.ConversionToBase;
                        var rowsAffected = await _context.Database.ExecuteSqlInterpolatedAsync(
                            $@"UPDATE ""Products"" 
                               SET ""StockQty"" = ""StockQty"" + {baseQty}, 
                                   ""UpdatedAt"" = {DateTime.UtcNow}
                               WHERE ""Id"" = {product.Id} 
                                 AND ""TenantId"" = {tenantId}");
                        
                        if (rowsAffected > 0)
                            await _context.Entry(product).ReloadAsync();

                        inventoryTransactions.Add(new InventoryTransaction
                        {
                            OwnerId = tenantId,
                            TenantId = tenantId,
                            ProductId = product.Id,
                            ChangeQty = baseQty,
                            TransactionType = TransactionType.Return,
                            Reason = $"Sale Return: {returnNo}",
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }

                var grandTotal = subtotal + vatTotal - (request.Discount ?? 0);

                // ReturnType: Full if every returned line is full qty and we cover all sale items; else Partial
                bool allLinesFull = request.Items.All(it => {
                    var si = saleInfo.Items.FirstOrDefault(s => s.Id == it.SaleItemId);
                    return si != null && it.Qty >= si.Qty;
                });
                bool allSaleItemsReturned = saleInfo.Items.Count == request.Items.Count && request.Items.All(it => saleInfo.Items.Any(s => s.Id == it.SaleItemId));
                string returnType = (allLinesFull && allSaleItemsReturned) ? "Full" : "Partial";

                // ReturnCategory for ERP: writeoff > damaged > resellable > not_liked
                string? returnCategory = conditionFlags.Contains("writeoff") ? "writeoff"
                    : conditionFlags.Contains("damaged") ? "damaged"
                    : conditionFlags.Contains("resellable") && conditionFlags.Count == 1 ? "resellable"
                    : conditionFlags.Count > 0 ? "not_liked" : null;

                // Create sale return (BranchId/RouteId from original sale when columns exist)
                var saleReturn = new SaleReturn
                {
                    OwnerId = tenantId,
                    TenantId = tenantId,
                    SaleId = request.SaleId,
                    CustomerId = saleInfo.CustomerId,
                    ReturnNo = returnNo,
                    ReturnDate = DateTime.UtcNow,
                    Subtotal = subtotal,
                    VatTotal = vatTotal,
                    Discount = request.Discount ?? 0,
                    GrandTotal = grandTotal,
                    Reason = request.Reason,
                    Status = requireApproval ? ReturnStatus.Pending : ReturnStatus.Approved,
                    RestoreStock = request.RestoreStock,
                    IsBadItem = request.IsBadItem,
                    BranchId = saleInfo.BranchId,
                    RouteId = saleInfo.RouteId,
                    ReturnType = returnType,
                    ReturnCategory = returnCategory,
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

                // Damage inventory and write-off (ERP): only when not requiring approval (same as stock/balance)
                if (!requireApproval)
                {
                    foreach (var invTx in inventoryTransactions)
                        invTx.RefId = saleReturn.Id;
                    _context.InventoryTransactions.AddRange(inventoryTransactions);

                    // Damaged: add to DamageInventory (tenant, product, branch)
                    foreach (var ri in returnItems.Where(r => r.Condition == "damaged"))
                    {
                        var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == ri.ProductId && p.TenantId == tenantId);
                        if (product == null) continue;
                        var baseQty = ri.Qty * product.ConversionToBase;
                        var inv = await _context.DamageInventories
                            .FirstOrDefaultAsync(d => d.TenantId == tenantId && d.ProductId == ri.ProductId && d.BranchId == saleInfo.BranchId);
                        if (inv == null)
                        {
                            inv = new DamageInventory
                            {
                                TenantId = tenantId,
                                ProductId = ri.ProductId,
                                BranchId = saleInfo.BranchId,
                                Quantity = 0,
                                CreatedAt = DateTime.UtcNow,
                                UpdatedAt = DateTime.UtcNow
                            };
                            _context.DamageInventories.Add(inv);
                            await _context.SaveChangesAsync();
                        }
                        inv.Quantity += baseQty;
                        inv.UpdatedAt = DateTime.UtcNow;
                        inv.SourceReturnId = saleReturn.Id;
                    }

                    // Write-off: create Expense (Return Write-off category)
                    var writeOffCategoryId = await GetOrCreateReturnWriteOffCategoryAsync();
                    foreach (var ri in returnItems.Where(r => r.Condition == "writeoff"))
                    {
                        var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == ri.ProductId && p.TenantId == tenantId);
                        var productName = product != null ? (product.NameEn ?? product.NameAr ?? "") : "Product";
                        _context.Expenses.Add(new Expense
                        {
                            OwnerId = tenantId,
                            TenantId = tenantId,
                            BranchId = saleInfo.BranchId,
                            RouteId = saleInfo.RouteId,
                            CategoryId = writeOffCategoryId,
                            Amount = ri.LineTotal,
                            Date = DateTime.UtcNow.Date,
                            Note = $"Return write-off: {returnNo} - {productName}",
                            CreatedBy = userId,
                            CreatedAt = DateTime.UtcNow,
                            Status = ExpenseStatus.Approved
                        });
                    }

                    if (saleInfo.CustomerId.HasValue)
                    {
                        var customer = await _context.Customers.FindAsync(saleInfo.CustomerId.Value);
                        if (customer != null)
                            await _customerService.RecalculateCustomerBalanceAsync(saleInfo.CustomerId.Value, customer.TenantId ?? 0);
                    }
                }

                // Credit note for cash (paid) invoice when requested
                if (request.CreateCreditNote && saleInfo.CustomerId.HasValue)
                {
                    var totalPaidForSale = await _context.Payments
                        .Where(p => p.SaleId == request.SaleId && p.TenantId == tenantId)
                        .SumAsync(p => (decimal?)p.Amount) ?? 0;
                    if (totalPaidForSale >= saleInfo.GrandTotal)
                    {
                        _context.CreditNotes.Add(new CreditNote
                        {
                            TenantId = tenantId,
                            CustomerId = saleInfo.CustomerId.Value,
                            LinkedReturnId = saleReturn.Id,
                            Amount = grandTotal,
                            Currency = "AED",
                            Status = "unused",
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = userId
                        });
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
            });
        }

        public async Task<PurchaseReturnDto> CreatePurchaseReturnAsync(CreatePurchaseReturnRequest request, int userId, int tenantId)
        {
            var strategyPurchase = _context.Database.CreateExecutionStrategy();
            return await strategyPurchase.ExecuteAsync(async () =>
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

                    // AUDIT-4 FIX: Add TenantId filter to prevent cross-tenant product access
                    var product = await _context.Products
                        .FirstOrDefaultAsync(p => p.Id == purchaseItem.ProductId && p.TenantId == tenantId);
                    if (product == null)
                        throw new InvalidOperationException("Product not found or does not belong to your tenant");

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
                    // PROD-19: Atomic stock decrease (returning to supplier)
                    var rowsAffected = await _context.Database.ExecuteSqlInterpolatedAsync(
                        $@"UPDATE ""Products"" 
                           SET ""StockQty"" = ""StockQty"" - {baseQty}, 
                               ""UpdatedAt"" = {DateTime.UtcNow}
                           WHERE ""Id"" = {product.Id} 
                             AND ""TenantId"" = {tenantId}");
                    
                    if (rowsAffected > 0)
                    {
                        await _context.Entry(product).ReloadAsync();
                    }

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
            });
        }

        public async Task<List<SaleReturnDto>> GetSaleReturnsAsync(int tenantId, int? saleId = null)
        {
            var query = _context.SaleReturns
                .Where(r => r.TenantId == tenantId)
                .Include(r => r.Sale)
                .Include(r => r.Customer)
                .Include(r => r.Branch)
                .Include(r => r.Route)
                .Include(r => r.CreatedByUser)
                .AsQueryable();

            if (saleId.HasValue)
                query = query.Where(r => r.SaleId == saleId.Value);

            var returns = await query.OrderByDescending(r => r.ReturnDate).ToListAsync();
            return returns.Select(r => MapToSaleReturnDto(r)).ToList();
        }

        public async Task<PagedResponse<SaleReturnDto>> GetSaleReturnsPagedAsync(int tenantId, DateTime? fromDate, DateTime? toDate, int? branchId, int? routeId, int? damageCategoryId, int? staffUserId, int page, int pageSize, string? roleForStaff = null, int? userIdForStaff = null)
        {
            var query = _context.SaleReturns
                .Where(r => r.TenantId == tenantId)
                .Include(r => r.Sale)
                .Include(r => r.Customer)
                .Include(r => r.Branch)
                .Include(r => r.Route)
                .Include(r => r.CreatedByUser)
                .Include(r => r.Items).ThenInclude(i => i.Product)
                .Include(r => r.Items).ThenInclude(i => i.DamageCategory)
                .AsQueryable();

            if (fromDate.HasValue)
                query = query.Where(r => r.ReturnDate >= fromDate.Value);
            if (toDate.HasValue)
                query = query.Where(r => r.ReturnDate < toDate.Value.AddDays(1));
            if (branchId.HasValue)
                query = query.Where(r => r.BranchId == branchId.Value);
            if (routeId.HasValue)
                query = query.Where(r => r.RouteId == routeId.Value);
            if (staffUserId.HasValue)
                query = query.Where(r => r.CreatedBy == staffUserId.Value);
            if (damageCategoryId.HasValue)
                query = query.Where(r => r.Items.Any(i => i.DamageCategoryId == damageCategoryId.Value));

            // Staff: filter by allowed branches/routes if applicable (caller can pass roleForStaff and userIdForStaff)
            var totalCount = await query.CountAsync();
            var list = await query
                .OrderByDescending(r => r.ReturnDate)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var items = list.Select(r => MapToSaleReturnDto(r)).ToList();
            return new PagedResponse<SaleReturnDto>
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            };
        }

        private const string ReturnWriteOffCategoryName = "Return Write-off";

        private async Task<int> GetOrCreateReturnWriteOffCategoryAsync()
        {
            var cat = await _context.ExpenseCategories
                .FirstOrDefaultAsync(c => c.Name == ReturnWriteOffCategoryName);
            if (cat != null) return cat.Id;
            cat = new ExpenseCategory
            {
                Name = ReturnWriteOffCategoryName,
                ColorCode = "#6B7280",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _context.ExpenseCategories.Add(cat);
            await _context.SaveChangesAsync();
            return cat.Id;
        }

        private static SaleReturnDto MapToSaleReturnDto(SaleReturn r)
        {
            return new SaleReturnDto
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
                IsBadItem = r.IsBadItem,
                BranchId = r.BranchId,
                BranchName = r.Branch?.Name,
                RouteId = r.RouteId,
                RouteName = r.Route?.Name,
                ReturnType = r.ReturnType,
                ReturnCategory = r.ReturnCategory,
                CreatedBy = r.CreatedBy,
                CreatedByName = r.CreatedByUser?.Name,
                Items = r.Items?.Select(i => new SaleReturnItemDto
                {
                    Id = i.Id,
                    ProductName = i.Product != null ? (i.Product.NameEn ?? i.Product.NameAr ?? "") : "",
                    QtyReturned = i.Qty,
                    Reason = i.Reason,
                    DamageCategoryName = i.DamageCategory?.Name,
                    Condition = i.Condition,
                    Amount = i.LineTotal
                }).ToList()
            };
        }

        public async Task<List<DamageCategoryDto>> GetDamageCategoriesAsync(int tenantId)
        {
            var list = await _context.DamageCategories
                .Where(dc => dc.TenantId == tenantId)
                .OrderBy(dc => dc.SortOrder)
                .Select(dc => new DamageCategoryDto { Id = dc.Id, Name = dc.Name, AffectsStock = dc.AffectsStock, IsResaleable = dc.IsResaleable, SortOrder = dc.SortOrder })
                .ToListAsync();
            return list;
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

        public async Task<bool> GetReturnsRequireApprovalAsync(int tenantId)
        {
            var settings = await _settingsService.GetOwnerSettingsAsync(tenantId);
            return string.Equals(settings.GetValueOrDefault("Returns_RequireApproval", "false"), "true", StringComparison.OrdinalIgnoreCase);
        }

        public async Task<bool> GetReturnsEnabledAsync(int tenantId)
        {
            var settings = await _settingsService.GetOwnerSettingsAsync(tenantId);
            if (!settings.TryGetValue("Returns_Enabled", out var v)) return true;
            return string.Equals(v, "true", StringComparison.OrdinalIgnoreCase);
        }

        public async Task<SaleReturnDto> ApproveSaleReturnAsync(int returnId, int tenantId)
        {
            var ret = await _context.SaleReturns
                .Include(r => r.Sale)
                .Include(r => r.Items).ThenInclude(i => i.Product)
                .FirstOrDefaultAsync(r => r.Id == returnId && r.TenantId == tenantId);
            if (ret == null) throw new InvalidOperationException("Return not found");
            if (ret.Status != ReturnStatus.Pending) throw new InvalidOperationException("Return is not pending approval");

            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    var inventoryTransactions = new List<InventoryTransaction>();
                    foreach (var item in ret.Items.Where(i => i.StockEffect == true))
                    {
                        var product = item.Product;
                        if (product == null) continue;
                        var baseQty = item.Qty * product.ConversionToBase;
                        await _context.Database.ExecuteSqlInterpolatedAsync(
                            $@"UPDATE ""Products"" SET ""StockQty"" = ""StockQty"" + {baseQty}, ""UpdatedAt"" = {DateTime.UtcNow} WHERE ""Id"" = {product.Id} AND ""TenantId"" = {tenantId}");
                        inventoryTransactions.Add(new InventoryTransaction
                        {
                            OwnerId = tenantId,
                            TenantId = tenantId,
                            ProductId = product.Id,
                            ChangeQty = baseQty,
                            TransactionType = TransactionType.Return,
                            Reason = $"Sale Return Approved: {ret.ReturnNo}",
                            RefId = ret.Id,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                    _context.InventoryTransactions.AddRange(inventoryTransactions);
                    ret.Status = ReturnStatus.Approved;
                    await _context.SaveChangesAsync();

                    if (ret.Sale?.CustomerId != null)
                    {
                        var customer = await _context.Customers.FindAsync(ret.Sale.CustomerId.Value);
                        if (customer != null)
                            await _customerService.RecalculateCustomerBalanceAsync(ret.Sale.CustomerId.Value, customer.TenantId ?? 0);
                    }
                    await transaction.CommitAsync();
                    return await GetSaleReturnByIdAsync(ret.Id);
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            });
        }

        public async Task<SaleReturnDto> RejectSaleReturnAsync(int returnId, int tenantId)
        {
            var ret = await _context.SaleReturns.FirstOrDefaultAsync(r => r.Id == returnId && r.TenantId == tenantId);
            if (ret == null) throw new InvalidOperationException("Return not found");
            if (ret.Status != ReturnStatus.Pending) throw new InvalidOperationException("Return is not pending");
            ret.Status = ReturnStatus.Rejected;
            await _context.SaveChangesAsync();
            return await GetSaleReturnByIdAsync(ret.Id);
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
                .Include(r => r.Branch)
                .Include(r => r.Route)
                .Include(r => r.CreatedByUser)
                .Include(r => r.Items)
                .ThenInclude(i => i.Product)
                .Include(r => r.Items)
                .ThenInclude(i => i.DamageCategory)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (saleReturn == null) throw new InvalidOperationException("Return not found");
            return MapToSaleReturnDto(saleReturn);
        }

        public async Task<List<CreditNoteDto>> GetCreditNotesAsync(int tenantId, DateTime? fromDate = null, DateTime? toDate = null, int? customerId = null)
        {
            var query = _context.CreditNotes
                .Where(cn => cn.TenantId == tenantId)
                .Include(cn => cn.Customer)
                .Include(cn => cn.LinkedReturn)
                .Include(cn => cn.CreatedByUser)
                .AsQueryable();
            if (fromDate.HasValue)
                query = query.Where(cn => cn.CreatedAt >= fromDate.Value);
            if (toDate.HasValue)
                query = query.Where(cn => cn.CreatedAt < toDate.Value.AddDays(1));
            if (customerId.HasValue)
                query = query.Where(cn => cn.CustomerId == customerId.Value);
            var list = await query.OrderByDescending(cn => cn.CreatedAt).ToListAsync();
            return list.Select(cn => new CreditNoteDto
            {
                Id = cn.Id,
                CustomerId = cn.CustomerId,
                CustomerName = cn.Customer?.Name,
                LinkedReturnId = cn.LinkedReturnId,
                LinkedReturnNo = cn.LinkedReturn?.ReturnNo,
                Amount = cn.Amount,
                Currency = cn.Currency ?? "AED",
                Status = cn.Status ?? "unused",
                CreatedAt = cn.CreatedAt,
                CreatedByName = cn.CreatedByUser?.Name
            }).ToList();
        }

        public async Task<List<DamageReportEntryDto>> GetDamageReportAsync(int tenantId, DateTime? fromDate = null, DateTime? toDate = null, int? branchId = null, int? routeId = null)
        {
            var query = _context.SaleReturnItems
                .Where(sri => (sri.Condition == "damaged" || sri.Condition == "writeoff")
                    && sri.SaleReturn != null
                    && sri.SaleReturn.TenantId == tenantId)
                .Include(sri => sri.SaleReturn!).ThenInclude(r => r!.Sale)
                .Include(sri => sri.SaleReturn!).ThenInclude(r => r!.Customer)
                .Include(sri => sri.SaleReturn!).ThenInclude(r => r!.Branch)
                .Include(sri => sri.SaleReturn!).ThenInclude(r => r!.Route)
                .Include(sri => sri.Product)
                .AsQueryable();
            if (fromDate.HasValue)
                query = query.Where(sri => sri.SaleReturn!.ReturnDate >= fromDate.Value);
            if (toDate.HasValue)
                query = query.Where(sri => sri.SaleReturn!.ReturnDate < toDate.Value.AddDays(1));
            if (branchId.HasValue)
                query = query.Where(sri => sri.SaleReturn!.BranchId == null || sri.SaleReturn.BranchId == branchId.Value);
            if (routeId.HasValue)
                query = query.Where(sri => sri.SaleReturn!.RouteId == null || sri.SaleReturn.RouteId == routeId.Value);
            var items = await query.OrderByDescending(sri => sri.SaleReturn!.ReturnDate).ThenBy(sri => sri.SaleReturn!.ReturnNo).ToListAsync();
            return items.Select(sri => new DamageReportEntryDto
            {
                ReturnId = sri.SaleReturn!.Id,
                ReturnNo = sri.SaleReturn.ReturnNo ?? "",
                ReturnDate = sri.SaleReturn.ReturnDate,
                InvoiceNo = sri.SaleReturn.Sale?.InvoiceNo,
                CustomerName = sri.SaleReturn.Customer?.Name,
                ProductName = sri.Product?.NameEn ?? sri.Product?.Sku,
                Qty = sri.Qty,
                Condition = sri.Condition ?? "",
                LineTotal = sri.LineTotal,
                BranchName = sri.SaleReturn.Branch?.Name,
                RouteName = sri.SaleReturn.Route?.Name
            }).ToList();
        }

        public async Task<byte[]> GenerateReturnBillPdfAsync(int returnId, int tenantId)
        {
            QuestPDF.Settings.License = LicenseType.Community;
            QuestPDF.Settings.CheckIfAllTextGlyphsAreAvailable = false;

            var sr = await _context.SaleReturns
                .Include(r => r.Sale)
                .Include(r => r.Customer)
                .Include(r => r.Items).ThenInclude(i => i.Product)
                .FirstOrDefaultAsync(r => r.Id == returnId && r.TenantId == tenantId);
            if (sr == null)
                throw new InvalidOperationException("Return not found");

            var dto = MapToSaleReturnDto(sr);
            var settings = await _settingsService.GetOwnerSettingsAsync(tenantId);
            var companyName = settings.GetValueOrDefault("COMPANY_NAME_EN") ?? "HexaBill";
            var companyAddress = settings.GetValueOrDefault("COMPANY_ADDRESS") ?? "";
            var companyTrn = settings.GetValueOrDefault("COMPANY_TRN") ?? "";
            var currency = settings.GetValueOrDefault("CURRENCY") ?? "AED";
            var returnPolicyHeader = settings.GetValueOrDefault("RETURN_POLICY_HEADER") ?? "";
            var returnPolicyFooter = settings.GetValueOrDefault("RETURN_POLICY_FOOTER") ?? "";
            var returnBillTitle = settings.GetValueOrDefault("RETURN_BILL_TITLE") ?? "SALES RETURN NOTE";

            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(15, Unit.Millimetre);
                    page.DefaultTextStyle(x => x.FontSize(9).FontFamily("Arial"));

                    page.Header()
                        .Column(column =>
                        {
                            column.Item().BorderBottom(2).BorderColor(Colors.Black).PaddingBottom(5)
                                .Row(row =>
                                {
                                    row.RelativeItem().Column(col =>
                                    {
                                        col.Item().Text(companyName).FontSize(16).Bold();
                                        col.Item().Text(companyAddress).FontSize(10).FontColor(Colors.Grey.Darken2);
                                        if (!string.IsNullOrEmpty(companyTrn))
                                            col.Item().Text($"TRN: {companyTrn}").FontSize(9).FontColor(Colors.Grey.Darken2);
                                    });
                                    row.RelativeItem().Column(col =>
                                    {
                                        col.Item().Text(returnBillTitle).FontSize(18).Bold().AlignRight();
                                        col.Item().Text(dto.ReturnNo).FontSize(12).AlignRight();
                                        col.Item().Text(dto.ReturnDate.ToString("dd-MM-yyyy")).FontSize(9).AlignRight();
                                    });
                                });
                            if (!string.IsNullOrEmpty(returnPolicyHeader))
                                column.Item().PaddingTop(4).Text(returnPolicyHeader).FontSize(8).FontColor(Colors.Grey.Darken1);
                        });

                    page.Content()
                        .Column(column =>
                        {
                            column.Item().PaddingTop(10).Row(row =>
                            {
                                row.RelativeItem().Column(col =>
                                {
                                    col.Item().Text("Customer:").Bold();
                                    col.Item().Text(dto.CustomerName ?? "Cash");
                                    col.Item().Text($"Original Invoice: {dto.SaleInvoiceNo}");
                                    if (!string.IsNullOrEmpty(dto.Reason))
                                        col.Item().Text($"Reason: {dto.Reason}");
                                });
                            });

                            column.Item().PaddingTop(12).Table(table =>
                            {
                                table.ColumnsDefinition(columns =>
                                {
                                    columns.RelativeColumn();
                                    columns.ConstantColumn(60);
                                    columns.ConstantColumn(70);
                                    columns.ConstantColumn(90);
                                });
                                table.Header(header =>
                                {
                                    header.Cell().Element(c => c.BorderBottom(1).BorderColor(Colors.Black).Padding(4).Text("Product").Bold());
                                    header.Cell().Element(c => c.BorderBottom(1).BorderColor(Colors.Black).Padding(4).Text("Qty").Bold());
                                    header.Cell().Element(c => c.BorderBottom(1).BorderColor(Colors.Black).Padding(4).Text("Unit Price").Bold());
                                    header.Cell().Element(c => c.BorderBottom(1).BorderColor(Colors.Black).Padding(4).Text("Amount").Bold());
                                });
                                foreach (var item in dto.Items ?? new List<SaleReturnItemDto>())
                                {
                                    table.Cell().Element(c => c.BorderBottom(1).BorderColor(Colors.Grey.Lighten1).Padding(4).Text(item.ProductName));
                                    table.Cell().Element(c => c.BorderBottom(1).BorderColor(Colors.Grey.Lighten1).Padding(4).Text(item.QtyReturned.ToString("N2")));
                                    table.Cell().Element(c => c.BorderBottom(1).BorderColor(Colors.Grey.Lighten1).Padding(4).Text((item.Amount / (item.QtyReturned > 0 ? item.QtyReturned : 1)).ToString("N2")));
                                    table.Cell().Element(c => c.BorderBottom(1).BorderColor(Colors.Grey.Lighten1).Padding(4).Text(item.Amount.ToString("N2")));
                                }
                            });

                            column.Item().PaddingTop(10).Row(row =>
                            {
                                row.RelativeItem();
                                row.ConstantItem(120).Column(col =>
                                {
                                    col.Item().Row(r =>
                                    {
                                        r.RelativeItem().Text("Grand Total:").Bold();
                                        r.ConstantItem(80).Text($"{dto.GrandTotal:N2} {currency}").Bold().AlignRight();
                                    });
                                });
                            });

                            if (!string.IsNullOrEmpty(returnPolicyFooter))
                                column.Item().PaddingTop(20).Text(returnPolicyFooter).FontSize(8).FontColor(Colors.Grey.Darken1);
                        });

                    page.Footer()
                        .AlignCenter()
                        .DefaultTextStyle(x => x.FontSize(8).FontColor(Colors.Grey.Medium))
                        .Text(x => { x.CurrentPageNumber(); x.Span(" / "); x.TotalPages(); });
                });
            });

            return document.GeneratePdf();
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

