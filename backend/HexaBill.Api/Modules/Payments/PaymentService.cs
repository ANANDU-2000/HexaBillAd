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
using HexaBill.Api.Modules.Notifications;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;

namespace HexaBill.Api.Modules.Payments
{
    public interface IPaymentService
    {
        Task<bool> CheckDuplicatePaymentAsync(int tenantId, int customerId, decimal amount, DateTime paymentDate);
        Task<PagedResponse<PaymentDto>> GetPaymentsAsync(int tenantId, int page = 1, int pageSize = 10, int? saleId = null, int? customerId = null);
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

        private async Task<bool> SettlementAdjustmentsEnabledAsync(int tenantId) =>
            TenantFeatureFlags.IsEnabled(
                await _context.Tenants.AsNoTracking().Where(t => t.Id == tenantId).Select(t => t.FeaturesJson).SingleOrDefaultAsync(),
                TenantFeatureFlags.SettlementAdjustments);

        private async Task RefreshSalePaymentStateAsync(Sale sale, int tenantId, IEnumerable<Payment>? pending = null, IEnumerable<int>? omitPaymentIds = null)
        {
            var omit = omitPaymentIds?.ToHashSet();
            var lines = await _context.Payments
                .Where(p => p.SaleId == sale.Id && p.TenantId == tenantId && p.Status != PaymentStatus.VOID)
                .Where(p => omit == null || !omit.Contains(p.Id))
                .ToListAsync();
            if (pending != null)
            {
                var pendingLines = pending
                    .Where(p => p.SaleId == sale.Id && p.Status != PaymentStatus.VOID && p.Status != PaymentStatus.RETURNED)
                    .ToList();
                var pendingIds = pendingLines.Select(p => p.Id).ToHashSet();
                lines = lines.Where(l => !pendingIds.Contains(l.Id)).ToList();
                lines.AddRange(pendingLines);
            }
            var clearedCash = lines.Where(p => !p.IsSettlementAdjustment && p.Status == PaymentStatus.CLEARED).Sum(p => p.Amount);
            var clearedAdj = lines.Where(p => p.IsSettlementAdjustment && p.Status == PaymentStatus.CLEARED).Sum(p => p.Amount);
            var last = lines.Where(p => p.Status == PaymentStatus.CLEARED).OrderByDescending(p => p.PaymentDate).Select(p => (DateTime?)p.PaymentDate).FirstOrDefault();
            var (paid, status, lastDate) = SalePaymentHelpers.ComputeSalePaymentStateFromClearedAndAdjustments(clearedCash, clearedAdj, sale.GrandTotal, last);
            sale.PaidAmount = paid;
            sale.PaymentStatus = status;
            sale.LastPaymentDate = lastDate;
        }

        public async Task<bool> CheckDuplicatePaymentAsync(int tenantId, int customerId, decimal amount, DateTime paymentDate)
        {
            var dayStart = paymentDate.Date;
            var dayEnd = dayStart.AddDays(1);
            var exists = await _context.Payments
                .AnyAsync(p =>
                    p.TenantId == tenantId &&
                    p.CustomerId == customerId &&
                    Math.Abs(p.Amount - amount) < 0.01m &&
                    p.PaymentDate >= dayStart &&
                    p.PaymentDate < dayEnd);
            return exists;
        }

        public async Task<PagedResponse<PaymentDto>> GetPaymentsAsync(int tenantId, int page = 1, int pageSize = 10, int? saleId = null, int? customerId = null)
        {
            if (page < 1 || pageSize < 1 || pageSize > 1000 || customerId < 0)
                throw new ArgumentException("Use a valid page, customer and page size between 1 and 1000.");
            var query = _context.Payments
                .Where(p => p.TenantId == tenantId) // CRITICAL: Multi-tenant filter
                .Include(p => p.Sale)
                .Include(p => p.Customer)
                .Include(p => p.CreatedByUser)
                .AsQueryable();

            if (saleId.HasValue)
                query = query.Where(p => p.SaleId == saleId.Value);
            if (customerId.HasValue)
                query = customerId.Value == 0 ? query.Where(p => p.CustomerId == null)
                    : query.Where(p => p.CustomerId == customerId.Value);

            var totalCount = await query.CountAsync();
            var payments = await query
                .OrderByDescending(p => p.PaymentDate)
                .ThenByDescending(p => p.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new PaymentDto
                {
                    Id = p.Id,
                    SaleId = p.SaleId,
                    SaleReturnId = p.SaleReturnId,
                    InvoiceNo = p.Sale != null ? p.Sale.InvoiceNo : null,
                    CustomerId = p.CustomerId,
                    CustomerName = p.Customer != null ? p.Customer.Name : null,
                    Amount = p.Amount,
                    Mode = p.Mode.ToString(),
                    Reference = p.Reference,
                    Status = p.Status.ToString(),
                    PaymentDate = p.PaymentDate,
                    CreatedBy = p.CreatedBy,
                    CreatedAt = p.CreatedAt,
                    IsSettlementAdjustment = p.IsSettlementAdjustment,
                    ParentPaymentId = p.ParentPaymentId
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
                SaleReturnId = payment.SaleReturnId,
                InvoiceNo = payment.Sale?.InvoiceNo,
                CustomerId = payment.CustomerId,
                CustomerName = payment.Customer?.Name,
                Amount = payment.Amount,
                Mode = payment.Mode.ToString(),
                Reference = payment.Reference,
                Status = payment.Status.ToString(),
                PaymentDate = payment.PaymentDate,
                CreatedBy = payment.CreatedBy,
                CreatedAt = payment.CreatedAt,
                IsSettlementAdjustment = payment.IsSettlementAdjustment,
                ParentPaymentId = payment.ParentPaymentId
            };
        }

        public async Task<CreatePaymentResponse> CreatePaymentAsync(CreatePaymentRequest request, int userId, int tenantId, string? idempotencyKey = null)
        {
            var adjustmentAmount = Math.Round(request.SettlementAdjustmentAmount, 2, MidpointRounding.AwayFromZero);
            if (request.Amount <= 0 && adjustmentAmount <= 0)
                throw new ArgumentException("Payment amount must be greater than zero. Please enter a valid amount.");
            if (adjustmentAmount < 0)
                throw new ArgumentException("Settlement adjustment cannot be negative.");
            if (adjustmentAmount > 0)
            {
                if (!await SettlementAdjustmentsEnabledAsync(tenantId))
                    throw new ArgumentException("Settlement adjustments are not enabled for this workspace.");
                if (!request.SaleId.HasValue)
                    throw new ArgumentException("Settlement adjustments apply to invoice payments only.");
                if (string.IsNullOrWhiteSpace(request.SettlementAdjustmentReason) || request.SettlementAdjustmentReason.Trim().Length < 3)
                    throw new ArgumentException("A settlement adjustment requires a short reason (at least 3 characters).");
                if (adjustmentAmount > SalePaymentHelpers.MaxExplicitSettlementAdjustmentAed)
                    throw new ArgumentException($"Settlement adjustment cannot exceed {SalePaymentHelpers.MaxExplicitSettlementAdjustmentAed:F2} AED per payment.");
            }

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
                        
                        _logger.LogWarning("Duplicate payment detected (idempotency key). Key: {IdempotencyKey}", idempotencyKey);
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

            // Phase 1 Fix: Single transaction + Sale row lock (FOR UPDATE) to prevent overpayment and half-saves.
            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    Sale? invoiceSale = null;
                    if (request.SaleId.HasValue)
                    {
                        // Fix 1: Lock Sale row so two concurrent payments cannot both pass outstanding check (FOR UPDATE).
                        if (_context.Database.IsNpgsql())
                        {
                            invoiceSale = await _context.Sales
                                .FromSqlRaw(@"SELECT * FROM ""Sales"" WHERE ""Id"" = {0} AND ""TenantId"" = {1} AND NOT ""IsDeleted"" FOR UPDATE", request.SaleId.Value, tenantId)
                                .FirstOrDefaultAsync();
                        }
                        else
                        {
                            invoiceSale = await _context.Sales
                                .FirstOrDefaultAsync(s => s.Id == request.SaleId.Value && s.TenantId == tenantId && !s.IsDeleted);
                        }

                        if (invoiceSale == null)
                            throw new ArgumentException($"Invoice with ID {request.SaleId.Value} not found.");

                        if (request.CustomerId.HasValue && invoiceSale.CustomerId.HasValue && invoiceSale.CustomerId.Value != request.CustomerId.Value)
                            throw new ArgumentException($"Invoice {invoiceSale.InvoiceNo} belongs to a different customer. Expected customer ID: {invoiceSale.CustomerId.Value}, got: {request.CustomerId.Value}");

                        if (invoiceSale.CustomerId.HasValue && !request.CustomerId.HasValue)
                            request.CustomerId = invoiceSale.CustomerId;

                        var actualPaidAmount = await _context.Payments
                            .Where(p => p.SaleId == request.SaleId.Value && p.TenantId == tenantId && p.Status != PaymentStatus.VOID)
                            .SumAsync(p => p.Amount);
                        var realOutstanding = invoiceSale.GrandTotal - actualPaidAmount;

                        if (realOutstanding <= 0)
                            throw new ArgumentException($"Invoice {invoiceSale.InvoiceNo} is already fully paid. Total: {invoiceSale.GrandTotal:F2} AED, Paid: {actualPaidAmount:F2} AED. No more payments allowed.");

                        var totalIncoming = request.Amount + adjustmentAmount;
                        if (totalIncoming > realOutstanding + 0.01m)
                            throw new ArgumentException($"Cash plus adjustment ({totalIncoming:F2} AED) exceeds outstanding balance ({realOutstanding:F2} AED).");

                        if (adjustmentAmount > 0)
                        {
                            var expectedAdj = Math.Round(realOutstanding - request.Amount, 2, MidpointRounding.AwayFromZero);
                            if (Math.Abs(adjustmentAmount - expectedAdj) > 0.01m)
                                throw new ArgumentException($"Settlement adjustment must equal the remaining shortfall ({expectedAdj:F2} AED) after cash received.");
                        }

                        var recentDuplicatePayment = await _context.Payments
                            .Where(p => p.SaleId == request.SaleId.Value && p.Amount == request.Amount && p.TenantId == tenantId
                                && p.Status != PaymentStatus.VOID && p.CreatedAt >= DateTime.UtcNow.AddMinutes(-2))
                            .FirstOrDefaultAsync();
                        if (recentDuplicatePayment != null)
                            throw new ArgumentException($"A payment of {request.Amount:F2} AED was already recorded for invoice {invoiceSale.InvoiceNo} just now. Please refresh and verify before trying again.");

                        var validationResult = await _validationService.ValidatePaymentAmountAsync(request.SaleId, request.CustomerId, request.Amount, tenantId);
                        if (!validationResult.IsValid)
                            throw new ArgumentException(string.Join(" ", validationResult.Errors));
                    }
                    else if (request.CustomerId.HasValue)
                    {
                        var validationResult = await _validationService.ValidatePaymentAmountAsync(null, request.CustomerId, request.Amount, tenantId);
                        if (!validationResult.IsValid)
                            throw new ArgumentException(string.Join(" ", validationResult.Errors));
                    }

                    PaymentStatus paymentStatus = request.Mode == "CHEQUE" || request.Mode == "CREDIT"
                        ? PaymentStatus.PENDING
                        : (request.Mode == "CASH" || request.Mode == "ONLINE" ? PaymentStatus.CLEARED : PaymentStatus.PENDING);
                    var paymentMode = Enum.Parse<PaymentMode>(request.Mode);
                    var paymentDate = (request.PaymentDate ?? DateTime.UtcNow).ToUtcKind();

                    var payment = new Payment
                    {
                        OwnerId = tenantId,
                        TenantId = tenantId,
                        SaleId = request.SaleId,
                        CustomerId = request.CustomerId,
                        Amount = request.Amount,
                        Mode = paymentMode,
                        Reference = request.Reference,
                        Status = paymentStatus,
                        PaymentDate = paymentDate,
                        CreatedBy = userId,
                        CreatedAt = paymentDate,
                        UpdatedAt = paymentDate
                    };
                    _context.Payments.Add(payment);
                    Payment? adjustmentPayment = null;
                    if (adjustmentAmount > 0 && request.SaleId.HasValue)
                    {
                        await _context.SaveChangesAsync();
                        adjustmentPayment = new Payment
                        {
                            OwnerId = tenantId,
                            TenantId = tenantId,
                            SaleId = request.SaleId,
                            CustomerId = request.CustomerId,
                            Amount = adjustmentAmount,
                            Mode = PaymentMode.CASH,
                            Reference = request.SettlementAdjustmentReason!.Trim(),
                            Status = PaymentStatus.CLEARED,
                            IsSettlementAdjustment = true,
                            ParentPaymentId = payment.Id,
                            PaymentDate = paymentDate,
                            CreatedBy = userId,
                            CreatedAt = paymentDate,
                            UpdatedAt = paymentDate
                        };
                        _context.Payments.Add(adjustmentPayment);
                    }

                    if (request.SaleId.HasValue && invoiceSale != null)
                    {
                        var pending = new List<Payment> { payment };
                        if (adjustmentPayment != null) pending.Add(adjustmentPayment);
                        await RefreshSalePaymentStateAsync(invoiceSale, tenantId, pending);
                    }

                    Customer? updatedCustomer = null;
                    if (paymentStatus == PaymentStatus.CLEARED && request.CustomerId.HasValue)
                    {
                        var customer = await _context.Customers
                            .FirstOrDefaultAsync(c => c.Id == request.CustomerId.Value && c.TenantId == tenantId);
                        if (customer != null)
                        {
                            var balanceCredit = request.Amount + (adjustmentPayment != null ? adjustmentAmount : 0);
                            customer.Balance = Math.Round(customer.Balance - balanceCredit, 2, MidpointRounding.AwayFromZero);
                            customer.LastActivity = DateTime.UtcNow;
                            customer.UpdatedAt = DateTime.UtcNow;
                            updatedCustomer = customer;
                        }
                    }

                    await _context.SaveChangesAsync();

                    var auditLog = new AuditLog
                    {
                        OwnerId = tenantId,
                        TenantId = tenantId,
                        UserId = userId,
                        Action = "Payment Created",
                        Details = System.Text.Json.JsonSerializer.Serialize(new
                        {
                            PaymentId = payment.Id,
                            InvoiceId = request.SaleId,
                            CustomerId = request.CustomerId,
                            Amount = request.Amount,
                            SettlementAdjustmentAmount = adjustmentAmount,
                            Mode = request.Mode,
                            Status = paymentStatus.ToString(),
                            Reference = request.Reference,
                            SettlementAdjustmentReason = adjustmentAmount > 0 ? request.SettlementAdjustmentReason : null
                        }),
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.AuditLogs.Add(auditLog);

                    if (!string.IsNullOrEmpty(idempotencyKey))
                    {
                        _context.PaymentIdempotencies.Add(new PaymentIdempotency
                        {
                            IdempotencyKey = idempotencyKey,
                            PaymentId = payment.Id,
                            UserId = userId,
                            CreatedAt = DateTime.UtcNow,
                            ResponseSnapshot = System.Text.Json.JsonSerializer.Serialize(new { PaymentId = payment.Id, InvoiceId = request.SaleId, CustomerId = request.CustomerId, Amount = request.Amount })
                        });
                    }
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    var paymentId = payment.Id;
                    return new CreatePaymentResponse
                    {
                        Payment = await GetPaymentByIdAsync(paymentId, tenantId) ?? throw new InvalidOperationException("Failed to retrieve payment"),
                        SettlementAdjustment = adjustmentPayment != null
                            ? await GetPaymentByIdAsync(adjustmentPayment.Id, tenantId)
                            : null,
                        Invoice = invoiceSale != null ? new InvoiceSummaryDto
                        {
                            Id = invoiceSale.Id,
                            InvoiceNo = invoiceSale.InvoiceNo,
                            TotalAmount = invoiceSale.GrandTotal,
                            PaidAmount = invoiceSale.PaidAmount,
                            OutstandingAmount = invoiceSale.GrandTotal - invoiceSale.PaidAmount,
                            Status = invoiceSale.PaymentStatus.ToString()
                        } : null,
                        Customer = updatedCustomer != null ? new CustomerSummaryDto
                        {
                            Id = updatedCustomer.Id,
                            Name = updatedCustomer.Name,
                            Balance = updatedCustomer.Balance
                        } : null
                    };
                }
                catch (DbUpdateConcurrencyException ex)
                {
                    try { await transaction.RollbackAsync(); } catch { }
                    throw new InvalidOperationException("Invoice was modified by another user. Please refresh and try again.", ex);
                }
                catch (DbUpdateException ex)
                {
                    try { await transaction.RollbackAsync(); } catch { }
                    var errorMessage = ex.InnerException?.Message ?? ex.Message;
                    throw new InvalidOperationException($"Database error: {errorMessage}", ex);
                }
                catch
                {
                    try { await transaction.RollbackAsync(); } catch { }
                    throw;
                }
            });
        }

        public async Task<bool> UpdatePaymentStatusAsync(int paymentId, PaymentStatus status, int userId, int tenantId)
        {
            if (status == PaymentStatus.VOID)
                return await DeletePaymentAsync(paymentId, userId, tenantId);
            // NpgsqlRetryingExecutionStrategy requires transactions inside CreateExecutionStrategy
            return await _context.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Add owner filter to the query
                var payment = await GetPaymentForMutationAsync(paymentId, tenantId);
                
                if (payment == null)
                {
                    await transaction.RollbackAsync();
                    return false;
                }

                var oldStatus = payment.Status;
                if (oldStatus == PaymentStatus.VOID && status != PaymentStatus.VOID)
                    throw new ArgumentException("A voided payment cannot be reactivated. Record a new payment with a new request key.");
                payment.Status = status;
                payment.UpdatedAt = DateTime.UtcNow;

            if (payment.SaleId.HasValue)
            {
                var sale = await _context.Sales.FirstOrDefaultAsync(s => s.Id == payment.SaleId.Value && s.TenantId == tenantId);
                if (sale != null)
                {
                    IEnumerable<int>? omitIds = status is PaymentStatus.VOID or PaymentStatus.RETURNED ? new[] { paymentId } : null;
                    IEnumerable<Payment>? pending = omitIds == null ? new[] { payment } : null;
                    await RefreshSalePaymentStateAsync(sale, tenantId, pending, omitIds);
                }
            }

            // CRITICAL FIX: Handle status changes correctly
            // Since CreatePaymentAsync updates Sale.PaidAmount for ALL payment types (including PENDING),
            // but only updates Customer.Balance for CLEARED payments, we need to handle transitions carefully:
            // - PENDING → CLEARED: Only update Customer.Balance (PaidAmount already added)
            // - PENDING → VOID: Reverse PaidAmount only (Balance was never affected)
            // - CLEARED → VOID/RETURNED: Reverse both PaidAmount and Balance
            // - CLEARED → PENDING: Reverse Balance only (keep PaidAmount)

            // Persist payment status and sale paid state before balance aggregates query the database.
            await _context.SaveChangesAsync();

            if (oldStatus == PaymentStatus.PENDING && status == PaymentStatus.CLEARED)
            {
                if (payment.CustomerId.HasValue)
                    await _balanceService.RecalculateCustomerBalanceAsync(payment.CustomerId.Value);
            }
            else if ((status == PaymentStatus.VOID || status == PaymentStatus.RETURNED) && oldStatus != PaymentStatus.VOID)
            {
                _logger.LogInformation("Payment status change {OldStatus} to {NewStatus} for payment {PaymentId}; reversing effects", oldStatus, status, paymentId);
                if (payment.CustomerId.HasValue)
                    await _balanceService.RecalculateCustomerBalanceAsync(payment.CustomerId.Value);
            }
            else if (oldStatus == PaymentStatus.CLEARED && status == PaymentStatus.PENDING)
            {
                _logger.LogInformation("Payment status change CLEARED to PENDING for payment {PaymentId}", paymentId);
                if (payment.CustomerId.HasValue)
                    await _balanceService.RecalculateCustomerBalanceAsync(payment.CustomerId.Value);
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
                await transaction.CommitAsync();

                return true;
            }
            catch (Exception ex)
            {
                try { await transaction.RollbackAsync(); } catch { }
                _logger.LogError(ex, "Error updating payment status");
                throw;
            }
            });
        }

        public async Task<PaymentDto?> UpdatePaymentAsync(int paymentId, UpdatePaymentRequest request, int userId, int tenantId)
        {
            // NpgsqlRetryingExecutionStrategy requires transactions inside CreateExecutionStrategy
            return await _context.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Add owner filter
                var payment = await GetPaymentForMutationAsync(paymentId, tenantId);
                
                if (payment == null)
                {
                    await transaction.RollbackAsync();
                    return null;
                }

            var oldAmount = payment.Amount;
            var oldStatus = payment.Status;
            if (oldStatus == PaymentStatus.VOID)
                throw new ArgumentException("A voided payment cannot be edited. Its original details must remain in history.");
            var wasCleared = oldStatus == PaymentStatus.CLEARED;
            var oldSaleId = payment.SaleId;
            var oldInvoiceNo = payment.Sale?.InvoiceNo;

            // Reverse Customer.Balance only if old status was CLEARED (balance uses CLEARED only)
            if (wasCleared && payment.CustomerId.HasValue)
            {
                var customer = await _context.Customers
                    .FirstOrDefaultAsync(c => c.Id == payment.CustomerId.Value && c.TenantId == tenantId);
                if (customer != null)
                    customer.Balance += oldAmount;
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
                    payment.PaymentDate = request.PaymentDate.Value.ToUtcKind();

            payment.UpdatedAt = DateTime.UtcNow;

            // Determine new status based on mode (if changed)
            if (!string.IsNullOrEmpty(request.Mode))
            {
                if (request.Mode == "CHEQUE" || request.Mode == "CREDIT")
                        payment.Status = PaymentStatus.PENDING;
                else if (request.Mode == "CASH" || request.Mode == "ONLINE")
                        payment.Status = PaymentStatus.CLEARED;
            }

            // Optional invoice reassignment (entire payment moves to new sale or on-account)
            string? newInvoiceNo = oldInvoiceNo;
            if (request.ReassignSale)
            {
                if (request.SaleId.HasValue)
                {
                    var newSale = await _context.Sales
                        .FirstOrDefaultAsync(s => s.Id == request.SaleId.Value && s.TenantId == tenantId);
                    if (newSale == null)
                        throw new ArgumentException("Target invoice not found.");
                    if (payment.CustomerId.HasValue && newSale.CustomerId != payment.CustomerId.Value)
                        throw new ArgumentException("Invoice belongs to a different customer.");
                    payment.SaleId = newSale.Id;
                    newInvoiceNo = newSale.InvoiceNo;
                }
                else
                {
                    payment.SaleId = null;
                    newInvoiceNo = null;
                }
            }

            var newAmount = payment.Amount;
            var newStatus = payment.Status;
            var isNowCleared = newStatus == PaymentStatus.CLEARED;
            const decimal overpayEpsilon = 0.05m;

            if (oldSaleId.HasValue && oldSaleId != payment.SaleId)
            {
                var oldSale = await _context.Sales
                    .FirstOrDefaultAsync(s => s.Id == oldSaleId.Value && s.TenantId == tenantId);
                if (oldSale != null)
                {
                    await RefreshSalePaymentStateAsync(oldSale, tenantId, omitPaymentIds: new[] { paymentId });
                    _logger.LogInformation("UpdatePayment: Old sale {InvoiceNo} PaidAmount now {PaidAmount}", oldSale.InvoiceNo, oldSale.PaidAmount);
                }
            }

            if (payment.SaleId.HasValue)
            {
                var sale = await _context.Sales
                    .FirstOrDefaultAsync(s => s.Id == payment.SaleId.Value && s.TenantId == tenantId);
                if (sale != null)
                {
                    if (isNowCleared && !payment.IsSettlementAdjustment)
                    {
                        var otherCash = await _context.Payments
                            .Where(p => p.SaleId == sale.Id && p.TenantId == tenantId && p.Status == PaymentStatus.CLEARED
                                && p.Id != paymentId && !p.IsSettlementAdjustment)
                            .SumAsync(p => p.Amount);
                        var otherAdj = await _context.Payments
                            .Where(p => p.SaleId == sale.Id && p.TenantId == tenantId && p.Status == PaymentStatus.CLEARED
                                && p.Id != paymentId && p.IsSettlementAdjustment)
                            .SumAsync(p => p.Amount);
                        var (proposedPaid, _, _) = SalePaymentHelpers.ComputeSalePaymentStateFromClearedAndAdjustments(
                            otherCash + newAmount, otherAdj, sale.GrandTotal, null);
                        if (proposedPaid > sale.GrandTotal + overpayEpsilon)
                        {
                            throw new ArgumentException(
                                $"Payment would overpay invoice {sale.InvoiceNo}. Invoice total: {sale.GrandTotal:F2}, other cleared cash: {otherCash:F2}, this payment: {newAmount:F2}.");
                        }
                    }

                    await RefreshSalePaymentStateAsync(sale, tenantId, pending: new[] { payment });
                    _logger.LogInformation("UpdatePayment: Sale {InvoiceNo} PaidAmount now {PaidAmount}", sale.InvoiceNo, sale.PaidAmount);
                }
            }
            if (isNowCleared && payment.CustomerId.HasValue)
            {
                var customer = await _context.Customers
                    .FirstOrDefaultAsync(c => c.Id == payment.CustomerId.Value && c.TenantId == tenantId);
                if (customer != null)
                {
                    customer.Balance -= newAmount;
                    customer.LastActivity = DateTime.UtcNow;
                    customer.UpdatedAt = DateTime.UtcNow;
                }
            }

            // Create audit log only when UserId is a valid FK (avoids 500 on save for some admin sessions)
            var userExists = await _context.Users.AsNoTracking().AnyAsync(u => u.Id == userId);
            if (userExists)
            {
                var auditLog = new AuditLog
                {
                    OwnerId = tenantId,
                    TenantId = tenantId,
                    UserId = userId,
                    Action = "Payment Updated",
                    Details = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        PaymentId = paymentId,
                        OldAmount = oldAmount,
                        NewAmount = newAmount,
                        OldStatus = oldStatus.ToString(),
                        NewStatus = newStatus.ToString(),
                        ReassignSale = request.ReassignSale,
                        OldSaleId = oldSaleId,
                        NewSaleId = payment.SaleId,
                        OldInvoiceNo = oldInvoiceNo,
                        NewInvoiceNo = newInvoiceNo
                    }),
                    CreatedAt = DateTime.UtcNow
                };
                _context.AuditLogs.Add(auditLog);
            }
            else
            {
                _logger.LogWarning("UpdatePayment: skip AuditLog — UserId {UserId} not found", userId);
            }

                // Aggregate queries read stored rows, not tracked edits. Persist the edited
                // payment first; both saves remain inside this transaction.
                await _context.SaveChangesAsync();
                if (payment.CustomerId.HasValue)
                {
                    var customerService = new HexaBill.Api.Modules.Customers.CustomerService(_context);
                    var customer = await _context.Customers
                        .FirstOrDefaultAsync(c => c.Id == payment.CustomerId.Value && c.TenantId == tenantId);
                    if (customer != null)
                    {
                        await customerService.RecalculateCustomerBalanceAsync(payment.CustomerId.Value, tenantId);
                        _logger.LogInformation("Customer balance recalculated after payment update. CustomerId {CustomerId} NewBalance {Balance}", customer.Id, customer.Balance);
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return await GetPaymentByIdAsync(paymentId, tenantId);
            }
            catch (ArgumentException)
            {
                try { await transaction.RollbackAsync(); } catch { }
                throw;
            }
            catch (Exception ex)
            {
                try { await transaction.RollbackAsync(); } catch { }
                _logger.LogError(ex, "Error updating payment");
                throw;
            }
            });
        }

        // Called inside a transaction. Match creation's sale-first lock order, then reload
        // the payment under its own lock so a waiting edit/void sees the committed status.
        private async Task<Payment?> GetPaymentForMutationAsync(int paymentId, int tenantId)
        {
            IQueryable<Payment> query = _context.Payments;
            if (_context.Database.IsNpgsql())
            {
                var identity = await _context.Payments.AsNoTracking()
                    .Where(p => p.Id == paymentId && p.TenantId == tenantId)
                    .Select(p => new { p.SaleId, p.CustomerId }).FirstOrDefaultAsync();
                if (identity == null) return null;
                if (identity.SaleId.HasValue)
                    await _context.Sales.FromSqlInterpolated($"SELECT * FROM \"Sales\" WHERE \"Id\" = {identity.SaleId.Value} AND \"TenantId\" = {tenantId} FOR UPDATE")
                        .FirstOrDefaultAsync();
                if (identity.CustomerId.HasValue)
                    await _context.Customers.FromSqlInterpolated($"SELECT * FROM \"Customers\" WHERE \"Id\" = {identity.CustomerId.Value} AND \"TenantId\" = {tenantId} FOR UPDATE")
                        .FirstOrDefaultAsync();
                query = _context.Payments.FromSqlInterpolated($"SELECT * FROM \"Payments\" WHERE \"Id\" = {paymentId} AND \"TenantId\" = {tenantId} FOR UPDATE");
            }
            return await query.Where(p => p.Id == paymentId && p.TenantId == tenantId)
                .Include(p => p.Sale).Include(p => p.Customer).FirstOrDefaultAsync();
        }

        /// <summary>Legacy DELETE contract: void the posted payment without erasing its history.</summary>
        public async Task<bool> DeletePaymentAsync(int paymentId, int userId, int tenantId)
        {
            return await _context.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                await using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    var payment = await GetPaymentForMutationAsync(paymentId, tenantId);
                    if (payment == null) return false;
                    if (payment.Status == PaymentStatus.VOID) return true;

                    var affected = new List<Payment> { payment };
                    if (!payment.IsSettlementAdjustment)
                    {
                        var paired = await _context.Payments
                            .Where(p => p.TenantId == tenantId && p.IsSettlementAdjustment
                                && p.ParentPaymentId == paymentId && p.Status != PaymentStatus.VOID)
                            .ToListAsync();
                        affected.AddRange(paired);
                        // Timing/amount proximity is not evidence that an adjustment belongs to this payment.
                        // Legacy unlinked adjustments require an explicit, separately reviewed correction.
                    }
                    var oldStatus = payment.Status;
                    var now = DateTime.UtcNow;
                    foreach (var row in affected)
                    {
                        row.Status = PaymentStatus.VOID;
                        row.UpdatedAt = now;
                    }
                    if (payment.SaleId.HasValue)
                    {
                        var sale = await _context.Sales
                            .FirstOrDefaultAsync(s => s.Id == payment.SaleId && s.TenantId == tenantId);
                        if (sale != null)
                            await RefreshSalePaymentStateAsync(sale, tenantId,
                                omitPaymentIds: affected.Select(p => p.Id).ToList());
                    }
                    _context.AuditLogs.Add(new AuditLog
                    {
                        OwnerId = tenantId, TenantId = tenantId, UserId = userId,
                        Action = "Payment Voided",
                        Details = System.Text.Json.JsonSerializer.Serialize(new
                        {
                            PaymentId = paymentId, OriginalStatus = oldStatus.ToString(),
                            payment.Amount, payment.SaleId, payment.CustomerId,
                            LinkedAdjustmentIds = affected.Skip(1).Select(p => p.Id).ToArray()
                        }),
                        CreatedAt = now
                    });
                    // Keep idempotency records and original amounts/references for delayed retries and audit.
                    // Persist VOID before the balance aggregate reads the database in this transaction.
                    await _context.SaveChangesAsync();
                    if (payment.CustomerId.HasValue)
                        await new HexaBill.Api.Modules.Customers.CustomerService(_context)
                            .RecalculateCustomerBalanceAsync(payment.CustomerId.Value, tenantId);
                    await transaction.CommitAsync();
                    return true;
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            });
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

            return await _context.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
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
                    _logger.LogInformation("Customer balance recalculated after payment allocation for customer {CustomerId}", request.CustomerId);
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
                    try { await transaction.RollbackAsync(); } catch { }
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
                try { await transaction.RollbackAsync(); } catch { }
                _logger.LogError(ex, "Error allocating payment");
                throw;
            }
            });
        }
    }

    // DTOs
    public class PaymentDto
    {
        public int Id { get; set; }
        public int? SaleId { get; set; }
        public int? SaleReturnId { get; set; }
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
        public bool IsSettlementAdjustment { get; set; }
        public int? ParentPaymentId { get; set; }
    }

    public class CreatePaymentRequest
    {
        public int? SaleId { get; set; }
        public int? CustomerId { get; set; }
        public decimal Amount { get; set; }
        /// <summary>Explicit authorized shortfall (not cash). Requires <see cref="SettlementAdjustmentReason"/> and tenant flag.</summary>
        public decimal SettlementAdjustmentAmount { get; set; }
        public string? SettlementAdjustmentReason { get; set; }
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
        /// <summary>When true, set payment.SaleId to SaleId (null = on-account). When false, leave SaleId unchanged.</summary>
        public bool ReassignSale { get; set; }
        public int? SaleId { get; set; }
    }

    public class CreatePaymentResponse
    {
        public PaymentDto Payment { get; set; } = null!;
        public PaymentDto? SettlementAdjustment { get; set; }
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
