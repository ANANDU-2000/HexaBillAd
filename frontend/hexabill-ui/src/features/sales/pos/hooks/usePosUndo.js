import { useCallback, useRef, useState } from 'react'

const MAX = 20

/** Undo stack for cart + invoice discount snapshots (Ctrl+Z). */
export function usePosUndo() {
  const stackRef = useRef([])
  const [, setVersion] = useState(0)

  const push = useCallback((snapshot) => {
    if (!snapshot) return
    const entry = {
      cart: Array.isArray(snapshot.cart) ? snapshot.cart.map((r) => ({ ...r })) : [],
      discount: snapshot.discount ?? 0,
      discountInput: snapshot.discountInput ?? '',
    }
    stackRef.current = [...stackRef.current, entry].slice(-MAX)
    setVersion((v) => v + 1)
  }, [])

  const undo = useCallback(() => {
    const stack = stackRef.current
    if (!stack.length) return null
    const last = stack[stack.length - 1]
    stackRef.current = stack.slice(0, -1)
    setVersion((v) => v + 1)
    return last
  }, [])

  const clear = useCallback(() => {
    stackRef.current = []
    setVersion((v) => v + 1)
  }, [])

  return {
    push,
    undo,
    clear,
    get canUndo() {
      return stackRef.current.length > 0
    },
    get depth() {
      return stackRef.current.length
    },
  }
}
