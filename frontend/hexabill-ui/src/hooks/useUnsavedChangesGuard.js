import { useContext, useEffect } from 'react'
import { UNSAFE_NavigationContext as NavigationContext } from 'react-router-dom'
import { useConfirmDialog } from './useConfirmDialog'

const DEFAULT_MESSAGE = 'You have unsaved changes. Leave this page and lose them?'

/**
 * Warns before unsaved work is lost (UX-A03b). Closing or reloading the tab uses the browser prompt; clicking another
 * link inside the app (a push) opens the app's own confirm dialog (no native window.confirm).
 * The app uses BrowserRouter, which has no useBlocker, so the guard wraps push.
 * A replace is left alone because the editors use it to move to the saved record right after a successful save.
 *
 * Returns the dialog element. The page must render it, e.g. `{unsavedDialog}` inside its root.
 *
 *   const unsavedDialog = useUnsavedChangesGuard(isDirty)
 *   return (<div>... {unsavedDialog}</div>)
 */
export function useUnsavedChangesGuard (isDirty, message = DEFAULT_MESSAGE) {
  const { navigator } = useContext(NavigationContext)
  const [askConfirm, dialog] = useConfirmDialog()

  useEffect(() => {
    if (!isDirty) return undefined
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  useEffect(() => {
    if (!isDirty || !navigator?.push) return undefined
    const { push } = navigator
    // One prompt per navigation attempt; a declined attempt leaves the page and its form exactly as it was.
    navigator.push = (...args) => {
      askConfirm({ title: 'Leave this page?', message, confirmLabel: 'Leave page' })
        .then((ok) => { if (ok) push.apply(navigator, args) })
    }
    return () => {
      navigator.push = push
    }
  }, [isDirty, navigator, message, askConfirm])

  return dialog
}

export default useUnsavedChangesGuard
