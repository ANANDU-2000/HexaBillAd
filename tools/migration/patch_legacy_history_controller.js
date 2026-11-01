const fs = require('fs');

let file = fs.readFileSync('backend/HexaBill.Api/Modules/Legacy/LegacyHistoryController.cs', 'utf8');
file = file.replace(/\r\n/g, '\n');

// 1. GetInvoices pageSize
file = file.replace(
`                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 100);

                var query = _context.LegacyInvoices.AsNoTracking().Where(i => i.TenantId == tenantId);`,
`                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 1000);

                var query = _context.LegacyInvoices.AsNoTracking().Where(i => i.TenantId == tenantId);`
);

// 2. GetPayments pageSize
file = file.replace(
`                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 100);

                var query = from p in _context.LegacyPayments.AsNoTracking().Where(p => p.TenantId == tenantId)`,
`                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 1000);

                var query = from p in _context.LegacyPayments.AsNoTracking().Where(p => p.TenantId == tenantId)`
);

// 3. GetUnifiedInvoices
const unifiedSigTarget = `        public async Task<ActionResult<ApiResponse<PagedResponse<UnifiedInvoiceSummaryDto>>>> GetUnifiedInvoices(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25,
            [FromQuery] string? search = null,
            [FromQuery] string? company = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)`;

const unifiedSigRepl = `        public async Task<ActionResult<ApiResponse<PagedResponse<UnifiedInvoiceSummaryDto>>>> GetUnifiedInvoices(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25,
            [FromQuery] string? search = null,
            [FromQuery] string? company = null,
            [FromQuery] int? customerId = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)`;

if (!file.includes(unifiedSigTarget)) {
    console.error('unifiedSigTarget not found!');
    process.exit(1);
}
file = file.replace(unifiedSigTarget, unifiedSigRepl);

file = file.replace(
`                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 100);

                var includeFrozenHub = string.IsNullOrWhiteSpace(company) || company.Equals("FROZENHUB", StringComparison.OrdinalIgnoreCase);`,
`                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 1000);

                var includeFrozenHub = string.IsNullOrWhiteSpace(company) || company.Equals("FROZENHUB", StringComparison.OrdinalIgnoreCase);`
);

// Add customerId filter to baseFh and baseLegacy
file = file.replace(
`                    if (toDate.HasValue)
                    {
                        var toUtc = DateTime.SpecifyKind(toDate.Value, DateTimeKind.Utc);
                        baseFh = baseFh.Where(s => s.InvoiceDate <= toUtc);
                    }`,
`                    if (toDate.HasValue)
                    {
                        var toUtc = DateTime.SpecifyKind(toDate.Value, DateTimeKind.Utc);
                        baseFh = baseFh.Where(s => s.InvoiceDate <= toUtc);
                    }
                    if (customerId.HasValue && customerId.Value > 0)
                    {
                        baseFh = baseFh.Where(s => s.CustomerId == customerId.Value);
                    }`
);

file = file.replace(
`                    if (toDate.HasValue)
                    {
                        var toUtc = DateTime.SpecifyKind(toDate.Value, DateTimeKind.Utc);
                        baseLegacy = baseLegacy.Where(i => i.InvoiceDate <= toUtc);
                    }`,
`                    if (toDate.HasValue)
                    {
                        var toUtc = DateTime.SpecifyKind(toDate.Value, DateTimeKind.Utc);
                        baseLegacy = baseLegacy.Where(i => i.InvoiceDate <= toUtc);
                    }
                    if (customerId.HasValue && customerId.Value > 0)
                    {
                        baseLegacy = baseLegacy.Where(i => i.DestinationCustomerId == customerId.Value || i.SourceCustomerId == customerId.Value);
                    }`
);

file = file.replace(/\n/g, '\r\n');
fs.writeFileSync('backend/HexaBill.Api/Modules/Legacy/LegacyHistoryController.cs', file, 'utf8');
console.log('LegacyHistoryController.cs patched successfully!');

