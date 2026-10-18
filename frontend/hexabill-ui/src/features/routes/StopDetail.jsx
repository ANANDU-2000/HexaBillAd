import { ExternalLink, MapPinOff, Navigation, Phone, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../../utils/currency'
import { navigationUrl } from '../../utils/shopLocation'
import { hasPin, overdueTone, pendingFixSummary } from './routeMapState'
import { StatusTag, overdueLabel } from './StopCard'

const dateText = (value) => {
  if (!value) return 'Never'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? 'Never' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const OVERDUE_TEXT = { warning: 'text-warning-fg', error: 'text-error-fg', none: 'text-neutral-900' }

function Fact({ label, children }) {
  return (
    <div className="min-w-0 border border-neutral-200 bg-white px-2.5 py-1.5">
      <dt className="text-micro uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-neutral-900">{children}</dd>
    </div>
  )
}

const actionClass =
  'inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 sm:min-h-[36px]'

/** The card that opens when a stop is selected (list row or marker). Read-only: opens existing screens, writes nothing. */
export default function StopDetail({ stop, onClose, showCreditLimit, canManage = false, onConfirmPin = null, onDismissFix = null, busy = false }) {
  const pinned = hasPin(stop)
  const fix = canManage ? pendingFixSummary(stop) : null
  const late = overdueLabel(stop)
  const tone = overdueTone(stop.overdueDays)
  return (
    <section data-testid="stop-detail" aria-label={`Details for ${stop.customerName}`} className="border border-neutral-300 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.16)]">
      <header className="flex items-start gap-2 border-b border-neutral-200 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-neutral-900">{stop.position}. {stop.customerName}</h2>
          <p className="mt-0.5 truncate text-xs text-neutral-600">{stop.address || 'No address'}</p>
          <div className="mt-1.5"><StatusTag status={stop.mapStatus} /></div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close details" data-size="sm" className="-m-1 flex h-9 w-9 shrink-0 items-center justify-center text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>
      <dl className="grid grid-cols-2 gap-2 px-3 py-2.5">
        <Fact label="Owes">{formatCurrency(stop.balance || 0)}</Fact>
        <Fact label="Overdue">
          <span className={OVERDUE_TEXT[tone]}>{late ? `${formatCurrency(stop.overdueAmount || 0)} · ${stop.overdueDays}d` : 'None'}</span>
        </Fact>
        <Fact label="Last payment">{dateText(stop.lastPaymentDate)}</Fact>
        <Fact label="Last visit">{dateText(stop.lastVisitAt)}</Fact>
        {showCreditLimit && stop.creditLimit != null && <Fact label="Credit limit">{formatCurrency(stop.creditLimit)}</Fact>}
      </dl>
      {fix && (
        <div className="mx-3 mb-2 border border-neutral-200 border-l-4 border-l-info bg-white px-2.5 py-2" data-testid="pending-fix">
          <p className="text-xs font-semibold text-neutral-900">Driver reported a location</p>
          <p className="mt-0.5 text-xs text-neutral-700">{fix.text}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirmPin?.(stop, fix)}
              className="inline-flex min-h-[44px] items-center border border-info bg-white px-3 text-sm font-medium text-info-fg hover:bg-neutral-50 disabled:opacity-60 sm:min-h-[36px]"
            >
              {fix.confirmLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDismissFix?.(stop, fix)}
              className="inline-flex min-h-[44px] items-center border border-neutral-300 bg-white px-3 text-sm text-neutral-800 hover:bg-neutral-50 disabled:opacity-60 sm:min-h-[36px]"
            >
              Not now
            </button>
          </div>
        </div>
      )}
      {!pinned && (
        <p className="mx-3 mb-2 flex items-center gap-1.5 border-l-4 border-l-warning border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-700">
          <MapPinOff className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden /> This customer has no saved shop location yet.
        </p>
      )}
      <div className="flex flex-wrap gap-2 border-t border-neutral-200 px-3 py-2.5">
        {pinned && (
          <a className={actionClass} href={navigationUrl(Number(stop.mainLatitude), Number(stop.mainLongitude))} target="_blank" rel="noopener noreferrer">
            <Navigation className="h-4 w-4" aria-hidden /> Navigate
          </a>
        )}
        {stop.phone && (
          <a className={actionClass} href={`tel:${String(stop.phone).replace(/[^\d+]/g, '')}`}>
            <Phone className="h-4 w-4" aria-hidden /> Call
          </a>
        )}
        <Link className={actionClass} to={`/customers/${stop.customerId}`}>
          <ExternalLink className="h-4 w-4" aria-hidden /> Customer
        </Link>
      </div>
    </section>
  )
}
