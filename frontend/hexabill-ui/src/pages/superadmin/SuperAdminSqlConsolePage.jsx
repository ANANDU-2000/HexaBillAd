import { useState } from 'react'
import { Play, AlertCircle, Database } from 'lucide-react'
import { superAdminAPI } from '../../services'
import toast from 'react-hot-toast'
import { showToast } from '../../utils/toast'

/**
 * Read-only SQL console for Super Admin. PRODUCTION_MASTER_TODO #47.
 * SELECT only; 30s timeout, 1000 row limit.
 */
const SuperAdminSqlConsolePage = () => {
  const [query, setQuery] = useState('SELECT 1 AS id, current_database() AS db')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const runQuery = async () => {
    const q = query?.trim()
    if (!q) {
      toast.error('Enter a SELECT query')
      return
    }
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const res = await superAdminAPI.executeSql(q)
      if (res?.success && res?.data) {
        setResult(res.data)
        if (res.data.truncated) {
          showToast.warning('Result truncated at 1000 rows')
        }
      } else {
        setError(res?.message || 'Query failed')
        setResult(res?.data || null)
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Request failed'
      setError(msg)
      setResult(null)
      if (!err?._handledByInterceptor) toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const columns = result?.columns || []
  const rows = result?.rows || []

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Database className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-neutral-900">SQL Console</h1>
        </div>
        <p className="text-sm text-neutral-600 mb-4">
          Read-only: SELECT only. Timeout 30s, max 1000 rows. PostgreSQL only.
        </p>

        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden mb-6">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SELECT * FROM &quot;Tenants&quot; LIMIT 10"
            className="w-full min-h-[140px] p-4 font-mono text-sm border-0 focus:ring-0 resize-y bg-neutral-50"
            spellCheck={false}
          />
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 bg-neutral-50">
            <span className="text-xs text-neutral-500">Single SELECT statement only</span>
            <button
              type="button"
              onClick={runQuery}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
              <Play className="h-4 w-4" />
              {loading ? 'Running…' : 'Run'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 font-mono break-all">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm text-neutral-600">
                {result.rowCount} row{result.rowCount !== 1 ? 's' : ''}
                {result.truncated && ' (truncated at 1000)'} · {result.executionMs} ms
              </span>
            </div>
            <div className="overflow-x-auto">
              {columns.length === 0 && rows.length === 0 ? (
                <p className="p-4 text-sm text-neutral-500">No columns returned.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50">
                      {columns.map((col) => (
                        <th key={col} className="text-left py-2 px-3 font-medium text-neutral-700 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-neutral-100 hover:bg-neutral-50">
                        {columns.map((col) => (
                          <td key={col} className="py-2 px-3 text-neutral-800 font-mono text-xs max-w-[200px] truncate" title={String(row[col] ?? '')}>
                            {row[col] != null ? String(row[col]) : 'NULL'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SuperAdminSqlConsolePage
