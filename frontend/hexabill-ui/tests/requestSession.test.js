import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequestSession } from '../src/services/requestSession.js'

test('same-host owner and support sessions cannot retrieve another session response', () => {
  let identity = { host: 'fixture.hexabill.company', token: 'owner-a-token' }
  const session = createRequestSession(() => identity)
  const config = { method: 'GET', url: '/api/reports/summary', params: { day: 'today' } }
  const cache = new Map([[session.key(config), { privateTotal: 99 }]])
  const ownerScope = session.current()
  assert.equal(cache.get(session.key(config)).privateTotal, 99)
  identity = { ...identity, token: 'owner-b-token' }
  assert.equal(cache.has(session.key(config)), false)
  assert.equal(session.isCurrent(ownerScope), false)
  identity = { ...identity, token: 'read-only-support-token' }
  assert.equal(cache.has(session.key(config)), false)
  assert.equal(session.key(config).includes(identity.token), false)
})

test('logout and re-login cannot revive an earlier response even with the same token', () => {
  let identity = { host: 'fixture.hexabill.company', token: 'same-token' }
  const session = createRequestSession(() => identity)
  const first = session.current()
  identity = { ...identity, token: null }
  session.current()
  identity = { ...identity, token: 'same-token' }
  assert.equal(session.isCurrent(first), false)
  const second = session.current()
  session.reset()
  assert.equal(session.isCurrent(second), false)
})

test('host, API base, method and filter changes separate otherwise identical requests', () => {
  let identity = { host: 'first.hexabill.company', token: 'token' }
  const session = createRequestSession(() => identity)
  const config = { method: 'get', url: '/settings', baseURL: 'https://api-one.example', params: { branch: 1 } }
  const key = session.key(config)
  assert.equal(session.key({ ...config, method: 'GET' }), key)
  for (const changes of [{ method: 'POST' }, { params: { branch: 2 } },
    { baseURL: 'https://api-two.example' }, { url: '/products' }]) {
    assert.notEqual(session.key({ ...config, ...changes }), key)
  }
  identity = { ...identity, host: 'second.hexabill.company' }
  assert.notEqual(session.key(config), key)
})
