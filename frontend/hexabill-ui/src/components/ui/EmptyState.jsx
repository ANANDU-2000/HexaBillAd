/**
 * EmptyState - Task 16
 * Show when no data exists. Illustration + message + primary CTA + optional secondary.
 */
export default function EmptyState({
  icon = '📦',
  title = 'No items yet',
  description,
  primaryAction,
  secondaryAction,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}
    >
      <div className="text-5xl mb-4" aria-hidden="true">
        {icon}
      </div>
      <h2 className="text-xl font-semibold text-primary-800 mb-2">{title}</h2>
      {description && (
        <p className="text-sm text-primary-600 max-w-md mb-6">{description}</p>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="btn btn-primary min-h-[48px] min-w-[160px]"
          >
            {primaryAction.label}
          </button>
        )}
        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="btn btn-secondary min-h-[48px] min-w-[160px]"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  )
}
