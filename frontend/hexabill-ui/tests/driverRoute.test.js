import test from 'node:test'
import assert from 'node:assert/strict'
import {
  statusLabel, needsReason, reasonIsValid, orderedStops, mappableStops, locationNeededStops, stopNavigationUrl,
  moveStop, moveStopToTop, runPhase, runSummaryParts, endRouteWarning, visitRequest, openStops,
} from '../src/features/branches/driverRoute.js'

const stops = [
  { customerId: 3, position: 3, customerName: 'C', mainLatitude: null, mainLongitude: null, needsLocation: true, mapStatus: 'not_reached' },
  { customerId: 1, position: 1, customerName: 'A', mainLatitude: 25.2, mainLongitude: 55.3, needsLocation: false, mapStatus: 'delivered' },
  { customerId: 2, position: 2, customerName: 'B', mainLatitude: 25.21, mainLongitude: 55.31, needsLocation: false, mapStatus: 'arrived' },
]

test('stops are shown in route order and unpinned ones are listed apart', () => {
  assert.deepEqual(orderedStops(stops).map((s) => s.customerId), [1, 2, 3])
  assert.deepEqual(mappableStops(stops).map((s) => s.customerId), [1, 2])
  assert.deepEqual(locationNeededStops(stops).map((s) => s.customerId), [3])
  assert.equal(stopNavigationUrl(stops[0]), null)
  assert.match(stopNavigationUrl(stops[1]), /destination=25\.2,55\.3/)
})

test('stops without a position keep the order they were given', () => {
  const plain = [{ customerId: 9 }, { customerId: 8 }]
  assert.deepEqual(orderedStops(plain).map((s) => s.position), [1, 2])
  assert.deepEqual(orderedStops(plain).map((s) => s.customerId), [9, 8])
  assert.deepEqual(orderedStops(undefined), [])
})

test('moving a stop swaps neighbours and stops at the ends', () => {
  assert.deepEqual(moveStop([1, 2, 3], 2, -1), [2, 1, 3])
  assert.deepEqual(moveStop([1, 2, 3], 2, 1), [1, 3, 2])
  assert.deepEqual(moveStop([1, 2, 3], 1, -1), [1, 2, 3])
  assert.deepEqual(moveStop([1, 2, 3], 3, 1), [1, 2, 3])
  assert.deepEqual(moveStop([1, 2, 3], 99, 1), [1, 2, 3])
  assert.deepEqual(moveStopToTop([1, 2, 3], 3), [3, 1, 2])
  assert.deepEqual(moveStopToTop([1, 2, 3], 99), [1, 2, 3])
  const original = [1, 2, 3]
  moveStop(original, 2, -1)
  assert.deepEqual(original, [1, 2, 3])
})

test('failed and skipped stops need a real reason', () => {
  assert.equal(needsReason('Failed'), true)
  assert.equal(needsReason('Skipped'), true)
  assert.equal(needsReason('Delivered'), false)
  assert.equal(needsReason('Arrived'), false)
  assert.equal(reasonIsValid('ok'), false)
  assert.equal(reasonIsValid('   '), false)
  assert.equal(reasonIsValid(' Shop closed '), true)
})

test('a visit request never carries coordinates and only carries a reason when one is needed', () => {
  const delivered = visitRequest({ customerId: 5, date: '2026-10-18', status: 'Delivered', reason: 'ignored' })
  assert.deepEqual(delivered, { customerId: 5, visitDate: '2026-10-18', status: 'Delivered' })
  const failed = visitRequest({ customerId: 5, date: '2026-10-18', status: 'Failed', reason: '  Shop closed ' })
  assert.equal(failed.notes, 'Shop closed')
  for (const body of [delivered, failed]) {
    assert.equal('latitude' in body, false)
    assert.equal('longitude' in body, false)
    assert.equal('updateSavedLocation' in body, false)
  }
})

test('run phase and summary', () => {
  assert.equal(runPhase(null), 'notStarted')
  assert.equal(runPhase({ current: null, last: null }), 'notStarted')
  assert.equal(runPhase({ current: { isOpen: true } }), 'running')
  assert.equal(runPhase({ current: null, last: { isOpen: false } }), 'finished')
  assert.deepEqual(runSummaryParts({ stopsDelivered: 2, stopsFailed: 1, stopsSkipped: 0, stopsNotVisited: 3 }).map((p) => p.value), [2, 1, 0, 3])
  assert.deepEqual(runSummaryParts(null), [])
  assert.match(endRouteWarning({ stopsNotVisited: 0 }), /Every stop/)
  assert.match(endRouteWarning({ stopsNotVisited: 1 }), /1 stop has not been visited/)
  assert.match(endRouteWarning({ stopsNotVisited: 4 }), /4 stops have not been visited/)
})

test('status labels and open stops', () => {
  assert.equal(statusLabel('delivered'), 'Delivered')
  assert.equal(statusLabel('whatever'), 'Not visited')
  assert.deepEqual(openStops(stops).map((s) => s.customerId), [2, 3])
})
