const fs = require('fs');

let file = fs.readFileSync('backend/HexaBill.Api/Modules/Payments/PaymentService.cs', 'utf8');
file = file.replace(/\r\n/g, '\n');

const target = `            return rows
                .Select(s => new Models.OutstandingInvoiceDto
                {
                    Id = s.Id,
                    InvoiceNo = s.InvoiceNo,
                    InvoiceDate = s.InvoiceDate,
                    GrandTotal = s.GrandTotal,
                    PaidAmount = s.PaidAmount,
                    BalanceAmount = InvoiceReceivables.Outstanding(s.GrandTotal, s.PaidAmount, s.Returned),
                    PaymentStatus = s.PaymentStatus.ToString(),
                    DaysOverdue = (int)(DateTime.UtcNow - s.InvoiceDate).TotalDays
                })
                .Where(s => s.BalanceAmount > SalePaymentHelpers.SettlementToleranceAed)
                .OrderBy(s => s.InvoiceDate)
                .ToList();`;

const replacement = `            var list = rows
                .Select(s => new Models.OutstandingInvoiceDto
                {
                    Id = s.Id,
                    InvoiceNo = s.InvoiceNo,
                    InvoiceDate = s.InvoiceDate,
                    GrandTotal = s.GrandTotal,
                    PaidAmount = s.PaidAmount,
                    BalanceAmount = InvoiceReceivables.Outstanding(s.GrandTotal, s.PaidAmount, s.Returned),
                    PaymentStatus = s.PaymentStatus.ToString(),
                    DaysOverdue = (int)(DateTime.UtcNow - s.InvoiceDate).TotalDays,
                    IsLegacy = false
                })
                .Where(s => s.BalanceAmount > SalePaymentHelpers.SettlementToleranceAed)
                .ToList();

            // Include pending legacy invoices for mapped customer
            var legacyPending = await _context.LegacyInvoices
                .AsNoTracking()
                .Where(i => i.TenantId == tenantId && !i.IsDeleted &&
                           (i.DestinationCustomerId == customerId || i.SourceCustomerId == customerId) &&
                           i.OutstandingCalculated > SalePaymentHelpers.SettlementToleranceAed)
                .OrderBy(i => i.InvoiceDate)
                .ToListAsync();

            foreach (var leg in legacyPending)
            {
                var dueDate = leg.DueDate ?? leg.InvoiceDate.AddDays(30);
                var daysOverdue = dueDate < DateTime.Today ? (DateTime.Today - dueDate).Days : 0;
                list.Add(new Models.OutstandingInvoiceDto
                {
                    Id = leg.Id,
                    CustomerId = customerId,
                    InvoiceNo = leg.LegacyInvoiceNumber,
                    InvoiceDate = leg.InvoiceDate,
                    GrandTotal = leg.GrandTotal,
                    PaidAmount = leg.PaidAmount,
                    BalanceAmount = leg.OutstandingCalculated,
                    PaymentStatus = leg.PaidAmount > 0 ? "Partial" : "Pending",
                    DaysOverdue = daysOverdue,
                    IsLegacy = true,
                    LegacyInvoiceId = leg.Id
                });
            }

            return list.OrderBy(s => s.InvoiceDate).ToList();`;

if (!file.includes(target)) {
    console.error('Target not found in PaymentService.cs!');
    process.exit(1);
}

file = file.replace(target, replacement);
file = file.replace(/\n/g, '\r\n');
fs.writeFileSync('backend/HexaBill.Api/Modules/Payments/PaymentService.cs', file, 'utf8');
console.log('PaymentService.cs patched successfully!');

