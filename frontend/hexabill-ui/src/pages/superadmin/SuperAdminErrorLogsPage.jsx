import { useState, useEffect } from 'react'
import { RefreshCw, AlertCircle, FileText } from 'lucide-react'
import { superAdminAPI } from '../../services'
import { LoadingCard } from '../../components/Loading'
import toast from 'react-hot-toast'

const SuperAdminErrorLogsPage = () => {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [logs, setLogs] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState(null)
  const [limit] = useState(100)

  const fetchLogs = async (isRefresh = false) => {
    try {
      setError(null)
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      const data = await superAdminAPI.getErrorLogs(limit)
      const items = data?.items ?? []
      setLogs(items)
      setTotalCount(data?.count ?? items.length)
    } catch (err) {
      console.error('Error logs fetch error:', err)
      setError(err?.response?.data?.message || err?.message || 'Failed to load error logs')
      setLogs([])
      toast.error('Failed to load error logs')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => fetchLogs(true)

  useEffect(() => {
    fetchLogs()
  }, [])

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
        <LoadingCard />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">Error Logs</h1>
          <p className="text-neutral-500 mt-1">Recent server errors for diagnostics</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 shadow-sm hover:shadow-md transition-all space-x-2 disabled:opacity-60"
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">TraceId</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Message</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Path</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">UserId</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {logs.length === 0 && !error && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-neutral-500">
                    <FileText className="h-12 w-12 mx-auto text-neutral-300 mb-2" />
                    <p>No error logs in the last batch</p>
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm text-neutral-600 whitespace-nowrap">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-neutral-700 truncate max-w-[120px]" title={log.traceId}>{log.traceId || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-medium">{log.errorCode || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-700 max-w-[200px] truncate" title={log.message}>{log.message || '—'}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600 font-mono max-w-[150px] truncate" title={log.path}>{log.path || '—'}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{log.method || '—'}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{log.tenantId ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{log.userId ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-200 text-sm text-neutral-500">
          Showing up to {limit} most recent entries. Total in this load: {totalCount}
        </div>
      </div>
    </div>
  )
}

export default SuperAdminErrorLogsPage

