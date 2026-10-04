/** Session-scoped ledger list scroll (per tenant, user, customer, tab). */
export function customerLedgerScrollKey ({ tenantId, userId, customerId, tab }) {
  const t = tenantId ?? 0
  const u = userId ?? 0
  const c = customerId == null ? 'none' : String(customerId)
  const tabPart = tab || 'ledger'
  return `hexabill.ledgerScroll.${t}.${u}.${c}.${tabPart}`
}

export function readCustomerLedgerScroll (key) {
  try {
    const raw = sessionStorage.getItem(key)
    if (raw == null) return 0
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

export function writeCustomerLedgerScroll (key, scrollTop) {
  try {
    if (!key || scrollTop == null || scrollTop < 0) return
    sessionStorage.setItem(key, String(Math.round(scrollTop)))
  } catch {
    /* blocked storage */
  }
}
