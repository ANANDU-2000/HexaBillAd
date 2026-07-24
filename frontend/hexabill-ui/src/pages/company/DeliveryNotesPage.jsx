import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, Package, Printer, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react'
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
      const blob = await salesAPI.getDeliveryNotePdf(sale.id, { format })
      const name = `DN-${sale.invoiceNo || sale.id}_${format}.pdf`
      if (mode === 'download') downloadBlob(blob, name)
      else openPdfBlob(blob)
    } catch (e) {
      const msg = e?.message || 'Delivery note PDF failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-3 md:p-4 w-full max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h1 className="text-h2 font-bold text-text-primary">Delivery Notes</h1>
          <p className="text-sm text-text-secondary">
            Packing lists from invoices — view details or print A4/A5 (letterhead-ready)
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoice #, customer…"
            className="w-full border border-gray-300 rounded-md pl-8 pr-2 py-1.5 text-sm"
          />
        </div>
        <span className="text-xs text-gray-500">
          Showing {rows.length} of {totalCount}
        </span>
      </div>

      {error && (
        <div className="text-sm text-red-600 mb-2 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="border rounded-lg p-8 text-center bg-white">
          <Package className="w-10 h-10 mx-auto mb-3 text-slate-400" />
          <p className="text-text-primary font-medium mb-1">No delivery notes yet</p>
          <p className="text-sm text-text-secondary">Create invoices in POS — each sale can print a delivery note.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-2 py-1.5">DN / Invoice #</th>
                <th className="px-2 py-1.5">Date</th>
                <th className="px-2 py-1.5">Customer</th>
                <th className="px-2 py-1.5 text-right">Items</th>
                <th className="px-2 py-1.5 text-right">Actions</th>
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
                    <td className="px-2 py-1.5 font-medium">DN-{r.invoiceNo}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {r.invoiceDate
                        ? new Date(r.invoiceDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-2 py-1.5">{r.customerName || 'Cash Customer'}</td>
                    <td className="px-2 py-1.5 text-right">{itemCount}</td>
                    <td className="px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
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
                          onClick={() => handlePdf(r, 'A4', 'print')}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-xs hover:bg-gray-50 disabled:opacity-50"
                          title="Print A4"
                        >
                          <Printer className="w-3.5 h-3.5" /> A4
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handlePdf(r, 'A5', 'print')}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-xs hover:bg-gray-50 disabled:opacity-50"
                          title="Print A5"
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-3">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center px-3 py-1.5 border rounded text-sm disabled:opacity-50"
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
            className="inline-flex items-center px-3 py-1.5 border rounded text-sm disabled:opacity-50"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
