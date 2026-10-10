import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyServiceError, isAutoRetryable, isIdempotentWrite } from '../src/services/serviceErrors.js'

test('only an explicit maintenance body is maintenance (P0-02)', () => {
  assert.equal(classifyServiceError(503, { maintenanceMode: true, message: 'x' }), 'maintenance')
  assert.equal(classifyServiceError(503, { reason: 'MAINTENANCE_ENABLED' }), 'maintenance')
  assert.equal(classifyServiceError(503, { status: 'Unavailable', schema: 'InitializationFailed', reason: 'SERVICE_UNAVAILABLE' }), 'unavailable')
  assert.equal(classifyServiceError(503, { status: 'Unavailable', schema: 'InitializationPending' }), 'unavailable')
  assert.equal(classifyServiceError(503, undefined), 'unavailable')
  assert.equal(classifyServiceError(503, '<html>Service Unavailable</html>'), 'unavailable')
  assert.equal(classifyServiceError(429, {}), 'rateLimited')
  assert.equal(classifyServiceError(504, {}), 'timeout')
  assert.equal(classifyServiceError(500, {}), 'other')
})

test('reads retry on transient failures; auth failures never retry', () => {
  assert.equal(isAutoRetryable({ method: 'get' }, 503), true)
  assert.equal(isAutoRetryable({ method: 'get' }, undefined), true)
  assert.equal(isAutoRetryable({ method: 'get' }, 404), false)
  assert.equal(isAutoRetryable({ method: 'get' }, 401), false)
  assert.equal(isAutoRetryable({ method: 'get', _skipRetry: true }, 503), false)
})

test('unprotected writes are never resent (duplicate expense/purchase risk, P0-07)', () => {
  assert.equal(isAutoRetryable({ method: 'post', url: '/expenses', data: '{"amount":10}' }, 500), false)
  assert.equal(isAutoRetryable({ method: 'post', url: '/purchases', data: { total: 5 } }, undefined), false)
  assert.equal(isAutoRetryable({ method: 'put', url: '/customers/1', data: {} }, 503), false)
  assert.equal(isAutoRetryable({ method: 'delete', url: '/expenses/1' }, 503), false)
})

test('writes the server de-duplicates may be resent', () => {
  const payment = { method: 'post', headers: { 'Idempotency-Key': 'abc' }, data: '{}' }
  assert.equal(isIdempotentWrite(payment), true)
  assert.equal(isAutoRetryable(payment, 502), true)
  const sale = { method: 'post', data: JSON.stringify({ externalReference: 'pos-1', items: [] }) }
  assert.equal(isAutoRetryable(sale, undefined), true)
  assert.equal(isAutoRetryable({ method: 'post', data: { externalReference: '  ' } }, 503), false)
  assert.equal(isAutoRetryable({ method: 'patch', _idempotent: true }, 503), true)
})

test('recovery probe backs off to 60s and reads the maintenance-check contract', async () => {
  const { nextProbeDelayMs, interpretProbe } = await import('../src/services/serviceErrors.js')
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(nextProbeDelayMs), [5000, 10000, 20000, 40000, 60000, 60000])
  assert.equal(interpretProbe(200, { maintenanceMode: false }), 'ok')
  assert.equal(interpretProbe(200, { maintenanceMode: true, message: 'x' }), 'maintenance')
  assert.equal(interpretProbe(503, { status: 'Unavailable', schema: 'InitializationFailed' }), 'unavailable')
  assert.equal(interpretProbe(0, undefined), 'unavailable')
})
