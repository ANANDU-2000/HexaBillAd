import test from 'node:test'
import assert from 'node:assert/strict'
import { loadAllProductPages, PRODUCT_PAGE_SIZE } from '../src/utils/loadAllProductPages.js'

// Fake GET /products: honours page and pageSize exactly like ProductService.GetProductsAsync (no server cap).
const fakeProducts = (total, { calls = [] } = {}) => async ({ page, pageSize }) => {
  calls.push({ page, pageSize })
  const all = Array.from({ length: total }, (_, i) => ({ id: i + 1, nameEn: `P${i + 1}` }))
  const items = all.slice((page - 1) * pageSize, page * pageSize)
  return { success: true, data: { items, page, pageSize, totalCount: total, totalPages: Math.ceil(total / pageSize) } }
}

test('loads every active product when the list is bigger than one page (354 = Gulf Harvest live count)', async () => {
  const out = await loadAllProductPages(fakeProducts(354))
  assert.equal(out.items.length, 354)
  assert.equal(out.totalCount, 354)
  assert.equal(out.complete, true)
  assert.equal(new Set(out.items.map(p => p.id)).size, 354)
})

test('asks for PRODUCT_PAGE_SIZE rows per request, and a small list needs one request', async () => {
  const calls = []
  const out = await loadAllProductPages(fakeProducts(40, { calls }))
  assert.equal(out.items.length, 40)
  assert.deepEqual(calls, [{ page: 1, pageSize: PRODUCT_PAGE_SIZE }])
})

test('products that appear on two pages are kept once (ties on NameEn can repeat across pages)', async () => {
  const pages = {
    1: [{ id: 1 }, { id: 2 }],
    2: [{ id: 2 }, { id: 3 }],
  }
  const api = async ({ page }) => ({ success: true, data: { items: pages[page], totalCount: 3, totalPages: 2 } })
  const out = await loadAllProductPages(api, { pageSize: 2 })
  assert.deepEqual(out.items.map(p => p.id), [1, 2, 3])
})

test('stops at the page cap and reports the list as incomplete', async () => {
  const out = await loadAllProductPages(fakeProducts(6000), { pageSize: 200, maxPages: 3 })
  assert.equal(out.items.length, 600)
  assert.equal(out.totalCount, 6000)
  assert.equal(out.complete, false)
})

test('a failed page is an error, not a silently shorter product list', async () => {
  const api = async ({ page }) => (page === 1
    ? { success: true, data: { items: [{ id: 1 }], totalCount: 300, totalPages: 2 } }
    : { success: false, message: 'Server unavailable' })
  await assert.rejects(() => loadAllProductPages(api, { pageSize: 200 }), /Server unavailable/)
})
