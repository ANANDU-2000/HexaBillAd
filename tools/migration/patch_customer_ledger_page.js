const fs = require('fs');
const file = 'frontend/hexabill-ui/src/features/customers/CustomerLedgerPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports
content = content.replace(
  "import { customersAPI, paymentsAPI, salesAPI, reportsAPI, adminAPI, returnsAPI, subscriptionAPI } from '../../services/index'",
  "import { customersAPI, paymentsAPI, salesAPI, reportsAPI, adminAPI, returnsAPI, subscriptionAPI, legacyAPI } from '../../services/index'"
);

content = content.replace(
  "import InvoicePreviewModal from '../../components/InvoicePreviewModal'",
  "import InvoicePreviewModal from '../../components/InvoicePreviewModal'\nimport LegacyInvoiceDetailModal from '../../components/LegacyInvoiceDetailModal'"
);

// 2. Add state
content = content.replace(
  "const [showInvoiceModal, setShowInvoiceModal] = useState(false)",
  `const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showLegacyInvoiceModal, setShowLegacyInvoiceModal] = useState(false)
  const [selectedLegacyInvoiceId, setSelectedLegacyInvoiceId] = useState(null)`
);

// 3. Update loadCustomerData Promise.all
content = content.replace(
  `const [ledgerRes, invoicesRes, outstandingRes, customerRes] = await Promise.all([
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
      ])`,
  `const isFrozenHub1 = user?.tenantId === 20 || (typeof window !== 'undefined' && window.location.hostname.includes('frozenhub'))
      const [ledgerRes, invoicesRes, outstandingRes, customerRes, legacyInvoicesRes] = await Promise.all([
        customersAPI.getCustomerLedger(customerId, {
          fromDate: dateRange.from,
          toDate: dateRange.to
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
        isFrozenHub1 ? legacyAPI.getInvoices({ customerId, pageSize: 500 }).catch(() => null) : Promise.resolve(null)
      ])`
);

// 4. Combine legacy invoices into invoicesData
content = content.replace(
  `// Backend already filters by date range, so use validSales directly
        invoicesData = validSales
        setCustomerInvoices(invoicesData)`,
  `let combinedInvoices = [...validSales]
        if (legacyInvoicesRes?.success && Array.isArray(legacyInvoicesRes?.data?.items)) {
          const legItems = legacyInvoicesRes.data.items.map(li => ({
            id: li.id,
            legacyId: li.id,
            isLegacy: true,
            invoiceNo: li.legacyInvoiceNumber,
            invoiceDate: li.invoiceDate,
            grandTotal: li.grandTotal,
            subtotal: li.subtotal,
            vatTotal: li.vatTotal,
            paidAmount: li.paidAmount,
            balance: li.balanceAmount,
            status: li.status,
            customerId: customerId,
            itemCount: li.itemCount
          }))
          combinedInvoices = [...combinedInvoices, ...legItems]
        }
        invoicesData = combinedInvoices
        setCustomerInvoices(invoicesData)`
);

// 5. Update onViewInvoice to handle legacy
content = content.replace(
  `onViewInvoice={(invoiceId) => {
                        setSelectedInvoiceForView(invoiceId)
                        setShowInvoiceModal(true)
                      }}`,
  `onViewInvoice={(invoiceId) => {
                        const inv = customerInvoices.find(i => i.id === invoiceId || i.legacyId === invoiceId)
                        if (inv?.isLegacy) {
                          setSelectedLegacyInvoiceId(inv.legacyId || inv.id)
                          setShowLegacyInvoiceModal(true)
                        } else {
                          setSelectedInvoiceForView(invoiceId)
                          setShowInvoiceModal(true)
                        }
                      }}`
);

// 6. Render LegacyInvoiceDetailModal
content = content.replace(
  `{/* Invoice Preview Modal */}`,
  `{/* Starplus Historical Invoice Modal */}
      {showLegacyInvoiceModal && selectedLegacyInvoiceId && (
        <LegacyInvoiceDetailModal
          invoiceId={selectedLegacyInvoiceId}
          isOpen={showLegacyInvoiceModal}
          onClose={() => {
            setShowLegacyInvoiceModal(false)
            setSelectedLegacyInvoiceId(null)
          }}
        />
      )}

      {/* Invoice Preview Modal */}`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated CustomerLedgerPage.jsx');

