import test from 'node:test'
import assert from 'node:assert/strict'
import { createSaleSubmitKeys } from '../src/features/sales/pos/saleSubmitKey.js'

const sale = { customerId: 1, items: [{ productId: 7, qty: 2, unitPrice: 10 }], payments: [] }

test('retrying the same sale reuses the same external reference (PS-007)', () => {
  const keys = createSaleSubmitKeys(() => 'k-' + Math.random())
  const first = keys.keyFor(sale)
  assert.equal(keys.keyFor({ ...sale, items: [...sale.items] }), first)
})

test('a changed sale gets a new reference; success and reset clear it', () => {
  let n = 0
  const keys = createSaleSubmitKeys(() => `k${++n}`)
  const a = keys.keyFor(sale)
  const b = keys.keyFor({ ...sale, items: [{ productId: 7, qty: 3, unitPrice: 10 }] })
  assert.notEqual(a, b)
  keys.reset()
  assert.notEqual(keys.keyFor({ ...sale, items: [{ productId: 7, qty: 3, unitPrice: 10 }] }), b)
})
