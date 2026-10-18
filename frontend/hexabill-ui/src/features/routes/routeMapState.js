// Pure rules for the Route Map list: which stops show, in what order, and the totals above them.
import { isValidPoint } from '../../utils/shopLocation.js'

export const SHOW_FILTERS = [
  { value: 'all', label: 'All stops' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'not_visited', label: 'Not visited today' },
  { value: 'visited', label: 'Visited' },
  { value: 'has_balance', label: 'Has balance' },
  { value: 'no_pin', label: 'No pin' },
]

export const SORTS = [
  { value: 'route_order', label: 'Route order' },
  { value: 'nearest', label: 'Nearest to me' },
  { value: 'balance', label: 'Highest balance' },
  { value: 'overdue', label: 'Most overdue' },
]

export const hasPin = (stop) => isValidPoint(stop?.mainLatitude, stop?.mainLongitude)

export const isVisited = (stop) => stop?.mapStatus && stop.mapStatus !== 'not_reached'

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

/** Straight-line distance in kilometres between two {lat, lng} points. */
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function formatDistance(km) {
  if (!Number.isFinite(km)) return ''
  return km < 1 ? `${Math.round(km * 1000 / 10) * 10} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`
}

const matchesFilter = (stop, filter) => {
  switch (filter) {
    case 'overdue': return num(stop.overdueAmount) > 0
    case 'not_visited': return !isVisited(stop)
    case 'visited': return isVisited(stop)
    case 'has_balance': return num(stop.balance) > 0
    case 'no_pin': return !hasPin(stop)
    default: return true
  }
}

const matchesSearch = (stop, query) => {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return true
  const digits = q.replace(/\D/g, '')
  const text = `${stop.customerName || ''} ${stop.address || ''}`.toLowerCase()
  if (text.includes(q)) return true
  return digits.length >= 3 && String(stop.phone || '').replace(/\D/g, '').includes(digits)
}

/** Filter, search and sort stops. `origin` is {lat, lng} of the person (for "nearest"); stops without a pin go last. */
export function applyView(stops, { search = '', filter = 'all', sort = 'route_order', origin = null } = {}) {
  const rows = (stops || []).filter((s) => matchesFilter(s, filter) && matchesSearch(s, search))
  const byOrder = (a, b) => num(a.position) - num(b.position)
  if (sort === 'balance') return rows.sort((a, b) => num(b.balance) - num(a.balance) || byOrder(a, b))
  if (sort === 'overdue') return rows.sort((a, b) => num(b.overdueDays) - num(a.overdueDays) || num(b.overdueAmount) - num(a.overdueAmount) || byOrder(a, b))
  if (sort === 'nearest' && origin && isValidPoint(origin.lat, origin.lng)) {
    const d = (s) => (hasPin(s) ? distanceKm(origin, { lat: Number(s.mainLatitude), lng: Number(s.mainLongitude) }) : Infinity)
    return rows.sort((a, b) => d(a) - d(b) || byOrder(a, b))
  }
  return rows.sort(byOrder)
}

/** Totals for the strip above the list. */
export function summarize(stops) {
  const list = stops || []
  return {
    stops: list.length,
    visited: list.filter(isVisited).length,
    outstanding: list.reduce((n, s) => n + num(s.balance), 0),
    overdue: list.reduce((n, s) => n + num(s.overdueAmount), 0),
    overdueCustomers: list.filter((s) => num(s.overdueAmount) > 0).length,
    noPin: list.filter((s) => !hasPin(s)).length,
  }
}

/** Colour family for how late a customer is: none, up to 30 days, beyond. */
export function overdueTone(days) {
  const d = num(days)
  if (d <= 0) return 'none'
  return d <= 30 ? 'warning' : 'error'
}

/** Pins in route order, ready for the road line (stops without a pin are skipped). */
export function linePoints(stops) {
  return (stops || [])
    .filter(hasPin)
    .sort((a, b) => num(a.position) - num(b.position))
    .map((s) => ({ lat: Number(s.mainLatitude), lng: Number(s.mainLongitude) }))
}

/** Reads ?route=&focus= (set by "Show on map" in the assistant). Ignores anything that is not a positive integer. */
export function readFocusParams(search) {
  const params = new URLSearchParams(search || '')
  const pick = (name) => {
    const n = Number(params.get(name))
    return Number.isInteger(n) && n > 0 ? n : null
  }
  return { routeId: pick('route'), customerId: pick('focus') }
}

/**
 * Words for a driver's GPS fix waiting for the office to confirm (null when there is none).
 * `replaces` is true when a shop pin is already saved, which changes the button and needs an explicit overwrite on the server.
 */
export function pendingFixSummary(stop) {
  const fix = stop?.pendingFix
  if (!fix) return null
  const replaces = hasPin(stop)
  const when = new Date(fix.visitDate)
  const day = Number.isNaN(when.getTime()) ? 'a recent visit' : when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  const who = fix.staffName ? fix.staffName : 'The driver'
  let tail = 'This customer has no saved shop location.'
  if (replaces) {
    const km = distanceKm({ lat: Number(stop.mainLatitude), lng: Number(stop.mainLongitude) }, { lat: Number(fix.latitude), lng: Number(fix.longitude) })
    tail = `It is about ${formatDistance(km)} from the saved shop location.`
  }
  return {
    replaces,
    visitId: fix.visitId,
    text: `${who} reported a location on ${day}. ${tail}`,
    confirmLabel: replaces ? 'Replace shop pin' : 'Confirm as shop pin',
  }
}
