const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../../backend/HexaBill.Api/Modules/Reports/ReportService.cs');
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/\s*Sort by date, then by type \(Sale=0, Return=1, Payment=2\)[\r\n\s]+ledgerEntries = ledgerEntries[\r\n\s]+\.OrderBy\(e => e\.Date\)[\r\n\s]+\.ThenBy\(e => e\.Type == "Sale" \? 0 : e\.Type == "Return" \? 1 : 2\)[\r\n\s]+\.ToList\(\);/;

const replacement = `            // Tenant 20 (FrozenHub 1) Starplus historical business continuity:
            // Include legacy invoices and cleared payments when date range covers before cutover
            var cutoverLimit = new DateTime(2026, 10, 31, 23, 59, 59, DateTimeKind.Utc);
            if (tenantId == 20 && from <= cutoverLimit && !branchId.HasValue && !routeId.HasValue && !staffId.HasValue)
            {
                var legacyInvoices = await _context.LegacyInvoices.AsNoTracking()
                    .Where(i => i.TenantId == tenantId && !i.IsDeleted && i.InvoiceDate >= from && i.InvoiceDate <= to)
                    .OrderBy(i => i.InvoiceDate)
                    .ToListAsync();

                foreach (var leg in legacyInvoices)
                {
                    var legCustId = leg.DestinationCustomerId;
                    var custName = !string.IsNullOrWhiteSpace(leg.CustomerName) 
                        ? leg.CustomerName 
                        : (legCustId.HasValue && customers.ContainsKey(legCustId.Value) ? customers[legCustId.Value] : "Cash Customer");
                    
                    var realPending = leg.OutstandingCalculated > SalePaymentHelpers.SettlementToleranceAed ? leg.OutstandingCalculated : 0m;
                    var paidAmount = leg.PaidAmount;
                    var status = realPending <= SalePaymentHelpers.SettlementToleranceAed ? "Paid" : (paidAmount > 0 ? "Partial" : "Unpaid");
                    var mode = status == "Paid" ? "CASH" : (status == "Partial" ? "PARTIAL" : "NOT PAID");

                    var customerKey = legCustId ?? 0;
                    if (!customerBalances.ContainsKey(customerKey))
                    {
                        customerBalances[customerKey] = 0m;
                    }
                    customerBalances[customerKey] += leg.GrandTotal;

                    ledgerEntries.Add(new SalesLedgerEntryDto
                    {
                        Date = leg.InvoiceDate,
                        Type = "Sale",
                        InvoiceNo = leg.LegacyInvoiceNumber,
                        CustomerId = legCustId,
                        CustomerName = custName,
                        PaymentMode = mode,
                        GrandTotal = leg.GrandTotal,
                        PaidAmount = paidAmount,
                        RealPending = realPending,
                        RealGotPayment = paidAmount,
                        Status = status,
                        CustomerBalance = customerBalances[customerKey],
                        PlanDate = leg.DueDate ?? leg.InvoiceDate.AddDays(30),
                        SaleId = null,
                        Subtotal = leg.Subtotal,
                        VatTotal = leg.VatTotal
                    });
                }

                var legacyPayments = await _context.LegacyPayments.AsNoTracking()
                    .Where(p => p.TenantId == tenantId && p.Status == "Cleared" && p.PaymentDate >= from && p.PaymentDate <= to)
                    .OrderBy(p => p.PaymentDate)
                    .ToListAsync();

                foreach (var legPay in legacyPayments)
                {
                    var legCustId = legPay.DestinationCustomerId;
                    var custName = !string.IsNullOrWhiteSpace(legPay.CustomerName)
                        ? legPay.CustomerName
                        : (legCustId.HasValue && customers.ContainsKey(legCustId.Value) ? customers[legCustId.Value] : "Cash Customer");
                    
                    var customerKey = legCustId ?? 0;
                    if (!customerBalances.ContainsKey(customerKey))
                    {
                        customerBalances[customerKey] = 0m;
                    }
                    customerBalances[customerKey] -= legPay.Amount;

                    ledgerEntries.Add(new SalesLedgerEntryDto
                    {
                        Date = legPay.PaymentDate,
                        Type = "Payment",
                        InvoiceNo = legPay.InvoiceNumber ?? "-",
                        CustomerId = legCustId,
                        CustomerName = custName,
                        PaymentMode = (legPay.PaymentMethod ?? "CASH").ToUpper(),
                        GrandTotal = legPay.Amount,
                        PaidAmount = 0m,
                        RealPending = 0m,
                        RealGotPayment = legPay.Amount,
                        Status = "Paid",
                        PaymentLineStatus = "CLEARED",
                        IsSettlementAdjustment = false,
                        CustomerBalance = customerBalances[customerKey],
                        PlanDate = null,
                        PaymentId = null,
                        SaleId = null,
                        Subtotal = 0m,
                        VatTotal = 0m
                    });
                }
            }

            // Sort by date, then by type (Sale=0, Return=1, Payment=2)
            ledgerEntries = ledgerEntries
                .OrderBy(e => e.Date)
                .ThenBy(e => e.Type == "Sale" ? 0 : e.Type == "Return" ? 1 : 2)
                .ToList();`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('ReportService.cs successfully patched with unified legacy sales & payments!');
} else {
  console.error('Regex match failed in ReportService.cs');
  process.exit(1);
}
