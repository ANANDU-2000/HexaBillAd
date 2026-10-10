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
/**
 * Reusable danger confirmation modal. Replaces window.confirm() and prompt() for destructive or critical actions.
 * @param {boolean} isOpen
 * @param {function} onClose
 * @param {function} onConfirm - called when user confirms. Receives (inputValue) as argument if showInput is true.
 * @param {string} title
 * @param {string} message
 * @param {string} [confirmLabel='Confirm'] - label for confirm button
 * @param {string} [requireTypedText] - if set (e.g. 'DELETE'), user must type this to enable confirm
 * @param {boolean} [showInput] - if true, shows a text input field (replaces window.prompt)
 * @param {string} [inputPlaceholder] - placeholder for the input field
 * @param {string} [inputType='text'] - type of the input (text, number, etc.)
 * @param {string} [defaultValue=''] - default value for the input
 */
const ConfirmDangerModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm',
  message = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  requireTypedText = null,
  showInput = false,
  inputPlaceholder = 'Enter value...',
  inputType = 'text',
  defaultValue = ''
}) => {
  const [typedText, setTypedText] = useState('')
  const [promptValue, setPromptValue] = useState(defaultValue)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setTypedText('')
      setPromptValue(defaultValue)
      setError('')
    }
  }, [isOpen, defaultValue])

  if (!isOpen) return null

  const needsTyped = requireTypedText && requireTypedText.length > 0
  const isMatch = !needsTyped || typedText.trim().toUpperCase() === requireTypedText.toUpperCase()
  const isInputValid = !showInput || (promptValue && promptValue.toString().trim().length > 0)

  const handleConfirm = () => {
    if (needsTyped && !isMatch) {
      setError(`Please type ${requireTypedText} to confirm`)
      return
    }
    if (showInput && !isInputValid) {
      setError('Value is required')
      return
    }

    onConfirm(showInput ? promptValue : undefined)
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
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-red-100 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 pr-2 border-b border-red-100 bg-error-bg rounded-t-xl">
          <div className="flex items-center gap-3 min-w-0">
            <AlertTriangle className="h-6 w-6 text-error flex-shrink-0" />
            <h2 id="confirm-danger-title" className="text-lg font-bold text-neutral-900 truncate">{title}</h2>
          </div>
          <button type="button" onClick={handleClose} className="p-1 text-neutral-400 hover:text-neutral-600 rounded min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto overscroll-contain">
          <p className="text-neutral-700 text-sm leading-relaxed whitespace-pre-line">{message}</p>

          {showInput && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                {inputPlaceholder}
              </label>
              <input
                type={inputType}
                value={promptValue}
                onChange={(e) => { setPromptValue(e.target.value); setError('') }}
                placeholder={inputPlaceholder}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && isInputValid && (!needsTyped || isMatch) && handleConfirm()}
                autoFocus
              />
            </div>
          )}

          {needsTyped && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Type <span className="font-bold text-error">{requireTypedText}</span> to confirm:
              </label>
              <input
                type="text"
                value={typedText}
                onChange={(e) => { setTypedText(e.target.value); setError('') }}
                placeholder={`Type ${requireTypedText} here`}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 uppercase text-sm"
                onKeyDown={(e) => e.key === 'Enter' && isMatch && isInputValid && handleConfirm()}
              />
              {error && <p className="mt-1 text-sm text-error">{error}</p>}
            </div>
          )}

          {error && !needsTyped && <p className="mt-1 text-sm text-error">{error}</p>}

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={(needsTyped && !isMatch) || (showInput && !isInputValid)}
              className="flex-1 px-4 py-2.5 bg-error text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 font-medium transition-colors"
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
