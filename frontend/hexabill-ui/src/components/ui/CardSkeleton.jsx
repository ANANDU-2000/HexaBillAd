/** Card-shaped loading placeholder. */
export function CardSkeleton({ lines = 2, className = '' }) {
  return (
    <div className={`rounded-lg border border-surface-border bg-white p-5 ${className}`} role="status" aria-label="Loading">
      <div className="skeleton mb-4 h-4 w-1/4" aria-hidden="true" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton mb-2 h-4" style={{ width: i === lines - 1 ? '60%' : '100%' }} aria-hidden="true" />
      ))}
    </div>
  )
}

export default CardSkeleton
