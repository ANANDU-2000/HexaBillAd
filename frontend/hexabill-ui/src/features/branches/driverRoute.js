// Pure rules for the route planner and the driver's route screen. No React, no network.
import { navigationUrl, isValidPoint, LOW_ACCURACY_METERS } from '../../utils/shopLocation.js'

export const STATUS_LABELS = {
  not_reached: 'Not visited',
  arrived: 'Arrived',
  delivered: 'Delivered',
  failed: 'Failed',
  skipped: 'Skipped',
}

export const statusLabel = (mapStatus) => STATUS_LABELS[mapStatus] || STATUS_LABELS.not_reached

/** Failed and Skipped need a reason of at least 3 characters (the server enforces the same rule). */
export const needsReason = (status) => status === 'Failed' || status === 'Skipped'
export const MIN_REASON_LENGTH = 3
export const reasonIsValid = (text) => (text || '').trim().length >= MIN_REASON_LENGTH

/** Stops are shown in the server's order; position is 1-based. Stops without a position keep their given order. */
export function orderedStops(stops) {
  return [...(stops || [])]
    .map((s, index) => ({ ...s, position: s.position || index + 1 }))
    .sort((a, b) => a.position - b.position)
}

/** Stops that can be drawn and navigated to. */
export const mappableStops = (stops) =>
  orderedStops(stops).filter((s) => isValidPoint(s.mainLatitude, s.mainLongitude))

/** Stops whose shop location is still missing; they are left out of the map and the directions. */
export const locationNeededStops = (stops) => orderedStops(stops).filter((s) => s.needsLocation)

export const stopNavigationUrl = (stop) => navigationUrl(stop?.mainLatitude, stop?.mainLongitude)

/** New customer-id order after moving one stop up (-1) or down (+1); unchanged at the ends. */
export function moveStop(customerIds, customerId, direction) {
  const ids = [...customerIds]
  const from = ids.indexOf(customerId)
  const to = from + direction
  if (from < 0 || to < 0 || to >= ids.length) return ids
  ;[ids[from], ids[to]] = [ids[to], ids[from]]
  return ids
}

/** Moves a stop straight to the first place. */
export function moveStopToTop(customerIds, customerId) {
  if (!customerIds.includes(customerId)) return [...customerIds]
  return [customerId, ...customerIds.filter((id) => id !== customerId)]
}

/** Where the run stands, for the header chip and which button to offer. */
export function runPhase(state) {
  if (state?.current?.isOpen) return 'running'
  if (state?.last) return 'finished'
  return 'notStarted'
}

export function runSummaryParts(run) {
  if (!run) return []
  return [
    { key: 'delivered', label: 'Delivered', value: run.stopsDelivered ?? 0 },
    { key: 'failed', label: 'Failed', value: run.stopsFailed ?? 0 },
    { key: 'skipped', label: 'Skipped', value: run.stopsSkipped ?? 0 },
    { key: 'notVisited', label: 'Not visited', value: run.stopsNotVisited ?? 0 },
  ]
}

/** Sentence for the End route confirmation: names the missed stops so they are not ended by accident. */
export function endRouteWarning(run) {
  const missed = run?.stopsNotVisited ?? 0
  if (missed <= 0) return 'Every stop has an outcome. End the route when you are back.'
  return `${missed} stop${missed === 1 ? ' has' : 's have'} not been visited. They will be listed as missed for the office.`
}

/** One tap on an action button -> the request body for the visit endpoint. Never includes coordinates. */
export function visitRequest({ customerId, date, status, reason, fix = null, canSetPin = false, stopHasPin = true }) {
  const body = { customerId, visitDate: date, status }
  if (needsReason(status)) body.notes = (reason || '').trim()
  // UX-F02: Delivered at a stop with no saved pin carries the current fix as a proposed pin (the office confirms; owners/admins save it).
  if (status === 'Delivered' && !stopHasPin && fix?.ok && isValidPoint(fix.lat, fix.lng)) {
    body.latitude = round6(fix.lat)
    body.longitude = round6(fix.lng)
    if (canSetPin && !(Number(fix.accuracy) > LOW_ACCURACY_METERS)) body.updateSavedLocation = true
  }
  return body
}

/** True when a Delivered request carries a proposed pin. */
export const sendsProposedPin = (body) => body?.status === 'Delivered' && body.latitude != null && body.longitude != null

/** Today's stops that can still be acted on (not delivered). */
export const openStops = (stops) => orderedStops(stops).filter((s) => s.mapStatus !== 'delivered')

const OPEN_STATUSES = ['not_reached', 'arrived']

/** The stop to go to now: the first one in route order that has no final outcome yet (pinned or not). */
export function nextStop(stops) {
  return orderedStops(stops).find((s) => OPEN_STATUSES.includes(s.mapStatus || 'not_reached')) || null
}

/** Google Maps accepts a destination plus at most 9 waypoints. */
export const MAX_WAYPOINT_STOPS = 10

/**
 * One directions link for the remaining stops, in route order, starting from the phone's own position (no origin is sent).
 * Stops without a pin are skipped and counted; beyond MAX_WAYPOINT_STOPS the later stops are left out and counted.
 * @returns {{ url: string, count: number, skippedNoPin: number, dropped: number } | null}
 */
export function navigationWaypointsUrl(stops) {
  const open = orderedStops(stops).filter((s) => OPEN_STATUSES.includes(s.mapStatus || 'not_reached'))
  const pinned = open.filter((s) => isValidPoint(s.mainLatitude, s.mainLongitude))
  if (!pinned.length) return null
  const used = pinned.slice(0, MAX_WAYPOINT_STOPS)
  const point = (s) => `${Number(s.mainLatitude)},${Number(s.mainLongitude)}`
  const destination = used[used.length - 1]
  const via = used.slice(0, -1).map(point)
  const url = `https://www.google.com/maps/dir/?api=1&destination=${point(destination)}${via.length ? `&waypoints=${encodeURIComponent(via.join('|'))}` : ''}`
  return { url, count: used.length, skippedNoPin: open.length - pinned.length, dropped: pinned.length - used.length }
}

const round6 = (n) => Math.round(Number(n) * 1e6) / 1e6

/**
 * The visit request for "I'm here". Needs a real GPS fix, otherwise null and nothing is sent. The shop's saved pin is requested only
 * when the person may change it (owner/admin), the stop has no pin yet, and the fix is accurate; otherwise the fix stays on the visit.
 * @returns {{ body: object, savesPin: boolean } | null}
 */
export function arrivalRequest({ customerId, date, fix, canSetPin, stopHasPin, now = new Date(), source = null }) {
  if (!fix?.ok || !isValidPoint(fix.lat, fix.lng)) return null
  const accurate = !(Number(fix.accuracy) > LOW_ACCURACY_METERS)
  const savesPin = Boolean(canSetPin && !stopHasPin && accurate)
  const body = { customerId, visitDate: date, status: 'Arrived', reachedAt: now.toISOString(), latitude: round6(fix.lat), longitude: round6(fix.lng) }
  if (savesPin) body.updateSavedLocation = true
  if (source) body.source = source // NEEDS-BACKEND: optional "auto" | "manual"; ignored by servers that do not know it
  return { body, savesPin }
}

/** What to tell the person after "I'm here" was saved. */
export function arrivalMessage({ savesPin, canSetPin, stopHasPin, accuracy }) {
  if (savesPin) return 'Arrived. Shop location saved.'
  if (canSetPin && stopHasPin) return 'Arrived. The saved shop location was not changed.'
  if (canSetPin && Number(accuracy) > LOW_ACCURACY_METERS) return 'Arrived. Your GPS was not accurate enough to save as the shop location.'
  if (!canSetPin && !stopHasPin) return 'Arrived. Your location was sent to the office to confirm as the shop location.'
  return 'Arrived.'
}

/** Stops with a final outcome (delivered, failed or skipped) count as done. */
export const DONE_STATUSES = ['delivered', 'failed', 'skipped']
export function routeProgress(stops) {
  const all = orderedStops(stops)
  const done = all.filter((s) => DONE_STATUSES.includes(s.mapStatus)).length
  return { done, total: all.length, text: `${done} / ${all.length} done` }
}

/** Preset reasons for the Problem sheet. status is what the API receives; the preset text is sent as the reason. */
export const PROBLEM_REASONS = [
  { id: 'closed', label: 'Shop closed', status: 'Failed', text: 'Shop closed' },
  { id: 'nobody', label: 'No one to receive', status: 'Failed', text: 'No one to receive' },
  { id: 'refused', label: 'Customer refused', status: 'Failed', text: 'Customer refused' },
  { id: 'skip', label: 'Skip for now', status: 'Skipped', text: 'Skipped for now' },
]

/** Preset id (or 'other' + typed text) -> { status, reason } for visitRequest. Other needs a valid typed reason. */
export function problemOutcome(id, otherText = '') {
  if (id === 'other') return reasonIsValid(otherText) ? { status: 'Failed', reason: otherText.trim() } : null
  const p = PROBLEM_REASONS.find((r) => r.id === id)
  return p ? { status: p.status, reason: p.text } : null
}

/** [Collect] is offered only when the stop's customer owes money (needs a balance on the stop; NEEDS-BACKEND). */
export const hasBalance = (stop) => Number(stop?.balance) > 0
