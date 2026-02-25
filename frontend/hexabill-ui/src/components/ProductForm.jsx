import { useState, useEffect } from 'react'
import { X, Plus, Upload, Image as ImageIcon } from 'lucide-react'
import { productCategoriesAPI, productsAPI } from '../services'
import toast from 'react-hot-toast'

const ProductForm = ({ product, saving = false, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    nameEn: product?.nameEn || '',
    nameAr: product?.nameAr || '',
    unitType: product?.unitType || 'CRTN',
    conversionToBase: product?.conversionToBase || 1,
    costPrice: product?.costPrice || 0,
    sellPrice: product?.sellPrice || 0,
    expiryDate: product?.expiryDate ? product.expiryDate.split('T')[0] : '',
    categoryId: product?.categoryId || null,
    // Stock and reorder level removed - stock is computed from transactions only
    descriptionEn: product?.descriptionEn || '',
    descriptionAr: product?.descriptionAr || ''
  })
  
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [showCategoryInput, setShowCategoryInput] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(product?.imageUrl || null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const handleChange = (e) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'categoryId' ? (value === '' ? null : parseInt(value)) : 
              type === 'number' ? (value === '' ? '' : Number(value)) : value
    }))
  }

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB')
        return
      }
      setImageFile(file)
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName || !newCategoryName.trim()) {
      toast.error('Category name is required')
      return
    }

    try {
      setCreatingCategory(true)
      const response = await productCategoriesAPI.createCategory({
        name: newCategoryName.trim(),
        colorCode: '#3B82F6'
      })
      if (response?.success) {
        toast.success('Category created successfully!')
        await loadCategories()
        setFormData(prev => ({ ...prev, categoryId: response.data.id }))
        setNewCategoryName('')
        setShowCategoryInput(false)
      } else {
        toast.error(response?.message || 'Failed to create category')
      }
    } catch (error) {
      console.error('Error creating category:', error)
      if (!error?._handledByInterceptor) {
        toast.error(error?.response?.data?.message || 'Failed to create category')
      }
    } finally {
      setCreatingCategory(false)
    }
  }

  const loadCategories = async () => {
    try {
      setLoadingCategories(true)
      const response = await productCategoriesAPI.getCategories()
      if (response?.success && response?.data) {
        setCategories(response.data)
      }
    } catch (error) {
      console.error('Error loading categories:', error)
      // Don't show error - categories table might not exist yet (migration not run)
      setCategories([])
    } finally {
      setLoadingCategories(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // CRITICAL FIX: Client-side validation
    if (!formData.nameEn || !formData.nameEn.trim()) {
      toast.error('Product name (English) is required')
      return
    }
    if (!formData.sku || !formData.sku.trim()) {
      toast.error('SKU is required')
      return
    }
    if (!formData.unitType) {
      toast.error('Unit type is required')
      return
    }
    if (formData.costPrice < 0 || formData.sellPrice < 0) {
      toast.error('Prices cannot be negative')
      return
    }
    if (formData.conversionToBase <= 0) {
      toast.error('Conversion to base must be greater than 0')
      return
    }
    
    // Decimal precision validation (max 2 decimal places)
    const validateDecimal = (value, maxDecimals = 2) => {
      if (value === null || value === undefined || value === '') return true
      const parts = value.toString().split('.')
      return parts.length === 1 || parts[1].length <= maxDecimals
    }
    
    if (!validateDecimal(formData.costPrice)) {
      toast.error('Cost price must have maximum 2 decimal places')
      return
    }
    if (!validateDecimal(formData.sellPrice)) {
      toast.error('Sell price must have maximum 2 decimal places')
      return
    }
    if (!validateDecimal(formData.conversionToBase)) {
      toast.error('Conversion to base must have maximum 2 decimal places')
      return
    }
    
    // Business logic validation: warn if sell price < cost price
    if (formData.sellPrice < formData.costPrice) {
      const confirm = window.confirm(
        'Sell price is less than cost price. This will result in a loss. Continue?'
      )
      if (!confirm) return
    }
    
    // Round prices to 2 decimal places before submitting
    const roundToDecimals = (value, decimals = 2) => {
      return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
    }
    
    // Upload image first if a new image was selected (only for existing products)
    let imageUrl = formData.imageUrl || product?.imageUrl
    
    if (imageFile && product?.id) {
      // Upload image for existing product
      try {
        setUploadingImage(true)
        const uploadResponse = await productsAPI.uploadProductImage(product.id, imageFile)
        if (uploadResponse?.success) {
          imageUrl = uploadResponse.data
          toast.success('Image uploaded successfully')
        }
      } catch (error) {
        console.error('Error uploading image:', error)
        if (!error?._handledByInterceptor) {
          toast.error('Failed to upload image. Product will be saved without image.')
        }
      } finally {
        setUploadingImage(false)
      }
    }
    
    // Save product with image URL and rounded prices
    const productData = { 
      ...formData,
      costPrice: roundToDecimals(formData.costPrice),
      sellPrice: roundToDecimals(formData.sellPrice),
      conversionToBase: roundToDecimals(formData.conversionToBase, 4) // Allow more decimals for conversion
    }
    if (imageUrl) {
      productData.imageUrl = imageUrl
    }
    
    // Call parent's onSave - it will handle image upload for new products after creation
    onSave(productData, imageFile) // Pass imageFile so parent can upload after product creation
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
                Barcode <span className="text-xs text-gray-500">(Optional - for POS scanning)</span>
              </label>
              <input
                type="text"
                name="barcode"
                className="input"
                value={formData.barcode}
                onChange={handleChange}
                placeholder="EAN-13, UPC, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Category <span className="text-xs text-gray-500">(Optional)</span>
              </label>
              <div className="flex gap-2">
                <select
                  name="categoryId"
                  className="input flex-1"
                  value={formData.categoryId || ''}
                  onChange={handleChange}
                  disabled={loadingCategories}
                >
                  <option value="">No Category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCategoryInput(!showCategoryInput)}
                  className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-1"
                  title="Create new category"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {showCategoryInput && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    placeholder="New category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateCategory()}
                    className="input flex-1"
                    disabled={creatingCategory}
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={creatingCategory || !newCategoryName.trim()}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {creatingCategory ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCategoryInput(false)
                      setNewCategoryName('')
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Product Image <span className="text-xs text-gray-500">(Optional - for POS)</span>
              </label>
              <div className="space-y-2">
                {imagePreview && (
                  <div className="relative inline-block">
                    <img 
                      src={typeof imagePreview === 'string' && (imagePreview.startsWith('http') || imagePreview.startsWith('/') || imagePreview.startsWith('data:')) 
                        ? imagePreview 
                        : imagePreview} 
                      alt="Product preview" 
                      className="h-24 w-24 object-cover rounded-lg border border-gray-300"
                    />
                    {product?.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null)
                          setImagePreview(null)
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        title="Remove image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">{imageFile ? imageFile.name : product?.id ? 'Change Image' : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </label>
                  {uploadingImage && (
                    <span className="text-sm text-gray-500">Uploading...</span>
                  )}
                </div>
                {product?.id && imageFile && (
                  <p className="text-xs text-gray-500">
                    Image will be uploaded when you save the product
                  </p>
                )}
              </div>
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
              New products start with 0 stock. To set opening stock, create the product first, then use the "Stock Adjustment" 
              feature with reason "Opening Stock" to ensure proper audit trail.
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
