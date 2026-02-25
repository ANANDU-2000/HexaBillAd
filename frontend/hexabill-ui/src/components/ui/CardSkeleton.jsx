/**
 * Skeleton placeholder for cards - use while loading
 */
export function CardSkeleton({ lines = 2, className = '' }) {
  return (
    <div className={`bg-white rounded-lg border border-neutral-200 p-6 animate-pulse ${className}`}>
      <div className="h-4 bg-neutral-200 rounded w-1/4 mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-neutral-200 rounded mb-2" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  )
}

export default CardSkeleton
