const fs = require('fs');

let file = fs.readFileSync('backend/HexaBill.Api/Modules/Reports/ReportService.cs', 'utf8');
file = file.replace(/\r\n/g, '\n');

const target = `            var approvedReturns = InvoiceReceivables.ApprovedReturns(_context, tenantId);
            var query = from s in _context.Sales
                        join c in _context.Customers on s.CustomerId equals c.Id into cGrp
                        from c in cGrp.DefaultIfEmpty()
                        let returned = approvedReturns.Where(r => r.SaleId == s.Id).Sum(r => (decimal?)r.GrandTotal) ?? 0m
                        let balance = s.GrandTotal - s.PaidAmount - returned
                        where !s.IsDeleted
                              && (s.PaymentStatus == SalePaymentStatus.Pending || s.PaymentStatus == SalePaymentStatus.Partial)
                              && balance > SalePaymentHelpers.SettlementToleranceAed
                        select new { s, c, Balance = balance };

            if (tenantId > 0)
                query = query.Where(x => x.s.TenantId == tenantId);

            if (fromDate.HasValue && toDate.HasValue)
            {
                var from = new DateTime(fromDate.Value.Year, fromDate.Value.Month, fromDate.Value.Day, 0, 0, 0, DateTimeKind.Utc);
                var toEnd = toDate.Value.AddDays(1).AddTicks(-1).ToUtcKind();
                query = query.Where(x => x.s.InvoiceDate >= from && x.s.InvoiceDate < toEnd);
            }

            if (customerId.HasValue)
                query = query.Where(x => x.s.CustomerId == customerId.Value);

            if (!string.IsNullOrEmpty(status))
            {
                var statusLower = status.ToLower();
                if (statusLower == "pending")
                    query = query.Where(x => x.s.PaymentStatus == SalePaymentStatus.Pending);
                else if (statusLower == "partial")
                    query = query.Where(x => x.s.PaymentStatus == SalePaymentStatus.Partial);
                else if (statusLower == "overdue")
                {
                    var cutoff = today.AddDays(-30);
                    query = query.Where(x => x.s.InvoiceDate < cutoff && x.s.PaymentStatus != SalePaymentStatus.Paid);
                }
            }

            if (!string.IsNullOrEmpty(search))
                query = query.Where(x => x.s.InvoiceNo.Contains(search) || (x.c != null && x.c.Name.Contains(search)));

            // Get total count before pagination
            var totalCount = await query.CountAsync();

            // Project to DTO in database, then paginate
            // AUDIT-6 FIX: Move sorting to database query before pagination
            var list = await query
                .Select(x => new PendingBillDto
                {
                    Id = x.s.Id,
                    InvoiceNo = x.s.InvoiceNo,
                    InvoiceDate = x.s.InvoiceDate,
                    DueDate = x.s.DueDate ?? x.s.InvoiceDate.AddDays(30),
                    CustomerId = x.s.CustomerId,
                    CustomerName = x.c != null ? x.c.Name : null,
                    GrandTotal = x.s.GrandTotal,
                    PaidAmount = x.s.PaidAmount,
                    BalanceAmount = x.Balance,
                    PaymentStatus = x.s.PaymentStatus.ToString(),
                    DaysOverdue = 0 // Will be calculated below
                })
                .OrderByDescending(x => x.InvoiceDate) // Sort by date first (simpler for DB)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();`;

const replacement = `            var approvedReturns = InvoiceReceivables.ApprovedReturns(_context, tenantId);
            var fhBase = from s in _context.Sales
                         join c in _context.Customers on s.CustomerId equals c.Id into cGrp
                         from c in cGrp.DefaultIfEmpty()
                         let returned = approvedReturns.Where(r => r.SaleId == s.Id).Sum(r => (decimal?)r.GrandTotal) ?? 0m
                         let balance = s.GrandTotal - s.PaidAmount - returned
                         where !s.IsDeleted
                               && (s.PaymentStatus == SalePaymentStatus.Pending || s.PaymentStatus == SalePaymentStatus.Partial)
                               && balance > SalePaymentHelpers.SettlementToleranceAed
                         select new { s, c, Balance = balance };

            if (tenantId > 0)
                fhBase = fhBase.Where(x => x.s.TenantId == tenantId);

            if (fromDate.HasValue && toDate.HasValue)
            {
                var from = new DateTime(fromDate.Value.Year, fromDate.Value.Month, fromDate.Value.Day, 0, 0, 0, DateTimeKind.Utc);
                var toEnd = toDate.Value.AddDays(1).AddTicks(-1).ToUtcKind();
                fhBase = fhBase.Where(x => x.s.InvoiceDate >= from && x.s.InvoiceDate < toEnd);
            }

            if (customerId.HasValue)
                fhBase = fhBase.Where(x => x.s.CustomerId == customerId.Value);

            if (!string.IsNullOrEmpty(status))
            {
                var statusLower = status.ToLower();
                if (statusLower == "pending")
                    fhBase = fhBase.Where(x => x.s.PaymentStatus == SalePaymentStatus.Pending);
                else if (statusLower == "partial")
                    fhBase = fhBase.Where(x => x.s.PaymentStatus == SalePaymentStatus.Partial);
                else if (statusLower == "overdue")
                {
                    var cutoff = today.AddDays(-30);
                    fhBase = fhBase.Where(x => x.s.InvoiceDate < cutoff && x.s.PaymentStatus != SalePaymentStatus.Paid);
                }
            }

            if (!string.IsNullOrEmpty(search))
                fhBase = fhBase.Where(x => x.s.InvoiceNo.Contains(search) || (x.c != null && x.c.Name.Contains(search)));

            var fhQuery = fhBase.Select(x => new PendingBillDto
            {
                Id = x.s.Id,
                InvoiceNo = x.s.InvoiceNo,
                InvoiceDate = x.s.InvoiceDate,
                DueDate = x.s.DueDate ?? x.s.InvoiceDate.AddDays(30),
                CustomerId = x.s.CustomerId,
                CustomerName = x.c != null ? x.c.Name : null,
                GrandTotal = x.s.GrandTotal,
                PaidAmount = x.s.PaidAmount,
                BalanceAmount = x.Balance,
                PaymentStatus = x.s.PaymentStatus.ToString(),
                DaysOverdue = 0,
                IsLegacy = false
            });

            // Include historical Starplus pending bills
            var legBase = _context.LegacyInvoices.AsNoTracking()
                .Where(i => !i.IsDeleted && i.OutstandingCalculated > SalePaymentHelpers.SettlementToleranceAed);

            if (tenantId > 0)
                legBase = legBase.Where(i => i.TenantId == tenantId);

            if (fromDate.HasValue && toDate.HasValue)
            {
                var from = new DateTime(fromDate.Value.Year, fromDate.Value.Month, fromDate.Value.Day, 0, 0, 0, DateTimeKind.Utc);
                var toEnd = toDate.Value.AddDays(1).AddTicks(-1).ToUtcKind();
                legBase = legBase.Where(i => i.InvoiceDate >= from && i.InvoiceDate < toEnd);
            }

            if (customerId.HasValue)
                legBase = legBase.Where(i => i.DestinationCustomerId == customerId.Value || i.SourceCustomerId == customerId.Value);

            if (!string.IsNullOrEmpty(status))
            {
                var statusLower = status.ToLower();
                if (statusLower == "pending")
                    legBase = legBase.Where(i => i.PaidAmount <= 0);
                else if (statusLower == "partial")
                    legBase = legBase.Where(i => i.PaidAmount > 0);
                else if (statusLower == "overdue")
                {
                    var cutoff = today.AddDays(-30);
                    legBase = legBase.Where(i => i.InvoiceDate < cutoff);
                }
            }

            if (!string.IsNullOrEmpty(search))
                legBase = legBase.Where(i => i.LegacyInvoiceNumber.Contains(search) || (i.CustomerName != null && i.CustomerName.Contains(search)));

            var legQuery = legBase.Select(i => new PendingBillDto
            {
                Id = i.Id,
                InvoiceNo = i.LegacyInvoiceNumber,
                InvoiceDate = i.InvoiceDate,
                DueDate = i.DueDate ?? i.InvoiceDate.AddDays(30),
                CustomerId = i.DestinationCustomerId ?? i.SourceCustomerId,
                CustomerName = i.CustomerName,
                GrandTotal = i.GrandTotal,
                PaidAmount = i.PaidAmount,
                BalanceAmount = i.OutstandingCalculated,
                PaymentStatus = i.PaidAmount > 0 ? "Partial" : "Pending",
                DaysOverdue = 0,
                IsLegacy = true
            });

            var combinedQuery = fhQuery.Concat(legQuery);

            // Get total count before pagination
            var totalCount = await combinedQuery.CountAsync();

            // Project to DTO in database, then paginate
            var list = await combinedQuery
                .OrderByDescending(x => x.InvoiceDate)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();`;

if (!file.includes(target)) {
    console.error('Target not found in ReportService.cs!');
    process.exit(1);
}

file = file.replace(target, replacement);
file = file.replace(/\n/g, '\r\n');
fs.writeFileSync('backend/HexaBill.Api/Modules/Reports/ReportService.cs', file, 'utf8');
console.log('ReportService.cs patched successfully!');

