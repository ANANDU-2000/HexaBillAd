import test from 'node:test'
import assert from 'node:assert/strict'
import { syncProductsSearchParams, readProductsStateFromParams } from '../src/utils/productsUrl.js'

test('products URL sync omits defaults and preserves barcode', () => {
  const params = new URLSearchParams('barcode=123')
  syncProductsSearchParams(params, {
    search: 'rice',
    activeTab: 'lowStock',
    currentPage: 2,
    categoryId: '5'
  })
  assert.equal(params.get('barcode'), '123')
  assert.equal(params.get('search'), 'rice')
  assert.equal(params.get('tab'), 'lowStock')
  assert.equal(readProductsStateFromParams(params).currentPage, 2)
})
