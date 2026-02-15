using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Shared.Validation
{
    public interface IValidationService
    {
        Task<ValidationResult> ValidatePaymentAmountAsync(int? saleId, int? customerId, decimal amount);
        Task<ValidationResult> ValidateStockAvailabilityAsync(int productId, decimal quantity, int? excludeSaleId = null);
        Task<ValidationResult> ValidateCustomerBalanceAsync(int customerId, decimal? expectedBalance = null);
        Task<ValidationResult> ValidateSaleEditAsync(int saleId, List<SaleItemRequest> newItems);
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
        public async Task<ValidationResult> ValidatePaymentAmountAsync(int? saleId, int? customerId, decimal amount)
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
                    .FirstOrDefaultAsync(s => s.Id == saleId.Value && !s.IsDeleted);

                if (sale == null)
                {
                    errors.Add($"Invoice with ID {saleId.Value} not found or has been deleted.");
                }
                else
                {
                    // CRITICAL FIX: Calculate ACTUAL paid amount from Payments table (not stale Sale.PaidAmount)
                    // This ensures we use real-time payment data instead of potentially stale cached values
                    var actualPaidAmount = await _context.Payments
                        .Where(p => p.SaleId == saleId.Value && p.Status != PaymentStatus.VOID)
                        .SumAsync(p => p.Amount);
                    
                    var outstanding = sale.GrandTotal - actualPaidAmount;
                    
                    Console.WriteLine($"?? ValidationService: Invoice {saleId} - Total={sale.GrandTotal}, ActualPaid={actualPaidAmount}, Outstanding={outstanding}");
                    
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
                        // No error, just a log
                        Console.WriteLine($"\u26a0\ufe0f Payment for invoice {saleId} has no customerId, but invoice belongs to customer {sale.CustomerId}");
                    }
                }
            }

            // If payment is for a customer (not linked to invoice)
            if (customerId.HasValue && !saleId.HasValue)
            {
                var customer = await _context.Customers.FindAsync(customerId.Value);
                if (customer == null)
                {
                    errors.Add($"Customer with ID {customerId.Value} not found.");
                }
                else
                {
                    // Check if customer has any outstanding invoices
                    var totalOutstanding = await _context.Sales
                        .Where(s => s.CustomerId == customerId.Value && !s.IsDeleted)
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
        public async Task<ValidationResult> ValidateStockAvailabilityAsync(int productId, decimal quantity, int? excludeSaleId = null)
        {
            var errors = new List<string>();
            var warnings = new List<string>();

            if (quantity <= 0)
            {
                errors.Add("Quantity must be greater than zero.");
                return ValidationResult.Failure(errors);
            }

            if (quantity > 100000)
            {
                errors.Add("Quantity exceeds maximum limit of 100,000.");
                return ValidationResult.Failure(errors);
            }

            var product = await _context.Products.FindAsync(productId);
            if (product == null)
            {
                errors.Add($"Product with ID {productId} not found.");
                return ValidationResult.Failure(errors);
            }

            // Calculate base quantity
            var baseQty = quantity * product.ConversionToBase;

            // Get current stock
            var currentStock = product.StockQty;

            // If editing a sale, add back the quantity from the excluded sale
            if (excludeSaleId.HasValue)
            {
                var excludedSale = await _context.Sales
                    .Include(s => s.Items)
                    .FirstOrDefaultAsync(s => s.Id == excludeSaleId.Value);

                if (excludedSale?.Items != null)
                {
                    var excludedItem = excludedSale.Items.FirstOrDefault(i => i.ProductId == productId);
                    if (excludedItem != null)
                    {
                        var excludedBaseQty = excludedItem.Qty * product.ConversionToBase;
                        currentStock += excludedBaseQty; // Add back excluded quantity
                    }
                }
            }

            // Check stock availability
            if (currentStock < baseQty)
            {
                errors.Add(
                    $"Insufficient stock for '{product.NameEn}'. " +
                    $"Available: {currentStock:N2} {product.UnitType}, " +
                    $"Required: {baseQty:N2} {product.UnitType}. " +
                    $"Shortage: {baseQty - currentStock:N2} {product.UnitType}"
                );
            }

            // Warning for low stock (less than 20% of required quantity remaining)
            if (currentStock > 0 && currentStock < baseQty * 1.2m)
            {
                warnings.Add($"Low stock warning: Only {currentStock:N2} {product.UnitType} remaining after this transaction.");
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
        /// Validates customer balance is correct
        /// </summary>
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

            // Recalculate actual balance from all sales and payments
            var totalSales = await _context.Sales
                .Where(s => s.CustomerId == customerId && !s.IsDeleted)
                .SumAsync(s => s.GrandTotal);

            var totalPayments = await _context.Payments
                .Where(p => p.CustomerId == customerId && p.Status == PaymentStatus.CLEARED)
                .SumAsync(p => p.Amount);

            var calculatedBalance = totalSales - totalPayments;
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
        public async Task<ValidationResult> ValidateSaleEditAsync(int saleId, List<SaleItemRequest> newItems)
        {
            var errors = new List<string>();

            var sale = await _context.Sales
                .Include(s => s.Items)
                .FirstOrDefaultAsync(s => s.Id == saleId && !s.IsDeleted);

            if (sale == null)
            {
                errors.Add($"Sale with ID {saleId} not found or has been deleted.");
                return ValidationResult.Failure(errors);
            }

            // Check if sale is locked (48 hours rule)
            var hoursSinceCreation = (DateTime.UtcNow - sale.CreatedAt).TotalHours;
            if (hoursSinceCreation > 48 && sale.IsLocked)
            {
                errors.Add("Invoice cannot be edited after 48 hours. Invoice is locked.");
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

                // Validate stock availability (excluding current sale)
                var stockResult = await ValidateStockAvailabilityAsync(item.ProductId, item.Qty, saleId);
                if (!stockResult.IsValid)
                {
                    errors.AddRange(stockResult.Errors);
                }
            }

            if (errors.Any())
            {
                return ValidationResult.Failure(errors);
            }

            return ValidationResult.Success();
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

