/** Invoice row interaction phases (deterministic). */
export const RowPhase = {
  IDLE: 'IDLE',
  SEARCHING: 'SEARCHING',
  PRODUCT_SELECTED: 'PRODUCT_SELECTED',
  EDITING_QTY: 'EDITING_QTY',
  EDITING_PRICE: 'EDITING_PRICE',
  EDITING_DISCOUNT: 'EDITING_DISCOUNT',
  COMPLETED: 'COMPLETED',
}

const ALLOWED = {
  [RowPhase.IDLE]: [RowPhase.SEARCHING, RowPhase.IDLE],
  [RowPhase.SEARCHING]: [RowPhase.PRODUCT_SELECTED, RowPhase.IDLE, RowPhase.SEARCHING],
  [RowPhase.PRODUCT_SELECTED]: [RowPhase.EDITING_QTY],
  [RowPhase.EDITING_QTY]: [RowPhase.EDITING_PRICE, RowPhase.EDITING_DISCOUNT, RowPhase.SEARCHING],
  [RowPhase.EDITING_PRICE]: [RowPhase.EDITING_DISCOUNT, RowPhase.EDITING_QTY, RowPhase.SEARCHING],
  [RowPhase.EDITING_DISCOUNT]: [RowPhase.COMPLETED, RowPhase.EDITING_PRICE, RowPhase.SEARCHING],
  [RowPhase.COMPLETED]: [RowPhase.SEARCHING, RowPhase.IDLE],
}

export function canTransition(from, to) {
  if (from === to) return true
  const next = ALLOWED[from]
  return Array.isArray(next) && next.includes(to)
}

export function transitionPhase(from, to) {
  if (!canTransition(from, to)) {
    return { ok: false, phase: from, reason: `illegal ${from} → ${to}` }
  }
  return { ok: true, phase: to }
}
