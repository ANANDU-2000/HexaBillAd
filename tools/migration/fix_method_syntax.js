const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../../backend/HexaBill.Api/Modules/Reports/ReportService.cs');
let content = fs.readFileSync(file, 'utf8');

const regex = /var legacyPayments = await \(from p in _context\.LegacyPayments[\s\S]*?\.ToListAsync\(\);/;

const replacement = `var legacyPayments = await _context.LegacyPayments.AsNoTracking()
                    .Where(p => p.TenantId == tenantId && p.Status == "Cleared" && p.PaymentDate >= from && p.PaymentDate <= to)
                    .OrderBy(p => p.PaymentDate)
                    .Select(p => new {
                        p.Id,
                        p.PaymentDate,
                        p.Amount,
                        p.Mode,
                        p.DestinationCustomerId,
                        InvoiceNo = p.LegacyInvoice != null ? p.LegacyInvoice.LegacyInvoiceNumber : null
                    })
                    .ToListAsync();`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  // and in loop: custName
  content = content.replace(
    'var custName = !string.IsNullOrWhiteSpace(legPay.CustName)\n                        ? legPay.CustName\n                        : (legCustId.HasValue && customers.ContainsKey(legCustId.Value) ? customers[legCustId.Value] : "Cash Customer");',
    'var custName = legCustId.HasValue && customers.ContainsKey(legCustId.Value) ? customers[legCustId.Value] : "Cash Customer";'
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log('Replaced with method syntax!');
} else {
  console.error('Regex match failed');
  process.exit(1);
}

