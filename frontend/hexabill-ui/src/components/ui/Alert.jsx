import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'

// Flat ERP notice: white panel, hairline border, a solid status bar on the left, neutral text.
// Colour is carried only by the bar and the icon so long messages stay readable.
export const NOTICE_TONES = {
  info: { bar: 'border-l-info', icon: 'text-info', Icon: Info },
  success: { bar: 'border-l-success', icon: 'text-success', Icon: CheckCircle2 },
  warning: { bar: 'border-l-warning', icon: 'text-warning', Icon: AlertTriangle },
  error: { bar: 'border-l-error', icon: 'text-error', Icon: XCircle },
}

/**
 * Inline message for a page, card or form (not a toast).
 * Errors and warnings are announced (role="alert"); info and success are polite.
 */
export default function Alert({ tone = 'info', title, children, action, onDismiss, className = '' }) {
  const { bar, icon, Icon } = NOTICE_TONES[tone] || NOTICE_TONES.info
  const assertive = tone === 'error' || tone === 'warning'
  return (
    <div
      role={assertive ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-sm border border-neutral-200 border-l-4 bg-white px-3 py-2.5 text-sm text-text-primary ${bar} ${className}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${icon}`} strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-neutral-900">{title}</p>}
        {children && <div className={title ? 'mt-0.5 text-neutral-700' : 'text-neutral-800'}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          data-size="sm"
          className="-m-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  )
}
