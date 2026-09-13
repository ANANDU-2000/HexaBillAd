/**
 * ListSkeleton — mobile list loading placeholder: a column of card-shaped
 * pulse blocks, matching the MobileCard look. Use instead of full-screen
 * spinners while a data list is loading.
 */
const ListSkeleton = ({ count = 5, className = '' }) => (
  <div className={`space-y-2.5 ${className}`} role="status" aria-label="Loading">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="rounded-xl border border-neutral-200 bg-white p-3.5 animate-pulse"
        aria-hidden="true"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 bg-neutral-200 rounded w-2/3" />
            <div className="h-3 bg-neutral-100 rounded w-1/3" />
          </div>
          <div className="h-6 bg-neutral-100 rounded-lg w-16" />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="h-3 bg-neutral-100 rounded w-full" />
          <div className="h-3 bg-neutral-100 rounded w-full" />
          <div className="h-3 bg-neutral-100 rounded w-full" />
          <div className="h-3 bg-neutral-100 rounded w-full" />
        </div>
      </div>
    ))}
    <span className="sr-only">Loading…</span>
  </div>
)

export default ListSkeleton