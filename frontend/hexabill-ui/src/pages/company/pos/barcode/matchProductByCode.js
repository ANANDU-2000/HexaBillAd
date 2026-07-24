/**
 * Exact barcode/SKU match (same rules as hardware BarcodeEngine.flush).
 * Returns the product only when exactly one match exists.
 */
export function matchProductByCode(products, code) {
  const trimmed = String(code || '').trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  const list = Array.isArray(products) ? products : []
  const matches = list.filter(
    (p) =>
      p?.barcode?.toLowerCase() === lower ||
      p?.sku?.toLowerCase() === lower
  )
  return matches.length === 1 ? matches[0] : null
}
