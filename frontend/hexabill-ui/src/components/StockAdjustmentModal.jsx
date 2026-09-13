import { useState } from 'react'
import { X } from 'lucide-react'

const StockAdjustmentModal = ({ product, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    changeQty: 0,
    reason: ''
  })
  const [validationError, setValidationError] = useState('')

  const handleChange = (e) => {
    const { name, value, type } = e.target
    setValidationError('')
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.reason.trim()) {
      setValidationError('Please provide a reason for the stock adjustment')
      return
    }
    onSave(formData)
  }

  if (!product) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Adjust stock - ${product?.nameEn || 'Product'}`}
    >
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onCancel} aria-hidden="true" />

      <div className="relative bg-white rounded-lg p-5 sm:p-6 w-full max-w-md my-auto max-h-[90vh] overflow-y-auto overscroll-contain">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold text-gray-900 pr-2">
            Adjust Stock - {product?.nameEn || 'Product'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Current Stock:</p>
          <p className="text-lg font-semibold text-gray-900">
            {product?.stockQty ?? 0} {product?.unitType || ''}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Change Quantity *
            </label>
            <input
              type="number"
              name="changeQty"
              required
              step="0.01"
              inputMode="decimal"
              className="input min-h-[44px]"
              value={formData.changeQty}
              onChange={handleChange}
              placeholder="Enter positive or negative value"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use positive values to increase stock, negative to decrease
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason *
            </label>
            <textarea
              name="reason"
              required
              rows="3"
              className="input"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Explain the reason for this adjustment..."
            />
          </div>

          {validationError && (
            <p role="alert" className="text-sm text-error bg-error/10 border border-error/30 rounded-lg px-3 py-2">
              {validationError}
            </p>
          )}

          <div className="flex justify-end gap-2 flex-wrap pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary min-h-[44px]"
            >
              Adjust Stock
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StockAdjustmentModal