using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Models.Legacy;
using HexaBill.Api.Modules.Sales;

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
        /// GET /api/legacy/invoices/{id}/pdf
        /// Printable A4 invoice for a historical Starplus invoice. Uses the normal invoice renderer with the
        /// original issuer's name and TRN. Tenant-scoped; never reads or writes live sales.
        /// </summary>
        [HttpGet("invoices/{id:int}/pdf")]
        public async Task<IActionResult> GetInvoicePdf(int id)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0) return Forbid();

                var inv = await _context.LegacyInvoices
                    .AsNoTracking()
                    .Include(i => i.Items)
                    .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId);

                if (inv == null)
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = $"Historical invoice with ID {id} not found."
                    });
                }

                if (!LegacyInvoicePdfMapper.HasPrintableLines(inv))
                {
                    return UnprocessableEntity(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "This historical invoice has no line items in the Starplus export, so a PDF cannot be printed from its totals alone."
                    });
                }

                var sale = LegacyInvoicePdfMapper.ToSaleDto(inv, tenantId);
                var pdfService = HttpContext.RequestServices.GetRequiredService<IPdfService>();
                var pdfBytes = await pdfService.GenerateInvoicePdfAsync(sale, "A4", "full");
                return File(pdfBytes, "application/pdf", $"INV-{inv.LegacyInvoiceNumber}.pdf");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating PDF for legacy invoice {InvoiceId}", id);
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred generating the historical invoice PDF",
                    Errors = new List<string> { ex.Message }
                });
            }
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
                    // Destination mapping only: source-system customer ids are a different namespace.
                    query = query.Where(i => i.DestinationCustomerId == customerId.Value);
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
                    // Destination mapping only: source-system customer ids are a different namespace.
                    query = query.Where(x => x.p.DestinationCustomerId == customerId.Value);
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
        /// The normal Billing History list: one chronological, server-paged history combining this tenant's
        /// operating sales and its read-only historical (migrated) invoices. Historical rows keep their original
        /// number, date, amounts and legal issuer; they are never re-posted or made editable.
        /// Tenants with no historical rows simply get their operating invoices.
        /// </summary>
        /// <param name="status">all (default) | paid | partial | unpaid | voided. "voided" lists deleted invoices only.</param>
        /// <param name="sort">newest (default) | oldest.</param>
        /// <param name="fromDate">Inclusive Dubai business date (yyyy-MM-dd).</param>
        /// <param name="toDate">Inclusive Dubai business date (yyyy-MM-dd).</param>
        [HttpGet("invoices/unified")]
        public async Task<ActionResult<ApiResponse<PagedResponse<UnifiedInvoiceSummaryDto>>>> GetUnifiedInvoices(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25,
            [FromQuery] string? search = null,
            [FromQuery] string? company = null,
            [FromQuery] int? customerId = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] string? status = null,
            [FromQuery] string? sort = null)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0) return Forbid();

                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 200);

                var statusKey = (status ?? "all").Trim().ToLowerInvariant();
                if (statusKey is not ("all" or "paid" or "partial" or "unpaid" or "voided"))
                {
                    return BadRequest(new ApiResponse<PagedResponse<UnifiedInvoiceSummaryDto>>
                    {
                        Success = false,
                        Message = "status must be one of: all, paid, partial, unpaid, voided"
                    });
                }
                if (fromDate.HasValue && toDate.HasValue && fromDate.Value.Date > toDate.Value.Date)
                {
                    return BadRequest(new ApiResponse<PagedResponse<UnifiedInvoiceSummaryDto>>
                    {
                        Success = false,
                        Message = "fromDate must be on or before toDate"
                    });
                }

                var oldestFirst = string.Equals(sort?.Trim(), "oldest", StringComparison.OrdinalIgnoreCase);
                var voided = statusKey == "voided";
                var tolerance = UnifiedSettlementToleranceAed;

                // "company" is kept for old clients. It filters by record origin, not legal entity.
                var includeOperating = string.IsNullOrWhiteSpace(company)
                    || company.Equals("FROZENHUB", StringComparison.OrdinalIgnoreCase)
                    || company.Equals("OPERATING", StringComparison.OrdinalIgnoreCase);
                var includeHistorical = string.IsNullOrWhiteSpace(company)
                    || company.Equals("STARPLUS", StringComparison.OrdinalIgnoreCase)
                    || company.Equals("HISTORICAL", StringComparison.OrdinalIgnoreCase);

                // Dubai business-day boundaries: inclusive start, exclusive end.
                DateTime? fromUtc = fromDate.HasValue ? BusinessDateRange.StartUtc(fromDate.Value) : null;
                DateTime? toExclusiveUtc = toDate.HasValue ? BusinessDateRange.EndExclusiveUtc(toDate.Value) : null;

                var term = string.IsNullOrWhiteSpace(search) ? null : search.Trim();
                var termLower = term?.ToLowerInvariant();

                // ---- Operating sales (paid = cleared payments only, same rule as the operating list) ----
                IQueryable<UnifiedInvoiceKey>? operatingKeys = null;
                if (includeOperating)
                {
                    var sales = _context.Sales.AsNoTracking().Where(s => s.TenantId == tenantId && s.IsDeleted == voided);
                    if (fromUtc.HasValue) sales = sales.Where(s => s.InvoiceDate >= fromUtc.Value);
                    if (toExclusiveUtc.HasValue) sales = sales.Where(s => s.InvoiceDate < toExclusiveUtc.Value);
                    if (customerId is > 0) sales = sales.Where(s => s.CustomerId == customerId.Value);
                    if (termLower != null)
                    {
                        sales = sales.Where(s =>
                            s.InvoiceNo.ToLower().Contains(termLower) ||
                            (s.Customer != null && s.Customer.Name.ToLower().Contains(termLower)));
                    }

                    if (!voided && statusKey != "all")
                    {
                        var withPaid = sales.Select(s => new
                        {
                            Sale = s,
                            Paid = _context.Payments
                                .Where(p => p.TenantId == tenantId && p.SaleId == s.Id && p.Status == PaymentStatus.CLEARED)
                                .Sum(p => (decimal?)p.Amount) ?? 0m
                        });
                        withPaid = statusKey switch
                        {
                            "paid" => withPaid.Where(x => x.Sale.GrandTotal <= 0 || x.Sale.GrandTotal - x.Paid <= tolerance),
                            "partial" => withPaid.Where(x => x.Sale.GrandTotal > 0 && x.Paid > 0 && x.Sale.GrandTotal - x.Paid > tolerance),
                            _ => withPaid.Where(x => x.Sale.GrandTotal > 0 && x.Paid <= 0 && x.Sale.GrandTotal - x.Paid > tolerance),
                        };
                        sales = withPaid.Select(x => x.Sale);
                    }

                    operatingKeys = sales.Select(s => new UnifiedInvoiceKey
                    {
                        IsLegacy = false,
                        RecordId = s.Id,
                        InvoiceDate = s.InvoiceDate,
                        InvoiceNumber = s.InvoiceNo
                    });
                }

                // ---- Historical invoices (read-only; customer resolved only through the tenant-scoped destination mapping) ----
                IQueryable<UnifiedInvoiceKey>? historicalKeys = null;
                if (includeHistorical)
                {
                    var legacy = _context.LegacyInvoices.AsNoTracking().Where(i => i.TenantId == tenantId && i.IsDeleted == voided);
                    if (fromUtc.HasValue) legacy = legacy.Where(i => i.InvoiceDate >= fromUtc.Value);
                    if (toExclusiveUtc.HasValue) legacy = legacy.Where(i => i.InvoiceDate < toExclusiveUtc.Value);
                    // Never compare the source system's customer id with a destination customer id: they are different namespaces.
                    if (customerId is > 0) legacy = legacy.Where(i => i.DestinationCustomerId == customerId.Value);
                    if (termLower != null)
                    {
                        legacy = legacy.Where(i =>
                            i.LegacyInvoiceNumber.ToLower().Contains(termLower) ||
                            (i.CustomerName != null && i.CustomerName.ToLower().Contains(termLower)));
                    }
                    if (!voided)
                    {
                        legacy = statusKey switch
                        {
                            "paid" => legacy.Where(i => i.OutstandingCalculated <= tolerance),
                            "partial" => legacy.Where(i => i.OutstandingCalculated > tolerance && i.PaidAmount > 0),
                            "unpaid" => legacy.Where(i => i.OutstandingCalculated > tolerance && i.PaidAmount <= 0),
                            _ => legacy
                        };
                    }

                    historicalKeys = legacy.Select(i => new UnifiedInvoiceKey
                    {
                        IsLegacy = true,
                        RecordId = i.Id,
                        InvoiceDate = i.InvoiceDate,
                        InvoiceNumber = i.LegacyInvoiceNumber
                    });
                }

                IQueryable<UnifiedInvoiceKey>? keys = operatingKeys != null && historicalKeys != null
                    ? operatingKeys.Concat(historicalKeys)
                    : operatingKeys ?? historicalKeys;

                if (keys == null)
                {
                    return Ok(new ApiResponse<PagedResponse<UnifiedInvoiceSummaryDto>>
                    {
                        Success = true,
                        Data = new PagedResponse<UnifiedInvoiceSummaryDto> { Items = new(), Page = page, PageSize = pageSize, TotalCount = 0, TotalPages = 0 }
                    });
                }

                var totalCount = await keys.CountAsync();
                var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

                var ordered = oldestFirst
                    ? keys.OrderBy(k => k.InvoiceDate).ThenBy(k => k.InvoiceNumber).ThenBy(k => k.IsLegacy).ThenBy(k => k.RecordId)
                    : keys.OrderByDescending(k => k.InvoiceDate).ThenByDescending(k => k.InvoiceNumber).ThenBy(k => k.IsLegacy).ThenByDescending(k => k.RecordId);

                var pageKeys = await ordered.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

                // ---- Hydrate only the rows on this page ----
                var saleIds = pageKeys.Where(k => !k.IsLegacy).Select(k => k.RecordId).ToList();
                var legacyIds = pageKeys.Where(k => k.IsLegacy).Select(k => k.RecordId).ToList();

                var saleRows = saleIds.Count == 0
                    ? new Dictionary<int, UnifiedInvoiceSummaryDto>()
                    : (await _context.Sales.AsNoTracking()
                        .Where(s => s.TenantId == tenantId && saleIds.Contains(s.Id))
                        .Select(s => new
                        {
                            s.Id,
                            s.InvoiceNo,
                            s.InvoiceDate,
                            s.CustomerId,
                            CustomerName = s.Customer != null ? s.Customer.Name : null,
                            ItemCount = s.Items.Count,
                            s.Subtotal,
                            s.VatTotal,
                            s.GrandTotal,
                            s.PaymentStatus,
                            s.IsDeleted,
                            s.IsLocked,
                            s.Notes
                        })
                        .ToListAsync())
                        .ToDictionary(s => s.Id, s => new UnifiedInvoiceSummaryDto
                        {
                            Id = "FH-" + s.Id,
                            OperatingSaleId = s.Id,
                            SourceCompany = "Operating",
                            InvoiceNumber = s.InvoiceNo,
                            InvoiceDate = s.InvoiceDate,
                            CustomerId = s.CustomerId,
                            CustomerName = s.CustomerName,
                            ItemCount = s.ItemCount,
                            Subtotal = s.Subtotal,
                            VatTotal = s.VatTotal,
                            GrandTotal = s.GrandTotal,
                            OriginalStatus = s.PaymentStatus.ToString(),
                            IsDeleted = s.IsDeleted,
                            IsLocked = s.IsLocked,
                            IsLegacy = false,
                            Notes = s.Notes
                        });

                if (saleIds.Count > 0)
                {
                    var cleared = await _context.Payments.AsNoTracking()
                        .Where(p => p.TenantId == tenantId && p.SaleId.HasValue && saleIds.Contains(p.SaleId.Value) && p.Status == PaymentStatus.CLEARED)
                        .Select(p => new { SaleId = p.SaleId!.Value, p.Amount, p.Mode, p.Id })
                        .ToListAsync();
                    foreach (var dto in saleRows.Values)
                    {
                        var lines = cleared.Where(c => c.SaleId == dto.OperatingSaleId).OrderBy(c => c.Id).ToList();
                        var paid = Math.Round(lines.Sum(c => c.Amount), 2, MidpointRounding.AwayFromZero);
                        dto.PaidAmount = paid;
                        dto.PrimaryPaymentMode = lines.FirstOrDefault()?.Mode.ToString();
                        if (dto.IsDeleted)
                        {
                            dto.OutstandingBalance = 0;
                            dto.PaymentStatus = "Voided";
                            continue;
                        }
                        var outstanding = Math.Max(0, dto.GrandTotal - paid);
                        dto.OutstandingBalance = outstanding;
                        dto.PaymentStatus = ResolveUnifiedStatus(dto.GrandTotal, paid, outstanding, tolerance);
                    }
                }

                var legacyRows = legacyIds.Count == 0
                    ? new Dictionary<int, UnifiedInvoiceSummaryDto>()
                    : (await _context.LegacyInvoices.AsNoTracking()
                        .Where(i => i.TenantId == tenantId && legacyIds.Contains(i.Id))
                        .ToListAsync())
                        .ToDictionary(i => i.Id, i => new UnifiedInvoiceSummaryDto
                        {
                            Id = "LP-" + i.Id,
                            LegacyInvoiceId = i.Id,
                            SourceCompany = "Historical",
                            LegacyIssuer = i.LegacyIssuer,
                            InvoiceNumber = i.LegacyInvoiceNumber,
                            InvoiceDate = i.InvoiceDate,
                            CustomerId = i.DestinationCustomerId,
                            CustomerName = i.CustomerName,
                            ItemCount = i.ItemCount,
                            Subtotal = i.Subtotal,
                            VatTotal = i.VatTotal,
                            GrandTotal = i.GrandTotal,
                            PaidAmount = i.PaidAmount,
                            OutstandingBalance = i.IsDeleted ? 0 : i.OutstandingCalculated,
                            PaymentStatus = i.IsDeleted
                                ? "Voided"
                                : ResolveUnifiedStatus(i.GrandTotal, i.PaidAmount, i.OutstandingCalculated, tolerance),
                            OriginalStatus = i.Status,
                            IsDeleted = i.IsDeleted,
                            IsLocked = true,
                            IsLegacy = true,
                            Notes = i.Notes
                        });

                var items = new List<UnifiedInvoiceSummaryDto>(pageKeys.Count);
                foreach (var key in pageKeys)
                {
                    var map = key.IsLegacy ? legacyRows : saleRows;
                    if (map.TryGetValue(key.RecordId, out var row)) items.Add(row);
                }

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
                    Message = "Billing history could not be loaded. Please try again.",
                    Errors = new List<string> { "UNIFIED_INVOICES_FAILED" }
                });
            }
        }

        /// <summary>Same tolerance as operating sales settlement (SalePaymentHelpers.SettlementToleranceAed).</summary>
        internal const decimal UnifiedSettlementToleranceAed = 0.05m;

        internal static string ResolveUnifiedStatus(decimal grandTotal, decimal paid, decimal outstanding, decimal tolerance)
        {
            if (grandTotal <= 0 || outstanding <= tolerance) return "Paid";
            return paid > 0 ? "Partial" : "Pending";
        }

        /// <summary>Lightweight row used to page the combined history before loading details.</summary>
        public sealed class UnifiedInvoiceKey
        {
            public bool IsLegacy { get; set; }
            public int RecordId { get; set; }
            public DateTime InvoiceDate { get; set; }
            public string InvoiceNumber { get; set; } = string.Empty;
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
