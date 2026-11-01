const fs = require('fs');

let file = fs.readFileSync('backend/HexaBill.Api/Modules/Customers/CustomerService.cs', 'utf8');
file = file.replace(/\r\n/g, '\n');

// 1. Update GetOutstandingInvoicesAsync
const getOutstandingTarget = `            foreach (var sale in sales)
            {
                // Use Sale.PaidAmount directly (maintained atomically by PaymentService)
                var paidAmount = sale.PaidAmount;
                var balanceAmount = InvoiceReceivables.Outstanding(sale.GrandTotal, paidAmount, approvedReturnBySale.GetValueOrDefault(sale.Id, 0m));

                // Only include if there's still a balance
                if (balanceAmount > SalePaymentHelpers.SettlementToleranceAed)
                {
                    // CRITICAL: Use DueDate from sale, fallback to 30 days if not set
                    var dueDate = sale.DueDate ?? sale.InvoiceDate.AddDays(30);
                    var daysOverdue = dueDate < DateTime.Today ? (DateTime.Today - dueDate).Days : 0;

                outstandingInvoices.Add(new Models.OutstandingInvoiceDto
                {
                    Id = sale.Id,
                    CustomerId = sale.CustomerId,
                    InvoiceNo = sale.InvoiceNo,
                    InvoiceDate = sale.InvoiceDate,
                    GrandTotal = sale.GrandTotal,
                    PaidAmount = paidAmount,
                    BalanceAmount = balanceAmount,
                    PaymentStatus = sale.PaymentStatus.ToString(),
                    DaysOverdue = daysOverdue
                });
                }
            }

            return outstandingInvoices.OrderByDescending(i => i.DaysOverdue).ThenByDescending(i => i.InvoiceDate).ToList();`;

const getOutstandingReplacement = `            foreach (var sale in sales)
            {
                // Use Sale.PaidAmount directly (maintained atomically by PaymentService)
                var paidAmount = sale.PaidAmount;
                var balanceAmount = InvoiceReceivables.Outstanding(sale.GrandTotal, paidAmount, approvedReturnBySale.GetValueOrDefault(sale.Id, 0m));

                // Only include if there's still a balance
                if (balanceAmount > SalePaymentHelpers.SettlementToleranceAed)
                {
                    // CRITICAL: Use DueDate from sale, fallback to 30 days if not set
                    var dueDate = sale.DueDate ?? sale.InvoiceDate.AddDays(30);
                    var daysOverdue = dueDate < DateTime.Today ? (DateTime.Today - dueDate).Days : 0;

                    outstandingInvoices.Add(new Models.OutstandingInvoiceDto
                    {
                        Id = sale.Id,
                        CustomerId = sale.CustomerId,
                        InvoiceNo = sale.InvoiceNo,
                        InvoiceDate = sale.InvoiceDate,
                        GrandTotal = sale.GrandTotal,
                        PaidAmount = paidAmount,
                        BalanceAmount = balanceAmount,
                        PaymentStatus = sale.PaymentStatus.ToString(),
                        DaysOverdue = daysOverdue,
                        IsLegacy = false
                    });
                }
            }

            // Include pending historical Starplus invoices for mapped customer
            var legacyPending = await _context.LegacyInvoices
                .AsNoTracking()
                .Where(i => i.TenantId == tenantId && !i.IsDeleted &&
                           (i.DestinationCustomerId == customerId || i.SourceCustomerId == customerId) &&
                           i.OutstandingCalculated > SalePaymentHelpers.SettlementToleranceAed)
                .OrderByDescending(i => i.InvoiceDate)
                .ToListAsync();

            foreach (var leg in legacyPending)
            {
                var dueDate = leg.DueDate ?? leg.InvoiceDate.AddDays(30);
                var daysOverdue = dueDate < DateTime.Today ? (DateTime.Today - dueDate).Days : 0;
                outstandingInvoices.Add(new Models.OutstandingInvoiceDto
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

            return outstandingInvoices.OrderByDescending(i => i.DaysOverdue).ThenByDescending(i => i.InvoiceDate).ToList();`;

if (!file.includes(getOutstandingTarget)) {
    console.error('getOutstandingTarget not found in CustomerService.cs!');
    process.exit(1);
}

file = file.replace(getOutstandingTarget, getOutstandingReplacement);

// 2. Update GetCustomerLedgerAsync transaction tuple and legacy queries
const tupleTarget = `            var allTransactions = new List<(DateTime Date, string Type, string InvoiceNo, string? PaymentMode, decimal Debit, decimal Credit, string Status, int? SaleId, int? PaymentId, string? Remarks, int? ReturnId)>();`;
const tupleReplacement = `            var allTransactions = new List<(DateTime Date, string Type, string InvoiceNo, string? PaymentMode, decimal Debit, decimal Credit, string Status, int? SaleId, int? PaymentId, string? Remarks, int? ReturnId, bool IsLegacy, int? LegacyInvoiceId, int? LegacyPaymentId)>();`;

if (!file.includes(tupleTarget)) {
    console.error('tupleTarget not found in CustomerService.cs!');
    process.exit(1);
}
file = file.replace(tupleTarget, tupleReplacement);

// Update allTransactions.Add calls in GetCustomerLedgerAsync
file = file.replace(
`                allTransactions.Add((
                    sale.InvoiceDate,
                    "Invoice",
                    sale.InvoiceNo,
                    (string?)null,
                    sale.GrandTotal,
                    0m,
                    status,
                    sale.Id,
                    (int?)null,
                    (string?)null,
                    (int?)null
                ));`,
`                allTransactions.Add((
                    sale.InvoiceDate,
                    "Invoice",
                    sale.InvoiceNo,
                    (string?)null,
                    sale.GrandTotal,
                    0m,
                    status,
                    sale.Id,
                    (int?)null,
                    (string?)null,
                    (int?)null,
                    false,
                    (int?)null,
                    (int?)null
                ));`
);

file = file.replace(
`                allTransactions.Add((
                    payment.PaymentDate,
                    "Payment",
                    invoiceNo,
                    payment.Mode.ToString(),
                    0m,
                    payment.Amount,
                    "",
                    payment.SaleId,
                    payment.Id,
                    payment.Reference,
                    (int?)null
                ));`,
`                allTransactions.Add((
                    payment.PaymentDate,
                    "Payment",
                    invoiceNo,
                    payment.Mode.ToString(),
                    0m,
                    payment.Amount,
                    "",
                    payment.SaleId,
                    payment.Id,
                    payment.Reference,
                    (int?)null,
                    false,
                    (int?)null,
                    (int?)null
                ));`
);

file = file.replace(
`                allTransactions.Add((
                    saleReturn.ReturnDate,
                    "Sale Return",
                    saleReturn.ReturnNo,
                    (string?)null,
                    0m,
                    saleReturn.GrandTotal,
                    refundStatus,
                    (int?)null,
                    (int?)null,
                    (string?)null,
                    saleReturn.Id
                ));`,
`                allTransactions.Add((
                    saleReturn.ReturnDate,
                    "Sale Return",
                    saleReturn.ReturnNo,
                    (string?)null,
                    0m,
                    saleReturn.GrandTotal,
                    refundStatus,
                    (int?)null,
                    (int?)null,
                    (string?)null,
                    saleReturn.Id,
                    false,
                    (int?)null,
                    (int?)null
                ));`
);

file = file.replace(
`                allTransactions.Add((
                    payment.PaymentDate,
                    "Refund",
                    "Refund",
                    payment.Mode.ToString(),
                    payment.Amount,
                    0m,
                    "Paid",
                    (int?)null,
                    payment.Id,
                    (string?)null,
                    payment.SaleReturnId
                ));`,
`                allTransactions.Add((
                    payment.PaymentDate,
                    "Refund",
                    "Refund",
                    payment.Mode.ToString(),
                    payment.Amount,
                    0m,
                    "Paid",
                    (int?)null,
                    payment.Id,
                    (string?)null,
                    payment.SaleReturnId,
                    false,
                    (int?)null,
                    (int?)null
                ));`
);

// 3. Update opening balance and legacy integration in GetCustomerLedgerAsync
const balanceTarget = `            // Determine approved opening balance (from Customer or LegacyOpeningReceivables)
            var customer = await _context.Customers.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == customerId && c.TenantId == tenantId);

            decimal baseOpeningBalance = 0m;
            var legacyOpening = await _context.LegacyOpeningReceivables.AsNoTracking()
                .FirstOrDefaultAsync(o => o.DestinationCustomerId == customerId && o.TenantId == tenantId);
            if (legacyOpening != null && legacyOpening.OpeningBalance > 0)
            {
                baseOpeningBalance = legacyOpening.OpeningBalance;
            }

            decimal startBalance = baseOpeningBalance;
            if (from.HasValue)
            {
                var priorSales = await _context.Sales
                    .Where(s => s.CustomerId.HasValue && s.CustomerId.Value == customerId && s.TenantId == tenantId && !s.IsDeleted && s.InvoiceDate < from.Value)
                    .SumAsync(s => (decimal?)s.GrandTotal) ?? 0m;

                var priorPayments = await _context.Payments
                    .Where(p => p.CustomerId.HasValue && p.CustomerId.Value == customerId && p.TenantId == tenantId && p.SaleReturnId == null && p.Status == PaymentStatus.CLEARED && p.PaymentDate < from.Value)
                    .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                var priorReturns = await _context.SaleReturns
                    .Where(sr => sr.CustomerId.HasValue && sr.CustomerId.Value == customerId && sr.TenantId == tenantId && sr.Status == ReturnStatus.Approved && sr.ReturnDate < from.Value)
                    .SumAsync(sr => (decimal?)sr.GrandTotal) ?? 0m;

                startBalance = baseOpeningBalance + priorSales - priorPayments - priorReturns;
            }

            var ledgerEntries = new List<CustomerLedgerEntry>();
            if (startBalance != 0 || (baseOpeningBalance != 0 && !from.HasValue))
            {
                ledgerEntries.Add(new CustomerLedgerEntry
                {
                    Date = from ?? (customer?.CreatedAt ?? DateTime.UtcNow),
                    Type = "Opening Balance",
                    Reference = "OPENING",
                    PaymentMode = null,
                    Remarks = from.HasValue
                        ? $"Opening Balance as of {from.Value:yyyy-MM-dd}"
                        : "Approved Cutover Opening Balance",
                    Debit = startBalance > 0 ? startBalance : 0m,
                    Credit = startBalance < 0 ? Math.Abs(startBalance) : 0m,
                    Balance = startBalance,
                    SaleId = null,
                    PaymentId = null,
                    ReturnId = null,
                    Status = "Cleared",
                    PaidAmount = 0
                });
            }

            var seenTransactions = new HashSet<(int? SaleId, int? PaymentId, int? ReturnId, DateTime Date, decimal Amount)>();
            decimal runningBalance = startBalance;

            foreach (var transaction in groupedTransactions)
            {
                var transactionKey = (transaction.SaleId, transaction.PaymentId, transaction.ReturnId, transaction.Date, transaction.Debit + transaction.Credit);
                if (seenTransactions.Contains(transactionKey))
                {
                    _logger.LogWarning("Duplicate ledger transaction skipped: SaleId={SaleId} PaymentId={PaymentId} ReturnId={ReturnId}", transaction.SaleId, transaction.PaymentId, transaction.ReturnId);
                    continue;
                }
                seenTransactions.Add(transactionKey);
                runningBalance += transaction.Debit - transaction.Credit;
                ledgerEntries.Add(new CustomerLedgerEntry
                {
                    Date = transaction.Date,
                    Type = transaction.Type,
                    Reference = transaction.InvoiceNo,
                    PaymentMode = transaction.PaymentMode,
                    Remarks = transaction.Remarks,
                    Debit = transaction.Debit,
                    Credit = transaction.Credit,
                    Balance = runningBalance,
                    SaleId = transaction.SaleId,
                    PaymentId = transaction.PaymentId,
                    ReturnId = transaction.ReturnId,
                    Status = transaction.Status,
                    PaidAmount = 0
                });
            }`;

const balanceReplacement = `            // Determine approved opening balance (from Customer or LegacyOpeningReceivables)
            var customer = await _context.Customers.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == customerId && c.TenantId == tenantId);

            decimal baseOpeningBalance = 0m;
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
            bool includesLegacyPeriod = hasLegacyData && (!from.HasValue || from.Value <= cutoverUtc);

            decimal startBalance = 0m;

            if (includesLegacyPeriod)
            {
                // Range includes or begins during historical period:
                // Historical invoices and cleared payments form the natural ledger transactions.
                // Do NOT double count cutover opening balance on top of historical invoices!
                if (from.HasValue)
                {
                    var priorLegacyDebits = legacyInvoices
                        .Where(i => i.InvoiceDate < from.Value)
                        .Sum(i => i.GrandTotal);

                    var priorLegacyCredits = legacyPayments
                        .Where(p => p.Status.Equals("Cleared", StringComparison.OrdinalIgnoreCase) && p.PaymentDate < from.Value)
                        .Sum(p => p.Amount);

                    var priorSales = await _context.Sales
                        .Where(s => s.CustomerId.HasValue && s.CustomerId.Value == customerId && s.TenantId == tenantId && !s.IsDeleted && s.InvoiceDate < from.Value)
                        .SumAsync(s => (decimal?)s.GrandTotal) ?? 0m;

                    var priorPayments = await _context.Payments
                        .Where(p => p.CustomerId.HasValue && p.CustomerId.Value == customerId && p.TenantId == tenantId && p.SaleReturnId == null && p.Status == PaymentStatus.CLEARED && p.PaymentDate < from.Value)
                        .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                    var priorReturns = await _context.SaleReturns
                        .Where(sr => sr.CustomerId.HasValue && sr.CustomerId.Value == customerId && sr.TenantId == tenantId && sr.Status == ReturnStatus.Approved && sr.ReturnDate < from.Value)
                        .SumAsync(sr => (decimal?)sr.GrandTotal) ?? 0m;

                    startBalance = (priorLegacyDebits - priorLegacyCredits) + (priorSales - priorPayments - priorReturns);
                }
                else
                {
                    startBalance = 0m;
                }

                // Add legacy invoices within [from, toEnd]
                foreach (var leg in legacyInvoices)
                {
                    if (from.HasValue && leg.InvoiceDate < from.Value) continue;
                    if (toEnd.HasValue && leg.InvoiceDate >= toEnd.Value) continue;
                    var status = leg.OutstandingCalculated <= SalePaymentHelpers.SettlementToleranceAed ? "Paid"
                        : leg.PaidAmount > 0 ? "Partial" : "Unpaid";
                    allTransactions.Add((
                        leg.InvoiceDate,
                        "Invoice",
                        leg.LegacyInvoiceNumber,
                        (string?)null,
                        leg.GrandTotal,
                        0m,
                        status,
                        (int?)null,
                        (int?)null,
                        leg.Notes,
                        (int?)null,
                        true,
                        leg.Id,
                        (int?)null
                    ));
                }

                // Add legacy payments within [from, toEnd]
                foreach (var legP in legacyPayments)
                {
                    if (!legP.Status.Equals("Cleared", StringComparison.OrdinalIgnoreCase)) continue;
                    if (from.HasValue && legP.PaymentDate < from.Value) continue;
                    if (toEnd.HasValue && legP.PaymentDate >= toEnd.Value) continue;
                    allTransactions.Add((
                        legP.PaymentDate,
                        "Payment",
                        legP.Reference ?? $"LP-{legP.SourcePaymentId}",
                        legP.Mode,
                        0m,
                        legP.Amount,
                        legP.Status,
                        (int?)null,
                        (int?)null,
                        legP.Reference,
                        (int?)null,
                        true,
                        (int?)null,
                        legP.Id
                    ));
                }
            }
            else
            {
                // Purely post-cutover period or customer without legacy data:
                // Start with baseOpeningBalance and accumulate operating sales/payments.
                startBalance = baseOpeningBalance;
                if (from.HasValue)
                {
                    var priorSales = await _context.Sales
                        .Where(s => s.CustomerId.HasValue && s.CustomerId.Value == customerId && s.TenantId == tenantId && !s.IsDeleted && s.InvoiceDate < from.Value)
                        .SumAsync(s => (decimal?)s.GrandTotal) ?? 0m;

                    var priorPayments = await _context.Payments
                        .Where(p => p.CustomerId.HasValue && p.CustomerId.Value == customerId && p.TenantId == tenantId && p.SaleReturnId == null && p.Status == PaymentStatus.CLEARED && p.PaymentDate < from.Value)
                        .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                    var priorReturns = await _context.SaleReturns
                        .Where(sr => sr.CustomerId.HasValue && sr.CustomerId.Value == customerId && sr.TenantId == tenantId && sr.Status == ReturnStatus.Approved && sr.ReturnDate < from.Value)
                        .SumAsync(sr => (decimal?)sr.GrandTotal) ?? 0m;

                    startBalance = baseOpeningBalance + priorSales - priorPayments - priorReturns;
                }
            }

            var ledgerEntries = new List<CustomerLedgerEntry>();
            if (startBalance != 0 || (!includesLegacyPeriod && baseOpeningBalance != 0 && !from.HasValue))
            {
                ledgerEntries.Add(new CustomerLedgerEntry
                {
                    Date = from ?? (customer?.CreatedAt ?? DateTime.UtcNow),
                    Type = "Opening Balance",
                    Reference = "OPENING",
                    PaymentMode = null,
                    Remarks = from.HasValue
                        ? $"Opening Balance as of {from.Value:yyyy-MM-dd}"
                        : "Approved Cutover Opening Balance",
                    Debit = startBalance > 0 ? startBalance : 0m,
                    Credit = startBalance < 0 ? Math.Abs(startBalance) : 0m,
                    Balance = startBalance,
                    SaleId = null,
                    PaymentId = null,
                    ReturnId = null,
                    Status = "Cleared",
                    PaidAmount = 0,
                    IsLegacy = false
                });
            }

            // Order all transactions strictly chronologically (Invoices first, then Payments on same timestamp)
            var sortedTransactions = allTransactions
                .OrderBy(t => t.Date)
                .ThenBy(t => t.Type == "Invoice" ? 0 : 1)
                .ThenBy(t => t.IsLegacy ? 0 : 1)
                .ToList();

            var seenTransactions = new HashSet<(int? SaleId, int? PaymentId, int? ReturnId, bool IsLegacy, int? LegacyInvoiceId, int? LegacyPaymentId, DateTime Date, decimal Amount)>();
            decimal runningBalance = startBalance;

            foreach (var transaction in sortedTransactions)
            {
                var transactionKey = (transaction.SaleId, transaction.PaymentId, transaction.ReturnId, transaction.IsLegacy, transaction.LegacyInvoiceId, transaction.LegacyPaymentId, transaction.Date, transaction.Debit + transaction.Credit);
                if (seenTransactions.Contains(transactionKey))
                {
                    _logger.LogWarning("Duplicate ledger transaction skipped: SaleId={SaleId} PaymentId={PaymentId} ReturnId={ReturnId} LegacyInvId={LegacyInvoiceId}", transaction.SaleId, transaction.PaymentId, transaction.ReturnId, transaction.LegacyInvoiceId);
                    continue;
                }
                seenTransactions.Add(transactionKey);
                runningBalance += transaction.Debit - transaction.Credit;
                ledgerEntries.Add(new CustomerLedgerEntry
                {
                    Date = transaction.Date,
                    Type = transaction.Type,
                    Reference = transaction.InvoiceNo,
                    PaymentMode = transaction.PaymentMode,
                    Remarks = transaction.Remarks,
                    Debit = transaction.Debit,
                    Credit = transaction.Credit,
                    Balance = runningBalance,
                    SaleId = transaction.SaleId,
                    PaymentId = transaction.PaymentId,
                    ReturnId = transaction.ReturnId,
                    Status = transaction.Status,
                    PaidAmount = 0,
                    IsLegacy = transaction.IsLegacy,
                    LegacyInvoiceId = transaction.LegacyInvoiceId,
                    LegacyPaymentId = transaction.LegacyPaymentId
                });
            }`;

if (!file.includes(balanceTarget)) {
    console.error('balanceTarget not found in CustomerService.cs!');
    process.exit(1);
}
file = file.replace(balanceTarget, balanceReplacement);

file = file.replace(/\n/g, '\r\n');
fs.writeFileSync('backend/HexaBill.Api/Modules/Customers/CustomerService.cs', file, 'utf8');
console.log('CustomerService.cs patched successfully!');

