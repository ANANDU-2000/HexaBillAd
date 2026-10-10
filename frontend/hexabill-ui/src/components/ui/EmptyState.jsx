import { Inbox } from 'lucide-react'

/**
 * Empty state: say what is missing and offer the next action.
 * `icon` takes a Lucide component (preferred) or, for older callers, a string.
 * `compact` is for empty tables and cards; the default suits a whole page.
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description,
  primaryAction,
  secondaryAction,
  compact = false,
  className = '',
}) {
  const PrimaryIcon = primaryAction?.icon
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-12'} ${className}`}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500" aria-hidden="true">
        {typeof Icon === 'string' ? <span className="text-xl">{Icon}</span> : <Icon className="h-6 w-6" strokeWidth={1.75} />}
      </div>
      <h2 className={`${compact ? 'text-sm' : 'text-h3'} font-semibold text-text-primary`}>{title}</h2>
      {description && <p className="mt-1 max-w-md text-sm text-neutral-500">{description}</p>}
      {(primaryAction || secondaryAction) && (
        <div className="mt-4 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {primaryAction && (
            <button type="button" onClick={primaryAction.onClick} className="btn btn-primary">
              {PrimaryIcon && <PrimaryIcon className="h-4 w-4" aria-hidden />}
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button type="button" onClick={secondaryAction.onClick} className="btn btn-secondary">
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
