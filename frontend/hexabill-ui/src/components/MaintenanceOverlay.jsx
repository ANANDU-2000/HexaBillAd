import { useState, useEffect, useRef, useCallback } from 'react'
import { Construction, CloudOff, Loader2, RefreshCw } from 'lucide-react'
import { getApiBaseUrl } from '../services/apiConfig'
import { interpretProbe, nextProbeDelayMs } from '../services/serviceErrors.js'

const MAINTENANCE_EVENT = 'hexabill:maintenance'

const COPY = {
  maintenance: {
    title: 'Scheduled maintenance',
    body: 'System under maintenance. Back shortly.',
    hint: 'Your data is safe. This page reopens automatically when maintenance ends.',
  },
  unavailable: {
    title: 'Server unavailable',
    body: 'HexaBill is starting or being updated. Please try again shortly.',
    hint: 'Nothing you saved has been lost. We will reconnect automatically.',
  },
}

/**
 * kind: 'maintenance' (administrator switched maintenance on) or 'unavailable' (any other 503:
 * startup, update, schema gate). Only the API layer decides which, from the response body.
 */
export const showMaintenanceOverlay = (message, kind = 'maintenance') => {
  window.dispatchEvent(new CustomEvent(MAINTENANCE_EVENT, { detail: { message, kind } }))
}

async function probe () {
  try {
    const res = await fetch(`${getApiBaseUrl()}/maintenance-check`, { cache: 'no-store', credentials: 'omit' })
    const data = await res.json().catch(() => undefined)
    return { state: interpretProbe(res.status, data), message: data?.message }
  } catch {
    return { state: 'unavailable' }
  }
}

export const MaintenanceOverlay = () => {
  const [state, setState] = useState(null) // { kind, message }
  const [checking, setChecking] = useState(false)
  const attempt = useRef(0)
  const timer = useRef(null)

  const check = useCallback(async () => {
    clearTimeout(timer.current)
    setChecking(true)
    const result = await probe()
    setChecking(false)
    if (result.state === 'ok') {
      attempt.current = 0
      setState(null)
      return
    }
    setState((prev) => ({ kind: result.state, message: result.state === 'maintenance' ? (result.message || prev?.message) : prev?.kind === 'unavailable' ? prev.message : undefined }))
    timer.current = setTimeout(check, nextProbeDelayMs(attempt.current++))
  }, [])

  useEffect(() => {
    const handler = (e) => {
      const kind = e.detail?.kind === 'unavailable' ? 'unavailable' : 'maintenance'
      setState({ kind, message: e.detail?.message })
      attempt.current = 0
      clearTimeout(timer.current)
      timer.current = setTimeout(check, nextProbeDelayMs(0))
    }
    window.addEventListener(MAINTENANCE_EVENT, handler)
    return () => {
      window.removeEventListener(MAINTENANCE_EVENT, handler)
      clearTimeout(timer.current)
    }
  }, [check])

  if (!state) return null
  const copy = COPY[state.kind]
  const Icon = state.kind === 'maintenance' ? Construction : CloudOff

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-neutral-900/80 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="service-overlay-title"
      aria-describedby="service-overlay-body"
      data-service-state={state.kind}
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-lg">
        <Icon className="mx-auto mb-3 h-10 w-10 text-neutral-500" strokeWidth={1.5} aria-hidden="true" />
        <h1 id="service-overlay-title" className="mb-2 text-lg font-semibold text-neutral-900">{copy.title}</h1>
        <p id="service-overlay-body" className="mb-2 text-sm text-neutral-700">{state.message || copy.body}</p>
        <p className="mb-5 text-xs text-neutral-500" aria-live="polite">{checking ? 'Checking connection…' : copy.hint}</p>
        <button type="button" onClick={check} disabled={checking} className="btn btn-primary w-full min-h-[44px]">
          {checking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          Try again
        </button>
      </div>
    </div>
  )
}
