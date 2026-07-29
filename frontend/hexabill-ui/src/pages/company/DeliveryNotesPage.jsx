import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, Package, Printer, RefreshCw, Search, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { salesAPI } from '../../services'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'

function openPdfBlob(blob) {
  const url = window.URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }, 1000)
}

export default function DeliveryNotesPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(30)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const debouncedSearch = useDebounce(searchTerm, 300)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page: currentPage, pageSize }
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim()
      const res = await salesAPI.getSales(params)
      if (res?.success && res?.data) {
        setRows(res.data.items || [])
        setTotalCount(res.data.totalCount || 0)
        setTotalPages(res.data.totalPages || 1)
      } else {
        setRows([])
        setTotalCount(0)
        setTotalPages(1)
        setError(res?.message || 'Failed to load delivery notes')
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, debouncedSearch])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch])

  const handlePdf = async (sale, format, mode) => {
    setBusyId(sale.id)
    setError('')
    try {
      const layout = mode === 'download' ? 'full' : 'body'
      const blob = await salesAPI.getDeliveryNotePdf(sale.id, { format, layout })
      const name = `DN-${sale.invoiceNo || sale.id}_${format}.pdf`
      if (mode === 'download') downloadBlob(blob, name)
      else openPdfBlob(blob)
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Delivery note PDF failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-neutral-50 overflow-hidden w-full max-w-full p-2 md:p-3">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold text-text-primary leading-tight">Delivery Notes</h1>
          <p className="text-xs text-text-secondary truncate">
            From invoices — Print = letterhead body; Download = full header/footer
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="shrink-0 mb-2 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[10rem] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoice #, customer…"
            className="w-full border border-gray-300 rounded-md pl-8 pr-2 py-1.5 text-sm bg-white"
          />
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {rows.length} / {totalCount}
        </span>
      </div>

      {error && (
        <div className="shrink-0 text-sm text-red-600 mb-2 bg-red-50 border border-red-200 rounded px-3 py-1.5">{error}</div>
      )}

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white border border-gray-200 rounded-lg">
        {loading ? (
          <p className="text-sm text-text-secondary p-4">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Package className="w-9 h-9 mb-2 text-slate-400" />
            <p className="text-text-primary font-medium mb-0.5">No delivery notes yet</p>
            <p className="text-sm text-text-secondary">Create invoices in POS — each sale can print a delivery note.</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-slate-50 text-left sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">DN / Invoice #</th>
                  <th className="px-2 py-1.5 font-semibold">Date</th>
                  <th className="px-2 py-1.5 font-semibold">Customer</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Items</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const itemCount = r.itemCount ?? r.items?.length ?? 0
                  const busy = busyId === r.id
                  return (
                    <tr
                      key={r.id}
                      className="border-t hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/delivery-notes/${r.id}`)}
                    >
                      <td className="px-2 py-1 font-medium">DN-{r.invoiceNo}</td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {r.invoiceDate
                          ? new Date(r.invoiceDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-2 py-1">{r.customerName || 'Cash Customer'}</td>
                      <td className="px-2 py-1 text-right">{itemCount}</td>
                      <td className="px-2 py-1 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1 justify-end">
                          <Link
                            to={`/delivery-notes/${r.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-xs hover:bg-gray-50"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </Link>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handlePdf(r, 'A4', 'download')}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-xs hover:bg-gray-50 disabled:opacity-50"
                            title="Download full PDF"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handlePdf(r, 'A4', 'print')}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-xs hover:bg-gray-50 disabled:opacity-50"
                            title="Print A4 on letterhead"
                          >
                            <Printer className="w-3.5 h-3.5" /> A4
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handlePdf(r, 'A5', 'print')}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-xs hover:bg-gray-50 disabled:opacity-50"
                            title="Print A5 on letterhead"
                          >
                            <Printer className="w-3.5 h-3.5" /> A5
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center px-3 py-1 border rounded text-sm disabled:opacity-50 bg-white"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center px-3 py-1 border rounded text-sm disabled:opacity-50 bg-white"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
