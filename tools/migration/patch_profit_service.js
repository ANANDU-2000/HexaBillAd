const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../backend/HexaBill.Api/Modules/Reports/ProfitService.cs');
let content = fs.readFileSync(filePath, 'utf8');

const target = `            // Single definition: Profit = GrandTotal(Sales) - COGS - Expenses (PRODUCTION_MASTER_TODO #38)
            // Gross Profit = Sales - COGS; Net Profit = Gross - Expenses
            var grossProfit = totalSales - cogs;
            var netProfit = grossProfit - totalExpenses;
            
            // Margins calculated against total revenue
            var grossProfitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
            var netProfitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;`;

const replacement = `            // Single definition: Profit = GrandTotal(Sales) - COGS - Expenses (PRODUCTION_MASTER_TODO #38)
            // Gross Profit = Sales - COGS; Net Profit = Gross - Expenses
            if (tenantId == 20 && from < new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc))
            {
                var legacySales = await _context.LegacyInvoices
                    .Where(li => li.TenantId == tenantId && !li.IsDeleted && li.InvoiceDate >= from && li.InvoiceDate <= to)
                    .SumAsync(li => (decimal?)li.TotalAmount) ?? 0m;
                var legacyVat = await _context.LegacyInvoices
                    .Where(li => li.TenantId == tenantId && !li.IsDeleted && li.InvoiceDate >= from && li.InvoiceDate <= to)
                    .SumAsync(li => (decimal?)li.VatTotal) ?? 0m;
                totalSales += legacySales;
                totalSalesVat += legacyVat;
                totalSalesSubtotal += (legacySales - legacyVat);

                var legacyPurchases = await _context.LegacyPurchases
                    .Where(lp => lp.TenantId == tenantId && lp.PurchaseDate >= from && lp.PurchaseDate <= to)
                    .SumAsync(lp => (decimal?)lp.TotalAmount) ?? 0m;
                totalPurchases += legacyPurchases;
                cogs += legacyPurchases;

                var legacyExpenses = await _context.LegacyExpenses
                    .Where(le => le.TenantId == tenantId && le.Date >= from && le.Date <= to)
                    .SumAsync(le => (decimal?)le.Amount) ?? 0m;
                totalExpenses += legacyExpenses;
            }

            var grossProfit = totalSales - cogs;
            var netProfit = grossProfit - totalExpenses;
            
            // Margins calculated against total revenue
            var grossProfitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
            var netProfitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;`;

if (!content.includes(target) && !content.replace(/\r\n/g, '\n').includes(target.replace(/\r\n/g, '\n'))) {
    console.error("Target not found!");
    process.exit(1);
}

content = content.replace(/\r\n/g, '\n').replace(target.replace(/\r\n/g, '\n'), replacement.replace(/\r\n/g, '\n'));

// Also patch CalculateProductProfitAsync:
const prodTarget = `            var items = await query.AsNoTracking().ToListAsync();
            var productProfits = items
                .GroupBy(si => new { si.ProductId, si.Product.NameEn })
                .Select(g =>
                {
                    var sales = g.Sum(si => si.LineTotal);
                    var cost = g.Sum(SaleCostBasis.Calculate);
                    return new ProductProfitDto
                    {
                        ProductId = g.Key.ProductId,
                        ProductName = g.Key.NameEn,
                        QuantitySold = g.Sum(si => si.Qty),
                        TotalSales = sales,
                        TotalCost = cost,
                        EstimatedCostLineCount = g.Count(si => !SaleCostBasis.HasSnapshot(si)),
                        Profit = sales - cost,
                        ProfitMargin = sales > 0 ? (sales - cost) / sales * 100 : 0
                    };
                })
                .OrderByDescending(p => p.Profit)
                .ToList();
            return productProfits;`;

const prodReplacement = `            var items = await query.AsNoTracking().ToListAsync();
            var productProfits = items
                .GroupBy(si => new { si.ProductId, si.Product.NameEn })
                .Select(g =>
                {
                    var sales = g.Sum(si => si.LineTotal);
                    var cost = g.Sum(SaleCostBasis.Calculate);
                    return new ProductProfitDto
                    {
                        ProductId = g.Key.ProductId,
                        ProductName = g.Key.NameEn,
                        QuantitySold = g.Sum(si => si.Qty),
                        TotalSales = sales,
                        TotalCost = cost,
                        EstimatedCostLineCount = g.Count(si => !SaleCostBasis.HasSnapshot(si)),
                        Profit = sales - cost,
                        ProfitMargin = sales > 0 ? (sales - cost) / sales * 100 : 0
                    };
                })
                .OrderByDescending(p => p.Profit)
                .ToList();

            if (tenantId == 20 && fromDate < new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc))
            {
                var legacyProdProfits = await (from lii in _context.LegacyInvoiceItems.AsNoTracking()
                                               join li in _context.LegacyInvoices.AsNoTracking() on lii.LegacyInvoiceId equals li.Id
                                               where lii.TenantId == tenantId && !li.IsDeleted && li.InvoiceDate >= fromDate && li.InvoiceDate <= toDate
                                               group lii by new { lii.DestinationProductId, Name = lii.ProductName } into g
                                               select new ProductProfitDto
                                               {
                                                   ProductId = g.Key.DestinationProductId ?? 0,
                                                   ProductName = g.Key.Name,
                                                   QuantitySold = g.Sum(x => x.Quantity),
                                                   TotalSales = g.Sum(x => x.LineTotal),
                                                   TotalCost = 0,
                                                   EstimatedCostLineCount = 0,
                                                   Profit = g.Sum(x => x.LineTotal),
                                                   ProfitMargin = 100
                                               }).ToListAsync();

                var map = productProfits.ToDictionary(p => p.ProductName, p => p);
                foreach (var lp in legacyProdProfits)
                {
                    if (map.TryGetValue(lp.ProductName, out var exP))
                    {
                        exP.TotalSales += lp.TotalSales;
                        exP.QuantitySold += lp.QuantitySold;
                        exP.Profit += lp.Profit;
                    }
                    else
                    {
                        map[lp.ProductName] = lp;
                    }
                }
                productProfits = map.Values.OrderByDescending(p => p.TotalSales).ToList();
            }

            return productProfits;`;

content = content.replace(prodTarget.replace(/\r\n/g, '\n'), prodReplacement.replace(/\r\n/g, '\n'));

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched ProfitService.cs');

