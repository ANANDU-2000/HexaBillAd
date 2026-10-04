import test from 'node:test'
import assert from 'node:assert/strict'
import { getReturnLabel } from '../src/utils/returnNavigation.js'

test('getReturnLabel maps known return paths', () => {
  assert.equal(getReturnLabel('/pos?editId=1'), 'POS')
  assert.equal(getReturnLabel('/ledger?customerId=5'), 'Customer ledger')
  assert.equal(getReturnLabel('/customers/12'), 'Customers')
  assert.equal(getReturnLabel('/dashboard?period=week'), 'Dashboard')
  assert.equal(getReturnLabel('/branches/3?tab=customers'), 'Branch')
  assert.equal(getReturnLabel('/routes/9'), 'Route')
  assert.equal(getReturnLabel('/customers?page=2'), 'Customers')
  assert.equal(getReturnLabel('/expenses?from=2026-01-01'), 'Expenses')
  assert.equal(getReturnLabel('/unknown'), 'Previous page')
  assert.equal(getReturnLabel(''), 'Previous page')
})
