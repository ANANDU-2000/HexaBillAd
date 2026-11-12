// P-03 POS catalog: loaded once per session (memory + IndexedDB keyed by tenantId), refreshed in the background
// only when the POS is idle, searched locally through a pre-normalized index.
// Prices and stock shown here are re-validated by the server on save (unchanged).

export const CATALOG_MAX_AGE_MS = 10 * 60 * 1000 // background refresh no more often than every 10 min
export const IDLE_BEFORE_REFRESH_MS = 30 * 1000 // ... and only after 30 s without a cart edit
export const PRODUCT_SEARCH_LIMIT = 50

// ---- search index -------------------------------------------------------------------------------------------

/** Lowercase every searchable field once per catalog load, not once per keystroke. */
export function buildSearchIndex (products) {
  const index = new Array(products.length)
  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    index[i] = {
      product: p,
      key: [p.nameEn, p.nameAr, p.sku, p.barcode].map((v) => (v == null ? '' : String(v).toLowerCase())).join('\n'),
    }
  }
  return index
}

/** Same matching as the old inline filter (name / Arabic name / SKU / barcode contains the term), first `limit` hits. */
export function searchIndex (index, term, limit = PRODUCT_SEARCH_LIMIT) {
  const q = String(term || '').toLowerCase()
  if (!q.trim()) return index.slice(0, limit).map((e) => e.product)
  // Every word must match somewhere, in any order: "1000 seara" finds "FROZEN CHICKEN 1000GM SEARA".
  const tokens = q.split(/\s+/).filter(Boolean)
  const out = []
  for (let i = 0; i < index.length && out.length < limit; i++) {
    if (tokens.every((t) => index[i].key.includes(t))) out.push(index[i].product)
  }
  return out
}

// ---- refresh policy -----------------------------------------------------------------------------------------

export function isCatalogFresh (loadedAt, now = Date.now(), maxAge = CATALOG_MAX_AGE_MS) {
  return typeof loadedAt === 'number' && now - loadedAt < maxAge
}

/** Background refresh: only when the data is older than 10 min, the tab is visible, the cart has been idle 30 s. */
export function shouldBackgroundRefresh ({ now = Date.now(), loadedAt, lastCartEditAt = 0, hidden = false, editMode = false, busy = false }) {
  if (hidden || editMode || busy) return false
  if (isCatalogFresh(loadedAt, now)) return false
  return now - lastCartEditAt >= IDLE_BEFORE_REFRESH_MS
}

// ---- memory + IndexedDB cache keyed by tenant ---------------------------------------------------------------

const memory = new Map() // key -> { items, loadedAt }
const DB_NAME = 'hexabill-pos'
const STORE = 'catalog'

const keyFor = (kind, tenantId) => `${kind}:${tenantId}`

function openDb () {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE) }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch (_) { resolve(null) }
  })
}

function idbGet (key) {
  return openDb().then((db) => new Promise((resolve) => {
    if (!db) return resolve(null)
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      req.onsuccess = () => { db.close(); resolve(req.result || null) }
      req.onerror = () => { db.close(); resolve(null) }
    } catch (_) { resolve(null) }
  }))
}

function idbPut (key, value) {
  return openDb().then((db) => new Promise((resolve) => {
    if (!db) return resolve()
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); resolve() }
    } catch (_) { resolve() }
  }))
}

/** Products for a tenant: memory first, then IndexedDB. Returns { items, loadedAt } or null. Never throws. */
export async function readProductCatalog (tenantId) {
  if (tenantId == null) return null
  const key = keyFor('products', tenantId)
  const hit = memory.get(key)
  if (hit) return hit
  const stored = await idbGet(key)
  if (stored && Array.isArray(stored.items) && stored.tenantId === tenantId) {
    const entry = { items: stored.items, loadedAt: stored.loadedAt }
    memory.set(key, entry)
    return entry
  }
  return null
}

export async function writeProductCatalog (tenantId, items) {
  if (tenantId == null) return
  const key = keyFor('products', tenantId)
  const entry = { items, loadedAt: Date.now() }
  memory.set(key, entry)
  await idbPut(key, { ...entry, tenantId })
}

// Customers carry live balances, so they are cached in memory only (never persisted) and keyed by scope.
export function readCustomerCache (tenantId, scope) {
  return memory.get(keyFor(`customers:${scope}`, tenantId)) || null
}

export function writeCustomerCache (tenantId, scope, items) {
  memory.set(keyFor(`customers:${scope}`, tenantId), { items, loadedAt: Date.now() })
}

export function clearCatalogMemory () {
  memory.clear()
}
