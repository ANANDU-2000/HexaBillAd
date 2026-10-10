import { useState, useEffect, useRef, useId } from 'react'
import { X, Maximize2, Minimize2 } from 'lucide-react'

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  allowFullscreen = false,
  footer = null
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const modalRef = useRef(null)
  const titleId = useId()

  // Phase 10.4: Auto full-screen on mobile when allowFullscreen
  useEffect(() => {
    if (isOpen && allowFullscreen && window.matchMedia('(max-width: 767px)').matches) {
      setIsFullscreen(true)
    }
  }, [isOpen, allowFullscreen])
  const previousActiveElementRef = useRef(null)

  // Get all focusable elements within the modal
  const getFocusableElements = () => {
    if (!modalRef.current) return []
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    return Array.from(modalRef.current.querySelectorAll(selector)).filter(
      (el) => !el.disabled && el.offsetParent !== null
    )
  }

  // Focus trap handler
  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return

    const focusableElements = getFocusableElements()
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (e.shiftKey) {
      // Shift+Tab: if on first element, move to last
      if (document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      }
    } else {
      // Tab: if on last element, move to first
      if (document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }
  }

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
      }
    }

    if (isOpen) {
      previousActiveElementRef.current = document.activeElement
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'

      // Only focus first element ONCE when modal opens
      const timer = setTimeout(() => {
        const focusableElements = getFocusableElements()
        if (focusableElements.length > 0) {
          focusableElements[0].focus()
        }
      }, 100)
      return () => {
        clearTimeout(timer)
        document.removeEventListener('keydown', handleEscape)
        document.body.style.overflow = 'unset'
        if (previousActiveElementRef.current && previousActiveElementRef.current.focus) {
          previousActiveElementRef.current.focus()
        }
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
    '3xl': 'max-w-6xl',
    full: 'max-w-7xl'
  }

  return (
    <div className={`fixed inset-0 z-50 ${isFullscreen ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      {/* Phones: bottom sheet anchored above the safe area. md+: centered dialog. */}
      <div className={`flex ${isFullscreen ? 'h-full' : 'min-h-full items-end justify-center md:min-h-screen md:items-center md:p-4'}`}>
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-neutral-900/50 transition-opacity"
          onClick={closeOnOverlayClick ? onClose : undefined}
        />

        {/* Modal */}
        <div
          ref={modalRef}
          className={`relative bg-white border border-surface-border shadow-lg w-full flex flex-col ${isFullscreen ? 'max-w-full h-full max-h-full m-0 rounded-none' : `${sizeClasses[size]} rounded-t-lg md:rounded-lg max-h-[92dvh] safe-area-bottom md:max-h-[calc(100dvh-2rem)]`}`}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
        >
          {/* Header */}
          {(title || showCloseButton || allowFullscreen) && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 shrink-0">
              {title && (
                <h2 id={titleId} className="min-w-0 truncate text-base font-semibold text-text-primary md:text-lg">
                  {title}
                </h2>
              )}
              <div className="flex items-center gap-2">
                {allowFullscreen && (
                  <button
                    type="button"
                    aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-neutral-500 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-700"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? <Minimize2 className="h-5 w-5" aria-hidden /> : <Maximize2 className="h-5 w-5" aria-hidden />}
                  </button>
                )}
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-neutral-500 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-700"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-4 overflow-y-auto min-h-0 flex-1">
            {children}
          </div>
          {footer && (
            <div className="px-4 py-3 border-t border-neutral-200 shrink-0 bg-white">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Modal
