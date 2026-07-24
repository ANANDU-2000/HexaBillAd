import { flushSync } from 'react-dom'
import { Cmd } from './commands'
import { usePosInteractionStore } from './invoiceStore'
import { RowPhase, transitionPhase } from './rowStateMachine'
import { createEmptyLine, findLineIndexByRowId } from './rowId'
import { scheduleFocusCell, scheduleOpenDrawerFocus } from './InteractionEffects'
import { posLog } from './PosLogger'

function commitCart(setCart, next) {
  flushSync(() => {
    setCart(next)
  })
}

/**
 * Apply product onto a cart line (VAT math mirrors PosEnterprisePage updateCartItem).
 */
export function applyProductToLine(line, product, vatPercent) {
  const unitPrice = product.sellPrice || product.costPrice || 0
  const qty = 1
  const itemDiscount = 0
  const rowTotal = qty * unitPrice - itemDiscount
  const vatAmount = Math.round(rowTotal * (vatPercent / 100) * 100) / 100
  return {
    ...line,
    productId: product.id,
    productName: product.nameEn,
    sku: product.sku,
    unitType: product.unitType || 'CRTN',
    qty,
    unitPrice,
    discount: itemDiscount,
    vatAmount,
    lineTotal: rowTotal + vatAmount,
  }
}

/**
 * Create a dispatcher bound to page adapters (cart getters/setters + DOM refs).
 */
export function createCommandDispatcher(adapters) {
  const {
    getCart,
    setCart,
    getVatPercent,
    isFormDisabled,
    getRowEl,
    getCellEl,
    getDrawerSearchEl,
    onRecordProductBilled,
    onFocusCustomer,
    onFocusPayment,
    onOpenDiscountPopup,
    onHold,
    onSave,
    onNewInvoice,
    onUndo,
    getPickerPageItems,
    getProductHighlight,
    setProductHighlight,
    bumpPickerPage,
  } = adapters

  const store = () => usePosInteractionStore.getState()

  function focusEffects(rowId) {
    return {
      rowId,
      getRowEl: () => getRowEl?.(rowId),
      getSearchEl: () => getDrawerSearchEl?.(),
    }
  }

  function focusControl(rowId, control) {
    store().setPointers({
      activeInvoiceRowId: rowId,
      editingRowId: rowId,
      focusedControl: control,
    })
    if (control === 'search') {
      scheduleOpenDrawerFocus(focusEffects(rowId))
      return
    }
    scheduleFocusCell(() => getCellEl?.(rowId, control), { select: true })
  }

  function openDrawer(rowId) {
    if (isFormDisabled?.()) return
    if (!rowId) return
    store().openDrawerForRow(rowId)
    scheduleOpenDrawerFocus(focusEffects(rowId))
  }

  function selectProduct(product) {
    if (!product) return
    const s = store()
    let rowId = s.drawerOwnerRowId || s.activeInvoiceRowId
    let cart = getCart()

    // Repair ghost owner / missing id: prefer empty line, else append
    let idx = rowId ? findLineIndexByRowId(cart, rowId) : -1
    if (idx < 0) {
      idx = cart.findIndex((l) => !l?.productId)
      if (idx >= 0) {
        rowId = cart[idx].rowId || createEmptyLine().rowId
        if (!cart[idx].rowId) {
          const repaired = [...cart]
          repaired[idx] = { ...repaired[idx], rowId }
          commitCart(setCart, repaired)
          cart = getCart()
        }
        posLog('SELECT_PRODUCT.fallbackEmpty', { rowId, idx })
      } else {
        const empty = createEmptyLine()
        commitCart(setCart, [...cart, empty])
        cart = getCart()
        rowId = empty.rowId
        idx = findLineIndexByRowId(cart, rowId)
        posLog('SELECT_PRODUCT.createdRow', { rowId })
      }
      s.setPointers({
        activeInvoiceRowId: rowId,
        editingRowId: rowId,
        drawerOwnerRowId: rowId,
      })
    }

    if (idx < 0) {
      posLog('SELECT_PRODUCT.reject', { reason: 'row missing after repair', rowId })
      s.closeDrawer()
      return
    }

    const vatPercent = getVatPercent?.() ?? 5
    const next = [...cart]
    next[idx] = applyProductToLine(next[idx], product, vatPercent)
    commitCart(setCart, next)
    onRecordProductBilled?.(product.id)
    const tr = transitionPhase(s.rowPhase, RowPhase.PRODUCT_SELECTED)
    if (tr.ok) s.setPhase(RowPhase.PRODUCT_SELECTED)
    s.closeDrawer()
    s.setPointers({
      activeInvoiceRowId: rowId,
      editingRowId: rowId,
      focusedControl: 'qty',
      rowPhase: RowPhase.EDITING_QTY,
    })
    posLog('SELECT_PRODUCT.ok', { rowId, productId: product.id })
    scheduleFocusCell(() => getCellEl?.(rowId, 'qty'), { select: true })
  }

  function commitRowAndNext() {
    if (isFormDisabled?.()) return
    const s = store()
    const currentId = s.activeInvoiceRowId || s.editingRowId
    const cart = getCart()
    let working = [...cart]

    if (currentId) {
      const idx = findLineIndexByRowId(working, currentId)
      if (idx >= 0) {
        s.setPhase(RowPhase.COMPLETED)
        posLog('COMMIT_ROW', { rowId: currentId })
      }
    }

    const empty = createEmptyLine()
    working = [...working, empty]
    commitCart(setCart, working)

    s.openDrawerForRow(empty.rowId)
    posLog('COMMIT_ROW_AND_NEXT', { newRowId: empty.rowId })
    scheduleOpenDrawerFocus(focusEffects(empty.rowId))
  }

  function moveNextField(payload = {}) {
    const s = store()
    const rowId = payload.rowId || s.activeInvoiceRowId || s.editingRowId
    if (!rowId) {
      commitRowAndNext()
      return
    }
    const control = payload.control || s.focusedControl
    const order = ['qty', 'unitPrice', 'discount']
    // If searching / no product cell focus, treat as qty start
    if (!control || control === 'search') {
      s.setPointers({ focusedControl: 'qty', rowPhase: RowPhase.EDITING_QTY, activeInvoiceRowId: rowId, editingRowId: rowId })
      scheduleFocusCell(() => getCellEl?.(rowId, 'qty'), { select: true })
      return
    }
    const i = order.indexOf(control)
    if (i >= 0 && i < order.length - 1) {
      const next = order[i + 1]
      const phase =
        next === 'qty' ? RowPhase.EDITING_QTY
          : next === 'unitPrice' ? RowPhase.EDITING_PRICE
            : RowPhase.EDITING_DISCOUNT
      s.setPointers({ focusedControl: next, rowPhase: phase, activeInvoiceRowId: rowId, editingRowId: rowId })
      scheduleFocusCell(() => getCellEl?.(rowId, next), { select: true })
      return
    }
    // On discount Enter → commit + next row + drawer
    if (control === 'discount') {
      commitRowAndNext()
      return
    }
    commitRowAndNext()
  }

  function movePrevField(payload = {}) {
    const s = store()
    const rowId = payload.rowId || s.activeInvoiceRowId || s.editingRowId
    if (!rowId) return
    const order = ['qty', 'unitPrice', 'discount']
    const control = payload.control || s.focusedControl
    const i = order.indexOf(control)
    if (i > 0) {
      const prev = order[i - 1]
      s.setPointers({ focusedControl: prev, activeInvoiceRowId: rowId, editingRowId: rowId })
      scheduleFocusCell(() => getCellEl?.(rowId, prev), { select: true })
    }
  }

  function deleteActiveRow() {
    const s = store()
    const rowId = s.activeInvoiceRowId || s.drawerOwnerRowId
    if (!rowId) return
    const cart = getCart()
    const idx = findLineIndexByRowId(cart, rowId)
    if (idx < 0) return
    commitCart(setCart, cart.filter((_, i) => i !== idx))
    s.closeDrawer()
    s.resetInteraction()
    posLog('DELETE_ROW', { rowId })
  }

  function addRow() {
    if (isFormDisabled?.()) return
    const empty = createEmptyLine()
    commitCart(setCart, [...getCart(), empty])
    store().openDrawerForRow(empty.rowId)
    scheduleOpenDrawerFocus(focusEffects(empty.rowId))
  }

  /** Append empty row for continuous scan — no ProductDrawer, pointers on new empty row. */
  function addRowSilent() {
    if (isFormDisabled?.()) return
    const empty = createEmptyLine()
    commitCart(setCart, [...getCart(), empty])
    store().closeDrawer()
    store().setPointers({
      activeInvoiceRowId: empty.rowId,
      editingRowId: empty.rowId,
      drawerOwnerRowId: null,
      focusedControl: null,
      rowPhase: RowPhase.IDLE,
    })
    posLog('ADD_ROW_SILENT', { rowId: empty.rowId })
  }

  function dispatch(cmd, payload = {}) {
    posLog('dispatch', { cmd, payload })
    if (isFormDisabled?.() && ![Cmd.SAVE].includes(cmd)) {
      // allow save while loading? no — page handlers decide
    }

    switch (cmd) {
      case Cmd.OPEN_DRAWER: {
        let rowId = payload.rowId || store().activeInvoiceRowId
        if (rowId && findLineIndexByRowId(getCart(), rowId) < 0) {
          // Ghost pointer after delete — start a fresh row
          rowId = null
        }
        if (rowId) openDrawer(rowId)
        else addRow()
        break
      }
      case Cmd.CLOSE_DRAWER:
        store().closeDrawer()
        if (store().activeInvoiceRowId) {
          focusControl(store().activeInvoiceRowId, 'qty')
        }
        break
      case Cmd.SELECT_PRODUCT:
        selectProduct(payload.product)
        break
      case Cmd.MOVE_NEXT_FIELD:
        moveNextField(payload)
        break
      case Cmd.MOVE_PREV_FIELD:
        movePrevField(payload)
        break
      case Cmd.COMMIT_ROW_AND_NEXT:
        commitRowAndNext()
        break
      case Cmd.FOCUS_CELL:
        if (payload.rowId && payload.control) focusControl(payload.rowId, payload.control)
        break
      case Cmd.FOCUS_QTY:
        focusControl(store().activeInvoiceRowId || store().editingRowId, 'qty')
        break
      case Cmd.FOCUS_PRICE:
        focusControl(store().activeInvoiceRowId || store().editingRowId, 'unitPrice')
        break
      case Cmd.FOCUS_DISCOUNT:
        focusControl(store().activeInvoiceRowId || store().editingRowId, 'discount')
        break
      case Cmd.FOCUS_CUSTOMER:
        onFocusCustomer?.()
        break
      case Cmd.FOCUS_PAYMENT:
        onFocusPayment?.()
        break
      case Cmd.OPEN_DISCOUNT_POPUP:
        onOpenDiscountPopup?.()
        break
      case Cmd.HOLD:
        onHold?.()
        break
      case Cmd.SAVE:
        onSave?.()
        break
      case Cmd.NEW_INVOICE:
        onNewInvoice?.()
        break
      case Cmd.DELETE_ROW:
        deleteActiveRow()
        break
      case Cmd.UNDO:
        onUndo?.()
        break
      case Cmd.ADD_ROW:
        addRow()
        break
      case Cmd.ADD_ROW_SILENT:
        addRowSilent()
        break
      case Cmd.HIGHLIGHT_NEXT: {
        const items = getPickerPageItems?.() || []
        if (!items.length) break
        const hi = getProductHighlight?.() ?? 0
        if (hi < items.length - 1) setProductHighlight?.(hi + 1)
        else bumpPickerPage?.(1)
        break
      }
      case Cmd.HIGHLIGHT_PREV: {
        const items = getPickerPageItems?.() || []
        if (!items.length) break
        const hi = getProductHighlight?.() ?? 0
        if (hi > 0) setProductHighlight?.(hi - 1)
        else bumpPickerPage?.(-1)
        break
      }
      default:
        posLog('dispatch.unknown', { cmd })
    }
  }

  return { dispatch, openDrawer, selectProduct, commitRowAndNext, addRow, addRowSilent, focusControl }
}
