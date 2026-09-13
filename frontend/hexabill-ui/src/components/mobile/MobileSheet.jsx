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

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [open, onClose])

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
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      <div className="fixed inset-0 flex items-end lg:items-center lg:justify-center">
        {/* Panel — mobile: bottom sheet; desktop: centered */}
        <div
          ref={panelRef}
          className={`relative w-full rounded-t-2xl lg:rounded-xl bg-white shadow-lg flex flex-col max-h-[92dvh] lg:max-h-[88dvh] animate-slideUp ${sizeClasses[size]}`}
        >
          {/* Grab handle (mobile hint) */}
          <div className="flex justify-center pt-2.5 lg:hidden" aria-hidden="true">
            <div className="w-10 h-1 rounded-full bg-neutral-200" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 pt-2 pb-3 border-b border-neutral-100 shrink-0">
            <h2 className="text-base font-semibold text-neutral-900 truncate">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
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