// Rules for sharing and showing a driver's live position. No React, no network, no browser APIs.
// The position is only ever sent after the driver pressed Share, only while the route is running, and never shown as numbers.

export const MIN_SEND_INTERVAL_MS = 15000
export const STALE_AFTER_SECONDS = 90
export const POLL_INTERVAL_MS = 20000

/** Random id for one sharing session. A new session needs the driver's consent again. */
export function newSessionId(random = globalThis.crypto) {
  if (random?.randomUUID) return random.randomUUID().replace(/-/g, '')
  const bytes = random?.getRandomValues ? random.getRandomValues(new Uint8Array(16)) : Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** A fix is sent when none was sent yet or the minimum interval has passed. */
export function shouldSend({ lastSentAt, now = Date.now(), minMs = MIN_SEND_INTERVAL_MS }) {
  if (lastSentAt == null) return true
  return now - lastSentAt >= minMs
}

/** Body for the share endpoint. Consent is true only for the first update of a session. */
export function shareBody({ coords, sessionId, first }) {
  return {
    latitude: Number(coords.latitude),
    longitude: Number(coords.longitude),
    accuracyMeters: Number.isFinite(coords.accuracy) ? Math.round(coords.accuracy * 10) / 10 : null,
    sessionId,
    consent: !!first,
  }
}

/** "12 seconds ago", "3 minutes ago". */
export function ageText(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  if (s < 5) return 'just now'
  if (s < 60) return `${s} seconds ago`
  const m = Math.round(s / 60)
  return `${m} minute${m === 1 ? '' : 's'} ago`
}

export const isStale = (seconds) => Number(seconds) > STALE_AFTER_SECONDS

/** What the driver sees about their own sharing. */
export function sharingStatusText({ state, lastSentAt, now = Date.now(), accuracy }) {
  switch (state) {
    case 'asking': return 'Waiting for your phone to find its position…'
    case 'denied': return 'Location permission is off for this site, so nothing is being shared.'
    case 'unavailable': return 'Your phone could not give a position. Nothing is being shared.'
    case 'offline': return 'No connection. Sharing continues when you are back online.'
    case 'sharing': {
      if (lastSentAt == null) return 'Sharing is on. Waiting for the first position…'
      const age = (now - lastSentAt) / 1000
      const acc = Number.isFinite(accuracy) ? `, accurate to about ${Math.round(accuracy)} m` : ''
      return age > STALE_AFTER_SECONDS
        ? 'No recent update. Keep this screen open so the office can see you.'
        : `Sharing. Last sent ${ageText(age)}${acc}.`
    }
    default: return 'Your location is not being shared.'
  }
}

export const CONSENT_POINTS = [
  'Your position is sent to the office while this route is running and this screen is open.',
  'Only your company\'s owners and managers of this route can see it.',
  'Only your latest position is kept, not a trail. It is deleted when you stop sharing or end the route.',
  'You can stop at any time. Browsers cannot track you after you close this screen.',
]

/** Geolocation error -> driver-facing state. */
export function stateForGeoError(error) {
  return error?.code === 1 ? 'denied' : 'unavailable'
}

/** Rows for the office card: nearest-first is not needed; stale ones are flagged, never hidden. */
export function describeDrivers(drivers) {
  return (drivers || []).map((d) => ({
    ...d,
    stale: isStale(d.ageSeconds),
    ageLabel: ageText(d.ageSeconds),
    accuracyLabel: Number.isFinite(d.accuracyMeters) ? `about ${Math.round(d.accuracyMeters)} m` : null,
  }))
}
