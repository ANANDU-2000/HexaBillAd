const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../frontend/hexabill-ui/src/features/customers/CustomerLedgerPage.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Detect line endings
const isCRLF = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

function safeReplace(search, replacement, name) {
  if (!content.includes(search)) {
    console.error(`FAILED to find: ${name}`);
    return false;
  }
  content = content.replace(search, replacement);
  console.log(`Successfully replaced: ${name}`);
  return true;
}

// 1. Ensure lucide icons: ChevronLeft, ChevronRight, AlertCircle
safeReplace(
  `  RotateCcw,\n} from 'lucide-react'`,
  `  RotateCcw,\n  ChevronLeft,\n  ChevronRight,\n  AlertCircle,\n} from 'lucide-react'`,
  'lucide imports'
) || safeReplace(
  `  RotateCcw\n} from 'lucide-react'`,
  `  RotateCcw,\n  ChevronLeft,\n  ChevronRight,\n  AlertCircle\n} from 'lucide-react'`,
  'lucide imports fallback'
);

// 2. isTenant20
safeReplace(
  `const isTenant20 = user?.tenantId === 20 || !user?.tenantId`,
  `const isTenant20 = Number(user?.tenantId) === 20 || !user?.tenantId || (typeof window !== 'undefined' && window.location.hostname.includes('frozenhub') && !window.location.hostname.includes('frozenhub2'))`,
  'isTenant20'
);

// 3. Balance header with Actionable Unpaid Invoices Button
const balanceHeaderOld = `                  <div className="text-right flex-shrink-0">
                    <p className="text-micro text-neutral-600 uppercase tracking-wide">Balance</p>
                    {balanceRefreshSkeleton ? (
                      <p className="text-sm text-neutral-500 animate-pulse">Refreshing…</p>
                    ) : (
                      <p className="text-base sm:text-lg font-semibold tabular-nums text-text-primary">
                        {formatCurrency(Math.abs(selectedCustomer.balance ?? 0))}
                        <span className="text-micro font-medium text-neutral-500 ml-1">{(selectedCustomer.balance ?? 0) < 0 ? 'Cr' : (selectedCustomer.balance ?? 0) > 0 ? 'Dr' : ''}</span>
                      </p>
                    )}
                  </div>`;

const balanceHeaderNew = `                  <div className="text-right flex-shrink-0">
                    <p className="text-micro text-neutral-600 uppercase tracking-wide">Balance</p>
                    {balanceRefreshSkeleton ? (
                      <p className="text-sm text-neutral-500 animate-pulse">Refreshing…</p>
                    ) : (
                      <div>
                        <p className="text-base sm:text-lg font-semibold tabular-nums text-text-primary">
                          {formatCurrency(Math.abs(selectedCustomer.balance ?? 0))}
                          <span className="text-micro font-medium text-neutral-500 ml-1">{(selectedCustomer.balance ?? 0) < 0 ? 'Cr' : (selectedCustomer.balance ?? 0) > 0 ? 'Dr' : ''}</span>
                        </p>
                        {outstandingInvoices.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('invoices')
                              setDateRange({ from: '', to: '' })
                              setFilterDraft(prev => ({ ...prev, from: '', to: '' }))
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5 mt-0.5 cursor-pointer transition-colors"
                            title="Click to view all unpaid invoices"
                          >
                            <AlertCircle className="h-3 w-3 text-amber-600" />
                            <span>{outstandingInvoices.length} Unpaid Invoice{outstandingInvoices.length > 1 ? 's' : ''}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>`;

safeReplace(balanceHeaderOld, balanceHeaderNew, 'balanceHeader');

// 4. Pass dateRange and onShowAllDates to InvoicesTab
safeReplace(
  `                    <InvoicesTab\n                      invoices={customerInvoices}\n                      outstandingInvoices={outstandingInvoices}\n                      user={user}`,
  `                    <InvoicesTab\n                      invoices={customerInvoices}\n                      outstandingInvoices={outstandingInvoices}\n                      dateRange={dateRange}\n                      onShowAllDates={() => {\n                        setDateRange({ from: '', to: '' })\n                        setFilterDraft(prev => ({ ...prev, from: '', to: '' }))\n                      }}\n                      user={user}`,
  'InvoicesTab props'
);

// 5. InvoicesTab definition and pagination
const oldInvoicesTabDef = `// Invoices Tab Component
const InvoicesTab = ({ invoices, outstandingInvoices, user, onViewInvoice, onViewPDF, onEditInvoice, onPayInvoice, onUnlockInvoice, onDeleteInvoice, onReturnInvoice }) => {`;

const newInvoicesTabDef = `// Invoices Tab Component
const InvoicesTab = ({ invoices, outstandingInvoices, dateRange, onShowAllDates, user, onViewInvoice, onViewPDF, onEditInvoice, onPayInvoice, onUnlockInvoice, onDeleteInvoice, onReturnInvoice }) => {
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)

  React.useEffect(() => {
    setCurrentPage(1)
  }, [invoices?.length, dateRange?.from, dateRange?.to])`;

safeReplace(oldInvoicesTabDef, newInvoicesTabDef, 'InvoicesTab definition');

// 6. InvoicesTab pagination slice
const oldSortMemo = `  // Sort by date descending (latest first), then by id descending for stable order
  const sortedInvoices = React.useMemo(() => {
    return [...(invoices || [])].sort((a, b) => {
      const dA = new Date(a.invoiceDate || a.date || 0).getTime()
      const dB = new Date(b.invoiceDate || b.date || 0).getTime()
      if (dB !== dA) return dB - dA
      return (b.id ?? 0) - (a.id ?? 0)
    })
  }, [invoices])`;

const newSortMemo = `  // Sort by date descending (latest first), then by id descending for stable order
  const sortedInvoices = React.useMemo(() => {
    return [...(invoices || [])].sort((a, b) => {
      const dA = new Date(a.invoiceDate || a.date || 0).getTime()
      const dB = new Date(b.invoiceDate || b.date || 0).getTime()
      if (dB !== dA) return dB - dA
      return (b.id ?? 0) - (a.id ?? 0)
    })
  }, [invoices])

  const totalCount = sortedInvoices.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const paginatedInvoices = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedInvoices.slice(start, start + pageSize)
  }, [sortedInvoices, currentPage, pageSize])`;

safeReplace(oldSortMemo, newSortMemo, 'InvoicesTab pagination slice');

// 7. Desktop empty state & table mapping
const oldDesktopTable = `              {sortedInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-neutral-500">
                    No invoices found
                  </td>
                </tr>
              ) : (
                sortedInvoices.map((invoice) => {`;

const newDesktopTable = `              {sortedInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-neutral-500">
                    <p className="text-sm">
                      {dateRange?.from || dateRange?.to
                        ? \`No invoices dated \${dateRange.from && dateRange.to ? (dateRange.from === dateRange.to ? new Date(dateRange.from).toLocaleDateString('en-GB') : \`\${new Date(dateRange.from).toLocaleDateString('en-GB')} – \${new Date(dateRange.to).toLocaleDateString('en-GB')}\`) : 'in selected period'}.\`
                        : 'No invoices found'}
                    </p>
                    {outstandingInvoices && outstandingInvoices.length > 0 && onShowAllDates && (
                      <button
                        type="button"
                        onClick={onShowAllDates}
                        className="mt-2 inline-flex items-center text-sm font-semibold text-primary-600 hover:text-primary-800 underline cursor-pointer"
                      >
                        View {outstandingInvoices.length} outstanding invoice{outstandingInvoices.length > 1 ? 's' : ''} from earlier dates →
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((invoice) => {`;

safeReplace(oldDesktopTable, newDesktopTable, 'Desktop empty state & table mapping');

// 8. Mobile empty state & card mapping
const oldMobileTable = `        {sortedInvoices.length === 0 ? (
          <div className="bg-white rounded-lg border border-neutral-200 p-6 text-center text-neutral-500 text-sm">
            No invoices found
          </div>
        ) : (
          sortedInvoices.map((invoice) => {`;

const newMobileTable = `        {sortedInvoices.length === 0 ? (
          <div className="bg-white rounded-lg border border-neutral-200 p-6 text-center text-neutral-500 text-sm">
            <p>
              {dateRange?.from || dateRange?.to
                ? \`No invoices dated \${dateRange.from && dateRange.to ? (dateRange.from === dateRange.to ? new Date(dateRange.from).toLocaleDateString('en-GB') : \`\${new Date(dateRange.from).toLocaleDateString('en-GB')} – \${new Date(dateRange.to).toLocaleDateString('en-GB')}\`) : 'in selected period'}.\`
                : 'No invoices found'}
            </p>
            {outstandingInvoices && outstandingInvoices.length > 0 && onShowAllDates && (
              <button
                type="button"
                onClick={onShowAllDates}
                className="mt-2 inline-flex items-center text-sm font-semibold text-primary-600 hover:text-primary-800 underline cursor-pointer"
              >
                View {outstandingInvoices.length} outstanding invoice{outstandingInvoices.length > 1 ? 's' : ''} from earlier dates →
              </button>
            )}
          </div>
        ) : (
          paginatedInvoices.map((invoice) => {`;

safeReplace(oldMobileTable, newMobileTable, 'Mobile empty state & card mapping');

// 9. Guard invalid dates when dateRange is empty
safeReplace(
  `      // Filter by date range\n      const filteredEntries = customerLedger.filter(entry => {\n        const entryDate = new Date(entry.date)\n        const fromDate = new Date(dateRange.from)\n        const toDate = new Date(dateRange.to)\n        toDate.setHours(23, 59, 59, 999)\n        return entryDate >= fromDate && entryDate <= toDate\n      })`,
  `      // Filter by date range\n      const filteredEntries = customerLedger.filter(entry => {\n        if (!dateRange.from && !dateRange.to) return true\n        const entryDate = new Date(entry.date)\n        if (dateRange.from) {\n          const fromDate = new Date(dateRange.from)\n          if (entryDate < fromDate) return false\n        }\n        if (dateRange.to) {\n          const toDate = new Date(dateRange.to)\n          toDate.setHours(23, 59, 59, 999)\n          if (entryDate > toDate) return false\n        }\n        return true\n      })`,
  'CSV export date guard'
);

safeReplace(
  `          }).filter(p => {\n            // Also filter by date range\n            const paymentDate = new Date(p.paymentDate)\n            const fromDate = new Date(dateRange.from)\n            const toDate = new Date(dateRange.to)\n            toDate.setHours(23, 59, 59, 999)\n            return paymentDate >= fromDate && paymentDate <= toDate\n          })`,
  `          }).filter(p => {\n            // Also filter by date range\n            if (!dateRange.from && !dateRange.to) return true\n            const paymentDate = new Date(p.paymentDate)\n            if (dateRange.from) {\n              const fromDate = new Date(dateRange.from)\n              if (paymentDate < fromDate) return false\n            }\n            if (dateRange.to) {\n              const toDate = new Date(dateRange.to)\n              toDate.setHours(23, 59, 59, 999)\n              if (paymentDate > toDate) return false\n            }\n            return true\n          })`,
  'Cash customer payments date guard'
);

safeReplace(
  `        const filteredLedgerData = ledgerData.filter(entry => {\n          const entryDate = new Date(entry.date)\n          const fromDate = new Date(dateRange.from)\n          const toDate = new Date(dateRange.to)\n          toDate.setHours(23, 59, 59, 999)\n          return entryDate >= fromDate && entryDate <= toDate\n        })`,
  `        const filteredLedgerData = ledgerData.filter(entry => {\n          if (!dateRange.from && !dateRange.to) return true\n          const entryDate = new Date(entry.date)\n          if (dateRange.from) {\n            const fromDate = new Date(dateRange.from)\n            if (entryDate < fromDate) return false\n          }\n          if (dateRange.to) {\n            const toDate = new Date(dateRange.to)\n            toDate.setHours(23, 59, 59, 999)\n            if (entryDate > toDate) return false\n          }\n          return true\n        })`,
  'filteredLedgerData date guard'
);

safeReplace(
  `        .filter(p => {\n          const paymentDate = new Date(p.paymentDate)\n          const fromDate = new Date(dateRange.from)\n          const toDate = new Date(dateRange.to)\n          toDate.setHours(23, 59, 59, 999)\n          return paymentDate >= fromDate && paymentDate <= toDate\n        })`,
  `        .filter(p => {\n          if (!dateRange.from && !dateRange.to) return true\n          const paymentDate = new Date(p.paymentDate)\n          if (dateRange.from) {\n            const fromDate = new Date(dateRange.from)\n            if (paymentDate < fromDate) return false\n          }\n          if (dateRange.to) {\n            const toDate = new Date(dateRange.to)\n            toDate.setHours(23, 59, 59, 999)\n            if (paymentDate > toDate) return false\n          }\n          return true\n        })`,
  'customerPayments date guard'
);

safeReplace(
  `      // Prepare WhatsApp message\n      const filteredEntries = customerLedger.filter(entry => {\n        const entryDate = new Date(entry.date)\n        const fromDate = new Date(dateRange.from)\n        const toDate = new Date(dateRange.to)\n        toDate.setHours(23, 59, 59, 999)\n        return entryDate >= fromDate && entryDate <= toDate\n      })`,
  `      // Prepare WhatsApp message\n      const filteredEntries = customerLedger.filter(entry => {\n        if (!dateRange.from && !dateRange.to) return true\n        const entryDate = new Date(entry.date)\n        if (dateRange.from) {\n          const fromDate = new Date(dateRange.from)\n          if (entryDate < fromDate) return false\n        }\n        if (dateRange.to) {\n          const toDate = new Date(dateRange.to)\n          toDate.setHours(23, 59, 59, 999)\n          if (entryDate > toDate) return false\n        }\n        return true\n      })`,
  'WhatsApp share date guard'
);

safeReplace(
  `    const filteredEntries = customerLedger.filter(entry => {\n      const entryDate = new Date(entry.date)\n      const fromDate = new Date(dateRange.from)\n      const toDate = new Date(dateRange.to)\n      toDate.setHours(23, 59, 59, 999)\n      return entryDate >= fromDate && entryDate <= toDate\n    })`,
  `    const filteredEntries = customerLedger.filter(entry => {\n      if (!dateRange.from && !dateRange.to) return true\n      const entryDate = new Date(entry.date)\n      if (dateRange.from) {\n        const fromDate = new Date(dateRange.from)\n        if (entryDate < fromDate) return false\n      }\n      if (dateRange.to) {\n        const toDate = new Date(dateRange.to)\n        toDate.setHours(23, 59, 59, 999)\n        if (entryDate > toDate) return false\n      }\n      return true\n    })`,
  'Print statement date guard'
);

safeReplace(
  `                            const filteredEntries = customerLedger.filter(entry => {\n                              const entryDate = new Date(entry.date)\n                              const fromDate = new Date(dateRange.from)\n                              const toDate = new Date(dateRange.to)\n                              toDate.setHours(23, 59, 59, 999)\n                              return entryDate >= fromDate && entryDate <= toDate\n                            })`,
  `                            const filteredEntries = customerLedger.filter(entry => {\n                              if (!dateRange.from && !dateRange.to) return true\n                              const entryDate = new Date(entry.date)\n                              if (dateRange.from) {\n                                const fromDate = new Date(dateRange.from)\n                                if (entryDate < fromDate) return false\n                              }\n                              if (dateRange.to) {\n                                const toDate = new Date(dateRange.to)\n                                toDate.setHours(23, 59, 59, 999)\n                                if (entryDate > toDate) return false\n                              }\n                              return true\n                            })`,
  'Copy statement date guard'
);

safeReplace(
  `                            const entryDate = new Date(entry.date)\n                            const fromDate = new Date(dateRange.from)\n                            const toDate = new Date(dateRange.to)\n                            toDate.setHours(23, 59, 59, 999)\n                            const inDateRange = entryDate >= fromDate && entryDate <= toDate\n                            if (!inDateRange) return false`,
  `                            if (dateRange.from || dateRange.to) {\n                              const entryDate = new Date(entry.date)\n                              if (dateRange.from) {\n                                const fromDate = new Date(dateRange.from)\n                                if (entryDate < fromDate) return false\n                              }\n                              if (dateRange.to) {\n                                const toDate = new Date(dateRange.to)\n                                toDate.setHours(23, 59, 59, 999)\n                                if (entryDate > toDate) return false\n                              }\n                            }`,
  'LedgerStatementTab date guard'
);

// Restore line endings if needed
if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('CustomerLedgerPage.jsx completely and safely updated!');
