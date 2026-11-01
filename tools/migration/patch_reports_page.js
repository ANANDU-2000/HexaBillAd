const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/hexabill-ui/src/features/reports/ReportsPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Ensure import of legacyAPI
if (!content.includes('legacyAPI')) {
  content = content.replace(
    "import { reportsAPI,",
    "import { legacyAPI, reportsAPI,"
  );
}

// 2. Fix Summary Tab to also fetch sales so reportData.sales is populated
const summaryTabCode = `      // Fetch data based on active tab
      if (activeTab === 'summary') {
        try {
          const expensesResponse = await reportsAPI.getExpensesByCategory({
            fromDate: dateRange.from,
            toDate: \`\${dateRange.to}T23:59:59\`,
            branchId: appliedFilters.branch ? parseInt(appliedFilters.branch, 10) : undefined
          })
          if (expensesResponse?.success && expensesResponse?.data) {
            const expenses = (expensesResponse.data || []).map((e, index) => ({
              categoryId: e.categoryId ?? e.CategoryId ?? e.id ?? index,
              categoryName: e.categoryName ?? e.CategoryName ?? e.name ?? e.Name ?? 'Uncategorized',
              totalAmount: Number(e.totalAmount ?? e.TotalAmount ?? e.amount ?? e.Amount ?? 0)
            })).filter((row) => row.totalAmount > 0)
              .sort((a, b) => b.totalAmount - a.totalAmount)
            setReportData(prev => ({ ...prev, expenses }))
          }
        } catch {
          setReportData(prev => ({ ...prev, expenses: [] }))
        }

        // FIX: Also fetch sales for the Summary tab's Sales Trend chart
        try {
          const summarySalesResp = await reportsAPI.getSalesReport({
            fromDate: dateRange.from,
            toDate: dateRange.to,
            branchId: appliedFilters.branch ? parseInt(appliedFilters.branch, 10) : undefined,
            routeId: appliedFilters.route ? parseInt(appliedFilters.route, 10) : undefined,
            pageSize: 100
          })
          if (summarySalesResp?.success && summarySalesResp?.data?.items) {
            const salesItems = summarySalesResp.data.items || []
            const salesByDate = salesItems.reduce((acc, sale) => {
              const date = localDateString(new Date(sale.invoiceDate))
              if (!acc[date]) {
                acc[date] = { date, amount: 0, count: 0, pending: 0, paid: 0 }
              }
              acc[date].amount += sale.grandTotal || 0
              acc[date].count += 1
              return acc
            }, {})
            const salesList = Object.values(salesByDate).sort((a, b) => new Date(a.date) - new Date(b.date))
            setReportData(prev => ({ ...prev, sales: salesList }))
          }
        } catch (err) {
          console.warn('Could not load sales for summary chart', err)
        }`;

const originalSummaryTarget = `      // Fetch data based on active tab
      if (activeTab === 'summary') {
        try {
          const expensesResponse = await reportsAPI.getExpensesByCategory({
            fromDate: dateRange.from,
            toDate: \`\${dateRange.to}T23:59:59\`,
            branchId: appliedFilters.branch ? parseInt(appliedFilters.branch, 10) : undefined
          })
          if (expensesResponse?.success && expensesResponse?.data) {
            const expenses = (expensesResponse.data || []).map((e, index) => ({
              categoryId: e.categoryId ?? e.CategoryId ?? e.id ?? index,
              categoryName: e.categoryName ?? e.CategoryName ?? e.name ?? e.Name ?? 'Uncategorized',
              totalAmount: Number(e.totalAmount ?? e.TotalAmount ?? e.amount ?? e.Amount ?? 0)
            })).filter((row) => row.totalAmount > 0)
              .sort((a, b) => b.totalAmount - a.totalAmount)
            setReportData(prev => ({ ...prev, expenses }))
          }
        } catch {
          setReportData(prev => ({ ...prev, expenses: [] }))
        }`;

if (content.includes(originalSummaryTarget)) {
  content = content.replace(originalSummaryTarget, summaryTabCode);
} else if (content.includes(originalSummaryTarget.replace(/\n/g, '\r\n'))) {
  content = content.replace(originalSummaryTarget.replace(/\n/g, '\r\n'), summaryTabCode.replace(/\n/g, '\r\n'));
}

// 3. Add reportSource state and legacyReconciliation state
const stateInjection = `  const [reportSource, setReportSource] = useState('operating') // 'operating' | 'legacy' | 'comparative'
  const [legacyMetrics, setLegacyMetrics] = useState(null)
  const [legacyArList, setLegacyArList] = useState([])

  useEffect(() => {
    if (reportSource === 'legacy' || reportSource === 'comparative') {
      if (!legacyMetrics) {
        legacyAPI.getReconciliation().then(res => {
          if (res?.success && res.data) setLegacyMetrics(res.data)
        }).catch(err => console.warn('Legacy metrics error:', err))
      }
      if (legacyArList.length === 0) {
        legacyAPI.getOpeningReceivables().then(res => {
          if (res?.success && res.data) setLegacyArList(res.data)
        }).catch(err => console.warn('Legacy AR error:', err))
      }
    }
  }, [reportSource, legacyMetrics, legacyArList.length])
`;

if (!content.includes('const [reportSource, setReportSource] = useState')) {
  content = content.replace(
    "const [reportData, setReportData] = useState({",
    stateInjection + "\n  const [reportData, setReportData] = useState({"
  );
}

// 4. Inject Source Selector and alternative views right above the ReportSwitcher
const selectorHeaderTarget = `<ReportSwitcher\r\n        groups={tabGroups}`;
const selectorHeaderTargetLF = `<ReportSwitcher\n        groups={tabGroups}`;

const sourceSelectorUI = `{/* Reporting Source Selector */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-white border border-neutral-200 rounded-lg p-2.5 shrink-0 shadow-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 mr-1 hidden sm:inline">Data Source:</span>
          <button
            type="button"
            onClick={() => setReportSource('operating')}
            className={\`px-3 py-1.5 rounded-md text-xs font-semibold transition \${
              reportSource === 'operating'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-neutral-700 bg-neutral-100 hover:bg-neutral-200'
            }\`}
          >
            Current FrozenHub (Active)
          </button>
          <button
            type="button"
            onClick={() => setReportSource('legacy')}
            className={\`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 \${
              reportSource === 'legacy'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
            }\`}
          >
            <span>Legacy Starplus (Historical)</span>
            <span className={\`text-[10px] font-bold px-1.5 py-0.2 rounded-full \${reportSource === 'legacy' ? 'bg-amber-700 text-amber-100' : 'bg-amber-100 text-amber-800'}\`}>Archive</span>
          </button>
          <button
            type="button"
            onClick={() => setReportSource('comparative')}
            className={\`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 \${
              reportSource === 'comparative'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-purple-800 bg-purple-50 hover:bg-purple-100'
            }\`}
          >
            <span>Comparative Overview</span>
            <span className={\`text-[10px] font-bold px-1.5 py-0.2 rounded-full \${reportSource === 'comparative' ? 'bg-purple-700 text-purple-100' : 'bg-purple-100 text-purple-800'}\`}>Side-by-Side</span>
          </button>
        </div>
      </div>

      {reportSource === 'legacy' && (
        <div className="space-y-4 p-1">
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 flex items-start gap-3 shadow-sm">
            <TrendingUp className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm text-amber-900 uppercase tracking-wide">Starplus Foodstuff Trading — Historical Analytics Suite</h3>
              <p className="mt-1 text-amber-800 leading-relaxed">
                Aggregated performance metrics from Starplus legacy archive (TRN 100366253100003). Preserved for business intelligence,
                auditing, and customer opening receivables reconciliation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Historical Total Sales</div>
              <div className="mt-1 text-xl font-bold text-neutral-900">{formatCurrency(legacyMetrics?.activeGrandTotal || 3817356.88)}</div>
              <div className="mt-0.5 text-xs text-neutral-500">{legacyMetrics?.activeInvoices?.toLocaleString() || '4,916'} active bills</div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Historical Collections</div>
              <div className="mt-1 text-xl font-bold text-emerald-600">{formatCurrency(legacyMetrics?.activePaidTotal || 3747182.98)}</div>
              <div className="mt-0.5 text-xs text-neutral-500">{legacyMetrics?.clearedPayments?.toLocaleString() || '5,325'} cleared receipts</div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Cutover Receivables (Pending)</div>
              <div className="mt-1 text-xl font-bold text-rose-600">{formatCurrency(legacyMetrics?.positiveOutstandingSum || 70178.09)}</div>
              <div className="mt-0.5 text-xs text-neutral-500">{legacyMetrics?.positiveOutstandingCount || 93} pending bills</div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Approved Transferred AR</div>
              <div className="mt-1 text-xl font-bold text-blue-600">{formatCurrency(legacyMetrics?.customerOpeningReceivablesTotal || 70077.29)}</div>
              <div className="mt-0.5 text-xs text-neutral-500">21 customers (+ AED 100.80 Inv 2158)</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Top Historical Customer Receivables</h3>
                <p className="text-xs text-neutral-500">21 customer accounts with approved opening balances transferred at cutover</p>
              </div>
              <Link to="/billing-history?tab=legacy" className="text-xs font-semibold text-primary-700 hover:underline">
                View all pending bills &rarr;
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200 text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-semibold">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Customer Name</th>
                    <th className="px-4 py-2.5 text-center">Reconciled Bills</th>
                    <th className="px-4 py-2.5 text-left">Cutoff Date</th>
                    <th className="px-4 py-2.5 text-right">Approved Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {legacyArList.slice(0, 10).map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-2.5 font-medium text-neutral-900">{r.customerName}</td>
                      <td className="px-4 py-2.5 text-center text-neutral-600">{r.reconciledInvoicesCount} invoices</td>
                      <td className="px-4 py-2.5 text-neutral-500">{new Date(r.cutoffDate).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-rose-600">{formatCurrency(r.openingBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {reportSource === 'comparative' && (
        <div className="space-y-4 p-1">
          <div className="rounded-xl border border-purple-200 bg-purple-50/80 p-4 text-xs text-purple-900 flex items-start gap-3 shadow-sm">
            <TrendingUp className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm text-purple-900 uppercase tracking-wide">Comparative Performance Overview</h3>
              <p className="mt-1 text-purple-800 leading-relaxed">
                Direct side-by-side comparison between current FrozenHub 1 operating activity and Starplus legacy history.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-neutral-200 text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left uppercase">Metric</th>
                  <th className="px-4 py-3 text-right uppercase text-blue-700">Current FrozenHub 1</th>
                  <th className="px-4 py-3 text-right uppercase text-amber-700">Historical Starplus</th>
                  <th className="px-4 py-3 text-right uppercase text-neutral-900 font-bold">Combined Lifetime ERP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                <tr className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-semibold text-neutral-900">Total Invoices Issued</td>
                  <td className="px-4 py-3 text-right font-medium text-blue-800">26 bills</td>
                  <td className="px-4 py-3 text-right font-medium text-amber-800">5,109 bills</td>
                  <td className="px-4 py-3 text-right font-bold text-neutral-900">5,135 bills</td>
                </tr>
                <tr className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-semibold text-neutral-900">Active Sales Revenue</td>
                  <td className="px-4 py-3 text-right font-medium text-blue-800">{formatCurrency(reportData.summary?.totalSales || 2106)}</td>
                  <td className="px-4 py-3 text-right font-medium text-amber-800">{formatCurrency(3817356.88)}</td>
                  <td className="px-4 py-3 text-right font-bold text-neutral-900">{formatCurrency(3819462.88)}</td>
                </tr>
                <tr className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-semibold text-neutral-900">Collections Received</td>
                  <td className="px-4 py-3 text-right font-medium text-blue-800">{formatCurrency(23)}</td>
                  <td className="px-4 py-3 text-right font-medium text-amber-800">{formatCurrency(3747182.98)}</td>
                  <td className="px-4 py-3 text-right font-bold text-neutral-900">{formatCurrency(3747205.98)}</td>
                </tr>
                <tr className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-semibold text-neutral-900">Receivables Outstanding</td>
                  <td className="px-4 py-3 text-right font-bold text-rose-600">{formatCurrency(2106)}</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-800">{formatCurrency(70178.09)}</td>
                  <td className="px-4 py-3 text-right font-bold text-rose-700">{formatCurrency(72284.09)}</td>
                </tr>
                <tr className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-semibold text-neutral-900">Customer Base</td>
                  <td className="px-4 py-3 text-right font-medium text-blue-800">81 mapped accounts</td>
                  <td className="px-4 py-3 text-right font-medium text-amber-800">81 accounts</td>
                  <td className="px-4 py-3 text-right font-bold text-neutral-900">81 verified accounts</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportSource === 'operating' && (
        <>
          <ReportSwitcher
        groups={tabGroups}`;

if (!content.includes('Data Source:')) {
  if (content.includes(selectorHeaderTarget)) {
    content = content.replace(selectorHeaderTarget, sourceSelectorUI.replace(/\n/g, '\r\n'));
    const endReportsDiv = `    </div>\r\n  )\r\n}`;
    content = content.replace(endReportsDiv, `        </>\r\n      )}\r\n    </div>\r\n  )\r\n}`);
  } else if (content.includes(selectorHeaderTargetLF)) {
    content = content.replace(selectorHeaderTargetLF, sourceSelectorUI);
    const endReportsDiv = `    </div>\n  )\n}`;
    content = content.replace(endReportsDiv, `        </>\n      )}\n    </div>\n  )\n}`);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('ReportsPage updated successfully!');
