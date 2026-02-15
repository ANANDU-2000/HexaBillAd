/*
Purpose: Real-time balance tracking service for customers
Author: AI Assistant
Date: 2025-11-11
Description: Handles all customer balance calculations, validations, and updates
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Notifications;

namespace HexaBill.Api.Modules.Customers
{
    public interface IBalanceService
    {
        Task RecalculateCustomerBalanceAsync(int customerId);
        Task UpdateCustomerBalanceOnInvoiceCreatedAsync(int customerId, decimal invoiceTotal);
        Task UpdateCustomerBalanceOnInvoiceDeletedAsync(int customerId, decimal invoiceTotal);
        Task UpdateCustomerBalanceOnInvoiceEditedAsync(int customerId, decimal oldTotal, decimal newTotal);
        Task UpdateCustomerBalanceOnPaymentCreatedAsync(int customerId, decimal paymentAmount);
        Task UpdateCustomerBalanceOnPaymentDeletedAsync(int customerId, decimal paymentAmount);
        Task<BalanceValidationResult> ValidateCustomerBalanceAsync(int customerId);
        Task<List<BalanceMismatch>> DetectAllBalanceMismatchesAsync();
        Task<bool> FixBalanceMismatchAsync(int customerId);
        Task<bool> CanCustomerReceiveCreditAsync(int customerId, decimal additionalAmount);
    }

    public class BalanceService : IBalanceService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<BalanceService> _logger;
        private readonly IAlertService _alertService;

        public BalanceService(
            AppDbContext context,
            ILogger<BalanceService> logger,
            IAlertService alertService)
        {
            _context = context;
            _logger = logger;
            _alertService = alertService;
        }

        /// <summary>
        /// Recalculate customer balance from scratch using actual database data
        /// CRITICAL: Counts ALL payments (including PENDING) to match invoice PaidAmount
        /// </summary>
        public async Task RecalculateCustomerBalanceAsync(int customerId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var customer = await _context.Customers.FindAsync(customerId);
                if (customer == null)
                {
                    _logger.LogWarning("Customer {CustomerId} not found for balance recalculation", customerId);
                    return;
                }

                // Calculate TotalSales from all non-deleted invoices
                var totalSales = await _context.Sales
                    .Where(s => s.CustomerId == customerId && !s.IsDeleted)
                    .SumAsync(s => (decimal?)s.GrandTotal) ?? 0m;

                // CRITICAL FIX: Count ALL payments (including PENDING) to match invoice PaidAmount updates
                // This ensures consistency - invoice shows PaidAmount for all payments, so balance should too
                // VOIDED payments are excluded as they don't count
                var totalPayments = await _context.Payments
                    .Where(p => p.CustomerId == customerId && p.Status != PaymentStatus.VOID)
                    .SumAsync(p => (decimal?)p.Amount) ?? 0m;
                    
                // Also track cleared-only payments for reporting (real money received)
                var clearedPayments = await _context.Payments
                    .Where(p => p.CustomerId == customerId && p.Status == PaymentStatus.CLEARED)
                    .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                // Calculate PendingBalance (what customer still owes)
                var pendingBalance = totalSales - totalPayments;

                // Update customer record
                customer.TotalSales = totalSales;
                customer.TotalPayments = totalPayments;
                customer.PendingBalance = pendingBalance;
                customer.Balance = pendingBalance; // Keep legacy field in sync
                customer.UpdatedAt = DateTime.UtcNow;

                // Update LastPaymentDate
                var lastPayment = await _context.Payments
                    .Where(p => p.CustomerId == customerId)
                    .OrderByDescending(p => p.PaymentDate)
                    .FirstOrDefaultAsync();
                customer.LastPaymentDate = lastPayment?.PaymentDate;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation(
                    "Customer {CustomerId} balance recalculated: TotalSales={TotalSales}, TotalPayments={TotalPayments}, Cleared={Cleared}, Pending={Pending}",
                    customerId, totalSales, totalPayments, clearedPayments, pendingBalance);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Failed to recalculate balance for customer {CustomerId}", customerId);
                throw;
            }
        }

        /// <summary>
        /// Update customer balance when invoice is created
        /// </summary>
        public async Task UpdateCustomerBalanceOnInvoiceCreatedAsync(int customerId, decimal invoiceTotal)
        {
            var customer = await _context.Customers.FindAsync(customerId);
            if (customer == null) return;

            customer.TotalSales += invoiceTotal;
            customer.PendingBalance = customer.TotalSales - customer.TotalPayments;
            customer.Balance = customer.PendingBalance;
            customer.LastActivity = DateTime.UtcNow;
            customer.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Customer {CustomerId} balance updated on invoice created: +{Amount}, NewPending={Pending}",
                customerId, invoiceTotal, customer.PendingBalance);
        }

        /// <summary>
        /// Update customer balance when invoice is deleted
        /// </summary>
        public async Task UpdateCustomerBalanceOnInvoiceDeletedAsync(int customerId, decimal invoiceTotal)
        {
            var customer = await _context.Customers.FindAsync(customerId);
            if (customer == null) return;

            customer.TotalSales -= invoiceTotal;
            customer.PendingBalance = customer.TotalSales - customer.TotalPayments;
            customer.Balance = customer.PendingBalance;
            customer.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Customer {CustomerId} balance updated on invoice deleted: -{Amount}, NewPending={Pending}",
                customerId, invoiceTotal, customer.PendingBalance);
        }

        /// <summary>
        /// Update customer balance when invoice is edited
        /// </summary>
        public async Task UpdateCustomerBalanceOnInvoiceEditedAsync(int customerId, decimal oldTotal, decimal newTotal)
        {
            var customer = await _context.Customers.FindAsync(customerId);
            if (customer == null) return;

            var difference = newTotal - oldTotal;
            customer.TotalSales += difference;
            customer.PendingBalance = customer.TotalSales - customer.TotalPayments;
            customer.Balance = customer.PendingBalance;
            customer.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Customer {CustomerId} balance updated on invoice edited: Delta={Delta}, NewPending={Pending}",
                customerId, difference, customer.PendingBalance);
        }

        /// <summary>
        /// Update customer balance when payment is created
        /// </summary>
        public async Task UpdateCustomerBalanceOnPaymentCreatedAsync(int customerId, decimal paymentAmount)
        {
            var customer = await _context.Customers.FindAsync(customerId);
            if (customer == null) return;

            customer.TotalPayments += paymentAmount;
            customer.PendingBalance = customer.TotalSales - customer.TotalPayments;
            customer.Balance = customer.PendingBalance;
            customer.LastPaymentDate = DateTime.UtcNow;
            customer.LastActivity = DateTime.UtcNow;
            customer.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Customer {CustomerId} balance updated on payment created: +{Amount}, NewPending={Pending}",
                customerId, paymentAmount, customer.PendingBalance);
        }

        /// <summary>
        /// Update customer balance when payment is deleted
        /// </summary>
        public async Task UpdateCustomerBalanceOnPaymentDeletedAsync(int customerId, decimal paymentAmount)
        {
            var customer = await _context.Customers.FindAsync(customerId);
            if (customer == null) return;

            customer.TotalPayments -= paymentAmount;
            customer.PendingBalance = customer.TotalSales - customer.TotalPayments;
            customer.Balance = customer.PendingBalance;
            customer.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Customer {CustomerId} balance updated on payment deleted: -{Amount}, NewPending={Pending}",
                customerId, paymentAmount, customer.PendingBalance);
        }

        /// <summary>
        /// Validate customer balance against actual data
        /// </summary>
        public async Task<BalanceValidationResult> ValidateCustomerBalanceAsync(int customerId)
        {
            var customer = await _context.Customers.FindAsync(customerId);
            if (customer == null)
            {
                return new BalanceValidationResult
                {
                    IsValid = false,
                    ErrorMessage = "Customer not found"
                };
            }

            // Calculate actual values from database
            var actualTotalSales = await _context.Sales
                .Where(s => s.CustomerId == customerId && !s.IsDeleted)
                .SumAsync(s => (decimal?)s.GrandTotal) ?? 0m;

            // CRITICAL FIX: Match RecalculateCustomerBalanceAsync - count ALL non-VOID payments
            var actualTotalPayments = await _context.Payments
                .Where(p => p.CustomerId == customerId && p.Status != PaymentStatus.VOID)
                .SumAsync(p => (decimal?)p.Amount) ?? 0m;

            var actualPendingBalance = actualTotalSales - actualTotalPayments;

            // Check for mismatches (allow 0.01 tolerance for rounding)
            var salesMismatch = Math.Abs(customer.TotalSales - actualTotalSales) > 0.01m;
            var paymentsMismatch = Math.Abs(customer.TotalPayments - actualTotalPayments) > 0.01m;
            var balanceMismatch = Math.Abs(customer.PendingBalance - actualPendingBalance) > 0.01m;

            if (salesMismatch || paymentsMismatch || balanceMismatch)
            {
                _logger.LogWarning(
                    "Balance mismatch for customer {CustomerId}: Stored(Sales={StoredSales}, Payments={StoredPayments}, Pending={StoredPending}) " +
                    "vs Actual(Sales={ActualSales}, Payments={ActualPayments}, Pending={ActualPending})",
                    customerId, customer.TotalSales, customer.TotalPayments, customer.PendingBalance,
                    actualTotalSales, actualTotalPayments, actualPendingBalance);

                // Create alert for admin
                await _alertService.CreateAlertAsync(
                    AlertType.BalanceMismatch,
                    $"Balance mismatch for customer {customer.Name}",
                    $"Stored: {customer.PendingBalance:C}, Actual: {actualPendingBalance:C}",
                    AlertSeverity.Warning,
                    new Dictionary<string, object> {
                        { "CustomerId", customerId },
                        { "StoredPending", customer.PendingBalance },
                        { "ActualPending", actualPendingBalance }
                    });

                return new BalanceValidationResult
                {
                    IsValid = false,
                    StoredTotalSales = customer.TotalSales,
                    ActualTotalSales = actualTotalSales,
                    StoredTotalPayments = customer.TotalPayments,
                    ActualTotalPayments = actualTotalPayments,
                    StoredPendingBalance = customer.PendingBalance,
                    ActualPendingBalance = actualPendingBalance
                };
            }

            return new BalanceValidationResult { IsValid = true };
        }

        /// <summary>
        /// Detect all balance mismatches across all customers
        /// </summary>
        public async Task<List<BalanceMismatch>> DetectAllBalanceMismatchesAsync()
        {
            var mismatches = new List<BalanceMismatch>();
            var customers = await _context.Customers.ToListAsync();

            foreach (var customer in customers)
            {
                var validation = await ValidateCustomerBalanceAsync(customer.Id);
                if (!validation.IsValid)
                {
                    mismatches.Add(new BalanceMismatch
                    {
                        CustomerId = customer.Id,
                        CustomerName = customer.Name,
                        StoredPending = validation.StoredPendingBalance,
                        ActualPending = validation.ActualPendingBalance,
                        Difference = validation.StoredPendingBalance - validation.ActualPendingBalance
                    });
                }
            }

            return mismatches;
        }

        /// <summary>
        /// Fix balance mismatch for a specific customer
        /// </summary>
        public async Task<bool> FixBalanceMismatchAsync(int customerId)
        {
            try
            {
                await RecalculateCustomerBalanceAsync(customerId);
                var validation = await ValidateCustomerBalanceAsync(customerId);
                return validation.IsValid;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fix balance mismatch for customer {CustomerId}", customerId);
                return false;
            }
        }

        /// <summary>
        /// Check if customer can receive additional credit (pending balance check)
        /// </summary>
        public async Task<bool> CanCustomerReceiveCreditAsync(int customerId, decimal additionalAmount)
        {
            var customer = await _context.Customers.FindAsync(customerId);
            if (customer == null) return false;

            // Calculate new pending balance if invoice is created
            var newPending = customer.PendingBalance + additionalAmount;

            // Check if new pending exceeds credit limit
            if (newPending > customer.CreditLimit)
            {
                _logger.LogWarning(
                    "Customer {CustomerId} credit limit exceeded: Current={Current}, Additional={Additional}, Limit={Limit}",
                    customerId, customer.PendingBalance, additionalAmount, customer.CreditLimit);

                // Create alert
                await _alertService.CreateAlertAsync(
                    AlertType.ValidationError,
                    $"Credit limit exceeded for {customer.Name}",
                    $"Attempted amount: {additionalAmount:C}, Current pending: {customer.PendingBalance:C}, Credit limit: {customer.CreditLimit:C}",
                    AlertSeverity.Warning,
                    new Dictionary<string, object> {
                        { "CustomerId", customerId },
                        { "AttemptedAmount", additionalAmount },
                        { "CreditLimit", customer.CreditLimit }
                    });

                return false;
            }

            return true;
        }
    }

    // DTOs for balance validation
    public class BalanceValidationResult
    {
        public bool IsValid { get; set; }
        public string? ErrorMessage { get; set; }
        public decimal StoredTotalSales { get; set; }
        public decimal ActualTotalSales { get; set; }
        public decimal StoredTotalPayments { get; set; }
        public decimal ActualTotalPayments { get; set; }
        public decimal StoredPendingBalance { get; set; }
        public decimal ActualPendingBalance { get; set; }
    }

    public class BalanceMismatch
    {
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public decimal StoredPending { get; set; }
        public decimal ActualPending { get; set; }
        public decimal Difference { get; set; }
    }
}
