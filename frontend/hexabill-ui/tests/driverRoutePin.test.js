import test from 'node:test'
import assert from 'node:assert/strict'
import { arrivalRequest, arrivalMessage, nextStop, navigationWaypointsUrl, MAX_WAYPOINT_STOPS } from '../src/features/branches/driverRoute.js'

const now = new Date('2026-10-18T10:00:00.000Z')
const good = { ok: true, lat: 25.2048493, lng: 55.2707828, accuracy: 12 }

test('GPS denied or unusable: nothing is sent', () => {
  for (const fix of [{ ok: false, reason: 'denied' }, null, undefined, { ok: true, lat: 0, lng: 0, accuracy: 5 }, { ok: true, lat: 'x', lng: 1 }]) {
    assert.equal(arrivalRequest({ customerId: 4, date: '2026-10-18', fix, canSetPin: true, stopHasPin: false, now }), null)
  }
})

test('a driver sends the fix on the visit only; the saved shop pin is never requested', () => {
  const r = arrivalRequest({ customerId: 4, date: '2026-10-18', fix: good, canSetPin: false, stopHasPin: false, now })
  assert.deepEqual(r.body, { customerId: 4, visitDate: '2026-10-18', status: 'Arrived', reachedAt: '2026-10-18T10:00:00.000Z', latitude: 25.204849, longitude: 55.270783 })
  assert.equal(r.savesPin, false)
  assert.equal('updateSavedLocation' in r.body, false)
  assert.equal(arrivalMessage({ ...r, canSetPin: false, stopHasPin: false }), 'Arrived. Your location was sent to the office to confirm as the shop location.')
})

test('an owner or admin saves the shop pin only when the stop has none and the fix is accurate', () => {
  const first = arrivalRequest({ customerId: 4, date: '2026-10-18', fix: good, canSetPin: true, stopHasPin: false, now })
  assert.equal(first.body.updateSavedLocation, true)
  assert.equal(first.savesPin, true)
  assert.equal(arrivalMessage({ ...first, canSetPin: true, stopHasPin: false }), 'Arrived. Shop location saved.')

  // An existing pin is never overwritten by an arrival (GPS drift); the office confirms a change on the Route Map.
  const pinned = arrivalRequest({ customerId: 4, date: '2026-10-18', fix: good, canSetPin: true, stopHasPin: true, now })
  assert.equal('updateSavedLocation' in pinned.body, false)
  assert.equal(arrivalMessage({ ...pinned, canSetPin: true, stopHasPin: true }), 'Arrived. The saved shop location was not changed.')

  // A poor fix (over 100 m) is recorded on the visit but not saved as the shop pin.
  const poor = arrivalRequest({ customerId: 4, date: '2026-10-18', fix: { ...good, accuracy: 340 }, canSetPin: true, stopHasPin: false, now })
  assert.equal(poor.savesPin, false)
  assert.equal('updateSavedLocation' in poor.body, false)
  assert.match(arrivalMessage({ ...poor, canSetPin: true, stopHasPin: false, accuracy: 340 }), /not accurate enough/)
})

const route = [
  { customerId: 1, position: 1, mainLatitude: 25.1, mainLongitude: 55.1, mapStatus: 'delivered' },
  { customerId: 2, position: 2, mainLatitude: 25.2, mainLongitude: 55.2, mapStatus: 'failed' },
  { customerId: 3, position: 3, mainLatitude: 25.3, mainLongitude: 55.3, mapStatus: 'arrived' },
  { customerId: 4, position: 4, mainLatitude: null, mainLongitude: null, mapStatus: 'not_reached' },
  { customerId: 5, position: 5, mainLatitude: 25.5, mainLongitude: 55.5, mapStatus: 'not_reached' },
]

test('the next stop is the first one still open, even without a pin', () => {
  assert.equal(nextStop(route).customerId, 3) // arrived but not finished
  assert.equal(nextStop(route.slice(0, 2)), null)
  assert.equal(nextStop([]), null)
  assert.equal(nextStop(undefined), null)
})

test('navigate remaining stops: ordered waypoints from the next open pinned stop, capped, with a count of what was left out', () => {
  const nav = navigationWaypointsUrl(route)
  assert.equal(nav.count, 2) // stops 3 and 5 (stop 4 has no pin)
  assert.equal(nav.skippedNoPin, 1)
  assert.equal(nav.dropped, 0)
  assert.equal(nav.url, 'https://www.google.com/maps/dir/?api=1&destination=25.5,55.5&waypoints=25.3%2C55.3')

  const many = Array.from({ length: 14 }, (_, i) => ({ customerId: i + 1, position: i + 1, mainLatitude: 25 + i / 100, mainLongitude: 55, mapStatus: 'not_reached' }))
  const capped = navigationWaypointsUrl(many)
  assert.equal(capped.count, MAX_WAYPOINT_STOPS)
  assert.equal(capped.dropped, 14 - MAX_WAYPOINT_STOPS)
  assert.equal(decodeURIComponent(capped.url).split('waypoints=')[1].split('|').length, MAX_WAYPOINT_STOPS - 1)

  assert.equal(navigationWaypointsUrl([route[0]]), null)
  assert.equal(navigationWaypointsUrl([]), null)
  const single = navigationWaypointsUrl([route[4]])
  assert.equal(single.url, 'https://www.google.com/maps/dir/?api=1&destination=25.5,55.5')
})
