const fs = require('fs');
const file = 'backend/HexaBill.Api/Modules/Legacy/LegacyHistoryController.cs';
let content = fs.readFileSync(file, 'utf8');

const newEndpoints = `
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
                    var fromUtc = DateTime.SpecifyKind(fromDate.Value, DateTimeKind.Utc);
                    query = query.Where(p => p.PurchaseDate >= fromUtc);
                }

                if (toDate.HasValue)
                {
                    var toUtc = DateTime.SpecifyKind(toDate.Value, DateTimeKind.Utc);
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
                    var fromUtc = DateTime.SpecifyKind(fromDate.Value, DateTimeKind.Utc);
                    query = query.Where(e => e.Date >= fromUtc);
                }

                if (toDate.HasValue)
                {
                    var toUtc = DateTime.SpecifyKind(toDate.Value, DateTimeKind.Utc);
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
`;

// Replace the trailing "    }\n}" with the new endpoints
const lastBraces = content.lastIndexOf('    }\n}');
if (lastBraces !== -1) {
  content = content.slice(0, lastBraces) + newEndpoints;
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully appended endpoints to LegacyHistoryController.cs');
} else {
  const lastBrace = content.lastIndexOf('}');
  const prevBrace = content.lastIndexOf('}', lastBrace - 1);
  content = content.slice(0, prevBrace) + newEndpoints;
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully appended endpoints using fallback to LegacyHistoryController.cs');
}

