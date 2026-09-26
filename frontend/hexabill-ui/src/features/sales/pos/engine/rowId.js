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

/** True when line has no product (placeholder / search row). */
export function isEmptyCartLine(line) {
  return !line?.productId
}

/**
 * Keep all product lines + at most one trailing empty row.
 * @param {object[]} cart
 * @param {{ ensureOne?: boolean }} [opts] - if true and no empty exists, append one
 */
export function ensureAtMostOneTrailingEmptyRow(cart, { ensureOne = false } = {}) {
  const list = Array.isArray(cart) ? cart : []
  const filled = list.filter((l) => l?.productId)
  const empties = list.filter((l) => !l?.productId)
  if (empties.length > 0) {
    return ensureCartRowIds([...filled, empties[0]])
  }
  if (ensureOne) {
    return ensureCartRowIds([...filled, createEmptyLine()])
  }
  return ensureCartRowIds(filled)
}

