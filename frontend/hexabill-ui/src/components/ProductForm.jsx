import { normalizeSku, suggestSkuFromName } from '../utils/sku'
import { cleanText, fixName, fixMoney, fixConversion, fixBarcode, validateProductFields } from '../utils/productFields'
import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Plus, Upload, ScanBarcode, SwitchCamera, Wand2, Printer, Share2 } from 'lucide-react'
import { productCategoriesAPI, productsAPI } from '../services'
import toast from 'react-hot-toast'
import ConfirmDangerModal from './ConfirmDangerModal'
import ProductImage from './ProductImage'
import { useCameraBarcodeScanner } from '../features/sales/pos/barcode/useCameraBarcodeScanner'
import { playScanSuccessBeep } from '../features/sales/pos/barcode/scanBeep'
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
    reorderLevel: product?.reorderLevel ?? 0,
    descriptionEn: product?.descriptionEn || '',
    descriptionAr: product?.descriptionAr || ''
  })
  
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [showCategoryInput, setShowCategoryInput] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(product?.imageUrl
    ? (/^(https?:|data:|\/)/.test(product.imageUrl) ? product.imageUrl : `/uploads/${product.imageUrl}`)
    : null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showLossConfirm, setShowLossConfirm] = useState(false)
  const [barcodeScanOn, setBarcodeScanOn] = useState(false)
  const [scanCamError, setScanCamError] = useState(null)
  const [barcodePdfBusy, setBarcodePdfBusy] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

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
        toast.error('Failed to get barcode PDF')
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

  // New product: the SKU follows the English name until the user types their own SKU.
  const skuEditedByUser = useRef(false)
  const [fixNotes, setFixNotes] = useState([])

  const handleChange = (e) => {
    const { name, value, type } = e.target
    setFieldErrors(prev => ({ ...prev, [name]: undefined }))
    if (name === 'sku') skuEditedByUser.current = value.trim() !== ''
    setFormData(prev => {
      const next = {
        ...prev,
        [name]: name === 'categoryId' ? (value === '' ? null : parseInt(value)) :
                type === 'number' ? (value === '' ? '' : Number(value)) : value
      }
      if (name === 'nameEn' && !product && !skuEditedByUser.current) next.sku = suggestSkuFromName(value)
      return next
    })
  }

  const handleSkuBlur = () => {
    setFormData(prev => {
      const fixed = normalizeSku(prev.sku)
      return fixed === prev.sku ? prev : { ...prev, sku: fixed }
    })
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
      setImageRemoved(false)
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
    const errors = validateProductFields(formData)
    setFieldErrors(errors)
    const firstInvalid = Object.keys(errors)[0]
    if (firstInvalid) {
      e.currentTarget.elements.namedItem(firstInvalid)?.focus()
      return
    }
    
    // Repair what can be repaired, tell the client what changed, and only stop when nothing sensible can be guessed.
    const notes = []
    let nameEn = fixName(formData.nameEn)
    if (!nameEn.value && formData.sku && formData.sku.trim()) {
      nameEn = { value: cleanText(String(formData.sku).replace(/[-_.]+/g, ' ')), note: 'Name was empty, so it was taken from the SKU. You can edit it later.' }
    }
    if (!nameEn.value) {
      toast.error('Type the product name, for example: Beef Nan 250gm')
      return
    }
    if (nameEn.note) notes.push(nameEn.note)
    // SKU: spaces and symbols become dashes; empty falls back to a name-based one.
    const fixedSku = normalizeSku(formData.sku) || suggestSkuFromName(nameEn.value)
    if (!fixedSku) {
      toast.error('Enter a SKU using letters or numbers, for example BEEF-250')
      return
    }
    if (fixedSku !== formData.sku) notes.push(`SKU set to ${fixedSku}.`)
    const cost = fixMoney(formData.costPrice, 'Cost price')
    const sell = fixMoney(formData.sellPrice, 'Sell price')
    const conv = fixConversion(formData.conversionToBase)
    const barcode = fixBarcode(formData.barcode)
    ;[cost, sell, conv].forEach(f => { if (f.note) notes.push(f.note) })
    const unitType = formData.unitType || 'CRTN'
    if (!formData.unitType) notes.push('Qty type was empty, so CRTN (Carton) was used.')
    const fixed = {
      ...formData,
      nameEn: nameEn.value,
      nameAr: cleanText(formData.nameAr),
      sku: fixedSku,
      unitType,
      costPrice: cost.value,
      sellPrice: sell.value,
      conversionToBase: conv.value,
      reorderLevel: Number(formData.reorderLevel || 0),
      barcode: barcode.value,
    }
    setFormData(fixed)
    setFixNotes(notes)

    if (fixed.sellPrice < fixed.costPrice) {
      setShowLossConfirm(true)
      return
    }
    await doSubmitPart2(fixed)
  }

  const doSubmitPart2 = async (data = formData) => {
    const roundToDecimals = (value, decimals = 2) => {
      return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
    }
    let imageUrl = imageRemoved ? null : data.imageUrl || product?.imageUrl
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
          toast.error(product?.imageUrl ? 'Image upload failed. The existing image will be kept.' : 'Image upload failed. Product details will be saved without an image.')
        }
      } finally {
        setUploadingImage(false)
      }
    }
    const productData = {
      ...data,
      costPrice: roundToDecimals(data.costPrice),
      sellPrice: roundToDecimals(data.sellPrice),
      conversionToBase: roundToDecimals(data.conversionToBase, 4),
      expiryDate: data.expiryDate?.trim() || null,
    }
    productData.imageUrl = imageUrl || null
    // Avoid double-upload: page also uploads when imageFile is passed for edits
    await onSave(productData, uploadedAlready ? null : imageFile)
  }

  const scanStatusText = scanCamError
    || SCAN_STATUS_LABEL[barcodeScanStatus]
    || (barcodeScanOn ? 'Starting camera…' : '')

  const fieldError = (name) => fieldErrors[name] && <p id={`product-${name}-error`} className="mt-1 text-xs text-error">{fieldErrors[name]}</p>

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[92vh] flex flex-col shadow-xl">
        <div className="flex justify-between items-center px-4 py-3 border-b border-neutral-200 shrink-0">
          <h2 className="text-lg font-semibold text-neutral-900">
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-neutral-400 hover:text-neutral-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
            {Object.values(fieldErrors).some(Boolean) && (
              <div role="alert" className="rounded-md border border-error bg-error/5 p-3 text-sm text-error">
                Review the highlighted fields. Your other values have been kept.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label htmlFor="product-sku" className="block text-sm font-medium text-neutral-700 mb-1">
                  SKU *
                </label>
                <input
                  type="text"
                  name="sku"
                  id="product-sku"
                  aria-invalid={Boolean(fieldErrors.sku)}
                  className="input"
                  value={formData.sku}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  onBlur={handleSkuBlur}
                  maxLength={50}
                  placeholder="Auto from name, e.g. BEEF-250GM"
                  aria-describedby="sku-hint product-sku-error"
                />
                <p id="sku-hint" className="mt-1 text-xs text-neutral-500">
                  Unique product code, not a barcode. Suggested from the name; check it before saving.
                </p>
                {fieldError('sku')}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="product-barcode" className="block text-sm font-medium text-neutral-700 mb-1">
                  Barcode <span className="text-xs text-neutral-500 font-normal">(box code — Scan or type, then Save)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <input
                    type="text"
                    name="barcode"
                    id="product-barcode"
                    maxLength={100}
                    aria-invalid={Boolean(fieldErrors.barcode)}
                    aria-describedby="barcode-hint product-barcode-error"
                    className="input flex-1 min-w-[8rem]"
                    value={formData.barcode}
                    onChange={handleChange}
                    placeholder="Scan or enter an existing barcode (optional)"
                  />
                  <button
                    type="button"
                    onClick={handleAutoCreateBarcode}
                    className="px-2.5 py-1.5 text-sm font-medium rounded-lg border bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50 inline-flex items-center gap-1 shrink-0"
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
                        ? 'bg-amber-500 text-white border-warning'
                        : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
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
                        className="px-2.5 py-1.5 text-sm font-medium rounded-lg border bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50 inline-flex items-center gap-1 shrink-0 disabled:opacity-50"
                        title="Download barcode PDF"
                      >
                        <Printer className="h-4 w-4" />
                        Print
                      </button>
                      <button
                        type="button"
                        disabled={barcodePdfBusy}
                        onClick={() => handleBarcodePdf(true)}
                        className="px-2.5 py-1.5 text-sm font-medium rounded-lg border bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50 inline-flex items-center gap-1 shrink-0 disabled:opacity-50"
                        title="Share barcode PDF"
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </button>
                    </>
                  )}
                </div>
                <p id="barcode-hint" className="mt-1 text-xs text-neutral-500">Enter the code on the box, or use SKU-based barcode labels.</p>
                {fieldError('barcode')}
                {barcodeScanOn && (
                  <div className="mt-2 relative rounded-lg overflow-hidden border border-neutral-300 bg-black max-w-[220px]">
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
                    <div className="px-2 py-1.5 text-micro text-neutral-200 bg-neutral-900 flex items-center justify-between gap-2">
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
                <label htmlFor="product-nameEn" className="block text-sm font-medium text-neutral-700 mb-1">
                  Name (English) *
                </label>
                <input
                  type="text"
                  name="nameEn"
                  id="product-nameEn"
                  maxLength={200}
                  aria-invalid={Boolean(fieldErrors.nameEn)}
                  aria-describedby="nameEn-hint product-nameEn-error"
                  className="input"
                  placeholder="e.g. Beef slices 18 kg carton"
                  value={formData.nameEn}
                  onChange={handleChange}
                />
                <p id="nameEn-hint" className="mt-1 text-xs text-neutral-500">Use the name shown on your invoice.</p>
                {fieldError('nameEn')}
              </div>

              <div>
                <label htmlFor="product-nameAr" className="block text-sm font-medium text-neutral-700 mb-1">
                  Name (Arabic) (optional)
                </label>
                <input
                  type="text"
                  name="nameAr"
                  id="product-nameAr"
                  maxLength={200}
                  aria-invalid={Boolean(fieldErrors.nameAr)}
                  aria-describedby="product-nameAr-error"
                  className="input"
                  dir="auto"
                  placeholder="مثال: لحم بقري"
                  value={formData.nameAr}
                  onChange={handleChange}
                />
                {fieldError('nameAr')}
              </div>

              <div>
                <label htmlFor="product-categoryId" className="block text-sm font-medium text-neutral-700 mb-1">
                  Category <span className="text-xs text-neutral-500 font-normal">(Optional)</span>
                </label>
                <div className="flex gap-2">
                  <select
                    name="categoryId"
                    id="product-categoryId"
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleCreateCategory()
                        }
                      }}
                      className="input flex-1"
                      disabled={creatingCategory}
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={creatingCategory || !newCategoryName.trim()}
                      className="px-3 py-1.5 text-sm bg-success text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {creatingCategory ? '…' : 'Create'}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="product-unitType" className="block text-sm font-medium text-neutral-700 mb-1">
                  Qty Type *
                </label>
                <select
                  name="unitType"
                  id="product-unitType"
                  aria-invalid={Boolean(fieldErrors.unitType)}
                  aria-describedby="product-unitType-error"
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
                {fieldError('unitType')}
              </div>

              <div>
                <label htmlFor="product-conversionToBase" className="block text-sm font-medium text-neutral-700 mb-1">
                  Conversion to Base *
                </label>
                <input
                  type="number"
                  name="conversionToBase"
                  id="product-conversionToBase"
                  aria-invalid={Boolean(fieldErrors.conversionToBase)}
                  aria-describedby="conversion-hint product-conversionToBase-error"
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 1  (12 if one carton holds 12)"
                  className="input"
                  value={formData.conversionToBase}
                  onChange={handleChange}
                />
                <p id="conversion-hint" className="mt-1 text-xs text-neutral-500">Use 1 for no conversion, or 12 for a carton holding 12 base units. Up to 4 decimals.</p>
                {fieldError('conversionToBase')}
              </div>

              <div>
                <label htmlFor="product-costPrice" className="block text-sm font-medium text-neutral-700 mb-1">
                  Purchase cost (AED, excl. VAT) *
                </label>
                <input
                  type="number"
                  name="costPrice"
                  id="product-costPrice"
                  aria-invalid={Boolean(fieldErrors.costPrice)}
                  aria-describedby="cost-hint product-costPrice-error"
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 120.00"
                  className="input"
                  value={formData.costPrice}
                  onChange={handleChange}
                />
                <p id="cost-hint" className="mt-1 text-xs text-neutral-500">Cost per base unit, for example 120.00. Purchases update this cost.</p>
                {fieldError('costPrice')}
              </div>

              <div>
                <label htmlFor="product-sellPrice" className="block text-sm font-medium text-neutral-700 mb-1">
                  Selling price (AED) *
                </label>
                <input
                  type="number"
                  name="sellPrice"
                  id="product-sellPrice"
                  aria-invalid={Boolean(fieldErrors.sellPrice)}
                  aria-describedby="sell-hint product-sellPrice-error"
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 145.00"
                  className="input"
                  value={formData.sellPrice}
                  onChange={handleChange}
                />
                <p id="sell-hint" className="mt-1 text-xs text-neutral-500">Catalog selling price, for example 145.00. Check the tax treatment when making a sale.</p>
                {fieldError('sellPrice')}
              </div>

              <div>
                <label htmlFor="product-reorderLevel" className="block text-sm font-medium text-neutral-700 mb-1">Reorder level (optional)</label>
                <input id="product-reorderLevel" name="reorderLevel" type="number" inputMode="numeric" min="0" step="1" className="input" value={formData.reorderLevel} onChange={handleChange} aria-invalid={Boolean(fieldErrors.reorderLevel)} aria-describedby="reorder-hint product-reorderLevel-error" />
                <p id="reorder-hint" className="mt-1 text-xs text-neutral-500">Example: 5 base units. Use 0 for the company default low-stock threshold.</p>
                {fieldError('reorderLevel')}
              </div>
              <div>
                <label htmlFor="product-expiryDate" className="block text-sm font-medium text-neutral-700 mb-1">
                  Expiry Date <span className="text-xs text-neutral-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="date"
                  name="expiryDate"
                  id="product-expiryDate"
                  className="input"
                  value={formData.expiryDate}
                  onChange={handleChange}
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Product Image <span className="text-xs text-neutral-500 font-normal">(Optional — product photo, not barcode)</span>
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {imagePreview && (
                    <div className="relative inline-block">
                      <ProductImage
                        productId={product?.id}
                        src={typeof imagePreview === 'string' && (imagePreview.startsWith('http') || imagePreview.startsWith('/') || imagePreview.startsWith('data:'))
                          ? imagePreview
                          : imagePreview}
                        alt="Product preview"
                        className="h-16 w-16 object-cover rounded-lg border border-neutral-300"
                      />
                      {product?.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null)
                            setImagePreview(null)
                            setImageRemoved(true)
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-error"
                          title="Remove image"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 border border-neutral-300 rounded-lg cursor-pointer hover:bg-neutral-200 transition-colors">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">{imageFile ? imageFile.name : product?.id ? 'Change Image' : 'Upload Image'}</span>
                    <input
                      type="file"
                      id="product-image"
                      name="image"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </label>
                  {uploadingImage && (
                    <span className="text-sm text-neutral-500">Uploading...</span>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="product-descriptionEn" className="block text-sm font-medium text-neutral-700 mb-1">
                  Description (English) (optional)
                </label>
                <textarea
                  name="descriptionEn"
                  id="product-descriptionEn"
                  maxLength={500}
                  aria-invalid={Boolean(fieldErrors.descriptionEn)}
                  aria-describedby="product-descriptionEn-error"
                  placeholder="e.g. Frozen beef, 250 g pack"
                  rows="2"
                  className="input"
                  value={formData.descriptionEn}
                  onChange={handleChange}
                />
                {fieldError('descriptionEn')}
              </div>

              <div>
                <label htmlFor="product-descriptionAr" className="block text-sm font-medium text-neutral-700 mb-1">
                  Description (Arabic) (optional)
                </label>
                <textarea
                  name="descriptionAr"
                  id="product-descriptionAr"
                  maxLength={500}
                  aria-invalid={Boolean(fieldErrors.descriptionAr)}
                  aria-describedby="product-descriptionAr-error"
                  placeholder="مثال: لحم بقري مجمد"
                  dir="auto"
                  rows="2"
                  className="input"
                  value={formData.descriptionAr}
                  onChange={handleChange}
                />
                {fieldError('descriptionAr')}
              </div>
            </div>

            {fixNotes.length > 0 && (
              <div role="status" className="text-xs text-warning-fg bg-warning-bg border border-warning-border rounded-md px-3 py-2">
                <p className="font-medium">We fixed these for you:</p>
                <ul className="list-disc pl-4">{fixNotes.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
            )}
            <p className="text-xs text-primary-800 bg-primary-50 border border-primary-200 rounded-md px-3 py-2">
              Stock is calculated from purchases and sales. New products start at 0 — use Stock Adjustment (Opening Stock) after create.
            </p>
          </div>

          <div className="flex justify-end gap-2 px-4 py-3 border-t border-neutral-200 shrink-0 bg-white">
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
