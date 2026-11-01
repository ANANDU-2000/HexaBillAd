const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/hexabill-ui/src/features/payments/PaymentsPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Ensure import of legacyAPI
if (!content.includes('legacyAPI')) {
  content = content.replace(
    "import { paymentsAPI, customersAPI } from '../../services/index'",
    "import { paymentsAPI, customersAPI, legacyAPI } from '../../services/index'"
  );
}

// 2. Add state for paymentsTab and legacy payments
const stateInjection = `  const [paymentsTab, setPaymentsTab] = useState(() => searchParams.get('tab') || 'active')
  const [legacyPayments, setLegacyPayments] = useState([])
  const [legacyPage, setLegacyPage] = useState(1)
  const [legacyPageSize, setLegacyPageSize] = useState(25)
  const [legacyTotalCount, setLegacyTotalCount] = useState(0)
  const [legacyTotalPages, setLegacyTotalPages] = useState(1)
  const [legacyStatus, setLegacyStatus] = useState('')
  const [legacyLoading, setLegacyLoading] = useState(false)

  const loadLegacyPayments = useCallback(async () => {
    try {
      setLegacyLoading(true)
      const res = await legacyAPI.getPayments({
        page: legacyPage,
        pageSize: legacyPageSize,
        search: searchTerm?.trim() || undefined,
        status: legacyStatus || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined
      })
      if (res?.success && res.data) {
        setLegacyPayments(res.data.items || [])
        setLegacyTotalCount(res.data.totalCount || 0)
        setLegacyTotalPages(res.data.totalPages || 1)
      }
    } catch (err) {
      console.warn('Error loading historical legacy payments:', err)
    } finally {
      setLegacyLoading(false)
    }
  }, [legacyPage, legacyPageSize, searchTerm, legacyStatus, fromDate, toDate])

  useEffect(() => {
    if (paymentsTab === 'legacy') {
      loadLegacyPayments()
    }
  }, [paymentsTab, loadLegacyPayments])
`;

if (!content.includes('paymentsTab, setPaymentsTab')) {
  content = content.replace(
    "const [selectedPaymentIds, setSelectedPaymentIds] = useState([])",
    "const [selectedPaymentIds, setSelectedPaymentIds] = useState([])\n" + stateInjection
  );
}

// 3. Add tab strip in Header
const headerTarget = `<h1 className="text-2xl font-bold text-neutral-900">Payments</h1>`;
const headerReplacement = `<h1 className="text-2xl font-bold text-neutral-900">Payments</h1>
          <div className="flex items-center gap-2 mt-3 border-b border-neutral-200">
            <button
              type="button"
              onClick={() => setPaymentsTab('active')}
              className={\`px-3 py-1.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors \${
                paymentsTab === 'active'
                  ? 'border-primary-600 text-primary-700 bg-primary-50/50 rounded-t-lg'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900'
              }\`}
            >
              Current Payments
            </button>
            <button
              type="button"
              onClick={() => setPaymentsTab('legacy')}
              className={\`px-3 py-1.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 \${
                paymentsTab === 'legacy'
                  ? 'border-amber-600 text-amber-800 bg-amber-50/50 rounded-t-lg'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900'
              }\`}
            >
              <span>Historical Payments (Starplus)</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">5,330 Records</span>
            </button>
          </div>`;

if (!content.includes('Historical Payments (Starplus)')) {
  content = content.replace(headerTarget, headerReplacement);
}

// 4. Wrap active payment table and render legacy payment table
const activeTableContainer = `      {/* Payments List */}`;
const legacySectionCode = `      {/* Payments List */}
      {paymentsTab === 'legacy' ? (
        <div className="space-y-4">
          {/* Banner */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600 shrink-0" />
              <span>
                <strong>Historical Starplus Ledger Payments:</strong> 5,330 immutable transaction payment traces (5,325 Cleared, 5 Pending) amounting to AED 3,747,182.98.
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => { setLegacyStatus(''); setLegacyPage(1); }}
                className={\`px-2.5 py-1 rounded text-xs font-semibold \${
                  legacyStatus === '' ? 'bg-amber-700 text-white' : 'bg-white text-neutral-700 border border-neutral-300'
                }\`}
              >
                All (5,330)
              </button>
              <button
                type="button"
                onClick={() => { setLegacyStatus('CLEARED'); setLegacyPage(1); }}
                className={\`px-2.5 py-1 rounded text-xs font-semibold \${
                  legacyStatus === 'CLEARED' ? 'bg-emerald-700 text-white' : 'bg-white text-emerald-800 border border-emerald-300'
                }\`}
              >
                Cleared (5,325)
              </button>
              <button
                type="button"
                onClick={() => { setLegacyStatus('PENDING'); setLegacyPage(1); }}
                className={\`px-2.5 py-1 rounded text-xs font-semibold \${
                  legacyStatus === 'PENDING' ? 'bg-rose-700 text-white' : 'bg-white text-rose-800 border border-rose-300'
                }\`}
              >
                Pending (5)
              </button>
            </div>
          </div>

          {/* Legacy Payments Table */}
          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-sm">
            {legacyLoading && legacyPayments.length === 0 ? (
              <div className="py-16 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary-600" />
                <p className="mt-2 text-sm text-neutral-500">Loading historical payment records...</p>
              </div>
            ) : legacyPayments.length === 0 ? (
              <div className="py-16 text-center">
                <CreditCard className="h-10 w-10 mx-auto text-neutral-300" />
                <p className="mt-2 text-sm text-neutral-600">No historical payments found matching the filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200 text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 font-semibold">
                    <tr>
                      <th className="px-3 py-2 text-left">Payment ID</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Invoice #</th>
                      <th className="px-3 py-2 text-center">Mode</th>
                      <th className="px-3 py-2 text-left">Reference</th>
                      <th className="px-3 py-2 text-center">Status</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 bg-white">
                    {legacyPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-neutral-50">
                        <td className="px-3 py-2 font-mono font-bold text-neutral-900">#{p.sourcePaymentId}</td>
                        <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">
                          {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td className="px-3 py-2 font-medium text-neutral-900 max-w-[180px] truncate" title={p.customerName}>
                          {p.customerName || <span className="text-neutral-400 italic">Walk-in</span>}
                        </td>
                        <td className="px-3 py-2 font-semibold text-neutral-800">
                          {p.legacyInvoiceNumber ? \`#\${p.legacyInvoiceNumber}\` : '—'}
                        </td>
                        <td className="px-3 py-2 text-center font-medium text-neutral-700">{p.mode}</td>
                        <td className="px-3 py-2 text-neutral-500 font-mono text-[11px] max-w-[140px] truncate" title={p.reference}>
                          {p.reference || '—'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={\`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold \${
                            (p.status || '').toUpperCase() === 'CLEARED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }\`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700 whitespace-nowrap">
                          {formatCurrency(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {legacyTotalPages > 1 && (
              <div className="bg-neutral-50 px-3 py-2 flex items-center justify-between border-t border-neutral-200 text-xs">
                <span className="text-neutral-600">
                  Page <span className="font-semibold text-neutral-900">{legacyPage}</span> of{' '}
                  <span className="font-semibold text-neutral-900">{legacyTotalPages}</span> ({legacyTotalCount} total payments)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={legacyPage <= 1}
                    onClick={() => setLegacyPage(p => Math.max(1, p - 1))}
                    className="px-2.5 py-1 border border-neutral-300 rounded bg-white text-neutral-700 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={legacyPage >= legacyTotalPages}
                    onClick={() => setLegacyPage(p => Math.min(legacyTotalPages, p + 1))}
                    className="px-2.5 py-1 border border-neutral-300 rounded bg-white text-neutral-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (`;

if (!content.includes("paymentsTab === 'legacy' ? (")) {
  content = content.replace(activeTableContainer, legacySectionCode);
  // Also close the conditional after the active table
  const endTableTarget = `      {/* Modals */}`;
  content = content.replace(endTableTarget, `      )}\n\n      {/* Modals */}`);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('PaymentsPage updated with Historical Payments (Starplus) tab successfully!');
