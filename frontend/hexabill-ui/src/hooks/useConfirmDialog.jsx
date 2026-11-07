import { useCallback, useEffect, useRef, useState } from 'react'
import ConfirmDangerModal from '../components/ConfirmDangerModal'

/**
 * Promise-based replacement for window.confirm() (UX-A03).
 *
 *   const [askConfirm, confirmDialog] = useConfirmDialog()
 *   if (!(await askConfirm({ title: 'Delete QT-001?', message: 'This cannot be undone.', confirmLabel: 'Delete' }))) return
 *   ...
 *   return (<div>... {confirmDialog}</div>)
 *
 * Resolves true on confirm and false on Cancel, the close button, or unmount. Only one dialog is open at a time;
 * a second call while one is open resolves the first with false.
 */
export function useConfirmDialog () {
  const [request, setRequest] = useState(null)
  const resolverRef = useRef(null)

  const settle = useCallback((value) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    if (resolve) resolve(value)
  }, [])

  const askConfirm = useCallback((options = {}) => new Promise((resolve) => {
    settle(false)
    resolverRef.current = resolve
    setRequest(options)
  }), [settle])

  // A page that unmounts with a dialog open must not leave its caller awaiting forever.
  useEffect(() => () => settle(false), [settle])

  const dialog = request
    ? (
      <ConfirmDangerModal
        isOpen
        title={request.title}
        message={request.message}
        confirmLabel={request.confirmLabel || 'Confirm'}
        requireTypedText={request.requireTypedText}
        onConfirm={() => settle(true)}
        onClose={() => { settle(false); setRequest(null) }}
      />
      )
    : null

  return [askConfirm, dialog]
}

export default useConfirmDialog
