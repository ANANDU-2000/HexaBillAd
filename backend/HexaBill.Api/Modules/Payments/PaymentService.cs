/*
Purpose: Payment service for payment tracking with atomic transactions
Author: AI Assistant
Date: 2024
Updated: 2025 - Complete rewrite per spec for proper payment/invoice/balance tracking
*/
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions; // CRITICAL: For ToUtcKind() extension
using HexaBill.Api.Modules.Notifications;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Shared.Validation;

namespace HexaBill.Api.Modules.Payments
{
    public interface IPaymentService
    {
        Task<PagedResponse<PaymentDto>> GetPaymentsAsync(int tenantId, int page = 1, int pageSize = 10);
        Task<PaymentDto?> GetPaymentByIdAsync(int id, int tenantId);
        Task<CreatePaymentResponse> CreatePaymentAsync(CreatePaymentRequest request, int userId, int tenantId, string? idempotencyKey = null);
        Task<bool> UpdatePaymentStatusAsync(int paymentId, PaymentStatus status, int userId, int tenantId);
        Task<PaymentDto?> UpdatePaymentAsync(int paymentId, UpdatePaymentRequest request, int userId, int tenantId);
        Task<bool> DeletePaymentAsync(int paymentId, int userId, int tenantId);
        Task<List<Models.OutstandingInvoiceDto>> GetOutstandingInvoicesAsync(int customerId, int tenantId);
        Task<InvoiceAmountDto> GetInvoiceAmountAsync(int invoiceId, int tenantId);
        Task<CreatePaymentResponse> AllocatePaymentAsync(AllocatePaymentRequest request, int userId, int tenantId, string? idempotencyKey = null);
    }

    public class PaymentService : IPaymentService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<PaymentService> _logger;
        private readonly IValidationService _validationService;
        private readonly IBalanceService _balanceService;
        private readonly IAlertService _alertService;

        public PaymentService(
            AppDbContext context, 
            ILogger<PaymentService> logger, 
            IValidationService validationService,
            IBalanceService balanceService,
            IAlertService alertService)
        {
            _context = context;
            _logger = logger;
            _validationService = validationService;
            _balanceService = balanceService;
            _alertService = alertService;
        }

        public async Task<PagedResponse<PaymentDto>> GetPaymentsAsync(int tenantId, int page = 1, int pageSize = 10)
        {
            var query = _context.Payments
                .Where(p => p.TenantId == tenantId) // CRITICAL: Multi-tenant filter
                .Include(p => p.Sale)
                .Include(p => p.Customer)
                .Include(p => p.CreatedByUser)
                .AsQueryable();

            var totalCount = await query.CountAsync();
            var payments = await query
                .OrderByDescending(p => p.PaymentDate)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new PaymentDto
                {
                    Id = p.Id,
                    SaleId = p.SaleId,
                    InvoiceNo = p.Sale != null ? p.Sale.InvoiceNo : null,
                    CustomerId = p.CustomerId,
                    CustomerName = p.Customer != null ? p.Customer.Name : null,
                    Amount = p.Amount,
                    Mode = p.Mode.ToString(),
                    Reference = p.Reference,
                    Status = p.Status.ToString(),
                    PaymentDate = p.PaymentDate,
                    CreatedBy = p.CreatedBy,
                    CreatedAt = p.CreatedAt
                })
                .ToListAsync();

            return new PagedResponse<PaymentDto>
            {
                Items = payments,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            };
        }

        public async Task<PaymentDto?> GetPaymentByIdAsync(int id, int tenantId)
        {
            var payment = await _context.Payments
                .Where(p => p.Id == id && p.TenantId == tenantId) // CRITICAL: Multi-tenant filter
                .Include(p => p.Sale)
                .Include(p => p.Customer)
                .Include(p => p.CreatedByUser)
                .FirstOrDefaultAsync();

            if (payment == null) return null;

            return new PaymentDto
            {
                Id = payment.Id,
                SaleId = payment.SaleId,
                InvoiceNo = payment.Sale?.InvoiceNo,
                CustomerId = payment.CustomerId,
                CustomerName = payment.Customer?.Name,
                Amount = payment.Amount,
                Mode = payment.Mode.ToString(),
                Reference = payment.Reference,
                Status = payment.Status.ToString(),
                PaymentDate = payment.PaymentDate,
                CreatedBy = payment.CreatedBy,
                CreatedAt = payment.CreatedAt
            };
        }

        public async Task<CreatePaymentResponse> CreatePaymentAsync(CreatePaymentRequest request, int userId, int tenantId, string? idempotencyKey = null)
        {
            // Validate request
            if (request.Amount <= 0)
                throw new ArgumentException("Payment amount must be greater than zero. Please enter a valid amount.");

            // NOTE: CustomerId can be null for CASH sales (walk-in customers)
            // Only require CustomerId for invoice-linked payments
            if (!request.CustomerId.HasValue && !request.SaleId.HasValue)
                throw new ArgumentException("Please select a customer or invoice before recording payment.");

            // Check idempotency if key provided
            if (!string.IsNullOrEmpty(idempotencyKey))
            {
                var existingRequest = await _context.PaymentIdempotencies
                    .FirstOrDefaultAsync(pr => pr.IdempotencyKey == idempotencyKey);
                
                if (existingRequest != null)
                {
                    // Return existing payment response
                    var existingPayment = await GetPaymentByIdAsync(existingRequest.PaymentId, tenantId);
                    if (existingPayment != null)
                    {
                        var sale = existingRequest.Payment?.Sale;
                        var customer = existingRequest.Payment?.Customer;
                        
                        Console.WriteLine($"⚠️ DUPLICATE PAYMENT DETECTED (Idempotency Key): {idempotencyKey}");
                        return new CreatePaymentResponse
                        {
                            Payment = existingPayment,
                            Invoice = sale != null ? new InvoiceSummaryDto
                            {
                                Id = sale.Id,
                                InvoiceNo = sale.InvoiceNo,
                                TotalAmount = sale.GrandTotal,
                                PaidAmount = sale.PaidAmount,
                                OutstandingAmount = sale.GrandTotal - sale.PaidAmount,
                                Status = sale.PaymentStatus.ToString()
                            } : null,
                            Customer = customer != null ? new CustomerSummaryDto
                            {
                                Id = customer.Id,
                                Name = customer.Name,
                                Balance = customer.Balance
                            } : null
                        };
                    }
                }
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Validate invoice belongs to customer if provided - use FOR UPDATE to lock row
                Sale? invoiceSale = null;
                if (request.SaleId.HasValue)
                {
                    // CRITICAL FIX: First find the invoice by ID, then verify customer if provided
                    // This handles Cash/Credit customer transitions where customer may have existing invoices
                    invoiceSale = await _context.Sales
                        .FirstOrDefaultAsync(s => s.Id == request.SaleId.Value && s.TenantId == tenantId && !s.IsDeleted);
                    
                    if (invoiceSale == null)
                    {
                        throw new ArgumentException($"Invoice with ID {request.SaleId.Value} not found.");
                    }
                    
                    // Validate customer matches if both are provided
                    if (request.CustomerId.HasValue && invoiceSale.CustomerId.HasValue && 
                        invoiceSale.CustomerId.Value != request.CustomerId.Value)
                    {
                        throw new ArgumentException($"Invoice {invoiceSale.InvoiceNo} belongs to a different customer. Expected customer ID: {invoiceSale.CustomerId.Value}, got: {request.CustomerId.Value}");
                    }
                    
                    // If invoice has a customer but request doesn't, use the invoice's customer
                    if (invoiceSale.CustomerId.HasValue && !request.CustomerId.HasValue)
                    {
                        request.CustomerId = invoiceSale.CustomerId;
                        Console.WriteLine($"\u2139\ufe0f Auto-assigning CustomerId {invoiceSale.CustomerId} from invoice {invoiceSale.InvoiceNo}");
                    }

                    // CRITICAL FIX: Calculate ACTUAL paid amount from Payments table (not stale Sale.PaidAmount)
                    var actualPaidAmount = await _context.Payments
                        .Where(p => p.SaleId == request.SaleId.Value && p.TenantId == tenantId && p.Status != PaymentStatus.VOID)
                        .SumAsync(p => p.Amount);
                    
                    var realOutstanding = invoiceSale.GrandTotal - actualPaidAmount;
                    
                    Console.WriteLine($"\ud83d\udcca Invoice {invoiceSale.InvoiceNo}: Total={invoiceSale.GrandTotal}, ActualPaid={actualPaidAmount}, Outstanding={realOutstanding}");

                    // CRITICAL FIX: Block payment if invoice is already fully paid
                    if (realOutstanding <= 0)
                    {
                        Console.WriteLine($"\u26a0\ufe0f OVERPAYMENT BLOCKED: Invoice {invoiceSale.InvoiceNo} is already fully paid (Paid: {actualPaidAmount}, Total: {invoiceSale.GrandTotal})");
                        throw new ArgumentException($"Invoice {invoiceSale.InvoiceNo} is already fully paid. Total: {invoiceSale.GrandTotal:F2} AED, Paid: {actualPaidAmount:F2} AED. No more payments allowed.");
                    }

                    // CRITICAL FIX: Prevent overpayment
                    if (request.Amount > realOutstanding + 0.01m)
                    {
                        Console.WriteLine($"\u26a0\ufe0f OVERPAYMENT BLOCKED: Payment {request.Amount} exceeds outstanding {realOutstanding}");
                        throw new ArgumentException($"Payment amount ({request.Amount:F2} AED) exceeds outstanding balance ({realOutstanding:F2} AED). Maximum allowed: {realOutstanding:F2} AED");
                    }

                    // CRITICAL FIX: Check for duplicate payments (same amount within 2 minutes)
                    var recentDuplicatePayment = await _context.Payments
                        .Where(p => p.SaleId == request.SaleId.Value 
                            && p.Amount == request.Amount 
                            && p.TenantId == tenantId
                            && p.Status != PaymentStatus.VOID
                            && p.CreatedAt >= DateTime.UtcNow.AddMinutes(-2))
                        .FirstOrDefaultAsync();
                    
                    if (recentDuplicatePayment != null)
                    {
                        Console.WriteLine($"\u26a0\ufe0f DUPLICATE PAYMENT BLOCKED: Same amount {request.Amount} to invoice {invoiceSale.InvoiceNo} within 2 minutes");
                        throw new ArgumentException($"A payment of {request.Amount:F2} AED was already recorded for invoice {invoiceSale.InvoiceNo} just now. Please refresh and verify before trying again.");
                    }

                    // CRITICAL FIX: Show how many payments already exist for this invoice
                    var existingPaymentCount = await _context.Payments
                        .Where(p => p.SaleId == request.SaleId.Value && p.TenantId == tenantId && p.Status != PaymentStatus.VOID)
                        .CountAsync();
                    
                    if (existingPaymentCount > 0)
                    {
                        Console.WriteLine($"\ud83d\udcdd Invoice {invoiceSale.InvoiceNo} already has {existingPaymentCount} payment(s). Adding new payment of {request.Amount}");
                    }

                    // Use validation service for additional validation
                    var validationResult = await _validationService.ValidatePaymentAmountAsync(
                        request.SaleId, 
                        request.CustomerId, 
                        request.Amount
                    );

                    if (!validationResult.IsValid)
                    {
                        throw new ArgumentException(string.Join(" ", validationResult.Errors));
                    }
                }

                // Determine payment status based on mode
                PaymentStatus paymentStatus;
                if (request.Mode == "CHEQUE")
                    paymentStatus = PaymentStatus.PENDING;
                else if (request.Mode == "CASH" || request.Mode == "ONLINE")
                    paymentStatus = PaymentStatus.CLEARED;
                else if (request.Mode == "CREDIT")
                    paymentStatus = PaymentStatus.PENDING;
                else
                    paymentStatus = PaymentStatus.PENDING;

                // Create payment record using EF Core (PostgreSQL compatible - NO raw SQL)
                var paymentMode = Enum.Parse<PaymentMode>(request.Mode);
                // CRITICAL: Convert PaymentDate to UTC for PostgreSQL
                var paymentDate = (request.PaymentDate ?? DateTime.UtcNow).ToUtcKind();
                
                // Create payment using EF Core (works with PostgreSQL)
                var payment = new Payment
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    SaleId = request.SaleId,
                    CustomerId = request.CustomerId, // Can be null for cash customers
                    Amount = request.Amount,
                    Mode = paymentMode,
                    Reference = request.Reference,
                    Status = paymentStatus,
                    PaymentDate = paymentDate,
                    CreatedBy = userId,
                    CreatedAt = paymentDate,
                    UpdatedAt = paymentDate
                    // RowVersion will be auto-generated by PostgreSQL trigger
                };
                
                _context.Payments.Add(payment);
                await _context.SaveChangesAsync(); // Save to get payment ID generated
                
                int paymentId = payment.Id;
                Console.WriteLine($"✅ Payment inserted via EF Core. Payment ID: {paymentId}, Amount: {request.Amount}, Mode: {request.Mode}, Status: {paymentStatus}");

                // CRITICAL FIX: Always update invoice when payment is created
                // For CHEQUE: Mark as Partial with pending note, for CASH/ONLINE: Update immediately
                Sale? updatedSale = null;
                if (request.SaleId.HasValue && invoiceSale != null)
                {
                    // CRITICAL FIX: Calculate ACTUAL paid amount from Payments table (fresh after our insert)
                    // This ensures we don't use stale Sale.PaidAmount
                    var freshPaidAmount = await _context.Payments
                        .Where(p => p.SaleId == request.SaleId.Value && p.TenantId == tenantId && p.Status != PaymentStatus.VOID)
                        .SumAsync(p => p.Amount);
                    
                    Console.WriteLine($"📊 Fresh PaidAmount calculated from Payments: {freshPaidAmount} (was {invoiceSale.PaidAmount})");
                    
                    // Update sale with FRESH paid amount
                    invoiceSale.PaidAmount = freshPaidAmount;
                    invoiceSale.LastPaymentDate = payment.PaymentDate;

                    // Update status based on FRESH paid amount
                    if (invoiceSale.PaidAmount >= invoiceSale.GrandTotal)
                    {
                        invoiceSale.PaymentStatus = SalePaymentStatus.Paid;
                        Console.WriteLine($"✅ Invoice {invoiceSale.InvoiceNo} marked as PAID (Paid: {invoiceSale.PaidAmount}, Total: {invoiceSale.GrandTotal})");
                    }
                    else if (invoiceSale.PaidAmount > 0)
                    {
                        invoiceSale.PaymentStatus = SalePaymentStatus.Partial;
                        Console.WriteLine($"📋 Invoice {invoiceSale.InvoiceNo} marked as PARTIAL (Paid: {invoiceSale.PaidAmount}, Total: {invoiceSale.GrandTotal})");
                    }
                    else
                    {
                        invoiceSale.PaymentStatus = SalePaymentStatus.Pending;
                    }

                    updatedSale = invoiceSale;
                }

                // Update customer balance (only if payment is cleared AND customer exists)
                Customer? updatedCustomer = null;
                if (paymentStatus == PaymentStatus.CLEARED && request.CustomerId.HasValue)
                {
                    var customer = await _context.Customers
                        .FirstOrDefaultAsync(c => c.Id == request.CustomerId.Value && c.TenantId == tenantId);
                    if (customer != null)
                    {
                        customer.Balance = Math.Round(customer.Balance - request.Amount, 2, MidpointRounding.AwayFromZero); // Reduce balance (customer owes less)
                        customer.LastActivity = DateTime.UtcNow;
                        customer.UpdatedAt = DateTime.UtcNow;
                        updatedCustomer = customer;
                    }
                }

                // Create audit log
                var auditLog = new AuditLog
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    UserId = userId,
                    Action = "Payment Created",
                    Details = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        PaymentId = payment.Id,
                        InvoiceId = request.SaleId,
                        CustomerId = request.CustomerId,
                        Amount = request.Amount,
                        Mode = request.Mode,
                        Status = paymentStatus.ToString(),
                        Reference = request.Reference
                    }),
                    CreatedAt = DateTime.UtcNow
                };

                _context.AuditLogs.Add(auditLog);

                // CRITICAL FIX: Recalculate customer balance INSIDE transaction BEFORE commit
                // This ensures balance is correct AND if recalculation fails, the whole transaction fails
                if (request.CustomerId.HasValue)
                {
                    var customerService = new HexaBill.Api.Modules.Customers.CustomerService(_context);
                    var customer = await _context.Customers
                        .FirstOrDefaultAsync(c => c.Id == request.CustomerId.Value && c.TenantId == tenantId);
                    if (customer != null)
                    {
                        await customerService.RecalculateCustomerBalanceAsync(request.CustomerId.Value, customer.TenantId ?? 0);
                        Console.WriteLine($"✅ Customer balance recalculated INSIDE transaction. New balance: {customer.Balance}");
                        updatedCustomer = customer;
                    }
                }

                // Save changes with optimistic concurrency check
                try
                {
                    // Save all changes (payment, invoice, customer balance, audit)
                    await _context.SaveChangesAsync();
                    
                    // Create idempotency record if key provided
                    if (!string.IsNullOrEmpty(idempotencyKey))
                    {
                        var responseSnapshot = System.Text.Json.JsonSerializer.Serialize(new
                        {
                            PaymentId = paymentId,
                            InvoiceId = request.SaleId,
                            CustomerId = request.CustomerId,
                            Amount = request.Amount
                        });
                        
                        var paymentIdempotency = new PaymentIdempotency
                        {
                            IdempotencyKey = idempotencyKey,
                            PaymentId = paymentId,
                            UserId = userId,
                            CreatedAt = DateTime.UtcNow,
                            ResponseSnapshot = responseSnapshot
                        };
                        
                        _context.PaymentIdempotencies.Add(paymentIdempotency);
                        await _context.SaveChangesAsync();
                    }
                    
                    await transaction.CommitAsync();
                    Console.WriteLine($"✅ Payment transaction committed. Payment ID: {paymentId}, Amount: {request.Amount}");
                }
                catch (DbUpdateConcurrencyException ex)
                {
                    await transaction.RollbackAsync();
                    Console.WriteLine($"❌ Concurrency conflict in payment creation: {ex.Message}");
                    throw new InvalidOperationException("Invoice was modified by another user. Please refresh and try again.", ex);
                }
                catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
                {
                    await transaction.RollbackAsync();
                    var errorMessage = ex.InnerException?.Message ?? ex.Message;
                    Console.WriteLine($"❌ Database update error in payment creation: {errorMessage}");
                    Console.WriteLine($"❌ Full Exception: {ex}");
                    throw new InvalidOperationException($"Database error: {errorMessage}", ex);
                }

                // Reload entities for response
                if (updatedSale != null)
                    await _context.Entry(updatedSale).ReloadAsync();
                if (updatedCustomer != null)
                    await _context.Entry(updatedCustomer).ReloadAsync();

                return new CreatePaymentResponse
                {
                    Payment = await GetPaymentByIdAsync(paymentId, tenantId) ?? throw new InvalidOperationException("Failed to retrieve payment"),
                    Invoice = updatedSale != null ? new InvoiceSummaryDto
                    {
                        Id = updatedSale.Id,
                        InvoiceNo = updatedSale.InvoiceNo,
                        TotalAmount = updatedSale.GrandTotal,
                        PaidAmount = updatedSale.PaidAmount,
                        OutstandingAmount = updatedSale.GrandTotal - updatedSale.PaidAmount,
                        Status = updatedSale.PaymentStatus.ToString()
                    } : null,
                    Customer = updatedCustomer != null ? new CustomerSummaryDto
                    {
                        Id = updatedCustomer.Id,
                        Name = updatedCustomer.Name,
                        Balance = updatedCustomer.Balance
                    } : null
                };
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                Console.WriteLine($"❌ PaymentService.CreatePaymentAsync Error: {ex.Message}");
                Console.WriteLine($"❌ Stack Trace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"❌ Inner Exception: {ex.InnerException.Message}");
                    Console.WriteLine($"❌ Inner Stack Trace: {ex.InnerException.StackTrace}");
                }
                _logger.LogError(ex, "Error creating payment");
                throw;
            }
        }

        public async Task<bool> UpdatePaymentStatusAsync(int paymentId, PaymentStatus status, int userId, int tenantId)
        {
            // Add owner filter to the query
            var payment = await _context.Payments
                .Where(p => p.Id == paymentId && p.TenantId == tenantId)
                .Include(p => p.Sale)
                .Include(p => p.Customer)
                .FirstOrDefaultAsync();
            
            if (payment == null) return false;

            var oldStatus = payment.Status;
            payment.Status = status;
            payment.UpdatedAt = DateTime.UtcNow;

            // CRITICAL FIX: Handle status changes correctly
            // Since CreatePaymentAsync updates Sale.PaidAmount for ALL payment types (including PENDING),
            // but only updates Customer.Balance for CLEARED payments, we need to handle transitions carefully:
            // - PENDING → CLEARED: Only update Customer.Balance (PaidAmount already added)
            // - PENDING → VOID: Reverse PaidAmount only (Balance was never affected)
            // - CLEARED → VOID/RETURNED: Reverse both PaidAmount and Balance
            // - CLEARED → PENDING: Reverse Balance only (keep PaidAmount)

            // If changing from PENDING to CLEARED - only affect Customer.Balance
            // (Sale.PaidAmount was already updated when payment was created)
            if (oldStatus == PaymentStatus.PENDING && status == PaymentStatus.CLEARED)
            {
                Console.WriteLine($"📋 Status change: PENDING → CLEARED for payment {paymentId}");
                
                // Customer balance should now reflect this cleared payment
                if (payment.CustomerId.HasValue)
                {
                    var customer = await _context.Customers
                        .FirstOrDefaultAsync(c => c.Id == payment.CustomerId.Value && c.TenantId == tenantId);
                    if (customer != null)
                    {
                        customer.Balance -= payment.Amount; // Customer owes less now
                        customer.LastActivity = DateTime.UtcNow;
                        customer.UpdatedAt = DateTime.UtcNow;
                        Console.WriteLine($"✅ Customer {customer.Name} balance updated: {customer.Balance}");
                    }
                }
            }
            // If voiding/returning from any non-VOID status
            else if ((status == PaymentStatus.VOID || status == PaymentStatus.RETURNED) && oldStatus != PaymentStatus.VOID)
            {
                Console.WriteLine($"📋 Status change: {oldStatus} → {status} for payment {paymentId} - Reversing effects");
                
                // Always reverse Sale.PaidAmount (it was added for ALL payment types)
                if (payment.SaleId.HasValue)
                {
                    var sale = await _context.Sales
                        .FirstOrDefaultAsync(s => s.Id == payment.SaleId.Value && s.TenantId == tenantId);
                    if (sale != null)
                    {
                        sale.PaidAmount = Math.Max(0, sale.PaidAmount - payment.Amount);
                        sale.LastPaymentDate = await _context.Payments
                            .Where(p => p.SaleId == sale.Id && p.Status != PaymentStatus.VOID && p.Status != PaymentStatus.RETURNED && p.Id != paymentId)
                            .OrderByDescending(p => p.PaymentDate)
                            .Select(p => p.PaymentDate)
                            .FirstOrDefaultAsync();

                        if (sale.PaidAmount >= sale.GrandTotal)
                            sale.PaymentStatus = SalePaymentStatus.Paid;
                        else if (sale.PaidAmount > 0)
                            sale.PaymentStatus = SalePaymentStatus.Partial;
                        else
                            sale.PaymentStatus = SalePaymentStatus.Pending;
                        
                        Console.WriteLine($"✅ Sale {sale.InvoiceNo} PaidAmount reversed to: {sale.PaidAmount}, Status: {sale.PaymentStatus}");
                    }
                }

                // Only reverse Customer.Balance if payment was CLEARED (balance was only affected for cleared payments)
                if (oldStatus == PaymentStatus.CLEARED && payment.CustomerId.HasValue)
                {
                    var customer = await _context.Customers
                        .FirstOrDefaultAsync(c => c.Id == payment.CustomerId.Value && c.TenantId == tenantId);
                    if (customer != null)
                    {
                        customer.Balance += payment.Amount; // Reverse: customer owes more
                        customer.LastActivity = DateTime.UtcNow;
                        customer.UpdatedAt = DateTime.UtcNow;
                        Console.WriteLine($"✅ Customer {customer.Name} balance reversed to: {customer.Balance}");
                    }
                }
            }
            // If changing from CLEARED to PENDING - reverse Customer.Balance only
            else if (oldStatus == PaymentStatus.CLEARED && status == PaymentStatus.PENDING)
            {
                Console.WriteLine($"📋 Status change: CLEARED → PENDING for payment {paymentId}");
                
                if (payment.CustomerId.HasValue)
                {
                    var customer = await _context.Customers
                        .FirstOrDefaultAsync(c => c.Id == payment.CustomerId.Value && c.TenantId == tenantId);
                    if (customer != null)
                    {
                        customer.Balance += payment.Amount; // Reverse: customer owes more
                        customer.LastActivity = DateTime.UtcNow;
                        customer.UpdatedAt = DateTime.UtcNow;
                        Console.WriteLine($"✅ Customer {customer.Name} balance reversed to: {customer.Balance}");
                    }
                }
            }

            // Create audit log
            var auditLog = new AuditLog
            {
                OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                TenantId = tenantId, // CRITICAL: Set new TenantId
                UserId = userId,
                Action = "Payment Status Updated",
                Details = System.Text.Json.JsonSerializer.Serialize(new
                {
                    PaymentId = paymentId,
                    OldStatus = oldStatus.ToString(),
                    NewStatus = status.ToString()
                }),
                CreatedAt = DateTime.UtcNow
            };

            _context.AuditLogs.Add(auditLog);
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<PaymentDto?> UpdatePaymentAsync(int paymentId, UpdatePaymentRequest request, int userId, int tenantId)
        {
            // Add owner filter
            var payment = await _context.Payments
                .Where(p => p.Id == paymentId && p.TenantId == tenantId)
                .Include(p => p.Sale)
                .Include(p => p.Customer)
                .FirstOrDefaultAsync();
            
            if (payment == null) return null;

            var oldAmount = payment.Amount;
            var oldStatus = payment.Status;
            var wasCleared = oldStatus == PaymentStatus.CLEARED;
            var wasNonVoid = oldStatus != PaymentStatus.VOID;

            // CRITICAL FIX: Reverse old payment effects for ALL non-VOID payments
            // Since CreatePaymentAsync updates PaidAmount for ALL payment types (including PENDING cheques),
            // we must also reverse for ALL non-VOID payments when editing
            if (wasNonVoid)
            {
                // Always reverse Sale.PaidAmount for non-VOID payments
                if (payment.SaleId.HasValue)
                {
                    var sale = await _context.Sales
                        .FirstOrDefaultAsync(s => s.Id == payment.SaleId.Value && s.TenantId == tenantId);
                    if (sale != null)
                    {
                        sale.PaidAmount = Math.Max(0, sale.PaidAmount - oldAmount);
                        if (sale.PaidAmount >= sale.GrandTotal)
                            sale.PaymentStatus = SalePaymentStatus.Paid;
                        else if (sale.PaidAmount > 0)
                            sale.PaymentStatus = SalePaymentStatus.Partial;
                        else
                            sale.PaymentStatus = SalePaymentStatus.Pending;
                        Console.WriteLine($"📋 UpdatePayment: Reversed old payment. Sale {sale.InvoiceNo} PaidAmount now: {sale.PaidAmount}");
                    }
                }

                // Only reverse Customer.Balance for CLEARED payments (balance is only affected by cleared payments)
                if (wasCleared && payment.CustomerId.HasValue)
                {
                    var customer = await _context.Customers
                        .FirstOrDefaultAsync(c => c.Id == payment.CustomerId.Value && c.TenantId == tenantId);
                    if (customer != null)
                    {
                        customer.Balance += oldAmount; // Reverse: customer owes more
                    }
                }
            }

            // Update payment fields
            if (request.Amount.HasValue && request.Amount.Value > 0)
                    payment.Amount = request.Amount.Value;

            if (!string.IsNullOrEmpty(request.Mode))
            {
                if (Enum.TryParse<PaymentMode>(request.Mode, out var mode))
                        payment.Mode = mode;
            }

            if (request.Reference != null)
                    payment.Reference = request.Reference;

            if (request.PaymentDate.HasValue)
                    payment.PaymentDate = request.PaymentDate.Value;

            payment.UpdatedAt = DateTime.UtcNow;

            // Determine new status based on mode (if changed)
            if (!string.IsNullOrEmpty(request.Mode))
            {
                if (request.Mode == "CHEQUE" || request.Mode == "CREDIT")
                        payment.Status = PaymentStatus.PENDING;
                else if (request.Mode == "CASH" || request.Mode == "ONLINE")
                        payment.Status = PaymentStatus.CLEARED;
            }

            var newAmount = payment.Amount;
            var newStatus = payment.Status;
            var isNowCleared = newStatus == PaymentStatus.CLEARED;

            // CRITICAL FIX: Apply new payment effects for ALL non-VOID payments
            // Since CreatePaymentAsync updates PaidAmount for ALL payment types, we must do the same here
            var isNonVoid = newStatus != PaymentStatus.VOID;
            if (isNonVoid)
            {
                // Always update Sale.PaidAmount for non-VOID payments
                if (payment.SaleId.HasValue)
                {
                    var sale = await _context.Sales
                        .FirstOrDefaultAsync(s => s.Id == payment.SaleId.Value && s.TenantId == tenantId);
                    if (sale != null)
                    {
                        sale.PaidAmount = sale.PaidAmount + newAmount;
                        sale.LastPaymentDate = payment.PaymentDate;

                        if (sale.PaidAmount >= sale.GrandTotal)
                            sale.PaymentStatus = SalePaymentStatus.Paid;
                        else if (sale.PaidAmount > 0)
                            sale.PaymentStatus = SalePaymentStatus.Partial;
                        else
                            sale.PaymentStatus = SalePaymentStatus.Pending;
                        Console.WriteLine($"📋 UpdatePayment: Applied new payment. Sale {sale.InvoiceNo} PaidAmount now: {sale.PaidAmount}");
                    }
                }

                // Only update Customer.Balance for CLEARED payments
                if (isNowCleared && payment.CustomerId.HasValue)
                {
                    var customer = await _context.Customers
                        .FirstOrDefaultAsync(c => c.Id == payment.CustomerId.Value && c.TenantId == tenantId);
                    if (customer != null)
                    {
                        customer.Balance -= newAmount; // Customer owes less
                        customer.LastActivity = DateTime.UtcNow;
                        customer.UpdatedAt = DateTime.UtcNow;
                    }
                }
            }

            // Create audit log
            var auditLog = new AuditLog
            {
                OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                TenantId = tenantId, // CRITICAL: Set new TenantId
                UserId = userId,
                Action = "Payment Updated",
                Details = System.Text.Json.JsonSerializer.Serialize(new
                {
                    PaymentId = paymentId,
                    OldAmount = oldAmount,
                    NewAmount = newAmount,
                    OldStatus = oldStatus.ToString(),
                    NewStatus = newStatus.ToString()
                }),
                CreatedAt = DateTime.UtcNow
            };

            _context.AuditLogs.Add(auditLog);

            // CRITICAL FIX: Recalculate customer balance BEFORE SaveChangesAsync
            // This ensures balance is always accurate after payment update
            if (payment.CustomerId.HasValue)
            {
                var customerService = new HexaBill.Api.Modules.Customers.CustomerService(_context);
                var customer = await _context.Customers
                    .FirstOrDefaultAsync(c => c.Id == payment.CustomerId.Value && c.TenantId == tenantId);
                if (customer != null)
                {
                    await customerService.RecalculateCustomerBalanceAsync(payment.CustomerId.Value, customer.TenantId ?? 0);
                    Console.WriteLine($"✅ Customer balance recalculated after payment update. New balance: {customer.Balance}");
                }
            }

            await _context.SaveChangesAsync();

            return await GetPaymentByIdAsync(paymentId, tenantId);
        }

        public async Task<bool> DeletePaymentAsync(int paymentId, int userId, int tenantId)
        {
            var payment = await _context.Payments
                .Where(p => p.Id == paymentId && p.TenantId == tenantId)
                .Include(p => p.Sale)
                .Include(p => p.Customer)
                .FirstOrDefaultAsync();
            
            if (payment == null) return false;

            var wasCleared = payment.Status == PaymentStatus.CLEARED;
            var wasNonVoid = payment.Status != PaymentStatus.VOID;

            // CRITICAL FIX: Reverse payment effects for ALL non-VOID payments
            // Since CreatePaymentAsync updates PaidAmount for ALL payment types (including PENDING cheques),
            // we must also reverse for ALL non-VOID payments when deleting
            if (wasNonVoid)
            {
                // Always reverse Sale.PaidAmount for non-VOID payments
                if (payment.SaleId.HasValue)
                {
                    var sale = await _context.Sales
                        .FirstOrDefaultAsync(s => s.Id == payment.SaleId.Value && s.TenantId == tenantId);
                    if (sale != null)
                    {
                        sale.PaidAmount = Math.Max(0, sale.PaidAmount - payment.Amount);
                        // Get last payment date from remaining non-VOID payments
                        sale.LastPaymentDate = await _context.Payments
                            .Where(p => p.SaleId == sale.Id && p.Status != PaymentStatus.VOID && p.Id != paymentId)
                            .OrderByDescending(p => p.PaymentDate)
                            .Select(p => p.PaymentDate)
                            .FirstOrDefaultAsync();

                        if (sale.PaidAmount >= sale.GrandTotal)
                            sale.PaymentStatus = SalePaymentStatus.Paid;
                        else if (sale.PaidAmount > 0)
                            sale.PaymentStatus = SalePaymentStatus.Partial;
                        else
                            sale.PaymentStatus = SalePaymentStatus.Pending;
                        Console.WriteLine($"📋 DeletePayment: Reversed payment. Sale {sale.InvoiceNo} PaidAmount now: {sale.PaidAmount}, Status: {sale.PaymentStatus}");
                    }
                }

                // Only reverse Customer.Balance for CLEARED payments (balance is only affected by cleared payments)
                if (wasCleared && payment.CustomerId.HasValue)
                {
                    var customer = await _context.Customers
                        .FirstOrDefaultAsync(c => c.Id == payment.CustomerId.Value && c.TenantId == tenantId);
                    if (customer != null)
                    {
                        customer.Balance += payment.Amount; // Reverse: customer owes more
                        customer.LastActivity = DateTime.UtcNow;
                        customer.UpdatedAt = DateTime.UtcNow;
                    }
                }
            }

            // Delete idempotency records
            var idempotencies = await _context.PaymentIdempotencies
                .Where(pi => pi.PaymentId == paymentId)
                .ToListAsync();
            _context.PaymentIdempotencies.RemoveRange(idempotencies);

            // Delete payment
            _context.Payments.Remove(payment);

            // Create audit log
            var auditLog = new AuditLog
            {
                OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                TenantId = tenantId, // CRITICAL: Set new TenantId
                UserId = userId,
                Action = "Payment Deleted",
                Details = System.Text.Json.JsonSerializer.Serialize(new
                {
                    PaymentId = paymentId,
                    Amount = payment.Amount,
                    Mode = payment.Mode.ToString(),
                    Status = payment.Status.ToString(),
                    SaleId = payment.SaleId,
                    CustomerId = payment.CustomerId
                }),
                CreatedAt = DateTime.UtcNow
            };

            _context.AuditLogs.Add(auditLog);

            // CRITICAL FIX: Recalculate customer balance BEFORE SaveChangesAsync
            // This ensures balance is always accurate after payment deletion
            if (payment.CustomerId.HasValue)
            {
                var customerService = new HexaBill.Api.Modules.Customers.CustomerService(_context);
                var customer = await _context.Customers
                    .FirstOrDefaultAsync(c => c.Id == payment.CustomerId.Value && c.TenantId == tenantId);
                if (customer != null)
                {
                    await customerService.RecalculateCustomerBalanceAsync(payment.CustomerId.Value, customer.TenantId ?? 0);
                    Console.WriteLine($"✅ Customer balance recalculated after payment deletion. New balance: {customer.Balance}");
                }
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<List<Models.OutstandingInvoiceDto>> GetOutstandingInvoicesAsync(int customerId, int tenantId)
        {
            var sales = await _context.Sales
                .Where(s => s.CustomerId == customerId && s.TenantId == tenantId && !s.IsDeleted)
                .Where(s => s.PaymentStatus == SalePaymentStatus.Pending || s.PaymentStatus == SalePaymentStatus.Partial)
                .Select(s => new Models.OutstandingInvoiceDto
                {
                    Id = s.Id,
                    InvoiceNo = s.InvoiceNo,
                    InvoiceDate = s.InvoiceDate,
                    GrandTotal = s.GrandTotal,
                    PaidAmount = s.PaidAmount,
                    BalanceAmount = s.GrandTotal - s.PaidAmount,
                    PaymentStatus = s.PaymentStatus.ToString(),
                    DaysOverdue = (int)(DateTime.UtcNow - s.InvoiceDate).TotalDays
                })
                .OrderBy(s => s.InvoiceDate)
                .ToListAsync();

            return sales;
        }

        public async Task<InvoiceAmountDto> GetInvoiceAmountAsync(int invoiceId, int tenantId)
        {
            var sale = await _context.Sales
                .Where(s => s.Id == invoiceId && s.TenantId == tenantId && !s.IsDeleted)
                .FirstOrDefaultAsync();
            
            if (sale == null)
                throw new ArgumentException("Invoice not found");

            return new InvoiceAmountDto
            {
                Id = sale.Id,
                InvoiceNo = sale.InvoiceNo,
                TotalAmount = sale.GrandTotal,
                PaidAmount = sale.PaidAmount,
                OutstandingAmount = sale.GrandTotal - sale.PaidAmount,
                Status = sale.PaymentStatus.ToString()
            };
        }

        public async Task<CreatePaymentResponse> AllocatePaymentAsync(AllocatePaymentRequest request, int userId, int tenantId, string? idempotencyKey = null)
        {
            if (request.Amount <= 0)
                throw new ArgumentException("Payment amount must be greater than zero");

            if (!request.CustomerId.HasValue)
                throw new ArgumentException("Customer ID is required");

            // Check idempotency if key provided
            if (!string.IsNullOrEmpty(idempotencyKey))
            {
                var existingRequest = await _context.PaymentIdempotencies
                    .FirstOrDefaultAsync(pr => pr.IdempotencyKey == idempotencyKey);
                
                if (existingRequest != null)
                {
                    var existingPayment = await GetPaymentByIdAsync(existingRequest.PaymentId, tenantId);
                    if (existingPayment != null)
                    {
                        var sale = existingRequest.Payment?.Sale;
                        var customer = existingRequest.Payment?.Customer;
                        
                        return new CreatePaymentResponse
                        {
                            Payment = existingPayment,
                            Invoice = sale != null ? new InvoiceSummaryDto
                            {
                                Id = sale.Id,
                                InvoiceNo = sale.InvoiceNo,
                                TotalAmount = sale.GrandTotal,
                                PaidAmount = sale.PaidAmount,
                                OutstandingAmount = sale.GrandTotal - sale.PaidAmount,
                                Status = sale.PaymentStatus.ToString()
                            } : null,
                            Customer = customer != null ? new CustomerSummaryDto
                            {
                                Id = customer.Id,
                                Name = customer.Name,
                                Balance = customer.Balance
                            } : null
                        };
                    }
                }
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var customer = await _context.Customers
                    .FirstOrDefaultAsync(c => c.Id == request.CustomerId.Value && c.TenantId == tenantId);
                if (customer == null)
                    throw new ArgumentException("Customer not found");

                // Get outstanding invoices ordered by date (oldest first)
                var outstandingInvoices = await GetOutstandingInvoicesAsync(request.CustomerId.Value, tenantId);
                outstandingInvoices = outstandingInvoices.OrderBy(i => i.InvoiceDate).ToList();

                decimal remainingAmount = request.Amount;
                var allocatedPayments = new List<Payment>();

                // Allocate to invoices
                foreach (var allocation in request.Allocations ?? new List<AllocationItem>())
                {
                    if (remainingAmount <= 0) break;

                    var invoice = outstandingInvoices.FirstOrDefault(i => i.Id == allocation.InvoiceId);
                    if (invoice == null) continue;

                    var allocationAmount = Math.Min(allocation.Amount, Math.Min(remainingAmount, invoice.BalanceAmount));

                    if (allocationAmount <= 0) continue;

                    // Determine payment status
                    PaymentStatus paymentStatus;
                    if (request.Mode == "CHEQUE")
                        paymentStatus = PaymentStatus.PENDING;
                    else if (request.Mode == "CASH" || request.Mode == "ONLINE")
                        paymentStatus = PaymentStatus.CLEARED;
                    else
                        paymentStatus = PaymentStatus.PENDING;

                    // Create payment - use raw SQL to insert both old and new columns during transition
                    var modeValue = request.Mode;
                    var statusValue = paymentStatus.ToString();
                    var methodValue = modeValue; // Sync old Method column
                    var chequeStatusValue = paymentStatus switch
                    {
                        PaymentStatus.PENDING => "Pending",
                        PaymentStatus.CLEARED => "Cleared",
                        PaymentStatus.RETURNED => "Returned",
                        PaymentStatus.VOID => "Cleared",
                        _ => "Pending"
                    };

                    var paymentDate = request.PaymentDate ?? DateTime.UtcNow;
                    
                    // Create payment using EF Core (will handle Mode/Status columns)
                    var payment = new Payment
                    {
                        OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                        TenantId = tenantId, // CRITICAL: Set new TenantId
                        SaleId = allocation.InvoiceId,
                        CustomerId = request.CustomerId.Value,
                        Amount = Math.Round(allocationAmount, 2, MidpointRounding.AwayFromZero),
                        Mode = Enum.Parse<PaymentMode>(modeValue),
                        Reference = request.Reference,
                        Status = paymentStatus,
                        PaymentDate = paymentDate,
                        CreatedBy = userId,
                        CreatedAt = DateTime.UtcNow
                    };

                    _context.Payments.Add(payment);
                    await _context.SaveChangesAsync(); // Save to get ID
                    
                    allocatedPayments.Add(payment);

                    // Update invoice if payment is cleared
                    if (paymentStatus == PaymentStatus.CLEARED)
                    {
                        var sale = await _context.Sales
                            .FirstOrDefaultAsync(s => s.Id == allocation.InvoiceId && s.TenantId == tenantId);
                        if (sale != null)
                        {
                            sale.PaidAmount = Math.Round(sale.PaidAmount + allocationAmount, 2, MidpointRounding.AwayFromZero);
                            sale.LastPaymentDate = payment.PaymentDate;

                            if (sale.PaidAmount >= sale.GrandTotal)
                                sale.PaymentStatus = SalePaymentStatus.Paid;
                            else if (sale.PaidAmount > 0)
                                sale.PaymentStatus = SalePaymentStatus.Partial;
                        }
                    }

                    remainingAmount -= allocationAmount;
                }

                // CRITICAL FIX: Recalculate customer balance INSIDE transaction
                // This ensures balance is correct AND if recalculation fails, the whole transaction fails
                if (request.CustomerId.HasValue)
                {
                    var customerService = new HexaBill.Api.Modules.Customers.CustomerService(_context);
                    await customerService.RecalculateCustomerBalanceAsync(request.CustomerId.Value, customer.TenantId ?? 0);
                    Console.WriteLine($"✅ Customer balance recalculated after allocation. New balance will be available after reload.");
                }

                // Create audit log
                var auditLog = new AuditLog
                {
                    OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                    TenantId = tenantId, // CRITICAL: Set new TenantId
                    UserId = userId,
                    Action = "Bulk Payment Allocated",
                    Details = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        CustomerId = request.CustomerId,
                        TotalAmount = request.Amount,
                        Mode = request.Mode,
                        Allocations = request.Allocations
                    }),
                    CreatedAt = DateTime.UtcNow
                };

                _context.AuditLogs.Add(auditLog);

                // Save changes with optimistic concurrency check
                try
                {
                    await _context.SaveChangesAsync();
                    
                    // Create idempotency record if key provided
                    if (!string.IsNullOrEmpty(idempotencyKey) && allocatedPayments.Any())
                    {
                        var firstPayment = allocatedPayments.First();
                        var responseSnapshot = System.Text.Json.JsonSerializer.Serialize(new
                        {
                            PaymentId = firstPayment.Id,
                            CustomerId = request.CustomerId,
                            TotalAmount = request.Amount,
                            Allocations = request.Allocations
                        });
                        
                        var paymentIdempotency = new PaymentIdempotency
                        {
                            IdempotencyKey = idempotencyKey,
                            PaymentId = firstPayment.Id,
                            UserId = userId,
                            CreatedAt = DateTime.UtcNow,
                            ResponseSnapshot = responseSnapshot
                        };
                        
                        _context.PaymentIdempotencies.Add(paymentIdempotency);
                        await _context.SaveChangesAsync();
                    }
                    
                    await transaction.CommitAsync();
                }
                catch (DbUpdateConcurrencyException ex)
                {
                    await transaction.RollbackAsync();
                    throw new InvalidOperationException("Invoice was modified by another user. Please refresh and try again.", ex);
                }

                // Reload customer
                await _context.Entry(customer).ReloadAsync();

                // CRITICAL FIX: Validate allocatedPayments is not empty before accessing
                if (allocatedPayments.Count == 0)
                {
                    throw new InvalidOperationException("No payments were allocated. Please check invoice allocation criteria.");
                }

                return new CreatePaymentResponse
                {
                    Payment = await GetPaymentByIdAsync(allocatedPayments.First().Id, tenantId) ?? throw new InvalidOperationException("Failed to retrieve payment"),
                    Customer = new CustomerSummaryDto
                    {
                        Id = customer.Id,
                        Name = customer.Name,
                        Balance = customer.Balance
                    }
                };
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error allocating payment");
                throw;
            }
        }
    }

    // DTOs
    public class PaymentDto
    {
        public int Id { get; set; }
        public int? SaleId { get; set; }
        public string? InvoiceNo { get; set; }
        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public decimal Amount { get; set; }
        public string Mode { get; set; } = string.Empty;
        public string? Reference { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime PaymentDate { get; set; }
        public int CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreatePaymentRequest
    {
        public int? SaleId { get; set; }
        public int? CustomerId { get; set; }
        public decimal Amount { get; set; }
        public string Mode { get; set; } = string.Empty; // CASH, CHEQUE, ONLINE, CREDIT
        public string? Reference { get; set; }
        public DateTime? PaymentDate { get; set; }
    }

    public class UpdatePaymentRequest
    {
        public decimal? Amount { get; set; }
        public string? Mode { get; set; } // CASH, CHEQUE, ONLINE, CREDIT
        public string? Reference { get; set; }
        public DateTime? PaymentDate { get; set; }
    }

    public class CreatePaymentResponse
    {
        public PaymentDto Payment { get; set; } = null!;
        public InvoiceSummaryDto? Invoice { get; set; }
        public CustomerSummaryDto? Customer { get; set; }
    }

    public class InvoiceSummaryDto
    {
        public int Id { get; set; }
        public string InvoiceNo { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal OutstandingAmount { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public class CustomerSummaryDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal Balance { get; set; }
    }

    // OutstandingInvoiceDto moved to HexaBill.Api.Models.DTOs to avoid duplication

    public class InvoiceAmountDto
    {
        public int Id { get; set; }
        public string InvoiceNo { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal OutstandingAmount { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public class AllocatePaymentRequest
    {
        public int? CustomerId { get; set; }
        public decimal Amount { get; set; }
        public string Mode { get; set; } = string.Empty;
        public string? Reference { get; set; }
        public DateTime? PaymentDate { get; set; }
        public List<AllocationItem>? Allocations { get; set; }
    }

    public class AllocationItem
    {
        public int InvoiceId { get; set; }
        public decimal Amount { get; set; }
    }
}
