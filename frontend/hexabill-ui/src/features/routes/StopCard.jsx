import { MapPinOff } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'
import { hasPin, overdueTone } from './routeMapState'

export const STATUS_TEXT = {
  not_reached: 'Not visited',
  arrived: 'Arrived',
  delivered: 'Visited',
  failed: 'Not completed',
  skipped: 'Skipped',
}

const STATUS_BAR = {
  not_reached: 'bg-neutral-400',
  arrived: 'bg-info',
  delivered: 'bg-success',
  failed: 'bg-error',
  skipped: 'bg-warning',
}

const OVERDUE_TEXT = { warning: 'text-warning-fg', error: 'text-error-fg', none: 'text-neutral-500' }

/** Flat square tag: text always says the state, colour only supports it. */
export function StatusTag({ status }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-neutral-200 bg-white px-1.5 py-0.5 text-xs font-medium text-neutral-700">
      <span className={`h-2 w-2 shrink-0 ${STATUS_BAR[status] || STATUS_BAR.not_reached}`} aria-hidden />
      {STATUS_TEXT[status] || STATUS_TEXT.not_reached}
    </span>
  )
}

export function overdueLabel(stop) {
  const days = Number(stop.overdueDays) || 0
  return days > 0 ? `${days} day${days === 1 ? '' : 's'} overdue` : null
}

/** One customer row in the Route Map list. */
export default function StopCard({ stop, selected, onSelect }) {
  const pinned = hasPin(stop)
  const late = overdueLabel(stop)
  const tone = overdueTone(stop.overdueDays)
  return (
    <button
      type="button"
      data-testid={`stop-card-${stop.customerId}`}
      aria-pressed={selected}
      onClick={() => onSelect(stop.customerId)}
      className={`flex min-h-[64px] w-full items-stretch gap-3 border-b border-neutral-200 px-3 py-2.5 text-left transition-colors ${
        selected ? 'bg-primary-50' : 'bg-white hover:bg-neutral-50'
      }`}
    >
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-sm font-semibold text-white ${STATUS_BAR[stop.mapStatus] || STATUS_BAR.not_reached}`} aria-hidden>
        {stop.position}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-neutral-900">{stop.customerName}</span>
        <span className="mt-0.5 block truncate text-xs text-neutral-600">{stop.address || 'No address'}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusTag status={stop.mapStatus} />
          {late && <span className={`text-xs font-medium ${OVERDUE_TEXT[tone]}`}>{late}</span>}
          {!pinned && (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
              <MapPinOff className="h-3.5 w-3.5" aria-hidden /> No pin
            </span>
          )}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-semibold tabular-nums text-neutral-900">
          {Number(stop.balance) > 0 ? formatCurrency(stop.balance) : '—'}
        </span>
        <span className="block text-xs text-neutral-500">{Number(stop.balance) > 0 ? 'owes' : 'settled'}</span>
      </span>
    </button>
  )
}
