import { useState } from 'react'
import Alert from '../../components/ui/Alert'

const RETRY_BUTTON = 'min-h-[36px] rounded-sm border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-50'

/**
 * Unconfirmed payments (UX-A06). One neutral warning block however many payments are waiting.
 * One payment keeps its full sentence. Two or more collapse to a single line with a Review toggle that lists
 * each amount and customer with its own retry. The recovery logic is untouched: a retry re-sends the saved
 * request under its original idempotency key, so it can be confirmed but never recorded twice.
 */
export default function UnconfirmedPaymentsAlert ({ intents, money, customerLabel, submitting, onRetry }) {
  const [open, setOpen] = useState(false)
  if (!intents?.length) return null

  if (intents.length === 1) {
    const intent = intents[0]
    return (
      <Alert
        tone="warning"
        action={<button type="button" disabled={submitting} onClick={() => onRetry(intent)} className={RETRY_BUTTON}>Retry previous payment</button>}
      >
        Previous payment of {money(intent.request.amount)} for customer {customerLabel(intent.request.customerId)} is unconfirmed. Confirm it before recording another payment for this customer.
      </Alert>
    )
  }

  const summary = `${intents.length} payments are unconfirmed (${intents.map((i) => money(i.request.amount)).join(', ')}). Confirm each before recording another payment for its customer.`
  return (
    <Alert
      tone="warning"
      action={(
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={RETRY_BUTTON}>
          {open ? 'Hide' : 'Review'}
        </button>
      )}
    >
      <span className="block truncate" title={summary}>{summary}</span>
      {open && (
        <ul className="mt-2 divide-y divide-neutral-100 border-t border-neutral-100">
          {intents.map((intent) => (
            <li key={intent.idempotencyKey} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate">
                <span className="font-medium tabular-nums">{money(intent.request.amount)}</span>
                {' · '}
                {customerLabel(intent.request.customerId)}
              </span>
              <button type="button" disabled={submitting} onClick={() => onRetry(intent)} className={RETRY_BUTTON}>Retry previous payment</button>
            </li>
          ))}
        </ul>
      )}
    </Alert>
  )
}
