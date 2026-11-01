const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../../backend/HexaBill.Api/Modules/Reports/ReportService.cs');
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/\s*Calculate summary totals - CORRECTED CALCULATIONS[\r\n\s]+[\s\S]*?TotalSalesVat = sales\.Sum\(s => s\.VatTotal\),/;

const replacement = `// Calculate summary totals - CORRECTED CALCULATIONS (operating + historical)
            // 1. Total Sales = Sum of GrandTotal from all sales entries in date range
            var totalSales = ledgerEntries.Where(e => e.Type == "Sale").Sum(e => e.GrandTotal);
            
            // 2. Total Payments = Sum of paidAmount across sales entries in this period
            var totalPayments = ledgerEntries.Where(e => e.Type == "Sale").Sum(e => e.PaidAmount);
            var directPaymentsSum = ledgerEntries.Where(e => e.Type == "Payment").Sum(e => e.GrandTotal);
            if (totalPayments <= 0 && directPaymentsSum > 0)
            {
                totalPayments = directPaymentsSum;
            }
            totalPayments = Math.Min(totalPayments, totalSales);
            
            // 3. Real Pending = Sum of unpaid amounts (GrandTotal - PaidAmount) from sales only
            var totalRealPending = ledgerEntries
                .Where(e => e.Type == "Sale")
                .Sum(e => e.RealPending);
            
            // 4. Total Real Got Payment = Total Payments
            var totalRealGotPayment = totalPayments;
            
            // 5. Total Returns and Net Sales (ERP)
            var totalReturns = returns.Sum(r => r.GrandTotal);
            var netSales = totalSales - totalReturns;

            // Refunds paid (money out) in period - so balance = Sales - Payments - Returns + RefundsPaid
            var refundsPaid = await _context.Payments
                .Where(p => p.TenantId == tenantId && p.SaleReturnId != null && p.PaymentDate >= from && p.PaymentDate <= to)
                .SumAsync(p => (decimal?)p.Amount) ?? 0m;

            // 6. Pending Balance = Total Sales - Total Payments - Total Returns + RefundsPaid
            var pendingBalance = totalRealPending;
            var netCashIn = totalPayments - refundsPaid;

            return new SalesLedgerReportDto
            {
                Entries = ledgerEntries,
                Summary = new SalesLedgerSummary
                {
                    TotalDebit = totalRealPending,
                    TotalCredit = totalRealGotPayment,
                    OutstandingBalance = pendingBalance,
                    TotalSales = totalSales,
                    TotalPayments = totalPayments,
                    TotalReturns = totalReturns,
                    NetSales = netSales,
                    RefundsPaid = refundsPaid,
                    NetCashIn = netCashIn,
                    TotalSalesVat = ledgerEntries.Where(e => e.Type == "Sale").Sum(e => e.VatTotal),`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('ReportService.cs summary totals successfully patched!');
} else {
  console.error('Regex match failed for summary totals');
  process.exit(1);
}

