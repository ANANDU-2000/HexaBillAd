import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Eye,
  History,
  AlertCircle
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useDebounce } from '../../hooks/useDebounce'
import { isAdminOrOwner } from '../../utils/roles'
import { settingsAPI } from '../../services'
import Modal from '../../components/Modal'
import { mobilePageTitleClass } from '../../components/mobilePageUi'
import {
  formatAuditDetails,
  getAuditActionBadge,
  formatAuditDateTime,
  humanizeAction,
  isDeletedAction,
  diffAuditValues,
  resolveAuditDateRange,
  AUDIT_ACTION_FILTER_OPTIONS,
  AUDIT_DATE_RANGES
} from '../../utils/auditLogFormat'
import toast from 'react-hot-toast'

const PAGE_SIZE = 20

const controlClass =
  'h-10 md:h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20'

function ActionBadge({ action }) {
  const { label, className } = getAuditActionBadge(action)
  return (
    <span className={`inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-[13px] font-medium ${className}`}>
      {label}
    </span>
  )
}

function ActivityDetail({ log, detail, loading, error, onRetry }) {
  const [technicalOpen, setTechnicalOpen] = useState(false)
  const source = detail || log
  const view = formatAuditDetails(source?.action, source?.details)
  const changes = diffAuditValues(detail?.oldValues, detail?.newValues)
  const deleted = isDeletedAction(source?.action)

  return (
    <div className="space-y-4 text-sm">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-sm text-red-700">Unable to load this activity.</p>
          <button type="button" onClick={onRetry} className="mt-2 text-sm font-medium text-primary-700 hover:underline">
            Try again
          </button>
        </div>
      )}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        <div>
          <dt className="text-xs text-neutral-500">Action</dt>
          <dd className="mt-1"><ActionBadge action={source?.action} /></dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Date</dt>
          <dd className="mt-1 text-neutral-900 tabular-nums">{formatAuditDateTime(source?.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">User</dt>
          <dd className="mt-1 text-neutral-900">{source?.userName || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Record</dt>
          <dd className="mt-1 text-neutral-900">{view.record}</dd>
        </div>
        {detail?.entityType && (
          <div>
            <dt className="text-xs text-neutral-500">Record type</dt>
            <dd className="mt-1 text-neutral-900">{humanizeAction(detail.entityType)}</dd>
          </div>
        )}
      </dl>
      <div>
        <p className="text-xs text-neutral-500">Summary</p>
        <p className="mt-1 text-neutral-800 leading-snug">{view.summary}</p>
      </div>
      {deleted && (
        <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          Recovery unavailable.
        </p>
      )}
      {loading && <p className="text-xs text-neutral-500">Loading details…</p>}
      {changes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-neutral-700 mb-2">Changes</p>
          <div className="overflow-x-auto rounded-md border border-neutral-200">
            <table className="min-w-full text-[13px]">
              <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Field</th>
                  <th className="px-3 py-2 font-medium">Before</th>
                  <th className="px-3 py-2 font-medium">After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {changes.map((row) => (
                  <tr key={row.label}>
                    <td className="px-3 py-2 text-neutral-700">{row.label}</td>
                    <td className="px-3 py-2 text-neutral-600">{row.before}</td>
                    <td className="px-3 py-2 text-neutral-900">{row.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {view.technical && (
        <div>
          <button
            type="button"
            onClick={() => setTechnicalOpen((v) => !v)}
            className="text-[13px] font-medium text-primary-700 hover:underline min-h-11 md:min-h-0"
          >
            {technicalOpen ? 'Hide technical details' : 'Technical details'}
          </button>
          {technicalOpen && (
            <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600 font-mono whitespace-pre-wrap break-all">
              {view.technical}
            </pre>
          )}
        </div>
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
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [userId, setUserId] = useState('')
  const [datePreset, setDatePreset] = useState('')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [actors, setActors] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(false)
  const debouncedSearch = useDebounce(search, 300)
  const requestRef = useRef(0)

  const dateRange = useMemo(
    () => resolveAuditDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo]
  )
  const dateInvalid = Boolean(dateRange.fromDate && dateRange.toDate && dateRange.fromDate > dateRange.toDate)
  const hasFilters = Boolean(debouncedSearch || action || userId || datePreset)

  const fetchLogs = useCallback(async (pageNum) => {
    const requestId = ++requestRef.current
    try {
      setLoading(true)
      setError(null)
      const res = await settingsAPI.getAuditLogs(pageNum, PAGE_SIZE, {
        action: action || undefined,
        fromDate: dateRange.fromDate || undefined,
        toDate: dateRange.toDate || undefined,
        q: debouncedSearch.trim() || undefined,
        userId: userId || undefined
      })
      if (requestId !== requestRef.current) return
      const data = res?.data ?? res
      const items = data?.items ?? []
      setLogs(items)
      setTotalCount(data?.totalCount ?? 0)
      setTotalPages(data?.totalPages ?? Math.ceil((data?.totalCount ?? 0) / PAGE_SIZE))
    } catch (err) {
      if (requestId !== requestRef.current) return
      const msg = err?.response?.data?.message || 'Unable to load activity log.'
      setError(msg)
      toast.error(msg)
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [action, dateRange.fromDate, dateRange.toDate, debouncedSearch, userId])

  useEffect(() => {
    if (dateInvalid) return undefined
    fetchLogs(page)
  }, [page, fetchLogs, dateInvalid])

  useEffect(() => {
    let cancelled = false
    settingsAPI.getAuditActors()
      .then((res) => {
        if (cancelled) return
        const data = res?.data ?? res
        setActors(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setActors([])
      })
    return () => { cancelled = true }
  }, [])

  const filterKey = `${debouncedSearch}|${action}|${userId}|${dateRange.fromDate}|${dateRange.toDate}`
  const filterKeyRef = useRef(filterKey)
  useEffect(() => {
    if (filterKeyRef.current === filterKey) return
    filterKeyRef.current = filterKey
    if (page !== 1) setPage(1)
  }, [filterKey, page])

  const loadDetail = useCallback(async (id) => {
    setDetailLoading(true)
    setDetailError(false)
    try {
      const res = await settingsAPI.getAuditLog(id)
      const data = res?.data ?? res
      setDetail(data)
    } catch {
      setDetail(null)
      setDetailError(true)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const openDetail = (log) => {
    setSelected(log)
    setDetail(null)
    setDetailError(false)
    loadDetail(log.id)
  }

  const closeDetail = () => {
    setSelected(null)
    setDetail(null)
    setDetailError(false)
  }

  const handleClear = () => {
    setSearch('')
    setAction('')
    setUserId('')
    setDatePreset('')
    setCustomFrom('')
    setCustomTo('')
    setPage(1)
  }

  if (!user) return null
  if (!isAdminOrOwner(user)) {
    return (
      <div className="p-6 max-w-2xl">
        <p className="text-sm text-neutral-600">Only administrators and owners can view the activity log.</p>
      </div>
    )
  }

  const start = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, totalCount)

  return (
    <div className="min-h-0 flex-1 bg-neutral-50 w-full max-w-full overflow-x-hidden">
      <div className="p-3 sm:p-6 w-full max-w-full space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className={`${mobilePageTitleClass} flex items-center gap-2`}>
              <History className="h-5 w-5 text-primary-600 shrink-0" aria-hidden="true" />
              Activity log
            </h1>
            <p className="text-sm text-neutral-500 mt-0.5">Who changed what in your company</p>
          </div>
          <button
            type="button"
            onClick={() => fetchLogs(page)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 min-h-11 md:min-h-9 px-3 rounded-md border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <label className="relative block sm:col-span-2 lg:col-span-1">
              <span className="sr-only">Search activity</span>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search activity"
                className={`${controlClass} pl-9`}
              />
            </label>
            <label className="block">
              <span className="sr-only">Action</span>
              <select value={action} onChange={(e) => setAction(e.target.value)} className={controlClass}>
                {AUDIT_ACTION_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">User</span>
              <select value={userId} onChange={(e) => setUserId(e.target.value)} className={controlClass}>
                <option value="">All users</option>
                {actors.map((actor) => (
                  <option key={actor.userId} value={actor.userId}>{actor.userName || `User ${actor.userId}`}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Date range</span>
              <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)} className={controlClass}>
                {AUDIT_DATE_RANGES.map((opt) => (
                  <option key={opt.value || 'any'} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>
          {datePreset === 'custom' && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md">
              <label className="block">
                <span className="text-xs text-neutral-500">From</span>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={controlClass} />
              </label>
              <label className="block">
                <span className="text-xs text-neutral-500">To</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={controlClass} />
              </label>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            {dateInvalid ? (
              <p className="text-xs text-red-600">From date must be on or before to date.</p>
            ) : <span />}
            <button
              type="button"
              onClick={handleClear}
              disabled={!hasFilters && !search && !customFrom && !customTo}
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-40 min-h-11 md:min-h-8 px-2"
            >
              Clear
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-white rounded-lg border border-red-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-red-700">Unable to load activity log.</p>
            <button
              type="button"
              onClick={() => fetchLogs(page)}
              className="inline-flex items-center gap-2 min-h-11 md:min-h-9 px-3 rounded-md bg-primary-600 text-white text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        {loading && logs.length === 0 && !error && (
          <div className="bg-white rounded-lg border border-neutral-200 p-3 space-y-2" aria-busy="true" aria-label="Loading activity log">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 rounded bg-neutral-100 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && !error && logs.length === 0 && (
          <div className="bg-white rounded-lg border border-neutral-200 px-4 py-12 text-center">
            <History className="h-5 w-5 mx-auto text-neutral-400 mb-2" aria-hidden="true" />
            <p className="text-sm font-medium text-neutral-800">
              {hasFilters ? 'No activity matches these filters.' : 'No activity found.'}
            </p>
            {hasFilters && (
              <button type="button" onClick={handleClear} className="mt-3 text-sm font-medium text-primary-700 hover:underline min-h-11">
                Clear filters
              </button>
            )}
          </div>
        )}

        {logs.length > 0 && (
          <>
            <div className={`md:hidden space-y-2 ${loading ? 'opacity-60' : ''}`}>
              {logs.map((log) => {
                const view = formatAuditDetails(log.action, log.details)
                return (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => openDetail(log)}
                    className="w-full text-left rounded-lg border border-neutral-200 bg-white p-3 min-h-11"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <ActionBadge action={log.action} />
                      <span className="text-xs text-neutral-500 tabular-nums shrink-0">{formatAuditDateTime(log.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-neutral-900 truncate">{log.userName || '—'}</p>
                    <p className="text-[13px] text-neutral-800 mt-1">{view.record}</p>
                    <p className="text-[13px] text-neutral-600 mt-0.5 line-clamp-2">{view.summary}</p>
                    <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-primary-700">
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      View
                    </span>
                  </button>
                )
              })}
            </div>

            <div className={`hidden md:block bg-white rounded-lg border border-neutral-200 overflow-hidden ${loading ? 'opacity-60' : ''}`}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-[13px]">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">User</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Action</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Record</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Summary</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-neutral-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {logs.map((log) => {
                      const view = formatAuditDetails(log.action, log.details)
                      return (
                        <tr
                          key={log.id}
                          className="hover:bg-neutral-50 cursor-pointer"
                          onClick={() => openDetail(log)}
                        >
                          <td className="px-3 py-2 text-neutral-600 whitespace-nowrap tabular-nums">{formatAuditDateTime(log.createdAt)}</td>
                          <td className="px-3 py-2 text-neutral-900 font-medium max-w-[10rem] truncate">{log.userName || '—'}</td>
                          <td className="px-3 py-2"><ActionBadge action={log.action} /></td>
                          <td className="px-3 py-2 text-neutral-800 max-w-[12rem] truncate">{view.record}</td>
                          <td className="px-3 py-2 text-neutral-600 max-w-md truncate">{view.summary}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openDetail(log) }}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-primary-700 hover:bg-primary-50 min-h-9"
                            >
                              <Eye className="h-4 w-4" aria-hidden="true" />
                              View
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-xs text-neutral-500 tabular-nums">
                Showing {start}–{end} of {totalCount}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    className="inline-flex items-center gap-1 min-h-11 md:min-h-9 px-3 rounded-md border border-neutral-200 bg-white text-sm disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Previous
                  </button>
                  <span className="text-xs text-neutral-600 tabular-nums">Page {page} of {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                    className="inline-flex items-center gap-1 min-h-11 md:min-h-9 px-3 rounded-md border border-neutral-200 bg-white text-sm disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={Boolean(selected)}
        onClose={closeDetail}
        title="Activity"
        size="lg"
        allowFullscreen
      >
        {selected && (
          <ActivityDetail
            key={selected.id}
            log={selected}
            detail={detail}
            loading={detailLoading}
            error={detailError}
            onRetry={() => loadDetail(selected.id)}
          />
        )}
      </Modal>
    </div>
  )
}

export default AuditLogPage
