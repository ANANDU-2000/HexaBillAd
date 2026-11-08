import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Navigation, LocateFixed, Wallet, Check, AlertTriangle } from '../../components/ui/icons'
import Modal from '../../components/Modal'
import { statusLabel, stopNavigationUrl, hasBalance, PROBLEM_REASONS, problemOutcome, MIN_REASON_LENGTH, reasonIsValid } from './driverRoute'

const DOT = {
  not_reached: 'bg-neutral-400',
  arrived: 'bg-info',
  delivered: 'bg-success',
  failed: 'bg-error',
  skipped: 'bg-warning',
}

export const distanceText = (meters) => {
  if (!Number.isFinite(meters)) return ''
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m away` : `${(meters / 1000).toFixed(1)} km away`
}

/** The one expanded card: where to go and what to press. At most Navigate, Delivered, Problem (+ Collect only when the customer owes). */
export function NextStopCard({ stop, busy, canRecordPayment, meters, showImHere, onArrive, onDelivered, onProblem }) {
  const navUrl = stopNavigationUrl(stop)
  const done = ['delivered', 'failed', 'skipped'].includes(stop.mapStatus)
  return (
    <section className="rounded-lg border-2 border-primary-600 bg-white p-4 space-y-3" data-testid="next-stop" aria-label="Next stop">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-base font-semibold text-white" aria-label={`Stop ${stop.position}`}>{stop.position}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-neutral-600">Next stop</p>
          <p className="text-lg font-semibold leading-snug text-text-primary break-words">{stop.customerName}</p>
          {stop.address && <p className="text-sm text-neutral-700 break-words">{stop.address}</p>}
          {distanceText(meters) && <p className="text-sm text-neutral-700" data-testid="next-distance">{distanceText(meters)}</p>}
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700" data-testid={`stop-status-${stop.customerId}`}>
          <span className={`h-2 w-2 rounded-full ${DOT[stop.mapStatus] || DOT.not_reached}`} aria-hidden="true" />{statusLabel(stop.mapStatus)}
        </span>
      </div>

      {!done && (
        <div className="space-y-2">
          {navUrl && (
            <a href={navUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 text-base font-medium text-neutral-900">
              <Navigation className="h-5 w-5" aria-hidden="true" /> Navigate
            </a>
          )}
          <button type="button" disabled={busy} onClick={() => onDelivered(stop)} className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-md bg-success px-4 text-lg font-semibold text-white disabled:opacity-60">
            <Check className="h-5 w-5" aria-hidden="true" /> Delivered
          </button>
          <button type="button" disabled={busy} onClick={() => onProblem(stop)} className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 disabled:opacity-60">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Problem
          </button>
          {canRecordPayment && hasBalance(stop) && (
            <Link to={`/payments?customerId=${stop.customerId}`} className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800">
              <Wallet className="h-4 w-4" aria-hidden="true" /> Collect
            </Link>
          )}
          {showImHere && stop.mapStatus !== 'arrived' && (
            <button type="button" disabled={busy} onClick={() => onArrive(stop)} data-testid={`im-here-${stop.customerId}`} className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-info-fg underline disabled:opacity-60">
              <LocateFixed className="h-4 w-4" aria-hidden="true" /> I'm here
            </button>
          )}
        </div>
      )}
    </section>
  )
}

/** Every other stop: one line, number, name, status dot with its words. Tap to work on it out of order. */
export function StopRow({ stop, onFocus }) {
  return (
    <li data-testid={`stop-${stop.customerId}`}>
      <button type="button" onClick={() => onFocus(stop)} className="flex min-h-[44px] w-full items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 text-left hover:bg-neutral-50">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-800">{stop.position}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{stop.customerName}</span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-neutral-700" data-testid={`stop-status-${stop.customerId}`}>
          <span className={`h-2 w-2 rounded-full ${DOT[stop.mapStatus] || DOT.not_reached}`} aria-hidden="true" />{statusLabel(stop.mapStatus)}
        </span>
      </button>
    </li>
  )
}

/** Problem sheet: preset reasons as big buttons. The preset text is what the API receives, so the server rule (3+ characters) holds. */
export function ProblemSheet({ stop, busy, onPick, onClose }) {
  const [other, setOther] = useState(false)
  const [text, setText] = useState('')
  return (
    <Modal isOpen title={`Problem at ${stop.customerName}`} onClose={() => !busy && onClose()}>
      <div className="space-y-2" data-testid="problem-sheet">
        {PROBLEM_REASONS.map((r) => (
          <button key={r.id} type="button" disabled={busy} onClick={() => onPick(problemOutcome(r.id))} className="min-h-[52px] w-full rounded-md border border-neutral-300 bg-white px-4 text-base font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-60">
            {r.label}
          </button>
        ))}
        {!other ? (
          <button type="button" onClick={() => setOther(true)} className="min-h-[52px] w-full rounded-md border border-neutral-300 bg-white px-4 text-base font-medium text-neutral-900 hover:bg-neutral-50">Other</button>
        ) : (
          <div className="space-y-2">
            <label htmlFor="problem-other" className="block text-sm font-medium text-neutral-800">What happened?</label>
            <textarea id="problem-other" rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            {!reasonIsValid(text) && <p className="text-xs text-neutral-600">At least {MIN_REASON_LENGTH} characters.</p>}
            <button type="button" disabled={busy || !reasonIsValid(text)} onClick={() => onPick(problemOutcome('other', text))} className="min-h-[48px] w-full rounded-md bg-primary-600 px-4 text-base font-medium text-white disabled:opacity-50">Save</button>
          </div>
        )}
        <button type="button" disabled={busy} onClick={onClose} className="min-h-[44px] w-full rounded-md px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100">Cancel</button>
      </div>
    </Modal>
  )
}
