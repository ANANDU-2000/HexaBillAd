const fs = require('fs');

const file = 'backend/HexaBill.Api/Modules/Reports/ReportService.cs';
let content = fs.readFileSync(file, 'utf8');

// 1. Patch salesToday (around line 179)
const salesTarget = `                    salesToday = await salesQuery.SumAsync(s => (decimal?)s.GrandTotal) ?? 0;
                    _logger.LogDebug("Total sales today: {SalesToday}", salesToday);`;

const salesRepl = `                    salesToday = await salesQuery.SumAsync(s => (decimal?)s.GrandTotal) ?? 0;
                    if (tenantId == 20 && startDate < new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc))
                    {
                        var legacySales = await _context.LegacyInvoices
                            .Where(li => li.TenantId == tenantId && !li.IsDeleted && li.InvoiceDate >= startDate && li.InvoiceDate < endDate)
                            .SumAsync(li => (decimal?)li.TotalAmount) ?? 0m;
                        salesToday += legacySales;
                    }
                    _logger.LogDebug("Total sales today: {SalesToday}", salesToday);`;

// 2. Patch purchasesToday (around line 272)
const purchasesTarget = `                    purchasesToday = await purchasesQuery.SumAsync(p => (decimal?)p.TotalAmount) ?? 0;
                    _logger.LogDebug("Total purchases today: {PurchasesToday}", purchasesToday);`;

const purchasesRepl = `                    purchasesToday = await purchasesQuery.SumAsync(p => (decimal?)p.TotalAmount) ?? 0;
                    if (tenantId == 20 && startDate < new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc))
                    {
                        var legacyPurchases = await _context.LegacyPurchases
                            .Where(lp => lp.TenantId == tenantId && lp.PurchaseDate >= startDate && lp.PurchaseDate < endDate)
                            .SumAsync(lp => (decimal?)lp.TotalAmount) ?? 0m;
                        purchasesToday += legacyPurchases;
                    }
                    _logger.LogDebug("Total purchases today: {PurchasesToday}", purchasesToday);`;

// 3. Patch expensesToday (around line 295)
const expensesTarget = `                    expensesToday = await expensesQuery.SumAsync(e => (decimal?)e.Amount) ?? 0;
                    _logger.LogDebug("Total expenses today: {ExpensesToday}", expensesToday);`;

const expensesRepl = `                    expensesToday = await expensesQuery.SumAsync(e => (decimal?)e.Amount) ?? 0;
                    if (tenantId == 20 && startDate < new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc))
                    {
                        var legacyExpenses = await _context.LegacyExpenses
                            .Where(le => le.TenantId == tenantId && le.Date >= startDate && le.Date < endDate)
                            .SumAsync(le => (decimal?)le.Amount) ?? 0m;
                        expensesToday += legacyExpenses;
                    }
                    _logger.LogDebug("Total expenses today: {ExpensesToday}", expensesToday);`;

// 4. Patch grossProfit / profitToday (around line 366)
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

// 5. Patch cashCollectionsTotal (around line 521)
const collectionsTarget = `                    cashCollectionsTotal = await payQ.SumAsync(p => (decimal?)p.Amount) ?? 0m;`;

const collectionsRepl = `                    cashCollectionsTotal = await payQ.SumAsync(p => (decimal?)p.Amount) ?? 0m;
                    if (tenantId == 20 && startDate < new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc))
                    {
                        var legacyPayQuery = _context.LegacyPayments
                            .Where(lp => lp.TenantId == tenantId && lp.PaymentDate >= startDate && lp.PaymentDate < endDate && lp.PaymentStatus == "CLEARED");
                        cashCollectionsTotal += await legacyPayQuery.SumAsync(lp => (decimal?)lp.Amount) ?? 0m;
                    }`;

// 6. Patch creditInvoicedTotal (around line 529)
const creditTarget = `                    creditInvoicedTotal = await creditSalesQ.SumAsync(s => (decimal?)s.GrandTotal) ?? 0m;`;

const creditRepl = `                    creditInvoicedTotal = await creditSalesQ.SumAsync(s => (decimal?)s.GrandTotal) ?? 0m;
                    if (tenantId == 20 && startDate < new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc))
                    {
                        var legacyCredit = await _context.LegacyInvoices
                            .Where(li => li.TenantId == tenantId && !li.IsDeleted && li.InvoiceDate >= startDate && li.InvoiceDate < endDate && li.SourceCustomerId != null)
                            .SumAsync(li => (decimal?)li.TotalAmount) ?? 0m;
                        creditInvoicedTotal += legacyCredit;
                    }`;

const normalize = s => s.replace(/\r?\n/g, '\n');

let c = normalize(content);

if (c.includes(normalize(salesTarget))) {
  c = c.replace(normalize(salesTarget), normalize(salesRepl));
  console.log('[PASS] salesToday patched');
} else {
  console.log('[FAIL] salesTarget not found');
}

if (c.includes(normalize(purchasesTarget))) {
  c = c.replace(normalize(purchasesTarget), normalize(purchasesRepl));
  console.log('[PASS] purchasesToday patched');
} else {
  console.log('[FAIL] purchasesTarget not found');
}

if (c.includes(normalize(expensesTarget))) {
  c = c.replace(normalize(expensesTarget), normalize(expensesRepl));
  console.log('[PASS] expensesToday patched');
} else {
  console.log('[FAIL] expensesTarget not found');
}

if (c.includes(normalize(profitTarget))) {
  c = c.replace(normalize(profitTarget), normalize(profitRepl));
  console.log('[PASS] profitToday patched');
} else {
  console.log('[FAIL] profitTarget not found');
}

if (c.includes(normalize(collectionsTarget))) {
  c = c.replace(normalize(collectionsTarget), normalize(collectionsRepl));
  console.log('[PASS] cashCollectionsTotal patched');
} else {
  console.log('[FAIL] collectionsTarget not found');
}

if (c.includes(normalize(creditTarget))) {
  c = c.replace(normalize(creditTarget), normalize(creditRepl));
  console.log('[PASS] creditInvoicedTotal patched');
} else {
  console.log('[FAIL] creditTarget not found');
}

fs.writeFileSync(file, c, 'utf8');
console.log('[DONE] ReportService.cs updated successfully!');

