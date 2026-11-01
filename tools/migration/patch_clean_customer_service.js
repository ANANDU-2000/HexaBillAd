const fs = require('fs');

let file = fs.readFileSync('backend/HexaBill.Api/Modules/Customers/CustomerService.cs', 'utf8');
file = file.replace(/\r\n/g, '\n');

const target = `            // NEW GROUPED LOGIC: Invoice → Payment (if paid) → Next Invoice → Payment → etc.
            // Group payments by their linked SaleId (invoice)
            var paymentsBySaleId = allTransactions
                .Where(t => t.Type == "Payment" && t.SaleId.HasValue)
                .GroupBy(t => t.SaleId!.Value)
                .ToDictionary(g => g.Key, g => g.OrderBy(p => p.Date).ThenBy(p => p.PaymentId ?? int.MaxValue).ToList());
            
            // Get standalone payments (not linked to any invoice)
            var standalonePayments = allTransactions
                .Where(t => t.Type == "Payment" && !t.SaleId.HasValue)
                .OrderBy(t => t.Date)
                .ThenBy(t => t.PaymentId ?? int.MaxValue)
                .ToList();
            
            var standaloneReturns = allTransactions
                .Where(t => t.Type == "Sale Return")
                .OrderBy(t => t.Date)
                .ThenBy(t => t.ReturnId ?? int.MaxValue)
                .ToList();
            var refundsByReturnId = allTransactions
                .Where(t => t.Type == "Refund" && t.ReturnId.HasValue)
                .GroupBy(t => t.ReturnId!.Value)
                .ToDictionary(g => g.Key, g => g.OrderBy(x => x.Date).ThenBy(x => x.PaymentId ?? int.MaxValue).ToList());
            
            // Get invoices sorted by date
            var invoices = allTransactions
                .Where(t => t.Type == "Invoice")
                .OrderBy(t => t.Date)
                .ThenBy(t => t.SaleId ?? int.MaxValue)
                .ToList();

            // Build grouped transaction list: Invoice → Its Payments → Next Invoice → Its Payments (with ReturnId)
            var groupedTransactions = new List<(DateTime Date, string Type, string InvoiceNo, string? PaymentMode, decimal Debit, decimal Credit, string Status, int? SaleId, int? PaymentId, string? Remarks, int? ReturnId)>();
            
            foreach (var invoice in invoices)
            {
                groupedTransactions.Add(invoice);
                if (invoice.SaleId.HasValue && paymentsBySaleId.ContainsKey(invoice.SaleId.Value))
                {
                    foreach (var payment in paymentsBySaleId[invoice.SaleId.Value])
                        groupedTransactions.Add(payment);
                }
            }
            groupedTransactions.AddRange(standalonePayments);
            foreach (var ret in standaloneReturns)
            {
                groupedTransactions.Add(ret);
                if (ret.ReturnId.HasValue && refundsByReturnId.TryGetValue(ret.ReturnId.Value, out var refs))
                    foreach (var r in refs) groupedTransactions.Add(r);
            }`;

if (!file.includes(target)) {
    console.error('Target not found in CustomerService.cs!');
    process.exit(1);
}

file = file.replace(target, '');
file = file.replace(/\n/g, '\r\n');
fs.writeFileSync('backend/HexaBill.Api/Modules/Customers/CustomerService.cs', file, 'utf8');
console.log('CustomerService.cs cleaned successfully!');

