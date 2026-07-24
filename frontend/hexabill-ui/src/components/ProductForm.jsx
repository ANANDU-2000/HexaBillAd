import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Upload, ScanBarcode, SwitchCamera, Wand2, Printer, Share2 } from 'lucide-react'
import { productCategoriesAPI, productsAPI } from '../services'
import toast from 'react-hot-toast'
import ConfirmDangerModal from './ConfirmDangerModal'
import { useCameraBarcodeScanner } from '../pages/company/pos/barcode/useCameraBarcodeScanner'
import { playScanSuccessBeep } from '../pages/company/pos/barcode/scanBeep'
import { downloadOrShareBarcodePdf } from '../utils/barcodePdf'

const SCAN_STATUS_LABEL = {
  starting: 'Starting camera…',
  scanning: 'Looking for barcode…',
  found: 'Barcode found',
  timeout: 'No barcode yet — keep aiming or tap Try again',
}

const ProductForm = ({ product, saving = false, onSave, onCancel, initialBarcode = '' }) => {
  const [formData, setFormData] = useState({
    sku: product?.sku || '',
    barcode: product?.barcode || initialBarcode || '',
    nameEn: product?.nameEn || '',
    nameAr: product?.nameAr || '',
    unitType: product?.unitType || 'CRTN',
    conversionToBase: product?.conversionToBase || 1,
    costPrice: product?.costPrice || 0,
    sellPrice: product?.sellPrice || 0,
    expiryDate: product?.expiryDate ? product.expiryDate.split('T')[0] : '',
    categoryId: product?.categoryId || null,
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
  const [showLossConfirm, setShowLossConfirm] = useState(false)
  const [barcodeScanOn, setBarcodeScanOn] = useState(false)
  const [scanCamError, setScanCamError] = useState(null)
  const [barcodePdfBusy, setBarcodePdfBusy] = useState(false)

  const handleAutoCreateBarcode = () => {
    const sku = (formData.sku || '').trim()
    if (!sku) {
      toast.error('Enter SKU first, then auto-create barcode')
      return
    }
    setFormData((prev) => ({ ...prev, barcode: sku }))
    toast.success(`Barcode set to SKU: ${sku}`)
  }

  const handleBarcodePdf = async (share = false) => {
    if (!product?.id) {
      toast.error('Save the product first, then print or share the barcode')
      return
    }
    if (!formData.barcode?.trim()) {
      toast.error('Add or auto-create a barcode first')
      return
    }
    try {
      setBarcodePdfBusy(true)
      const blob = await productsAPI.downloadBarcodeLabelsPdf({ productIds: [product.id] })
      const result = await downloadOrShareBarcodePdf(blob, {
        fileName: `barcode-${formData.sku || product.id}.pdf`,
        share,
      })
      toast.success(result === 'shared' ? 'Shared barcode PDF' : 'Barcode PDF downloaded')
    } catch (error) {
      console.error(error)
      if (!error?._handledByInterceptor) {
        toast.error(error?.message || 'Failed to get barcode PDF')
      }
    } finally {
      setBarcodePdfBusy(false)
    }
  }

  const onBarcodeDetect = useCallback((code) => {
    if (!code) return
    setFormData((prev) => ({ ...prev, barcode: code }))
    playScanSuccessBeep()
    toast.success(`Barcode: ${code}`)
    setBarcodeScanOn(false)
  }, [])

  const {
    videoRef: barcodeVideoRef,
    start: startBarcodeCam,
    stop: stopBarcodeCam,
    switchCamera: switchBarcodeCam,
    scanStatus: barcodeScanStatus,
  } = useCameraBarcodeScanner({
    onDetect: (code) => onBarcodeDetect(code),
    onError: (reason) => {
      if (reason === 'decode_timeout') return
      const msg = {
        permission_denied: 'Camera access blocked. Enable it in browser settings.',
        no_camera: 'No camera found on this device.',
        not_supported: 'Camera scanning is not supported in this browser.',
      }[reason] || 'Camera error'
      setScanCamError(msg)
      toast.error(msg)
    },
    facingMode: 'environment',
  })

  useEffect(() => {
    if (!barcodeScanOn) {
      stopBarcodeCam()
      return undefined
    }
    setScanCamError(null)
    startBarcodeCam()
    return () => stopBarcodeCam()
  }, [barcodeScanOn, startBarcodeCam, stopBarcodeCam])

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
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB')
        return
      }
      setImageFile(file)
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
      setCategories([])
    } finally {
      setLoadingCategories(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
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
    
    if (formData.sellPrice < formData.costPrice) {
      setShowLossConfirm(true)
      return
    }
    await doSubmitPart2()
  }

  const doSubmitPart2 = async () => {
    const roundToDecimals = (value, decimals = 2) => {
      return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
    }
    let imageUrl = formData.imageUrl || product?.imageUrl
    let uploadedAlready = false
    if (imageFile && product?.id) {
      try {
        setUploadingImage(true)
        const uploadResponse = await productsAPI.uploadProductImage(product.id, imageFile)
        if (uploadResponse?.success) {
          imageUrl = uploadResponse.data
          uploadedAlready = true
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
    const productData = {
      ...formData,
      costPrice: roundToDecimals(formData.costPrice),
      sellPrice: roundToDecimals(formData.sellPrice),
      conversionToBase: roundToDecimals(formData.conversionToBase, 4),
      expiryDate: formData.expiryDate?.trim() || null,
    }
    if (imageUrl) {
      productData.imageUrl = imageUrl
    }
    // Avoid double-upload: page also uploads when imageFile is passed for edits
    onSave(productData, uploadedAlready ? null : imageFile)
  }

  const scanStatusText = scanCamError
    || SCAN_STATUS_LABEL[barcodeScanStatus]
    || (barcodeScanOn ? 'Starting camera…' : '')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[92vh] flex flex-col shadow-xl">
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Barcode <span className="text-xs text-gray-500 font-normal">(box code — Scan or type, then Save)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <input
                    type="text"
                    name="barcode"
                    className="input flex-1 min-w-[8rem]"
                    value={formData.barcode}
                    onChange={handleChange}
                    placeholder="EAN-13, UPC, SKU…"
                  />
                  <button
                    type="button"
                    onClick={handleAutoCreateBarcode}
                    className="px-2.5 py-1.5 text-sm font-medium rounded-lg border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1 shrink-0"
                    title="Set barcode from SKU"
                  >
                    <Wand2 className="h-4 w-4" />
                    Auto
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarcodeScanOn((v) => !v)}
                    className={`px-2.5 py-1.5 text-sm font-medium rounded-lg border inline-flex items-center gap-1 shrink-0 ${
                      barcodeScanOn
                        ? 'bg-amber-500 text-white border-amber-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    title={barcodeScanOn ? 'Stop camera' : 'Scan barcode with camera'}
                  >
                    <ScanBarcode className="h-4 w-4" />
                    {barcodeScanOn ? 'Stop' : 'Scan'}
                  </button>
                  {product?.id && formData.barcode && (
                    <>
                      <button
                        type="button"
                        disabled={barcodePdfBusy}
                        onClick={() => handleBarcodePdf(false)}
                        className="px-2.5 py-1.5 text-sm font-medium rounded-lg border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1 shrink-0 disabled:opacity-50"
                        title="Download barcode PDF"
                      >
                        <Printer className="h-4 w-4" />
                        Print
                      </button>
                      <button
                        type="button"
                        disabled={barcodePdfBusy}
                        onClick={() => handleBarcodePdf(true)}
                        className="px-2.5 py-1.5 text-sm font-medium rounded-lg border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1 shrink-0 disabled:opacity-50"
                        title="Share barcode PDF"
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </button>
                    </>
                  )}
                </div>
                {barcodeScanOn && (
                  <div className="mt-2 relative rounded-lg overflow-hidden border border-gray-300 bg-black max-w-[220px]">
                    <video
                      ref={barcodeVideoRef}
                      className="w-full aspect-[4/3] object-cover"
                      playsInline
                      muted
                      autoPlay
                    />
                    <div className="absolute top-1 right-1 flex gap-1">
                      <button
                        type="button"
                        onClick={() => switchBarcodeCam()}
                        className="p-1.5 rounded bg-black/50 text-white"
                        title="Switch camera"
                      >
                        <SwitchCamera className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="px-2 py-1.5 text-[11px] text-neutral-200 bg-neutral-900 flex items-center justify-between gap-2">
                      <span>{scanStatusText}</span>
                      {barcodeScanStatus === 'timeout' && (
                        <button
                          type="button"
                          className="underline text-amber-200 shrink-0"
                          onClick={() => {
                            setScanCamError(null)
                            startBarcodeCam()
                          }}
                        >
                          Try again
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-xs text-gray-500 font-normal">(Optional)</span>
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
                    className="px-2.5 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center"
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
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {creatingCategory ? '…' : 'Create'}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Qty Type *
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date <span className="text-xs text-gray-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="date"
                  name="expiryDate"
                  className="input"
                  value={formData.expiryDate}
                  onChange={handleChange}
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Image <span className="text-xs text-gray-500 font-normal">(Optional — product photo, not barcode)</span>
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {imagePreview && (
                    <div className="relative inline-block">
                      <img
                        src={typeof imagePreview === 'string' && (imagePreview.startsWith('http') || imagePreview.startsWith('/') || imagePreview.startsWith('data:'))
                          ? imagePreview
                          : imagePreview}
                        alt="Product preview"
                        className="h-16 w-16 object-cover rounded-lg border border-gray-300"
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
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors">
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (English)
                </label>
                <textarea
                  name="descriptionEn"
                  rows="2"
                  className="input"
                  value={formData.descriptionEn}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Arabic)
                </label>
                <textarea
                  name="descriptionAr"
                  rows="2"
                  className="input"
                  value={formData.descriptionAr}
                  onChange={handleChange}
                />
              </div>
            </div>

            <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
              Stock is calculated from purchases and sales. New products start at 0 — use Stock Adjustment (Opening Stock) after create.
            </p>
          </div>

          <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 shrink-0 bg-white">
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
              disabled={saving || uploadingImage}
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
      <ConfirmDangerModal
        isOpen={showLossConfirm}
        onClose={() => setShowLossConfirm(false)}
        onConfirm={() => {
          setShowLossConfirm(false)
          doSubmitPart2()
        }}
        title="Sell price below cost"
        message="Sell price is less than cost price. This will result in a loss. Continue?"
        confirmLabel="Continue"
      />
    </div>
  )
}

export default ProductForm
