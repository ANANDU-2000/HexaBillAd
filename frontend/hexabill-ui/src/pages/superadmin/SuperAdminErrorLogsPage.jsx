import { useState, useEffect } from 'react'
import { RefreshCw, AlertCircle, FileText, CheckCircle } from 'lucide-react'
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
  const [includeResolved, setIncludeResolved] = useState(false)
  const [resolvingId, setResolvingId] = useState(null)

  const fetchLogs = async (isRefresh = false) => {
    try {
      setError(null)
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      const data = await superAdminAPI.getErrorLogs(limit, includeResolved)
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

  const handleResolve = async (logId) => {
    try {
      setResolvingId(logId)
      await superAdminAPI.resolveErrorLog(logId)
      toast.success('Marked as resolved')
      if (!includeResolved) setLogs((prev) => prev.filter((l) => l.id !== logId))
      else fetchLogs(true)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to mark as resolved')
    } finally {
      setResolvingId(null)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [includeResolved])

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
          <p className="text-neutral-500 mt-1">Recent server errors and client-reported errors (e.g. connection refused, service unavailable) for easier identification and resolution</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={includeResolved}
              onChange={(e) => setIncludeResolved(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Include resolved
          </label>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 shadow-sm hover:shadow-md transition-all space-x-2 disabled:opacity-60"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">User ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {logs.length === 0 && !error && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-neutral-500">
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
                  <td className="px-4 py-3 text-sm text-neutral-600" title={log.tenantId != null ? `ID: ${log.tenantId}` : ''}>
                    {log.tenantName ? `${log.tenantName} (${log.tenantId})` : (log.tenantId != null ? log.tenantId : '—')}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{log.userId != null ? log.userId : '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {log.resolvedAt ? (
                      <span className="text-neutral-500 text-xs">Resolved</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleResolve(log.id)}
                        disabled={resolvingId === log.id}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded hover:bg-green-100 disabled:opacity-50"
                        title="Mark as resolved (hide from default list)"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {resolvingId === log.id ? '…' : 'Resolve'}
                      </button>
                    )}
                  </td>
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

