const fs = require('fs');
const path = require('path');

const filePath = path.resolve('backend/HexaBill.Api/Modules/Reports/ReportService.cs');
let content = fs.readFileSync(filePath, 'utf8');

const target = `            var totalCount = await query.CountAsync();
            
            // When Sales has no BranchId/RouteId columns, project without them to avoid 42703
            List<SaleDto> sales;`;

const replacement = `            var totalCount = await query.CountAsync();

            // Tenant 20 (FrozenHub 1) Starplus continuity: Merge legacy invoices into Sales Report
            var cutoverUtc = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);
            if (tenantId == 20 && fromDate < cutoverUtc && !branchId.HasValue && !routeId.HasValue && !userIdForStaff.HasValue)
            {
                var legacyQ = _context.LegacyInvoices.AsNoTracking()
                    .Where(li => li.TenantId == tenantId && !li.IsDeleted && li.InvoiceDate >= fromDate && li.InvoiceDate < toDate);

                if (customerId.HasValue)
                {
                    legacyQ = legacyQ.Where(li => li.DestinationCustomerId == customerId.Value);
                }

                if (!string.IsNullOrWhiteSpace(status))
                {
                    var statusUpper = status.ToUpper();
                    var tol = SalePaymentHelpers.SettlementToleranceAed;
                    if (statusUpper == "PENDING" || statusUpper == "UNPAID")
                    {
                        legacyQ = legacyQ.Where(li => li.OutstandingCalculated > tol);
                    }
                    else if (statusUpper == "PAID")
                    {
                        legacyQ = legacyQ.Where(li => li.OutstandingCalculated <= tol);
                    }
                    else if (statusUpper == "PARTIAL")
                    {
                        legacyQ = legacyQ.Where(li => li.PaidAmount > 0 && li.OutstandingCalculated > tol);
                    }
                }

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var searchLower = search.ToLowerInvariant();
                    legacyQ = legacyQ.Where(li =>
                        li.LegacyInvoiceNumber.ToLower().Contains(searchLower) ||
                        (li.CustomerName != null && li.CustomerName.ToLower().Contains(searchLower))
                    );
                }

                var legacyCount = await legacyQ.CountAsync();
                var combinedTotal = totalCount + legacyCount;

                var opSalesDtos = await (from s in query
                                         join c in _context.Customers on s.CustomerId equals c.Id into customerGroup
                                         from c in customerGroup.DefaultIfEmpty()
                                         orderby s.InvoiceDate descending
                                         select new SaleDto
                                         {
                                             Id = s.Id,
                                             InvoiceNo = s.InvoiceNo,
                                             InvoiceDate = s.InvoiceDate,
                                             CustomerId = s.CustomerId,
                                             BranchId = s.BranchId,
                                             RouteId = s.RouteId,
                                             CustomerName = c != null ? c.Name : null,
                                             Subtotal = s.Subtotal,
                                             VatTotal = s.VatTotal,
                                             Discount = s.Discount,
                                             RoundOff = s.RoundOff,
                                             GrandTotal = s.GrandTotal,
                                             PaidAmount = s.PaidAmount,
                                             PaymentStatus = s.PaymentStatus.ToString(),
                                             Notes = s.Notes,
                                             Items = new List<SaleItemDto>()
                                         }).ToListAsync();

                var legSalesDtos = await (from li in legacyQ
                                          orderby li.InvoiceDate descending
                                          select new SaleDto
                                          {
                                              Id = -(int)li.Id,
                                              InvoiceNo = li.LegacyInvoiceNumber,
                                              InvoiceDate = li.InvoiceDate,
                                              CustomerId = li.DestinationCustomerId,
                                              BranchId = null,
                                              RouteId = null,
                                              CustomerName = li.CustomerName,
                                              Subtotal = li.Subtotal,
                                              VatTotal = li.VatTotal,
                                              Discount = li.Discount,
                                              RoundOff = li.RoundOff,
                                              GrandTotal = li.GrandTotal,
                                              PaidAmount = li.PaidAmount,
                                              PaymentStatus = li.OutstandingCalculated <= SalePaymentHelpers.SettlementToleranceAed ? "PAID" : (li.PaidAmount > 0 ? "PARTIAL" : "PENDING"),
                                              Notes = "Historical Starplus invoice",
                                              Items = new List<SaleItemDto>()
                                          })
                                          .Skip(Math.Max(0, (page - 1) * pageSize - opSalesDtos.Count))
                                          .Take(pageSize)
                                          .ToListAsync();

                var mergedSales = opSalesDtos.Concat(legSalesDtos)
                    .OrderByDescending(s => s.InvoiceDate)
                    .ThenByDescending(s => s.Id)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();

                await AttachApprovedReturnAmountsAsync(mergedSales.Where(s => s.Id > 0).ToList(), tenantId);

                return new PagedResponse<SaleDto>
                {
                    Items = mergedSales,
                    TotalCount = combinedTotal,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = (int)Math.Ceiling((double)combinedTotal / pageSize)
                };
            }
            
            // When Sales has no BranchId/RouteId columns, project without them to avoid 42703
            List<SaleDto> sales;`;

if (!content.includes(target)) {
    console.error('Target not found in ReportService.cs');
    process.exit(1);
}

content = content.replace(target, replacement);
fs.writeFileSync(filePath, content, 'utf8');
console.log('ReportService.cs successfully patched with unified GetSalesReportAsync!');

