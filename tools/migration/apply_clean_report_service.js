const fs = require('fs');

const file = 'backend/HexaBill.Api/Modules/Reports/ReportService.cs';
let content = fs.readFileSync(file, 'utf8');

// 1. Patch salesToday
const salesTarget = `salesToday = await salesQuery.SumAsync(s => (decimal?)s.GrandTotal) ?? 0;
                    _logger.LogDebug("Total sales today: {SalesToday}", salesToday);`;

const salesRepl = `salesToday = await salesQuery.SumAsync(s => (decimal?)s.GrandTotal) ?? 0;
                    if (tenantId == 20 && startDate < new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc))
                    {
                        var legacySales = await _context.LegacyInvoices
                            .Where(li => li.TenantId == tenantId && !li.IsDeleted && li.InvoiceDate >= startDate && li.InvoiceDate < endDate)
                            .SumAsync(li => (decimal?)li.TotalAmount) ?? 0m;
                        salesToday += legacySales;
                    }
                    _logger.LogDebug("Total sales today: {SalesToday}", salesToday);`;

// 2. Patch purchasesToday
const purchasesTarget = `purchasesToday = await purchasesQuery.SumAsync(p => (decimal?)p.TotalAmount) ?? 0;
                    _logger.LogDebug("Total purchases today: {PurchasesToday}", purchasesToday);`;

const purchasesRepl = `purchasesToday = await purchasesQuery.SumAsync(p => (decimal?)p.TotalAmount) ?? 0;
                    if (tenantId == 20 && startDate < new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc))
                    {
                        var legacyPurchases = await _context.LegacyPurchases
                            .Where(lp => lp.TenantId == tenantId && lp.PurchaseDate >= startDate && lp.PurchaseDate < endDate)
                            .SumAsync(lp => (decimal?)lp.TotalAmount) ?? 0m;
                        purchasesToday += legacyPurchases;
                    }
                    _logger.LogDebug("Total purchases today: {PurchasesToday}", purchasesToday);`;

// 3. Patch expensesToday
const expensesTarget = `expensesToday = await expensesQuery.SumAsync(e => (decimal?)e.Amount) ?? 0;
                    _logger.LogDebug("Total expenses today: {ExpensesToday}", expensesToday);`;

const expensesRepl = `expensesToday = await expensesQuery.SumAsync(e => (decimal?)e.Amount) ?? 0;
                    if (tenantId == 20 && startDate < new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc))
                    {
                        var legacyExpenses = await _context.LegacyExpenses
                            .Where(le => le.TenantId == tenantId && le.Date >= startDate && le.Date < endDate)
                            .SumAsync(le => (decimal?)le.Amount) ?? 0m;
                        expensesToday += legacyExpenses;
                    }
                    _logger.LogDebug("Total expenses today: {ExpensesToday}", expensesToday);`;

// 4. Patch profit / COGS
const profitTarget = `                // Profit = Net Sales (Sales - Returns) - COGS - Expenses. VendorDiscounts are not included in P&L.
                var grossProfit = netSalesToday - cogsToday;
                var profitToday = grossProfit - expensesToday;`;

const profitRepl = `                // Profit = Net Sales (Sales - Returns) - COGS - Expenses. VendorDiscounts are not included in P&L.
                if (tenantId == 20 && startDate < new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc))
                {
                    var legacyPurchasesCost = await _context.LegacyPurchases
                        .Where(lp => lp.TenantId == tenantId && lp.PurchaseDate >= startDate && lp.PurchaseDate < endDate)
                        .SumAsync(lp => (decimal?)lp.TotalAmount) ?? 0m;
                    cogsToday += legacyPurchasesCost;
                }
                var grossProfit = netSalesToday - cogsToday;
                var profitToday = grossProfit - expensesToday;`;

// 5. Patch cashCollectionsTotal
const collectionsTarget = `                    cashCollectionsTotal = await payQ.SumAsync(p => (decimal?)p.Amount) ?? 0m;`;

const collectionsRepl = `                    cashCollectionsTotal = await payQ.SumAsync(p => (decimal?)p.Amount) ?? 0m;
                    if (tenantId == 20 && startDate < new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc))
                    {
                        var legacyPayQuery = _context.LegacyPayments
                            .Where(lp => lp.TenantId == tenantId && lp.PaymentDate >= startDate && lp.PaymentDate < endDate && (lp.Status == "Cleared" || lp.Status == "CLEARED"));
                        cashCollectionsTotal += await legacyPayQuery.SumAsync(lp => (decimal?)lp.Amount) ?? 0m;
                    }`;

// 6. Patch creditInvoicedTotal
const creditTarget = `                    creditInvoicedTotal = await creditSalesQ.SumAsync(s => (decimal?)s.GrandTotal) ?? 0m;`;

const creditRepl = `                    creditInvoicedTotal = await creditSalesQ.SumAsync(s => (decimal?)s.GrandTotal) ?? 0m;
                    if (tenantId == 20 && startDate < new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc))
                    {
                        var legacyCredit = await _context.LegacyInvoices
                            .Where(li => li.TenantId == tenantId && !li.IsDeleted && li.InvoiceDate >= startDate && li.InvoiceDate < endDate && li.SourceCustomerId != null)
                            .SumAsync(li => (decimal?)li.TotalAmount) ?? 0m;
                        creditInvoicedTotal += legacyCredit;
                    }`;

// 7. Patch dailySalesData (around line 716)
const trendTarget = `                    var dailySalesData = await dailySalesQuery
                        .GroupBy(s => s.InvoiceDate.Date)
                        .Select(g => new
                        {
                            Date = g.Key,
                            Sales = g.Sum(s => s.GrandTotal),
                            InvoiceCount = g.Count()
                        })
                        .OrderBy(x => x.Date)
                        .ToListAsync();`;

const trendRepl = `                    var dailySalesData = await dailySalesQuery
                        .GroupBy(s => s.InvoiceDate.Date)
                        .Select(g => new
                        {
                            Date = g.Key,
                            Sales = g.Sum(s => s.GrandTotal),
                            InvoiceCount = g.Count()
                        })
                        .OrderBy(x => x.Date)
                        .ToListAsync();

                    if (tenantId == 20 && trendFromDate < new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc))
                    {
                        var legacyDaily = await _context.LegacyInvoices
                            .Where(li => li.TenantId == tenantId && !li.IsDeleted && li.InvoiceDate >= trendFromDate && li.InvoiceDate < trendToDate)
                            .GroupBy(li => li.InvoiceDate.Date)
                            .Select(g => new
                            {
                                Date = g.Key,
                                Sales = g.Sum(li => li.TotalAmount),
                                InvoiceCount = g.Count()
                            })
                            .ToListAsync();

                        var merged = dailySalesData.ToDictionary(d => d.Date.Date, d => new { Sales = d.Sales, InvoiceCount = d.InvoiceCount });
                        foreach (var ld in legacyDaily)
                        {
                            if (merged.TryGetValue(ld.Date.Date, out var existing))
                            {
                                merged[ld.Date.Date] = new { Sales = existing.Sales + ld.Sales, InvoiceCount = existing.InvoiceCount + ld.InvoiceCount };
                            }
                            else
                            {
                                merged[ld.Date.Date] = new { Sales = ld.Sales, InvoiceCount = ld.InvoiceCount };
                            }
                        }
                        dailySalesData = merged.Select(m => new { Date = m.Key, Sales = m.Value.Sales, InvoiceCount = m.Value.InvoiceCount }).OrderBy(x => x.Date).ToList();
                    }`;

// 8. Patch GetWorksheetReportAsync
const worksheetTarget = `            var totalReceived = await _context.Payments
                .Where(p => (p.TenantId == tenantId || (p.TenantId == null && p.OwnerId == tenantId))
                    && p.SaleReturnId == null
                    && p.Status == PaymentStatus.CLEARED
                    && p.PaymentDate >= startUtc
                    && p.PaymentDate < endUtc)
                .SumAsync(p => (decimal?)p.Amount) ?? 0m;`;

const worksheetRepl = `            var totalReceived = await _context.Payments
                .Where(p => (p.TenantId == tenantId || (p.TenantId == null && p.OwnerId == tenantId))
                    && p.SaleReturnId == null
                    && p.Status == PaymentStatus.CLEARED
                    && p.PaymentDate >= startUtc
                    && p.PaymentDate < endUtc)
                .SumAsync(p => (decimal?)p.Amount) ?? 0m;

            if (tenantId == 20 && startUtc < new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc))
            {
                var legacyReceived = await _context.LegacyPayments
                    .Where(lp => lp.TenantId == tenantId && (lp.Status == "Cleared" || lp.Status == "CLEARED") && lp.PaymentDate >= startUtc && lp.PaymentDate < endUtc)
                    .SumAsync(lp => (decimal?)lp.Amount) ?? 0m;
                totalReceived += legacyReceived;
            }`;

const normalize = s => s.replace(/\r?\n/g, '\n');
let c = normalize(content);

const patches = [
  { name: 'salesToday', target: salesTarget, repl: salesRepl },
  { name: 'purchasesToday', target: purchasesTarget, repl: purchasesRepl },
  { name: 'expensesToday', target: expensesTarget, repl: expensesRepl },
  { name: 'profit / COGS', target: profitTarget, repl: profitRepl },
  { name: 'cashCollectionsTotal', target: collectionsTarget, repl: collectionsRepl },
  { name: 'creditInvoicedTotal', target: creditTarget, repl: creditRepl },
  { name: 'dailySalesData trend', target: trendTarget, repl: trendRepl },
  { name: 'GetWorksheetReportAsync totalReceived', target: worksheetTarget, repl: worksheetRepl }
];

let allOk = true;
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
  console.log('[SUCCESS] ReportService.cs updated successfully!');
} else {
  console.error('[ERROR] Some patches failed, aborting write.');
  process.exit(1);
}
