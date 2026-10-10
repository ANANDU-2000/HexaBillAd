/**
 * Loading placeholders. Match the shape of the content that will replace them
 * so the layout does not jump. Each group announces itself once to screen readers.
 */
const SHAPES = {
  card: 'h-24 w-full rounded-lg',
  line: 'h-4 w-full',
  avatar: 'h-10 w-10 rounded-full',
  text: 'h-4 w-3/4',
  chart: 'h-48 w-full rounded-lg',
  kpi: 'h-[104px] w-full rounded-lg',
}

export default function LoadingSkeleton({ variant = 'card', count = 1, className = '', label = 'Loading' }) {
  return (
    <div className="space-y-3" role="status" aria-label={label} data-testid="loading-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`skeleton ${SHAPES[variant] || SHAPES.card} ${className}`} aria-hidden="true" />
      ))}
    </div>
  )
}

export function KpiSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="status" aria-label="Loading figures">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-surface-border bg-white p-4" aria-hidden="true">
          <div className="skeleton h-3 w-1/2" />
          <div className="skeleton mt-3 h-6 w-3/4" />
        </div>
      ))}
    </div>
  )
}

export function TableRowSkeleton({ cols = 5 }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}
