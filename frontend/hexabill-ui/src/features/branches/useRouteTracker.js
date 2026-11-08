import { useEffect, useRef, useState } from 'react'
import { geofenceStep, initialGeofence, pingDue, MAX_FIX_AGE_MS } from './routeTracker'

/**
 * UX-F02: while `enabled` (route running and the driver accepted), watch the position, keep the screen awake, auto-mark Arrived at the
 * next stop's pin, and send a live ping every 60 s. Stops on disable, unmount, page hide, or when the permission is revoked.
 * Callbacks may change every render; the latest ones are used without restarting the watch.
 * @returns {{ status: 'off'|'starting'|'on'|'denied'|'unavailable', fix: {lat,lng,accuracy}|null }}
 */
export default function useRouteTracker({ enabled, next, onArrive, onPing }) {
  const [status, setStatus] = useState('off')
  const [fix, setFix] = useState(null)
  const latest = useRef({ next, onArrive, onPing })
  latest.current = { next, onArrive, onPing }

  useEffect(() => {
    if (!enabled) { setStatus('off'); setFix(null); return undefined }
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setStatus('unavailable'); return undefined }

    let watchId = null
    let wakeLock = null
    let permission = null
    let stopped = false
    let geofence = initialGeofence()
    let lastPingAt = null
    let firstPing = true
    setStatus('starting')

    const releaseWake = () => { try { wakeLock?.release?.() } catch { /* already released */ } wakeLock = null }
    const takeWake = async () => {
      try { if (!stopped && navigator.wakeLock && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen') } catch { /* not supported or refused: degrade to manual */ }
    }
    const stopAll = () => {
      stopped = true
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      watchId = null
      releaseWake()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onHide)
      if (permission) permission.onchange = null
    }
    function onVisibility() { if (document.visibilityState === 'visible') takeWake(); else releaseWake() }
    function onHide() { stopAll() }

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (stopped) return
        const f = { ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }
        setFix(f)
        setStatus('on')
        const now = Date.now()
        const target = latest.current.next
        const step = geofenceStep(geofence, { fix: f, target, now })
        geofence = step.state
        if (step.arrived) latest.current.onArrive?.(target, f)
        if (pingDue(lastPingAt, now)) {
          lastPingAt = now
          const first = firstPing
          firstPing = false
          latest.current.onPing?.(f, first)
        }
      },
      (err) => { stopAll(); setStatus(err?.code === 1 ? 'denied' : 'unavailable') },
      { enableHighAccuracy: true, maximumAge: MAX_FIX_AGE_MS, timeout: 30000 },
    )
    takeWake()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onHide)
    try {
      navigator.permissions?.query({ name: 'geolocation' }).then((p) => {
        permission = p
        p.onchange = () => { if (p.state === 'denied') { stopAll(); setStatus('denied') } }
      }).catch(() => {})
    } catch { /* permissions API missing */ }

    return () => { stopAll() }
  }, [enabled])

  return { status, fix }
}
