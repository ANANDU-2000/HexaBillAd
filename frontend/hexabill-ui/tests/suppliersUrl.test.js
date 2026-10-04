import test from 'node:test'
import assert from 'node:assert/strict'
import { syncSuppliersSearchParams, readSuppliersStateFromParams } from '../src/utils/suppliersUrl.js'

test('suppliers URL sync and read', () => {
  const params = new URLSearchParams('create=1')
  syncSuppliersSearchParams(params, {
    searchTerm: 'steel',
    overdueOnly: true,
    showDeactivated: false,
    page: 2
  })
  assert.equal(params.get('q'), 'steel')
  assert.equal(params.get('overdue'), '1')
  assert.equal(params.get('page'), '2')
  assert.equal(params.get('create'), '1')
  const parsed = readSuppliersStateFromParams(params)
  assert.equal(parsed.searchTerm, 'steel')
  assert.equal(parsed.page, 2)
  assert.equal(parsed.overdueOnly, true)
})
