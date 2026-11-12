// UX-F02 rules for the automatic location flow during a running route. No React, no browser APIs, no network.
// The phone reports a position only after the driver pressed Start route and accepted the one-sentence explanation;
// everything stops on End route, leaving the page, or when the permission is revoked.
import { isValidPoint, LOW_ACCURACY_METERS } from '../../utils/shopLocation.js'

export const GEOFENCE_METERS = 80
export const GEOFENCE_DWELL_MS = 20000
export const PING_INTERVAL_MS = 60000
export const MAX_FIX_AGE_MS = 15000

export const TRACKER_EXPLANATION = 'While this route runs, your phone shares your position with the office so stops are marked Arrived for you. It stops when you end the route.'

const toRad = (d) => (d * Math.PI) / 180

/** Great-circle distance in metres between two { lat, lng } points. */
export function distanceMeters(a, b) {
  const R = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export const initialGeofence = () => ({ stopId: null, since: null, fired: false })

/**
 * One position update against the next stop's pin. Arrived fires once, after the phone has stayed within the radius for the dwell time.
 * A poor fix (accuracy worse than LOW_ACCURACY_METERS) never counts as being inside.
 * @returns {{ state: object, arrived: boolean, meters: number|null }}
 */
export function geofenceStep (state, { fix, target, now = Date.now(), radius = GEOFENCE_METERS, dwellMs = GEOFENCE_DWELL_MS }) {
  const stopId = target?.customerId ?? null
  let s = state.stopId === stopId ? state : { stopId, since: null, fired: false }
  if (!stopId || !isValidPoint(target.mainLatitude, target.mainLongitude) || !fix || !isValidPoint(fix.lat, fix.lng)) return { state: s, arrived: false, meters: null }
  const meters = distanceMeters({ lat: fix.lat, lng: fix.lng }, { lat: Number(target.mainLatitude), lng: Number(target.mainLongitude) })
  const inside = meters <= radius && !(Number(fix.accuracy) > LOW_ACCURACY_METERS)
  if (!inside) return { state: { ...s, since: null }, arrived: false, meters }
  if (s.fired) return { state: s, arrived: false, meters }
  const since = s.since ?? now
  if (now - since >= dwellMs) return { state: { ...s, since, fired: true }, arrived: true, meters }
  return { state: { ...s, since }, arrived: false, meters }
}

/** A live-position ping goes out when none was sent yet or a full interval has passed. */
export const pingDue = (lastPingAt, now = Date.now(), intervalMs = PING_INTERVAL_MS) => lastPingAt == null || now - lastPingAt >= intervalMs

/** Driver-facing line for the tracker state. */
export function trackerStatusText (status) {
  switch (status) {
    case 'starting': return 'Finding your position...'
    case 'on': return 'Auto location is on. Stops are marked Arrived for you.'
    case 'denied': return 'Location is off for this site. Use "I\'m here" at each stop.'
    case 'unavailable': return 'Your phone cannot give a position. Use "I\'m here" at each stop.'
    default: return ''
  }
}
