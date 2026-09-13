import { ChevronRight } from 'lucide-react'
import clsx from 'clsx'

/**
 * MobileCard — standard list-item card for phones.
 * Replaces desktop tables rows with a thumb-friendly card.
 *
 * props:
 *  - title: primary line (e.g. customer name / invoice no)
 *  - subtitle: secondary line (e.g. phone / SKU / date)
 *  - meta: [{ label, value, tone? }]  — 2-col "key / value" grid
 *  - status / statusTone: pill label + tone (default|success|warning|danger|info)
 *  - leadingIcon: optional lucide icon
 *  - right: node rendered far-right (e.g. amount)
 *  - onClick / onKeyDown: makes whole card tappable (44px row height)
 *  - actions: node(s) rendered in the footer row
 *  - children: extra content
 */
const statusClasses = {
  default: 'bg-neutral-100 text-neutral-700',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
}

const MobileCard = ({
  title,
  subtitle,
  meta = [],
  status,
  statusTone = 'default',
  leadingIcon: Icon,
  right,
  onClick,
  actions,
  children,
  className,
}) => {
  const cardClass = clsx(
    'rounded-xl border border-neutral-200 bg-white p-3.5 text-sm leading-snug shadow-none',
    onClick && 'cursor-pointer active:bg-neutral-50 transition-colors',
    className,
  )

  const inner = (
    <>
      <div className="flex items-start gap-2">
        {Icon && (
          <div className="p-2 rounded-lg bg-primary-50 text-primary-600 shrink-0" aria-hidden>
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {title && <p className="text-sm font-semibold text-neutral-900 break-words">{title}</p>}
          {subtitle && <p className="text-xs text-neutral-500 mt-0.5 break-words">{subtitle}</p>}
        </div>
        {right && <div className="shrink-0 text-right">{right}</div>}
        {onClick && <ChevronRight className="h-4 w-4 text-neutral-300 shrink-0 mt-1" aria-hidden />}
      </div>

      {meta.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2.5">
          {meta.map((m, i) => (
            <div key={i} className="min-w-0">
              <span className="block text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                {m.label}
              </span>
              <span className={clsx('block font-medium text-neutral-800 truncate', m.tone)}>{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {status && (
        <div className="mt-2.5">
          <span
            className={clsx(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
              statusClasses[statusTone] || statusClasses.default,
            )}
          >
            {status}
          </span>
        </div>
      )}

      {children}

      {actions && (
        <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-neutral-100 flex-wrap">{actions}</div>
      )}
    </>
  )

  return onClick ? (
    <button type="button" onClick={onClick} className={`block w-full text-left ${cardClass}`}>
      {inner}
    </button>
  ) : (
    <div className={cardClass}>{inner}</div>
  )
}

export default MobileCard