import { createContext, useContext, useMemo, useState, useCallback } from 'react'

const PosSelectionContext = createContext(null)

const empty = {
  selectedRow: null,
  focusedRow: null,
  editingRow: null,
  drawerRow: null,
  hoverRow: null,
}

export function PosSelectionProvider({ children }) {
  const [state, setState] = useState(empty)

  const setSelection = useCallback((patch) => {
    setState((prev) => ({ ...prev, ...patch }))
  }, [])

  const syncRow = useCallback((index, roles = {}) => {
    setState((prev) => {
      const next = { ...prev }
      if (roles.selected !== false) next.selectedRow = index
      if (roles.focused !== false) next.focusedRow = index
      if (roles.editing) next.editingRow = index
      if (roles.drawer != null) next.drawerRow = roles.drawer ? index : null
      if (roles.hover != null) next.hoverRow = roles.hover ? index : null
      return next
    })
  }, [])

  const clearDrawer = useCallback(() => {
    setState((prev) => ({ ...prev, drawerRow: null }))
  }, [])

  const value = useMemo(
    () => ({ ...state, setSelection, syncRow, clearDrawer }),
    [state, setSelection, syncRow, clearDrawer]
  )

  return (
    <PosSelectionContext.Provider value={value}>
      {children}
    </PosSelectionContext.Provider>
  )
}

export function usePosSelection() {
  const ctx = useContext(PosSelectionContext)
  if (!ctx) {
    return {
      ...empty,
      setSelection: () => {},
      syncRow: () => {},
      clearDrawer: () => {},
    }
  }
  return ctx
}
