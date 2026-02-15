/**
 * Skeleton placeholder for tables - use while loading list data
 */
export function TableSkeleton({ rows = 5, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-neutral-100 rounded-lg animate-pulse" />
      ))}
    </div>
  )
}

export default TableSkeleton
