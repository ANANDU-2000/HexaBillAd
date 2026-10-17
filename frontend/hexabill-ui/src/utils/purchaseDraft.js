// Keeps an unsaved purchase voucher across a route crash or reload. Per-tab, per-tenant; never holds secrets.
const keyFor = (tenantId) => `hexabill.purchaseDraft.${tenantId || 'default'}`

const hasContent = (form) =>
  Boolean(form && (form.supplierName?.trim() || form.invoiceNo?.trim() || (Array.isArray(form.items) && form.items.length > 0)))

export const savePurchaseDraft = (tenantId, form, storage = globalThis.sessionStorage) => {
  try {
    if (!storage) return false
    if (!hasContent(form)) { storage.removeItem(keyFor(tenantId)); return false }
    storage.setItem(keyFor(tenantId), JSON.stringify({ savedAt: Date.now(), form }))
    return true
  } catch { return false }
}

export const loadPurchaseDraft = (tenantId, storage = globalThis.sessionStorage, maxAgeMs = 12 * 60 * 60 * 1000) => {
  try {
    const raw = storage?.getItem(keyFor(tenantId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.form || !Array.isArray(parsed.form.items)) return null
    if (Date.now() - Number(parsed.savedAt || 0) > maxAgeMs) return null
    return hasContent(parsed.form) ? parsed.form : null
  } catch { return null }
}

export const clearPurchaseDraft = (tenantId, storage = globalThis.sessionStorage) => {
  try { storage?.removeItem(keyFor(tenantId)) } catch { /* storage unavailable */ }
}
