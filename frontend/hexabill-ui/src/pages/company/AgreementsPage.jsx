import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ScrollText } from 'lucide-react'
import { agreementsAPI } from '../../services/documentsApi'

export default function AgreementsPage() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await agreementsAPI.list()
        if (!cancelled) setRows(res?.data || [])
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || e.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div>
          <h1 className="text-h2 font-bold text-text-primary">Agreements</h1>
          <p className="text-sm text-text-secondary">Business Development Agreement — Second Party only varies.</p>
        </div>
        <Link to="/agreements/new" className="inline-flex items-center gap-1 px-3 py-2 bg-primary text-white rounded-md text-sm">
          <Plus className="w-4 h-4" /> New agreement
        </Link>
      </div>
      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
      {loading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-text-secondary">
          <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No agreements yet.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-2">No.</th>
                <th className="p-2">Date</th>
                <th className="p-2">Second Party</th>
                <th className="p-2">Status</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
