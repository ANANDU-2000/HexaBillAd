import { AlertTriangle, RotateCw } from 'lucide-react'

/**
 * Error state for a page or panel that failed to load.
 * Say what failed in plain words and offer a retry. Never show raw exception text.
 */
export default function ErrorState({
  title = 'This could not be loaded',
  message,
  actionLabel = 'Try again',
  onAction,
  supportLink,
  compact = false,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-12'} ${className}`}
      role="alert"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-error-bg text-error-fg" aria-hidden="true">
        <AlertTriangle className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h2 className="text-h3 font-semibold text-text-primary">{title}</h2>
      {message && <p className="mt-1 max-w-md text-sm text-neutral-600">{message}</p>}
      {(onAction || supportLink) && (
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row">
          {onAction && (
            <button type="button" onClick={onAction} className="btn btn-secondary">
              <RotateCw className="h-4 w-4" aria-hidden />
              {actionLabel}
            </button>
          )}
          {supportLink && (
            <a href={supportLink.href} className="text-sm font-medium text-primary-700 underline-offset-2 hover:underline">
              {supportLink.label || 'Contact support'}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
