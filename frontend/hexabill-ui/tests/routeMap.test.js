import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyView, summarize, overdueTone, linePoints, readFocusParams, distanceKm, formatDistance, hasPin, SHOW_FILTERS, SORTS,
} from '../src/features/routes/routeMapState.js'
import { buildOsrmUrl, parseOsrm, loadRoadLine, clearRoadLineCache, MAX_ROUTE_POINTS } from '../src/features/routes/routeLine.js'

const stop = (over) => ({
  position: 1, customerId: 1, customerName: 'Al Noor Trading', address: 'Mussafah', phone: '050 111 0001',
  mainLatitude: 24.40, mainLongitude: 54.50, mapStatus: 'not_reached', balance: 0, overdueAmount: 0, overdueDays: 0, ...over,
})

const STOPS = [
  stop({ position: 1, customerId: 1, customerName: 'Al Noor Trading', balance: 150, overdueAmount: 150, overdueDays: 40 }),
  stop({ position: 2, customerId: 2, customerName: 'Gulf Fresh', address: 'Khalifa City', phone: '050 222 0002', mapStatus: 'delivered', mainLatitude: 24.42, mainLongitude: 54.52, balance: 900 }),
  stop({ position: 3, customerId: 3, customerName: 'Blue Coast', mapStatus: 'failed', mainLatitude: null, mainLongitude: null, balance: 20, overdueAmount: 20, overdueDays: 5 }),
  stop({ position: 4, customerId: 4, customerName: 'Desert Rose', mainLatitude: 24.60, mainLongitude: 54.80 }),
]
const ids = (rows) => rows.map((r) => r.customerId)

test('filters and sorts are the documented set', () => {
  assert.deepEqual(SHOW_FILTERS.map((f) => f.value), ['all', 'overdue', 'not_visited', 'visited', 'has_balance', 'no_pin'])
  assert.deepEqual(SORTS.map((s) => s.value), ['route_order', 'nearest', 'balance', 'overdue'])
})

test('each "show me" filter keeps the right stops', () => {
  assert.deepEqual(ids(applyView(STOPS, { filter: 'overdue' })), [1, 3])
  assert.deepEqual(ids(applyView(STOPS, { filter: 'not_visited' })), [1, 4])
  assert.deepEqual(ids(applyView(STOPS, { filter: 'visited' })), [2, 3])
  assert.deepEqual(ids(applyView(STOPS, { filter: 'has_balance' })), [1, 2, 3])
  assert.deepEqual(ids(applyView(STOPS, { filter: 'no_pin' })), [3])
  assert.equal(hasPin({ mainLatitude: 0, mainLongitude: 0 }), false) // 0,0 is not a real shop
})

test('search matches name, address and phone digits; it does not mutate the input', () => {
  const copy = JSON.stringify(STOPS)
  assert.deepEqual(ids(applyView(STOPS, { search: 'gulf' })), [2])
  assert.deepEqual(ids(applyView(STOPS, { search: 'KHALIFA' })), [2])
  assert.deepEqual(ids(applyView(STOPS, { search: '0502220002' })), [2])
  assert.deepEqual(ids(applyView(STOPS, { search: '22' })), []) // two digits are too loose to match phones
  assert.deepEqual(ids(applyView(STOPS, { search: '  ' })), [1, 2, 3, 4])
  assert.equal(JSON.stringify(STOPS), copy)
})

test('sorts: balance, overdue, route order, nearest (no pin last)', () => {
  assert.deepEqual(ids(applyView(STOPS, { sort: 'balance' })), [2, 1, 3, 4])
  assert.deepEqual(ids(applyView(STOPS, { sort: 'overdue' })), [1, 3, 2, 4])
  assert.deepEqual(ids(applyView([...STOPS].reverse(), { sort: 'route_order' })), [1, 2, 3, 4])
  const origin = { lat: 24.61, lng: 54.81 }
  assert.deepEqual(ids(applyView(STOPS, { sort: 'nearest', origin })), [4, 2, 1, 3])
  assert.deepEqual(ids(applyView(STOPS, { sort: 'nearest', origin: null })), [1, 2, 3, 4]) // no position -> route order
})

test('totals above the list', () => {
  assert.deepEqual(summarize(STOPS), { stops: 4, visited: 2, outstanding: 1070, overdue: 170, overdueCustomers: 2, noPin: 1 })
  assert.deepEqual(summarize(null), { stops: 0, visited: 0, outstanding: 0, overdue: 0, overdueCustomers: 0, noPin: 0 })
})

test('overdue colour bands and distance text', () => {
  assert.equal(overdueTone(0), 'none')
  assert.equal(overdueTone(1), 'warning')
  assert.equal(overdueTone(30), 'warning')
  assert.equal(overdueTone(31), 'error')
  assert.equal(overdueTone(undefined), 'none')
  assert.ok(Math.abs(distanceKm({ lat: 24, lng: 54 }, { lat: 25, lng: 54 }) - 111.2) < 0.5)
  assert.equal(formatDistance(0.42), '420 m')
  assert.equal(formatDistance(2.345), '2.3 km')
  assert.equal(formatDistance(42.6), '43 km')
})

test('line points follow route order and skip stops without a pin', () => {
  assert.deepEqual(linePoints([...STOPS].reverse()), [{ lat: 24.4, lng: 54.5 }, { lat: 24.42, lng: 54.52 }, { lat: 24.6, lng: 54.8 }])
})

test('focus parameters are positive integers or nothing', () => {
  assert.deepEqual(readFocusParams('?route=12&focus=345'), { routeId: 12, customerId: 345 })
  assert.deepEqual(readFocusParams('?route=abc&focus=-1'), { routeId: null, customerId: null })
  assert.deepEqual(readFocusParams('?route=1.5'), { routeId: null, customerId: null })
  assert.deepEqual(readFocusParams(''), { routeId: null, customerId: null })
})

test('road line URL sends coordinates only, longitude first', () => {
  const url = buildOsrmUrl([{ lat: 24.4, lng: 54.5 }, { lat: 24.5, lng: 54.6 }], 'https://osrm.example')
  assert.equal(url, 'https://osrm.example/route/v1/driving/54.500000,24.400000;54.600000,24.500000?overview=full&geometries=geojson')
})

test('OSRM answers are parsed to [lat, lng] or rejected', () => {
  assert.deepEqual(parseOsrm({ code: 'Ok', routes: [{ geometry: { coordinates: [[54.5, 24.4], [54.6, 24.5]] } }] }), [[24.4, 54.5], [24.5, 54.6]])
  assert.equal(parseOsrm({ code: 'NoRoute' }), null)
  assert.equal(parseOsrm({ code: 'Ok', routes: [] }), null)
  assert.equal(parseOsrm({ code: 'Ok', routes: [{ geometry: { coordinates: [[1, 2]] } }] }), null)
  assert.equal(parseOsrm(null), null)
})

test('road line: road when the service answers, straight line on any failure, cached per route', async () => {
  clearRoadLineCache()
  const pts = [{ lat: 24.4, lng: 54.5 }, { lat: 24.5, lng: 54.6 }]
  let calls = 0
  const ok = async () => { calls += 1; return { ok: true, json: async () => ({ code: 'Ok', routes: [{ geometry: { coordinates: [[54.5, 24.4], [54.55, 24.45], [54.6, 24.5]] } }] }) } }
  const first = await loadRoadLine(pts, { fetchImpl: ok })
  assert.equal(first.source, 'road')
  assert.equal(first.path.length, 3)
  await loadRoadLine(pts, { fetchImpl: ok })
  assert.equal(calls, 1)

  clearRoadLineCache()
  for (const failing of [
    async () => { throw new Error('offline') },
    async () => ({ ok: false, status: 429, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => ({ code: 'NoRoute' }) }),
  ]) {
    const r = await loadRoadLine(pts, { fetchImpl: failing })
    assert.equal(r.source, 'straight')
    assert.deepEqual(r.path, [[24.4, 54.5], [24.5, 54.6]])
  }
})

test('road line: nothing to draw below two points, no network above the point limit', async () => {
  clearRoadLineCache()
  let calls = 0
  const spy = async () => { calls += 1; return { ok: true, json: async () => ({}) } }
  assert.deepEqual(await loadRoadLine([{ lat: 1, lng: 1 }], { fetchImpl: spy }), { path: [], source: 'straight' })
  const many = Array.from({ length: MAX_ROUTE_POINTS + 1 }, (_, i) => ({ lat: 24 + i / 100, lng: 54 }))
  const r = await loadRoadLine(many, { fetchImpl: spy })
  assert.equal(r.source, 'straight')
  assert.equal(r.path.length, MAX_ROUTE_POINTS + 1)
  assert.equal(calls, 0)
})
