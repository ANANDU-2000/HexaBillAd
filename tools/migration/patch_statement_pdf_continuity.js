const fs = require('fs');
const file = 'backend/HexaBill.Api/Modules/Customers/CustomerService.cs';
let content = fs.readFileSync(file, 'utf8');

const target1 = `            decimal baseOpeningBalance = 0m;
            var legacyOpening = await _context.LegacyOpeningReceivables.AsNoTracking()
                .FirstOrDefaultAsync(o => o.DestinationCustomerId == customerId && o.TenantId == tenantId);
            if (legacyOpening != null && legacyOpening.OpeningBalance > 0)
            {
                baseOpeningBalance = legacyOpening.OpeningBalance;
            }

            // Opening balance = baseOpeningBalance + Sales (debit) - Payments (credit) - Returns (credit)
            var openingBalance = baseOpeningBalance + openingSales - openingPayments - openingSalesReturns;`;

const replacement1 = `            decimal baseOpeningBalance = 0m;
            var legacyOpening = await _context.LegacyOpeningReceivables.AsNoTracking()
                .FirstOrDefaultAsync(o => o.DestinationCustomerId == customerId && o.TenantId == tenantId);
            if (legacyOpening != null && legacyOpening.OpeningBalance > 0)
            {
                baseOpeningBalance = legacyOpening.OpeningBalance;
            }

            // Query legacy Starplus invoices and payments for customer continuity (Tenant 20)
            var legacyInvoices = await _context.LegacyInvoices.AsNoTracking()
                .Where(i => i.TenantId == tenantId && !i.IsDeleted &&
                           (i.DestinationCustomerId == customerId || i.SourceCustomerId == customerId))
                .OrderBy(i => i.InvoiceDate)
                .ThenBy(i => i.Id)
                .ToListAsync();

            var legacyPayments = await _context.LegacyPayments.AsNoTracking()
                .Where(p => p.TenantId == tenantId &&
                           (p.DestinationCustomerId == customerId || p.SourceCustomerId == customerId))
                .OrderBy(p => p.PaymentDate)
                .ThenBy(p => p.Id)
                .ToListAsync();

            var cutoverUtc = new DateTime(2026, 10, 31, 23, 59, 59, DateTimeKind.Utc);
            bool hasLegacyData = legacyInvoices.Count > 0 || legacyPayments.Count > 0;
            bool includesLegacyPeriod = hasLegacyData && (fromDate <= cutoverUtc);

            decimal openingBalance;
            if (includesLegacyPeriod)
            {
                var priorLegacyDebits = legacyInvoices
                    .Where(i => i.InvoiceDate < fromDate)
                    .Sum(i => i.GrandTotal);

                var priorLegacyCredits = legacyPayments
                    .Where(p => p.Status.Equals("Cleared", StringComparison.OrdinalIgnoreCase) && p.PaymentDate < fromDate)
                    .Sum(p => p.Amount);

                openingBalance = (priorLegacyDebits - priorLegacyCredits) + (openingSales - openingPayments - openingSalesReturns);
            }
            else
            {
                openingBalance = baseOpeningBalance + openingSales - openingPayments - openingSalesReturns;
            }`;

const target2 = `                // Use grouped transactions instead of allTransactions
                allTransactions = groupedTransactions;`;

const replacement2 = `                if (includesLegacyPeriod)
                {
                    var legInvsInRange = legacyInvoices
                        .Where(i => i.InvoiceDate >= fromDate && i.InvoiceDate <= toEnd)
                        .OrderBy(i => i.InvoiceDate).ThenBy(i => i.Id)
                        .ToList();

                    foreach (var leg in legInvsInRange)
                    {
                        var legStatus = leg.OutstandingCalculated <= SalePaymentHelpers.SettlementToleranceAed ? "Paid"
                            : leg.PaidAmount > 0 ? "Partial" : "Unpaid";

                        groupedTransactions.Add((
                            leg.InvoiceDate,
                            leg.LegacyInvoiceNumber,
                            leg.LegacyInvoiceNumber,
                            leg.GrandTotal,
                            0m,
                            legStatus,
                            leg.PaidAmount,
                            leg.OutstandingCalculated,
                            ""
                        ));

                        var linkedPayments = legacyPayments
                            .Where(p => p.LegacyInvoiceId == leg.Id && p.PaymentDate >= fromDate && p.PaymentDate <= toEnd && p.Status.Equals("Cleared", StringComparison.OrdinalIgnoreCase))
                            .OrderBy(p => p.PaymentDate).ThenBy(p => p.Id)
                            .ToList();

                        foreach (var lp in linkedPayments)
                        {
                            groupedTransactions.Add((
                                lp.PaymentDate,
                                leg.LegacyInvoiceNumber,
                                leg.LegacyInvoiceNumber,
                                0m,
                                lp.Amount,
                                "",
                                0m,
                                0m,
                                lp.Mode
                            ));
                        }
                    }

                    var standaloneLegPayments = legacyPayments
                        .Where(p => (!p.LegacyInvoiceId.HasValue || !legacyInvoices.Any(i => i.Id == p.LegacyInvoiceId.Value)) &&
                                   p.PaymentDate >= fromDate && p.PaymentDate <= toEnd &&
                                   p.Status.Equals("Cleared", StringComparison.OrdinalIgnoreCase))
                        .OrderBy(p => p.PaymentDate).ThenBy(p => p.Id)
                        .ToList();

                    foreach (var slp in standaloneLegPayments)
                    {
                        var refText = slp.Reference ?? "Historical Payment";
                        groupedTransactions.Add((
                            slp.PaymentDate,
                            refText,
                            refText,
                            0m,
                            slp.Amount,
                            "",
                            0m,
                            0m,
                            slp.Mode
                        ));
                    }
                }

                // Use grouped transactions sorted chronologically
                allTransactions = groupedTransactions.OrderBy(t => t.Date).ToList();`;

const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget1 = target1.replace(/\r\n/g, '\n');
const normalizedReplacement1 = replacement1.replace(/\r\n/g, '\n');
const normalizedTarget2 = target2.replace(/\r\n/g, '\n');
const normalizedReplacement2 = replacement2.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget1) && normalizedContent.includes(normalizedTarget2)) {
  let updated = normalizedContent.replace(normalizedTarget1, normalizedReplacement1);
  updated = updated.replace(normalizedTarget2, normalizedReplacement2);
  fs.writeFileSync(file, updated, 'utf8');
  console.log('Successfully patched CustomerService.cs for Statement PDF continuity!');
} else {
  console.error('Target blocks not found in CustomerService.cs');
  if (!normalizedContent.includes(normalizedTarget1)) console.error('Failed on Target 1');
  if (!normalizedContent.includes(normalizedTarget2)) console.error('Failed on Target 2');
}

