import { useState, useEffect } from 'react'
import { RefreshCw, FileText, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { superAdminAPI } from '../../services'
import { LoadingCard } from '../../components/Loading'
import toast from 'react-hot-toast'

const PAGE_SIZE = 50

const ACTION_TYPE_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'User Created', label: 'User Created' },
  { value: 'User Updated', label: 'User Updated' },
  { value: 'User Deleted', label: 'User Deleted' },
  { value: 'Password Reset', label: 'Password Reset' },
  { value: 'Sale Created', label: 'Sale / Invoice Created' },
  { value: 'Sale Updated', label: 'Sale Updated' },
  { value: 'Sale Deleted', label: 'Sale / Invoice Deleted' },
  { value: 'Payment Created', label: 'Payment Created' },
  { value: 'Payment Updated', label: 'Payment Updated' },
  { value: 'Payment Deleted', label: 'Payment Deleted' },
  { value: 'Expense Created', label: 'Expense Created' },
  { value: 'Expense Updated', label: 'Expense Updated' },
  { value: 'Expense Deleted', label: 'Expense Deleted' },
  { value: 'Purchase Created', label: 'Purchase Created' },
  { value: 'Purchase Updated', label: 'Purchase Updated' },
  { value: 'Purchase Deleted', label: 'Purchase Deleted' },
  { value: 'SuperAdmin', label: 'SuperAdmin (force logout, clear data, etc.)' },
  { value: 'Backup', label: 'Backup (created, restored, deleted)' },
  { value: 'SYSTEM_RESET', label: 'System Reset' },
  { value: 'TENANT_DATA_CLEAR', label: 'Tenant Data Clear' }
]

const SuperAdminAuditLogsPage = () => {
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [logs, setLogs] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    tenantId: '',
    userId: '',
    action: '',
    fromDate: '',
    toDate: '',
    superAdminOnly: false
  })
  const [appliedFilters, setAppliedFilters] = useState({})

  const fetchLogs = async (pageNum = page, append = false) => {
    try {
      setError(null)
      if (!append) setLoading(true)
      else setLoadingMore(true)
      const actionFilter = appliedFilters.superAdminOnly ? 'SuperAdmin' : (appliedFilters.action || undefined)
      const params = {
        tenantId: appliedFilters.tenantId ? parseInt(appliedFilters.tenantId, 10) : undefined,
        userId: appliedFilters.userId ? parseInt(appliedFilters.userId, 10) : undefined,
        action: actionFilter,
        fromDate: appliedFilters.fromDate || undefined,
        toDate: appliedFilters.toDate || undefined
      }
      const res = await superAdminAPI.getAuditLogs(pageNum, PAGE_SIZE, params)
      const data = res?.data ?? res
      const items = data?.items ?? []
      if (append) {
        setLogs((prev) => [...prev, ...items])
        setPage(pageNum)
      } else {
        setLogs(items)
        setPage(pageNum)
      }
      setTotalCount(data?.totalCount ?? 0)
      setTotalPages(data?.totalPages ?? Math.ceil((data?.totalCount ?? 0) / PAGE_SIZE))
    } catch (err) {
      console.error('Audit logs fetch error:', err)
      setError(err?.response?.data?.message || err?.message || 'Failed to load audit logs')
      if (!append) setLogs([])
      toast.error('Failed to load audit logs')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchLogs(1, false)
  }, [appliedFilters])

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters })
    setPage(1)
  }

  const handleClearFilters = () => {
    setFilters({ tenantId: '', userId: '', action: '', fromDate: '', toDate: '', superAdminOnly: false })
    setAppliedFilters({})
    setPage(1)
  }

  const handleSuperAdminOnly = () => {
    setFilters(f => ({ ...f, superAdminOnly: true, action: '' }))
    setAppliedFilters(prev => ({ ...prev, superAdminOnly: true, action: '' }))
    setPage(1)
  }

  if (loading && logs.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 bg-[#F8FAFC] min-h-screen">
        <LoadingCard />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-[#F8FAFC] min-h-screen">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Audit Logs</h1>
          <p className="text-neutral-500 text-sm mt-1">Platform-wide activity log</p>
        </div>
        <button
          onClick={() => fetchLogs()}
          disabled={loading}
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mb-4 p-4 bg-white rounded-xl border border-neutral-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="number"
            placeholder="Company ID"
            value={filters.tenantId}
            onChange={(e) => setFilters((f) => ({ ...f, tenantId: e.target.value }))}
            className="px-3 py-2 border border-neutral-200 rounded-lg text-sm"
          />
          <input
            type="number"
            placeholder="User ID"
            value={filters.userId}
            onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
            className="px-3 py-2 border border-neutral-200 rounded-lg text-sm"
          />
          <select
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
            className="px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white"
            title="Filter by action type"
          >
            {ACTION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            type="date"
            placeholder="From"
            value={filters.fromDate}
            onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))}
            className="px-3 py-2 border border-neutral-200 rounded-lg text-sm"
          />
          <input
            type="date"
            placeholder="To"
            value={filters.toDate}
            onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))}
            className="px-3 py-2 border border-neutral-200 rounded-lg text-sm"
          />
        </div>
        <p className="text-xs text-neutral-500 mt-1">Action filter: backend matches action text containing the selected value.</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={handleApplyFilters}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            Apply
          </button>
          <button
            onClick={handleSuperAdminOnly}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
            title="Show only SuperAdmin actions (suspend, activate, clear data, etc.)"
          >
            SuperAdmin Actions Only
          </button>
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 border border-neutral-200 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50"
          >
            Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="font-medium text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Details</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Old → New</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {logs.length === 0 && !error && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">
                    <FileText className="h-12 w-12 mx-auto text-neutral-300 mb-2" />
                    <p>No audit logs yet</p>
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm text-neutral-600 whitespace-nowrap">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{log.tenantId ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-neutral-800">{log.userName ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-neutral-700">{log.action ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">
                    {log.entityType ? `${log.entityType}${log.entityId != null ? ` #${log.entityId}` : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600 max-w-[200px] truncate" title={log.details}>{log.details ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600 max-w-[220px]">
                    {log.oldValues || log.newValues ? (
                      <span className="block text-xs" title={[log.oldValues, log.newValues].filter(Boolean).join(' → ')}>
                        {[log.oldValues, log.newValues].filter(Boolean).map((raw, i) => {
                          try {
                            const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
                            if (obj && typeof obj === 'object') {
                              const parts = []
                              if (obj.GrandTotal != null) parts.push(`Total: ${obj.GrandTotal}`)
                              if (obj.Subtotal != null) parts.push(`Sub: ${obj.Subtotal}`)
                              if (obj.Discount != null) parts.push(`Disc: ${obj.Discount}`)
                              if (obj.VatTotal != null) parts.push(`VAT: ${obj.VatTotal}`)
                              if (parts.length) return parts.join(', ')
                            }
                            return String(raw).slice(0, 60)
                          } catch { return String(raw).slice(0, 60) }
                        }).join(' → ')}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-neutral-500">
            Showing {logs.length} of {totalCount} · Page {page} of {totalPages || 1}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextPage = Math.max(1, page - 1)
                fetchLogs(nextPage, false)
                setPage(nextPage)
              }}
              disabled={page <= 1 || loading}
              className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-100 disabled:opacity-50 disabled:pointer-events-none"
              title="Previous page"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                const nextPage = Math.min(totalPages || 1, page + 1)
                fetchLogs(nextPage, false)
                setPage(nextPage)
              }}
              disabled={page >= (totalPages || 1) || loading}
              className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-100 disabled:opacity-50 disabled:pointer-events-none"
              title="Next page"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                const nextPage = page + 1
                fetchLogs(nextPage, true)
                setPage(nextPage)
              }}
              disabled={page >= (totalPages || 1) || loading || loadingMore}
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SuperAdminAuditLogsPage
