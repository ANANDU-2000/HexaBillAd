import { posLog } from './PosLogger'
import { scrollRowIntoCenter } from '../managers/ScrollManager'

/**
 * Deterministic UI effects — double rAF only, never setTimeout for focus/drawer.
 * Prefer getters so DOM is resolved after React commit (new row may not exist at schedule time).
 */
export function scheduleOpenDrawerFocus({ rowId, rowEl, searchEl, getRowEl, getSearchEl }) {
  posLog('effect.scheduleOpenFocus', { rowId })
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = (typeof getRowEl === 'function' ? getRowEl() : null) || rowEl
      const search = (typeof getSearchEl === 'function' ? getSearchEl() : null) || searchEl
      if (el) scrollRowIntoCenter(el, { smooth: true })
      if (search) {
        try {
          search.focus({ preventScroll: true })
          if (typeof search.select === 'function') search.select()
        } catch {
          try { search.focus() } catch { /* ignore */ }
        }
      }
      posLog('effect.openFocusDone', { rowId, hasSearch: !!search, hasRow: !!el })
    })
  })
}

export function scheduleFocusCell(elOrGet, { select = true } = {}) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = typeof elOrGet === 'function' ? elOrGet() : elOrGet
      if (!el) {
        posLog('effect.focusCell.miss', {})
        return
      }
      try {
        el.focus({ preventScroll: true })
        if (select && typeof el.select === 'function') el.select()
      } catch {
        try { el.focus() } catch { /* ignore */ }
      }
      posLog('effect.focusCell', {})
    })
  })
}
