import test from 'node:test'
import assert from 'node:assert/strict'
import { loadAllCustomerPages } from '../src/utils/loadAllPages.js'

const fake = (total) => async ({ page, pageSize }) => {
  const all = Array.from({ length: total }, (_, i) => ({ id: i + 1 }))
  const items = all.slice((page - 1) * pageSize, page * pageSize)
  return { success: true, data: { items, totalPages: Math.ceil(total / pageSize), totalCount: total } }
}

test('walks every page, not just the first 100', async () => {
  const out = await loadAllCustomerPages(fake(250))
  assert.equal(out.items.length, 250)
  assert.equal(out.complete, true)
})

test('a small list needs one request', async () => {
  let calls = 0
  const api = async (p) => { calls++; return fake(40)(p) }
  const out = await loadAllCustomerPages(api)
  assert.equal(out.items.length, 40)
  assert.equal(calls, 1)
})

test('stops at the page cap and says the list is incomplete', async () => {
  const out = await loadAllCustomerPages(fake(900), { maxPages: 3 })
  assert.equal(out.items.length, 300)
  assert.equal(out.complete, false)
})

test('a failed later page marks the list incomplete instead of throwing', async () => {
  const api = async (p) => { if (p.page === 2) throw new Error('boom'); return fake(250)(p) }
  const out = await loadAllCustomerPages(api)
  assert.equal(out.complete, false)
  assert.equal(out.items.length, 150)
})
