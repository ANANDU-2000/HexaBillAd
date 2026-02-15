import { useState, useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

/**
 * Reusable danger confirmation modal. Replaces window.confirm() for destructive actions.
 * @param {boolean} isOpen
 * @param {function} onClose
 * @param {function} onConfirm - called when user confirms
 * @param {string} title
 * @param {string} message
 * @param {string} [confirmLabel='Confirm'] - label for confirm button
 * @param {string} [requireTypedText] - if set (e.g. 'DELETE'), user must type this to enable confirm
 */
const ConfirmDangerModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm',
  message = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  requireTypedText = null
}) => {
  const [typedText, setTypedText] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setTypedText('')
      setError('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const needsTyped = requireTypedText && requireTypedText.length > 0
  const isMatch = !needsTyped || typedText.trim().toUpperCase() === requireTypedText.toUpperCase()

  const handleConfirm = () => {
    if (needsTyped && !isMatch) {
      setError(`Please type ${requireTypedText} to confirm`)
      return
    }
    onConfirm()
    setTypedText('')
    setError('')
    onClose()
  }

  const handleClose = () => {
    setTypedText('')
    setError('')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-danger-title">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-red-100">
        <div className="flex items-center justify-between p-4 border-b border-red-100 bg-red-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
            <h2 id="confirm-danger-title" className="text-lg font-bold text-gray-900">{title}</h2>
          </div>
          <button type="button" onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600 rounded" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{message}</p>
          {needsTyped && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="font-bold text-red-600">{requireTypedText}</span> to confirm:
              </label>
              <input
                type="text"
                value={typedText}
                onChange={(e) => { setTypedText(e.target.value); setError('') }}
                placeholder={`Type ${requireTypedText} here`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 uppercase text-sm"
                onKeyDown={(e) => e.key === 'Enter' && isMatch && handleConfirm()}
              />
              {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={needsTyped && !isMatch}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDangerModal
