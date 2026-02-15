import { useState } from 'react'
import { X } from 'lucide-react'

const ProductForm = ({ product, saving = false, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    sku: product?.sku || '',
    nameEn: product?.nameEn || '',
    nameAr: product?.nameAr || '',
    unitType: product?.unitType || 'CRTN',
    conversionToBase: product?.conversionToBase || 1,
    costPrice: product?.costPrice || 0,
    sellPrice: product?.sellPrice || 0,
    expiryDate: product?.expiryDate ? product.expiryDate.split('T')[0] : '',
    // Stock and reorder level removed - stock is computed from transactions only
    descriptionEn: product?.descriptionEn || '',
    descriptionAr: product?.descriptionAr || ''
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
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                SKU *
              </label>
              <input
                type="text"
                name="sku"
                required
                className="input"
                value={formData.sku}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Qty Type * <span className="text-xs text-gray-500">(e.g., CRTN, KG, PIECE)</span>
              </label>
              <select
                name="unitType"
                required
                className="input uppercase"
                value={formData.unitType}
                onChange={handleChange}
              >
                <option value="CRTN">CRTN (Carton)</option>
                <option value="KG">KG (Kilogram)</option>
                <option value="PIECE">PIECE</option>
                <option value="BOX">BOX</option>
                <option value="PKG">PKG (Package)</option>
                <option value="BAG">BAG</option>
                <option value="PC">PC (Piece)</option>
                <option value="UNIT">UNIT</option>
                <option value="CTN">CTN (Carton)</option>
                <option value="PCS">PCS (Pieces)</option>
                <option value="LTR">LTR (Liter)</option>
                <option value="MTR">MTR (Meter)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Name (English) *
              </label>
              <input
                type="text"
                name="nameEn"
                required
                className="input"
                value={formData.nameEn}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Name (Arabic)
              </label>
              <input
                type="text"
                name="nameAr"
                className="input"
                value={formData.nameAr}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Conversion to Base *
              </label>
              <input
                type="number"
                name="conversionToBase"
                required
                min="0"
                step="0.01"
                className="input"
                value={formData.conversionToBase}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Cost Price *
              </label>
              <input
                type="number"
                name="costPrice"
                required
                min="0"
                step="0.01"
                className="input"
                value={formData.costPrice}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Sell Price *
              </label>
              <input
                type="number"
                name="sellPrice"
                required
                min="0"
                step="0.01"
                className="input"
                value={formData.sellPrice}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Expiry Date <span className="text-xs text-gray-500">(Optional - for tracking old products)</span>
              </label>
              <input
                type="date"
                name="expiryDate"
                className="input"
                value={formData.expiryDate}
                onChange={handleChange}
              />
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Stock quantity is automatically calculated from purchase and sales transactions. 
              You cannot set stock manually when creating a product.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description (English)
            </label>
            <textarea
              name="descriptionEn"
              rows="3"
              className="input"
              value={formData.descriptionEn}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description (Arabic)
            </label>
            <textarea
              name="descriptionAr"
              rows="3"
              className="input"
              value={formData.descriptionAr}
              onChange={handleChange}
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
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  {product ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                product ? 'Update Product' : 'Create Product'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProductForm
