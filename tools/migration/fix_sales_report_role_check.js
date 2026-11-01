const fs = require('fs');
const path = require('path');

const filePath = path.resolve('backend/HexaBill.Api/Modules/Reports/ReportService.cs');
let content = fs.readFileSync(filePath, 'utf8');

const target = 'if (tenantId == 20 && fromDate < cutoverUtc && !branchId.HasValue && !routeId.HasValue && !userIdForStaff.HasValue)';
const replacement = 'if (tenantId == 20 && fromDate < cutoverUtc && !branchId.HasValue && !routeId.HasValue && !string.Equals(roleForStaff, "Staff", StringComparison.OrdinalIgnoreCase))';

if (!content.includes(target)) {
    console.error('Target not found in ReportService.cs');
    process.exit(1);
}

content = content.replace(target, replacement);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed role check in GetSalesReportAsync!');

