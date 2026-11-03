import test from 'node:test'
import assert from 'node:assert/strict'
import { invalidatesCache, isCacheableGet } from '../src/services/responseCachePolicy.js'
import { createLedgerPaymentJournal, reconcilePaymentKey, settlePendingPayment } from '../src/utils/ledgerPaymentIntent.js'

// Live 2026-11-03 (FrozenHub, user 34): GETs were cached 30 s and payment writes never cleared the cache, so the ledger
// showed pre-payment status/balance right after a save; stale pending entries in a tablet tab blocked new payments.

test('money and transaction reads are never served from the client cache', () => {
  for (const url of [
    '/payments?page=1&pageSize=1000&customerId=152', '/payments/idempotency/627fc7e3-4fd2-4cc3-8807-0fc0ec96ba84',
    '/api/payments/1520', '/customers/212', '/customers/140/ledger', '/customers/212/outstanding-invoices',
    '/sales/1704', '/legacy/invoices?customerId=212', '/reports/sales-ledger?from=2026-11-01', '/purchases', '/suppliers/summary',
    'https://hexabill.onrender.com/api/customers?page=1&pageSize=20',
  ]) assert.equal(isCacheableGet(url), false, url)
})

test('slow-changing reads may still use the short cache', () => {
  for (const url of ['/settings', '/api/settings/company', '/branches', '/routes', '/alerts/unread-count', '/reports/summary'])
    assert.equal(isCacheableGet(url), true, url)
  assert.equal(isCacheableGet(''), false)
})

test('every successful write clears the cache; reads and failed writes do not', () => {
  for (const method of ['POST', 'put', 'PATCH', 'DELETE']) assert.equal(invalidatesCache(method, 201), true, method)
  assert.equal(invalidatesCache('POST', 200), true)
  assert.equal(invalidatesCache('GET', 200), false)
  assert.equal(invalidatesCache('POST', 400), false)
  assert.equal(invalidatesCache('DELETE', 500), false)
})

function memoryJournal() {
  const store = new Map()
  let n = 0
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k),
  }
  const journal = createLedgerPaymentJournal(storage, () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`)
  return { journal, store }
}

const scope = 'hexabill:ledger-payment:v1:https://frozenhub.hexabill.company:20:34:212'
const draft = (amount) => ({ kind: 'create', form: JSON.stringify({ kind: 'create', amount }), request: { customerId: 212, amount } })

test('a pending payment already saved on the server is cleared, so a different payment can be recorded', async () => {
  const { journal } = memoryJournal()
  const old = journal.begin(scope, draft(1066))
  assert.throws(() => journal.begin(scope, draft(500)), /Retry the previous payment/)
  const settled = await settlePendingPayment(journal, scope, async (key) => {
    assert.equal(key, old.idempotencyKey)
    return { state: 'saved', response: { payment: { id: 1523 } } }
  })
  assert.equal(settled.state, 'saved')
  assert.equal(journal.read(scope), null)
  const next = journal.begin(scope, draft(500))
  assert.notEqual(next.idempotencyKey, old.idempotencyKey)
})

test('a pending payment the server never stored is released; an unclear answer keeps it', async () => {
  const { journal } = memoryJournal()
  journal.begin(scope, draft(355))
  assert.equal((await settlePendingPayment(journal, scope, async () => ({ state: 'unknown' }))).state, 'unknown')
  assert.ok(journal.read(scope))
  assert.equal((await settlePendingPayment(journal, scope, async () => ({ state: 'not_saved' }))).state, 'not_saved')
  assert.equal(journal.read(scope), null)
  assert.equal((await settlePendingPayment(journal, scope, async () => ({ state: 'saved' }))).state, 'none')
})

test('reconcilePaymentKey stops at the first saved answer and treats errors as unknown', async () => {
  const calls = []
  const saved = await reconcilePaymentKey(async (k) => { calls.push(k); return calls.length < 2 ? { success: true, data: null } : { success: true, data: { payment: { id: 9 } } } }, 'k1', [0, 1, 1], async () => {})
  assert.equal(saved.state, 'saved')
  assert.equal(calls.length, 2)
  const unknown = await reconcilePaymentKey(async () => { throw new Error('offline') }, 'k2', [0, 1], async () => {})
  assert.equal(unknown.state, 'unknown')
  const notSaved = await reconcilePaymentKey(async () => ({ success: true, data: null }), 'k3', [0, 1, 1], async () => {})
  assert.equal(notSaved.state, 'not_saved')
})
