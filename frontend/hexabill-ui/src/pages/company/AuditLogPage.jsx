import React, { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Filter
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { isAdminOrOwner } from '../../utils/roles'
import { settingsAPI } from '../../services'
import { LoadingCard } from '../../components/Loading'
import {
  mobilePageTitleClass,
  mobilePageSubtitleClass,
  mobileLedgerCardClass
} from '../../components/mobilePageUi'
import {
  formatAuditDetails,
  getAuditActionBadge,
  formatRelativeTime,
  formatAbsoluteDateTime,
  AUDIT_ACTION_FILTER_OPTIONS
} from '../../utils/auditLogFormat'
import toast from 'react-hot-toast'

const PAGE_SIZE = 20

const emptyFilters = { action: '', fromDate: '', toDate: '' }

function ActionBadge({ action }) {
  const { label, className } = getAuditActionBadge(action)
  return (
    <span className={`inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}

function DetailsCell({ action, details }) {
  const [open, setOpen] = useState(false)
  const { summary, prettyJson } = formatAuditDetails(action, details)

  return (
    <div className="min-w-0">
      <div className="flex items-start gap-1.5">
        <p className="text-sm text-neutral-700 leading-snug break-words flex-1">{summary}</p>
        {prettyJson && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 p-1 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
            title={open ? 'Hide raw details' : 'Show raw details'}
            aria-expanded={open}
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>
      {open && prettyJson && (
        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-neutral-50 border border-neutral-200 p-2 text-[11px] leading-relaxed text-neutral-600 font-mono whitespace-pre-wrap break-all">
          {prettyJson}
        </pre>
      )}
    </div>
  )
}

const AuditLogPage = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [error, setError] = useState(null)
  const [filterDraft, setFilterDraft] = useState(emptyFilters)
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters)

  const fetchLogs = useCallback(async (pageNum = 1, filters = appliedFilters) => {
    try {
      setLoading(true)
      setError(null)
      const res = await settingsAPI.getAuditLogs(pageNum, PAGE_SIZE, {
        action: filters.action || undefined,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined
      })
      const data = res?.data ?? res
      const items = data?.items ?? []
      setLogs(items)
      setTotalCount(data?.totalCount ?? 0)
      setTotalPages(data?.totalPages ?? Math.ceil((data?.totalCount ?? 0) / PAGE_SIZE))
      setPage(pageNum)
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to load audit logs'
      setError(msg)
      toast.error(msg)
      setLogs([])
      setTotalCount(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [appliedFilters])

  useEffect(() => {
    fetchLogs(page, appliedFilters)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when page or applied filters change
  }, [page, appliedFilters])

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filterDraft })
    setPage(1)
  }

  const handleClearFilters = () => {
    setFilterDraft(emptyFilters)
    setAppliedFilters(emptyFilters)
    setPage(1)
  }

  if (!user) return null
  if (!isAdminOrOwner(user)) {
    return (
      <div className="p-6 max-w-2xl">
        <p className="text-neutral-600 text-sm">Only administrators and owners can view the audit log.</p>
      </div>
    )
  }

  const hasFilters = Boolean(appliedFilters.action || appliedFilters.fromDate || appliedFilters.toDate)

  return (
    <div className="min-h-0 flex-1 bg-neutral-50 w-full max-w-full overflow-x-hidden">
      <div className="p-3 sm:p-6 w-full max-w-full space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className={`${mobilePageTitleClass} flex items-center gap-2`}>
              <FileText className="h-5 w-5 text-primary-600 shrink-0" />
              Activity log
            </h1>
            <p className={mobilePageSubtitleClass}>Who changed what in your company</p>
          </div>
          <button
            type="button"
            onClick={() => fetchLogs(page, appliedFilters)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 min-h-10 px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-neutral-500" />
            <span className="text-sm font-medium text-neutral-700">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select
              value={filterDraft.action}
              onChange={(e) => setFilterDraft((f) => ({ ...f, action: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white min-h-10"
              title="Filter by action"
            >
              {AUDIT_ACTION_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              type="date"
              value={filterDraft.fromDate}
              onChange={(e) => setFilterDraft((f) => ({ ...f, fromDate: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm min-h-10"
              title="From date"
            />
            <input
              type="date"
              value={filterDraft.toDate}
              onChange={(e) => setFilterDraft((f) => ({ ...f, toDate: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm min-h-10"
              title="To date"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleApplyFilters}
                className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 min-h-10"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={handleClearFilters}
                disabled={!hasFilters && !filterDraft.action && !filterDraft.fromDate && !filterDraft.toDate}
                className="px-4 py-2 border border-neutral-200 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 disabled:opacity-50 min-h-10"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {loading && logs.length === 0 && (
          <LoadingCard message="Loading activity log..." />
        )}

        {error && logs.length === 0 && !loading && (
          <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
            <p className="text-sm text-red-700 mb-3">{error}</p>
            <button
              type="button"
              onClick={() => fetchLogs(page, appliedFilters)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && logs.length === 0 && (
          <div className="bg-white rounded-xl border border-neutral-200 px-4 py-14 text-center">
            <FileText className="h-10 w-10 mx-auto text-neutral-300 mb-3" />
            <p className="text-sm font-medium text-neutral-700">No activity yet</p>
            <p className="text-xs text-neutral-500 mt-1">
              {hasFilters ? 'Try clearing filters or widening the date range.' : 'Actions like payments and edits will show up here.'}
            </p>
          </div>
        )}

        {logs.length > 0 && (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {logs.map((log) => (
                <div key={log.id} className={mobileLedgerCardClass}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <ActionBadge action={log.action} />
                    <span className="text-[11px] text-neutral-500 whitespace-nowrap tabular-nums">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-neutral-900 truncate">{log.userName ?? '—'}</p>
                  <div className="mt-1.5">
                    <DetailsCell action={log.action} details={log.details} />
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-2 tabular-nums">
                    {formatAbsoluteDateTime(log.createdAt)}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="w-[18%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">User</th>
                      <th className="w-[20%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Action</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Details</th>
                      <th className="w-[18%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-50/80 align-top">
                        <td className="px-4 py-3 text-sm font-medium text-neutral-900 truncate">
                          {log.userName ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <ActionBadge action={log.action} />
                        </td>
                        <td className="px-4 py-3">
                          <DetailsCell action={log.action} details={log.details} />
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-500 whitespace-nowrap tabular-nums">
                          <div>{formatRelativeTime(log.createdAt)}</div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">
                            {formatAbsoluteDateTime(log.createdAt)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-neutral-500 tabular-nums">
                {totalPages > 0
                  ? `Page ${page} of ${totalPages} · ${totalCount} total`
                  : `${totalCount} total`}
              </p>
              {totalPages > 1 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    className="inline-flex items-center gap-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm disabled:opacity-50 hover:bg-white bg-white min-h-10"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                    className="inline-flex items-center gap-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm disabled:opacity-50 hover:bg-white bg-white min-h-10"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AuditLogPage
