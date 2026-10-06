import test from 'node:test'
import assert from 'node:assert/strict'
import { createLedgerPaymentJournal, ledgerPaymentForm, ledgerPaymentScope } from '../src/utils/ledgerPaymentIntent.js'

function fixture() {
  const rows = new Map()
  const storage = { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value), removeItem: key => rows.delete(key) }
  const scope = ledgerPaymentScope({ origin: 'http://gulfharvest-test.localhost:5184', tenantId: 1, userId: 2, customerId: 1 })
  return { rows, storage, scope, journal: createLedgerPaymentJournal(storage) }
}
function draft(allocate = false, amount = 20) {
  const form = { amount, paymentDate: '2026-10-05', method: 'CASH', ref: 'ZZ-TEST lost response' }
  return { kind: allocate ? 'allocate' : 'create', form: ledgerPaymentForm(form, allocate), request: {
    customerId: 1, amount, mode: 'CASH', paymentDate: '2026-10-05',
    ...(allocate ? { allocations: [{ invoiceId: 1, amount }] } : { saleId: null }),
  } }
}

for (const allocate of [false, true]) {
  test(`${allocate ? 'allocation' : 'payment'} survives lost confirmation and page reload without a second commit`, () => {
    const { storage, scope, journal } = fixture()
    const committed = new Map()
    const server = intent => {
      if (!committed.has(intent.idempotencyKey)) committed.set(intent.idempotencyKey, structuredClone(intent.request))
      return committed.get(intent.idempotencyKey)
    }
    const first = journal.begin(scope, draft(allocate))
    server(first) // committed but the browser never received confirmation
    const remounted = createLedgerPaymentJournal(storage)
    const retry = remounted.begin(scope, draft(allocate))
    assert.equal(retry.idempotencyKey, first.idempotencyKey)
    assert.deepEqual(server(retry), first.request)
    assert.equal(committed.size, 1)
    remounted.complete(scope, retry.idempotencyKey)
    assert.equal(remounted.read(scope), null)
    assert.notEqual(remounted.begin(scope, draft(allocate)).idempotencyKey, first.idempotencyKey)
  })
}

test('changed form cannot replace an unresolved payment', () => {
  const { scope, journal } = fixture()
  const first = journal.begin(scope, draft())
  assert.throws(() => journal.begin(scope, draft(false, 30)), /Retry the previous payment/)
  assert.deepEqual(journal.read(scope), first)
})

test('allocation recovery freezes original invoice amounts despite a refreshed outstanding balance', () => {
  const { scope, journal } = fixture()
  const firstDraft = draft(true)
  const first = journal.begin(scope, firstDraft)
  firstDraft.request.allocations[0].amount = 0
  const refreshed = draft(true)
  refreshed.request.allocations = []
  assert.deepEqual(journal.begin(scope, refreshed).request.allocations, [{ invoiceId: 1, amount: 20 }])
  assert.deepEqual(first.request.allocations, [{ invoiceId: 1, amount: 20 }])
})

test('host, tenant, user and customer boundaries do not recover another payment', () => {
  const { scope, journal } = fixture()
  const first = journal.begin(scope, draft())
  const identity = { origin: 'http://gulfharvest-test.localhost:5184', tenantId: 1, userId: 2, customerId: 1 }
  for (const replacement of [{ origin: 'http://frozenhub1-test.localhost:5184' }, { tenantId: 2 }, { userId: 3 }, { customerId: 2 }]) {
    assert.equal(journal.read(ledgerPaymentScope({ ...identity, ...replacement })), null)
  }
  assert.equal(journal.read(scope).idempotencyKey, first.idempotencyKey)
})

test('late completion cannot clear a newer payment intent', () => {
  const { scope, journal } = fixture()
  const first = journal.begin(scope, draft())
  journal.complete(scope, first.idempotencyKey)
  const next = journal.begin(scope, draft())
  journal.complete(scope, first.idempotencyKey)
  assert.equal(journal.read(scope).idempotencyKey, next.idempotencyKey)
})

test('unavailable or corrupt recovery storage fails before any request can be posted', () => {
  const { storage, rows, scope } = fixture()
  rows.set(scope, '{broken')
  assert.throws(() => createLedgerPaymentJournal(storage).begin(scope, draft()), /could not be read/)
  rows.clear()
  storage.setItem = () => { throw new Error('Blocked browser storage') }
  assert.throws(() => createLedgerPaymentJournal(storage).begin(scope, draft()), /storage is unavailable/)
  assert.throws(() => createLedgerPaymentJournal(storage).begin(null, draft()), /Select a tenant/)
})

test('equivalent numeric form values retain the same fingerprint', () => {
  assert.equal(ledgerPaymentForm({ amount: '20.00', saleId: '1', method: 'cash' }, false),
    ledgerPaymentForm({ amount: 20, saleId: 1, mode: 'CASH' }, false))
})
