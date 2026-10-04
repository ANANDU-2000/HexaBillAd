import test from 'node:test'
import assert from 'node:assert/strict'
import { syncCustomersSearchParams, readCustomersStateFromParams } from '../src/utils/customersUrl.js'

test('customers URL sync omits defaults', () => {
  const params = new URLSearchParams()
  syncCustomersSearchParams(params, {
    search: 'acme',
    activeTab: 'outstanding',
    currentPage: 3,
    editId: null
  })
  assert.equal(params.get('search'), 'acme')
  assert.equal(params.get('tab'), 'outstanding')
  assert.equal(params.get('page'), '3')
  assert.equal(readCustomersStateFromParams(params).activeTab, 'outstanding')
})
