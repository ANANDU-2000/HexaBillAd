import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createLedgerPaymentJournal, createPaymentBatchJournal, isDefinitivePaymentRejection, paymentRejectionMessage, bulkRowFromSaved,
  ledgerPaymentScope, paymentBatchScope, ledgerPaymentForm,
} from '../src/utils/ledgerPaymentIntent.js'

const http = (status, message = 'No open invoice.') => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data: { message } } })

test('only a 400/422 validation answer proves nothing was saved', () => {
  assert.equal(isDefinitivePaymentRejection(http(400)), true)
  assert.equal(isDefinitivePaymentRejection(http(422)), true)
  for (const status of [401, 403, 404, 409, 429, 500, 502, 503]) assert.equal(isDefinitivePaymentRejection(http(status)), false, String(status))
  assert.equal(isDefinitivePaymentRejection(new Error('Network Error')), false)
  assert.equal(isDefinitivePaymentRejection(Object.assign(new Error('timeout of 30000ms exceeded'), { code: 'ECONNABORTED' })), false)
  assert.equal(isDefinitivePaymentRejection(null), false)
  assert.equal(isDefinitivePaymentRejection(undefined), false)
  // The key was already used for a different request: an earlier request may have been saved, so this stays uncertain.
  assert.equal(isDefinitivePaymentRejection(http(400, 'This idempotency key was already used for a different payment request.')), false)
})

test('the server message is shown, or a plain fallback', () => {
  assert.equal(paymentRejectionMessage(http(400, 'Customer has no outstanding invoices.')), 'Customer has no outstanding invoices.')
  assert.equal(paymentRejectionMessage({ response: { status: 400, data: { errors: ['Amount is too high', 'Pick a mode'] } } }), 'Amount is too high, Pick a mode')
  assert.equal(paymentRejectionMessage(new Error('Something')), 'Something')
  assert.match(paymentRejectionMessage({}), /could not be saved/i)
})

const memory = () => {
  const rows = new Map()
  return { rows, getItem: (k) => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, String(v)), removeItem: (k) => rows.delete(k), key: (i) => [...rows.keys()][i], get length () { return rows.size } }
}
const identity = { origin: 'http://x.localhost', tenantId: 1, userId: 2 }
const draft = (customerId, amount) => ({
  kind: 'create',
  form: ledgerPaymentForm({ amount, method: 'CASH', paymentDate: '2026-10-18' }, false),
  request: { saleId: null, customerId, amount, mode: 'CASH', reference: null, paymentDate: '2026-10-18T00:00:00.000Z' },
})

test('discard removes only the matching saved payment', () => {
  const storage = memory()
  let n = 0
  const journal = createLedgerPaymentJournal(storage, () => `00000000-0000-0000-0000-00000000000${++n}`)
  const scope = ledgerPaymentScope({ ...identity, customerId: 5 })
  const intent = journal.begin(scope, draft(5, 100))
  journal.discard(scope, '00000000-0000-0000-0000-0000000000ff') // a different key: nothing happens
  assert.ok(journal.read(scope))
  journal.discard(scope, intent.idempotencyKey)
  assert.equal(journal.read(scope), null)
  assert.equal(storage.rows.size, 0)
})

test('a bulk batch keeps confirmed rows and hands back the rejected and unsent rows', async () => {
  const storage = memory()
  let n = 0
  const batches = createPaymentBatchJournal(storage, () => `00000000-0000-0000-0000-0000000000${String(++n).padStart(2, '0')}`)
  const scope = paymentBatchScope(identity)
  const rowFor = (customerId, amount) => ({ ...draft(customerId, amount), scope: ledgerPaymentScope({ ...identity, customerId }) })
  batches.begin(scope, [rowFor(1, 10), rowFor(2, 20), rowFor(3, 30)])
  const sent = []
  const result = await batches.execute(scope, async (request) => {
    sent.push(request.customerId)
    if (request.customerId === 2) throw http(400, 'Customer has no outstanding invoices.')
    return { success: true, data: { payment: { id: request.customerId } } }
  })
  assert.deepEqual(sent, [1, 2]) // the third was never sent
  assert.equal(result.rows[0].confirmed, true)
  assert.deepEqual(result.rejected.rows.map((r) => [r.request.customerId, r.rejected]), [[2, true], [3, false]])
  assert.equal(result.rejected.index, 1)
  assert.equal(result.rejected.message, 'Customer has no outstanding invoices.')
  // Nothing is left to resume: no saved batch, no saved per-customer payment.
  assert.equal(batches.read(scope), null)
  assert.equal(storage.rows.size, 0)
  // The handed-back rows can fill the bulk form again.
  assert.deepEqual(bulkRowFromSaved(result.rejected.rows[0]), { customerId: '2', amount: '20', method: 'CASH', paymentDate: '2026-10-18', reference: '' })
})

test('an uncertain failure keeps the batch for retry exactly as before', async () => {
  const storage = memory()
  let n = 0
  const batches = createPaymentBatchJournal(storage, () => `00000000-0000-0000-0000-0000000000${String(++n).padStart(2, '0')}`)
  const scope = paymentBatchScope(identity)
  batches.begin(scope, [{ ...draft(1, 10), scope: ledgerPaymentScope({ ...identity, customerId: 1 }) }])
  await assert.rejects(batches.execute(scope, async () => { throw http(500, 'boom') }), /500/)
  assert.ok(batches.read(scope))
  assert.equal(batches.read(scope).rows[0].confirmed, false)
  // The same key is used on retry.
  const keys = []
  await batches.execute(scope, async (request, key) => { keys.push(key); return { success: true } })
  assert.equal(keys.length, 1)
  assert.equal(batches.read(scope), null)
})
