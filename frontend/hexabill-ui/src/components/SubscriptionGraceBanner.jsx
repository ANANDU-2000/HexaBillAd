/**
 * Subscription Grace Period Banner
 * Shows when tenant is in grace period after subscription expired.
 * Backend sends X-Subscription-Grace-Period and X-Subscription-Grace-End headers.
 */
import { useState, useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Link } from 'react-router-dom'

let graceState = { active: false, graceEnd: null }
const listeners = new Set()

const notifyListeners = () => {
  listeners.forEach(fn => fn(graceState))
}

export const setSubscriptionGraceFromResponse = (response) => {
  if (!response?.headers) return
  const header = response.headers['x-subscription-grace-period'] || response.headers['X-Subscription-Grace-Period']
  const graceEnd = response.headers['x-subscription-grace-end'] || response.headers['X-Subscription-Grace-End']
  if (header === 'true' && graceEnd) {
    graceState = { active: true, graceEnd }
    notifyListeners()
  } else {
    if (graceState.active) {
      graceState = { active: false, graceEnd: null }
      notifyListeners()
    }
  }
}

export const clearSubscriptionGrace = () => {
  graceState = { active: false, graceEnd: null }
  notifyListeners()
}

export function SubscriptionGraceBanner() {
  const [state, setState] = useState(graceState)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handler = (s) => setState(s)
    listeners.add(handler)
    setState(graceState)
    return () => listeners.delete(handler)
  }, [])

  if (!state.active || dismissed) return null

  const graceEnd = state.graceEnd ? new Date(state.graceEnd) : null
  const daysLeft = graceEnd ? Math.max(0, Math.ceil((graceEnd - new Date()) / (24 * 60 * 60 * 1000))) : null

  return (
    <div
      className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium"
      role="alert"
    >
      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      <span>
        Your subscription has expired.
        {daysLeft !== null && (
          <> You have {daysLeft} day{daysLeft !== 1 ? 's' : ''} of grace period to renew before access is restricted.</>
        )}
      </span>
      <Link
        to="/subscription"
        className="ml-2 px-3 py-1 bg-amber-900 text-white rounded hover:bg-amber-800 font-medium"
      >
        Renew now
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-2 p-1 hover:bg-amber-600/30 rounded"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
