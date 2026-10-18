// Plain-language helpers for a customer's shop pin. The coordinate pair is internal; people see words and a map.

export const LOW_ACCURACY_METERS = 100

/** True for a real map point (not blank, not out of range, not the 0,0 "null island" default). */
export function isValidPoint(lat, lng) {
  if (lat === '' || lng === '' || lat == null || lng == null) return false
  const a = Number(lat)
  const b = Number(lng)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return false
  return !(a === 0 && b === 0)
}

/** Maps a browser GeolocationPositionError code (or our own reason) to a reason key. */
export function gpsFailureReason(error) {
  if (!error) return 'unavailable'
  if (typeof error === 'string') return error
  if (error.code === 1) return 'denied'
  if (error.code === 3) return 'timeout'
  return 'unavailable'
}

const FAILURE_TEXT = {
  denied: 'Location permission is off for this site. Allow it in your browser settings, or choose the shop on the map.',
  timeout: 'Your phone could not find its position in time. Go outside or near a window and try again, or choose the shop on the map.',
  unavailable: 'Your device could not give a location. Choose the shop on the map instead.',
  unsupported: 'This browser cannot share a location. Choose the shop on the map instead.',
}

export function gpsFailureMessage(reason) {
  return FAILURE_TEXT[reason] || FAILURE_TEXT.unavailable
}

/** Advice about a GPS fix; null when it is good enough. */
export function accuracyAdvice(accuracyMeters) {
  if (accuracyMeters == null || !Number.isFinite(Number(accuracyMeters))) return null
  const m = Math.round(Number(accuracyMeters))
  if (m <= LOW_ACCURACY_METERS) return null
  return `The location is only accurate to about ${m} m. Move to open sky and try again, or check the pin on the map.`
}

/** One sentence for the current state, never raw coordinates. */
export function describeShopLocation({ hasPin, updatedAt, updatedByMe = false, pending = false, clearing = false }) {
  if (clearing) return 'The saved location will be removed when you save.'
  if (pending) return hasPin ? 'New location chosen. It replaces the saved one when you save.' : 'Location chosen. It is saved with the customer.'
  if (!hasPin) return 'No shop location yet. You can add it now or later.'
  if (!updatedAt) return 'Shop location is saved.'
  const when = new Date(updatedAt)
  const text = Number.isNaN(when.getTime()) ? '' : when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  return text ? `Shop location saved. Last updated ${text}${updatedByMe ? ' by you' : ''}.` : 'Shop location is saved.'
}

/** Google Maps link that opens navigation to a saved shop; null when the customer has no pin. */
export function navigationUrl(lat, lng) {
  if (!isValidPoint(lat, lng)) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${Number(lat)},${Number(lng)}`
}
