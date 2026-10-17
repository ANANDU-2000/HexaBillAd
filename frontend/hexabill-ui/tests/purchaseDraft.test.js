import test from 'node:test'
import assert from 'node:assert/strict'
import { savePurchaseDraft, loadPurchaseDraft, clearPurchaseDraft } from '../src/utils/purchaseDraft.js'

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) } }
const form = { supplierName: 'ACME', invoiceNo: 'INV-1', items: [{ productId: 1, qty: 2 }] }

test('draft round-trips and is scoped per tenant', () => {
  const s = memory()
  assert.equal(savePurchaseDraft(5, form, s), true)
  assert.deepEqual(loadPurchaseDraft(5, s), form)
  assert.equal(loadPurchaseDraft(6, s), null)
})
test('empty form clears instead of saving', () => {
  const s = memory()
  savePurchaseDraft(5, form, s)
  assert.equal(savePurchaseDraft(5, { supplierName: '', invoiceNo: '', items: [] }, s), false)
  assert.equal(loadPurchaseDraft(5, s), null)
})
test('expired, corrupt or cleared drafts are ignored', () => {
  const s = memory()
  s.setItem('hexabill.purchaseDraft.5', '{bad')
  assert.equal(loadPurchaseDraft(5, s), null)
  savePurchaseDraft(5, form, s)
  assert.equal(loadPurchaseDraft(5, s, -1), null)
  clearPurchaseDraft(5, s)
  assert.equal(loadPurchaseDraft(5, s), null)
})
test('unavailable storage never throws', () => {
  const broken = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') }, removeItem() { throw new Error('x') } }
  assert.equal(savePurchaseDraft(1, form, broken), false)
  assert.equal(loadPurchaseDraft(1, broken), null)
  clearPurchaseDraft(1, broken)
})
