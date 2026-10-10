import { useEffect, useState } from 'react'

// A shrink of the visual viewport this large means the on-screen keyboard is up.
const KEYBOARD_MIN_PX = 150

/** True while the phone's on-screen keyboard covers part of the layout viewport. */
export function useKeyboardOpen () {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return undefined
    const update = () => {
      const typing = document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')
      setOpen(Boolean(typing) && window.innerHeight - vv.height > KEYBOARD_MIN_PX)
    }
    vv.addEventListener('resize', update)
    window.addEventListener('focusin', update)
    window.addEventListener('focusout', update)
    return () => {
      vv.removeEventListener('resize', update)
      window.removeEventListener('focusin', update)
      window.removeEventListener('focusout', update)
    }
  }, [])
  return open
}

/** True while a modal dialog, sheet (aria-modal) or an inline panel marked data-shell-hides-nav is in the document. */
export function useOverlayOpen () {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let frame = 0
    const check = () => {
      frame = 0
      // Inline panels that own the screen (for example the purchase form) also hide the bottom nav.
      setOpen(Boolean(document.querySelector('[aria-modal="true"], [data-shell-hides-nav]')))
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check) }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal'] })
    check()
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return open
}
