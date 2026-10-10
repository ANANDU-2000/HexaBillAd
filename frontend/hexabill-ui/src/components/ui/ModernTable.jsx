import { useState } from 'react'
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react'
import EmptyState from './EmptyState'
import { TableSkeleton } from './TableSkeleton'

/**
 * Data table with an optional phone layout.
 *
 * columns: [{ key, label, render?, align?: 'right', sortable?, mobile?: 'title' | 'subtitle' | 'hidden' }]
 *
 * `mobileCards` (opt-in): below md each row renders as a card. The column marked
 * mobile:'title' (default: the first column) is the card heading, 'subtitle'
 * sits under it, right-aligned columns become the amount on the end side, and
 * the rest are label/value pairs. Without it the table scrolls inside its card.
 */
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
  onRowClick,
  actions = null,
  rowKey = 'id',
  mobileCards = false,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyAction,
  pagination = null, // { currentPage, totalPages, onPageChange }
  currentPage: propCurrentPage,
  totalPages: propTotalPages,
  onPageChange: propOnPageChange,
  caption,
}) => {
  const currentPage = propCurrentPage || pagination?.currentPage || 1
  const totalPages = propTotalPages || pagination?.totalPages || 1
  const onPageChange = propOnPageChange || pagination?.onPageChange
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedData = sortColumn
    ? [...data].sort((a, b) => (sortDirection === 'asc' ? 1 : -1) * compare(a[sortColumn], b[sortColumn]))
    : data

  const keyOf = (row, index) => (typeof rowKey === 'function' ? rowKey(row) : row[rowKey]) ?? index
  const cell = (column, row) => (column.render ? column.render(row) : row[column.key])

  if (loading) return <TableSkeleton rows={6} />

  const empty = (
    <EmptyState compact title={emptyTitle} description={emptyDescription} primaryAction={emptyAction} />
  )

  const titleCol = columns.find((c) => c.mobile === 'title') || columns[0]
  const subtitleCol = columns.find((c) => c.mobile === 'subtitle')
  const amountCol = columns.find((c) => c.align === 'right' && c !== titleCol && c.mobile !== 'hidden')
  const detailCols = columns.filter(
    (c) => c !== titleCol && c !== subtitleCol && c !== amountCol && c.mobile !== 'hidden'
  )

  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-white">
      {mobileCards && (
        <ul className="divide-y divide-surface-border md:hidden">
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
                        <div className="truncate text-sm font-semibold text-text-primary">{cell(titleCol, row)}</div>
                        {subtitleCol && <div className="truncate text-xs text-neutral-500">{cell(subtitleCol, row)}</div>}
                      </div>
                      {amountCol && (
                        <div className="shrink-0 text-end text-sm font-semibold tabular-nums text-text-primary">
                          {cell(amountCol, row)}
                        </div>
                      )}
                    </div>
                    {detailCols.length > 0 && (
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {detailCols.map((column) => (
                          <div key={column.key} className="min-w-0">
                            <dt className="text-neutral-500">{column.label}</dt>
                            <dd className={`truncate text-text-primary ${column.align === 'right' ? 'tabular-nums' : ''}`}>
                              {cell(column, row)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </Body>
                  {actions && <div className="mt-2 flex flex-wrap justify-end gap-1.5">{actions(row)}</div>}
                </li>
              )
            })
          )}
        </ul>
      )}

      {/* relative: keeps absolutely positioned content (e.g. the sr-only Actions label) inside the
          scroll box; without it that label escaped the clip and widened the whole page. */}
      <div className={`${mobileCards ? 'hidden md:block' : ''} relative overflow-x-auto`}>
        <table className="min-w-full">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-neutral-50">
            <tr>
              {columns.map((column) => {
                const active = sortColumn === column.key
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`whitespace-nowrap border-b border-surface-border px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-600 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(column.key)}
                        className={`-my-1 inline-flex min-h-[32px] items-center gap-1 rounded uppercase tracking-wide hover:text-text-primary ${column.align === 'right' ? 'flex-row-reverse' : ''}`}
                      >
                        {column.label}
                        {active && (sortDirection === 'asc'
                          ? <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                          : <ChevronDown className="h-3.5 w-3.5" aria-hidden />)}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                )
              })}
              {actions && (
                <th scope="col" className="border-b border-surface-border px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  <span className="sr-only">Actions</span>
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
                  className={`border-b border-surface-border last:border-b-0 transition-colors duration-150 hover:bg-neutral-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`whitespace-nowrap px-3 py-2.5 text-sm text-text-primary ${column.align === 'right' ? 'text-right tabular-nums' : ''}`}
                    >
                      {cell(column, row)}
                    </td>
                  ))}
                  {actions && (
                    <td className="whitespace-nowrap px-3 py-1.5 text-right text-sm" onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {onPageChange && totalPages > 1 && (
        <nav
          className="flex items-center justify-between gap-3 border-t border-surface-border bg-white px-3 py-2"
          aria-label="Pagination"
        >
          <p className="text-xs text-neutral-500">
            Page <span className="font-medium tabular-nums text-text-primary">{currentPage}</span> of{' '}
            <span className="tabular-nums">{totalPages}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="btn btn-ghost px-2"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </button>
            <span className="hidden items-center gap-1 sm:flex">
              {pageWindow(currentPage, totalPages).map((p) =>
                typeof p === 'string' ? (
                  <span key={p} className="px-1 text-neutral-400" aria-hidden>…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPageChange(p)}
                    aria-current={p === currentPage ? 'page' : undefined}
                    className={`min-h-[32px] min-w-[32px] rounded-md px-2 text-sm tabular-nums ${
                      p === currentPage ? 'bg-primary-600 font-semibold text-white' : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="btn btn-ghost px-2"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </button>
          </div>
        </nav>
      )}
    </div>
  )
}

export default ModernTable
