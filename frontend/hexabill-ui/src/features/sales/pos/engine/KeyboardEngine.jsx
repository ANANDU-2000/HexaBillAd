import { useEffect } from 'react'
import { Cmd } from './commands'
import { usePosInteractionStore } from './invoiceStore'
import { isTypingTarget } from '../managers/ShortcutMap'
import { posLog } from './PosLogger'

/**
 * Single document-level keyboard engine. Maps keys → commands.
 * Inputs should set data-pos-control and data-pos-row-id for context.
 */
export function KeyboardEngine({ enabled = true, disabled = false, dispatch, onSelectHighlighted }) {
  useEffect(() => {
    if (!enabled) return undefined

    const onKey = (e) => {
      if (disabled && e.key !== 'F9' && !((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey))) {
        return
      }

      const typing = isTypingTarget(e.target)
      const ctrl = e.ctrlKey || e.metaKey
      const alt = e.altKey
      const store = usePosInteractionStore.getState()
      const drawerOpen = store.drawerOpen
      const control = e.target?.dataset?.posControl || store.focusedControl
      const rowId = e.target?.dataset?.posRowId || store.activeInvoiceRowId

      // Sync focused control from DOM when typing in cells
      if (e.target?.dataset?.posControl && e.target?.dataset?.posRowId) {
        store.setPointers({
          focusedControl: e.target.dataset.posControl,
          activeInvoiceRowId: e.target.dataset.posRowId,
          editingRowId: e.target.dataset.posRowId,
        })
      }

      posLog('keydown', { key: e.key, control, rowId, drawerOpen, typing })

      if (e.key === 'F2') {
        e.preventDefault()
        dispatch(Cmd.FOCUS_CUSTOMER)
        return
      }
      if (e.key === 'F3') {
        e.preventDefault()
        dispatch(Cmd.OPEN_DRAWER, { rowId })
        return
      }
      if (e.key === 'F4') {
        e.preventDefault()
        dispatch(Cmd.FOCUS_PAYMENT)
        return
      }
      if (e.key === 'F6') {
        e.preventDefault()
        dispatch(Cmd.HOLD)
        return
      }
      if (e.key === 'F8') {
        e.preventDefault()
        dispatch(Cmd.OPEN_DISCOUNT_POPUP)
        return
      }
      if (e.key === 'F9') {
        e.preventDefault()
        dispatch(Cmd.SAVE)
        return
      }
      if (e.key === 'F10') {
        e.preventDefault()
        dispatch(Cmd.NEW_INVOICE)
        return
      }

      if (ctrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        dispatch(Cmd.SAVE)
        return
      }
      if (ctrl && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault()
        dispatch(Cmd.OPEN_DRAWER, { rowId })
        return
      }
      if (ctrl && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault()
        dispatch(Cmd.UNDO)
        return
      }

      if (alt && e.key === '1') {
        e.preventDefault()
        dispatch(Cmd.FOCUS_QTY)
        return
      }
      if (alt && e.key === '2') {
        e.preventDefault()
        dispatch(Cmd.FOCUS_PRICE)
        return
      }
      if (alt && e.key === '3') {
        e.preventDefault()
        dispatch(Cmd.FOCUS_DISCOUNT)
        return
      }

      if (e.key === 'Escape') {
        if (drawerOpen) {
          e.preventDefault()
          dispatch(Cmd.CLOSE_DRAWER)
        }
        return
      }

      if (e.key === 'Delete' && !typing) {
        e.preventDefault()
        dispatch(Cmd.DELETE_ROW)
        return
      }

      if (drawerOpen && e.key === 'ArrowDown') {
        e.preventDefault()
        dispatch(Cmd.HIGHLIGHT_NEXT)
        return
      }
      if (drawerOpen && e.key === 'ArrowUp') {
        e.preventDefault()
        dispatch(Cmd.HIGHLIGHT_PREV)
        return
      }

      if (e.key === 'Enter') {
        if (drawerOpen) {
          e.preventDefault()
          e.stopPropagation()
          onSelectHighlighted?.()
          return
        }
        // Cell Enter: next field or commit
        if (control === 'qty' || control === 'unitPrice' || control === 'discount') {
          e.preventDefault()
          e.stopPropagation()
          dispatch(Cmd.MOVE_NEXT_FIELD, { control, rowId })
          return
        }
        // Empty product search Enter with drawer closed → open drawer / add
        if (control === 'search' || !control) {
          e.preventDefault()
          dispatch(Cmd.OPEN_DRAWER, { rowId })
        }
        return
      }

      if (e.key === 'Tab') {
        if (drawerOpen) {
          // let drawer search keep natural tab unless we want to select
          return
        }
        if (control === 'qty' || control === 'unitPrice' || control === 'discount') {
          e.preventDefault()
          if (e.shiftKey) dispatch(Cmd.MOVE_PREV_FIELD, { control, rowId })
          else dispatch(Cmd.MOVE_NEXT_FIELD, { control, rowId })
        }
      }
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled, disabled, dispatch, onSelectHighlighted])

  return null
}
