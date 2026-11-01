const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../../backend/HexaBill.Api/Modules/Reports/ReportService.cs');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'from p in _context.LegacyPayments.AsNoTracking().Where(p => p.TenantId == tenantId && p.Status == "Cleared" && p.PaymentDate >= from && p.PaymentDate <= to)',
  'from p in _context.LegacyPayments.AsNoTracking()\n                    where p.TenantId == tenantId && p.Status == "Cleared" && p.PaymentDate >= from && p.PaymentDate <= to'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed LINQ range variable p');

