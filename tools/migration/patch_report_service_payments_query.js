const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../../backend/HexaBill.Api/Modules/Reports/ReportService.cs');
let content = fs.readFileSync(file, 'utf8');

const regex = /var legacyPayments = await _context\.LegacyPayments\.AsNoTracking\(\)[\s\S]*?ledgerEntries\.Add\(new SalesLedgerEntryDto[\s\S]*?VatTotal = 0m[\r\n\s]+}\);[\r\n\s]+}/;

const replacement = `var legacyPayments = await (from p in _context.LegacyPayments.AsNoTracking().Where(p => p.TenantId == tenantId && p.Status == "Cleared" && p.PaymentDate >= from && p.PaymentDate <= to)
                    join inv in _context.LegacyInvoices.AsNoTracking() on p.LegacyInvoiceId equals inv.Id into invJoin
                    from inv in invJoin.DefaultIfEmpty()
                    join cust in _context.Customers.AsNoTracking() on p.DestinationCustomerId equals cust.Id into custJoin
                    from cust in custJoin.DefaultIfEmpty()
                    select new { 
                        p.Id, 
                        p.PaymentDate, 
                        p.Amount, 
                        p.Mode, 
                        p.DestinationCustomerId, 
                        InvoiceNo = inv != null ? inv.LegacyInvoiceNumber : null, 
                        CustName = cust != null ? cust.Name : null 
                    })
                    .OrderBy(p => p.PaymentDate)
                    .ToListAsync();

                foreach (var legPay in legacyPayments)
                {
                    var legCustId = legPay.DestinationCustomerId;
                    var custName = !string.IsNullOrWhiteSpace(legPay.CustName)
                        ? legPay.CustName
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
                        InvoiceNo = legPay.InvoiceNo ?? "-",
                        CustomerId = legCustId,
                        CustomerName = custName,
                        PaymentMode = (legPay.Mode ?? "CASH").ToUpper(),
                        GrandTotal = legPay.Amount,
                        PaidAmount = 0m,
                        RealPending = 0m,
                        RealGotPayment = legPay.Amount,
                        Status = "Paid",
                        PaymentLineStatus = "CLEARED",
                        IsSettlementAdjustment = false,
                        CustomerBalance = customerBalances[customerKey],
                        PlanDate = null,
                        PaymentId = legPay.Id,
                        SaleId = null,
                        Subtotal = 0m,
                        VatTotal = 0m
                    });
                }
            }`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('ReportService.cs legacyPayments query successfully corrected!');
} else {
  console.error('Regex match failed for legacyPayments query');
  process.exit(1);
}

