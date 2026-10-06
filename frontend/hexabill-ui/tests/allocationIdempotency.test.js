import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

let paymentsAPI
before(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/services/index.js', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'payment-transport', setup(builder) {
      builder.onResolve({ filter: /^\.\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
        contents: 'export default { post: (...args) => globalThis.__paymentTransport(...args) }', loader: 'js',
      }))
    } }],
  })
  const module = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
  paymentsAPI = module.paymentsAPI
})

test('allocation retry preserves the caller key after a lost response', async () => {
  const calls = []
  globalThis.__paymentTransport = async (...args) => {
    calls.push(args)
    if (calls.length === 1) throw new Error('Response lost after server commit')
    return { data: { success: true, data: { payment: { id: 42 } } } }
  }
  const allocation = { customerId: 1, amount: 20, mode: 'CASH', allocations: [{ invoiceId: 1, amount: 20 }] }
  await assert.rejects(paymentsAPI.allocatePayment(allocation, 'allocation-fixture-key'), /Response lost/)
  const result = await paymentsAPI.allocatePayment(allocation, 'allocation-fixture-key')
  assert.equal(result.data.payment.id, 42)
  assert.equal(calls.length, 2)
  for (const [path, body, config] of calls) {
    assert.equal(path, '/payments/allocate')
    assert.deepEqual(body, allocation)
    assert.equal(config?.headers?.['Idempotency-Key'], 'allocation-fixture-key')
  }
})

test('allocation client supplies a key when the caller omitted one', async () => {
  let config
  globalThis.__paymentTransport = async (_path, _body, options) => {
    config = options
    return { data: { success: true } }
  }
  await paymentsAPI.allocatePayment({ customerId: 1, amount: 20, allocations: [{ invoiceId: 1, amount: 20 }] })
  assert.match(config?.headers?.['Idempotency-Key'] ?? '', /^[0-9a-f-]{36}$/i)
})
