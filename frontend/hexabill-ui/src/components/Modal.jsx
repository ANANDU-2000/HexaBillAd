import { useState, useEffect, useRef } from 'react'
import { X, Maximize2, Minimize2 } from 'lucide-react'

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  allowFullscreen = false
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const modalRef = useRef(null)
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
      <div className={`flex ${isFullscreen ? 'h-full' : 'min-h-screen items-center justify-center p-4'}`}>
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={closeOnOverlayClick ? onClose : undefined}
        />

        {/* Modal */}
        <div
          ref={modalRef}
          className={`relative bg-white rounded-lg border border-neutral-200 shadow-lg w-full ${isFullscreen ? 'max-w-full h-full m-0' : sizeClasses[size]} transform transition-all ${isFullscreen ? 'rounded-none' : ''}`}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
        >
          {/* Header */}
          {(title || showCloseButton || allowFullscreen) && (
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              {title && (
                <h3 id="modal-title" className="text-lg font-semibold text-gray-900">
                  {title}
                </h3>
              )}
              <div className="flex items-center gap-2">
                {allowFullscreen && (
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="text-gray-400 hover:text-gray-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                  </button>
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Close modal"
                  >
                    <X className="h-6 w-6" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className={`p-6 ${isFullscreen ? 'overflow-auto h-full' : ''}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Modal
