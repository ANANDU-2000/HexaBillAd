import { useState } from 'react'
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import EmptyState from './EmptyState'
import { TableSkeleton } from './TableSkeleton'

/**
 * Data table for operational screens (tablet-first).
 *
 * columns: [{
 *   key, label, render?(row), align?: 'right', sortable?, mobile?: 'title' | 'subtitle' | 'hidden',
 *   hideBelow?: 'sm' | 'md' | 'lg' | 'xl'   hide this column under that breakpoint (low-priority columns on small tablets),
 *   sticky?: 'start'                        keep this column visible while the table scrolls sideways,
 *   width?: string                          e.g. '9rem'
 * }]
 *
 * Sorting: uncontrolled by default (sorts the rows given). For server-paged lists pass
 * `sort={{ key, direction: 'asc' | 'desc' }}` and `onSortChange(key, direction)`; the table then only shows
 * the indicator and reports the click, the screen re-fetches.
 *
 * Layout: `stickyHeader` + `maxHeight` give the table its own vertical scroll so the header stays visible.
 * `fill`: stretch to the height of a flex parent (page with a fixed-height list area); the rows scroll inside, header and pagination stay put.
 * `density`: 'compact' (default, ~40 px rows) | 'comfortable' (~48 px). `footer` is a node rendered as a sticky totals row.
 * `mobileCards` (opt-in): below md each row renders as a card (see mobile:'title'|'subtitle').
 * Pagination: `currentPage`, `totalPages`, `onPageChange`, plus optional `totalCount`, `pageSize`,
 * `pageSizeOptions`, `onPageSizeChange` for the "Showing 1-25 of 5,330" bar.
 */
const HIDE_BELOW = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell'
}

const pageWindow = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, total, current - 1, current, current + 1])
  const list = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out = []
  list.forEach((p, i) => {
    if (i > 0 && p - list[i - 1] > 1) out.push(`gap-${p}`)
    out.push(p)
  })
  return out
}

// Natural order: "Customer 2" before "Customer 10"; case and accents ignored.
const compare = (a, b) => {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

const ModernTable = ({
  data = [],
  columns = [],
  loading = false,
  busy = false,
  onRowClick,
  actions = null,
  actionsLabel = 'Actions',
  rowKey = 'id',
  rowClassName,
  mobileCards = false,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyAction,
  pagination = null, // { currentPage, totalPages, onPageChange, totalCount }
  currentPage: propCurrentPage,
  totalPages: propTotalPages,
  onPageChange: propOnPageChange,
  totalCount: propTotalCount,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  sort,
  onSortChange,
  stickyHeader = false,
  maxHeight,
  fill = false,
  density = 'compact',
  footer = null,
  caption,
}) => {
  const currentPage = propCurrentPage || pagination?.currentPage || 1
  const totalPages = propTotalPages || pagination?.totalPages || 1
  const onPageChange = propOnPageChange || pagination?.onPageChange
  const totalCount = propTotalCount ?? pagination?.totalCount
  const [localSort, setLocalSort] = useState({ key: null, direction: 'asc' })
  const controlled = sort !== undefined
  const activeSort = controlled ? (sort || { key: null, direction: 'asc' }) : localSort

  const handleSort = (key) => {
    const direction = activeSort.key === key && activeSort.direction === 'asc' ? 'desc' : 'asc'
    if (controlled) onSortChange?.(key, direction)
    else setLocalSort({ key, direction })
  }

  const sortedData = !controlled && localSort.key
    ? [...data].sort((a, b) => (localSort.direction === 'asc' ? 1 : -1) * compare(a[localSort.key], b[localSort.key]))
    : data

  const keyOf = (row, index) => (typeof rowKey === 'function' ? rowKey(row) : row[rowKey]) ?? index
  const cell = (column, row) => (column.render ? column.render(row) : row[column.key])

  if (loading) return <TableSkeleton rows={8} />

  const empty = (
    <EmptyState compact title={emptyTitle} description={emptyDescription} primaryAction={emptyAction} />
  )

  const titleCol = columns.find((c) => c.mobile === 'title') || columns[0]
  const subtitleCol = columns.find((c) => c.mobile === 'subtitle')
  const amountCol = columns.find((c) => c.align === 'right' && c !== titleCol && c.mobile !== 'hidden')
  const detailCols = columns.filter(
    (c) => c !== titleCol && c !== subtitleCol && c !== amountCol && c.mobile !== 'hidden'
  )

  const cellPad = density === 'comfortable' ? 'px-3 py-3' : 'px-2.5 py-2'
  const showFooterBar = (onPageChange && totalPages > 1) || (totalCount != null && totalCount > 0)
  const firstShown = totalCount ? (currentPage - 1) * (pageSize || sortedData.length || 1) + 1 : 0
  const lastShown = totalCount ? Math.min(totalCount, firstShown + sortedData.length - 1) : 0
  const scrollStyle = maxHeight ? { maxHeight } : undefined
  const colClass = (column, extra = '') =>
    `${column.hideBelow ? HIDE_BELOW[column.hideBelow] : ''} ${column.sticky === 'start' ? 'sticky left-0 z-10 bg-white' : ''} ${extra}`

  return (
    <div className={`overflow-hidden rounded-lg border border-surface-border bg-white ${fill ? 'flex min-h-0 flex-1 flex-col' : ''} ${busy ? 'opacity-70 transition-opacity' : ''}`} aria-busy={busy || undefined}>
      {mobileCards && (
        <ul className={`divide-y divide-surface-border md:hidden ${fill ? 'min-h-0 flex-1 overflow-auto' : ''}`}>
          {sortedData.length === 0 ? (
            <li>{empty}</li>
          ) : (
            sortedData.map((row, index) => {
              const Body = onRowClick ? 'button' : 'div'
              return (
                <li key={keyOf(row, index)} className="p-3">
                  <Body
                    type={onRowClick ? 'button' : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`block w-full text-start ${onRowClick ? '-m-1 rounded-md p-1 active:bg-neutral-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-text-primary">{cell(titleCol, row)}</div>
                        {subtitleCol && <div className="truncate text-sm text-neutral-600">{cell(subtitleCol, row)}</div>}
                      </div>
                      {amountCol && (
                        <div className="shrink-0 text-end text-base font-semibold tabular-nums text-text-primary">
                          {cell(amountCol, row)}
                        </div>
                      )}
                    </div>
                    {detailCols.length > 0 && (
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                        {detailCols.map((column) => (
                          <div key={column.key} className="min-w-0">
                            <dt className="text-neutral-600">{column.label}</dt>
                            <dd className={`truncate text-text-primary ${column.align === 'right' ? 'tabular-nums' : ''}`}>
                              {cell(column, row)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </Body>
                  {actions && <div className="mt-2 flex flex-wrap justify-end gap-2">{actions(row)}</div>}
                </li>
              )
            })
          )}
        </ul>
      )}

      {/* relative: keeps absolutely positioned content (e.g. the sr-only Actions label) inside the
          scroll box; without it that label escaped the clip and widened the whole page. */}
      <div className={`${mobileCards ? 'hidden md:block' : ''} relative overflow-auto ${fill ? 'min-h-0 flex-1' : ''}`} style={scrollStyle}>
        <table className="min-w-full border-separate border-spacing-0">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((column) => {
                const active = activeSort.key === column.key
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? (activeSort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                    style={column.width ? { width: column.width } : undefined}
                    className={`${colClass(column, stickyHeader ? '!z-20' : '')} ${stickyHeader ? 'sticky top-0 z-sticky' : ''} whitespace-nowrap border-b border-surface-border bg-neutral-50 ${density === 'comfortable' ? 'px-3' : 'px-2.5'} py-2 text-sm font-semibold text-neutral-700 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(column.key)}
                        className={`-my-1 inline-flex min-h-[36px] items-center gap-1 rounded px-1 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${active ? 'text-text-primary' : ''} ${column.align === 'right' ? 'flex-row-reverse' : ''}`}
                        title={`Sort by ${column.label}`}
                      >
                        {column.label}
                        {active
                          ? (activeSort.direction === 'asc'
                            ? <ChevronUp className="h-4 w-4" aria-hidden />
                            : <ChevronDown className="h-4 w-4" aria-hidden />)
                          : <ChevronsUpDown className="h-4 w-4 text-slate-500" aria-hidden />}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                )
              })}
              {actions && (
                <th
                  scope="col"
                  className={`${stickyHeader ? 'sticky top-0 z-sticky' : ''} whitespace-nowrap border-b border-surface-border bg-neutral-50 px-2.5 py-2 text-right text-sm font-semibold text-neutral-700`}
                >
                  {actionsLabel}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)}>{empty}</td>
              </tr>
            ) : (
              sortedData.map((row, index) => (
                <tr
                  key={keyOf(row, index)}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={`group transition-colors duration-150 hover:bg-neutral-50 focus-visible:bg-primary-50 focus-visible:outline-none ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName ? rowClassName(row) || '' : ''}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row) } : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`${colClass(column, column.sticky === 'start' ? 'group-hover:bg-neutral-50' : '')} border-b border-surface-border ${cellPad} text-sm text-text-primary ${column.align === 'right' ? 'whitespace-nowrap text-right tabular-nums' : ''}`}
                    >
                      {cell(column, row)}
                    </td>
                  ))}
                  {actions && (
                    <td className={`whitespace-nowrap border-b border-surface-border px-2.5 ${density === 'comfortable' ? 'py-2' : 'py-1'} text-right text-sm`} onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {footer && (
            <tfoot>
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="sticky bottom-0 border-t border-surface-border bg-neutral-50 px-3 py-2 text-sm font-semibold text-text-primary">
                  {footer}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showFooterBar && (
        <nav
          className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-surface-border bg-white px-3 py-2"
          aria-label="Pagination"
        >
          <p className="text-sm text-neutral-600" aria-live="polite">
            {totalCount != null ? (
              <>
                Showing <span className="font-medium tabular-nums text-text-primary">{firstShown.toLocaleString()}-{lastShown.toLocaleString()}</span> of{' '}
                <span className="font-medium tabular-nums text-text-primary">{totalCount.toLocaleString()}</span>
              </>
            ) : (
              <>
                Page <span className="font-medium tabular-nums text-text-primary">{currentPage}</span> of{' '}
                <span className="tabular-nums">{totalPages}</span>
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {onPageSizeChange && pageSizeOptions && (
              <label className="flex items-center gap-2 text-sm text-neutral-600">
                Rows per page
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="input h-10 w-20 py-0"
                >
                  {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
            {onPageChange && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="btn btn-secondary min-h-[40px] px-3"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Previous</span>
                </button>
                <span className="hidden items-center gap-1 md:flex">
                  {pageWindow(currentPage, totalPages).map((p) =>
                    typeof p === 'string' ? (
                      <span key={p} className="px-1 text-slate-500" aria-hidden>…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => onPageChange(p)}
                        aria-current={p === currentPage ? 'page' : undefined}
                        className={`min-h-[40px] min-w-[40px] rounded-md px-2 text-sm tabular-nums ${
 p === currentPage ? 'bg-primary-600 font-semibold text-white' : 'text-neutral-700 hover:bg-neutral-100'
 }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                </span>
                <span className="px-2 text-sm text-neutral-600 md:hidden">Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary min-h-[40px] px-3"
                  aria-label="Next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}

export default ModernTable
