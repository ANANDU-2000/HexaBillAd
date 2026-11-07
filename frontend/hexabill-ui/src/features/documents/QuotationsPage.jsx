import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useConfirmDialog } from '../../hooks/useConfirmDialog'
import { Plus, FileText, Pencil, Printer, Trash2, Download, Copy, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { quotationsAPI } from '../../services/documentsApi'
import { useBranding } from '../../tenant/TenantBrandingContext'
import { reserveTab, showPdf, closeTab, downloadBlob } from '../../utils/pdfOpen'
import { localDateString } from '../../utils/dateFormat'

const STATUSES = ['Draft', 'Final', 'Sent', 'Accepted', 'Rejected', 'Expired']
const PAGE_SIZE = 25
const SORTS = {
  newest: ['Newest first', (a, b) => String(b.quoteDate).localeCompare(String(a.quoteDate)) || b.id - a.id],
  oldest: ['Oldest first', (a, b) => String(a.quoteDate).localeCompare(String(b.quoteDate)) || a.id - b.id],
  high: ['Highest total', (a, b) => Number(b.grandTotal) - Number(a.grandTotal)],
  low: ['Lowest total', (a, b) => Number(a.grandTotal) - Number(b.grandTotal)],
  customer: ['Customer A-Z', (a, b) => String(a.customerName || '').localeCompare(String(b.customerName || ''))],
}
const BADGE = {
  Draft: 'bg-slate-100 text-slate-700',
  Final: 'bg-blue-50 text-blue-700',
  Sent: 'bg-indigo-50 text-indigo-700',
  Accepted: 'bg-green-50 text-green-700',
  Rejected: 'bg-red-50 text-red-700',
  Expired: 'bg-amber-50 text-amber-800',
}

const day = (v) => (v ? String(v).slice(0, 10) : '')

function StatusBadge({ status }) {
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${BADGE[status] || BADGE.Draft}`}>{status}</span>
}

export default function QuotationsPage() {
  const [askConfirm, confirmDialog] = useConfirmDialog()
  const { currency = 'AED' } = useBranding()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const today = localDateString()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await quotationsAPI.list()
      setRows(res?.data || [])
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const isLapsed = (r) => r.validUntil && day(r.validUntil) < today && ['Draft', 'Final', 'Sent'].includes(r.status)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((r) => (!statusFilter || r.status === statusFilter))
      .filter((r) => !q || [r.quoteNo, r.customerName, r.subject, r.customerTrn].some((f) => String(f || '').toLowerCase().includes(q)))
      .sort(SORTS[sort][1])
  }, [rows, query, statusFilter, sort])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pages)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const totalValue = filtered.reduce((sum, r) => sum + Number(r.grandTotal || 0), 0)
  const filtersActive = Boolean(query || statusFilter)

  useEffect(() => setPage(1), [query, statusFilter, sort])

  const handleDelete = async (row) => {
    if (!(await askConfirm({ title: `Delete ${row.quoteNo}?`, message: 'The quotation will be permanently removed. This cannot be undone.', confirmLabel: 'Delete quotation' }))) return
    setBusyId(row.id)
    setError('')
    try {
      await quotationsAPI.delete(row.id)
      window.dispatchEvent(new CustomEvent('dataUpdated'))
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      toast.success(`${row.quoteNo} deleted`)
    } catch (e) {
      setError(
        e?.response?.status === 403
          ? 'Only an Owner or Admin can delete quotations.'
          : e?.response?.data?.message || 'Delete failed'
      )
    } finally {
      setBusyId(null)
    }
  }

  const handlePdf = async (row, format, mode, layout = 'full') => {
    // Open the tab synchronously inside the click so popup blockers / iOS Safari allow it.
    const tab = mode === 'download' ? null : reserveTab()
    setBusyId(row.id)
    setError('')
    try {
      const blob = await quotationsAPI.getPdf(row.id, format, layout)
      if (mode === 'download') downloadBlob(blob, `${row.quoteNo}_${format}.pdf`)
      else showPdf(blob, `${row.quoteNo}_${format}.pdf`, tab)
    } catch (e) {
      closeTab(tab)
      setError(e?.response?.data?.message || 'PDF failed')
    } finally {
      setBusyId(null)
    }
  }

  /** Quick status change from the list: resend the quotation as stored with only the status changed. */
  const changeStatus = async (row, status) => {
    if (status === row.status) return
    setBusyId(row.id)
    setError('')
    try {
      const res = await quotationsAPI.update(row.id, {
        quoteDate: row.quoteDate,
        customerName: row.customerName,
        customerAddress: row.customerAddress,
        customerPhone: row.customerPhone,
        customerEmail: row.customerEmail,
        customerId: row.customerId,
        customerTrn: row.customerTrn,
        validUntil: row.validUntil,
        subject: row.subject,
        termsAndConditions: row.termsAndConditions,
        notes: row.notes,
        salutation: row.salutation,
        introLine: row.introLine,
        closingLine: row.closingLine,
        discount: row.discount,
        status,
        items: (row.items || []).map((i) => ({
          productId: i.productId,
          description: i.description,
          descriptionSubtitle: i.descriptionSubtitle,
          unitLabel: i.unitLabel,
          qty: i.qty,
          unitPrice: i.unitPrice,
          vatRate: i.vatRate,
        })),
      })
      const updated = res?.data ?? res
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)))
      toast.success(`${row.quoteNo} marked ${status}`)
    } catch (e) {
      setError(e?.response?.data?.message || 'Status change failed')
    } finally {
      setBusyId(null)
    }
  }

  const clearFilters = () => {
    setQuery('')
    setStatusFilter('')
  }

  const field = 'min-h-11 md:min-h-9 border rounded-md px-2 text-sm bg-white'

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden w-full max-w-full p-2 md:p-3">
      <div className="shrink-0 flex items-center justify-between mb-2 gap-2">
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold text-text-primary leading-tight">Quotations</h1>
          <p className="text-xs text-text-secondary truncate">
            {loading ? 'Loading…' : `${filtered.length} of ${rows.length} quotation${rows.length === 1 ? '' : 's'} · ${currency} ${totalValue.toFixed(2)}`}
          </p>
        </div>
        <Link
          to="/quotations/new"
          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-11 md:min-h-0 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-md text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" /> New
        </Link>
      </div>

      {rows.length > 0 && (
        <div className="shrink-0 mb-2 flex flex-wrap gap-2 items-center">
          <label className="relative flex-1 min-w-[12rem] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search number, customer, subject, TRN"
              aria-label="Search quotations"
              className={`${field} w-full pl-8`}
            />
          </label>
          <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={field}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select aria-label="Sort quotations" value={sort} onChange={(e) => setSort(e.target.value)} className={field}>
            {Object.entries(SORTS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
          </select>
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="min-h-11 md:min-h-9 px-3 text-sm text-primary">Clear</button>
          )}
        </div>
      )}

      {error && <div className="shrink-0 text-sm text-neutral-800 mb-2 bg-white border border-neutral-200 border-l-4 border-l-error rounded px-3 py-1.5" role="alert">{error}</div>}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white border border-neutral-200 rounded-lg">
      {loading ? (
        <p className="text-sm text-text-secondary p-4">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <FileText className="w-9 h-9 mx-auto mb-2 text-slate-400" />
          <p className="text-text-primary font-medium mb-1">No quotations yet</p>
          <p className="text-sm text-text-secondary mb-3">Create your first quote for a customer, then print or download PDF.</p>
          <Link
            to="/quotations/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-md text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create first quotation
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-text-primary font-medium mb-2">No quotations match your filters</p>
          <button type="button" onClick={clearFilters} className="min-h-11 px-4 text-sm text-primary border rounded-md">Clear filters</button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          {/* Phone: identity and actions in one card, no sideways scrolling (UX-02) */}
          <ul className="md:hidden divide-y" aria-label="Quotations">
            {visible.map((r) => (
              <li key={r.id} className="px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="text-primary font-semibold" to={`/quotations/${r.id}`}>{r.quoteNo}</Link>
                    <p className="break-words text-sm text-slate-800">{r.customerName || '—'}</p>
                    {r.subject ? <p className="break-words text-xs text-slate-500">{r.subject}</p> : null}
                    <p className="text-xs text-slate-500">
                      {day(r.quoteDate)} · {(r.items || []).length} item{(r.items || []).length === 1 ? '' : 's'}
                      {r.validUntil ? <> · valid to {day(r.validUntil)}{isLapsed(r) ? <span className="text-amber-700 font-medium"> (lapsed)</span> : null}</> : null}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">{currency} {Number(r.grandTotal).toFixed(2)}</p>
                </div>
                <div className="mt-2">
                  <label className="text-xs text-slate-500 flex items-center gap-2">
                    Status
                    <select
                      aria-label={`Status of ${r.quoteNo}`}
                      value={r.status}
                      disabled={busyId === r.id}
                      onChange={(e) => changeStatus(r, e.target.value)}
                      className={`${field} flex-1`}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    ['Edit', () => navigate(`/quotations/${r.id}`), Pencil, false],
                    ['Print', () => handlePdf(r, 'A4', 'print', 'body'), Printer, false],
                    ['Full', () => handlePdf(r, 'A4', 'print', 'full'), Printer, false],
                    ['PDF', () => handlePdf(r, 'A4', 'download', 'full'), Download, false],
                    ['Copy', () => navigate(`/quotations/new?copy=${r.id}`), Copy, false],
                    ['Delete', () => handleDelete(r), Trash2, true],
                  ].map(([label, action, Icon, danger]) => (
                    <button
                      key={label}
                      type="button"
                      disabled={busyId === r.id}
                      onClick={action}
                      aria-label={`${label} ${r.quoteNo}`}
                      className={`inline-flex min-h-11 items-center gap-1 rounded border px-3 text-sm disabled:opacity-50 ${danger ? 'border-error-border text-error-fg' : 'hover:bg-slate-100'}`}
                    >
                      <Icon className="w-4 h-4" aria-hidden /> {label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <table className="hidden md:table w-full text-sm min-w-[860px]">
            <thead className="bg-slate-50 text-left sticky top-0 z-10">
              <tr>
                <th className="px-2 py-1.5 font-semibold">Quote #</th>
                <th className="px-2 py-1.5 font-semibold">Date</th>
                <th className="px-2 py-1.5 font-semibold">Valid until</th>
                <th className="px-2 py-1.5 font-semibold">Customer</th>
                <th className="px-2 py-1.5 font-semibold text-right">Items</th>
                <th className="px-2 py-1.5 font-semibold">Status</th>
                <th className="px-2 py-1.5 font-semibold text-right">Total</th>
                <th className="px-2 py-1.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50 align-top">
                  <td className="px-2 py-1.5">
                    <Link className="text-primary font-medium" to={`/quotations/${r.id}`}>{r.quoteNo}</Link>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{day(r.quoteDate)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {r.validUntil ? day(r.validUntil) : '—'}
                    {isLapsed(r) ? <span className="ml-1 text-xs text-amber-700 font-medium">lapsed</span> : null}
                  </td>
                  <td className="px-2 py-1.5">
                    <div>{r.customerName || '—'}</div>
                    {r.subject ? <div className="text-xs text-slate-500">{r.subject}</div> : null}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{(r.items || []).length}</td>
                  <td className="px-2 py-1.5">
                    <select
                      aria-label={`Status of ${r.quoteNo}`}
                      value={r.status}
                      disabled={busyId === r.id}
                      onChange={(e) => changeStatus(r, e.target.value)}
                      className={`border rounded px-1.5 py-1 text-xs font-medium ${BADGE[r.status] || BADGE.Draft}`}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">{currency} {Number(r.grandTotal).toFixed(2)}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap justify-end gap-1">
                      {[
                        ['Edit', 'Edit', () => navigate(`/quotations/${r.id}`), Pencil, false],
                        ['Print', 'Print on letterhead paper (body only)', () => handlePdf(r, 'A4', 'print', 'body'), Printer, false],
                        ['Full', 'Print full document (with header/footer)', () => handlePdf(r, 'A4', 'print', 'full'), Printer, false],
                        ['PDF', 'Download full PDF', () => handlePdf(r, 'A4', 'download', 'full'), Download, false],
                        ['Copy', 'Duplicate as a new quotation', () => navigate(`/quotations/new?copy=${r.id}`), Copy, false],
                        ['Delete', 'Delete', () => handleDelete(r), Trash2, true],
                      ].map(([label, title, action, Icon, danger]) => (
                        <button
                          key={label}
                          type="button"
                          title={title}
                          disabled={busyId === r.id}
                          onClick={action}
                          className={`inline-flex items-center gap-0.5 px-2 py-1 text-xs border rounded disabled:opacity-50 ${danger ? 'border-error-border text-error-fg hover:bg-error-bg' : 'hover:bg-slate-100'}`}
                        >
                          <Icon className="w-3.5 h-3.5" /> {label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && filtered.length > PAGE_SIZE && (
        <div className="shrink-0 flex items-center justify-between gap-2 border-t px-3 py-2 text-sm">
          <span className="text-text-secondary">Page {safePage} of {pages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="min-h-11 md:min-h-9 px-3 border rounded-md disabled:opacity-40">Previous</button>
            <button type="button" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)} className="min-h-11 md:min-h-9 px-3 border rounded-md disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
      </div>
      {confirmDialog}
    </div>
  )
}
