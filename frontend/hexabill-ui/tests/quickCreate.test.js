import test from 'node:test'
import assert from 'node:assert/strict'
import { getQuickCreateActions, shouldShowBottomNav, isFocusedRoute } from '../src/navigation/quickCreate.js'

const ids = (user) => getQuickCreateActions(user).map((a) => a.id)

test('owners see every quick-create action; nobody signed out sees any', () => {
  assert.deepEqual(ids({ role: 'Owner' }), ['sale', 'payment', 'expense', 'purchase', 'supplierPayment', 'customer', 'product'])
  assert.deepEqual(ids(null), [])
})

test('staff only see actions for pages they can open (UI filter; server still authorizes)', () => {
  assert.deepEqual(ids({ role: 'Staff', pageAccess: 'pos,customers' }), ['sale', 'customer'])
  // Purchases are never staff pages, even with no explicit page list.
  assert.ok(!ids({ role: 'Staff' }).includes('purchase'))
  assert.ok(!ids({ role: 'Staff' }).includes('supplierPayment'))
})

test('bottom nav hides on focused workspaces, dialogs and the on-screen keyboard (UX-S01)', () => {
  assert.equal(shouldShowBottomNav({ pathname: '/dashboard' }), true)
  assert.equal(shouldShowBottomNav({ pathname: '/customers' }), true)
  assert.equal(shouldShowBottomNav({ pathname: '/pos' }), false)
  assert.equal(shouldShowBottomNav({ pathname: '/quotations/new' }), false)
  assert.equal(shouldShowBottomNav({ pathname: '/returns/create' }), false)
  assert.equal(shouldShowBottomNav({ pathname: '/customers', overlayOpen: true }), false)
  assert.equal(shouldShowBottomNav({ pathname: '/customers', keyboardOpen: true }), false)
  assert.equal(isFocusedRoute('/pos/'), true)
  assert.equal(isFocusedRoute('/products/12'), false)
})
