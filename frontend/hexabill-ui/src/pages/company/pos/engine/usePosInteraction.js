import { createElement, useCallback, useEffect, useMemo, useRef } from 'react'
import { createCommandDispatcher } from './CommandDispatcher'
import { Cmd } from './commands'
import { usePosInteractionStore } from './invoiceStore'
import { ensureCartRowIds, findLineIndexByRowId } from './rowId'
import { KeyboardEngine } from './KeyboardEngine'
import { posLog } from './PosLogger'

/**
 * Wire POS interaction engine into the page.
 * Returns dispatcher helpers + store snapshot + KeyboardEngine element.
 */
export function usePosInteraction({
  cart,
  setCart,
  vatPercent,
  isFormDisabled,
  drawerSearchRef,
  rowElRefs, // Map rowId -> element (or ref object)
  qtyInputRefsByRowId,
  unitPriceInputRefsByRowId,
  discountInputRefsByRowId,
  getPickerPageItems,
  productHighlight,
  setProductHighlight,
  bumpPickerPage,
  onRecordProductBilled,
  onFocusCustomer,
  onFocusPayment,
  onOpenDiscountPopup,
  onHold,
  onSave,
  onNewInvoice,
  onUndo,
}) {
  const drawerOpen = usePosInteractionStore((s) => s.drawerOpen)
  const drawerOwnerRowId = usePosInteractionStore((s) => s.drawerOwnerRowId)
  const activeInvoiceRowId = usePosInteractionStore((s) => s.activeInvoiceRowId)
  const rowPhase = usePosInteractionStore((s) => s.rowPhase)
  const focusedControl = usePosInteractionStore((s) => s.focusedControl)

  const cartRef = useRef(cart)
  cartRef.current = cart

  // Ensure rowIds whenever cart changes from outside
  useEffect(() => {
    const ensured = ensureCartRowIds(cart)
    const needs = ensured.some((l, i) => l.rowId !== cart[i]?.rowId)
    if (needs) {
      posLog('ensureRowIds', { count: ensured.length })
      setCart(ensured)
    }
  }, [cart, setCart])

  const adapters = useMemo(() => ({
    getCart: () => cartRef.current,
    setCart: (next) => setCart(ensureCartRowIds(next)),
    getVatPercent: () => vatPercent,
    isFormDisabled: () => isFormDisabled,
    getRowEl: (rowId) => rowElRefs?.current?.[rowId] || null,
    getCellEl: (rowId, control) => {
      if (!rowId || !control) return null
      // Prefer visible DOM node (desktop table wins over md:hidden mobile cards)
      try {
        const nodes = document.querySelectorAll(
          `[data-pos-control="${control}"][data-pos-row-id="${rowId}"]`
        )
        for (const el of nodes) {
          if (!(el instanceof HTMLElement)) continue
          // offsetParent null when display:none (mobile cards on md+)
          if (el.offsetParent != null || el === document.activeElement) return el
        }
        if (nodes[0] instanceof HTMLElement) return nodes[0]
      } catch { /* ignore */ }
      const map =
        control === 'qty' ? qtyInputRefsByRowId
          : control === 'unitPrice' ? unitPriceInputRefsByRowId
            : control === 'discount' ? discountInputRefsByRowId
              : null
      return map?.current?.[rowId] || null
    },
    getDrawerSearchEl: () => drawerSearchRef?.current || null,
    onRecordProductBilled,
    onFocusCustomer,
    onFocusPayment,
    onOpenDiscountPopup,
    onHold,
    onSave,
    onNewInvoice,
    onUndo,
    getPickerPageItems,
    getProductHighlight: () => productHighlight,
    setProductHighlight,
    bumpPickerPage,
  }), [
    vatPercent, isFormDisabled, rowElRefs, qtyInputRefsByRowId, unitPriceInputRefsByRowId,
    discountInputRefsByRowId, drawerSearchRef, onRecordProductBilled, onFocusCustomer,
    onFocusPayment, onOpenDiscountPopup, onHold, onSave, onNewInvoice, onUndo,
    getPickerPageItems, productHighlight, setProductHighlight, bumpPickerPage, setCart,
  ])

  const dispatcherRef = useRef(null)
  if (!dispatcherRef.current) {
    dispatcherRef.current = createCommandDispatcher(adapters)
  }
  // refresh adapters each render
  dispatcherRef.current = createCommandDispatcher(adapters)

  const dispatch = useCallback((cmd, payload) => {
    dispatcherRef.current.dispatch(cmd, payload)
  }, [])

  const onSelectHighlighted = useCallback(() => {
    const items = getPickerPageItems?.() || []
    const hi = productHighlight ?? 0
    const product = items[Math.min(hi, items.length - 1)] || items[0]
    if (product) dispatch(Cmd.SELECT_PRODUCT, { product })
  }, [getPickerPageItems, productHighlight, dispatch])

  const engine = createElement(KeyboardEngine, {
    enabled: true,
    disabled: isFormDisabled,
    dispatch,
    onSelectHighlighted,
  })

  return {
    dispatch,
    Cmd,
    engine,
    drawerOpen,
    drawerOwnerRowId,
    activeInvoiceRowId,
    rowPhase,
    focusedControl,
    findLineIndexByRowId: (rowId) => findLineIndexByRowId(cart, rowId),
    openDrawerForRow: (rowId) => dispatch(Cmd.OPEN_DRAWER, { rowId }),
    selectProductForOwner: (product) => dispatch(Cmd.SELECT_PRODUCT, { product }),
    addRow: () => dispatch(Cmd.ADD_ROW),
    commitRowAndNext: () => dispatch(Cmd.COMMIT_ROW_AND_NEXT),
  }
}
