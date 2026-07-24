import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Package, Printer } from 'lucide-react'
import { salesAPI } from '../../services'
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

export default function DeliveryNoteViewPage() {
  const { saleId } = useParams()
  const navigate = useNavigate()
  const [sale, setSale] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await salesAPI.getSale(saleId)
      if (res?.success && res?.data) {
        setSale(res.data)
      } else {
        setSale(null)
        setError(res?.message || 'Delivery note not found')
      }
    } catch (e) {
      setSale(null)
      setError(e?.response?.data?.message || e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [saleId])

  useEffect(() => {
    load()
  }, [load])

  const handlePdf = async (format, mode) => {
    if (!sale?.id) return
    setBusy(true)
    try {
      const blob = await salesAPI.getDeliveryNotePdf(sale.id, { format })
      const name = `DN-${sale.invoiceNo || sale.id}_${format}.pdf`
      if (mode === 'download') downloadBlob(blob, name)
      else openPdfBlob(blob)
    } catch (e) {
      toast.error(e?.message || 'PDF failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-text-secondary">Loading delivery note…</div>
  }

  if (!sale) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-600 mb-3">{error || 'Not found'}</p>
        <Link to="/delivery-notes" className="text-sm text-primary-600 hover:underline">
          Back to list
        </Link>
      </div>
    )
  }

  const items = sale.items || []

  return (
    <div className="p-3 md:p-4 w-full max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/delivery-notes')}
            className="p-1.5 rounded border border-gray-200 hover:bg-gray-50"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-text-primary truncate">
              Delivery Note DN-{sale.invoiceNo}
            </h1>
            <p className="text-xs text-text-secondary">
              Packing list (no prices) · Invoice {sale.invoiceNo}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => handlePdf('A4', 'download')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> Download
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handlePdf('A4', 'print')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" /> Print A4
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handlePdf('A5', 'print')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-primary-300 text-primary-700 bg-primary-50 hover:bg-primary-100 disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" /> Print A5
          </button>
        </div>
      </div>

      <div className="border rounded-lg bg-white p-4 shadow-sm">
        <div className="flex items-start gap-2 mb-4">
          <Package className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm flex-1">
            <div>
              <div className="text-xs text-text-secondary">Customer</div>
              <div className="font-medium">{sale.customerName || 'Cash Customer'}</div>
            </div>
            <div>
              <div className="text-xs text-text-secondary">Date</div>
              <div className="font-medium">
                {sale.invoiceDate
                  ? new Date(sale.invoiceDate).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </div>
            </div>
            {sale.notes ? (
              <div className="sm:col-span-2">
                <div className="text-xs text-text-secondary">Notes</div>
                <div>{sale.notes}</div>
              </div>
            ) : null}
          </div>
        </div>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-2 py-1.5 border-b w-12">#</th>
              <th className="px-2 py-1.5 border-b">Description</th>
              <th className="px-2 py-1.5 border-b text-right">Unit</th>
              <th className="px-2 py-1.5 border-b text-right">Qty</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2 py-4 text-center text-text-secondary">
                  No line items
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={item.id || idx} className="border-b border-slate-100">
                  <td className="px-2 py-1.5">{idx + 1}</td>
                  <td className="px-2 py-1.5 font-medium">{item.productName || '—'}</td>
                  <td className="px-2 py-1.5 text-right text-text-secondary">{item.unitType || '—'}</td>
                  <td className="px-2 py-1.5 text-right">{item.qty}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="text-xs text-text-secondary mt-3">
          Print uses letterhead-only margins and stamp/signature when enabled in Settings.
        </p>
      </div>
    </div>
  )
}
