import test from 'node:test'
import assert from 'node:assert/strict'
import { distanceMeters, geofenceStep, initialGeofence, pingDue, GEOFENCE_DWELL_MS } from '../src/features/branches/routeTracker.js'
import { arrivalRequest, visitRequest, routeProgress, PROBLEM_REASONS, problemOutcome, hasBalance, sendsProposedPin, reasonIsValid } from '../src/features/branches/driverRoute.js'
import { nearestOrder, applyOrder, sameOrder, autoReorderOn } from '../src/features/branches/routeOrder.js'

const stop = (id, lat, lng, mapStatus = 'not_reached') => ({ customerId: id, position: id, customerName: `S${id}`, mainLatitude: lat, mainLongitude: lng, mapStatus })
// ~0.0009 deg latitude is about 100 m
const PIN = { lat: 25.2, lng: 55.3 }

test('distance is about right', () => {
  assert.ok(Math.abs(distanceMeters(PIN, { lat: 25.2009, lng: 55.3 }) - 100) < 3)
  assert.equal(Math.round(distanceMeters(PIN, PIN)), 0)
})

test('geofence: Arrived fires once after 20 s inside 80 m, not before, not for a poor fix, resets when leaving', () => {
  const target = stop(1, PIN.lat, PIN.lng)
  const near = { lat: 25.20036, lng: 55.3, accuracy: 10 } // ~40 m
  let st = initialGeofence()
  let r = geofenceStep(st, { fix: near, target, now: 1000 }); st = r.state
  assert.equal(r.arrived, false)
  r = geofenceStep(st, { fix: near, target, now: 1000 + GEOFENCE_DWELL_MS - 1 }); st = r.state
  assert.equal(r.arrived, false)
  r = geofenceStep(st, { fix: near, target, now: 1000 + GEOFENCE_DWELL_MS }); st = r.state
  assert.equal(r.arrived, true)
  r = geofenceStep(st, { fix: near, target, now: 1000 + GEOFENCE_DWELL_MS + 5000 })
  assert.equal(r.arrived, false) // only once

  const far = { lat: 25.2018, lng: 55.3, accuracy: 10 } // ~200 m
  let s2 = geofenceStep(initialGeofence(), { fix: near, target, now: 0 }).state
  s2 = geofenceStep(s2, { fix: far, target, now: 10000 }).state
  assert.equal(s2.since, null)
  assert.equal(geofenceStep(s2, { fix: near, target, now: 25000 }).arrived, false) // dwell restarts after leaving

  const poor = { ...near, accuracy: 500 }
  assert.equal(geofenceStep(initialGeofence(), { fix: poor, target, now: 0 }).state.since, null)
  assert.equal(geofenceStep(initialGeofence(), { fix: near, target: stop(2, null, null), now: 0 }).arrived, false)
})

test('geofence restarts for a new next stop', () => {
  const a = stop(1, PIN.lat, PIN.lng)
  const b = stop(2, 25.3, 55.4)
  const near = { lat: 25.20036, lng: 55.3, accuracy: 10 }
  let st = geofenceStep(initialGeofence(), { fix: near, target: a, now: 0 }).state
  st = geofenceStep(st, { fix: near, target: b, now: 30000 }).state
  assert.equal(st.stopId, 2)
  assert.equal(st.since, null)
})

test('live ping every 60 s', () => {
  assert.equal(pingDue(null, 0), true)
  assert.equal(pingDue(0, 59999), false)
  assert.equal(pingDue(0, 60000), true)
})

test('auto arrival uses arrivalRequest with source auto and the GPS fix; no fix, no request', () => {
  const fix = { ok: true, lat: 25.2, lng: 55.3, accuracy: 10 }
  const r = arrivalRequest({ customerId: 5, date: '2026-11-08', fix, canSetPin: false, stopHasPin: true, source: 'auto' })
  assert.equal(r.body.status, 'Arrived')
  assert.equal(r.body.source, 'auto')
  assert.equal(r.body.latitude, 25.2)
  assert.equal(arrivalRequest({ customerId: 5, date: 'd', fix: { ok: false }, source: 'auto' }), null)
  assert.equal(arrivalRequest({ customerId: 5, date: 'd', fix }).body.source, undefined)
})

test('Delivered at an unpinned stop carries a proposed pin; pinned stops and missing fixes do not', () => {
  const fix = { ok: true, lat: 25.2, lng: 55.3, accuracy: 10 }
  const staff = visitRequest({ customerId: 1, date: 'd', status: 'Delivered', fix, canSetPin: false, stopHasPin: false })
  assert.equal(staff.latitude, 25.2)
  assert.equal(staff.updateSavedLocation, undefined)
  assert.equal(sendsProposedPin(staff), true)
  const owner = visitRequest({ customerId: 1, date: 'd', status: 'Delivered', fix, canSetPin: true, stopHasPin: false })
  assert.equal(owner.updateSavedLocation, true)
  assert.equal(visitRequest({ customerId: 1, date: 'd', status: 'Delivered', fix: { ...fix, accuracy: 900 }, canSetPin: true, stopHasPin: false }).updateSavedLocation, undefined)
  assert.equal(sendsProposedPin(visitRequest({ customerId: 1, date: 'd', status: 'Delivered', fix, stopHasPin: true })), false)
  assert.equal(sendsProposedPin(visitRequest({ customerId: 1, date: 'd', status: 'Delivered', stopHasPin: false })), false)
  assert.equal(sendsProposedPin(visitRequest({ customerId: 1, date: 'd', status: 'Failed', reason: 'Shop closed', fix, stopHasPin: false })), false)
})

test('problem presets keep the API statuses and a valid reason', () => {
  for (const p of PROBLEM_REASONS) {
    const o = problemOutcome(p.id)
    assert.ok(['Failed', 'Skipped'].includes(o.status))
    assert.ok(reasonIsValid(o.reason))
  }
  assert.deepEqual(problemOutcome('closed'), { status: 'Failed', reason: 'Shop closed' })
  assert.equal(problemOutcome('skip').status, 'Skipped')
  assert.equal(problemOutcome('other', 'ab'), null)
  assert.deepEqual(problemOutcome('other', ' Gate locked '), { status: 'Failed', reason: 'Gate locked' })
  assert.equal(problemOutcome('nope'), null)
})

test('progress counts delivered, failed and skipped; Collect needs a balance', () => {
  const s = [stop(1, 1, 1, 'delivered'), stop(2, 1, 1, 'failed'), stop(3, 1, 1, 'arrived'), stop(4, 1, 1)]
  assert.equal(routeProgress(s).text, '2 / 4 done')
  assert.equal(hasBalance({ balance: 10 }), true)
  assert.equal(hasBalance({ balance: 0 }), false)
  assert.equal(hasBalance({}), false)
})

test('nearest order: done stays first, pinned by distance from the origin, unpinned last in owner order', () => {
  const stops = [
    stop(1, 25.2, 55.3, 'delivered'),
    stop(2, 25.25, 55.3), // far
    stop(3, 25.201, 55.3), // near
    stop(4, null, null),
    stop(5, 25.21, 55.3), // middle
    stop(6, null, null),
  ]
  assert.deepEqual(nearestOrder(stops, { lat: 25.2, lng: 55.3 }), [1, 3, 5, 2, 4, 6])
  // five pins: delivering stop 1 reorders the rest by distance
  const five = [stop(1, 25.2, 55.3), stop(2, 25.3, 55.3), stop(3, 25.21, 55.3), stop(4, 25.25, 55.3), stop(5, 25.205, 55.3)]
  const afterFirst = five.map((s) => (s.customerId === 1 ? { ...s, mapStatus: 'delivered' } : s))
  assert.deepEqual(nearestOrder(afterFirst, { lat: 25.2, lng: 55.3 }), [1, 5, 3, 4, 2])
  assert.equal(sameOrder([1, 2], [1, 2]), true)
})

test('applyOrder shows a given order, renumbers, and restores with the old ids (Undo)', () => {
  const five = [stop(1, 25.2, 55.3), stop(2, 25.3, 55.3), stop(3, 25.21, 55.3)]
  const shown = applyOrder(five, [3, 1, 2])
  assert.deepEqual(shown.map((s) => s.customerId), [3, 1, 2])
  assert.deepEqual(shown.map((s) => s.position), [1, 2, 3])
  assert.deepEqual(applyOrder(five, [1, 2, 3]).map((s) => s.customerId), [1, 2, 3])
  assert.deepEqual(applyOrder(five, null).map((s) => s.customerId), [1, 2, 3])
})

test('auto-reorder is on unless this browser switched it off', () => {
  const mem = (v) => ({ getItem: () => v })
  assert.equal(autoReorderOn(mem(null)), true)
  assert.equal(autoReorderOn(mem('0')), false)
})
