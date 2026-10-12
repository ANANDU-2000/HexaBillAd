// The server accepts SKUs made of letters, numbers, dots, dashes and underscores (max 50).
// Staff naturally type "BEEF 250gm", so turn what they typed into a valid SKU instead of rejecting it.
export const SKU_MAX_LENGTH = 50

export function normalizeSku (value) {
  return String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
    .slice(0, SKU_MAX_LENGTH)
    .replace(/[-._]+$/g, '')
}

// Suggest a SKU from the English product name; empty when the name has no usable letters/digits (e.g. Arabic only).
export function suggestSkuFromName (name) {
  return normalizeSku(name).toUpperCase()
}
