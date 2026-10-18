import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidPoint, gpsFailureReason, gpsFailureMessage, accuracyAdvice, describeShopLocation, navigationUrl, LOW_ACCURACY_METERS,
} from '../src/utils/shopLocation.js'

test('only real map points are valid', () => {
  assert.equal(isValidPoint(25.2, 55.3), true)
  assert.equal(isValidPoint('25.2', '55.3'), true)
  assert.equal(isValidPoint('', ''), false)
  assert.equal(isValidPoint(null, 55), false)
  assert.equal(isValidPoint(91, 0), false)
  assert.equal(isValidPoint(0, 181), false)
  assert.equal(isValidPoint(0, 0), false)
  assert.equal(isValidPoint('abc', 1), false)
})

test('GPS failures map to plain reasons and messages', () => {
  assert.equal(gpsFailureReason({ code: 1 }), 'denied')
  assert.equal(gpsFailureReason({ code: 3 }), 'timeout')
  assert.equal(gpsFailureReason({ code: 2 }), 'unavailable')
  assert.equal(gpsFailureReason(null), 'unavailable')
  assert.equal(gpsFailureReason('unsupported'), 'unsupported')
  assert.match(gpsFailureMessage('denied'), /permission/i)
  assert.match(gpsFailureMessage('anything else'), /map/i)
  for (const reason of ['denied', 'timeout', 'unavailable', 'unsupported']) assert.match(gpsFailureMessage(reason), /map/i) // always offers the fallback
})

test('low accuracy gets advice, good accuracy does not', () => {
  assert.equal(accuracyAdvice(LOW_ACCURACY_METERS), null)
  assert.equal(accuracyAdvice(12), null)
  assert.equal(accuracyAdvice(undefined), null)
  assert.match(accuracyAdvice(450), /450 m/)
})

test('location sentences never show coordinates', () => {
  const states = [
    describeShopLocation({ hasPin: false }),
    describeShopLocation({ hasPin: true }),
    describeShopLocation({ hasPin: true, updatedAt: '2026-10-01T10:00:00Z', updatedByMe: true }),
    describeShopLocation({ hasPin: false, pending: true }),
    describeShopLocation({ hasPin: true, pending: true }),
    describeShopLocation({ hasPin: true, clearing: true }),
  ]
  for (const s of states) assert.doesNotMatch(s, /\d{2}\.\d{3,}/)
  assert.match(states[0], /No shop location yet/)
  assert.match(states[2], /by you/)
  assert.match(states[4], /replaces/)
  assert.match(states[5], /removed/)
})

test('navigation link exists only for a saved pin', () => {
  assert.equal(navigationUrl(null, null), null)
  assert.equal(navigationUrl(0, 0), null)
  assert.equal(navigationUrl(25.2, 55.3), 'https://www.google.com/maps/dir/?api=1&destination=25.2,55.3')
})
