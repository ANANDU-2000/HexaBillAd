import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * MobileSheet — bottom sheet / dialog for phones (md and below) and a
 * centered dialog on desktop (lg+). Used for mobile filters, action sheets
 * and simple pickers.
 *
 * Reasons to use:
 * - Mobile: slides up from the bottom, respects safe-area, caps at 90dvh,
 *   scrolls its own content, close control ≥44px.
 * - Desktop: degrades to a clean centered panel so a caller only writes one
 *   component that works on both.
 */
const MobileSheet = ({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md', // sm | md | lg | xl
  closeOnOverlayClick = true,
  ariaLabel,
}) => {
  const panelRef = useRef(null)
  // Ref so a new onClose identity on each parent render does not re-run the effect (and steal focus).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    const previouslyFocused = document.activeElement
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    // Move focus into the sheet so keyboard and screen-reader users land in it; restore on close.
    const t = setTimeout(() => panelRef.current?.focus(), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = 'unset'
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus()
    }
  }, [open])

  if (!open) return null

  const sizeClasses = {
    sm: 'lg:max-w-md',
    md: 'lg:max-w-lg',
    lg: 'lg:max-w-2xl',
    xl: 'lg:max-w-4xl',
  }

  return (
    <div className="fixed inset-0 z-[70]" aria-modal="true" role="dialog" aria-label={ariaLabel || title}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-900/40 backdrop-blur-[2px] transition-opacity"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        className="fixed inset-0 flex items-end lg:items-center lg:justify-center"
        onClick={closeOnOverlayClick ? (e) => { if (e.target === e.currentTarget) onClose() } : undefined}
      >
        {/* Panel — mobile: bottom sheet; desktop: centered */}
        <div
          ref={panelRef}
          tabIndex={-1}
          className={`relative w-full rounded-t-2xl bg-white outline-none shadow-[0_-8px_40px_rgba(15,23,42,0.16)] flex flex-col max-h-[86dvh] animate-slideUp sm:mx-auto sm:mb-3 sm:max-w-md sm:rounded-2xl lg:max-h-[88dvh] ${sizeClasses[size]}`}
        >
          {/* Grab handle (mobile hint) */}
          <div className="flex justify-center pt-2.5 lg:hidden" aria-hidden="true">
            <div className="h-1 w-9 rounded-full bg-neutral-300" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 pt-1.5 pb-3 border-b border-neutral-100 shrink-0">
            <h2 className="text-lg font-semibold text-neutral-900 truncate">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {/* Body — scrollable (never sideways) */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain"
            style={footer ? undefined : { paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
          >
            {children}
          </div>

          {/* Footer (actions) — safe-area aware */}
          {footer && (
            <div
              className="px-4 pt-3 pb-3 border-t border-neutral-100 shrink-0"
              style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MobileSheet