import { useState, useEffect } from 'react'
import { 
  Search, 
  Eye, 
  Download,
  Printer,
  Calendar,
  Filter,
  RefreshCw,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Edit,
  Maximize2,
  CheckSquare,
  Square
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { salesAPI } from '../../services'
import { formatCurrency } from '../../utils/currency'
import toast from 'react-hot-toast'
import { LoadingCard } from '../../components/Loading'
import { Input } from '../../components/Form'
import InvoicePreviewModal from '../../components/InvoicePreviewModal'
import ConfirmDangerModal from '../../components/ConfirmDangerModal'

const BillingHistoryPage = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState([])
  const [filteredSales, setFilteredSales] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [dateFilter, setDateFilter] = useState({
    from: '',
    to: ''
  })
  const [selectedSale, setSelectedSale] = useState(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [selectedInvoices, setSelectedInvoices] = useState([])
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'owner'
  const canEdit = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'owner' // Admin and Owner can edit

  useEffect(() => {
    fetchSales()
    // Filters don't trigger auto-fetch - use Apply Filter button
  }, [currentPage])

  useEffect(() => {
    filterSales()
  }, [sales, searchTerm])

  // Listen for data update events to refresh when payments are made
  useEffect(() => {
    const handleDataUpdate = () => {
      fetchSales()
    }
    
    window.addEventListener('dataUpdated', handleDataUpdate)
    
    return () => {
      window.removeEventListener('dataUpdated', handleDataUpdate)
    }
  }, [])

  const fetchSales = async () => {
    try {
      setLoading(true)
      
      // Build query parameters
      const params = {
        page: currentPage,
        pageSize: pageSize
      }
      
      // Add search if exists
      if (searchTerm.trim()) {
        params.search = searchTerm.trim()
      }
      
      // Add date filters if set
      if (dateFilter.from) {
        params.fromDate = dateFilter.from
      }
      if (dateFilter.to) {
        params.toDate = dateFilter.to
      }

      const response = await salesAPI.getSales(params)
      
      if (response.success && response.data) {
        setSales(response.data.items || [])
        setFilteredSales(response.data.items || [])
        setTotalCount(response.data.totalCount || 0)
        setTotalPages(response.data.totalPages || 1)
      } else {
        toast.error(response.message || 'Failed to load billing history')
      }
    } catch (error) {
      console.error('Error fetching sales:', error)
      toast.error(error.message || 'Failed to load billing history')
    } finally {
      setLoading(false)
    }
  }

  const filterSales = () => {
    if (!searchTerm.trim()) {
      setFilteredSales(sales)
      return
    }

    const term = searchTerm.toLowerCase()
    const filtered = sales.filter(sale => 
      sale.invoiceNo?.toLowerCase().includes(term) ||
      sale.customerName?.toLowerCase().includes(term) ||
      sale.id?.toString().includes(term)
    )
    setFilteredSales(filtered)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchSales()
  }

  const handleDateFilter = () => {
    setCurrentPage(1)
    fetchSales()
  }

  const clearFilters = () => {
    setSearchTerm('')
    setDateFilter({ from: '', to: '' })
    setCurrentPage(1)
    setTimeout(() => fetchSales(), 100)
  }

  const handleViewInvoice = (sale) => {
    setSelectedSale(sale)
    setShowInvoiceModal(true)
  }

  const handleDeleteSale = (saleId) => {
    setSaleToDelete(saleId)
  }

  const handleConfirmDeleteSale = async () => {
    if (!saleToDelete) return
    const saleId = saleToDelete
    setSaleToDelete(null)
    try {
      const response = await salesAPI.deleteSale(saleId)
      if (response.success) {
        toast.success('Invoice deleted successfully!')
        setSales(prev => prev.filter(s => s.id !== saleId))
        setFilteredSales(prev => prev.filter(s => s.id !== saleId))
        setTotalCount(prev => Math.max(0, prev - 1))
      } else {
        toast.error(response.message || 'Failed to delete invoice')
      }
    } catch (error) {
      console.error('Failed to delete sale:', error)
      toast.error(error?.response?.data?.message || 'Failed to delete invoice')
    }
  }

  const handleEditSale = (sale) => {
    // Navigate to POS page with sale ID for editing
    window.open(`/pos?editId=${sale.id}`, '_blank')
  }

  const toggleSelectInvoice = (saleId) => {
    setSelectedInvoices(prev => {
      if (prev.includes(saleId)) {
        return prev.filter(id => id !== saleId)
      } else {
        return [...prev, saleId]
      }
    })
  }

  const toggleSelectAll = () => {
    if (selectedInvoices.length === filteredSales.length) {
      setSelectedInvoices([])
    } else {
      setSelectedInvoices(filteredSales.map(sale => sale.id))
    }
  }

  const handleCombinedPdf = async () => {
    if (selectedInvoices.length === 0) {
      toast.error('Please select at least one invoice')
      return
    }

    try {
      toast.loading('Generating combined PDF...')
      const blob = await salesAPI.getCombinedInvoicesPdf(selectedInvoices)
      
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Combined_Invoices_${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.dismiss()
      toast.success(`Combined PDF generated for ${selectedInvoices.length} invoice(s)`)
      setSelectedInvoices([])
    } catch (error) {
      toast.dismiss()
      console.error('Failed to generate combined PDF:', error)
      toast.error(error.message || 'Failed to generate combined PDF')
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const getPaymentStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || ''
    if (statusLower.includes('paid') || statusLower.includes('complete')) {
      return 'bg-green-100 text-green-800'
    } else if (statusLower.includes('partial')) {
      return 'bg-yellow-100 text-yellow-800'
    } else {
      return 'bg-red-100 text-red-800'
    }
  }

  const getPaymentStatusText = (status) => {
    const statusLower = status?.toLowerCase() || 'pending'
    if (statusLower.includes('paid')) return 'Paid'
    if (statusLower.includes('partial')) return 'Partial'
    return 'Pending'
  }

  if (loading && sales.length === 0) {
    return <LoadingCard message="Loading billing history..." />
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Billing History</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            View and manage all invoices and bills
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedInvoices.length > 0 && (
            <button
              onClick={handleCombinedPdf}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-green-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Combined PDF ({selectedInvoices.length})
            </button>
          )}
          <button
            onClick={fetchSales}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="Search by invoice number, customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Date From */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="date"
                placeholder="From Date"
                value={dateFilter.from}
                onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value })}
                className="pl-10"
              />
            </div>

            {/* Date To */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="date"
                placeholder="To Date"
                value={dateFilter.to}
                onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Filter className="h-4 w-4 mr-2" />
                Apply Filters
              </button>
              {(searchTerm || dateFilter.from || dateFilter.to) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </button>
              )}
            </div>
            <div className="text-sm text-gray-500">
              Showing {filteredSales.length} of {totalCount} invoices
            </div>
          </div>
        </form>
      </div>

      {/* Sales Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filteredSales.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || dateFilter.from || dateFilter.to
                ? 'Try adjusting your filters'
                : 'Start by creating your first invoice from POS'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={toggleSelectAll}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {selectedInvoices.length === filteredSales.length && filteredSales.length > 0 ? (
                          <CheckSquare className="h-5 w-5" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subtotal
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      VAT
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleSelectInvoice(sale.id)}
                          className="text-gray-500 hover:text-blue-600"
                        >
                          {selectedInvoices.includes(sale.id) ? (
                            <CheckSquare className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {sale.invoiceNo || `#${sale.id}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(sale.invoiceDate)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {sale.customerName || 'Cash Customer'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(sale.subtotal || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(sale.vatTotal || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        {formatCurrency(sale.grandTotal || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(sale.paymentStatus)}`}>
                          {getPaymentStatusText(sale.paymentStatus)}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                        <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                          <button
                            onClick={() => handleViewInvoice(sale)}
                            className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors"
                            title="View Invoice"
                            aria-label="View Invoice"
                          >
                            <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleEditSale(sale)}
                              className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
                              title="Edit Invoice"
                              aria-label="Edit Invoice"
                            >
                              <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteSale(sale.id)}
                              className="bg-red-50 text-red-600 hover:text-white hover:bg-red-600 border border-red-300 p-1.5 rounded transition-colors shadow-sm"
                              title="Delete Invoice (Admin Only)"
                              aria-label="Delete Invoice (Admin Only)"
                            >
                              <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {filteredSales.map((sale) => (
                <div key={sale.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {sale.invoiceNo || `#${sale.id}`}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(sale.invoiceDate)}
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(sale.paymentStatus)}`}>
                      {getPaymentStatusText(sale.paymentStatus)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-gray-500">Customer</div>
                      <div className="font-medium text-gray-900">
                        {sale.customerName || 'Walk-in Customer'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Total</div>
                      <div className="font-medium text-gray-900">
                        {formatCurrency(sale.grandTotal || 0)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleViewInvoice(sale)}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => handleEditSale(sale)}
                        className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-indigo-300 rounded-md text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteSale(sale.id)}
                        className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Page <span className="font-medium">{currentPage}</span> of{' '}
                  <span className="font-medium">{totalPages}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invoice Preview Modal */}
      {showInvoiceModal && selectedSale && (
        <InvoicePreviewModal
          saleId={selectedSale.id}
          invoiceNo={selectedSale.invoiceNo}
          onClose={() => {
            setShowInvoiceModal(false)
            setSelectedSale(null)
          }}
          onPrint={() => {
            // Handle print callback if needed
          }}
        />
      )}

      <ConfirmDangerModal
        isOpen={!!saleToDelete}
        onClose={() => setSaleToDelete(null)}
        onConfirm={handleConfirmDeleteSale}
        title="Delete invoice"
        message="WARNING: This will restore stock and cannot be undone. Are you sure you want to delete this invoice?"
        confirmLabel="Delete"
        requireTypedText="DELETE"
      />
    </div>
  )
}

export default BillingHistoryPage


