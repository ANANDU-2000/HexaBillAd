import test from 'node:test'
import assert from 'node:assert/strict'
import { findPricelessCartRows } from '../src/utils/posCartRows.js'

test('a priced row with qty is not flagged', () => {
  assert.deepEqual(findPricelessCartRows([{ productId: 1, qty: 2, unitPrice: 10 }], false), [])
})

test('a row with a product and qty but no price is flagged, not dropped silently', () => {
  const rows = [{ productId: 1, productName: 'Rice', qty: 2, unitPrice: 10 }, { productId: 2, productName: 'Oil', qty: 1, unitPrice: 0 }]
  assert.deepEqual(findPricelessCartRows(rows, false).map(r => r.productName), ['Oil'])
})

test('a string quantity and a blank price are treated by value', () => {
  assert.equal(findPricelessCartRows([{ productId: 3, qty: '1', unitPrice: '' }], false).length, 1)
  assert.equal(findPricelessCartRows([{ productId: 3, qty: '0', unitPrice: '' }], false).length, 0)
})

test('an empty row (no product) is ignored', () => {
  assert.deepEqual(findPricelessCartRows([{ productId: null, qty: 1, unitPrice: 0 }], false), [])
})

test('a zero invoice may carry zero-price rows', () => {
  assert.deepEqual(findPricelessCartRows([{ productId: 1, qty: 1, unitPrice: 0 }], true), [])
})
