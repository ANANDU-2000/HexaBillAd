/**
 * LoadingSkeleton - Task 17
 * Pulse animation, matches final layout. Never show blank screen.
 */
export default function LoadingSkeleton({ variant = 'card', count = 1, className = '' }) {
  const base = 'animate-pulse bg-neutral-200 rounded'
  const variants = {
    card: 'h-24 w-full',
    line: 'h-4 w-full',
    avatar: 'h-10 w-10 rounded-full',
    text: 'h-4 w-3/4',
    chart: 'h-48 w-full',
    kpi: 'h-[120px] w-full rounded-lg',
  }
  const cls = `${base} ${variants[variant] || variants.card} ${className}`

  return (
    <div className="space-y-3" data-testid="loading-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cls} aria-hidden="true" />
      ))}
    </div>
  )
}

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse bg-neutral-200 h-[120px] rounded-lg" />
      ))}
    </div>
  )
}

export function TableRowSkeleton({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-4">
          <div className="animate-pulse bg-neutral-200 h-4 rounded w-full" />
        </td>
      ))}
    </tr>
  )
}
