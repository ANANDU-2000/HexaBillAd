import { useState, useEffect } from 'react'
import { 
  Search, 
  Edit, 
  Save, 
  X, 
  DollarSign,
  RefreshCw,
  TrendingUp
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency } from '../../utils/currency'
import toast from 'react-hot-toast'
import { LoadingCard } from '../../components/Loading'
import { productsAPI } from '../../services'

const PriceList = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [editingProduct, setEditingProduct] = useState(null)
  const [editForm, setEditForm] = useState({ sellPrice: '', vatPercent: 5 })
  
  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    filterProducts()
  }, [searchTerm, products])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const response = await productsAPI.getProducts({ pageSize: 100 })
      if (response.success) {
        setProducts(response.data.items || [])
      }
    } catch (error) {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const filterProducts = () => {
    if (!searchTerm) {
      setFilteredProducts(products)
      return
    }
    
    const filtered = products.filter(product =>
      product.nameEn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredProducts(filtered)
  }

  const handleEdit = (product) => {
    setEditingProduct(product.id)
    setEditForm({
      sellPrice: product.sellPrice,
      vatPercent: 5
    })
  }

  const handleCancel = () => {
    setEditingProduct(null)
    setEditForm({ sellPrice: '', vatPercent: 5 })
  }

  const handleSave = async (productId) => {
    try {
      const newPrice = parseFloat(editForm.sellPrice)
      if (isNaN(newPrice) || newPrice < 0) {
        toast.error('Invalid price')
        return
      }

      // Update product price
      const response = await productsAPI.updateProduct(productId, {
        sellPrice: newPrice
      })

      if (response.success) {
        toast.success('Price updated successfully!')
        await loadProducts()
        setEditingProduct(null)
      } else {
        toast.error(response.message || 'Failed to update price')
      }
    } catch (error) {
      toast.error('Failed to update price')
    }
  }

  if (user?.role?.toLowerCase() !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <X className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only administrators can access this page.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <LoadingCard message="Loading price list..." />
  }

  const averagePrice = products.length > 0
    ? products.reduce((sum, p) => sum + p.sellPrice, 0) / products.length
    : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50">
      {/* Top Bar */}
      <div className="bg-blue-100 border-b-2 border-blue-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Price List Management</h1>
            <div className="text-xs text-gray-600">
              Manage all product prices from one place
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadProducts}
              className="px-3 py-1 text-xs font-medium bg-white border border-blue-300 rounded hover:bg-blue-50"
            >
              <RefreshCw className="h-4 w-4 inline mr-1" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border-2 border-lime-300 shadow-sm p-4">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600">Total Products</p>
                <p className="text-2xl font-bold text-green-900">{products.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border-2 border-lime-300 shadow-sm p-4">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600">Average Price</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatCurrency(averagePrice)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border-2 border-lime-300 shadow-sm p-4">
            <div className="flex items-center">
              <Search className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600">Search Results</p>
                <p className="text-2xl font-bold text-purple-900">{filteredProducts.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg border-2 border-lime-300 shadow-sm p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by product name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border-2 border-lime-300 rounded-md focus:ring-2 focus:ring-lime-400 focus:border-lime-400 text-sm"
            />
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-lg border-2 border-lime-300 shadow-sm overflow-hidden">
          <div className="p-3 border-b-2 border-lime-400 bg-lime-100">
            <h3 className="text-sm font-bold text-gray-900">Price List</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-lime-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-lime-300">SL</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-lime-300">Product Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-lime-300">SKU</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-lime-300">Unit</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r border-lime-300">Current Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r border-lime-300">Stock</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lime-200">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                      {searchTerm ? 'No products found matching your search' : 'No products available'}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product, index) => (
                    <tr key={product.id} className="hover:bg-lime-50">
                      <td className="px-4 py-4 text-center border-r border-lime-200">{index + 1}</td>
                      <td className="px-4 py-4 whitespace-nowrap border-r border-lime-200">
                        <div className="font-medium text-gray-900">{product.nameEn}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap border-r border-lime-200">
                        <div className="text-gray-600">{product.sku}</div>
                      </td>
                      <td className="px-4 py-4 text-center border-r border-lime-200">
                        <div className="text-gray-900">{product.unitType}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right border-r border-lime-200">
                        {editingProduct === product.id ? (
                          <div className="flex items-center space-x-2 justify-end">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-24 px-2 py-1 border border-lime-300 rounded text-xs"
                              value={editForm.sellPrice}
                              onChange={(e) => setEditForm({ ...editForm, sellPrice: e.target.value })}
                              autoFocus
                            />
                            <button
                              onClick={() => handleSave(product.id)}
                              className="text-green-600 hover:text-green-800"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={handleCancel}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="font-medium text-gray-900">
                            {formatCurrency(product.sellPrice)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right border-r border-lime-200">
                        <div className="text-gray-600">
                          {product.stockQty} {product.unitType}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        {editingProduct !== product.id && (
                          <button
                            onClick={() => handleEdit(product)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit Price"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <DollarSign className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>Price Update Note:</strong> Prices updated here will be immediately reflected in the POS system. 
                All price changes are logged in the audit log for security.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PriceList


