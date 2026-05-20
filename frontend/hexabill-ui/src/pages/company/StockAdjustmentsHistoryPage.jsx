import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { productsAPI } from '../../services'
import { LoadingCard } from '../../components/Loading'

const todayStr = () => new Date().toISOString().split('T')[0]

const StockAdjustmentsHistoryPage = () => {
  const [searchParams] = useSearchParams()
  const productIdParam = searchParams.get('productId')
  const productIdNum = productIdParam ? parseInt(productIdParam, 10) : NaN
  const filterProductId = !Number.isNaN(productIdNum) && productIdNum > 0 ? productIdNum : null

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(todayStr)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await productsAPI.getStockAdjustments({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        ...(filterProductId ? { productId: filterProductId } : {})
      })
      if (res?.success && Array.isArray(res.data)) {
        setRows(res.data)
      } else {
        setRows([])
        if (res && res.success === false) toast.error(res.message || 'Failed to load adjustments')
      }
    } catch (e) {
      if (!e?._handledByInterceptor) toast.error(e?.response?.data?.message || 'Failed to load stock adjustments')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, filterProductId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/more"
          className="inline-flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <Package className="h-6 w-6 text-primary-600 shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Stock adjustment history</h1>
            <p className="text-sm text-gray-600">Manual corrections from the product catalog (same data as adjust-stock).</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm min-h-11"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm min-h-11"
          />
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 min-h-11"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
        <Link to="/products" className="text-sm text-primary-700 hover:underline ml-auto">
          Back to products
        </Link>
      </div>

      {filterProductId ? (
        <div className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 flex flex-wrap items-center justify-between gap-2">
          <span>Filtered to product ID <strong>{filterProductId}</strong> (from Products).</span>
          <Link to="/stock-adjustments" className="font-medium text-primary-800 hover:underline">
            Clear product filter
          </Link>
        </div>
      ) : null}

      {loading ? (
        <LoadingCard message="Loading adjustments..." />
      ) : rows.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-600">
          No stock adjustments in this date range.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Change</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Old → New</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-800">
                      {r.adjustedAt ? new Date(r.adjustedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{r.productName || `#${r.productId}`}</td>
                    <td className={`px-4 py-3 text-right font-mono ${Number(r.adjustment) < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {Number(r.adjustment) > 0 ? '+' : ''}{r.adjustment}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 font-mono text-xs">
                      {r.oldStock} → {r.newStock}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-md break-words">{r.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default StockAdjustmentsHistoryPage
