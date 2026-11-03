// GET response cache rules for services/api.js.
//
// Live evidence (2026-11-03, FrozenHub): every GET was cached for 30 s and a saved/edited/voided payment never cleared the
// cache, so the ledger, invoice status and balance reloaded as their PRE-payment values right after a save. Users read that
// as "payment did not save / edit did not work" and retried. Rules:
//  1. Any successful write (POST/PUT/PATCH/DELETE) clears the whole cache: the next read is always fresh.
//  2. Money and transaction reads are never cached at all (another user or tab may have just changed them).

const NEVER_CACHE = [
  '/payments', '/customers', '/sales', '/legacy', '/purchases', '/suppliers', '/returns', '/sale-returns',
  '/reports/sales-ledger', '/reports/outstanding', '/expenses', '/daily-close', '/receipts',
]

const pathOf = (url) => String(url || '').split('?')[0].replace(/^https?:\/\/[^/]+/i, '').replace(/^\/api(?=\/)/i, '')

/** True when a GET to this URL may be answered from the short-lived client cache. */
export function isCacheableGet(url) {
  const path = pathOf(url)
  if (!path) return false
  return !NEVER_CACHE.some((prefix) => path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?'))
}

/** True when a finished request changed server data, so every cached read must be dropped. */
export function invalidatesCache(method, status) {
  const m = String(method || 'GET').toUpperCase()
  const s = Number(status)
  return m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && s >= 200 && s < 300
}
