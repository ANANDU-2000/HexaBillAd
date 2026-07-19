import { useEffect } from 'react'
import { isTypingTarget, POS_SHORTCUTS } from './ShortcutMap'

/**
 * Document-level POS keyboard engine (capture phase).
 * Handlers are refs/callbacks so listeners stay stable.
 */
export function KeyboardManager({
  enabled = true,
  loading = false,
  handlers = {},
}) {
  useEffect(() => {
    if (!enabled) return undefined

    const onKey = (e) => {
      if (loading) {
        const saveOnly =
          e.key === POS_SHORTCUTS.SAVE ||
          ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey))
        if (!saveOnly) return
      }

      const typing = isTypingTarget(e.target)
      const ctrl = e.ctrlKey || e.metaKey
      const alt = e.altKey

      // F-keys always
      if (e.key === 'F2') {
        e.preventDefault()
        handlers.onCustomer?.()
        return
      }
      if (e.key === 'F3') {
        e.preventDefault()
        handlers.onProductSearch?.()
        return
      }
      if (e.key === 'F4') {
        e.preventDefault()
        handlers.onPayment?.()
        return
      }
      if (e.key === 'F6') {
        e.preventDefault()
        handlers.onHold?.()
        return
      }
      if (e.key === 'F8') {
        e.preventDefault()
        handlers.onDiscount?.()
        return
      }
      if (e.key === 'F9') {
        e.preventDefault()
        handlers.onSave?.()
        return
      }
      if (e.key === 'F10') {
        e.preventDefault()
        handlers.onNew?.()
        return
      }

      if (ctrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        handlers.onSave?.()
        return
      }
      if (ctrl && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault()
        handlers.onProductSearch?.()
        return
      }
      if (ctrl && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault()
        handlers.onUndo?.()
        return
      }

      if (alt && e.key === '1') {
        e.preventDefault()
        handlers.onFocusQty?.()
        return
      }
      if (alt && e.key === '2') {
        e.preventDefault()
        handlers.onFocusPrice?.()
        return
      }
      if (alt && e.key === '3') {
        e.preventDefault()
        handlers.onFocusDiscount?.()
        return
      }

      if (e.key === 'Escape') {
        handlers.onEscape?.(e)
        return
      }

      if (e.key === 'Delete' && !typing) {
        e.preventDefault()
        handlers.onDeleteRow?.()
      }
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled, loading, handlers])

  return null
}
