import { useState } from 'react'
import { X } from 'lucide-react'

const StockAdjustmentModal = ({ product, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    changeQty: 0,
    reason: ''
  })

  const handleChange = (e) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.reason.trim()) {
      alert('Please provide a reason for the stock adjustment')
      return
    }
    onSave(formData)
  }

  if (!product) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Adjust Stock - {product?.nameEn || 'Product'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
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
              className="input"
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

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
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
