// Road-following line between stops from the public OSRM service (free, fair-use). Only coordinates are sent,
// never names or amounts. Any failure falls back to the straight line the map already draws.
export const OSRM_BASE = 'https://router.project-osrm.org'
export const MAX_ROUTE_POINTS = 25
const TIMEOUT_MS = 6000

const cache = new Map()
const key = (points) => points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';')

export function buildOsrmUrl(points, base = OSRM_BASE) {
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')
  return `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson`
}

/** [[lat, lng], ...] from an OSRM response, or null when the answer is not a usable route. */
export function parseOsrm(json) {
  if (json?.code !== 'Ok') return null
  const coords = json.routes?.[0]?.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) return null
  const path = coords.map(([lng, lat]) => [lat, lng])
  return path.every(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)) ? path : null
}

const straight = (points) => points.map((p) => [p.lat, p.lng])

/**
 * @returns {Promise<{ path: number[][], source: 'road' | 'straight' }>}
 * Fewer than 2 points -> empty. More than MAX_ROUTE_POINTS -> straight (the public service limits request size).
 */
export async function loadRoadLine(points, { fetchImpl = globalThis.fetch, base = OSRM_BASE, signal } = {}) {
  const pts = (points || []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
  if (pts.length < 2) return { path: [], source: 'straight' }
  if (pts.length > MAX_ROUTE_POINTS || typeof fetchImpl !== 'function') return { path: straight(pts), source: 'straight' }
  const k = key(pts)
  if (cache.has(k)) return cache.get(k)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  signal?.addEventListener?.('abort', () => controller.abort(), { once: true })
  try {
    const response = await fetchImpl(buildOsrmUrl(pts, base), { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const path = parseOsrm(await response.json())
    if (!path) throw new Error('No route')
    const result = { path, source: 'road' }
    cache.set(k, result)
    return result
  } catch {
    return { path: straight(pts), source: 'straight' }
  } finally {
    clearTimeout(timer)
  }
}

export const clearRoadLineCache = () => cache.clear()
