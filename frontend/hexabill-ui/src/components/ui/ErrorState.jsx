/**
 * ErrorState - Task 19
 * Specific message, actionable fix, support contact. Never show generic errors.
 */
export default function ErrorState({
  title = 'Something went wrong',
  message,
  actionLabel = 'Try again',
  onAction,
  supportLink,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}
      role="alert"
    >
      <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-error"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-primary-800 mb-1">{title}</h2>
      {message && <p className="text-sm text-primary-600 max-w-md mb-4">{message}</p>}
      <div className="flex flex-col sm:flex-row gap-3">
        {onAction && (
          <button type="button" onClick={onAction} className="btn btn-primary">
            {actionLabel}
          </button>
        )}
        {supportLink && (
          <a
            href={supportLink.href}
            className="text-sm text-primary-600 underline hover:no-underline"
          >
            {supportLink.label || 'Contact support'}
          </a>
        )}
      </div>
    </div>
  )
}
