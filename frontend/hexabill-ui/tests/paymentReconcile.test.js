import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeReconcileLookups, PAYMENT_RECONCILE_DELAYS_MS } from '../src/utils/ledgerPaymentIntent.js'

const saved = { state: 'saved', response: { payment: { id: 1509, amount: 1485 } } }
const notSaved = { state: 'not_saved' }
const unknown = { state: 'unknown' }

test('any saved lookup confirms the payment, even after earlier misses or errors', () => {
  assert.deepEqual(summarizeReconcileLookups([notSaved, unknown, saved]), saved)
  assert.deepEqual(summarizeReconcileLookups([saved]).response.payment.id, 1509)
})

test('the saved request is released only when every lookup said not saved', () => {
  assert.deepEqual(summarizeReconcileLookups([notSaved, notSaved, notSaved]), { state: 'not_saved' })
})

test('a single error or no answer keeps the payment uncertain', () => {
  assert.deepEqual(summarizeReconcileLookups([notSaved, unknown, notSaved]), { state: 'unknown' })
  assert.deepEqual(summarizeReconcileLookups([]), { state: 'unknown' })
  assert.deepEqual(summarizeReconcileLookups([null, undefined]), { state: 'unknown' })
})

test('the reconciliation waits give an in-flight save time to finish', () => {
  assert.equal(PAYMENT_RECONCILE_DELAYS_MS.length, 3)
  assert.ok(PAYMENT_RECONCILE_DELAYS_MS.slice(1).every((ms) => ms >= 1000))
})
