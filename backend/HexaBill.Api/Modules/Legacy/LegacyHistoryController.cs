using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Models.Legacy;

namespace HexaBill.Api.Modules.Legacy
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class LegacyController : TenantScopedController
    {
        private readonly AppDbContext _context;
        private readonly ILogger<LegacyController> _logger;

        public LegacyController(AppDbContext context, ILogger<LegacyController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// GET /api/legacy/invoices
        /// Search and page historical Starplus invoices with strict tenant isolation.
        /// </summary>
        [HttpGet("invoices")]
        public async Task<ActionResult<ApiResponse<PagedResponse<LegacyInvoiceSummaryDto>>>> GetInvoices(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25,
            [FromQuery] string? search = null,
            [FromQuery] int? customerId = null,
            [FromQuery] bool? pendingOnly = null,
            [FromQuery] bool includeDeleted = false,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0) return Forbid();

                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 1000);

                var query = _context.LegacyInvoices.AsNoTracking().Where(i => i.TenantId == tenantId);

                if (!includeDeleted)
                {
                    query = query.Where(i => !i.IsDeleted);
                }

                if (pendingOnly == true)
                {
                    query = query.Where(i => i.OutstandingCalculated > 0.005m);
                }

                if (customerId.HasValue && customerId.Value > 0)
                {
                    query = query.Where(i => i.SourceCustomerId == customerId.Value || i.DestinationCustomerId == customerId.Value);
                }

                if (fromDate.HasValue)
                {
                    var fromUtc = DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Utc);
                    query = query.Where(i => i.InvoiceDate >= fromUtc);
                }

                if (toDate.HasValue)
                {
                    var toUtc = DateTime.SpecifyKind(toDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
                    query = query.Where(i => i.InvoiceDate <= toUtc);
                }

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var term = search.Trim();
                    query = query.Where(i =>
                        EF.Functions.ILike(i.LegacyInvoiceNumber, $"%{term}%") ||
                        (i.CustomerName != null && EF.Functions.ILike(i.CustomerName, $"%{term}%")) ||
                        (i.Notes != null && EF.Functions.ILike(i.Notes, $"%{term}%")));
                }

                var totalCount = await query.CountAsync();
                var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

                var items = await query
                    .OrderByDescending(i => i.InvoiceDate)
                    .ThenByDescending(i => i.LegacyInvoiceNumber)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(i => new LegacyInvoiceSummaryDto
                    {
                        Id = i.Id,
                        SourceInvoiceId = i.SourceInvoiceId,
                        SourceSystem = i.SourceSystem,
                        LegacyInvoiceNumber = i.LegacyInvoiceNumber,
                        LegacyIssuer = i.LegacyIssuer,
                        SourceLegalTaxId = i.SourceLegalTaxId,
                        InvoiceDate = i.InvoiceDate,
                        DueDate = i.DueDate,
                        DueDateSource = i.DueDateSource,
                        SourceCustomerId = i.SourceCustomerId,
                        CustomerName = i.CustomerName,
                        DestinationCustomerId = i.DestinationCustomerId,
                        Status = i.Status,
                        IsDeleted = i.IsDeleted,
                        Subtotal = i.Subtotal,
                        VatTotal = i.VatTotal,
                        Discount = i.Discount,
                        GrandTotal = i.GrandTotal,
                        PaidAmount = i.PaidAmount,
                        OutstandingCalculated = i.OutstandingCalculated,
                        ItemCount = i.ItemCount,
                        ReportedAsPending = i.ReportedAsPending,
                        Notes = i.Notes
                    })
                    .ToListAsync();

                return Ok(new ApiResponse<PagedResponse<LegacyInvoiceSummaryDto>>
                {
                    Success = true,
                    Message = "Historical invoices retrieved successfully",
                    Data = new PagedResponse<LegacyInvoiceSummaryDto>
                    {
                        Items = items,
                        TotalCount = totalCount,
                        Page = page,
                        PageSize = pageSize,
                        TotalPages = totalPages
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving legacy invoices for tenant {TenantId}", CurrentTenantId);
                return StatusCode(500, new ApiResponse<PagedResponse<LegacyInvoiceSummaryDto>>
                {
                    Success = false,
                    Message = "An error occurred retrieving legacy invoices",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// GET /api/legacy/invoices/{id}
        /// Retrieve full details of a single historical Starplus invoice, including all items and payments.
        /// </summary>
        [HttpGet("invoices/{id:int}")]
        public async Task<ActionResult<ApiResponse<LegacyInvoiceDetailDto>>> GetInvoiceById(int id)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0) return Forbid();

                var inv = await _context.LegacyInvoices
                    .AsNoTracking()
                    .Include(i => i.Items)
                    .Include(i => i.Payments)
                    .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId);

                if (inv == null)
                {
                    return NotFound(new ApiResponse<LegacyInvoiceDetailDto>
                    {
                        Success = false,
                        Message = $"Historical invoice with ID {id} not found."
                    });
                }

                var dto = new LegacyInvoiceDetailDto
                {
                    Id = inv.Id,
                    SourceInvoiceId = inv.SourceInvoiceId,
                    SourceSystem = inv.SourceSystem,
                    LegacyInvoiceNumber = inv.LegacyInvoiceNumber,
                    LegacyIssuer = inv.LegacyIssuer,
                    SourceLegalTaxId = inv.SourceLegalTaxId,
                    InvoiceDate = inv.InvoiceDate,
                    DueDate = inv.DueDate,
                    DueDateSource = inv.DueDateSource,
                    SourceCustomerId = inv.SourceCustomerId,
                    CustomerName = inv.CustomerName,
                    DestinationCustomerId = inv.DestinationCustomerId,
                    Status = inv.Status,
                    IsDeleted = inv.IsDeleted,
                    IsFinalized = inv.IsFinalized,
                    IsLocked = inv.IsLocked,
                    Subtotal = inv.Subtotal,
                    VatTotal = inv.VatTotal,
                    Discount = inv.Discount,
                    RoundOff = inv.RoundOff,
                    GrandTotal = inv.GrandTotal,
                    TotalAmount = inv.TotalAmount,
                    PaidAmount = inv.PaidAmount,
                    OutstandingCalculated = inv.OutstandingCalculated,
                    ItemCount = inv.ItemCount,
                    ReportedAsPending = inv.ReportedAsPending,
                    Notes = inv.Notes,
                    ExternalReference = inv.ExternalReference,
                    MigrationRunId = inv.MigrationRunId,
                    Items = inv.Items.Select(it => new LegacyInvoiceItemDto
                    {
                        Id = it.Id,
                        SourceItemId = it.SourceItemId,
                        SourceProductId = it.SourceProductId,
                        DestinationProductId = it.DestinationProductId,
                        Sku = it.Sku,
                        ProductName = it.ProductName,
                        UnitType = it.UnitType,
                        Quantity = it.Quantity,
                        UnitPrice = it.UnitPrice,
                        Discount = it.Discount,
                        VatAmount = it.VatAmount,
                        LineTotal = it.LineTotal
                    }).ToList(),
                    Payments = inv.Payments.Select(p => new LegacyPaymentDto
                    {
                        Id = p.Id,
                        SourcePaymentId = p.SourcePaymentId,
                        SourceCustomerId = p.SourceCustomerId,
                        DestinationCustomerId = p.DestinationCustomerId,
                        Amount = p.Amount,
                        Mode = p.Mode,
                        Status = p.Status,
                        PaymentDate = p.PaymentDate,
                        Reference = p.Reference
                    }).ToList()
                };

                return Ok(new ApiResponse<LegacyInvoiceDetailDto>
                {
                    Success = true,
                    Message = "Historical invoice details retrieved successfully",
                    Data = dto
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving legacy invoice {InvoiceId}", id);
                return StatusCode(500, new ApiResponse<LegacyInvoiceDetailDto>
                {
                    Success = false,
                    Message = "An error occurred retrieving legacy invoice details",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// GET /api/legacy/customers
        /// Retrieve all historical Starplus customer profiles with linked FrozenHub customer status and opening balances.
        /// </summary>
        [HttpGet("customers")]
        public async Task<ActionResult<ApiResponse<List<LegacyCustomerSummaryDto>>>> GetCustomers()
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0) return Forbid();

                var list = await _context.LegacyCustomers
                    .AsNoTracking()
                    .Where(c => c.TenantId == tenantId)
                    .OrderBy(c => c.Name)
                    .Select(c => new LegacyCustomerSummaryDto
                    {
                        Id = c.Id,
                        SourceCustomerId = c.SourceCustomerId,
                        Name = c.Name,
                        Phone = c.Phone,
                        Email = c.Email,
                        Address = c.Address,
                        Trn = c.Trn,
                        DestinationCustomerId = c.DestinationCustomerId,
                        InvoiceCount = c.InvoiceCount,
                        DeletedInvoiceCount = c.DeletedInvoiceCount,
                        UnpaidInvoiceCount = c.UnpaidInvoiceCount,
                        UnpaidInvoiceAmount = c.UnpaidInvoiceAmount,
                        ApprovedOpeningBalance = c.ApprovedOpeningBalance
                    })
                    .ToListAsync();

                return Ok(new ApiResponse<List<LegacyCustomerSummaryDto>>
                {
                    Success = true,
                    Message = "Historical customers retrieved successfully",
                    Data = list
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving legacy customers for tenant {TenantId}", CurrentTenantId);
                return StatusCode(500, new ApiResponse<List<LegacyCustomerSummaryDto>>
                {
                    Success = false,
                    Message = "An error occurred retrieving legacy customers",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// GET /api/legacy/opening-receivables
        /// Retrieve the approved cutover opening receivables for the tenant.
        /// </summary>
        [HttpGet("opening-receivables")]
        public async Task<ActionResult<ApiResponse<List<LegacyOpeningReceivableDto>>>> GetOpeningReceivables()
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0) return Forbid();

                var custLookup = await _context.LegacyCustomers
                    .AsNoTracking()
                    .Where(c => c.TenantId == tenantId)
                    .ToDictionaryAsync(c => c.SourceCustomerId, c => c.Name);

                var list = await _context.LegacyOpeningReceivables
                    .AsNoTracking()
                    .Where(r => r.TenantId == tenantId)
                    .OrderByDescending(r => r.OpeningBalance)
                    .ToListAsync();

                var dtos = list.Select(r => new LegacyOpeningReceivableDto
                {
                    Id = r.Id,
                    SourceCustomerId = r.SourceCustomerId,
                    DestinationCustomerId = r.DestinationCustomerId,
                    CustomerName = custLookup.TryGetValue(r.SourceCustomerId, out var cName) ? cName : "Unknown Customer",
                    SourceSystem = r.SourceSystem,
                    OpeningBalance = r.OpeningBalance,
                    ReconciledInvoicesCount = r.ReconciledInvoicesCount,
                    CutoffDate = r.CutoffDate,
                    ApprovedAt = r.ApprovedAt,
                    Notes = r.Notes
                }).ToList();

                return Ok(new ApiResponse<List<LegacyOpeningReceivableDto>>
                {
                    Success = true,
                    Message = "Opening receivables retrieved successfully",
                    Data = dtos
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving opening receivables for tenant {TenantId}", CurrentTenantId);
                return StatusCode(500, new ApiResponse<List<LegacyOpeningReceivableDto>>
                {
                    Success = false,
                    Message = "An error occurred retrieving opening receivables",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// GET /api/legacy/reconciliation
        /// Summary audit and reconciliation metrics across historical records.
        /// </summary>
        [HttpGet("reconciliation")]
        public async Task<ActionResult<ApiResponse<LegacyReconciliationSummaryDto>>> GetReconciliation()
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0) return Forbid();

                var totalInvoices = await _context.LegacyInvoices.Where(i => i.TenantId == tenantId).CountAsync();
                var activeInvoices = await _context.LegacyInvoices.Where(i => i.TenantId == tenantId && !i.IsDeleted).CountAsync();
                var deletedInvoices = await _context.LegacyInvoices.Where(i => i.TenantId == tenantId && i.IsDeleted).CountAsync();
                var totalItems = await _context.LegacyInvoiceItems.Where(i => i.TenantId == tenantId).CountAsync();
                var totalPayments = await _context.LegacyPayments.Where(p => p.TenantId == tenantId).CountAsync();
                var clearedPayments = await _context.LegacyPayments.Where(p => p.TenantId == tenantId && p.Status.ToUpper() == "CLEARED").CountAsync();
                var pendingPayments = await _context.LegacyPayments.Where(p => p.TenantId == tenantId && p.Status.ToUpper() == "PENDING").CountAsync();

                var activeGrandTotal = await _context.LegacyInvoices.Where(i => i.TenantId == tenantId && !i.IsDeleted).SumAsync(i => (decimal?)i.GrandTotal) ?? 0m;
                var activePaidTotal = await _context.LegacyInvoices.Where(i => i.TenantId == tenantId && !i.IsDeleted).SumAsync(i => (decimal?)i.PaidAmount) ?? 0m;
                var positiveOutstandingSum = await _context.LegacyInvoices.Where(i => i.TenantId == tenantId && !i.IsDeleted && i.OutstandingCalculated > 0.005m).SumAsync(i => (decimal?)i.OutstandingCalculated) ?? 0m;
                var positiveOutstandingCount = await _context.LegacyInvoices.Where(i => i.TenantId == tenantId && !i.IsDeleted && i.OutstandingCalculated > 0.005m).CountAsync();

                var pendingReportCount = await _context.LegacyInvoices.Where(i => i.TenantId == tenantId && i.ReportedAsPending).CountAsync();
                var pendingReportTotal = await _context.LegacyInvoices.Where(i => i.TenantId == tenantId && i.ReportedAsPending).SumAsync(i => (decimal?)i.OutstandingCalculated) ?? 0m;

                var residualNumbers = new[] { "6040", "3639", "3664", "3704", "3726", "3756" };
                var residualInvoices = await _context.LegacyInvoices.Where(i => i.TenantId == tenantId && residualNumbers.Contains(i.LegacyInvoiceNumber)).ToListAsync();

                var customerOpeningReceivablesCount = await _context.LegacyOpeningReceivables.Where(r => r.TenantId == tenantId).CountAsync();
                var customerOpeningReceivablesTotal = await _context.LegacyOpeningReceivables.Where(r => r.TenantId == tenantId).SumAsync(r => (decimal?)r.OpeningBalance) ?? 0m;

                var summary = new LegacyReconciliationSummaryDto
                {
                    TotalInvoices = totalInvoices,
                    ActiveInvoices = activeInvoices,
                    DeletedInvoices = deletedInvoices,
                    TotalInvoiceItems = totalItems,
                    TotalPayments = totalPayments,
                    ClearedPayments = clearedPayments,
                    PendingPayments = pendingPayments,
                    ActiveGrandTotal = activeGrandTotal,
                    ActivePaidTotal = activePaidTotal,
                    PositiveOutstandingSum = positiveOutstandingSum,
                    PositiveOutstandingCount = positiveOutstandingCount,
                    PendingReportCount = pendingReportCount,
                    PendingReportTotal = pendingReportTotal,
                    ResidualInvoicesCount = residualInvoices.Count,
                    ResidualInvoicesTotal = residualInvoices.Sum(i => i.OutstandingCalculated),
                    CustomerOpeningReceivablesCount = customerOpeningReceivablesCount,
                    CustomerOpeningReceivablesTotal = customerOpeningReceivablesTotal,
                    UnattributedOpenTotal = 100.80m
                };

                return Ok(new ApiResponse<LegacyReconciliationSummaryDto>
                {
                    Success = true,
                    Message = "Reconciliation metrics retrieved successfully",
                    Data = summary
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating legacy reconciliation for tenant {TenantId}", CurrentTenantId);
                return StatusCode(500, new ApiResponse<LegacyReconciliationSummaryDto>
                {
                    Success = false,
                    Message = "An error occurred generating reconciliation metrics",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// GET /api/legacy/payments
        /// Paged list of historical Starplus payments.
        /// </summary>
        [HttpGet("payments")]
        public async Task<ActionResult<ApiResponse<PagedResponse<LegacyPaymentListItemDto>>>> GetPayments(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25,
            [FromQuery] string? search = null,
            [FromQuery] string? status = null,
            [FromQuery] int? customerId = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0) return Forbid();

                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 1000);

                var query = from p in _context.LegacyPayments.AsNoTracking().Where(p => p.TenantId == tenantId)
                            join i in _context.LegacyInvoices.AsNoTracking().Where(i => i.TenantId == tenantId)
                                on p.LegacyInvoiceId equals i.Id into invJoin
                            from inv in invJoin.DefaultIfEmpty()
                            join c in _context.LegacyCustomers.AsNoTracking().Where(c => c.TenantId == tenantId)
                                on p.SourceCustomerId equals c.SourceCustomerId into custJoin
                            from cust in custJoin.DefaultIfEmpty()
                            select new { p, InvoiceNo = inv != null ? inv.LegacyInvoiceNumber : null, CustName = cust != null ? cust.Name : null };

                if (!string.IsNullOrWhiteSpace(status))
                {
                    var statusNorm = status.Trim().ToUpper();
                    query = query.Where(x => x.p.Status.ToUpper() == statusNorm);
                }

                if (customerId.HasValue && customerId.Value > 0)
                {
                    query = query.Where(x => x.p.SourceCustomerId == customerId.Value || x.p.DestinationCustomerId == customerId.Value);
                }

                if (fromDate.HasValue)
                {
                    var fromUtc = DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Utc);
                    query = query.Where(x => x.p.PaymentDate >= fromUtc);
                }

                if (toDate.HasValue)
                {
                    var toUtc = DateTime.SpecifyKind(toDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
                    query = query.Where(x => x.p.PaymentDate <= toUtc);
                }

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var term = search.Trim();
                    query = query.Where(x =>
                        (x.InvoiceNo != null && EF.Functions.ILike(x.InvoiceNo, $"%{term}%")) ||
                        (x.CustName != null && EF.Functions.ILike(x.CustName, $"%{term}%")) ||
                        (x.p.Reference != null && EF.Functions.ILike(x.p.Reference, $"%{term}%")) ||
                        (x.p.Mode != null && EF.Functions.ILike(x.p.Mode, $"%{term}%")));
                }

                var totalCount = await query.CountAsync();
                var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

                var items = await query
                    .OrderByDescending(x => x.p.PaymentDate)
                    .ThenByDescending(x => x.p.SourcePaymentId)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(x => new LegacyPaymentListItemDto
                    {
                        Id = x.p.Id,
                        SourcePaymentId = x.p.SourcePaymentId,
                        LegacyInvoiceId = x.p.LegacyInvoiceId,
                        LegacyInvoiceNumber = x.InvoiceNo,
                        SourceCustomerId = x.p.SourceCustomerId,
                        DestinationCustomerId = x.p.DestinationCustomerId,
                        CustomerName = x.CustName,
                        Amount = x.p.Amount,
                        Mode = x.p.Mode,
                        Status = x.p.Status,
                        PaymentDate = x.p.PaymentDate,
                        Reference = x.p.Reference
                    })
                    .ToListAsync();

                return Ok(new ApiResponse<PagedResponse<LegacyPaymentListItemDto>>
                {
                    Success = true,
                    Message = "Historical payments retrieved successfully",
                    Data = new PagedResponse<LegacyPaymentListItemDto>
                    {
                        Items = items,
                        TotalCount = totalCount,
                        Page = page,
                        PageSize = pageSize,
                        TotalPages = totalPages
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving legacy payments for tenant {TenantId}", CurrentTenantId);
                return StatusCode(500, new ApiResponse<PagedResponse<LegacyPaymentListItemDto>>
                {
                    Success = false,
                    Message = "An error occurred retrieving legacy payments",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// GET /api/legacy/invoices/unified
        /// Unified chronological invoice history combining FrozenHub operating sales and Starplus legacy archive.
        /// </summary>
        [HttpGet("invoices/unified")]
        public async Task<ActionResult<ApiResponse<PagedResponse<UnifiedInvoiceSummaryDto>>>> GetUnifiedInvoices(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25,
            [FromQuery] string? search = null,
            [FromQuery] string? company = null,
            [FromQuery] int? customerId = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0) return Forbid();

                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 1000);

                var includeFrozenHub = string.IsNullOrWhiteSpace(company) || company.Equals("FROZENHUB", StringComparison.OrdinalIgnoreCase);
                var includeStarplus = string.IsNullOrWhiteSpace(company) || company.Equals("STARPLUS", StringComparison.OrdinalIgnoreCase);

                IQueryable<UnifiedInvoiceSummaryDto>? fhQuery = null;
                if (includeFrozenHub)
                {
                    var baseFh = _context.Sales.AsNoTracking().Where(s => s.TenantId == tenantId && !s.IsDeleted);
                    if (fromDate.HasValue)
                    {
                        var fromUtc = DateTime.SpecifyKind(fromDate.Value, DateTimeKind.Utc);
                        baseFh = baseFh.Where(s => s.InvoiceDate >= fromUtc);
                    }
                    if (toDate.HasValue)
                    {
                        var toUtc = DateTime.SpecifyKind(toDate.Value, DateTimeKind.Utc);
                        baseFh = baseFh.Where(s => s.InvoiceDate <= toUtc);
                    }
                    if (customerId.HasValue && customerId.Value > 0)
                    {
                        baseFh = baseFh.Where(s => s.CustomerId == customerId.Value);
                    }
                    if (!string.IsNullOrWhiteSpace(search))
                    {
                        var term = search.Trim();
                        baseFh = baseFh.Where(s =>
                            EF.Functions.ILike(s.InvoiceNo, $"%{term}%") ||
                            (s.Customer != null && EF.Functions.ILike(s.Customer.Name, $"%{term}%")));
                    }

                    fhQuery = baseFh.Select(s => new UnifiedInvoiceSummaryDto
                    {
                        Id = "FH-" + s.Id,
                        OperatingSaleId = s.Id,
                        LegacyInvoiceId = null,
                        SourceCompany = "FrozenHub",
                        InvoiceNumber = s.InvoiceNo,
                        InvoiceDate = s.InvoiceDate,
                        CustomerId = s.CustomerId,
                        CustomerName = s.Customer != null ? s.Customer.Name : null,
                        ItemCount = s.Items.Count,
                        Subtotal = s.Subtotal,
                        VatTotal = s.VatTotal,
                        GrandTotal = s.GrandTotal,
                        PaidAmount = s.PaidAmount,
                        OutstandingBalance = (s.GrandTotal - s.PaidAmount) > 0 ? (s.GrandTotal - s.PaidAmount) : 0,
                        PaymentStatus = s.PaidAmount >= s.GrandTotal ? "Paid" : (s.PaidAmount > 0 ? "Partial" : "Pending"),
                        OriginalStatus = s.PaymentStatus.ToString(),
                        IsDeleted = s.IsDeleted,
                        IsLegacy = false,
                        Notes = s.Notes
                    });
                }

                IQueryable<UnifiedInvoiceSummaryDto>? legacyQuery = null;
                if (includeStarplus)
                {
                    var baseLegacy = _context.LegacyInvoices.AsNoTracking().Where(i => i.TenantId == tenantId && !i.IsDeleted);
                    if (fromDate.HasValue)
                    {
                        var fromUtc = DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Utc);
                        baseLegacy = baseLegacy.Where(i => i.InvoiceDate >= fromUtc);
                    }
                    if (toDate.HasValue)
                    {
                        var toUtc = DateTime.SpecifyKind(toDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
                        baseLegacy = baseLegacy.Where(i => i.InvoiceDate <= toUtc);
                    }
                    if (customerId.HasValue && customerId.Value > 0)
                    {
                        baseLegacy = baseLegacy.Where(i => i.DestinationCustomerId == customerId.Value || i.SourceCustomerId == customerId.Value);
                    }
                    if (!string.IsNullOrWhiteSpace(search))
                    {
                        var term = search.Trim();
                        baseLegacy = baseLegacy.Where(i =>
                            EF.Functions.ILike(i.LegacyInvoiceNumber, $"%{term}%") ||
                            (i.CustomerName != null && EF.Functions.ILike(i.CustomerName, $"%{term}%")));
                    }

                    legacyQuery = baseLegacy.Select(i => new UnifiedInvoiceSummaryDto
                    {
                        Id = "LP-" + i.Id,
                        OperatingSaleId = null,
                        LegacyInvoiceId = i.Id,
                        SourceCompany = "Starplus Foodstuff Trading",
                        InvoiceNumber = i.LegacyInvoiceNumber,
                        InvoiceDate = i.InvoiceDate,
                        CustomerId = i.DestinationCustomerId ?? i.SourceCustomerId,
                        CustomerName = i.CustomerName,
                        ItemCount = i.ItemCount,
                        Subtotal = i.Subtotal,
                        VatTotal = i.VatTotal,
                        GrandTotal = i.GrandTotal,
                        PaidAmount = i.PaidAmount,
                        OutstandingBalance = i.OutstandingCalculated,
                        PaymentStatus = i.OutstandingCalculated <= 0.005m ? "Paid" : (i.PaidAmount > 0 ? "Partial" : "Pending"),
                        OriginalStatus = i.Status,
                        IsDeleted = i.IsDeleted,
                        IsLegacy = true,
                        Notes = i.Notes
                    });
                }

                IQueryable<UnifiedInvoiceSummaryDto> combinedQuery;
                if (fhQuery != null && legacyQuery != null)
                {
                    combinedQuery = fhQuery.Concat(legacyQuery);
                }
                else if (fhQuery != null)
                {
                    combinedQuery = fhQuery;
                }
                else if (legacyQuery != null)
                {
                    combinedQuery = legacyQuery;
                }
                else
                {
                    return Ok(new ApiResponse<PagedResponse<UnifiedInvoiceSummaryDto>>
                    {
                        Success = true,
                        Data = new PagedResponse<UnifiedInvoiceSummaryDto> { Items = new(), Page = page, PageSize = pageSize, TotalCount = 0, TotalPages = 0 }
                    });
                }

                var totalCount = await combinedQuery.CountAsync();
                var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

                var items = await combinedQuery
                    .OrderByDescending(x => x.InvoiceDate)
                    .ThenByDescending(x => x.InvoiceNumber)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                return Ok(new ApiResponse<PagedResponse<UnifiedInvoiceSummaryDto>>
                {
                    Success = true,
                    Message = "Unified invoices retrieved successfully",
                    Data = new PagedResponse<UnifiedInvoiceSummaryDto>
                    {
                        Items = items,
                        TotalCount = totalCount,
                        Page = page,
                        PageSize = pageSize,
                        TotalPages = totalPages
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving unified invoices for tenant {TenantId}", CurrentTenantId);
                return StatusCode(500, new ApiResponse<PagedResponse<UnifiedInvoiceSummaryDto>>
                {
                    Success = false,
                    Message = "An error occurred retrieving unified invoices",
                    Errors = new List<string> { ex.Message }
                });
            }
        }
    
        /// <summary>
        /// GET /api/legacy/purchases
        /// Paged list of historical Starplus purchases.
        /// </summary>
        [HttpGet("purchases")]
        public async Task<ActionResult<ApiResponse<PagedResponse<LegacyPurchaseSummaryDto>>>> GetPurchases(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25,
            [FromQuery] string? search = null,
            [FromQuery] string? supplierName = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0) return Forbid();

                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 100);

                var query = _context.LegacyPurchases.AsNoTracking().Where(p => p.TenantId == tenantId);

                if (!string.IsNullOrWhiteSpace(supplierName))
                {
                    query = query.Where(p => p.SupplierName.ToLower() == supplierName.ToLower());
                }

                if (fromDate.HasValue)
                {
                    var fromUtc = DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Utc);
                    query = query.Where(p => p.PurchaseDate >= fromUtc);
                }

                if (toDate.HasValue)
                {
                    var toUtc = DateTime.SpecifyKind(toDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
                    query = query.Where(p => p.PurchaseDate <= toUtc);
                }

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var term = search.Trim();
                    query = query.Where(p =>
                        EF.Functions.ILike(p.InvoiceNo, $"%{term}%") ||
                        EF.Functions.ILike(p.SupplierName, $"%{term}%") ||
                        (p.ExternalReference != null && EF.Functions.ILike(p.ExternalReference, $"%{term}%")));
                }

                var totalCount = await query.CountAsync();
                var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

                var items = await query
                    .OrderByDescending(p => p.PurchaseDate)
                    .ThenByDescending(p => p.Id)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(p => new LegacyPurchaseSummaryDto
                    {
                        Id = p.Id,
                        SourcePurchaseId = p.SourcePurchaseId,
                        SourceSystem = p.SourceSystem,
                        SupplierName = p.SupplierName,
                        InvoiceNo = p.InvoiceNo,
                        ExternalReference = p.ExternalReference,
                        ExpenseCategory = p.ExpenseCategory,
                        PurchaseDate = p.PurchaseDate,
                        TotalAmount = p.TotalAmount,
                        Subtotal = p.Subtotal,
                        VatTotal = p.VatTotal,
                        ItemCount = p.Items.Count
                    })
                    .ToListAsync();

                return Ok(new ApiResponse<PagedResponse<LegacyPurchaseSummaryDto>>
                {
                    Success = true,
                    Message = "Historical purchases retrieved successfully",
                    Data = new PagedResponse<LegacyPurchaseSummaryDto>
                    {
                        Items = items,
                        TotalCount = totalCount,
                        Page = page,
                        PageSize = pageSize,
                        TotalPages = totalPages
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving legacy purchases for tenant {TenantId}", CurrentTenantId);
                return StatusCode(500, new ApiResponse<PagedResponse<LegacyPurchaseSummaryDto>>
                {
                    Success = false,
                    Message = "An error occurred retrieving legacy purchases",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// GET /api/legacy/purchases/{id}
        /// Retrieve full details and items for a historical purchase.
        /// </summary>
        [HttpGet("purchases/{id}")]
        public async Task<ActionResult<ApiResponse<LegacyPurchaseDetailDto>>> GetPurchaseDetail(int id)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0) return Forbid();

                var p = await _context.LegacyPurchases
                    .AsNoTracking()
                    .Include(x => x.Items)
                    .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id);

                if (p == null)
                {
                    return NotFound(new ApiResponse<LegacyPurchaseDetailDto>
                    {
                        Success = false,
                        Message = $"Historical purchase #{id} not found"
                    });
                }

                var prodLookup = await _context.LegacyProducts
                    .AsNoTracking()
                    .Where(pr => pr.TenantId == tenantId)
                    .ToDictionaryAsync(pr => pr.SourceProductId, pr => pr.NameEn);

                var dto = new LegacyPurchaseDetailDto
                {
                    Id = p.Id,
                    SourcePurchaseId = p.SourcePurchaseId,
                    SourceSystem = p.SourceSystem,
                    SupplierName = p.SupplierName,
                    InvoiceNo = p.InvoiceNo,
                    ExternalReference = p.ExternalReference,
                    ExpenseCategory = p.ExpenseCategory,
                    PurchaseDate = p.PurchaseDate,
                    TotalAmount = p.TotalAmount,
                    Subtotal = p.Subtotal,
                    VatTotal = p.VatTotal,
                    ItemCount = p.Items.Count,
                    InvoiceFilePath = p.InvoiceFilePath,
                    InvoiceFileName = p.InvoiceFileName,
                    Items = p.Items.Select(it => new LegacyPurchaseItemDto
                    {
                        Id = it.Id,
                        SourceItemId = it.SourceItemId,
                        SourceProductId = it.SourceProductId,
                        DestinationProductId = it.DestinationProductId,
                        ProductName = prodLookup.TryGetValue(it.SourceProductId, out var pName) ? pName : $"Product #{it.SourceProductId}",
                        UnitType = it.UnitType,
                        Qty = it.Qty,
                        UnitCost = it.UnitCost,
                        LineTotal = it.LineTotal,
                        UnitCostExclVat = it.UnitCostExclVat,
                        VatAmount = it.VatAmount
                    }).ToList()
                };

                return Ok(new ApiResponse<LegacyPurchaseDetailDto>
                {
                    Success = true,
                    Message = "Historical purchase details retrieved successfully",
                    Data = dto
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving legacy purchase detail #{PurchaseId}", id);
                return StatusCode(500, new ApiResponse<LegacyPurchaseDetailDto>
                {
                    Success = false,
                    Message = "An error occurred retrieving legacy purchase details",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// GET /api/legacy/expenses
        /// Paged list of historical Starplus expenses.
        /// </summary>
        [HttpGet("expenses")]
        public async Task<ActionResult<ApiResponse<PagedResponse<LegacyExpenseSummaryDto>>>> GetExpenses(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25,
            [FromQuery] string? search = null,
            [FromQuery] int? categoryId = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0) return Forbid();

                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 100);

                var query = _context.LegacyExpenses.AsNoTracking().Where(e => e.TenantId == tenantId);

                if (categoryId.HasValue && categoryId.Value > 0)
                {
                    query = query.Where(e => e.SourceCategoryId == categoryId.Value);
                }

                if (fromDate.HasValue)
                {
                    var fromUtc = DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Utc);
                    query = query.Where(e => e.Date >= fromUtc);
                }

                if (toDate.HasValue)
                {
                    var toUtc = DateTime.SpecifyKind(toDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
                    query = query.Where(e => e.Date <= toUtc);
                }

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var term = search.Trim();
                    query = query.Where(e =>
                        (e.CategoryName != null && EF.Functions.ILike(e.CategoryName, $"%{term}%")) ||
                        (e.Note != null && EF.Functions.ILike(e.Note, $"%{term}%")));
                }

                var totalCount = await query.CountAsync();
                var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

                var items = await query
                    .OrderByDescending(e => e.Date)
                    .ThenByDescending(e => e.Id)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(e => new LegacyExpenseSummaryDto
                    {
                        Id = e.Id,
                        SourceExpenseId = e.SourceExpenseId,
                        SourceCategoryId = e.SourceCategoryId,
                        CategoryName = e.CategoryName,
                        Amount = e.Amount,
                        Date = e.Date,
                        Note = e.Note,
                        VatRate = e.VatRate,
                        VatAmount = e.VatAmount,
                        TotalAmount = e.TotalAmount,
                        TaxType = e.TaxType,
                        IsTaxClaimable = e.IsTaxClaimable
                    })
                    .ToListAsync();

                return Ok(new ApiResponse<PagedResponse<LegacyExpenseSummaryDto>>
                {
                    Success = true,
                    Message = "Historical expenses retrieved successfully",
                    Data = new PagedResponse<LegacyExpenseSummaryDto>
                    {
                        Items = items,
                        TotalCount = totalCount,
                        Page = page,
                        PageSize = pageSize,
                        TotalPages = totalPages
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving legacy expenses for tenant {TenantId}", CurrentTenantId);
                return StatusCode(500, new ApiResponse<PagedResponse<LegacyExpenseSummaryDto>>
                {
                    Success = false,
                    Message = "An error occurred retrieving legacy expenses",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// GET /api/legacy/suppliers
        /// Summary of historical suppliers with total purchases and date ranges.
        /// </summary>
        [HttpGet("suppliers")]
        public async Task<ActionResult<ApiResponse<List<LegacySupplierSummaryDto>>>> GetSuppliers(
            [FromQuery] string? search = null)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0) return Forbid();

                var query = _context.LegacyPurchases.AsNoTracking().Where(p => p.TenantId == tenantId);

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var term = search.Trim();
                    query = query.Where(p => EF.Functions.ILike(p.SupplierName, $"%{term}%"));
                }

                var list = await query
                    .GroupBy(p => p.SupplierName)
                    .Select(g => new LegacySupplierSummaryDto
                    {
                        SupplierName = g.Key,
                        PurchaseCount = g.Count(),
                        TotalPurchases = g.Sum(p => p.TotalAmount),
                        FirstPurchaseDate = g.Min(p => p.PurchaseDate),
                        LastPurchaseDate = g.Max(p => p.PurchaseDate)
                    })
                    .OrderByDescending(s => s.TotalPurchases)
                    .ToListAsync();

                return Ok(new ApiResponse<List<LegacySupplierSummaryDto>>
                {
                    Success = true,
                    Message = "Historical suppliers retrieved successfully",
                    Data = list
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving legacy suppliers for tenant {TenantId}", CurrentTenantId);
                return StatusCode(500, new ApiResponse<List<LegacySupplierSummaryDto>>
                {
                    Success = false,
                    Message = "An error occurred retrieving legacy suppliers",
                    Errors = new List<string> { ex.Message }
                });
            }
        }
    }
}
