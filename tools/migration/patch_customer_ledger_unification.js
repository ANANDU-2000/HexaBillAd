const fs = require('fs');

let file = fs.readFileSync('frontend/hexabill-ui/src/features/customers/CustomerLedgerPage.jsx', 'utf8');
file = file.replace(/\r\n/g, '\n');

// 1. In loadCustomerData: fetch legacy invoices and legacy payments
const loadTarget = `      const [ledgerRes, invoicesRes, outstandingRes, customerRes] = await Promise.all([
        customersAPI.getCustomerLedger(customerId, {
          fromDate: dateRange.from,
          toDate: dateRange.to
          // branchId, routeId, staffId intentionally omitted - full ledger
        }),
        reportsAPI.getSalesReport({
          page: 1,
          pageSize: 1000,
          customerId,
          fromDate: dateRange.from,
          toDate: dateRange.to
        }),
        customersAPI.getOutstandingInvoices(customerId),
        customersAPI.getCustomer(customerId)
      ])`;

const loadReplacement = `      // Tenant 20 (FrozenHub 1) Starplus continuity: load legacy invoices and payments
      const isTenant20 = user?.tenantId === 20 || !user?.tenantId
      const legacyInvoicesPromise = isTenant20
        ? legacyAPI.getInvoices({
            customerId,
            pageSize: 1000,
            fromDate: dateRange.from,
            toDate: dateRange.to
          }).catch(err => {
            console.warn('Could not fetch legacy invoices for customer ledger:', err)
            return null
          })
        : Promise.resolve(null)

      const legacyPaymentsPromise = isTenant20
        ? legacyAPI.getPayments({
            customerId,
            pageSize: 1000,
            fromDate: dateRange.from,
            toDate: dateRange.to
          }).catch(err => {
            console.warn('Could not fetch legacy payments for customer ledger:', err)
            return null
          })
        : Promise.resolve(null)

      const [ledgerRes, invoicesRes, outstandingRes, customerRes, legacyInvoicesRes, legacyPaymentsRes] = await Promise.all([
        customersAPI.getCustomerLedger(customerId, {
          fromDate: dateRange.from,
          toDate: dateRange.to
          // branchId, routeId, staffId intentionally omitted - full ledger
        }),
        reportsAPI.getSalesReport({
          page: 1,
          pageSize: 1000,
          customerId,
          fromDate: dateRange.from,
          toDate: dateRange.to
        }),
        customersAPI.getOutstandingInvoices(customerId),
        customersAPI.getCustomer(customerId),
        legacyInvoicesPromise,
        legacyPaymentsPromise
      ])`;

if (!file.includes(loadTarget)) {
  console.error('loadTarget not found!');
  process.exit(1);
}
file = file.replace(loadTarget, loadReplacement);

// 2. Combine operating and legacy invoices
const invTarget = `      if (invoicesRes.success && invoicesRes.data) {
        const sales = invoicesRes.data.items || []
        // CRITICAL: Validate all invoices belong to this customer
        const validSales = sales.filter(sale => {
          // Ensure sale belongs to this customer
          return sale.customerId === customerId || sale.customerId === parseInt(customerId)
        })
        // Backend already filters by date range, so use validSales directly
        invoicesData = validSales
        setCustomerInvoices(invoicesData)
      }`;

const invReplacement = `      const sales = (invoicesRes.success && invoicesRes.data?.items) ? invoicesRes.data.items : []
      const validSales = sales.filter(sale => sale.customerId === customerId || sale.customerId === parseInt(customerId))

      const legacyInvoices = (legacyInvoicesRes?.success && legacyInvoicesRes.data?.items)
        ? legacyInvoicesRes.data.items.map(inv => ({
            id: inv.id,
            legacyInvoiceId: inv.id,
            sourceInvoiceId: inv.sourceInvoiceId,
            invoiceNo: inv.legacyInvoiceNumber,
            invoiceDate: inv.invoiceDate,
            date: inv.invoiceDate,
            dueDate: inv.dueDate,
            customerId: customerId,
            customerName: inv.customerName,
            subtotal: Number(inv.subtotal) || 0,
            taxAmount: Number(inv.vatTotal) || 0,
            vatTotal: Number(inv.vatTotal) || 0,
            discount: Number(inv.discount) || 0,
            grandTotal: Number(inv.grandTotal) || 0,
            total: Number(inv.grandTotal) || 0,
            paidAmount: Number(inv.paidAmount) || 0,
            outstandingCalculated: Number(inv.outstandingCalculated) || 0,
            paymentStatus: Number(inv.outstandingCalculated) <= 0.005 ? 'Paid' : (Number(inv.paidAmount) > 0 ? 'Partial' : 'Pending'),
            paymentMethod: 'Legacy',
            itemCount: inv.itemCount,
            notes: inv.notes,
            isLegacy: true,
            sourceCompany: inv.legacyIssuer || 'Starplus Foodstuff Trading'
          }))
        : []

      const combinedInvoices = [...validSales, ...legacyInvoices].sort((a, b) => {
        const dA = new Date(a.invoiceDate || a.date || 0).getTime()
        const dB = new Date(b.invoiceDate || b.date || 0).getTime()
        if (dB !== dA) return dB - dA
        return (b.id ?? 0) - (a.id ?? 0)
      })
      invoicesData = combinedInvoices
      setCustomerInvoices(invoicesData)`;

if (!file.includes(invTarget)) {
  console.error('invTarget not found!');
  process.exit(1);
}
file = file.replace(invTarget, invReplacement);

// 3. Combine operating and legacy payments
const payTarget = `      if (paymentsRes.success && paymentsRes.data) {
        const allPayments = paymentsRes.data.items || []
        // CRITICAL: Strictly filter payments by customerId to prevent mismatches
        const customerPayments = allPayments
          .filter(p => {
            // Ensure payment belongs to this customer (check both string and number)
            const paymentCustomerId = p.customerId || p.customerID
            return paymentCustomerId === customerId ||
              paymentCustomerId === parseInt(customerId) ||
              parseInt(paymentCustomerId) === parseInt(customerId)
          })
          .filter(p => {
            const paymentDate = new Date(p.paymentDate)
            const fromDate = new Date(dateRange.from)
            const toDate = new Date(dateRange.to)
            toDate.setHours(23, 59, 59, 999)
            return paymentDate >= fromDate && paymentDate <= toDate
          })
        setCustomerPayments(customerPayments)`;

const payReplacement = `      const allPayments = (paymentsRes.success && paymentsRes.data?.items) ? paymentsRes.data.items : []
      const customerPayments = allPayments
        .filter(p => {
          const paymentCustomerId = p.customerId || p.customerID
          return paymentCustomerId === customerId ||
            paymentCustomerId === parseInt(customerId) ||
            parseInt(paymentCustomerId) === parseInt(customerId)
        })
        .filter(p => {
          const paymentDate = new Date(p.paymentDate)
          const fromDate = new Date(dateRange.from)
          const toDate = new Date(dateRange.to)
          toDate.setHours(23, 59, 59, 999)
          return paymentDate >= fromDate && paymentDate <= toDate
        })

      const legacyPayments = (legacyPaymentsRes?.success && legacyPaymentsRes.data?.items)
        ? legacyPaymentsRes.data.items.map(p => ({
            id: p.id,
            legacyPaymentId: p.id,
            sourcePaymentId: p.sourcePaymentId,
            paymentNumber: p.reference || \`LP-\${p.sourcePaymentId}\`,
            reference: p.reference || p.legacyInvoiceNumber || \`LP-\${p.sourcePaymentId}\`,
            invoiceNo: p.legacyInvoiceNumber,
            paymentDate: p.paymentDate,
            date: p.paymentDate,
            amount: Number(p.amount) || 0,
            mode: p.mode || 'Cash',
            paymentMethod: p.mode || 'Cash',
            status: p.status || 'Cleared',
            customerId: customerId,
            customerName: p.customerName,
            isLegacy: true
          }))
        : []

      const combinedPayments = [...customerPayments, ...legacyPayments].sort((a, b) => {
        const dA = new Date(a.paymentDate || a.date || 0).getTime()
        const dB = new Date(b.paymentDate || b.date || 0).getTime()
        if (dB !== dA) return dB - dA
        return (b.id ?? 0) - (a.id ?? 0)
      })
      setCustomerPayments(combinedPayments)`;

if (!file.includes(payTarget)) {
  console.error('payTarget not found!');
  process.exit(1);
}
file = file.replace(payTarget, payReplacement);

// 4. Update onViewInvoice to route to LegacyInvoiceDetailModal if isLegacy
const onViewTarget = `                      onViewInvoice={(invoiceId) => {
                        setSelectedInvoiceForView(invoiceId)
                        setShowInvoiceModal(true)
                      }}`;

const onViewReplacement = `                      onViewInvoice={(invoiceId, inv) => {
                        const target = inv || customerInvoices.find(i => i.id === invoiceId)
                        if (target?.isLegacy) {
                          setSelectedLegacyInvoiceId(target.legacyInvoiceId || target.id)
                          setShowLegacyInvoiceModal(true)
                        } else {
                          setSelectedInvoiceForView(invoiceId)
                          setShowInvoiceModal(true)
                        }
                      }}`;

if (!file.includes(onViewTarget)) {
  console.error('onViewTarget not found!');
  process.exit(1);
}
file = file.replace(onViewTarget, onViewReplacement);

// 5. Update InvoicesTab calls to onViewInvoice
file = file.replace(
  `onClick={() => onViewInvoice(invoice.id)}
                            className="text-primary-600 hover:text-primary-900 hover:bg-primary-50 p-1 rounded transition-colors"
                            title="View Invoice"`,
  `onClick={() => onViewInvoice(invoice.id, invoice)}
                            className="text-primary-600 hover:text-primary-900 hover:bg-primary-50 p-1 rounded transition-colors"
                            title="View Invoice"`
);

file = file.replace(
  `onClick={() => onViewInvoice(invoice.id)}
                    className="px-3 py-2 text-primary-600 hover:bg-primary-50 rounded-md text-xs font-medium flex items-center gap-1"
                    aria-label="View invoice"`,
  `onClick={() => onViewInvoice(invoice.id, invoice)}
                    className="px-3 py-2 text-primary-600 hover:bg-primary-50 rounded-md text-xs font-medium flex items-center gap-1"
                    aria-label="View invoice"`
);

// 6. In InvoicesTab desktop: add Historical badge
file = file.replace(
`                          <span>{invoice.invoiceNo || \`INV-\${invoice.id}\`}</span>
                          {invoice.isLocked && (`,
`                          <span>{invoice.invoiceNo || \`INV-\${invoice.id}\`}</span>
                          {invoice.isLegacy && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200" title="Starplus Historical Bill">
                              Historical
                            </span>
                          )}
                          {invoice.isLocked && (`
);

// 7. In InvoicesTab desktop: guard Edit, Delete, Return buttons with !invoice.isLegacy
file = file.replace(
`                          {canEdit && onEditInvoice && !invoice.isLocked && (`,
`                          {canEdit && onEditInvoice && !invoice.isLegacy && !invoice.isLocked && (`
);

file = file.replace(
`                          {isAdmin && onDeleteInvoice && (`,
`                          {isAdmin && onDeleteInvoice && !invoice.isLegacy && (`
);

file = file.replace(
`                          {onReturnInvoice && (`,
`                          {onReturnInvoice && !invoice.isLegacy && (`
);

file = file.replace(
`                  {canEdit && onEditInvoice && !invoice.isLocked && (`,
`                  {canEdit && onEditInvoice && !invoice.isLegacy && !invoice.isLocked && (`
);

file = file.replace(/\n/g, '\r\n');
fs.writeFileSync('frontend/hexabill-ui/src/features/customers/CustomerLedgerPage.jsx', file, 'utf8');
console.log('CustomerLedgerPage.jsx patched successfully!');

