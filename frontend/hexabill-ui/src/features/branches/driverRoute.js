// Pure rules for the route planner and the driver's route screen. No React, no network.
import { navigationUrl, isValidPoint } from '../../utils/shopLocation.js'

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
export function visitRequest({ customerId, date, status, reason }) {
  const body = { customerId, visitDate: date, status }
  if (needsReason(status)) body.notes = (reason || '').trim()
  return body
}

/** Today's stops that can still be acted on (not delivered). */
export const openStops = (stops) => orderedStops(stops).filter((s) => s.mapStatus !== 'delivered')
