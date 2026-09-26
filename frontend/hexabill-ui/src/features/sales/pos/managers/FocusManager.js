/**
 * Focus transitions for POS cells and drawer search.
 * Callers pass refs maps: { product, qty, unitPrice, discount, drawerSearch }.
 */
export function createFocusManager({ refs, onAfterFocus } = {}) {
  const focusEl = (el, { select = false } = {}) => {
    if (!el) return false
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          el.focus({ preventScroll: true })
          if (select && typeof el.select === 'function') el.select()
        } catch {
          try { el.focus() } catch { /* ignore */ }
        }
        onAfterFocus?.(el)
      })
    })
    return true
  }

  const focusDrawerSearch = () => {
    const el = refs?.drawerSearch?.current
    if (el && (el.offsetWidth > 0 || el.getClientRects?.().length > 0)) {
      return focusEl(el, { select: true })
    }
    const desktop = refs?.drawerSearchDesktop?.current
    const mobile = refs?.drawerSearchMobile?.current
    for (const c of [desktop, mobile]) {
      if (c && (c.offsetWidth > 0 || c.getClientRects?.().length > 0)) {
        return focusEl(c, { select: true })
      }
    }
    return false
  }

  const focusCell = (rowIndex, field) => {
    if (field === 'product' && refs?.drawerOpen) {
      return focusDrawerSearch()
    }
    const map = {
      product: refs?.product,
      qty: refs?.qty,
      unitPrice: refs?.unitPrice,
      discount: refs?.discount,
    }
    const el = map[field]?.current?.[rowIndex]
    return focusEl(el, { select: field !== 'product' })
  }

  let restoreTarget = null
  const rememberFocus = (rowIndex, field) => {
    restoreTarget = { rowIndex, field }
  }
  const restoreAfterDrawerClose = () => {
    if (!restoreTarget) return false
    const { rowIndex, field } = restoreTarget
    restoreTarget = null
    return focusCell(rowIndex, field || 'qty')
  }

  return {
    focusEl,
    focusCell,
    focusDrawerSearch,
    rememberFocus,
    restoreAfterDrawerClose,
  }
}
