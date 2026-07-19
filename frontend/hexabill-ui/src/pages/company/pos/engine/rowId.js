/** Stable invoice line identity — never use array index for ownership. */
export function createRowId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export function ensureRowId(line) {
  if (line?.rowId) return line
  return { ...line, rowId: createRowId() }
}

export function ensureCartRowIds(cart) {
  if (!Array.isArray(cart)) return []
  return cart.map((line) => ensureRowId(line || {}))
}

export function findLineIndexByRowId(cart, rowId) {
  if (rowId == null) return -1
  return cart.findIndex((l) => l?.rowId === rowId)
}

export function createEmptyLine() {
  return {
    rowId: createRowId(),
    productId: null,
    productName: '',
    sku: '',
    unitType: '',
    qty: '',
    unitPrice: '',
    discount: 0,
    vatAmount: 0,
    lineTotal: 0,
  }
}
