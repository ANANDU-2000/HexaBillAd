/** Canonical POS shortcut map (document-level). */
export const POS_SHORTCUTS = {
  CUSTOMER: 'F2',
  PRODUCT_SEARCH: 'F3',
  PAYMENT: 'F4',
  HOLD: 'F6',
  DISCOUNT: 'F8',
  SAVE: 'F9',
  NEW: 'F10',
  OPEN_SEARCH_CTRL: 'l',
  SAVE_CTRL: 's',
  UNDO_CTRL: 'z',
  QTY_ALT: '1',
  PRICE_ALT: '2',
  DISCOUNT_ALT: '3',
}

export function isTypingTarget(el) {
  if (!el || !(el instanceof Element)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}
