import test, { before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

let api, clearAllCache, resetRequestSession, storage
// Exercise the real API wrapper/interceptors and Axios with an in-memory adapter.
// Substitute UI notifications and connection state; no server or production data is used.
before(async () => {
  const require = createRequire(import.meta.url)
  const stubs = {
    react: 'export default { createElement() {} }',
    'react-hot-toast': 'export default { error() {}, success() {}, dismiss() {} }',
    './connectionManager': 'export const connectionManager = { shouldAllowRequest: () => true, markConnected() {}, markDisconnected() {}, isConnected: () => true }',
    '../components/MaintenanceOverlay': 'export function showMaintenanceOverlay() {}',
    '../components/SubscriptionGraceBanner': 'export function setSubscriptionGraceFromResponse() {}',
    './apiConfig': 'export const getApiBaseUrl = () => "https://fixture-api.example/api"',
  }
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/services/api.js', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'test-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, (args) => {
        if (args.path === 'axios') return { path: pathToFileURL(require.resolve('axios')).href, external: true }
        if (Object.hasOwn(stubs, args.path)) return { path: args.path, namespace: 'fixture' }
      })
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({ contents: stubs[args.path], loader: 'js' }))
    } }],
  })
  globalThis.window = { location: { hostname: 'fixture.hexabill.company', pathname: '/dashboard' } }
  const module = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
  api = module.default
  clearAllCache = module.clearAllCache
  resetRequestSession = module.resetRequestSession
})
beforeEach(() => {
  storage = new Map([['token', 'owner-a-token']])
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) }
  resetRequestSession()
})

function response(config, data) {
  return { config, data, status: 200, statusText: 'OK', headers: {} }
}

test('real API response cache cannot serve owner A data to owner B on the same host', async () => {
  let calls = 0
  const adapter = async (config) => {
    calls += 1
    return response(config, { owner: config.headers.Authorization })
  }
  const config = { method: 'GET', url: '/reports/summary', adapter }
  assert.equal((await api.request(config)).data.owner, 'Bearer owner-a-token')
  assert.equal((await api.request(config)).data.owner, 'Bearer owner-a-token')
  assert.equal(calls, 1)
  storage.set('token', 'owner-b-token')
  assert.equal((await api.request(config)).data.owner, 'Bearer owner-b-token')
  assert.equal(calls, 2)
})

test('old successful response is cancelled before it can reach the replacement owner', async () => {
  let finish, started
  const ready = new Promise((resolve) => { started = resolve })
  const request = api.get('/customers', { adapter: (config) => new Promise((resolve) => {
    finish = () => resolve(response(config, { privateName: 'Owner A customer' }))
    started()
  }) })
  await ready
  storage.set('token', 'owner-b-token')
  finish()
  await assert.rejects(request, (error) => error.sessionChanged === true && error.code === 'ERR_CANCELED')
})

test('old 401 neither removes the new token nor triggers an authentication redirect', async () => {
  let finish, started
  const ready = new Promise((resolve) => { started = resolve })
  const request = api.get('/settings', { adapter: (config) => new Promise((resolve, reject) => {
    finish = () => reject(Object.assign(new Error('Unauthorized'), { config, response: { status: 401, data: {} } }))
    started()
  }) })
  await ready
  storage.set('token', 'owner-b-token')
  finish()
  await assert.rejects(request, (error) => error.sessionChanged === true)
  assert.equal(storage.get('token'), 'owner-b-token')
})

test('a delayed retry cannot dispatch after a session reset', async () => {
  let calls = 0
  let firstScope
  await api.request({ method: 'GET', url: '/products', adapter: async (config) => {
    calls += 1
    firstScope = config._sessionScope
    return response(config, [])
  } })
  resetRequestSession()
  await assert.rejects(api.request({ method: 'GET', url: '/products', _isRetry: true,
    _sessionScope: firstScope, adapter: async (config) => {
      calls += 1
      return response(config, [])
    } }), (error) => error.sessionChanged === true)
  assert.equal(calls, 1)
})

test('cached data is also cancelled if login changes before promise delivery', async () => {
  const config = { method: 'GET', url: '/reports/summary', adapter: async (request) => response(request, { privateTotal: 99 }) }
  await api.request(config)
  const cached = api.request(config)
  storage.set('token', 'owner-b-token')
  await assert.rejects(cached, (error) => error.sessionChanged === true)
})

test('actual scheduled retry stops when the owner changes during its backoff', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let calls = 0
  const request = api.get('/products', { adapter: async (config) => {
    calls += 1
    throw Object.assign(new Error('Temporary failure'), { config, response: { status: 503, data: {} } })
  } })
  await new Promise(setImmediate)
  storage.set('token', 'owner-b-token')
  context.mock.timers.tick(1000)
  await assert.rejects(request, (error) => error.sessionChanged === true)
  assert.equal(calls, 1)
})

test('pending expired-session redirect cannot interrupt a new login', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  window.location.href = '/dashboard'
  await assert.rejects(api.get('/settings', { adapter: async (config) => {
    throw Object.assign(new Error('Expired'), { config,
      response: { status: 401, data: { message: 'Token expired' }, headers: { 'token-expired': 'true' } } })
  } }))
  assert.equal(storage.get('token'), undefined)
  storage.set('token', 'owner-b-token')
  context.mock.timers.tick(1500)
  assert.equal(window.location.href, '/dashboard')
  assert.equal(storage.get('token'), 'owner-b-token')
})

test('ordinary settings cache invalidation does not cancel current-session requests', async () => {
  let finish, started
  const ready = new Promise((resolve) => { started = resolve })
  const request = api.get('/customers', { adapter: (config) => new Promise((resolve) => {
    finish = () => resolve(response(config, { count: 2 }))
    started()
  }) })
  await ready
  clearAllCache()
  finish()
  assert.equal((await request).data.count, 2)
})
