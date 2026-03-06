import React, { useState, useEffect } from 'react'
import { RefreshCw, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { isAdminOrOwner } from '../../utils/roles'
import { settingsAPI } from '../../services'
import { LoadingCard } from '../../components/Loading'
import toast from 'react-hot-toast'

const PAGE_SIZE = 20

const AuditLogPage = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const fetchLogs = async (pageNum = 1) => {
    try {
      setLoading(true)
      const res = await settingsAPI.getAuditLogs(pageNum, PAGE_SIZE)
      const data = res?.data ?? res
      const items = data?.items ?? []
      setLogs(items)
      setTotalCount(data?.totalCount ?? 0)
      setTotalPages(data?.totalPages ?? Math.ceil((data?.totalCount ?? 0) / PAGE_SIZE))
      setPage(pageNum)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load audit logs')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs(page)
  }, [page])

  if (!user) return null
  if (!isAdminOrOwner(user)) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="text-gray-600">Only administrators and owners can view the audit log.</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary-600" />
          Activity log
        </h1>
        <button
          type="button"
          onClick={() => fetchLogs(page)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Who changed what in your company (recent actions).
      </p>

      {loading && <LoadingCard message="Loading activity log..." />}

      {!loading && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        No audit entries yet.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">{log.userName ?? '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{log.action ?? '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 max-w-md truncate" title={log.details ?? ''}>{log.details ?? '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages} ({totalCount} total)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default AuditLogPage
