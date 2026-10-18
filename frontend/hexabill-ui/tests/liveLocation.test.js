import test from 'node:test'
import assert from 'node:assert/strict'
import {
  newSessionId, shouldSend, shareBody, ageText, isStale, sharingStatusText, stateForGeoError, describeDrivers,
  CONSENT_POINTS, MIN_SEND_INTERVAL_MS, STALE_AFTER_SECONDS,
} from '../src/features/branches/liveLocation.js'

test('session ids are long, hex and different each time', () => {
  const a = newSessionId()
  const b = newSessionId()
  assert.match(a, /^[0-9a-f]{32}$/)
  assert.notEqual(a, b)
  assert.match(newSessionId({ getRandomValues: (arr) => arr.fill(171) }), /^(ab){16}$/) // fallback path
})

test('a fix is sent first, then at most once per interval', () => {
  assert.equal(shouldSend({ lastSentAt: null }), true)
  assert.equal(shouldSend({ lastSentAt: 1000, now: 1000 + MIN_SEND_INTERVAL_MS - 1 }), false)
  assert.equal(shouldSend({ lastSentAt: 1000, now: 1000 + MIN_SEND_INTERVAL_MS }), true)
})

test('only the first update of a session carries consent', () => {
  const coords = { latitude: 25.2, longitude: 55.3, accuracy: 12.34 }
  const first = shareBody({ coords, sessionId: 'abc12345', first: true })
  const later = shareBody({ coords, sessionId: 'abc12345', first: false })
  assert.equal(first.consent, true)
  assert.equal(later.consent, false)
  assert.equal(first.accuracyMeters, 12.3)
  assert.equal(shareBody({ coords: { latitude: 1, longitude: 2, accuracy: undefined }, sessionId: 'x', first: false }).accuracyMeters, null)
})

test('ages read naturally and staleness has one threshold', () => {
  assert.equal(ageText(2), 'just now')
  assert.equal(ageText(30), '30 seconds ago')
  assert.equal(ageText(60), '1 minute ago')
  assert.equal(ageText(200), '3 minutes ago')
  assert.equal(isStale(STALE_AFTER_SECONDS), false)
  assert.equal(isStale(STALE_AFTER_SECONDS + 1), true)
})

test('the driver always sees an honest status', () => {
  const now = 100000
  assert.match(sharingStatusText({ state: 'idle' }), /not being shared/)
  assert.match(sharingStatusText({ state: 'denied' }), /permission is off/)
  assert.match(sharingStatusText({ state: 'offline' }), /No connection/)
  assert.match(sharingStatusText({ state: 'sharing', lastSentAt: null }), /first position/)
  assert.match(sharingStatusText({ state: 'sharing', lastSentAt: now - 20000, now, accuracy: 14.6 }), /20 seconds ago.*15 m/)
  assert.match(sharingStatusText({ state: 'sharing', lastSentAt: now - 200000, now }), /No recent update/)
  assert.equal(stateForGeoError({ code: 1 }), 'denied')
  assert.equal(stateForGeoError({ code: 3 }), 'unavailable')
})

test('the consent text names who sees it, what is kept and how to stop', () => {
  const text = CONSENT_POINTS.join(' ')
  assert.match(text, /owners and managers of this route/)
  assert.match(text, /not a trail/)
  assert.match(text, /stop at any time/)
  assert.match(text, /after you close this screen/)
})

test('office rows flag stale drivers and never hide them', () => {
  const rows = describeDrivers([
    { userId: 1, userName: 'A', ageSeconds: 10, accuracyMeters: 12.4 },
    { userId: 2, userName: 'B', ageSeconds: 400, accuracyMeters: null },
  ])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].stale, false)
  assert.equal(rows[0].accuracyLabel, 'about 12 m')
  assert.equal(rows[1].stale, true)
  assert.equal(rows[1].accuracyLabel, null)
  assert.match(rows[1].ageLabel, /7 minutes ago/)
  assert.deepEqual(describeDrivers(undefined), [])
})
