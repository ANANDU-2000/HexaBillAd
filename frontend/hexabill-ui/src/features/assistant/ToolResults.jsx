import { Link } from 'react-router-dom'
import { AlertCircle } from '../../components/ui/icons'
import { ROUTE_TOOLS, routeRowDetail, routeMapLink } from './assistantChat'
import { formatAED } from './ActionCards'

const cardClass = 'overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-900'
const linkClass = 'shrink-0 text-xs font-medium text-primary-700 underline hover:text-primary-800'

export const asOfLabel = (asOf) => {
  if (!asOf) return ''
  const d = new Date(asOf)
  return Number.isNaN(d.getTime()) ? '' : `as of ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function CardHeader ({ title, asOf }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2">
      <span className="text-sm font-semibold">{title}</span>
      {asOfLabel(asOf) && <span className="text-xs text-neutral-600">{asOfLabel(asOf)}</span>}
    </div>
  )
}

/** Compact table: label left, amount right. Figures come from the server; this only formats them. */
export function SummaryCard ({ summary, asOf, onAskPrompt }) {
  if (!summary) return <p className="text-sm text-neutral-700">No summary data available for today.</p>
  const lines = [
    ['Sales today', formatAED(summary.salesToday ?? 0)],
    ['Received today', formatAED(summary.collectionsToday ?? 0)],
    ['Purchases today', formatAED(summary.purchasesToday ?? 0)],
    ['Expenses today', formatAED(summary.expensesToday ?? 0)],
    ['Profit today', summary.profitToday != null ? formatAED(summary.profitToday) : 'Owner only'],
    [`Pending${summary.pendingBills > 0 ? ` (${summary.pendingBills} bills)` : ''}`, formatAED(summary.pendingBillsAmount ?? 0)],
  ]
  const lowStock = summary.lowStockCount ?? 0
  return (
    <div className={cardClass} data-testid="tool-summary">
      <CardHeader title="Today's business summary" asOf={asOf} />
      <table className="w-full text-sm">
        <tbody className="divide-y divide-neutral-100">
          {lines.map(([label, value]) => (
            <tr key={label}>
              <th scope="row" className="px-3 py-1.5 text-left text-sm font-normal text-neutral-700">{label}</th>
              <td className="px-3 py-1.5 text-right font-medium tabular-nums">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {lowStock > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-neutral-100 bg-warning-bg px-3 py-2 text-xs text-warning-fg">
          <span className="flex items-center gap-1.5 font-medium">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {lowStock} {lowStock === 1 ? 'item is' : 'items are'} running low
          </span>
          <button type="button" onClick={() => onAskPrompt?.('Show low stock products')} className="font-semibold underline">View items</button>
        </div>
      )}
      <div className="flex items-center justify-end gap-3 border-t border-neutral-100 px-3 py-2 text-xs">
        <Link to="/sales-ledger" className="font-medium text-primary-700 hover:underline">Sales ledger</Link>
        <Link to="/dashboard" className="font-medium text-primary-700 hover:underline">Dashboard</Link>
      </div>
    </div>
  )
}

export function ToolResultCard ({ tool, title, rows, asOf }) {
  if (!rows || rows.length === 0) return <p className="text-sm text-neutral-700">No records found for that.</p>
  return (
    <div className={cardClass} data-testid="tool-result">
      <CardHeader title={title || 'Results'} asOf={asOf} />
      <ul className="divide-y divide-neutral-100">
        {rows.map((r, idx) => {
          if (ROUTE_TOOLS.has(tool)) {
            return (
              <li key={r.routeId ? `${r.routeId}-${r.customerId ?? idx}` : idx} className="flex items-start justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-neutral-700">{routeRowDetail(tool, r)}</p>
                </div>
                {routeMapLink(r) && <Link to={routeMapLink(r)} className={linkClass}>Map pin</Link>}
              </li>
            )
          }
          if (tool === 'search_company_documents') {
            return (
              <li key={r.id || idx} className="px-3 py-2">
                <p className="text-sm font-medium">{r.title} <span className="text-xs font-normal text-neutral-600">v{r.version} · {r.location}</span></p>
                <p className="mt-0.5 break-words text-xs italic text-neutral-700">&ldquo;{r.snippet}&rdquo;</p>
                <Link to="/documents" className="mt-1 inline-block text-xs font-medium text-primary-700 underline">Open document</Link>
              </li>
            )
          }
          if (tool === 'find_customers') {
            return (
              <li key={r.id || idx} className="flex items-start justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-neutral-700">
                    {r.phone || 'No phone'}
                    {r.balance != null && <span className="ml-2 tabular-nums">Balance {formatAED(r.balance)}</span>}
                  </p>
                </div>
                <Link to={`/customers/${r.id}`} className={linkClass}>Profile</Link>
              </li>
            )
          }
          return (
            <li key={r.id || idx} className="flex items-start justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.name}{r.sku && <span className="ml-1 font-mono text-xs text-neutral-600">{r.sku}</span>}</p>
                <p className="text-xs text-neutral-700">
                  Stock <strong className={r.lowStock ? 'text-error-fg' : 'text-neutral-900'}>{r.stockQty} {r.unit || 'pcs'}</strong>
                  {r.lowStock && <span className="ml-1 font-semibold text-error-fg">low</span>}
                  <span className="tabular-nums"> · Sell {formatAED(r.sellPrice)}</span>
                </p>
              </div>
              <Link to={`/products/${r.id}`} className={linkClass}>View</Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
