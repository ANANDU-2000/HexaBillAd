import test from 'node:test'
import assert from 'node:assert/strict'
import { brandingLoadDecision } from '../src/tenant/brandingLoadGate.js'

test('platform host without impersonation never requests tenant branding, even forced', () => {
  assert.deepEqual(brandingLoadDecision({ hostMode: 'platform', impersonatedTenantId: null, force: true }), { load: false, reason: 'platform-host' })
})
test('platform host while impersonating a tenant may load', () => {
  assert.equal(brandingLoadDecision({ hostMode: 'platform', impersonatedTenantId: 7, force: true }).load, true)
})
test('passive triggers are deduped while in flight or fresh', () => {
  assert.equal(brandingLoadDecision({ hostMode: 'tenant', inFlight: true }).reason, 'in-flight')
  assert.equal(brandingLoadDecision({ hostMode: 'tenant', lastAt: 1000, now: 2000 }).reason, 'fresh')
})
test('stale or never-loaded passive trigger loads; forced always loads on tenant host', () => {
  assert.equal(brandingLoadDecision({ hostMode: 'tenant', lastAt: 1000, now: 1000 + 60000 }).load, true)
  assert.equal(brandingLoadDecision({ hostMode: 'tenant' }).load, true)
  assert.equal(brandingLoadDecision({ hostMode: 'tenant', inFlight: true, lastAt: 1000, now: 1001, force: true }).load, true)
})
