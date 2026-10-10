import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'

const TONES = {
  info: { cls: 'bg-info-bg border-info-border text-info-fg', Icon: Info },
  success: { cls: 'bg-success-bg border-success-border text-success-fg', Icon: CheckCircle2 },
  warning: { cls: 'bg-warning-bg border-warning-border text-warning-fg', Icon: AlertTriangle },
  error: { cls: 'bg-error-bg border-error-border text-error-fg', Icon: XCircle },
}

/**
 * Inline message for a page, card or form (not a toast).
 * Errors and warnings are announced (role="alert"); info and success are polite.
 */
export default function Alert({ tone = 'info', title, children, action, onDismiss, className = '' }) {
  const { cls, Icon } = TONES[tone] || TONES.info
  const assertive = tone === 'error' || tone === 'warning'
  return (
    <div
      role={assertive ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm ${cls} ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 text-text-primary' : ''}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          data-size="sm"
          className="-m-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md opacity-70 hover:bg-black/5 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  )
}
