import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveDevTenantHeaders, resolveProxyOriginalHost } from '../src/utils/devTenantHeaders.js'

test('resolveDevTenantHeaders only applies on loopback with *.localhost override', () => {
  const get = (k) => (k === 'hexabill_dev_tenant_host' ? 'frozenhub1.localhost' : null)
  assert.equal(resolveDevTenantHeaders('frozenhub1.localhost', get), null)
  assert.equal(resolveDevTenantHeaders('hexabill.company', get), null)
  const headers = resolveDevTenantHeaders('127.0.0.1', get)
  assert.equal(headers['X-HexaBill-Original-Host'], 'frozenhub1.localhost')
  assert.ok(headers['X-HexaBill-Edge-Secret'])
})

test('resolveDevTenantHeaders ignores missing or non-localhost overrides', () => {
  assert.equal(resolveDevTenantHeaders('127.0.0.1', () => ''), null)
  assert.equal(resolveDevTenantHeaders('127.0.0.1', () => 'evil.com'), null)
})

test('resolveProxyOriginalHost prefers *.localhost override over loopback Host', () => {
  assert.equal(
    resolveProxyOriginalHost('127.0.0.1:5173', 'frozenhub1.localhost'),
    'frozenhub1.localhost'
  )
  assert.equal(resolveProxyOriginalHost('127.0.0.1', 'evil.com'), '127.0.0.1')
  assert.equal(resolveProxyOriginalHost('localhost', undefined), 'localhost')
})
