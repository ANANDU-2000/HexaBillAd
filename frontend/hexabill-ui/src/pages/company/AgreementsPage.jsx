import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, ScrollText, Pencil, Printer, Trash2, Download } from 'lucide-react'
import { agreementsAPI } from '../../services/documentsApi'

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

function openPdfBlob(blob) {
  const url = window.URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
}

export default function AgreementsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await agreementsAPI.list()
      setRows(res?.data || [])
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete ${row.agreementNo}? This cannot be undone.`)) return
    setBusyId(row.id)
    setError('')
    try {
      await agreementsAPI.delete(row.id)
      setRows((prev) => prev.filter((r) => r.id !== row.id))
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  const handlePdf = async (row, format, mode) => {
    setBusyId(row.id)
    setError('')
    try {
      const blob = await agreementsAPI.getPdf(row.id, format)
      if (mode === 'download') downloadBlob(blob, `${row.agreementNo}_${format}.pdf`)
      else openPdfBlob(blob)
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'PDF failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-3 md:p-4 w-full max-w-full">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div>
          <h1 className="text-h2 font-bold text-text-primary">Agreements</h1>
          <p className="text-sm text-text-secondary">History · edit · reprint · delete · A4/A5 PDF</p>
        </div>
        <Link to="/agreements/new" className="inline-flex items-center gap-1 px-3 py-2 bg-primary text-white rounded-md text-sm">
          <Plus className="w-4 h-4" /> New agreement
        </Link>
      </div>
      {error && <div className="text-sm text-red-600 mb-3 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      {loading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="border rounded-lg p-6 text-center text-text-secondary">
          <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No agreements yet.
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-2">No.</th>
                <th className="p-2">Date</th>
                <th className="p-2">Second Party</th>
                <th className="p-2">Status</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50">
                  <td className="p-2">
                    <Link className="text-primary font-medium" to={`/agreements/${r.id}`}>{r.agreementNo}</Link>
                  </td>
                  <td className="p-2">{String(r.agreementDate || '').slice(0, 10)}</td>
                  <td className="p-2">{r.secondPartyName || '—'}</td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      <button
                        type="button"
                        title="Edit"
                        disabled={busyId === r.id}
                        onClick={() => navigate(`/agreements/${r.id}`)}
                        className="inline-flex items-center gap-0.5 px-2 py-1 text-xs border rounded hover:bg-slate-100 disabled:opacity-50"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        title="Reprint A4"
                        disabled={busyId === r.id}
                        onClick={() => handlePdf(r, 'A4', 'print')}
                        className="inline-flex items-center gap-0.5 px-2 py-1 text-xs border rounded hover:bg-slate-100 disabled:opacity-50"
                      >
                        <Printer className="w-3.5 h-3.5" /> Reprint
                      </button>
                      <button
                        type="button"
                        title="Download PDF"
                        disabled={busyId === r.id}
                        onClick={() => handlePdf(r, 'A4', 'download')}
                        className="inline-flex items-center gap-0.5 px-2 py-1 text-xs border rounded hover:bg-slate-100 disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        disabled={busyId === r.id}
                        onClick={() => handleDelete(r)}
                        className="inline-flex items-center gap-0.5 px-2 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
