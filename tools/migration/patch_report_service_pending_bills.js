const fs = require('fs');

const file = 'backend/HexaBill.Api/Modules/Reports/ReportService.cs';
let content = fs.readFileSync(file, 'utf8');

// 1. Target: lines 448-459 (pendingBillsCount and pendingBillsAmount)
const pendingTarget = `                    if (tenantId > 0)
                    {
                        var legacyOpeningAr = await _context.LegacyOpeningReceivables
                            .Where(lo => lo.TenantId == tenantId)
                            .SumAsync(lo => (decimal?)lo.OpeningBalance) ?? 0m;
                        var legacyOpeningCount = await _context.LegacyOpeningReceivables
                            .Where(lo => lo.TenantId == tenantId && lo.OpeningBalance > tol)
                            .CountAsync();

                        pendingBillsAmount += legacyOpeningAr;
                        pendingBillsCount += legacyOpeningCount;
                    }`;

const pendingRepl = `                    if (tenantId == 20)
                    {
                        var legacyPendingQuery = _context.LegacyInvoices
                            .Where(li => li.TenantId == tenantId && !li.IsDeleted && li.OutstandingCalculated > tol);
                        var legacyPendingCount = await legacyPendingQuery.CountAsync();
                        var legacyPendingAmount = await legacyPendingQuery.SumAsync(li => (decimal?)li.OutstandingCalculated) ?? 0m;

                        pendingBillsAmount += legacyPendingAmount;
                        pendingBillsCount += legacyPendingCount;
                    }
                    else if (tenantId > 0)
                    {
                        var legacyOpeningAr = await _context.LegacyOpeningReceivables
                            .Where(lo => lo.TenantId == tenantId)
                            .SumAsync(lo => (decimal?)lo.OpeningBalance) ?? 0m;
                        var legacyOpeningCount = await _context.LegacyOpeningReceivables
                            .Where(lo => lo.TenantId == tenantId && lo.OpeningBalance > tol)
                            .CountAsync();

                        pendingBillsAmount += legacyOpeningAr;
                        pendingBillsCount += legacyOpeningCount;
                    }`;

// 2. Target: pendingInvoices projection (around lines 503-525)
const invoicesTarget = `                    pendingInvoices = await pendingInvoicesQuery
                        .OrderByDescending(x => x.Sale.InvoiceDate)
                        .Take(10)
                        .Select(x => new SaleDto
                        {
                            Id = x.Sale.Id,
                            InvoiceNo = x.Sale.InvoiceNo,
                            InvoiceDate = x.Sale.InvoiceDate,
                            CustomerId = x.Sale.CustomerId,
                            CustomerName = x.Customer != null ? x.Customer.Name : null,
                            Subtotal = x.Sale.Subtotal,
                            VatTotal = x.Sale.VatTotal,
                            Discount = x.Sale.Discount,
                            RoundOff = x.Sale.RoundOff,
                            GrandTotal = x.Sale.GrandTotal,
                            PaidAmount = x.Sale.PaidAmount,
                            PaymentStatus = x.Sale.PaymentStatus.ToString(),
                            Notes = x.Sale.Notes,
                            Items = new List<SaleItemDto>() // Empty list for summary view
                        })
                        .ToListAsync();`;

const invoicesRepl = `                    pendingInvoices = await pendingInvoicesQuery
                        .OrderByDescending(x => x.Sale.InvoiceDate)
                        .Take(10)
                        .Select(x => new SaleDto
                        {
                            Id = x.Sale.Id,
                            InvoiceNo = x.Sale.InvoiceNo,
                            InvoiceDate = x.Sale.InvoiceDate,
                            CustomerId = x.Sale.CustomerId,
                            CustomerName = x.Customer != null ? x.Customer.Name : null,
                            Subtotal = x.Sale.Subtotal,
                            VatTotal = x.Sale.VatTotal,
                            Discount = x.Sale.Discount,
                            RoundOff = x.Sale.RoundOff,
                            GrandTotal = x.Sale.GrandTotal,
                            PaidAmount = x.Sale.PaidAmount,
                            PaymentStatus = x.Sale.PaymentStatus.ToString(),
                            Notes = x.Sale.Notes,
                            Items = new List<SaleItemDto>() // Empty list for summary view
                        })
                        .ToListAsync();

                    if (tenantId == 20 && pendingInvoices.Count < 10)
                    {
                        var needed = 10 - pendingInvoices.Count;
                        var legacyPendingTop = await _context.LegacyInvoices.AsNoTracking()
                            .Where(li => li.TenantId == tenantId && !li.IsDeleted && li.OutstandingCalculated > tol)
                            .OrderByDescending(li => li.InvoiceDate)
                            .Take(needed)
                            .Select(li => new SaleDto
                            {
                                Id = li.Id,
                                InvoiceNo = li.LegacyInvoiceNumber,
                                InvoiceDate = li.InvoiceDate,
                                CustomerId = li.DestinationCustomerId ?? li.SourceCustomerId,
                                CustomerName = li.CustomerName ?? "Cash Customer",
                                Subtotal = li.Subtotal,
                                VatTotal = li.VatTotal,
                                Discount = li.Discount,
                                RoundOff = li.RoundOff,
                                GrandTotal = li.GrandTotal,
                                PaidAmount = li.PaidAmount,
                                PaymentStatus = li.PaidAmount > 0 ? "Partial" : "Pending",
                                Notes = li.Notes,
                                Items = new List<SaleItemDto>()
                            })
                            .ToListAsync();
                        pendingInvoices.AddRange(legacyPendingTop);
                    }`;

// 3. Target: overdue summary KPIs (around lines 590-600)
const overdueTarget = `                        var legacyOpeningOverdue = await _context.LegacyOpeningReceivables
                            .Where(lo => lo.TenantId == tenantId)
                            .SumAsync(lo => (decimal?)lo.OpeningBalance) ?? 0m;
                        var legacyOpeningOverdueCount = await _context.LegacyOpeningReceivables
                            .Where(lo => lo.TenantId == tenantId && lo.OpeningBalance > tolOverdue)
                            .CountAsync();

                        overdueAmountTotal += legacyOpeningOverdue;
                        overdueCustomersCount += legacyOpeningOverdueCount;`;

const overdueRepl = `                        if (tenantId == 20)
                        {
                            var legacyOverdueQ = _context.LegacyInvoices
                                .Where(li => li.TenantId == tenantId && !li.IsDeleted && li.OutstandingCalculated > tolOverdue && li.InvoiceDate <= overdueCutoff);
                            var legacyOverdueAmt = await legacyOverdueQ.SumAsync(li => (decimal?)li.OutstandingCalculated) ?? 0m;
                            var legacyOverdueCusts = await legacyOverdueQ
                                .Where(li => li.DestinationCustomerId != null || li.SourceCustomerId != null)
                                .Select(li => li.DestinationCustomerId ?? li.SourceCustomerId)
                                .Distinct()
                                .CountAsync();

                            overdueAmountTotal += legacyOverdueAmt;
                            overdueCustomersCount += legacyOverdueCusts;
                        }
                        else
                        {
                            var legacyOpeningOverdue = await _context.LegacyOpeningReceivables
                                .Where(lo => lo.TenantId == tenantId)
                                .SumAsync(lo => (decimal?)lo.OpeningBalance) ?? 0m;
                            var legacyOpeningOverdueCount = await _context.LegacyOpeningReceivables
                                .Where(lo => lo.TenantId == tenantId && lo.OpeningBalance > tolOverdue)
                                .CountAsync();

                            overdueAmountTotal += legacyOpeningOverdue;
                            overdueCustomersCount += legacyOpeningOverdueCount;
                        }`;

const normalize = s => s.replace(/\r?\n/g, '\n');
let c = normalize(content);

let allOk = true;
const patches = [
  { name: 'pendingBillsCount and pendingBillsAmount', target: pendingTarget, repl: pendingRepl },
  { name: 'pendingInvoices legacy top 10', target: invoicesTarget, repl: invoicesRepl },
  { name: 'overdueAmountTotal and overdueCustomersCount', target: overdueTarget, repl: overdueRepl }
];

patches.forEach(p => {
  if (c.includes(normalize(p.target))) {
    c = c.replace(normalize(p.target), normalize(p.repl));
    console.log('[PASS]', p.name);
  } else {
    console.error('[FAIL]', p.name, 'target not found!');
    allOk = false;
  }
});

if (allOk) {
  fs.writeFileSync(file, c, 'utf8');
  console.log('[SUCCESS] ReportService.cs pending bills patched successfully!');
} else {
  console.error('[ERROR] Some patches failed, aborting write.');
  process.exit(1);
}
