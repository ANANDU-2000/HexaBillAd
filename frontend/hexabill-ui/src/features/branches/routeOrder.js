// UX-F03: nearest-first order for the stops still to visit. Pure. The result is the driver's order for this trip only
// (shown on the driver screen); it never overwrites the owner's saved route order.
import { isValidPoint } from '../../utils/shopLocation.js'
import { distanceMeters } from './routeTracker.js'
import { orderedStops } from './driverRoute.js'

const FINAL = ['delivered', 'failed', 'skipped']
export const AUTO_REORDER_KEY = 'hexabill.route.autoReorder'

/** On unless this browser switched it off (the owner's tenant-wide setting is NEEDS-BACKEND). */
export function autoReorderOn (storage = globalThis.localStorage) {
  try { return storage?.getItem(AUTO_REORDER_KEY) !== '0' } catch { return true }
}

const pinned = (s) => isValidPoint(s.mainLatitude, s.mainLongitude)
const pt = (s) => ({ lat: Number(s.mainLatitude), lng: Number(s.mainLongitude) })

/**
 * New customer-id order: stops with a final outcome keep their place at the front; the pinned stops still to visit follow, each
 * next one being the nearest to the previous (starting from `origin`, a { lat, lng }); unpinned stops stay at the end in the owner's order.
 */
export function nearestOrder (stops, origin) {
  const all = orderedStops(stops)
  const done = all.filter((s) => FINAL.includes(s.mapStatus))
  const open = all.filter((s) => !FINAL.includes(s.mapStatus))
  const withPin = open.filter(pinned)
  const withoutPin = open.filter((s) => !pinned(s))
  const route = []
  const left = [...withPin]
  let here = origin && isValidPoint(origin.lat, origin.lng) ? origin : null
  while (left.length) {
    let best = 0
    if (here) {
      let bestD = Infinity
      left.forEach((s, i) => { const d = distanceMeters(here, pt(s)); if (d < bestD) { bestD = d; best = i } })
    }
    const [take] = left.splice(best, 1)
    route.push(take)
    here = pt(take)
  }
  return [...done, ...route, ...withoutPin].map((s) => s.customerId)
}

/** Shows `stops` in the given customer-id order; ids not listed keep their relative order at the end. */
export function applyOrder (stops, ids) {
  if (!ids?.length) return orderedStops(stops)
  const rank = new Map(ids.map((id, i) => [id, i]))
  return orderedStops(stops)
    .map((s, i) => ({ s, k: rank.has(s.customerId) ? rank.get(s.customerId) : ids.length + i }))
    .sort((a, b) => a.k - b.k)
    .map(({ s }, i) => ({ ...s, position: i + 1 }))
}

export const sameOrder = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

/** Ids after dragging `dragId` to sit just before `targetId`; unchanged when either is missing or they are the same. */
export function moveBefore (ids, dragId, targetId) {
  if (dragId === targetId || !ids.includes(dragId) || !ids.includes(targetId)) return [...ids]
  const rest = ids.filter((id) => id !== dragId)
  rest.splice(rest.indexOf(targetId), 0, dragId)
  return rest
}
