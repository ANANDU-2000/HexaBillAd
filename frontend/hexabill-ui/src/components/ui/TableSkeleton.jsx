/**
 * Table loading placeholder: header bar plus row bars inside the same card frame
 * the real table uses. Prefer this to a spinner on list pages.
 */
export function TableSkeleton({ rows = 5, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-lg border border-surface-border bg-white ${className}`} role="status" aria-label="Loading">
      <div className="border-b border-surface-border bg-neutral-50 px-4 py-3" aria-hidden="true">
        <div className="skeleton h-3 w-1/3" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-surface-border px-4 py-3 last:border-b-0" aria-hidden="true">
          <div className="skeleton h-4 flex-[2]" />
          <div className="skeleton h-4 flex-1" />
          <div className="skeleton h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

export default TableSkeleton
