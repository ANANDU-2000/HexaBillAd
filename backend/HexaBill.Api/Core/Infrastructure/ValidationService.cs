using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Core.Infrastructure
{
    public interface IValidationService
    {
        Task<ValidationResult> ValidatePaymentAmountAsync(int? saleId, int? customerId, decimal amount, int tenantId);
        Task<ValidationResult> ValidateStockAvailabilityAsync(int productId, decimal quantity, int? excludeSaleId = null, int? tenantId = null, string? unitType = null);
        Task<ValidationResult> ValidateSaleStockLinesAsync(IReadOnlyList<SaleItemRequest> lines, int? excludeSaleId = null, int? tenantId = null);
        Task<ValidationResult> ValidateCustomerBalanceAsync(int customerId, decimal? expectedBalance = null);
        Task<ValidationResult> ValidateSaleEditAsync(int saleId, List<SaleItemRequest> newItems, int? tenantId = null);
        Task<ValidationResult> ValidateQuantityAsync(decimal quantity);
        Task<ValidationResult> ValidatePriceAsync(decimal price);
        Task<ValidationResult> ValidateInvoiceNumberAsync(string invoiceNo, int? excludeSaleId = null);
        Task<ValidationResult> ValidateCashCustomerSaleAsync(int? customerId, decimal totalAmount);
        Task<ValidationResult> ValidateCustomerTypeChangeAsync(int customerId, string newCustomerType);
    }

    public class ValidationResult
    {
        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();
        public List<string> Warnings { get; set; } = new();

        public static ValidationResult Success() => new() { IsValid = true };
        public static ValidationResult Failure(string error) => new() { IsValid = false, Errors = new() { error } };
        public static ValidationResult Failure(List<string> errors) => new() { IsValid = false, Errors = errors };
    }

    public class ValidationService : IValidationService
    {
        private readonly AppDbContext _context;

        public ValidationService(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Validates that payment amount doesn't exceed outstanding amount
        /// </summary>
        public async Task<ValidationResult> ValidatePaymentAmountAsync(int? saleId, int? customerId, decimal amount, int tenantId)
        {
            var errors = new List<string>();

            // Validate amount is positive
            if (amount <= 0)
            {
                errors.Add("Payment amount must be greater than zero.");
            }

            if (amount > 10000000) // 10 million limit
            {
                errors.Add("Payment amount exceeds maximum limit of 10,000,000.");
            }

            // If payment is for a specific invoice
            if (saleId.HasValue)
            {
                var sale = await _context.Sales
                    .FirstOrDefaultAsync(s => s.Id == saleId.Value && s.TenantId == tenantId && !s.IsDeleted);

                if (sale == null)
                {
                    errors.Add($"Invoice with ID {saleId.Value} not found or has been deleted.");
                }
                else
                {
                    // CRITICAL FIX: Calculate ACTUAL paid amount from Payments table (not stale Sale.PaidAmount)
                    // This ensures we use real-time payment data instead of potentially stale cached values
                    var actualPaidAmount = await _context.Payments
                        .Where(p => p.SaleId == saleId.Value && p.TenantId == tenantId && p.Status != PaymentStatus.VOID)
                        .SumAsync(p => p.Amount);
                    
                    var outstanding = sale.GrandTotal - actualPaidAmount;

                    if (outstanding <= 0)
                    {
                        errors.Add("Invoice is already fully paid. No payment needed.");
                    }
                    else if (amount > outstanding + 0.01m) // Allow small rounding tolerance
                    {
                        errors.Add($"Payment amount ({amount:F2} AED) exceeds outstanding amount ({outstanding:F2} AED). Maximum allowed: {outstanding:F2} AED");
                    }

                    // Validate customer matches
                    // FIXED: Handle case where sale.CustomerId could be null (cash sales)
                    // or where customer exists but has different ID
                    if (customerId.HasValue && sale.CustomerId.HasValue && sale.CustomerId.Value != customerId.Value)
                    {
                        errors.Add($"Customer ID {customerId.Value} does not match the invoice's customer (ID: {sale.CustomerId.Value}).");
                    }
                    // If invoice has a customer but payment is being made without selecting that customer
                    else if (sale.CustomerId.HasValue && !customerId.HasValue)
                    {
                        // This is allowed - system will use the invoice's customer
                        // No error
                    }
                }
            }

            // If payment is for a customer (not linked to invoice)
            if (customerId.HasValue && !saleId.HasValue)
            {
                var customer = await _context.Customers
                    .FirstOrDefaultAsync(c => c.Id == customerId.Value && c.TenantId == tenantId);
                if (customer == null)
                {
                    errors.Add($"Customer with ID {customerId.Value} not found.");
                }
                else
                {
                    // Check if customer has any outstanding invoices
                    var totalOutstanding = await _context.Sales
                        .Where(s => s.TenantId == tenantId && s.CustomerId == customerId.Value && !s.IsDeleted)
                        .SumAsync(s => s.GrandTotal - s.PaidAmount);

                    if (totalOutstanding <= 0)
                    {
                        errors.Add("Customer has no outstanding invoices. Payment cannot be processed without an invoice reference.");
                    }
                }
            }

            if (errors.Any())
            {
                return ValidationResult.Failure(errors);
            }

            return ValidationResult.Success();
        }

        /// <summary>
        /// Validates stock availability for a product
        /// </summary>
        public Task<ValidationResult> ValidateStockAvailabilityAsync(int productId, decimal quantity, int? excludeSaleId = null, int? tenantId = null, string? unitType = null)
        {
            return ValidateStockLinesAsync([new SaleItemRequest { ProductId = productId, Qty = quantity, UnitType = unitType ?? "CRTN" }], excludeSaleId, tenantId);
        }

        public Task<ValidationResult> ValidateSaleStockLinesAsync(IReadOnlyList<SaleItemRequest> lines, int? excludeSaleId = null, int? tenantId = null) =>
            ValidateStockLinesAsync(lines.ToList(), excludeSaleId, tenantId);

        private async Task<ValidationResult> ValidateStockLinesAsync(List<SaleItemRequest> lines, int? excludeSaleId, int? tenantId)
        {
            var scope = _context.RequestScopeEstablished && !_context.RequestIsPlatformScope ? _context.RequestTenantId : tenantId;
            if (!scope.HasValue || scope <= 0 || (tenantId.HasValue && tenantId != scope))
                return ValidationResult.Failure("A verified workspace is required for stock validation.");
            if (lines.Count == 0 || lines.Any(i => i.ProductId <= 0 || i.Qty <= 0 || i.Qty > 100000))
                return ValidationResult.Failure("Select valid products with quantities greater than zero and no more than 100,000 per line.");

            var ids = lines.Select(i => i.ProductId).Distinct().ToList();
            var products = await _context.Products.AsNoTracking()
                .Where(p => ids.Contains(p.Id) && p.TenantId == scope.Value).ToDictionaryAsync(p => p.Id);
            if (products.Count != ids.Count)
                return ValidationResult.Failure("One or more products are unavailable in this workspace.");

            Sale? excluded = null;
            if (excludeSaleId.HasValue)
            {
                excluded = await _context.Sales.AsNoTracking().Include(s => s.Items)
                    .FirstOrDefaultAsync(s => s.Id == excludeSaleId.Value && s.TenantId == scope.Value && !s.IsDeleted);
                if (excluded == null) return ValidationResult.Failure("The original invoice is unavailable in this workspace.");
            }
            var errors = new List<string>();
            var warnings = new List<string>();
            foreach (var group in lines.GroupBy(i => i.ProductId))
            {
                var product = products[group.Key];
                try
                {
                    decimal required = 0;
                    foreach (var request in group)
                    {
                        var basis = new SaleItem { ProductId = product.Id, Product = product,
                            UnitType = string.IsNullOrWhiteSpace(request.UnitType) ? "CRTN" : request.UnitType.ToUpperInvariant() };
                        SaleCostBasis.Capture(basis, product, scope.Value, enabled: false, previous: excluded?.Items);
                        required += SaleCostBasis.BaseQuantity(basis, request.Qty);
                    }
                    var available = product.StockQty;
                    if (excluded?.IsFinalized == true)
                    {
                        foreach (var old in excluded.Items.Where(i => i.ProductId == product.Id))
                        {
                            old.Product = product;
                            available += SaleCostBasis.BaseQuantity(old, old.Qty);
                        }
                    }
                    if (available < required)
                        errors.Add($"Insufficient stock for '{product.NameEn}'. Available: {available:N2} stock units; required: {required:N2} stock units.");
                    else if (available > 0 && available < required * 1.2m)
                        warnings.Add($"Low stock for '{product.NameEn}' after the selected quantities.");
                }
                catch (InvalidOperationException ex)
                {
                    errors.Add(ex.Message);
                }
            }
            var result = errors.Count > 0 ? ValidationResult.Failure(errors) : ValidationResult.Success();
            result.Warnings = warnings;
            return result;
        }
        public async Task<ValidationResult> ValidateCustomerBalanceAsync(int customerId, decimal? expectedBalance = null)
        {
            var errors = new List<string>();
            var warnings = new List<string>();

            var customer = await _context.Customers.FindAsync(customerId);
            if (customer == null)
            {
                errors.Add($"Customer with ID {customerId} not found.");
                return ValidationResult.Failure(errors);
            }

            // Recalculate actual balance (same formula as CustomerService/BalanceService: Sales - Payments - Returns + RefundsPaid)
            var totalSales = await _context.Sales
                .Where(s => s.CustomerId == customerId && !s.IsDeleted)
                .SumAsync(s => s.GrandTotal);

            var totalPayments = await _context.Payments
                .Where(p => p.CustomerId == customerId && p.Status == PaymentStatus.CLEARED && p.SaleReturnId == null)
                .SumAsync(p => p.Amount);

            var totalSalesReturns = await _context.SaleReturns
                .Where(sr => sr.CustomerId == customerId)
                .SumAsync(sr => sr.GrandTotal);

            var refundsPaid = await _context.Payments
                .Where(p => p.CustomerId == customerId && p.SaleReturnId != null)
                .SumAsync(p => p.Amount);

            var calculatedBalance = totalSales - totalPayments - totalSalesReturns + refundsPaid;
            var storedBalance = customer.Balance;

            // Check for balance discrepancy
            var discrepancy = Math.Abs(calculatedBalance - storedBalance);
            if (discrepancy > 0.01m) // Allow 0.01 rounding tolerance
            {
                warnings.Add(
                    $"Balance discrepancy detected. " +
                    $"Stored: {storedBalance:C}, " +
                    $"Calculated: {calculatedBalance:C}, " +
                    $"Difference: {discrepancy:C}. " +
                    $"Balance should be recalculated."
                );
            }

            // If expected balance provided, validate against it
            if (expectedBalance.HasValue)
            {
                var expectedDiscrepancy = Math.Abs(calculatedBalance - expectedBalance.Value);
                if (expectedDiscrepancy > 0.01m)
                {
                    errors.Add(
                        $"Balance mismatch. Expected: {expectedBalance.Value:C}, " +
                        $"Calculated: {calculatedBalance:C}"
                    );
                }
            }

            if (errors.Any())
            {
                return ValidationResult.Failure(errors);
            }

            var result = ValidationResult.Success();
            result.Warnings = warnings;
            return result;
        }

        /// <summary>
        /// Validates sale edit is allowed and stock is available
        /// </summary>
        public async Task<ValidationResult> ValidateSaleEditAsync(int saleId, List<SaleItemRequest> newItems, int? tenantId = null)
        {
            var errors = new List<string>();
            var scope = _context.RequestScopeEstablished && !_context.RequestIsPlatformScope ? _context.RequestTenantId : tenantId;
            if (!scope.HasValue || scope <= 0 || (tenantId.HasValue && tenantId != scope))
                return ValidationResult.Failure("A verified workspace is required for invoice validation.");

            var sale = await _context.Sales
                .Include(s => s.Items)
                .FirstOrDefaultAsync(s => s.Id == saleId && s.TenantId == scope.Value && !s.IsDeleted);

            if (sale == null)
            {
                errors.Add($"Sale with ID {saleId} not found or has been deleted.");
                return ValidationResult.Failure(errors);
            }

            // Check if sale is locked (8 hours rule - Gulf trading context, disputes happen same-day)
            var hoursSinceCreation = (DateTime.UtcNow - sale.CreatedAt).TotalHours;
            if (hoursSinceCreation > 8 && sale.IsLocked)
            {
                errors.Add("Invoice cannot be edited after 8 hours. Invoice is locked.");
            }

            // Validate all items before processing
            foreach (var item in newItems)
            {
                // Validate quantity
                var qtyResult = await ValidateQuantityAsync(item.Qty);
                if (!qtyResult.IsValid)
                {
                    errors.AddRange(qtyResult.Errors);
                }

                // Validate price
                var priceResult = await ValidatePriceAsync(item.UnitPrice);
                if (!priceResult.IsValid)
                {
                    errors.AddRange(priceResult.Errors);
                }

            }

            if (errors.Any())
            {
                return ValidationResult.Failure(errors);
            }

            return await ValidateStockLinesAsync(newItems, saleId, scope.Value);
        }

        /// <summary>
        /// Validates quantity is within acceptable range
        /// </summary>
        public Task<ValidationResult> ValidateQuantityAsync(decimal quantity)
        {
            var errors = new List<string>();

            if (quantity <= 0)
            {
                errors.Add("Quantity must be greater than zero.");
            }

            if (quantity > 100000)
            {
                errors.Add("Quantity exceeds maximum limit of 100,000.");
            }

            // Check for reasonable decimal places (max 2)
            if (quantity != Math.Round(quantity, 2))
            {
                errors.Add("Quantity cannot have more than 2 decimal places.");
            }

            if (errors.Any())
            {
                return Task.FromResult(ValidationResult.Failure(errors));
            }

            return Task.FromResult(ValidationResult.Success());
        }

        /// <summary>
        /// Validates price is within acceptable range
        /// </summary>
        public Task<ValidationResult> ValidatePriceAsync(decimal price)
        {
            var errors = new List<string>();

            if (price < 0)
            {
                errors.Add("Price cannot be negative.");
            }

            if (price > 1000000)
            {
                errors.Add("Price exceeds maximum limit of 1,000,000.");
            }

            // Check for reasonable decimal places (max 2)
            if (price != Math.Round(price, 2))
            {
                errors.Add("Price cannot have more than 2 decimal places.");
            }

            if (errors.Any())
            {
                return Task.FromResult(ValidationResult.Failure(errors));
            }

            return Task.FromResult(ValidationResult.Success());
        }

        /// <summary>
        /// Validates invoice number is unique
        /// </summary>
        public async Task<ValidationResult> ValidateInvoiceNumberAsync(string invoiceNo, int? excludeSaleId = null)
        {
            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(invoiceNo))
            {
                errors.Add("Invoice number cannot be empty.");
                return ValidationResult.Failure(errors);
            }

            invoiceNo = invoiceNo.Trim();

            // Check for duplicate
            var query = _context.Sales
                .Where(s => s.InvoiceNo == invoiceNo && !s.IsDeleted);

            if (excludeSaleId.HasValue)
            {
                query = query.Where(s => s.Id != excludeSaleId.Value);
            }

            var exists = await query.AnyAsync();

            if (exists)
            {
                errors.Add($"Invoice number '{invoiceNo}' already exists. Please use a different number.");
            }

            // Validate format (alphanumeric, dashes, underscores allowed)
            if (!System.Text.RegularExpressions.Regex.IsMatch(invoiceNo, @"^[A-Za-z0-9\-_]+$"))
            {
                errors.Add("Invoice number can only contain letters, numbers, dashes, and underscores.");
            }

            if (errors.Any())
            {
                return ValidationResult.Failure(errors);
            }

            return ValidationResult.Success();
        }

        /// <summary>
        /// Validates that a Cash customer pays immediately (no outstanding allowed)
        /// </summary>
        public async Task<ValidationResult> ValidateCashCustomerSaleAsync(int? customerId, decimal totalAmount)
        {
            var errors = new List<string>();
            var warnings = new List<string>();

            if (!customerId.HasValue)
            {
                // Walk-in customer (null customerId) - always allowed
                return ValidationResult.Success();
            }

            var customer = await _context.Customers.FindAsync(customerId.Value);
            if (customer == null)
            {
                errors.Add($"Customer with ID {customerId.Value} not found.");
                return ValidationResult.Failure(errors);
            }

            // Check if customer is Cash type
            if (customer.CustomerType == CustomerType.Cash)
            {
                // Cash customers must pay immediately - check if they already have outstanding balance
                if (customer.PendingBalance > 0.01m)
                {
                    warnings.Add(
                        $"Cash customer '{customer.Name}' has outstanding balance of {customer.PendingBalance:N2}. " +
                        $"Cash customers should pay immediately. Please collect payment before new sales."
                    );
                }
            }

            // Check credit limit for Credit customers
            if (customer.CustomerType == CustomerType.Credit && customer.CreditLimit > 0)
            {
                var newBalance = customer.PendingBalance + totalAmount;
                if (newBalance > customer.CreditLimit)
                {
                    warnings.Add(
                        $"This sale will exceed credit limit for '{customer.Name}'. " +
                        $"Current balance: {customer.PendingBalance:N2}, Sale: {totalAmount:N2}, " +
                        $"Credit limit: {customer.CreditLimit:N2}"
                    );
                }
            }

            var result = ValidationResult.Success();
            result.Warnings = warnings;
            return result;
        }

        /// <summary>
        /// Validates that customer type change is allowed
        /// </summary>
        public async Task<ValidationResult> ValidateCustomerTypeChangeAsync(int customerId, string newCustomerType)
        {
            var errors = new List<string>();

            var customer = await _context.Customers.FindAsync(customerId);
            if (customer == null)
            {
                errors.Add($"Customer with ID {customerId} not found.");
                return ValidationResult.Failure(errors);
            }

            // Parse new customer type
            var parsedNewType = newCustomerType?.Trim().ToLower() switch
            {
                "cash" => CustomerType.Cash,
                "credit" => CustomerType.Credit,
                _ => CustomerType.Credit
            };

            // Check if changing from Credit to Cash with outstanding balance
            if (customer.CustomerType == CustomerType.Credit && parsedNewType == CustomerType.Cash)
            {
                if (customer.PendingBalance > 0.01m)
                {
                    errors.Add(
                        $"Cannot change customer type from Credit to Cash. " +
                        $"Customer has outstanding balance of {customer.PendingBalance:N2}. " +
                        $"Please collect all payments first."
                    );
                }
            }

            if (errors.Any())
            {
                return ValidationResult.Failure(errors);
            }

            return ValidationResult.Success();
        }
    }
}

