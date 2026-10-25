import test from 'node:test'
import assert from 'node:assert/strict'
import middleware, { isNullBodyStatus } from '../middleware.js'

function withFetch(impl, fn) {
  const orig = globalThis.fetch
  globalThis.fetch = impl
  return fn().finally(() => { globalThis.fetch = orig })
}

const cors = {
  'access-control-allow-origin': 'https://www.hexabill.company',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
}

test('isNullBodyStatus covers 101/204/205/304 only', () => {
  for (const s of [101, 204, 205, 304]) assert.equal(isNullBodyStatus(s), true)
  for (const s of [200, 201, 302, 400, 502]) assert.equal(isNullBodyStatus(s), false)
})

test('OPTIONS preflight with upstream 204 returns 204, null body, CORS headers kept', async () => {
  await withFetch(async () => new Response(null, { status: 204, headers: cors }), async () => {
    const res = await middleware(new Request('https://api.hexabill.company/api/auth/login', { method: 'OPTIONS' }))
    assert.equal(res.status, 204)
    assert.equal(res.body, null)
    for (const [k, v] of Object.entries(cors)) assert.equal(res.headers.get(k), v)
  })
})

test('upstream 304 returns 304 with null body', async () => {
  await withFetch(async () => new Response(null, { status: 304, headers: { etag: '"x"' } }), async () => {
    const res = await middleware(new Request('https://www.hexabill.company/api/x'))
    assert.equal(res.status, 304)
    assert.equal(res.body, null)
    assert.equal(res.headers.get('etag'), '"x"')
  })
})

test('upstream 200 JSON body unchanged', async () => {
  const json = JSON.stringify({ ok: true })
  await withFetch(async () => new Response(json, { status: 200, headers: { 'content-type': 'application/json', ...cors } }), async () => {
    const res = await middleware(new Request('https://www.hexabill.company/api/health'))
    assert.equal(res.status, 200)
    assert.equal(await res.text(), json)
    assert.equal(res.headers.get('content-length'), String(json.length))
    assert.equal(res.headers.get('access-control-allow-origin'), cors['access-control-allow-origin'])
  })
})
