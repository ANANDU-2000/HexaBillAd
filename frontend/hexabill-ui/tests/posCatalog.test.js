import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSearchIndex, searchIndex, isCatalogFresh, shouldBackgroundRefresh,
  readProductCatalog, writeProductCatalog, readCustomerCache, writeCustomerCache, clearCatalogMemory,
  CATALOG_MAX_AGE_MS, IDLE_BEFORE_REFRESH_MS,
} from '../src/utils/posCatalog.js'

const products = [
  { id: 1, nameEn: 'Basmati Rice 5kg', nameAr: 'رز', sku: 'RICE-5', barcode: '6291001' },
  { id: 2, nameEn: 'Olive Oil', nameAr: null, sku: 'OIL-1', barcode: null },
  { id: 3, nameEn: 'Sugar', sku: 'SUG-1' },
]

test('search matches name, Arabic name, sku and barcode case-insensitively', () => {
  const idx = buildSearchIndex(products)
  assert.deepEqual(searchIndex(idx, 'RICE').map((p) => p.id), [1])
  assert.deepEqual(searchIndex(idx, 'رز').map((p) => p.id), [1])
  assert.deepEqual(searchIndex(idx, 'oil-1').map((p) => p.id), [2])
  assert.deepEqual(searchIndex(idx, '6291').map((p) => p.id), [1])
  assert.deepEqual(searchIndex(idx, 'zzz'), [])
})

test('empty term returns the first N products; limit is honoured', () => {
  const idx = buildSearchIndex(products)
  assert.equal(searchIndex(idx, '  ', 2).length, 2)
  assert.equal(searchIndex(idx, 'i', 1).length, 1)
})

test('search over 5,000 products takes well under 100 ms', () => {
  const big = Array.from({ length: 5000 }, (_, i) => ({ id: i, nameEn: `Product ${i} Name`, sku: `SKU-${i}`, barcode: `${600000 + i}` }))
  const idx = buildSearchIndex(big)
  const t0 = performance.now()
  for (let i = 0; i < 20; i++) searchIndex(idx, 'zzz-no-match')
  assert.ok((performance.now() - t0) / 20 < 100)
})

test('background refresh only when stale, idle 30 s, visible, not editing', () => {
  const now = 1_000_000_000
  const stale = now - CATALOG_MAX_AGE_MS - 1
  const idle = now - IDLE_BEFORE_REFRESH_MS - 1
  assert.equal(shouldBackgroundRefresh({ now, loadedAt: now - 1000, lastCartEditAt: idle }), false) // fresh
  assert.equal(shouldBackgroundRefresh({ now, loadedAt: stale, lastCartEditAt: now - 5000 }), false) // cart edited 5 s ago
  assert.equal(shouldBackgroundRefresh({ now, loadedAt: stale, lastCartEditAt: idle }), true)
  assert.equal(shouldBackgroundRefresh({ now, loadedAt: stale, lastCartEditAt: idle, hidden: true }), false)
  assert.equal(shouldBackgroundRefresh({ now, loadedAt: stale, lastCartEditAt: idle, editMode: true }), false)
  assert.equal(shouldBackgroundRefresh({ now, loadedAt: stale, lastCartEditAt: idle, busy: true }), false)
  assert.equal(isCatalogFresh(undefined), false)
})

test('catalog cache is keyed by tenant and never leaks across tenants', async () => {
  clearCatalogMemory()
  await writeProductCatalog(7, [{ id: 1 }])
  assert.equal((await readProductCatalog(7)).items.length, 1)
  assert.equal(await readProductCatalog(8), null)
  assert.equal(await readProductCatalog(null), null)
  writeCustomerCache(7, 'u1::', [{ id: 9 }])
  assert.equal(readCustomerCache(7, 'u1::').items[0].id, 9)
  assert.equal(readCustomerCache(7, 'u2::'), null)
  assert.equal(readCustomerCache(8, 'u1::'), null)
})
