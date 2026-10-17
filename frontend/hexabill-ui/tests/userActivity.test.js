import test from 'node:test'
import assert from 'node:assert/strict'
import { loadUserActivity } from '../src/utils/userActivity.js'

test('a failed request is an error, not an empty list', async () => {
  const r = await loadUserActivity(async () => { throw { response: { status: 404, data: { message: 'Resource not found' } } } })
  assert.equal(r.status, 'error')
  assert.equal(r.message, 'Resource not found')
  assert.deepEqual(r.logs, [])
})

test('a lost response is an error with a fallback message', async () => {
  const r = await loadUserActivity(async () => { throw { message: 'Network Error' } })
  assert.equal(r.status, 'error')
  assert.match(r.message, /could not be loaded/)
})

test('success with no rows is ok and empty', async () => {
  const r = await loadUserActivity(async () => ({ success: true, data: [] }))
  assert.deepEqual(r, { status: 'ok', logs: [], message: '' })
})

test('success=false payload is an error', async () => {
  const r = await loadUserActivity(async () => ({ success: false, message: 'User not found' }))
  assert.equal(r.status, 'error')
  assert.equal(r.message, 'User not found')
})
