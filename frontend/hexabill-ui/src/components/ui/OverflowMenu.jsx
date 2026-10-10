import { useEffect, useId, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'

/**
 * "More" menu for secondary page or row actions, so a view keeps one primary button.
 *
 * items: [{ label, icon?, onClick, danger?, disabled?, hidden?, separatorBefore? }]
 * Keyboard: Enter/Space opens, arrows move, Home/End jump, Esc closes and returns focus.
 */
export default function OverflowMenu({ items = [], label = 'More actions', showLabel = false, align = 'end', className = '' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const menuId = useId()
  const visible = items.filter((i) => i && !i.hidden)

  const focusItem = (index) => {
    const nodes = rootRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])')
    if (!nodes?.length) return
    nodes[(index + nodes.length) % nodes.length].focus()
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    const t = setTimeout(() => focusItem(0), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  if (visible.length === 0) return null

  const onMenuKeyDown = (e) => {
    const nodes = [...rootRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')]
    const i = nodes.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(i + 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(i - 1) }
    else if (e.key === 'Home') { e.preventDefault(); focusItem(0) }
    else if (e.key === 'End') { e.preventDefault(); focusItem(nodes.length - 1) }
    else if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); buttonRef.current?.focus() }
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={showLabel ? undefined : label}
        onClick={() => setOpen((v) => !v)}
        className={`btn btn-secondary ${showLabel ? '' : 'px-2.5'}`}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
        {showLabel && <span>{label}</span>}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={`absolute top-full z-dropdown mt-1 min-w-[12rem] max-w-[calc(100vw-2rem)] rounded-lg border border-surface-border bg-white py-1 shadow-lg ${align === 'end' ? 'end-0' : 'start-0'}`}
        >
          {visible.map((item, idx) => {
            const Icon = item.icon
            return (
              <div key={item.label}>
                {item.separatorBefore && idx > 0 && <div className="my-1 border-t border-surface-border" role="separator" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => { setOpen(false); item.onClick?.() }}
                  className={`flex min-h-[44px] w-full items-center gap-2.5 px-3 text-start text-sm md:min-h-[36px] disabled:cursor-not-allowed disabled:opacity-40 ${
                    item.danger ? 'text-error-fg hover:bg-error-bg focus:bg-error-bg' : 'text-text-primary hover:bg-neutral-50 focus:bg-neutral-50'
                  } focus:outline-none`}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />}
                  {item.label}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
