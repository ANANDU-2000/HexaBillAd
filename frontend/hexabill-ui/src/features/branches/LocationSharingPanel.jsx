import { useCallback, useEffect, useRef, useState } from 'react'
import { LocateFixed, Square } from 'lucide-react'
import { routesAPI } from '../../services/index'
import {
  newSessionId, shouldSend, shareBody, sharingStatusText, stateForGeoError, CONSENT_POINTS,
} from './liveLocation'

/**
 * Driver's opt-in location sharing. Nothing is requested until the driver reads the explanation and presses Start sharing.
 * While the screen is open the browser's position is sent at most every 15 seconds; Stop sharing (or ending the route) deletes it.
 */
export default function LocationSharingPanel({ routeId, routeRunning }) {
  const [state, setState] = useState('idle') // idle | explaining | asking | sharing | denied | unavailable | offline
  const [lastSentAt, setLastSentAt] = useState(null)
  const [accuracy, setAccuracy] = useState(null)
  const [, setTick] = useState(0)
  const watchId = useRef(null)
  const session = useRef(null)
  const sentFirst = useRef(false)
  const lastSent = useRef(null)
  const sending = useRef(false)

  const clearWatch = useCallback(() => {
    if (watchId.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
  }, [])

  const stop = useCallback(async ({ tellServer = true } = {}) => {
    clearWatch()
    sentFirst.current = false
    lastSent.current = null
    setLastSentAt(null)
    setState('idle')
    if (tellServer) {
      try { await routesAPI.stopSharingLocation(routeId) } catch { /* the position expires on its own */ }
    }
  }, [clearWatch, routeId])

  const send = useCallback(async (position) => {
    if (sending.current || !shouldSend({ lastSentAt: lastSent.current })) return
    sending.current = true
    try {
      await routesAPI.shareLocation(routeId, shareBody({ coords: position.coords, sessionId: session.current, first: !sentFirst.current }))
      sentFirst.current = true
      lastSent.current = Date.now()
      setLastSentAt(lastSent.current)
      setAccuracy(position.coords.accuracy)
      setState('sharing')
    } catch (e) {
      const status = e?.response?.status
      if (status === 429) return // too soon; the next fix will do
      if (status === 409 || status === 404 || status === 403) { await stop({ tellServer: false }); return } // run ended, not enabled, or not allowed
      setState('offline')
    } finally {
      sending.current = false
    }
  }, [routeId, stop])

  const start = () => {
    if (!navigator.geolocation) { setState('unavailable'); return }
    session.current = newSessionId()
    sentFirst.current = false
    lastSent.current = null
    setState('asking')
    watchId.current = navigator.geolocation.watchPosition(
      (position) => { send(position) },
      (error) => { clearWatch(); setState(stateForGeoError(error)) },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 },
    )
  }

  // Re-render so "last sent 20 seconds ago" keeps moving, and stop for good when the route is no longer running or the screen goes away.
  useEffect(() => {
    if (state !== 'sharing' && state !== 'asking' && state !== 'offline') return undefined
    const timer = setInterval(() => setTick((t) => t + 1), 5000)
    return () => clearInterval(timer)
  }, [state])
  useEffect(() => {
    if (!routeRunning && state !== 'idle' && state !== 'explaining') stop({ tellServer: false })
  }, [routeRunning, state, stop])
  useEffect(() => () => { clearWatch() }, [clearWatch])

  const active = state === 'asking' || state === 'sharing' || state === 'offline'

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-3 space-y-2" aria-label="Location sharing" data-testid="location-panel">
      <p className="flex items-center gap-1 text-sm font-medium text-text-primary"><LocateFixed className="h-4 w-4" aria-hidden="true" /> Share my location with the office</p>
      <p className="text-sm text-neutral-700" role="status" data-testid="sharing-status">
        {sharingStatusText({ state: state === 'explaining' ? 'idle' : state, lastSentAt, accuracy })}
      </p>

      {state === 'explaining' && (
        <div className="space-y-2" data-testid="consent-box">
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-800">
            {CONSENT_POINTS.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <div className="flex gap-2">
            <button type="button" className="min-h-[44px] rounded-md border border-neutral-300 px-3 text-sm" onClick={() => setState('idle')}>Not now</button>
            <button type="button" className="min-h-[44px] rounded-md bg-primary-600 px-3 text-sm font-medium text-white" onClick={start}>Start sharing</button>
          </div>
        </div>
      )}

      {(state === 'idle' || state === 'denied' || state === 'unavailable') && (
        <button type="button" className="min-h-[44px] rounded-md border border-neutral-300 px-3 text-sm" onClick={() => setState('explaining')}>
          {state === 'idle' ? 'Share my location' : 'Try again'}
        </button>
      )}

      {active && (
        <button type="button" className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-neutral-400 px-3 text-sm font-medium" onClick={() => stop()}>
          <Square className="h-4 w-4" aria-hidden="true" /> Stop sharing
        </button>
      )}
    </section>
  )
}
