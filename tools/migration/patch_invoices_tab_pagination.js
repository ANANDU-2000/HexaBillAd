const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../frontend/hexabill-ui/src/features/customers/CustomerLedgerPage.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Add ChevronLeft, ChevronRight, AlertCircle to lucide-react imports
if (!content.includes('ChevronLeft')) {
  content = content.replace(
    `  RotateCcw\n} from 'lucide-react'`,
    `  RotateCcw,\n  ChevronLeft,\n  ChevronRight,\n  AlertCircle\n} from 'lucide-react'`
  );
}

// 2. Locate InvoicesTab and replace it cleanly
const oldInvoicesTabStart = `// Invoices Tab Component\nconst InvoicesTab = ({ invoices, outstandingInvoices, user, onViewInvoice, onViewPDF, onEditInvoice, onPayInvoice, onUnlockInvoice, onDeleteInvoice, onReturnInvoice }) => {`;

const newInvoicesTabStart = `// Invoices Tab Component
const InvoicesTab = ({ invoices, outstandingInvoices, dateRange, onShowAllDates, user, onViewInvoice, onViewPDF, onEditInvoice, onPayInvoice, onUnlockInvoice, onDeleteInvoice, onReturnInvoice }) => {
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)

  // Reset page when invoices change or date filter changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [invoices?.length, dateRange?.from, dateRange?.to])`;

content = content.replace(oldInvoicesTabStart, newInvoicesTabStart);

// Replace sorting & pagination inside InvoicesTab
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

content = content.replace(oldSortMemo, newSortMemo);

// Replace desktop empty state
const oldDesktopEmpty = `              {sortedInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-neutral-500">
                    No invoices found
                  </td>
                </tr>
              ) : (
                sortedInvoices.map((invoice) => {`;

const newDesktopEmpty = `              {sortedInvoices.length === 0 ? (
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

content = content.replace(oldDesktopEmpty, newDesktopEmpty);

// Replace mobile empty state
const oldMobileEmpty = `        {sortedInvoices.length === 0 ? (
          <div className="bg-white rounded-lg border border-neutral-200 p-6 text-center text-neutral-500 text-sm">
            No invoices found
          </div>
        ) : (
          sortedInvoices.map((invoice) => {`;

const newMobileEmpty = `        {sortedInvoices.length === 0 ? (
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

content = content.replace(oldMobileEmpty, newMobileEmpty);

// Add pagination bar before the closing </div> of InvoicesTab
const oldInvoicesTabEnd = `      {/* Invoices Cards - Mobile */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-3 pb-4">`;

const paginationSnippet = `      {/* Pagination Controls */}
      {totalCount > 10 && (
        <div className="bg-neutral-50 px-3 py-2 flex items-center justify-between border-t border-neutral-200 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-600">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="border border-neutral-300 rounded px-2 py-1 text-xs bg-white"
            >
              {[10, 20, 50, 100, 250].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="text-neutral-700">
            Page <span className="font-semibold">{currentPage}</span> of{' '}
            <span className="font-semibold">{totalPages}</span> ({totalCount} total)
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center px-2.5 py-1.5 border border-neutral-300 rounded-md text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center px-2.5 py-1.5 border border-neutral-300 rounded-md text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </button>
          </div>
        </div>
      )}

      {/* Invoices Cards - Mobile */}`;

content = content.replace(
  `      {/* Invoices Cards - Mobile */}`,
  paginationSnippet
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully patched InvoicesTab pagination & earlier unpaid link!');

