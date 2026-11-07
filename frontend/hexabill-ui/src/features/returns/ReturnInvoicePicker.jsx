import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { salesAPI } from '../../services/index'
import { formatCurrency } from '../../utils/currency'
import { buildInvoiceQuery, pickableInvoices, returnHrefForSale, RECENT_DAYS } from './invoicePickerQuery'

/** Shown on /returns/create when no invoice is in the URL: pick one, and the existing return flow opens (UX-A04). */
export default function ReturnInvoicePicker ({ onBack }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryTick, setRetryTick] = useState(0)
  const latest = useRef(0)

  useEffect(() => {
    const id = ++latest.current
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await salesAPI.getSales(buildInvoiceQuery(search))
        if (id !== latest.current) return // a newer search already started
        if (res?.success === false) throw new Error(res?.message || 'failed')
        setRows(pickableInvoices(res?.data?.items))
      } catch (e) {
        if (id !== latest.current) return
        setRows([])
        setError(e?.response?.data?.message || 'Invoices could not be loaded. Check your connection, then try again.')
      } finally {
        if (id === latest.current) setLoading(false)
      }
    }, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [search, retryTick])

  const open = (sale) => navigate(returnHrefForSale(sale.id), { replace: true, state: location.state })
  const searching = search.trim().length >= 2

  return (
    <div className="p-4 max-w-2xl">
      <h1 className="text-lg font-semibold text-neutral-900">New return</h1>
      <p className="mt-1 text-sm text-neutral-600">Choose the invoice the goods came from.</p>
      <label className="mt-3 block">
        <span className="sr-only">Search by invoice number or customer</span>
        <input
          type="search"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Invoice number or customer"
          className="w-full min-h-11 rounded-md border border-neutral-300 px-3 text-sm"
        />
      </label>
      <p className="mt-2 text-xs text-neutral-500">
        {searching ? 'Searching all invoices.' : `Showing invoices from the last ${RECENT_DAYS} days. Type to search older ones.`}
      </p>

      <div className="mt-2 divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white" aria-busy={loading}>
        {loading && <p className="p-4 text-sm text-neutral-500">Loading invoices…</p>}
        {!loading && error && (
          <div className="p-4">
            <p className="text-sm text-neutral-800">{error}</p>
            <button type="button" className="mt-2 min-h-11 text-sm text-primary-700" onClick={() => setRetryTick((n) => n + 1)}>Try again</button>
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <p className="p-4 text-sm text-neutral-600">{searching ? 'No invoice matches that search.' : `No invoices in the last ${RECENT_DAYS} days. Type a number or customer to search older ones.`}</p>
        )}
        {!loading && !error && rows.map((sale) => (
          <button
            key={sale.id}
            type="button"
            onClick={() => open(sale)}
            className="flex w-full min-h-11 items-center justify-between gap-3 px-3 py-2 text-left hover:bg-neutral-50"
            aria-label={`Return from ${sale.invoiceNo}`}
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-neutral-900">{sale.invoiceNo}</span>
              <span className="block truncate text-xs text-neutral-500">
                {sale.customerName || 'Cash customer'} · {String(sale.invoiceDate || '').slice(0, 10)}
              </span>
            </span>
            <span className="shrink-0 text-sm tabular-nums text-neutral-900">{formatCurrency(sale.grandTotal)}</span>
          </button>
        ))}
      </div>
      <button type="button" className="mt-3 min-h-11 text-sm text-neutral-700" onClick={onBack}>Back</button>
    </div>
  )
}
