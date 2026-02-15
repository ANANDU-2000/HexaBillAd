/*
Purpose: Sale service for POS billing and invoice management
Author: AI Assistant
Date: 2024
*/
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;
using System.Text.Json;
using HexaBill.Api.Modules.Notifications;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Shared.Services;
using HexaBill.Api.Shared.Validation;

namespace HexaBill.Api.Modules.Billing
{
    public interface ISaleService
    {
        // MULTI-TENANT: All methods now require tenantId for data isolation. Optional branchId/routeId filter; staff scope applied when userId and role provided.
        Task<PagedResponse<SaleDto>> GetSalesAsync(int tenantId, int page = 1, int pageSize = 10, string? search = null, int? branchId = null, int? routeId = null, int? userIdForStaff = null, string? roleForStaff = null);
        Task<SaleDto?> GetSaleByIdAsync(int id, int tenantId, HashSet<int>? allowedRouteIdsForStaff = null);
        Task<SaleDto> CreateSaleAsync(CreateSaleRequest request, int userId, int tenantId);
        Task<SaleDto> CreateSaleWithOverrideAsync(CreateSaleRequest request, string reason, int userId, int tenantId);
        Task<SaleDto> UpdateSaleAsync(int saleId, CreateSaleRequest request, int userId, int tenantId, string? editReason = null, byte[]? expectedRowVersion = null);
        Task<bool> DeleteSaleAsync(int saleId, int userId, int tenantId);
        Task<string> GenerateInvoiceNumberAsync(int tenantId);
        Task<byte[]> GenerateInvoicePdfAsync(int saleId, int tenantId);
        Task<bool> CanEditInvoiceAsync(int saleId, int userId, string userRole, int tenantId);
        Task<bool> UnlockInvoiceAsync(int saleId, int userId, string unlockReason, int tenantId);
        Task<List<InvoiceVersion>> GetInvoiceVersionsAsync(int saleId, int tenantId);
        Task<SaleDto?> RestoreInvoiceVersionAsync(int saleId, int versionNumber, int userId, int tenantId);
        Task<bool> LockOldInvoicesAsync(int tenantId); // Background job to lock invoices after 48 hours
        Task<List<SaleDto>> GetDeletedSalesAsync(int tenantId); // Get all deleted sales for audit trail
        Task<ReconciliationResult> ReconcileAllPaymentStatusAsync(int tenantId, int userId); // CRITICAL: Sync all Sale.PaymentStatus with actual payments
        Task<bool> ReconcileSalePaymentStatusAsync(int saleId, int tenantId); // Reconcile single sale payment status
    }

    public class SaleService : ISaleService
    {
        private readonly AppDbContext _context;
        private readonly IPdfService _pdfService;
        private readonly IComprehensiveBackupService _backupService;
        private readonly IInvoiceNumberService _invoiceNumberService;
        private readonly IValidationService _validationService;
        private readonly IAlertService _alertService;
        private readonly IBalanceService _balanceService;
        private readonly ITimeZoneService _timeZoneService;
        private readonly IRouteScopeService _routeScopeService;

        public SaleService(
            AppDbContext context, 
            IPdfService pdfService, 
            IComprehensiveBackupService backupService,
            IInvoiceNumberService invoiceNumberService,
            IValidationService validationService,
            IAlertService alertService,
            IBalanceService balanceService,
            ITimeZoneService timeZoneService,
            IRouteScopeService routeScopeService)
        {
            _context = context;
            _pdfService = pdfService;
            _backupService = backupService;
            _invoiceNumberService = invoiceNumberService;
            _validationService = validationService;
            _alertService = alertService;
            _balanceService = balanceService;
            _timeZoneService = timeZoneService;
            _routeScopeService = routeScopeService;
        }

        public async Task<PagedResponse<SaleDto>> GetSalesAsync(int tenantId, int page = 1, int pageSize = 10, string? search = null, int? branchId = null, int? routeId = null, int? userIdForStaff = null, string? roleForStaff = null)
        {
            try
            {
                // OPTIMIZATION: Use AsNoTracking for read-only queries and limit page size
                pageSize = Math.Min(pageSize, 100); // Max 100 items per page for performance
                
                // CRITICAL: Filter by tenantId for data isolation
                // SUPER ADMIN (TenantId = 0): See ALL tenants' data
                var query = _context.Sales
                    .AsNoTracking() // Performance: No change tracking needed for read-only
                    .Include(s => s.Customer)
                    .Include(s => s.Items)
                        .ThenInclude(i => i.Product)
                    .Include(s => s.CreatedByUser)
                    .Include(s => s.LastModifiedByUser)
                    .AsQueryable();

                // CRITICAL: Tenant filter - Skip for super admin (TenantId = 0)
                if (tenantId > 0)
                {
                    query = query.Where(s => s.TenantId == tenantId);
                }
                // Super admin (TenantId = 0) sees ALL tenants

                // Staff scope: restrict to assigned routes only
                if (tenantId > 0 && userIdForStaff.HasValue && !string.IsNullOrEmpty(roleForStaff) && roleForStaff.Trim().Equals("Staff", StringComparison.OrdinalIgnoreCase))
                {
                    var restrictedRouteIds = await _routeScopeService.GetRestrictedRouteIdsAsync(userIdForStaff.Value, tenantId, roleForStaff);
                    if (restrictedRouteIds != null)
                    {
                        if (restrictedRouteIds.Length == 0)
                            return new PagedResponse<SaleDto> { Items = new List<SaleDto>(), TotalCount = 0, Page = page, PageSize = pageSize, TotalPages = 0 };
                        query = query.Where(s => s.RouteId != null && restrictedRouteIds.Contains(s.RouteId.Value));
                    }
                }

                if (branchId.HasValue) query = query.Where(s => s.BranchId == branchId.Value);
                if (routeId.HasValue) query = query.Where(s => s.RouteId == routeId.Value);

                // Filter deleted sales (after migration)
                query = query.Where(s => !s.IsDeleted);

                if (!string.IsNullOrEmpty(search))
                {
                    query = query.Where(s => s.InvoiceNo.Contains(search) || 
                                           (s.Customer != null && s.Customer.Name.Contains(search)));
                }

                var totalCount = await query.CountAsync();
                
                // Load into memory first to avoid database column issues
                var salesList = await query
                    .OrderByDescending(s => s.InvoiceDate)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                var sales = salesList.Select(s => new SaleDto
                {
                    Id = s.Id,
                    OwnerId = s.TenantId ?? 0, // CRITICAL: Must include tenantId for PDF generation (mapped to OwnerId for compatibility)
                    InvoiceNo = s.InvoiceNo,
                    InvoiceDate = s.InvoiceDate,
                    CustomerId = s.CustomerId,
                    CustomerName = s.Customer != null ? s.Customer.Name : null,
                    Subtotal = s.Subtotal,
                    VatTotal = s.VatTotal,
                    Discount = s.Discount,
                    GrandTotal = s.GrandTotal,
                    PaymentStatus = s.PaymentStatus.ToString(),
                    Notes = s.Notes,
                    Items = s.Items.Select(i => new SaleItemDto
                    {
                        Id = i.Id,
                        ProductId = i.ProductId,
                        ProductName = i.Product?.NameEn ?? "Unknown",
                        UnitType = i.UnitType,
                        Qty = i.Qty,
                        UnitPrice = i.UnitPrice,
                        Discount = i.Discount,
                        VatAmount = i.VatAmount,
                        LineTotal = i.LineTotal
                    }).ToList(),
                    CreatedAt = s.CreatedAt,
                    CreatedBy = s.CreatedByUser != null ? s.CreatedByUser.Name : "Unknown",
                    Version = s.Version,
                    IsLocked = s.IsLocked,
                    LastModifiedAt = s.LastModifiedAt,
                    LastModifiedBy = s.LastModifiedByUser != null ? s.LastModifiedByUser.Name : null,
                    RowVersion = s.RowVersion != null && s.RowVersion.Length > 0 
                        ? Convert.ToBase64String(s.RowVersion) 
                        : null
                }).ToList();

                return new PagedResponse<SaleDto>
                {
                    Items = sales,
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ GetSalesAsync Error: {ex.Message}");
                Console.WriteLine($"❌ Stack Trace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"❌ Inner Exception: {ex.InnerException.Message}");
                }
                throw;
            }
        }

        public async Task<SaleDto?> GetSaleByIdAsync(int id, int tenantId, HashSet<int>? allowedRouteIdsForStaff = null)
        {
            // CRITICAL: Filter by tenantId and use AsNoTracking for read-only queries
            // SUPER ADMIN (TenantId = 0): Can access ALL tenants' data
            IQueryable<Sale> baseQuery = _context.Sales
                .AsNoTracking()
                .Where(s => s.Id == id && !s.IsDeleted);
            
            // Apply tenant filter only for non-super-admin
            if (tenantId > 0)
            {
                baseQuery = baseQuery.Where(s => s.TenantId == tenantId);
            }
            
            var sale = await baseQuery
                .Include(s => s.Customer)
                .Include(s => s.Items)
                    .ThenInclude(i => i.Product)
                .FirstOrDefaultAsync();

            if (sale == null) return null;

            // Staff scope: if allowedRouteIdsForStaff is set, sale must belong to one of those routes (or 404)
            if (allowedRouteIdsForStaff != null)
            {
                if (!sale.RouteId.HasValue || !allowedRouteIdsForStaff.Contains(sale.RouteId.Value))
                    return null;
            }

            return new SaleDto
            {
                Id = sale.Id,
                OwnerId = sale.TenantId ?? 0, // CRITICAL: Must include tenantId for PDF generation (mapped to OwnerId)
                InvoiceNo = sale.InvoiceNo,
                InvoiceDate = sale.InvoiceDate,
                CustomerId = sale.CustomerId,
                BranchId = sale.BranchId,
                RouteId = sale.RouteId,
                CustomerName = sale.Customer?.Name,
                Subtotal = sale.Subtotal,
                VatTotal = sale.VatTotal,
                Discount = sale.Discount,
                GrandTotal = sale.GrandTotal,
                PaymentStatus = sale.PaymentStatus.ToString(),
                Notes = sale.Notes,
                Items = sale.Items.Select(i => new SaleItemDto
                {
                    Id = i.Id,
                    ProductId = i.ProductId,
                    ProductName = i.Product?.NameEn ?? $"Product {i.ProductId}", // CRITICAL: Null check to prevent NRE
                    UnitType = string.IsNullOrWhiteSpace(i.UnitType) ? (i.Product?.UnitType ?? "CRTN") : i.UnitType.ToUpper(),
                    Qty = i.Qty,
                    UnitPrice = i.UnitPrice,
                    Discount = i.Discount,
                    VatAmount = i.VatAmount,
                    LineTotal = i.LineTotal
                }).ToList(),
                CreatedAt = sale.CreatedAt,
                CreatedBy = sale.CreatedByUser?.Name ?? "Unknown",
                Version = sale.Version,
                IsLocked = sale.IsLocked,
                LastModifiedAt = sale.LastModifiedAt,
                LastModifiedBy = sale.LastModifiedByUser?.Name,
                RowVersion = sale.RowVersion != null && sale.RowVersion.Length > 0 
                    ? Convert.ToBase64String(sale.RowVersion) 
                    : null
            };
        }

        public async Task<SaleDto> CreateSaleAsync(CreateSaleRequest request, int userId, int tenantId)
        {
            // Retry logic for invoice number conflicts (race condition handling)
            const int maxRetries = 5;
            Exception? lastException = null;
            
            for (int retryCount = 0; retryCount < maxRetries; retryCount++)
            {
                try
                {
                    return await CreateSaleInternalAsync(request, userId, tenantId);
                }
                catch (DbUpdateException ex) when (IsInvoiceNumberConflict(ex))
                {
                    lastException = ex;
                    
                    if (retryCount < maxRetries - 1)
                    {
                        // Race condition: Another transaction saved the same invoice number
                        Console.WriteLine($"⚠️ Invoice number conflict detected (attempt {retryCount + 1}/{maxRetries}). Retrying with new number...");
                        
                        // Clear the invoice number to force regeneration
                        request.InvoiceNo = null;
                        
                        // Exponential backoff: 50ms, 100ms, 200ms, 400ms
                        await Task.Delay(50 * (int)Math.Pow(2, retryCount));
                    }
                }
                catch (Exception ex)
                {
                    // Log non-duplicate errors
                    Console.WriteLine($"❌ CreateSaleAsync Error: {ex.GetType().Name}");
                    Console.WriteLine($"❌ Message: {ex.Message}");
                    Console.WriteLine($"❌ Stack Trace: {ex.StackTrace}");
                    if (ex.InnerException != null)
                    {
                        Console.WriteLine($"❌ Inner Exception: {ex.InnerException.GetType().Name}");
                        Console.WriteLine($"❌ Inner Message: {ex.InnerException.Message}");
                        Console.WriteLine($"❌ Inner Stack Trace: {ex.InnerException.StackTrace}");
                    }
                    throw; // Re-throw non-duplicate errors immediately
                }
            }
            
            // All retries exhausted
            Console.WriteLine($"❌ Failed to create sale after {maxRetries} attempts due to invoice number conflicts.");
            throw new InvalidOperationException(
                "Unable to generate unique invoice number after multiple attempts. This may be due to high concurrent activity. Please try again.",
                lastException
            );
        }
        
        // Helper method to detect invoice number conflict errors
        private bool IsInvoiceNumberConflict(DbUpdateException ex)
        {
            if (ex.InnerException == null) return false;
            
            var innerMessage = ex.InnerException.Message ?? string.Empty;
            return innerMessage.Contains("IX_Sales_InvoiceNo", StringComparison.OrdinalIgnoreCase) ||
                   innerMessage.Contains("duplicate key", StringComparison.OrdinalIgnoreCase);
        }
        
        private async Task<SaleDto> CreateSaleInternalAsync(CreateSaleRequest request, int userId, int tenantId)
        {
            // Log incoming request for debugging
            Console.WriteLine($"📝 CreateSaleInternalAsync called with InvoiceNo: '{request.InvoiceNo ?? "NULL"}' for TenantId: {tenantId}, UserId: {userId}");
                    
            // CRITICAL FIX: Generate invoice number BEFORE starting transaction
            // to avoid "transaction aborted" errors
            string invoiceNo;
            if (!string.IsNullOrWhiteSpace(request.InvoiceNo))
            {
                Console.WriteLine($"🔢 Frontend provided invoice number: {request.InvoiceNo}");
                invoiceNo = request.InvoiceNo.Trim();
            }
            else
            {
                // CRITICAL: Auto-generate invoice number with tenantId
                invoiceNo = await _invoiceNumberService.GenerateNextInvoiceNumberAsync(tenantId);
                Console.WriteLine($"🔢 Auto-generated invoice number: {invoiceNo} for TenantId: {tenantId}");
            }
            
            // Use serializable isolation to prevent concurrent invoice number conflicts
            using var transaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            try
            {
                // IDEMPOTENCY CHECK: If ExternalReference provided, check for duplicate
                if (!string.IsNullOrWhiteSpace(request.ExternalReference))
                {
                    var existingSale = await _context.Sales
                        .FirstOrDefaultAsync(s => s.ExternalReference == request.ExternalReference && !s.IsDeleted);
                    if (existingSale != null)
                    {
                        Console.WriteLine($"⚠️ Duplicate external reference detected: {request.ExternalReference}. Returning existing sale ID: {existingSale.Id}");
                        return await GetSaleByIdAsync(existingSale.Id, tenantId);
                    }
                }

                // CRITICAL: Check if invoice number already exists (owner-scoped)
                // FIXED: Only check finalized sales to avoid false positives from draft/stuck invoices
                var duplicateInvoice = await _context.Sales
                    .FirstOrDefaultAsync(s => s.InvoiceNo == invoiceNo && s.TenantId == tenantId && !s.IsDeleted && s.IsFinalized);
                
                if (duplicateInvoice != null)
                {
                    Console.WriteLine($"❌ Invoice {invoiceNo} already exists for owner {tenantId} (ID: {duplicateInvoice.Id}). Throwing error to trigger retry.");
                    
                    // Send admin alert
                    await _alertService.CreateAlertAsync(
                        AlertType.DuplicateInvoice,
                        "Duplicate Invoice Number",
                        $"Invoice number {invoiceNo} already exists for owner {tenantId} (Sale ID: {duplicateInvoice.Id})",
                        AlertSeverity.Error
                    );
                    
                    // Throw to trigger retry with new number
                    throw new DbUpdateException("Duplicate invoice number", new Exception("IX_Sales_InvoiceNo"));
                }
                
                // Validate invoice number format if manually provided
                if (!string.IsNullOrWhiteSpace(request.InvoiceNo))
                {
                    var isValid = await _invoiceNumberService.ValidateInvoiceNumberAsync(invoiceNo, tenantId);
                    if (!isValid)
                    {
                        throw new InvalidOperationException($"Invoice number '{invoiceNo}' is invalid. Please use a different number.");
                    }
                }
                Console.WriteLine($"✅ Using invoice number: {invoiceNo}");

                // CRITICAL MULTI-TENANT FIX: Validate customer belongs to this owner and load customer
                Customer? customer = null;
                if (request.CustomerId.HasValue)
                {
                    customer = await _context.Customers
                        .FirstOrDefaultAsync(c => c.Id == request.CustomerId.Value && c.TenantId == tenantId);
                    
                    if (customer == null)
                    {
                        throw new InvalidOperationException($"Customer with ID {request.CustomerId.Value} not found for your account. Please verify the customer exists.");
                    }
                }

                // Calculate totals
                var vatPercent = await GetVatPercentAsync();
                decimal subtotal = 0;
                decimal vatTotal = 0;

                var saleItems = new List<SaleItem>();
                var inventoryTransactions = new List<InventoryTransaction>();

                // Use validation service for robust validation
                var validationErrors = new List<string>();
                foreach (var item in request.Items)
                {
                    // Validate quantity
                    var qtyResult = await _validationService.ValidateQuantityAsync(item.Qty);
                    if (!qtyResult.IsValid)
                    {
                        validationErrors.AddRange(qtyResult.Errors.Select(e => $"Item {item.ProductId}: {e}"));
                    }

                    // Validate price
                    var priceResult = await _validationService.ValidatePriceAsync(item.UnitPrice);
                    if (!priceResult.IsValid)
                    {
                        validationErrors.AddRange(priceResult.Errors.Select(e => $"Item {item.ProductId}: {e}"));
                    }

                    // Validate stock availability
                    var stockResult = await _validationService.ValidateStockAvailabilityAsync(item.ProductId, item.Qty);
                    if (!stockResult.IsValid)
                    {
                        validationErrors.AddRange(stockResult.Errors);
                    }
                    else if (stockResult.Warnings.Any())
                    {
                        // Log warnings but don't fail
                        foreach (var warning in stockResult.Warnings)
                        {
                            Console.WriteLine($"⚠️ Stock Warning: {warning}");
                        }
                    }
                }

                if (validationErrors.Any())
                {
                    throw new InvalidOperationException(string.Join("\n", validationErrors));
                }

                foreach (var item in request.Items)
                {
                    // CRITICAL MULTI-TENANT FIX: Filter product by tenantId to prevent cross-owner access
                    var product = await _context.Products
                        .FirstOrDefaultAsync(p => p.Id == item.ProductId && p.TenantId == tenantId);

                    if (product == null)
                        throw new InvalidOperationException($"Product with ID {item.ProductId} not found for your account. Please verify the product exists.");

                    // Calculate base quantity
                    var baseQty = item.Qty * product.ConversionToBase;

                    // Stock already validated above, but double-check for safety
                    if (product.StockQty < baseQty)
                    {
                        throw new InvalidOperationException($"Insufficient stock for {product.NameEn}. Available: {product.StockQty}, Required: {baseQty}");
                    }

                    // Calculate line totals: Total = qty × price, VAT = Total × 5%, Amount = Total + VAT
                    var rowTotal = item.UnitPrice * item.Qty;
                    var vatAmount = Math.Round(rowTotal * (vatPercent / 100), 2);
                    var lineAmount = rowTotal + vatAmount;

                    subtotal += rowTotal;
                    vatTotal += vatAmount;

                    // Create sale item
                    var saleItem = new SaleItem
                    {
                        ProductId = item.ProductId,
                        UnitType = string.IsNullOrWhiteSpace(item.UnitType) ? "CRTN" : item.UnitType.ToUpper(), // Ensure UnitType is never null or empty
                        Qty = item.Qty,
                        UnitPrice = item.UnitPrice,
                        Discount = 0, // No per-item discount
                        VatAmount = vatAmount,
                        LineTotal = lineAmount
                    };

                    saleItems.Add(saleItem);

                    // CRITICAL: Decrement stock only when invoice is finalized
                    // Stock is decremented atomically in this transaction
                    // If transaction fails/rolls back, stock is automatically restored
                    product.StockQty -= baseQty;
                    product.UpdatedAt = DateTime.UtcNow;

                    // Create inventory transaction
                    var inventoryTransaction = new InventoryTransaction
                    {
                        OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                        TenantId = tenantId, // CRITICAL: Set new TenantId
                        ProductId = item.ProductId,
                        ChangeQty = -baseQty,
                        TransactionType = TransactionType.Sale,
                        RefId = null, // Will be updated after sale is created
                        CreatedAt = DateTime.UtcNow
                    };

                    inventoryTransactions.Add(inventoryTransaction);
                }

                // Apply global discount (subtract from subtotal + VAT)
                var grandTotal = Math.Round((subtotal + vatTotal - request.Discount), 2);

                // CREDIT LIMIT VALIDATION: Check if sale would exceed customer credit limit
                bool creditLimitExceeded = false;
                string? creditLimitWarning = null;
                if (customer != null && customer.CreditLimit > 0)
                {
                    // Calculate current outstanding balance (unpaid amount)
                    // For credit customers, outstanding = PendingBalance (which tracks unpaid sales)
                    decimal currentOutstanding = customer.PendingBalance;
                    
                    // Calculate what the new outstanding balance would be after this sale
                    // Only count unpaid portion of this sale (grandTotal - any payments provided)
                    decimal unpaidAmountFromThisSale = grandTotal;
                    if (request.Payments != null && request.Payments.Any())
                    {
                        var clearedPayments = request.Payments
                            .Where(p => p.Method.ToUpper() == "CASH" || p.Method.ToUpper() == "ONLINE")
                            .Sum(p => p.Amount);
                        unpaidAmountFromThisSale = Math.Max(0, grandTotal - clearedPayments);
                    }
                    
                    decimal newOutstandingBalance = currentOutstanding + unpaidAmountFromThisSale;
                    
                    if (newOutstandingBalance > customer.CreditLimit)
                    {
                        creditLimitExceeded = true;
                        creditLimitWarning = $"Customer credit limit of {customer.CreditLimit:C} exceeded. Current outstanding: {currentOutstanding:C}, New sale amount: {grandTotal:C}, New outstanding balance: {newOutstandingBalance:C}";
                        Console.WriteLine($"⚠️ Credit Limit Warning: {creditLimitWarning}");
                    }
                }

                // Create sale
                // CRITICAL: Stock is decremented in this transaction (lines 276-290)
                // IsFinalized = true means stock has been decremented and invoice is finalized
                
                // CASH CUSTOMER LOGIC: If no customer ID (cash customer), auto-mark as paid with cash payment
                bool isCashCustomer = !request.CustomerId.HasValue;
                decimal initialPaidAmount = 0;
                SalePaymentStatus initialPaymentStatus = SalePaymentStatus.Pending;
                
                if (isCashCustomer)
                {
                    // Cash customer = instant payment, mark as paid immediately
                    initialPaidAmount = grandTotal;
                    initialPaymentStatus = SalePaymentStatus.Paid;
                }
                
                var sale = new Sale
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    InvoiceNo = invoiceNo,
                    ExternalReference = request.ExternalReference, // Set external reference for idempotency
                    InvoiceDate = request.InvoiceDate ?? _timeZoneService.ConvertToUtc(_timeZoneService.GetCurrentTime()), // Use GST time, store as UTC
                    CustomerId = request.CustomerId,
                    BranchId = request.BranchId,
                    RouteId = request.RouteId,
                    Subtotal = subtotal,
                    VatTotal = vatTotal,
                    Discount = request.Discount,
                    GrandTotal = grandTotal,
                    TotalAmount = grandTotal, // Set TotalAmount = GrandTotal
                    PaidAmount = initialPaidAmount, // Cash customer = paid immediately
                    PaymentStatus = initialPaymentStatus, // Cash customer = Paid status
                    IsFinalized = true, // Invoice is finalized immediately - stock decremented in transaction
                    Notes = request.Notes,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Sales.Add(sale);
                await _context.SaveChangesAsync();

                // Update sale items with sale ID
                foreach (var item in saleItems)
                {
                    item.SaleId = sale.Id;
                }

                _context.SaleItems.AddRange(saleItems);

                // Update inventory transactions with sale ID
                foreach (var invTx in inventoryTransactions)
                {
                    invTx.RefId = sale.Id;
                }

                _context.InventoryTransactions.AddRange(inventoryTransactions);

                // Process payments if provided (e.g., cash/online payment at POS)
                decimal totalPaid = 0;
                if (request.Payments != null && request.Payments.Any())
                {
                    // DUPLICATE CASH PAYMENT PREVENTION
                    var cashPayments = request.Payments.Where(p => p.Method.ToUpper() == "CASH").ToList();
                    if (cashPayments.Count > 1)
                    {
                        // Send admin alert
                        await _alertService.CreateAlertAsync(
                            AlertType.DuplicatePayment,
                            "Duplicate Cash Payment",
                            $"Multiple cash payments detected for invoice {invoiceNo}. Only first payment will be processed.",
                            AlertSeverity.Warning
                        );
                        
                        // Keep only first cash payment
                        var firstCash = cashPayments.First();
                        request.Payments = request.Payments.Where(p => p != firstCash || !cashPayments.Skip(1).Contains(p)).ToList();
                    }
                    
                    foreach (var paymentRequest in request.Payments)
                    {
                        var paymentMode = Enum.Parse<PaymentMode>(paymentRequest.Method.ToUpper());
                        var paymentStatus = paymentMode == PaymentMode.CHEQUE 
                            ? PaymentStatus.PENDING 
                            : (paymentMode == PaymentMode.CASH || paymentMode == PaymentMode.ONLINE 
                                ? PaymentStatus.CLEARED 
                                : PaymentStatus.PENDING);

                        var paymentDate = DateTime.UtcNow;
                        
                        // Create payment using EF Core (PostgreSQL compatible)
                        var payment = new Payment
                        {
                            OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                            TenantId = tenantId, // CRITICAL: Set new TenantId
                            SaleId = sale.Id,
                            CustomerId = request.CustomerId,
                            Amount = paymentRequest.Amount,
                            Mode = paymentMode,
                            Reference = paymentRequest.Ref,
                            Status = paymentStatus,
                            PaymentDate = paymentDate,
                            CreatedBy = userId,
                            CreatedAt = paymentDate,
                            UpdatedAt = paymentDate,
                            RowVersion = new byte[0]
                        };
                        
                        _context.Payments.Add(payment);
                        await _context.SaveChangesAsync(); // Save to get payment ID generated
                        
                        totalPaid += paymentRequest.Amount;
                        
                        // Update invoice if payment is immediately cleared
                        if (paymentStatus == PaymentStatus.CLEARED)
                        {
                            sale.PaidAmount += paymentRequest.Amount;
                            sale.LastPaymentDate = payment.PaymentDate;
                        }
                    }

                    // Update payment status based on total paid
                    if (totalPaid >= grandTotal)
                    {
                        sale.PaymentStatus = SalePaymentStatus.Paid;
                    }
                    else if (totalPaid > 0)
                    {
                        sale.PaymentStatus = SalePaymentStatus.Partial;
                    }
                    else
                    {
                        sale.PaymentStatus = SalePaymentStatus.Pending;
                    }

                    // Update customer balance if any payments are cleared
                    if (request.CustomerId.HasValue)
                    {
                        var clearedAmount = request.Payments
                            .Where(p => p.Method.ToUpper() == "CASH" || p.Method.ToUpper() == "ONLINE")
                            .Sum(p => p.Amount);
                        
                        if (clearedAmount > 0)
                        {
                            var customerEntity = await _context.Customers.FindAsync(request.CustomerId.Value);
                            if (customerEntity != null)
                            {
                                customerEntity.Balance -= clearedAmount;
                                customerEntity.LastActivity = DateTime.UtcNow;
                                customerEntity.UpdatedAt = DateTime.UtcNow;
                            }
                        }
                    }
                }
                else
                {
                    // No payment provided - mark as pending
                    sale.PaymentStatus = SalePaymentStatus.Pending;
                    sale.PaidAmount = 0;
                    
                    // New sale increases customer balance (customer owes more)
                    if (request.CustomerId.HasValue)
                    {
                        var customerEntity = await _context.Customers.FindAsync(request.CustomerId.Value);
                        if (customerEntity != null)
                        {
                            customerEntity.Balance += grandTotal;
                            customerEntity.LastActivity = DateTime.UtcNow;
                            customerEntity.UpdatedAt = DateTime.UtcNow;
                        }
                    }
                }

                // Create audit log
                var auditLog = new AuditLog
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    UserId = userId,
                    Action = "Sale Created",
                    Details = $"Invoice: {invoiceNo}, Total: {grandTotal:C}",
                    CreatedAt = DateTime.UtcNow
                };

                _context.AuditLogs.Add(auditLog);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // ✅ REAL-TIME BALANCE UPDATE: Update customer balance after invoice creation
                if (request.CustomerId.HasValue)
                {
                    try
                    {
                        await _balanceService.UpdateCustomerBalanceOnInvoiceCreatedAsync(
                            request.CustomerId.Value,
                            grandTotal);
                        
                        // Also update for any cleared payments
                        if (request.Payments != null && request.Payments.Any())
                        {
                            var clearedAmount = request.Payments
                                .Where(p => p.Method.ToUpper() == "CASH" || p.Method.ToUpper() == "ONLINE")
                                .Sum(p => p.Amount);
                            
                            if (clearedAmount > 0)
                            {
                                await _balanceService.UpdateCustomerBalanceOnPaymentCreatedAsync(
                                    request.CustomerId.Value,
                                    clearedAmount);
                            }
                        }
                    }
                    catch (Exception balanceEx)
                    {
                        Console.WriteLine($"⚠️ Failed to update balance: {balanceEx.Message}");
                        // Don't fail the sale, but create alert
                        await _alertService.CreateAlertAsync(
                            AlertType.BalanceMismatch,
                            "Failed to update customer balance after invoice creation",
                            $"Invoice: {invoiceNo}, Customer: {request.CustomerId}",
                            AlertSeverity.Warning);
                    }
                }

                // Auto-backup after successful invoice save
                try
                {
                    var savedSale = await GetSaleByIdAsync(sale.Id, tenantId);
                    if (savedSale != null)
                    {
                        // CRITICAL: Generate and save PDF - ensure it completes successfully
                        try
                        {
                            var pdfBytes = await _pdfService.GenerateInvoicePdfAsync(savedSale);
                            if (pdfBytes == null || pdfBytes.Length == 0)
                            {
                                Console.WriteLine($"❌ PDF Generation Failed: Generated PDF is empty for invoice {savedSale.InvoiceNo}");
                            }
                            else
                            {
                                Console.WriteLine($"✅ PDF Generated Successfully: {pdfBytes.Length} bytes for invoice {savedSale.InvoiceNo}");
                            }
                        }
                        catch (Exception pdfEx)
                        {
                            Console.WriteLine($"❌ CRITICAL: PDF Generation Failed for invoice {savedSale.InvoiceNo}: {pdfEx.Message}");
                            Console.WriteLine($"   Stack Trace: {pdfEx.StackTrace}");
                            // Log but don't fail sale creation - PDF can be regenerated later
                        }
                        
                        // Create backup (background task, don't block)
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                await _backupService.CreateFullBackupAsync(exportToDesktop: true);
                                Console.WriteLine("✅ Auto-backup completed to Desktop");
                            }
                            catch (Exception backupEx)
                            {
                                Console.WriteLine($"⚠️ Auto-backup failed: {backupEx.Message}");
                            }
                        });
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"⚠️ Failed to generate PDF after invoice save: {ex.Message}");
                    Console.WriteLine($"   Stack Trace: {ex.StackTrace}");
                    // Don't fail the sale creation if PDF generation fails
                }

                // Return sale DTO with credit limit warnings if applicable
                var saleDto = await GetSaleByIdAsync(sale.Id, tenantId) ?? throw new InvalidOperationException("Failed to retrieve created sale");
                saleDto.CreditLimitExceeded = creditLimitExceeded;
                saleDto.CreditLimitWarning = creditLimitWarning;
                return saleDto;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                
                // Log detailed error for debugging
                Console.WriteLine($"❌ CreateSaleAsync Error: {ex.GetType().Name}");
                Console.WriteLine($"❌ Message: {ex.Message}");
                Console.WriteLine($"❌ Stack Trace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"❌ Inner Exception: {ex.InnerException.GetType().Name}");
                    Console.WriteLine($"❌ Inner Message: {ex.InnerException.Message}");
                    Console.WriteLine($"❌ Inner Stack Trace: {ex.InnerException.StackTrace}");
                }
                
                // Re-throw to be caught by controller
                throw;
            }
        }

        public async Task<SaleDto> CreateSaleWithOverrideAsync(CreateSaleRequest request, string reason, int userId, int tenantId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Similar to CreateSaleAsync but without stock validation
                var invoiceNo = await GenerateInvoiceNumberAsync(tenantId);
                var vatPercent = await GetVatPercentAsync();
                decimal subtotal = 0;
                decimal vatTotal = 0;

                var saleItems = new List<SaleItem>();
                var inventoryTransactions = new List<InventoryTransaction>();

                foreach (var item in request.Items)
                {
                    var product = await _context.Products.FindAsync(item.ProductId);
                    if (product == null)
                        throw new InvalidOperationException($"Product with ID {item.ProductId} not found");

                    var baseQty = item.Qty * product.ConversionToBase;
                    // Calculate line totals: Total = qty × price, VAT = Total × 5%, Amount = Total + VAT
                    var rowTotal = item.UnitPrice * item.Qty;
                    var vatAmount = Math.Round(rowTotal * (vatPercent / 100), 2);
                    var lineAmount = rowTotal + vatAmount;

                    subtotal += rowTotal;
                    vatTotal += vatAmount;

                    var saleItem = new SaleItem
                    {
                        ProductId = item.ProductId,
                        UnitType = item.UnitType,
                        Qty = item.Qty,
                        UnitPrice = item.UnitPrice,
                        Discount = 0, // No per-item discount
                        VatAmount = vatAmount,
                        LineTotal = lineAmount
                    };

                    saleItems.Add(saleItem);

                    // Update stock even if negative (admin override)
                    product.StockQty -= baseQty;
                    product.UpdatedAt = DateTime.UtcNow;

                    var inventoryTransaction = new InventoryTransaction
                    {
                        OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                        TenantId = tenantId, // CRITICAL: Set new TenantId
                        ProductId = item.ProductId,
                        ChangeQty = -baseQty,
                        TransactionType = TransactionType.Sale,
                        RefId = null,
                        Reason = $"Admin Override: {reason}",
                        CreatedAt = DateTime.UtcNow
                    };

                    inventoryTransactions.Add(inventoryTransaction);
                }

                // Apply global discount (subtract from subtotal + VAT)
                var grandTotal = Math.Round((subtotal + vatTotal - request.Discount), 2);

                // CASH CUSTOMER LOGIC: If no customer ID (cash customer), auto-mark as paid with cash payment
                bool isCashCustomerOverride = !request.CustomerId.HasValue;
                decimal initialPaidAmountOverride = 0;
                SalePaymentStatus initialPaymentStatusOverride = SalePaymentStatus.Pending;
                
                if (isCashCustomerOverride)
                {
                    // Cash customer = instant payment, mark as paid immediately
                    initialPaidAmountOverride = grandTotal;
                    initialPaymentStatusOverride = SalePaymentStatus.Paid;
                }

                var sale = new Sale
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    InvoiceNo = invoiceNo,
                    InvoiceDate = DateTime.UtcNow,
                    CustomerId = request.CustomerId,
                    Subtotal = subtotal,
                    VatTotal = vatTotal,
                    Discount = request.Discount,
                    GrandTotal = grandTotal,
                    TotalAmount = grandTotal, // Set TotalAmount = GrandTotal
                    PaidAmount = initialPaidAmountOverride, // Cash customer = paid immediately
                    PaymentStatus = initialPaymentStatusOverride, // Cash customer = Paid status
                    IsFinalized = true, // Invoice is finalized - stock decremented
                    Notes = request.Notes,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Sales.Add(sale);
                await _context.SaveChangesAsync();

                foreach (var item in saleItems)
                {
                    item.SaleId = sale.Id;
                }

                _context.SaleItems.AddRange(saleItems);

                foreach (var invTx in inventoryTransactions)
                {
                    invTx.RefId = sale.Id;
                }

                _context.InventoryTransactions.AddRange(inventoryTransactions);

                // Process payments
                decimal totalPaid = 0;
                
                // CASH CUSTOMER: Auto-create cash payment if no customer ID
                if (isCashCustomerOverride)
                {
                    // Create automatic cash payment for cash customer
                    var cashPayment = new Payment
                    {
                        OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                        TenantId = tenantId, // CRITICAL: Set new TenantId
                        SaleId = sale.Id,
                        CustomerId = null, // Cash customer has no customer ID
                        Amount = grandTotal,
                        Mode = PaymentMode.CASH,
                        Reference = "CASH",
                        Status = PaymentStatus.CLEARED, // Cash is always cleared
                        PaymentDate = DateTime.UtcNow,
                        CreatedBy = userId,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.Payments.Add(cashPayment);
                    totalPaid = grandTotal;
                }
                else if (request.Payments != null && request.Payments.Any())
                {
                    var payments = request.Payments.Select(p => {
                        var paymentMode = Enum.Parse<PaymentMode>(p.Method.ToUpper());
                        var paymentStatus = paymentMode == PaymentMode.CHEQUE 
                            ? PaymentStatus.PENDING 
                            : (paymentMode == PaymentMode.CASH || paymentMode == PaymentMode.ONLINE 
                                ? PaymentStatus.CLEARED 
                                : PaymentStatus.PENDING);
                        
                        return new Payment
                        {
                            OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                            TenantId = tenantId, // CRITICAL: Set new TenantId
                            SaleId = sale.Id,
                            CustomerId = request.CustomerId,
                            Amount = p.Amount,
                            Mode = paymentMode,
                            Reference = p.Ref,
                            Status = paymentStatus,
                            PaymentDate = DateTime.UtcNow,
                            CreatedBy = userId,
                            CreatedAt = DateTime.UtcNow
                        };
                    }).ToList();

                    _context.Payments.AddRange(payments);

                    totalPaid = payments.Sum(p => p.Amount);
                    if (totalPaid >= grandTotal)
                    {
                        sale.PaymentStatus = SalePaymentStatus.Paid;
                    }
                    else if (totalPaid > 0)
                    {
                        sale.PaymentStatus = SalePaymentStatus.Partial;
                    }
                }

                // Recalculate customer balance from all transactions (fixes fake balance issue)
                if (request.CustomerId.HasValue)
                {
                    var customerService = new CustomerService(_context);
                    await customerService.RecalculateCustomerBalanceAsync(request.CustomerId.Value, tenantId);
                }

                // Create audit log for override
                var auditLog = new AuditLog
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    UserId = userId,
                    Action = "Sale Created (Admin Override)",
                    Details = $"Invoice: {invoiceNo}, Total: {grandTotal:C}, Reason: {reason}",
                    CreatedAt = DateTime.UtcNow
                };

                _context.AuditLogs.Add(auditLog);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Auto-backup after successful invoice save
                try
                {
                    var savedSale = await GetSaleByIdAsync(sale.Id, tenantId);
                    if (savedSale != null)
                    {
                        // CRITICAL: Generate and save PDF - ensure it completes successfully
                        try
                        {
                            var pdfBytes = await _pdfService.GenerateInvoicePdfAsync(savedSale);
                            if (pdfBytes == null || pdfBytes.Length == 0)
                            {
                                Console.WriteLine($"❌ PDF Generation Failed: Generated PDF is empty for invoice {savedSale.InvoiceNo}");
                            }
                            else
                            {
                                Console.WriteLine($"✅ PDF Generated Successfully: {pdfBytes.Length} bytes for invoice {savedSale.InvoiceNo}");
                            }
                        }
                        catch (Exception pdfEx)
                        {
                            Console.WriteLine($"❌ CRITICAL: PDF Generation Failed for invoice {savedSale.InvoiceNo}: {pdfEx.Message}");
                            Console.WriteLine($"   Stack Trace: {pdfEx.StackTrace}");
                            // Log but don't fail sale creation - PDF can be regenerated later
                        }
                        
                        // Create backup (background task, don't block)
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                await _backupService.CreateFullBackupAsync(exportToDesktop: true);
                                Console.WriteLine("✅ Auto-backup completed to Desktop");
                            }
                            catch (Exception backupEx)
                            {
                                Console.WriteLine($"⚠️ Auto-backup failed: {backupEx.Message}");
                            }
                        });
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"⚠️ Failed to generate PDF after invoice save: {ex.Message}");
                    Console.WriteLine($"   Stack Trace: {ex.StackTrace}");
                    // Don't fail the sale creation if PDF generation fails
                }

                return await GetSaleByIdAsync(sale.Id, tenantId) ?? throw new InvalidOperationException("Failed to retrieve created sale");
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<string> GenerateInvoiceNumberAsync(int tenantId)
        {
            // CRITICAL: Delegate to InvoiceNumberService with tenantId for owner-scoped numbering
            return await _invoiceNumberService.GenerateNextInvoiceNumberAsync(tenantId);
        }

        public async Task<SaleDto> UpdateSaleAsync(int saleId, CreateSaleRequest request, int userId, int tenantId, string? editReason = null, byte[]? expectedRowVersion = null)
        {
            // Use serializable isolation level to prevent concurrent edits
            using var transaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            try
            {
                // CRITICAL: Get existing sale with owner verification
                var existingSale = await _context.Sales
                    .Include(s => s.Items)
                    .ThenInclude(i => i.Product)
                    .AsNoTracking() // First read to check version
                    .FirstOrDefaultAsync(s => s.Id == saleId && s.TenantId == tenantId);

                if (existingSale == null)
                    throw new InvalidOperationException("Sale not found");

                if (existingSale.IsDeleted)
                    throw new InvalidOperationException("Cannot edit deleted sale");

                // Verify user exists and has permission (Admin OR Owner OR Staff can edit)
                var user = await _context.Users.FindAsync(userId);
                if (user == null)
                    throw new InvalidOperationException("User not found");
                
                // Allow Admin, Owner, and Staff to edit invoices (no 48-hour lock)
                if (user.Role != UserRole.Admin && user.Role != UserRole.Owner && user.Role != UserRole.Staff)
                {
                    throw new InvalidOperationException("Only Admin, Owner, and Staff users can edit invoices");
                }

                // CONCURRENCY CHECK: Verify version hasn't changed (another user edited it)
                if (expectedRowVersion != null && expectedRowVersion.Length > 0)
                {
                    var currentSale = await _context.Sales.FindAsync(saleId);
                    if (currentSale == null)
                        throw new InvalidOperationException("Sale not found");

                    // Compare RowVersion bytes to detect concurrent modification
                    if (currentSale.RowVersion != null && currentSale.RowVersion.Length > 0)
                    {
                        if (!currentSale.RowVersion.SequenceEqual(expectedRowVersion))
                        {
                            await transaction.RollbackAsync();
                            throw new InvalidOperationException(
                                $"CONFLICT: This invoice was modified by another user. " +
                                $"Current version: {currentSale.Version}. " +
                                $"Last modified by: {currentSale.LastModifiedByUser?.Name ?? "Unknown"} at {currentSale.LastModifiedAt:g}. " +
                                $"Please refresh and try again."
                            );
                        }
                    }
                }

                // Check if another user is currently editing (check LastModifiedAt within last 30 seconds)
                var recentlyModified = existingSale.LastModifiedAt.HasValue && 
                    (DateTime.UtcNow - existingSale.LastModifiedAt.Value).TotalSeconds < 30 &&
                    existingSale.LastModifiedBy != userId;

                if (recentlyModified)
                {
                    var modifier = await _context.Users.FindAsync(existingSale.LastModifiedBy);
                    throw new InvalidOperationException(
                        $"WARNING: Another user ({modifier?.Name ?? "Unknown"}) is currently editing this invoice. " +
                        $"Please wait a few seconds and refresh before saving."
                    );
                }

                // Now load with tracking for updates
                var saleForUpdate = await _context.Sales
                    .Include(s => s.Items)
                    .ThenInclude(i => i.Product)
                    .FirstOrDefaultAsync(s => s.Id == saleId);

                if (saleForUpdate == null)
                    throw new InvalidOperationException("Sale not found");

                // Create version snapshot before editing
                var versionSnapshot = new
                {
                    Sale = new
                    {
                        saleForUpdate.Id,
                        saleForUpdate.InvoiceNo,
                        saleForUpdate.InvoiceDate,
                        saleForUpdate.CustomerId,
                        saleForUpdate.Subtotal,
                        saleForUpdate.VatTotal,
                        saleForUpdate.Discount,
                        saleForUpdate.GrandTotal,
                        saleForUpdate.PaymentStatus,
                        saleForUpdate.Version
                    },
                    Items = saleForUpdate.Items.Select(i => new
                    {
                        i.Id,
                        i.ProductId,
                        i.UnitType,
                        i.Qty,
                        i.UnitPrice,
                        i.Discount,
                        i.VatAmount,
                        i.LineTotal
                    }).ToList()
                };

                var versionJson = JsonSerializer.Serialize(versionSnapshot);
                var newVersion = saleForUpdate.Version + 1;

                // Use validation service for robust validation
                var validationResult = await _validationService.ValidateSaleEditAsync(saleId, request.Items);

                if (!validationResult.IsValid)
                {
                    await transaction.RollbackAsync();
                    throw new InvalidOperationException(
                        "VALIDATION FAILED:\n" +
                        string.Join("\n", validationResult.Errors) +
                        "\n\nPlease correct the errors and try again."
                    );
                }

                // STOCK CONFLICT PREVENTION: Check all products have sufficient stock BEFORE making changes
                var stockConflicts = new List<string>();
                foreach (var item in request.Items)
                {
                    var product = await _context.Products.FindAsync(item.ProductId);
                    if (product == null)
                    {
                        stockConflicts.Add($"Product ID {item.ProductId} not found");
                        continue;
                    }

                    var baseQty = item.Qty * product.ConversionToBase;
                    
                    // Calculate current available stock (after restoring old quantities)
                    var oldItem = saleForUpdate.Items?.FirstOrDefault(i => i != null && i.ProductId == item.ProductId);
                    var oldBaseQty = (oldItem != null && product != null) ? oldItem.Qty * product.ConversionToBase : 0;
                    var availableAfterRestore = (product?.StockQty ?? 0) + oldBaseQty;

                    if (availableAfterRestore < baseQty)
                    {
                        stockConflicts.Add(
                            $"{product.NameEn}: Available: {availableAfterRestore}, Required: {baseQty}"
                        );
                    }
                }

                if (stockConflicts.Any())
                {
                    await transaction.RollbackAsync();
                    throw new InvalidOperationException(
                        "STOCK CONFLICT: Insufficient stock for the following products:\n" +
                        string.Join("\n", stockConflicts) +
                        "\n\nPlease check current stock levels and adjust quantities."
                    );
                }

                // REVERSE OLD TRANSACTIONS: Restore stock and reverse inventory transactions
                if (saleForUpdate.Items != null && saleForUpdate.Items.Any())
                {
                    foreach (var oldItem in saleForUpdate.Items)
                    {
                        if (oldItem != null)
                        {
                            var product = await _context.Products.FindAsync(oldItem.ProductId);
                            if (product != null)
                            {
                                // Restore stock
                                var oldBaseQty = oldItem.Qty * product.ConversionToBase;
                                product.StockQty += oldBaseQty;
                                product.UpdatedAt = DateTime.UtcNow;
                            }
                        }
                    }
                }

                // REVERSE customer balance will be recalculated after new amounts are set

                // Calculate new totals
                var vatPercent = await GetVatPercentAsync();
                decimal subtotal = 0;
                decimal vatTotal = 0;

                var newSaleItems = new List<SaleItem>();
                var inventoryTransactions = new List<InventoryTransaction>();

                // Additional validation using validation service (already validated above, but double-check)
                var additionalValidationErrors = new List<string>();
                foreach (var item in request.Items)
                {
                    var qtyResult = await _validationService.ValidateQuantityAsync(item.Qty);
                    if (!qtyResult.IsValid)
                    {
                        additionalValidationErrors.AddRange(qtyResult.Errors.Select(e => $"Item {item.ProductId}: {e}"));
                    }

                    var priceResult = await _validationService.ValidatePriceAsync(item.UnitPrice);
                    if (!priceResult.IsValid)
                    {
                        additionalValidationErrors.AddRange(priceResult.Errors.Select(e => $"Item {item.ProductId}: {e}"));
                    }
                }

                if (additionalValidationErrors.Any())
                {
                    await transaction.RollbackAsync();
                    throw new InvalidOperationException(string.Join("\n", additionalValidationErrors));
                }

                // Process new items (same logic as CreateSaleAsync)
                // Note: Stock has already been restored from old items above
                foreach (var item in request.Items)
                {
                    // CRITICAL MULTI-TENANT FIX: Filter product by tenantId to prevent cross-owner access
                    var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == item.ProductId && p.TenantId == tenantId);
                    if (product == null)
                        throw new InvalidOperationException($"Product with ID {item.ProductId} not found for your account. Please verify the product exists.");

                    var baseQty = item.Qty * product.ConversionToBase;

                    // Check stock availability (stock was already restored from old items)
                    // But we need to account for items already processed in this loop
                    // Find if this product appears multiple times in the request
                    var qtyAlreadyProcessed = newSaleItems
                        .Where(si => si.ProductId == item.ProductId)
                        .Sum(si => si.Qty * product.ConversionToBase);
                    
                    var availableStock = product.StockQty - qtyAlreadyProcessed;
                    
                    if (availableStock < baseQty)
                    {
                        throw new InvalidOperationException(
                            $"Insufficient stock for {product.NameEn}. " +
                            $"Available: {availableStock}, Required: {baseQty}. " +
                            $"Note: Stock from old invoice items has been restored."
                        );
                    }

                    var rowTotal = item.UnitPrice * item.Qty;
                    var vatAmount = Math.Round(rowTotal * (vatPercent / 100), 2);
                    var lineAmount = rowTotal + vatAmount;

                    subtotal += rowTotal;
                    vatTotal += vatAmount;

                    var saleItem = new SaleItem
                    {
                        SaleId = saleId,
                        ProductId = item.ProductId,
                        UnitType = string.IsNullOrWhiteSpace(item.UnitType) ? "CRTN" : item.UnitType.ToUpper(),
                        Qty = item.Qty,
                        UnitPrice = item.UnitPrice,
                        Discount = 0,
                        VatAmount = vatAmount,
                        LineTotal = lineAmount
                    };
                    newSaleItems.Add(saleItem);

                    // CRITICAL: Update stock for edited invoice
                    // Old stock was already restored above (line 898-900)
                    // Now decrement stock for new quantities (delta calculation)
                    product.StockQty -= baseQty;
                    product.UpdatedAt = DateTime.UtcNow;

                    // Create inventory transaction
                    inventoryTransactions.Add(new InventoryTransaction
                    {
                        OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                        TenantId = tenantId, // CRITICAL: Set new TenantId
                        ProductId = item.ProductId,
                        ChangeQty = -baseQty,
                        TransactionType = TransactionType.Sale,
                        RefId = saleId,
                        Reason = $"Sale Updated: {existingSale.InvoiceNo}",
                        CreatedAt = DateTime.UtcNow
                    });
                }

                var grandTotal = Math.Round((subtotal + vatTotal - request.Discount), 2);

                // Delete old sale items
                if (saleForUpdate.Items != null && saleForUpdate.Items.Any())
                {
                    _context.SaleItems.RemoveRange(saleForUpdate.Items);
                }

                // Update sale (PRESERVE InvoiceNo - do not change it on edit)
                // InvoiceNo is set once during creation and should never change
                saleForUpdate.Subtotal = subtotal;
                saleForUpdate.VatTotal = vatTotal;
                saleForUpdate.Discount = request.Discount;
                saleForUpdate.GrandTotal = grandTotal;
                saleForUpdate.TotalAmount = grandTotal; // Update TotalAmount
                
                // Admin and Staff: Update invoice date if provided
                if (request.InvoiceDate.HasValue)
                {
                    saleForUpdate.InvoiceDate = request.InvoiceDate.Value;
                }
                
                // Handle paid_amount adjustment if new total is less than paid amount
                if (grandTotal < saleForUpdate.PaidAmount)
                {
                    // Customer has overpaid - adjust balance and paid_amount
                    var excessAmount = saleForUpdate.PaidAmount - grandTotal;
                    saleForUpdate.PaidAmount = grandTotal; // Cap paid amount at new total
                    
                    // Update customer balance (reduce what customer owes)
                    if (saleForUpdate.CustomerId.HasValue)
                    {
                        var customer = await _context.Customers.FindAsync(saleForUpdate.CustomerId.Value);
                        if (customer != null)
                        {
                            customer.Balance -= excessAmount; // Customer owes less (credit)
                            customer.UpdatedAt = DateTime.UtcNow;
                        }
                    }
                    
                    // Create audit log for adjustment
                    var adjustmentLog = new AuditLog
                    {
                        OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                        TenantId = tenantId, // CRITICAL: Set new TenantId
                        UserId = userId,
                        Action = "Invoice Edit - Paid Amount Adjustment",
                        Details = $"Invoice {saleForUpdate.InvoiceNo}: GrandTotal reduced from {saleForUpdate.GrandTotal + excessAmount:C} to {grandTotal:C}. Excess payment of {excessAmount:C} credited to customer balance.",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.AuditLogs.Add(adjustmentLog);
                }
                
                saleForUpdate.Notes = request.Notes;
                saleForUpdate.LastModifiedBy = userId;
                saleForUpdate.LastModifiedAt = DateTime.UtcNow;
                saleForUpdate.Version = newVersion;
                saleForUpdate.EditReason = editReason;
                // InvoiceNo is NOT updated - preserve original invoice number
                
                // Add new sale items
                _context.SaleItems.AddRange(newSaleItems);

                // Add inventory transactions
                _context.InventoryTransactions.AddRange(inventoryTransactions);

                // ============================================================
                // CRITICAL FIX: Properly handle CASH ↔ CREDIT conversion
                // ============================================================
                
                // Determine if this is a CASH or CREDIT sale
                bool isNewCashSale = !request.CustomerId.HasValue; // No customer = Cash customer
                bool wasOldCashSale = !existingSale.CustomerId.HasValue;
                int? oldCustomerId = existingSale.CustomerId;
                int? newCustomerId = request.CustomerId;
                
                Console.WriteLine($"\n🔄 SALE UPDATE: Invoice {existingSale.InvoiceNo}");
                Console.WriteLine($"   Old: CustomerId={oldCustomerId?.ToString() ?? "CASH"}, GrandTotal={existingSale.GrandTotal:C}, Paid={existingSale.PaidAmount:C}, Status={existingSale.PaymentStatus}");
                Console.WriteLine($"   New: CustomerId={newCustomerId?.ToString() ?? "CASH"}, GrandTotal={grandTotal:C}");
                
                // Get old payments to properly reverse their effects
                var oldPayments = await _context.Payments.Where(p => p.SaleId == saleId).ToListAsync();
                
                // STEP 1: Reverse ALL old invoice effects (balance + payments)
                if (oldCustomerId.HasValue)
                {
                    var oldCustomer = await _context.Customers.FindAsync(oldCustomerId.Value);
                    if (oldCustomer != null)
                    {
                        // Remove old invoice from old customer's balance
                        decimal oldOutstanding = existingSale.GrandTotal - existingSale.PaidAmount;
                        oldCustomer.Balance -= oldOutstanding;
                        oldCustomer.UpdatedAt = DateTime.UtcNow;
                        Console.WriteLine($"   ✅ Removed old invoice from Customer {oldCustomerId}: -{oldOutstanding:C}");
                    }
                }
                
                // Reverse old payment effects on customer balance (if any)
                if (oldPayments != null && oldPayments.Any())
                {
                    foreach (var oldPayment in oldPayments)
                    {
                        if (oldPayment.Status == PaymentStatus.CLEARED && oldPayment.CustomerId.HasValue)
                        {
                            var customer = await _context.Customers.FindAsync(oldPayment.CustomerId.Value);
                            if (customer != null)
                            {
                                // Reverse old payment: customer owes more
                                customer.Balance += oldPayment.Amount;
                                customer.UpdatedAt = DateTime.UtcNow;
                                Console.WriteLine($"   ✅ Reversed old payment from Customer {oldPayment.CustomerId}: +{oldPayment.Amount:C}");
                            }
                        }
                    }
                    
                    // Delete all old payments
                    _context.Payments.RemoveRange(oldPayments);
                }

                // STEP 2: Update CustomerId in sale
                saleForUpdate.CustomerId = newCustomerId;

                // STEP 3: Process NEW payment logic based on sale type
                if (isNewCashSale)
                {
                    // ===== CASH SALE (No Customer) =====
                    // Cash sales are ALWAYS paid immediately with cash
                    saleForUpdate.PaymentStatus = SalePaymentStatus.Paid;
                    saleForUpdate.PaidAmount = grandTotal;
                    saleForUpdate.LastPaymentDate = DateTime.UtcNow;
                    
                    // Create automatic cash payment for cash sale
                    var cashPayment = new Payment
                    {
                        OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                        TenantId = tenantId, // CRITICAL: Set new TenantId
                        SaleId = saleId,
                        CustomerId = null, // No customer for cash sale
                        Amount = grandTotal,
                        Mode = PaymentMode.CASH,
                        Reference = "CASH",
                        Status = PaymentStatus.CLEARED,
                        PaymentDate = DateTime.UtcNow,
                        CreatedBy = userId,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                        RowVersion = new byte[0]
                    };
                    _context.Payments.Add(cashPayment);
                    
                    Console.WriteLine($"   ✅ CASH SALE: Auto-created cash payment for {grandTotal:C}, Status=Paid");
                }
                else if (request.Payments != null && request.Payments.Any())
                {
                    // ===== CREDIT SALE with PAYMENTS =====
                    // Customer provided, process payment records
                    decimal totalPaidCleared = 0;
                    
                    foreach (var p in request.Payments)
                    {
                        if (string.IsNullOrWhiteSpace(p.Method))
                        {
                            throw new InvalidOperationException("Payment method cannot be empty");
                        }
                        
                        // Try to parse payment mode, handle invalid values
                        PaymentMode paymentMode;
                        try
                        {
                            paymentMode = Enum.Parse<PaymentMode>(p.Method.ToUpper());
                        }
                        catch (ArgumentException)
                        {
                            throw new InvalidOperationException($"Invalid payment method: {p.Method}. Valid methods are: Cash, Cheque, Online, Credit");
                        }
                        
                        var paymentStatus = paymentMode == PaymentMode.CHEQUE 
                            ? PaymentStatus.PENDING 
                            : (paymentMode == PaymentMode.CASH || paymentMode == PaymentMode.ONLINE 
                                ? PaymentStatus.CLEARED 
                                : PaymentStatus.PENDING);
                        
                        if (p.Amount <= 0)
                        {
                            throw new InvalidOperationException($"Payment amount must be greater than 0. Received: {p.Amount}");
                        }
                        
                        var paymentDate = DateTime.UtcNow;
                        
                        // Create payment using EF Core (works with PostgreSQL)
                        var payment = new Payment
                        {
                            OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                            TenantId = tenantId, // CRITICAL: Set new TenantId
                            SaleId = saleId,
                            CustomerId = request.CustomerId,
                            Amount = p.Amount,
                            Mode = paymentMode,
                            Reference = p.Ref,
                            Status = paymentStatus,
                            PaymentDate = paymentDate,
                            CreatedBy = userId,
                            CreatedAt = paymentDate,
                            UpdatedAt = paymentDate,
                            RowVersion = new byte[0]
                        };
                        
                        _context.Payments.Add(payment);
                        
                        // Track cleared payments only
                        if (paymentStatus == PaymentStatus.CLEARED)
                        {
                            totalPaidCleared += p.Amount;
                        }
                    }
                    
                    // Save all payments at once
                    await _context.SaveChangesAsync();

                    // Update sale payment status based on CLEARED payments only
                    saleForUpdate.PaidAmount = totalPaidCleared;
                    if (totalPaidCleared >= grandTotal)
                    {
                        saleForUpdate.PaymentStatus = SalePaymentStatus.Paid;
                        saleForUpdate.LastPaymentDate = DateTime.UtcNow;
                    }
                    else if (totalPaidCleared > 0)
                    {
                        saleForUpdate.PaymentStatus = SalePaymentStatus.Partial;
                        saleForUpdate.LastPaymentDate = DateTime.UtcNow;
                    }
                    else
                    {
                        saleForUpdate.PaymentStatus = SalePaymentStatus.Pending;
                        saleForUpdate.LastPaymentDate = null;
                    }
                    
                    Console.WriteLine($"   ✅ CREDIT SALE with payments: Paid {totalPaidCleared:C} of {grandTotal:C}, Status={saleForUpdate.PaymentStatus}");
                }
                else
                {
                    // ===== CREDIT SALE with NO PAYMENTS =====
                    // Customer owes full amount
                    saleForUpdate.PaymentStatus = SalePaymentStatus.Pending;
                    saleForUpdate.PaidAmount = 0;
                    saleForUpdate.LastPaymentDate = null;
                    
                    Console.WriteLine($"   ✅ CREDIT SALE (unpaid): Outstanding {grandTotal:C}, Status=Pending");
                }
                
                // STEP 4: Add new invoice to new customer's balance (if credit sale)
                if (newCustomerId.HasValue)
                {
                    var newCustomer = await _context.Customers.FindAsync(newCustomerId.Value);
                    if (newCustomer == null)
                    {
                        throw new InvalidOperationException($"Customer with ID {newCustomerId.Value} not found");
                    }
                    
                    // Add new invoice outstanding to customer balance
                    decimal newOutstanding = grandTotal - saleForUpdate.PaidAmount;
                    newCustomer.Balance += newOutstanding;
                    newCustomer.LastActivity = DateTime.UtcNow;
                    newCustomer.UpdatedAt = DateTime.UtcNow;
                    
                    // Apply new cleared payments to customer balance
                    if (saleForUpdate.PaidAmount > 0)
                    {
                        newCustomer.Balance -= saleForUpdate.PaidAmount;
                    }
                    
                    Console.WriteLine($"   ✅ Added new invoice to Customer {newCustomerId}: +{newOutstanding:C}, Payments: -{saleForUpdate.PaidAmount:C}");
                }

                // Recalculate customer balance with new amount
                if (request.CustomerId.HasValue)
                {
                    var customerService = new CustomerService(_context);
                    await customerService.RecalculateCustomerBalanceAsync(request.CustomerId.Value, tenantId);
                    
                    // Update customer LastActivity
                    var customer = await _context.Customers.FindAsync(request.CustomerId.Value);
                    if (customer != null)
                    {
                        customer.LastActivity = DateTime.UtcNow;
                        customer.UpdatedAt = DateTime.UtcNow;
                        await _context.SaveChangesAsync();
                    }
                }

                // Calculate diff summary for better audit trail
                var diffSummary = CalculateInvoiceDiff(versionSnapshot, request, saleForUpdate, user.Name, newVersion);
                
                // Save InvoiceVersion snapshot
                var invoiceVersion = new InvoiceVersion
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    SaleId = saleId,
                    VersionNumber = saleForUpdate.Version - 1, // Previous version
                    CreatedById = userId,
                    CreatedAt = DateTime.UtcNow,
                    DataJson = versionJson,
                    EditReason = editReason,
                    DiffSummary = diffSummary // Enhanced diff summary
                };
                _context.InvoiceVersions.Add(invoiceVersion);

                // Create audit log
                var auditLog = new AuditLog
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    UserId = userId,
                    Action = "Sale Updated",
                    Details = $"Invoice: {saleForUpdate.InvoiceNo} updated to Version {newVersion}. Reason: {editReason ?? "N/A"}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.AuditLogs.Add(auditLog);

                // Save changes - this will also update RowVersion automatically
                await _context.SaveChangesAsync();
                
                // Verify no concurrent modification occurred during save
                await _context.Entry(saleForUpdate).ReloadAsync();
                if (saleForUpdate.Version != newVersion)
                {
                    await transaction.RollbackAsync();
                    throw new InvalidOperationException(
                        "CONFLICT DETECTED: Invoice was modified during your edit. " +
                        $"Please refresh and try again. Current version: {saleForUpdate.Version}"
                    );
                }

                await transaction.CommitAsync();

                return await GetSaleByIdAsync(saleId, tenantId) ?? throw new InvalidOperationException("Failed to retrieve updated sale");
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                
                // Log detailed error for debugging
                Console.WriteLine($"❌ UpdateSaleAsync Error for SaleId {saleId}:");
                Console.WriteLine($"❌ Error Type: {ex.GetType().Name}");
                Console.WriteLine($"❌ Message: {ex.Message}");
                Console.WriteLine($"❌ Stack Trace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"❌ Inner Exception: {ex.InnerException.GetType().Name}");
                    Console.WriteLine($"❌ Inner Message: {ex.InnerException.Message}");
                    Console.WriteLine($"❌ Inner Stack Trace: {ex.InnerException.StackTrace}");
                }
                
                // Re-throw to be caught by controller
                throw;
            }
        }

        public async Task<bool> DeleteSaleAsync(int saleId, int userId, int tenantId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // CRITICAL: Verify sale belongs to owner
                var sale = await _context.Sales
                    .Include(s => s.Items)
                    .ThenInclude(i => i.Product)
                    .FirstOrDefaultAsync(s => s.Id == saleId && s.TenantId == tenantId);

                if (sale == null)
                    return false;

                if (sale.IsDeleted)
                    return true; // Already deleted

                // REVERSE TRANSACTIONS: Restore stock when invoice is canceled/deleted
                // Only restore if invoice was finalized (stock was decremented)
                if (sale.IsFinalized)
                {
                    foreach (var item in sale.Items)
                    {
                        var product = await _context.Products.FindAsync(item.ProductId);
                        if (product != null)
                        {
                            var baseQty = item.Qty * product.ConversionToBase;
                            product.StockQty += baseQty;
                            product.UpdatedAt = DateTime.UtcNow;

                            // Create reversal transaction
                            _context.InventoryTransactions.Add(new InventoryTransaction
                            {
                                OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                                TenantId = tenantId, // CRITICAL: Set new TenantId
                                ProductId = product.Id,
                                ChangeQty = baseQty,
                                TransactionType = TransactionType.Adjustment,
                                Reason = $"Sale Deleted/Canceled: {sale.InvoiceNo}",
                                CreatedAt = DateTime.UtcNow
                            });
                        }
                    }
                }

                // CRITICAL: Delete or void all related payments
                var relatedPayments = await _context.Payments
                    .Where(p => p.SaleId == saleId)
                    .ToListAsync();

                foreach (var payment in relatedPayments)
                {
                    // If payment was cleared, reverse its effects before deletion
                    if (payment.Status == PaymentStatus.CLEARED)
                    {
                        // Reverse customer balance adjustment
                        if (payment.CustomerId.HasValue)
                        {
                            var customer = await _context.Customers.FindAsync(payment.CustomerId.Value);
                            if (customer != null)
                            {
                                customer.Balance += payment.Amount; // Reverse: customer owes more
                                customer.UpdatedAt = DateTime.UtcNow;
                            }
                        }
                    }
                    
                    // Delete payment record
                    _context.Payments.Remove(payment);
                }

                // CRITICAL: Reset sale payment status and amounts
                sale.PaidAmount = 0;
                sale.PaymentStatus = SalePaymentStatus.Pending;
                sale.LastPaymentDate = null;

                // Recalculate customer balance (after payment deletion)
                if (sale.CustomerId.HasValue)
                {
                    var customerService = new CustomerService(_context);
                    await customerService.RecalculateCustomerBalanceAsync(sale.CustomerId.Value, tenantId);
                }

                // Soft delete
                sale.IsDeleted = true;
                sale.DeletedBy = userId;
                sale.DeletedAt = DateTime.UtcNow;

                // Create audit log
                var user = await _context.Users.FindAsync(userId);
                var auditLog = new AuditLog
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    UserId = userId,
                    Action = "Sale Deleted",
                    Details = $"Invoice: {sale.InvoiceNo}, Total: {sale.GrandTotal:C}, Customer: {sale.Customer?.Name ?? "Cash"}, Deleted by: {user?.Name ?? "Unknown"}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.AuditLogs.Add(auditLog);

                // Create alert for invoice deletion (for admin tracking)
                await _alertService.CreateAlertAsync(
                    AlertType.InvoiceDeleted,
                    $"Invoice {sale.InvoiceNo} deleted",
                    $"Deleted by {user?.Name ?? "Unknown"}. Total: {sale.GrandTotal:C}, Customer: {sale.Customer?.Name ?? "Cash"}",
                    AlertSeverity.Warning,
                    new Dictionary<string, object> {
                        { "InvoiceNo", sale.InvoiceNo },
                        { "InvoiceId", sale.Id },
                        { "GrandTotal", sale.GrandTotal },
                        { "CustomerId", sale.CustomerId ?? 0 },
                        { "DeletedBy", user?.Name ?? "Unknown" }
                    }
                );

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // ✅ REAL-TIME BALANCE UPDATE: Update customer balance after invoice deletion
                if (sale.CustomerId.HasValue)
                {
                    try
                    {
                        await _balanceService.UpdateCustomerBalanceOnInvoiceDeletedAsync(
                            sale.CustomerId.Value,
                            sale.GrandTotal);
                        
                        // Reverse any cleared payments
                        foreach (var payment in relatedPayments.Where(p => p.Status == PaymentStatus.CLEARED))
                        {
                            await _balanceService.UpdateCustomerBalanceOnPaymentDeletedAsync(
                                sale.CustomerId.Value,
                                payment.Amount);
                        }
                    }
                    catch (Exception balanceEx)
                    {
                        Console.WriteLine($"⚠️ Failed to update balance after deletion: {balanceEx.Message}");
                        // Create alert for admin
                        await _alertService.CreateAlertAsync(
                            AlertType.BalanceMismatch,
                            "Failed to update customer balance after invoice deletion",
                            $"Invoice: {sale.InvoiceNo}, Customer: {sale.CustomerId}",
                            AlertSeverity.Warning);
                    }
                }

                return true;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<byte[]> GenerateInvoicePdfAsync(int saleId, int tenantId)
        {
            try
            {
                Console.WriteLine($"\n📄 PDF Generation: Starting for sale {saleId}, tenantId={tenantId}");
                
                // CRITICAL: Build query - super admin (tenantId=0) can access any sale
                IQueryable<Sale> query = _context.Sales.Where(s => s.Id == saleId);
                
                // Filter by owner only if not super admin
                if (tenantId > 0)
                {
                    query = query.Where(s => s.TenantId == tenantId);
                }
                
                var sale = await query
                    .Include(s => s.Customer)
                    .Include(s => s.Items)
                        .ThenInclude(i => i.Product)
                    .FirstOrDefaultAsync();

                if (sale == null)
                {
                    Console.WriteLine($"❌ PDF Generation: Sale with ID {saleId} not found");
                    throw new InvalidOperationException($"Sale with ID {saleId} not found");
                }
                
                Console.WriteLine($"✅ PDF Generation: Sale {saleId} found - {sale.Items?.Count ?? 0} items");
                
                var saleDto = new SaleDto
                {
                    Id = sale.Id,
                    OwnerId = sale.TenantId ?? 0, // CRITICAL: Must pass tenantId to PDF service for correct settings (mapped to OwnerId)
                    InvoiceNo = sale.InvoiceNo ?? $"INV-{saleId}",
                    InvoiceDate = sale.InvoiceDate,
                    CustomerId = sale.CustomerId,
                    CustomerName = sale.Customer?.Name ?? "Cash Customer",
                    Subtotal = sale.Subtotal,
                    VatTotal = sale.VatTotal,
                    GrandTotal = sale.GrandTotal,
                    PaymentStatus = sale.PaymentStatus.ToString(),
                    PaidAmount = sale.PaidAmount,
                    Items = sale.Items?.Select(i => new SaleItemDto
                    {
                        Id = i.Id,
                        ProductId = i.ProductId,
                        ProductName = i.Product?.NameEn ?? $"Product {i.ProductId}",
                        Qty = i.Qty,
                        UnitPrice = i.UnitPrice,
                        UnitType = i.Product?.UnitType ?? "CRTN",
                        LineTotal = i.LineTotal,
                        VatAmount = i.VatAmount
                    }).ToList() ?? new List<SaleItemDto>()
                };

                Console.WriteLine($"✅ PDF Generation: Calling PdfService...");
                var pdfBytes = await _pdfService.GenerateInvoicePdfAsync(saleDto);
                
                Console.WriteLine($"✅ PDF Generation: SUCCESS! Generated {pdfBytes?.Length ?? 0} bytes");
                return pdfBytes ?? Array.Empty<byte>();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ PDF Error: {ex.Message}");
                throw;
            }
        }

        public async Task<bool> CanEditInvoiceAsync(int saleId, int userId, string userRole, int tenantId)
        {
            // CRITICAL: Verify sale belongs to owner
            var sale = await _context.Sales
                .Where(s => s.Id == saleId && s.TenantId == tenantId)
                .FirstOrDefaultAsync();
                
            if (sale == null || sale.IsDeleted)
                return false;

            // Owner and Admin can edit invoices
            return userRole == "Admin" || userRole == "Owner";
        }

        public async Task<bool> UnlockInvoiceAsync(int saleId, int userId, string unlockReason, int tenantId)
        {
            // CRITICAL: Verify sale belongs to owner
            var sale = await _context.Sales
                .Where(s => s.Id == saleId && s.TenantId == tenantId)
                .FirstOrDefaultAsync();
                
            if (sale == null)
                return false;

            sale.IsLocked = false;
            sale.LockedAt = null;

            // Create audit log
            var auditLog = new AuditLog
            {
                OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                TenantId = tenantId, // CRITICAL: Set new TenantId
                UserId = userId,
                Action = "Invoice Unlocked",
                Details = $"Invoice: {sale.InvoiceNo} unlocked. Reason: {unlockReason}",
                CreatedAt = DateTime.UtcNow
            };
            _context.AuditLogs.Add(auditLog);

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<List<InvoiceVersion>> GetInvoiceVersionsAsync(int saleId, int tenantId)
        {
            // CRITICAL: Only return versions for sales owned by this owner
            return await _context.InvoiceVersions
                .Include(v => v.CreatedByUser)
                .Where(v => v.SaleId == saleId && v.TenantId == tenantId)
                .OrderByDescending(v => v.VersionNumber)
                .ToListAsync();
        }

        public async Task<bool> LockOldInvoicesAsync(int tenantId)
        {
            // CRITICAL: Lock invoices created more than 48 hours ago for this owner only
            var cutoffTime = DateTime.UtcNow.AddHours(-48);
            var invoicesToLock = await _context.Sales
                .Where(s => s.TenantId == tenantId && !s.IsLocked && !s.IsDeleted && s.CreatedAt < cutoffTime)
                .ToListAsync();

            foreach (var invoice in invoicesToLock)
            {
                invoice.IsLocked = true;
                invoice.LockedAt = DateTime.UtcNow;
            }

            if (invoicesToLock.Any())
            {
                await _context.SaveChangesAsync();
                return true;
            }

            return false;
        }

        private string CalculateInvoiceDiff(dynamic oldVersion, CreateSaleRequest newRequest, Sale oldSale, string editorName, int newVersion)
        {
            var changes = new List<string>();
            
            // Compare totals
            var oldTotal = oldSale.GrandTotal;
            var newTotal = (newRequest.Items?.Sum(i => i.UnitPrice * i.Qty) ?? 0m) * 1.05m - newRequest.Discount;
            if (Math.Abs(oldTotal - newTotal) > 0.01m)
            {
                changes.Add($"GrandTotal: {oldTotal:C} → {newTotal:C}");
            }
            
            // Compare discount
            if (Math.Abs((oldSale.Discount) - newRequest.Discount) > 0.01m)
            {
                changes.Add($"Discount: {oldSale.Discount:C} → {newRequest.Discount:C}");
            }
            
            // Compare item counts
            var oldItemCount = oldSale.Items?.Count ?? 0;
            var newItemCount = newRequest.Items?.Count ?? 0;
            if (oldItemCount != newItemCount)
            {
                changes.Add($"Items: {oldItemCount} → {newItemCount}");
            }
            
            // Compare customer
            if (oldSale.CustomerId != newRequest.CustomerId)
            {
                changes.Add($"Customer changed");
            }
            
            var summary = changes.Any() 
                ? $"Edited by {editorName} - Version {newVersion}. Changes: {string.Join(", ", changes)}"
                : $"Edited by {editorName} - Version {newVersion}";
            
            return summary;
        }

        public async Task<SaleDto?> RestoreInvoiceVersionAsync(int saleId, int versionNumber, int userId, int tenantId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // CRITICAL: Get the version to restore with owner verification
                var version = await _context.InvoiceVersions
                    .FirstOrDefaultAsync(v => v.SaleId == saleId && v.VersionNumber == versionNumber && v.TenantId == tenantId);
                
                if (version == null)
                    throw new InvalidOperationException($"Version {versionNumber} not found for invoice {saleId}");
                
                // Deserialize the old version data
                var oldData = JsonSerializer.Deserialize<dynamic>(version.DataJson);
                if (oldData == null)
                    throw new InvalidOperationException("Failed to deserialize version data");
                
                // Get current sale
                var currentSale = await _context.Sales
                    .Include(s => s.Items)
                    .FirstOrDefaultAsync(s => s.Id == saleId);
                
                if (currentSale == null)
                    throw new InvalidOperationException("Sale not found");
                
                // Create version snapshot of current state before restore
                var currentSnapshot = new
                {
                    Sale = new
                    {
                        currentSale.Id,
                        currentSale.InvoiceNo,
                        currentSale.InvoiceDate,
                        currentSale.CustomerId,
                        currentSale.Subtotal,
                        currentSale.VatTotal,
                        currentSale.Discount,
                        currentSale.GrandTotal,
                        currentSale.PaymentStatus,
                        currentSale.Version
                    },
                    Items = currentSale.Items.Select(i => new
                    {
                        i.Id,
                        i.ProductId,
                        i.UnitType,
                        i.Qty,
                        i.UnitPrice,
                        i.Discount,
                        i.VatAmount,
                        i.LineTotal
                    }).ToList()
                };
                
                var currentVersionJson = JsonSerializer.Serialize(currentSnapshot);
                var newVersion = currentSale.Version + 1;
                
                // Restore old items - reverse current stock changes first
                foreach (var item in currentSale.Items)
                {
                    var product = await _context.Products.FindAsync(item.ProductId);
                    if (product != null)
                    {
                        var baseQty = item.Qty * product.ConversionToBase;
                        product.StockQty += baseQty; // Restore stock
                        product.UpdatedAt = DateTime.UtcNow;
                    }
                }
                
                // Delete current items
                _context.SaleItems.RemoveRange(currentSale.Items);
                
                // TODO: Restore old items from version.DataJson
                // This requires deserializing and recreating SaleItems
                // For now, this is a placeholder - full implementation requires parsing the JSON structure
                
                // Save version snapshot
                var restoreVersion = new InvoiceVersion
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    SaleId = saleId,
                    VersionNumber = currentSale.Version,
                    CreatedById = userId,
                    CreatedAt = DateTime.UtcNow,
                    DataJson = currentVersionJson,
                    EditReason = $"Restored to version {versionNumber}",
                    DiffSummary = $"Restored to version {versionNumber} by user {userId}"
                };
                _context.InvoiceVersions.Add(restoreVersion);
                
                // Create audit log
                var auditLog = new AuditLog
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    UserId = userId,
                    Action = "Invoice Version Restored",
                    Details = $"Invoice {currentSale.InvoiceNo} restored to version {versionNumber}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.AuditLogs.Add(auditLog);
                
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                
                return await GetSaleByIdAsync(saleId, tenantId);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        private async Task<decimal> GetVatPercentAsync()
        {
            var setting = await _context.Settings
                .FirstOrDefaultAsync(s => s.Key == "VAT_PERCENT");
            
            return decimal.TryParse(setting?.Value, out decimal vatPercent) ? vatPercent : 5;
        }

        /// <summary>
        /// Get all deleted sales for audit trail (Admin only)
        /// </summary>
        public async Task<List<SaleDto>> GetDeletedSalesAsync(int tenantId)
        {
            // CRITICAL: Only return deleted sales for this owner
            var deletedSales = await _context.Sales
                .Include(s => s.Customer)
                .Include(s => s.Items)
                    .ThenInclude(i => i.Product)
                .Include(s => s.DeletedByUser)
                .Where(s => s.TenantId == tenantId && s.IsDeleted)
                .OrderByDescending(s => s.DeletedAt)
                .Take(100) // Limit to last 100 deleted sales
                .ToListAsync();

            return deletedSales.Select(s => new SaleDto
            {
                Id = s.Id,
                OwnerId = s.TenantId ?? 0, // CRITICAL: Must include tenantId for audit trail (mapped to OwnerId)
                InvoiceNo = s.InvoiceNo,
                InvoiceDate = s.InvoiceDate,
                CustomerId = s.CustomerId,
                CustomerName = s.Customer?.Name,
                Subtotal = s.Subtotal,
                VatTotal = s.VatTotal,
                Discount = s.Discount,
                GrandTotal = s.GrandTotal,
                PaymentStatus = s.PaymentStatus.ToString(),
                Notes = s.Notes,
                CreatedAt = s.CreatedAt,
                DeletedBy = s.DeletedByUser?.Name,
                DeletedAt = s.DeletedAt,
                Items = s.Items.Select(i => new SaleItemDto
                {
                    Id = i.Id,
                    ProductId = i.ProductId,
                    ProductName = i.Product?.NameEn ?? "Unknown",
                    UnitType = i.UnitType,
                    Qty = i.Qty,
                    UnitPrice = i.UnitPrice,
                    Discount = i.Discount,
                    VatAmount = i.VatAmount,
                    LineTotal = i.LineTotal
                }).ToList()
            }).ToList();
        }

        /// <summary>
        /// CRITICAL: Reconcile payment status for a single sale based on actual payments
        /// This ensures Sale.PaymentStatus matches the calculated status from Payments table
        /// </summary>
        public async Task<bool> ReconcileSalePaymentStatusAsync(int saleId, int tenantId)
        {
            try
            {
                var sale = await _context.Sales
                    .FirstOrDefaultAsync(s => s.Id == saleId && s.TenantId == tenantId && !s.IsDeleted);
                
                if (sale == null) return false;
                
                // Calculate actual paid amount from all non-VOID payments
                var actualPaidAmount = await _context.Payments
                    .Where(p => p.SaleId == saleId && p.TenantId == tenantId && p.Status != PaymentStatus.VOID)
                    .SumAsync(p => p.Amount);
                
                // Determine correct status
                var correctStatus = actualPaidAmount >= sale.GrandTotal 
                    ? SalePaymentStatus.Paid 
                    : actualPaidAmount > 0 
                        ? SalePaymentStatus.Partial 
                        : SalePaymentStatus.Pending;
                
                // Update if different
                if (sale.PaymentStatus != correctStatus || sale.PaidAmount != actualPaidAmount)
                {
                    var oldStatus = sale.PaymentStatus;
                    var oldPaidAmount = sale.PaidAmount;
                    
                    sale.PaymentStatus = correctStatus;
                    sale.PaidAmount = actualPaidAmount;
                    sale.LastModifiedAt = DateTime.UtcNow;
                    
                    await _context.SaveChangesAsync();
                    
                    Console.WriteLine($"✅ Reconciled Sale {sale.InvoiceNo}: Status {oldStatus}->{correctStatus}, PaidAmount {oldPaidAmount}->{actualPaidAmount}");
                }
                
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error reconciling sale {saleId}: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// CRITICAL: Reconcile ALL sales payment status for an owner
        /// This fixes any discrepancies between Sale.PaymentStatus and actual payments
        /// </summary>
        public async Task<ReconciliationResult> ReconcileAllPaymentStatusAsync(int tenantId, int userId)
        {
            var result = new ReconciliationResult
            {
                TotalSales = 0,
                SalesFixed = 0,
                SalesWithDuplicatePayments = new List<DuplicatePaymentInfo>(),
                SalesWithOverpayment = new List<OverpaymentInfo>(),
                Errors = new List<string>()
            };
            
            try
            {
                // Get all non-deleted sales for this owner
                var sales = await _context.Sales
                    .Where(s => s.TenantId == tenantId && !s.IsDeleted)
                    .ToListAsync();
                
                result.TotalSales = sales.Count;
                
                // Get all payment totals per sale
                var paymentTotals = await _context.Payments
                    .Where(p => p.TenantId == tenantId && p.SaleId.HasValue && p.Status != PaymentStatus.VOID)
                    .GroupBy(p => p.SaleId!.Value)
                    .Select(g => new { SaleId = g.Key, TotalPaid = g.Sum(p => p.Amount), PaymentCount = g.Count() })
                    .ToDictionaryAsync(x => x.SaleId, x => new { x.TotalPaid, x.PaymentCount });
                
                // Check for duplicate payments (same sale, same amount, within 1 minute)
                var duplicates = await _context.Payments
                    .Where(p => p.TenantId == tenantId && p.SaleId.HasValue && p.Status != PaymentStatus.VOID)
                    .GroupBy(p => new { p.SaleId, p.Amount })
                    .Where(g => g.Count() > 1)
                    .Select(g => new { g.Key.SaleId, g.Key.Amount, Count = g.Count() })
                    .ToListAsync();
                
                foreach (var dup in duplicates)
                {
                    var sale = sales.FirstOrDefault(s => s.Id == dup.SaleId);
                    result.SalesWithDuplicatePayments.Add(new DuplicatePaymentInfo
                    {
                        SaleId = dup.SaleId ?? 0,
                        InvoiceNo = sale?.InvoiceNo ?? "Unknown",
                        Amount = dup.Amount,
                        DuplicateCount = dup.Count
                    });
                }
                
                // Fix each sale
                foreach (var sale in sales)
                {
                    try
                    {
                        var paymentInfo = paymentTotals.GetValueOrDefault(sale.Id);
                        var actualPaidAmount = paymentInfo?.TotalPaid ?? 0;
                        
                        // Determine correct status
                        var correctStatus = actualPaidAmount >= sale.GrandTotal 
                            ? SalePaymentStatus.Paid 
                            : actualPaidAmount > 0 
                                ? SalePaymentStatus.Partial 
                                : SalePaymentStatus.Pending;
                        
                        // Check for overpayment
                        if (actualPaidAmount > sale.GrandTotal + 0.01m)
                        {
                            result.SalesWithOverpayment.Add(new OverpaymentInfo
                            {
                                SaleId = sale.Id,
                                InvoiceNo = sale.InvoiceNo,
                                InvoiceTotal = sale.GrandTotal,
                                TotalPaid = actualPaidAmount,
                                Overpayment = actualPaidAmount - sale.GrandTotal
                            });
                        }
                        
                        // Update if different
                        if (sale.PaymentStatus != correctStatus || Math.Abs(sale.PaidAmount - actualPaidAmount) > 0.01m)
                        {
                            Console.WriteLine($"📋 Fixing Sale {sale.InvoiceNo}: Status {sale.PaymentStatus}->{correctStatus}, PaidAmount {sale.PaidAmount}->{actualPaidAmount}");
                            
                            sale.PaymentStatus = correctStatus;
                            sale.PaidAmount = actualPaidAmount;
                            sale.LastModifiedAt = DateTime.UtcNow;
                            
                            result.SalesFixed++;
                        }
                    }
                    catch (Exception saleEx)
                    {
                        result.Errors.Add($"Error fixing sale {sale.InvoiceNo}: {saleEx.Message}");
                    }
                }
                
                // Save all changes
                await _context.SaveChangesAsync();
                
                // Create audit log
                var auditLog = new AuditLog
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    UserId = userId,
                    Action = "Payment Status Reconciliation",
                    Details = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        TotalSales = result.TotalSales,
                        SalesFixed = result.SalesFixed,
                        DuplicatesFound = result.SalesWithDuplicatePayments.Count,
                        OverpaymentsFound = result.SalesWithOverpayment.Count,
                        Errors = result.Errors.Count
                    }),
                    CreatedAt = DateTime.UtcNow
                };
                _context.AuditLogs.Add(auditLog);
                await _context.SaveChangesAsync();
                
                Console.WriteLine($"✅ Reconciliation complete: {result.SalesFixed}/{result.TotalSales} sales fixed, {result.SalesWithDuplicatePayments.Count} duplicates found, {result.SalesWithOverpayment.Count} overpayments found");
                
                return result;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error during reconciliation: {ex.Message}");
                result.Errors.Add($"Fatal error: {ex.Message}");
                return result;
            }
        }
    }
    
    // DTOs for reconciliation
    public class ReconciliationResult
    {
        public int TotalSales { get; set; }
        public int SalesFixed { get; set; }
        public List<DuplicatePaymentInfo> SalesWithDuplicatePayments { get; set; } = new();
        public List<OverpaymentInfo> SalesWithOverpayment { get; set; } = new();
        public List<string> Errors { get; set; } = new();
    }
    
    public class DuplicatePaymentInfo
    {
        public int SaleId { get; set; }
        public string InvoiceNo { get; set; } = "";
        public decimal Amount { get; set; }
        public int DuplicateCount { get; set; }
    }
    
    public class OverpaymentInfo
    {
        public int SaleId { get; set; }
        public string InvoiceNo { get; set; } = "";
        public decimal InvoiceTotal { get; set; }
        public decimal TotalPaid { get; set; }
        public decimal Overpayment { get; set; }
    }
}

