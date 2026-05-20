import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Edit,
  Package,
  AlertTriangle,
  History,
  RefreshCw,
  Barcode,
  Tag,
} from 'lucide-react'
import { formatCurrency } from '../../utils/currency'
import toast from 'react-hot-toast'
import { productsAPI } from '../../services'
import { LoadingCard } from '../../components/Loading'
import ProductForm from '../../components/ProductForm'
import StockAdjustmentModal from '../../components/StockAdjustmentModal'
import { useAuth } from '../../hooks/useAuth'
import { isAdminOrOwner } from '../../utils/roles'

const ProductDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const canManage = isAdminOrOwner(user)
  const canAdjustStock = !!user

  const [product, setProduct] = useState(null)
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [movementsLoading, setMovementsLoading] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (id) {
      loadProduct()
      loadMovements()
    }
  }, [id])

  useEffect(() => {
    if (searchParams.get('edit') === '1' && product && canManage) {
      setShowEditModal(true)
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev)
        p.delete('edit')
        return p
      }, { replace: true })
    }
  }, [searchParams, product, canManage])

  const loadProduct = async () => {
    try {
      setLoading(true)
      const response = await productsAPI.getProduct(id)
      if (response?.success && response?.data) {
        setProduct(response.data)
      } else {
        toast.error('Product not found')
        navigate('/products')
      }
    } catch (error) {
      console.error('Failed to load product:', error)
      toast.error('Failed to load product')
      navigate('/products')
    } finally {
      setLoading(false)
    }
  }

  const loadMovements = async () => {
    try {
      setMovementsLoading(true)
      const response = await productsAPI.getStockMovements({
        productId: parseInt(id, 10),
        page: 1,
        pageSize: 10,
      })
      const data = response?.data
      const items = data?.items ?? data?.Items ?? (Array.isArray(data) ? data : [])
      setMovements(items)
    } catch (error) {
      console.error('Failed to load stock movements:', error)
      setMovements([])
    } finally {
      setMovementsLoading(false)
    }
  }

  const handleStockAdjustmentSubmit = async (adjustmentData) => {
    if (!product?.id) return
    try {
      const response = await productsAPI.adjustStock(product.id, {
        changeQty: Number(adjustmentData.changeQty),
        reason: adjustmentData.reason || '',
      })
      if (response?.success) {
        toast.success('Stock adjusted')
        setShowStockModal(false)
        await loadProduct()
        await loadMovements()
      } else {
        toast.error(response?.message || 'Failed to adjust stock')
      }
    } catch (error) {
      console.error('Stock adjustment failed:', error)
      if (!error?._handledByInterceptor) toast.error('Failed to adjust stock')
    }
  }

  const handleSaveProduct = async (formData) => {
    if (!product?.id) return
    try {
      setSaving(true)
      const response = await productsAPI.updateProduct(product.id, formData)
      if (response?.success) {
        toast.success('Product updated')
        setShowEditModal(false)
        await loadProduct()
        await loadMovements()
      } else {
        toast.error(response?.message || 'Failed to update product')
      }
    } catch (error) {
      console.error('Update product failed:', error)
      if (!error?._handledByInterceptor) toast.error('Failed to update product')
    } finally {
      setSaving(false)
    }
  }

  const imageSrc = (url) => {
    if (!url) return null
    if (url.startsWith('http') || url.startsWith('/')) return url
    return `/uploads/${url}`
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <LoadingCard message="Loading product…" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <p className="text-neutral-600">Product not found</p>
          <Link to="/products" className="text-primary-600 hover:underline mt-4 inline-block min-h-11">
            Back to Products
          </Link>
        </div>
      </div>
    )
  }

  const isLowStock = (product.stockQty ?? 0) <= (product.reorderLevel ?? 0)
  const displayName = product.nameEn || product.name || product.sku

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-full overflow-x-hidden pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="p-2 rounded-lg hover:bg-neutral-100 min-h-11 min-w-11 inline-flex items-center justify-center shrink-0"
            aria-label="Back to products"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 break-words">{displayName}</h1>
            <p className="text-sm text-neutral-600 mt-0.5">Product details</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center px-4 py-2 min-h-11 border border-neutral-300 rounded-lg text-sm font-medium bg-white hover:bg-neutral-50"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </button>
          )}
          {canAdjustStock && (
            <button
              type="button"
              onClick={() => setShowStockModal(true)}
              className="inline-flex items-center px-4 py-2 min-h-11 border border-green-300 rounded-lg text-sm font-medium text-green-800 bg-green-50 hover:bg-green-100"
            >
              <Package className="h-4 w-4 mr-2" />
              Adjust stock
            </button>
          )}
          <Link
            to={`/stock-adjustments?productId=${product.id}`}
            className="inline-flex items-center px-4 py-2 min-h-11 border border-neutral-300 rounded-lg text-sm font-medium bg-white hover:bg-neutral-50"
          >
            <History className="h-4 w-4 mr-2" />
            Full history
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="shrink-0">
            {product.imageUrl ? (
              <img
                src={imageSrc(product.imageUrl)}
                alt={displayName}
                className="h-24 w-24 object-cover rounded-lg border border-neutral-200"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            ) : (
              <div className="h-24 w-24 bg-neutral-100 rounded-lg border border-neutral-200 flex items-center justify-center">
                <Package className="h-10 w-10 text-neutral-400" />
              </div>
            )}
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-neutral-500">SKU</span>
              <p className="font-medium text-neutral-900">{product.sku || '—'}</p>
            </div>
            <div>
              <span className="text-neutral-500 flex items-center gap-1">
                <Barcode className="h-3.5 w-3.5" /> Barcode
              </span>
              <p className="font-mono text-neutral-900">{product.barcode || '—'}</p>
            </div>
            <div>
              <span className="text-neutral-500 flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" /> Category
              </span>
              <p className="text-neutral-900">{product.categoryName || '—'}</p>
            </div>
            <div>
              <span className="text-neutral-500">Status</span>
              <p>
                {product.isActive === false ? (
                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-600">Inactive</span>
                ) : (
                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-800">Active</span>
                )}
              </p>
            </div>
            {product.nameAr && (
              <div className="sm:col-span-2">
                <span className="text-neutral-500">Name (AR)</span>
                <p className="text-neutral-900">{product.nameAr}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-medium text-neutral-500">Cost price</p>
          <p className="text-lg font-bold text-neutral-900 mt-1">{formatCurrency(product.costPrice ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-medium text-neutral-500">Sell price</p>
          <p className="text-lg font-bold text-neutral-900 mt-1">{formatCurrency(product.sellPrice ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-medium text-neutral-500">Unit / conversion</p>
          <p className="text-lg font-bold text-neutral-900 mt-1">
            {product.unitType || '—'}
            {product.conversionToBase != null && product.conversionToBase !== 1 ? (
              <span className="text-sm font-normal text-neutral-600"> ×{product.conversionToBase}</span>
            ) : null}
          </p>
        </div>
        <div className={`bg-white rounded-xl border p-4 ${isLowStock ? 'border-red-300 bg-red-50/50' : 'border-neutral-200'}`}>
          <p className="text-xs font-medium text-neutral-500 flex items-center gap-1">
            Stock
            {isLowStock && <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-hidden />}
          </p>
          <p className={`text-lg font-bold mt-1 ${isLowStock ? 'text-red-700' : 'text-neutral-900'}`}>
            {product.stockQty ?? 0}
            <span className="text-sm font-normal text-neutral-600"> / reorder {product.reorderLevel ?? 0}</span>
          </p>
        </div>
      </div>

      {(product.descriptionEn || product.descriptionAr) && (
        <div className="bg-white rounded-xl border border-neutral-200 p-4 md:p-6">
          <h2 className="text-base font-semibold text-neutral-900 mb-2">Description</h2>
          {product.descriptionEn && <p className="text-sm text-neutral-700">{product.descriptionEn}</p>}
          {product.descriptionAr && <p className="text-sm text-neutral-700 mt-2" dir="rtl">{product.descriptionAr}</p>}
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-neutral-900">Recent stock movements</h2>
          <button
            type="button"
            onClick={loadMovements}
            disabled={movementsLoading}
            className="inline-flex items-center px-3 py-2 min-h-11 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${movementsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        {movementsLoading ? (
          <p className="text-sm text-neutral-500 py-6 text-center">Loading movements…</p>
        ) : movements.length === 0 ? (
          <p className="text-sm text-neutral-500 py-6 text-center">No movements recorded yet.</p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto max-w-full">
              <table className="min-w-full text-sm divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-neutral-600">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-neutral-600">Type</th>
                    <th className="px-3 py-2 text-right font-medium text-neutral-600">Qty</th>
                    <th className="px-3 py-2 text-left font-medium text-neutral-600">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {movements.map((m) => (
                    <tr key={m.id ?? `${m.createdAt}-${m.changeQty}`}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {m.createdAt ? new Date(m.createdAt).toLocaleString('en-GB') : '—'}
                      </td>
                      <td className="px-3 py-2">{m.transactionType || m.type || '—'}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {(m.changeQty ?? m.quantity) > 0 ? '+' : ''}{m.changeQty ?? m.quantity ?? 0}
                      </td>
                      <td className="px-3 py-2 max-w-xs truncate">{m.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-2">
              {movements.map((m) => (
                <div key={m.id ?? `${m.createdAt}-${m.changeQty}`} className="border border-neutral-200 rounded-lg p-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{m.transactionType || m.type || 'Movement'}</span>
                    <span className="font-mono font-semibold">
                      {(m.changeQty ?? m.quantity) > 0 ? '+' : ''}{m.changeQty ?? m.quantity ?? 0}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    {m.createdAt ? new Date(m.createdAt).toLocaleString('en-GB') : ''}
                  </p>
                  {m.reason && <p className="text-xs text-neutral-600 mt-1">{m.reason}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl border border-neutral-200 shadow-lg">
            <div className="sticky top-0 bg-white border-b border-neutral-200 px-4 py-3 flex justify-between items-center">
              <h3 className="font-semibold text-neutral-900">Edit product</h3>
              <button type="button" onClick={() => setShowEditModal(false)} className="min-h-11 min-w-11 px-2 text-neutral-600">×</button>
            </div>
            <div className="p-4">
              <ProductForm product={product} saving={saving} onSave={handleSaveProduct} onCancel={() => setShowEditModal(false)} />
            </div>
          </div>
        </div>
      )}

      {showStockModal && (
        <StockAdjustmentModal
          product={product}
          onSave={handleStockAdjustmentSubmit}
          onCancel={() => setShowStockModal(false)}
        />
      )}
    </div>
  )
}

export default ProductDetailPage
