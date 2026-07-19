import { create } from 'zustand'
import { RowPhase } from './rowStateMachine'
import { posLog } from './PosLogger'

/**
 * Interaction pointers only — cart lines stay in page React state but always carry rowId.
 */
export const usePosInteractionStore = create((set, get) => ({
  activeInvoiceRowId: null,
  editingRowId: null,
  drawerOwnerRowId: null,
  focusedControl: null, // 'search' | 'qty' | 'unitPrice' | 'discount' | null
  rowPhase: RowPhase.IDLE,
  pendingSelection: null, // { rowId, product } | null
  productHighlight: 0,
  drawerOpen: false,

  setPointers: (patch) => {
    set((s) => ({ ...s, ...patch }))
    posLog('pointers', { ...get() })
  },

  setPhase: (phase) => {
    const prev = get().rowPhase
    set({ rowPhase: phase })
    posLog('phase', { from: prev, to: phase })
  },

  openDrawerForRow: (rowId) => {
    set({
      drawerOwnerRowId: rowId,
      activeInvoiceRowId: rowId,
      editingRowId: rowId,
      drawerOpen: true,
      rowPhase: RowPhase.SEARCHING,
      focusedControl: 'search',
      productHighlight: 0,
      pendingSelection: null,
    })
    posLog('drawerOpen', { rowId })
  },

  closeDrawer: () => {
    const owner = get().drawerOwnerRowId
    set({
      drawerOpen: false,
      drawerOwnerRowId: null,
      pendingSelection: null,
    })
    posLog('drawerClose', { wasOwner: owner })
  },

  resetInteraction: () => {
    set({
      activeInvoiceRowId: null,
      editingRowId: null,
      drawerOwnerRowId: null,
      focusedControl: null,
      rowPhase: RowPhase.IDLE,
      pendingSelection: null,
      productHighlight: 0,
      drawerOpen: false,
    })
    posLog('resetInteraction', {})
  },
}))
