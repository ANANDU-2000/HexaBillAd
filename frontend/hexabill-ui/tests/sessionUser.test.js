import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeValidatedUser, userFromToken } from '../src/auth/sessionUser.js'

const token = (claims) => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`

test('validation preserves tenant and company while refreshing camelCase role and permissions', () => {
  const result = mergeValidatedUser({ id: 1, role: 'Owner', tenantId: 10, companyName: 'Company A',
    assignedBranchIds: [1], assignedRouteIds: [2], mustChangePassword: true },
  { userId: 1, role: 'Staff', name: 'Updated name', pageAccess: ['pos'],
    assignedBranchIds: [], assignedRouteIds: [], mustChangePassword: false }, token({ sub: '1', tid: '10' }))
  assert.equal(result.tenantId, 10)
  assert.equal(result.companyName, 'Company A')
  assert.equal(result.role, 'Staff')
  assert.equal(result.name, 'Updated name')
  assert.deepEqual(result.pageAccess, ['pos'])
  assert.deepEqual(result.assignedBranchIds, [])
  assert.deepEqual(result.assignedRouteIds, [])
  assert.equal(result.mustChangePassword, false)
})

test('validation can recover a missing browser tenant from the session token', () => {
  const result = mergeValidatedUser({ id: 5 }, { UserId: 5, Role: 'Owner', Name: 'Owner' }, token({ sub: '5', tid: '11' }))
  assert.equal(result.tenantId, 11)
  assert.equal(result.role, 'Owner')
})

test('validation retains read-only support restrictions', () => {
  const result = mergeValidatedUser({ id: 5, tenantId: 11, supportSession: 7, supportReadOnly: true },
    { role: 'Owner' }, token({ sub: '5', tid: '11' }))
  assert.equal(result.supportSession, 7)
  assert.equal(result.supportReadOnly, true)
})

test('token metadata handles multilingual names and does not invent owner permissions', () => {
  const user = userFromToken(token({ sub: '6', tid: '12', name: 'مالك മലയാളം', support_readonly: 'true' }))
  assert.equal(user.name, 'مالك മലയാളം')
  assert.equal(user.tenantId, 12)
  assert.equal(user.role, 'Staff')
  assert.equal(user.supportReadOnly, true)
  assert.equal(userFromToken('bad-token'), null)
  assert.equal(userFromToken(null), null)
})
