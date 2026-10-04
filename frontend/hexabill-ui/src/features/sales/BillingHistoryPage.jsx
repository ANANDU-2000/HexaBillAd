import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { 
  Search, 
  Eye, 
  Download,
  Printer,
  Calendar,
  RefreshCw,
  FileText,
  Wallet,
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
import { salesAPI, paymentsAPI } from '../../services/index'
import { formatCurrency } from '../../utils/currency'
import { getInvoicePaymentBadge, isInvoiceFullySettled } from '../../utils/salePaymentSettlement'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'
import { Input } from '../../components/Form'
import InvoicePreviewModal from '../../components/InvoicePreviewModal'
import ReceiptPreviewModal from '../../components/ReceiptPreviewModal'
import ConfirmDangerModal from '../../components/ConfirmDangerModal'
import { syncBillingHistorySearchParams } from '../../utils/billingHistoryUrl'
import { buildCustomerLedgerHref } from '../../utils/customerLedgerUrl'

const BillingHistoryPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState([])
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [currentPage, setCurrentPage] = useState(() => Number(searchParams.get('page')) || 1)
  const [pageSize, setPageSize] = useState(30)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [dateFilter, setDateFilter] = useState(() => ({
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || ''
  }))
  const [selectedSale, setSelectedSale] = useState(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [selectedInvoices, setSelectedInvoices] = useState([])
  const [saleToDelete, setSaleToDelete] = useState(null)
  const [showReceiptPreviewModal, setShowReceiptPreviewModal] = useState(false)
  const [receiptPreviewPaymentIds, setReceiptPreviewPaymentIds] = useState([])
  const [loadingReceiptSaleId, setLoadingReceiptSaleId] = useState(null)
  const [listError, setListError] = useState(false)
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'owner'
  const canEdit = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'owner' // Admin and Owner can edit

  const fetchSales = useCallback(async () => {
    try {
      setLoading(true)
      setListError(false)

      const params = {
        page: currentPage,
        pageSize: pageSize
      }

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim()
      }

      if (dateFilter.from) {
        params.fromDate = dateFilter.from
      }
      if (dateFilter.to) {
        params.toDate = dateFilter.to
      }

      const response = await salesAPI.getSales(params)

      if (response.success && response.data) {
        setSales(response.data.items || [])
        setTotalCount(response.data.totalCount || 0)
        setTotalPages(response.data.totalPages || 1)
      } else {
        setListError(true)
      }
    } catch (error) {
      console.error('Error fetching sales:', error)
      setListError(true)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, debouncedSearch, dateFilter])

  const fetchSalesRef = useRef(fetchSales)
  fetchSalesRef.current = fetchSales

  useEffect(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      syncBillingHistorySearchParams(params, {
        search: debouncedSearch,
        page: currentPage,
        from: dateFilter.from,
        to: dateFilter.to
      })
      return params
    }, { replace: true })
  }, [debouncedSearch, currentPage, dateFilter.from, dateFilter.to, setSearchParams])

  useEffect(() => {
    const page = Number(searchParams.get('page')) || 1
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    const search = searchParams.get('search') || ''
    setCurrentPage((c) => (c === page ? c : page))
    setDateFilter((d) => (d.from === from && d.to === to ? d : { from, to }))
    setSearchTerm((s) => (s === search ? s : search))
  }, [searchParams])

  // Live search + pagination + dates
  useEffect(() => {
    fetchSalesRef.current()
  }, [currentPage, pageSize, debouncedSearch, dateFilter.from, dateFilter.to])

  // Reset to page 1 when search text settles
  const prevSearch = useRef(debouncedSearch)
  useEffect(() => {
    if (prevSearch.current !== debouncedSearch) {
      prevSearch.current = debouncedSearch
      if (currentPage !== 1) setCurrentPage(1)
    }
  }, [debouncedSearch, currentPage])

  // After POS/payment updates: refresh with current page + filters (ref avoids stale closure from [])
  useEffect(() => {
    const handleDataUpdate = () => {
      fetchSalesRef.current()
    }
    window.addEventListener('dataUpdated', handleDataUpdate)
    return () => {
      window.removeEventListener('dataUpdated', handleDataUpdate)
    }
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (dateFilter.from && dateFilter.to && dateFilter.from > dateFilter.to) {
      toast.error('From date must be on or before To date')
      return
    }
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
        toast.success('Invoice deleted successfully!', { id: 'invoice-delete', duration: 4000 })
        setSales(prev => prev.filter(s => s.id !== saleId))
        setTotalCount(prev => Math.max(0, prev - 1))
        window.dispatchEvent(new CustomEvent('dataUpdated'))
      } else {
        toast.error(response.message || 'Failed to delete invoice', { id: 'invoice-delete' })
      }
    } catch (error) {
      console.error('Failed to delete sale:', error)
      toast.error(error?.response?.data?.message || 'Failed to delete invoice')
    }
  }

  const billingReturnTo = location.pathname + location.search

  const openCustomerLedgerForSale = (sale) => {
    const customerId = sale?.customerId ?? sale?.CustomerId
    if (!customerId) {
      toast.error('This invoice has no customer ledger')
      return
    }
    const needsPayment = !isInvoiceFullySettled(sale)
    navigate(
      buildCustomerLedgerHref({
        customerId,
        recordPaymentSaleId: needsPayment ? sale.id : undefined
      }),
      { state: { returnTo: billingReturnTo } }
    )
  }

  const handleEditSale = (sale) => {
    navigate(`/pos?editId=${sale.id}`, { state: { returnTo: location.pathname + location.search } })
  }

  const saleHasReceipt = (sale) => {
    const badge = getInvoicePaymentBadge(sale)
    return badge.label === 'Paid' || badge.label === 'Partial' || isInvoiceFullySettled(sale)
  }

  const handlePrintPaymentReceipt = async (sale) => {
    if (!sale?.id || !saleHasReceipt(sale)) {
      toast.error('No payment receipt for unpaid invoices')
      return
    }
    try {
      setLoadingReceiptSaleId(sale.id)
      toast.loading('Loading payment receipt...', { id: 'bh-receipt' })
      const response = await paymentsAPI.getInvoiceReceiptPaymentIds(sale.id)
      if (!response?.success || !Array.isArray(response.data)) {
        throw new Error(response?.message || 'Invoice payments could not be loaded. Please try again.')
      }
      const ids = response.data
      if (ids.length === 0) {
        toast.error('No cleared incoming payments found for this invoice', { id: 'bh-receipt' })
        return
      }
      toast.dismiss('bh-receipt')
      setReceiptPreviewPaymentIds(ids)
      setShowReceiptPreviewModal(true)
    } catch (error) {
      if (!error?._handledByInterceptor) {
        toast.error(error?.response?.data?.message || error?.message || 'Failed to load payment receipt', { id: 'bh-receipt' })
      } else {
        toast.dismiss('bh-receipt')
      }
    } finally {
      setLoadingReceiptSaleId(null)
    }
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
    if (selectedInvoices.length === sales.length) {
      setSelectedInvoices([])
    } else {
      setSelectedInvoices(sales.map(sale => sale.id))
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
      const today = new Date()
      const y = today.getFullYear()
      const m = String(today.getMonth() + 1).padStart(2, '0')
      const d = String(today.getDate()).padStart(2, '0')
      link.download = `Combined_Invoices_${y}-${m}-${d}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.dismiss()
      toast.success(`Combined PDF generated for ${selectedInvoices.length} invoice(s)`, { id: 'combined-pdf', duration: 4000 })
      setSelectedInvoices([])
    } catch (error) {
      toast.dismiss()
      console.error('Failed to generate combined PDF:', error)
      toast.error('Could not export the invoices.', { id: 'combined-pdf' })
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    try {
      const date = new Date(dateString)
      if (Number.isNaN(date.getTime())) return '—'
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } catch {
      return '—'
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

  return (
    <div className="space-y-3 max-w-full overflow-x-hidden h-full min-h-0 flex flex-col">
      {/* Header + compact filters */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-neutral-900">Billing History</h1>
            <p className="text-xs text-gray-500">
              Showing {sales.length} of {totalCount} invoices
            </p>
          </div>
          {selectedInvoices.length > 0 && (
            <button
              onClick={handleCombinedPdf}
              className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Combined PDF ({selectedInvoices.length})
            </button>
          )}
        </div>

        <form onSubmit={handleSearch} className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 flex flex-wrap items-center gap-1.5">
          <div className="relative flex-1 min-w-[10rem]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
            <input
              type="search"
              placeholder="Invoice #, customer, status, method…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded pl-7 pr-2 py-2 min-h-11 text-sm"
            />
          </div>
          <input
            type="date"
            value={dateFilter.from}
            onChange={(e) => { setDateFilter({ ...dateFilter, from: e.target.value }); setCurrentPage(1) }}
            className="border border-gray-300 rounded px-2 min-h-11 md:min-h-9 text-sm md:text-xs w-[8.5rem]"
            title="From"
          />
          <input
            type="date"
            value={dateFilter.to}
            onChange={(e) => { setDateFilter({ ...dateFilter, to: e.target.value }); setCurrentPage(1) }}
            className="border border-gray-300 rounded px-2 min-h-11 md:min-h-9 text-sm md:text-xs w-[8.5rem]"
            title="To"
          />
          {(searchTerm || dateFilter.from || dateFilter.to) && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs text-gray-700 bg-white hover:bg-gray-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={fetchSales}
            className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs text-gray-700 bg-white hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>

      {/* Sales Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading && sales.length === 0 && !listError ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">Loading billing history…</p>
        ) : listError && sales.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-neutral-700">Unable to load billing history.</p>
            <button type="button" className="mt-2 text-sm text-primary-700" onClick={() => fetchSales()}>Retry</button>
          </div>
        ) : sales.length === 0 ? (
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
            {listError && (
              <p className="px-3 py-2 text-xs text-neutral-700 border-b border-neutral-200">
                Unable to refresh billing history.{' '}
                <button type="button" className="text-primary-700" onClick={() => fetchSales()}>Retry</button>
              </p>
            )}
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={toggleSelectAll}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {selectedInvoices.length === sales.length && sales.length > 0 ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subtotal
                    </th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      VAT
                    </th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" title="First cleared payment mode (Cash, Debit, …). Not the same as Paid/Partial.">
                      Method
                    </th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 z-20 bg-gray-50 shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.15)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sales.map((sale) => {
                    const payBadge = getInvoicePaymentBadge(sale)
                    return (
                    <tr key={sale.id} className="group hover:bg-gray-50">
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <button
                          onClick={() => toggleSelectInvoice(sale.id)}
                          className="text-gray-500 hover:text-blue-600"
                        >
                          {selectedInvoices.includes(sale.id) ? (
                            <CheckSquare className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {sale.invoiceNo || `#${sale.id}`}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(sale.invoiceDate)}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {sale.customerName || 'Cash Customer'}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(sale.subtotal || 0)}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(sale.vatTotal || 0)}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        {formatCurrency(sale.grandTotal || 0)}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${payBadge.colorClass}`}>
                          {payBadge.label}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-600">
                        {sale.primaryPaymentMode ? (
                          <span title="Payment mode from first cleared line">{sale.primaryPaymentMode}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-3 py-1.5 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium sticky right-0 z-10 bg-white group-hover:bg-gray-50 shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.08)]">
                        <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                          <button
                            onClick={() => handleViewInvoice(sale)}
                            className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors"
                            title="View Invoice"
                            aria-label="View Invoice"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {sale.customerId && (
                            <button
                              type="button"
                              onClick={() => openCustomerLedgerForSale(sale)}
                              className="inline-flex h-8 w-8 items-center justify-center text-emerald-700 hover:bg-emerald-50 rounded-md"
                              title={isInvoiceFullySettled(sale) ? 'Customer ledger' : 'Customer ledger — collect payment'}
                              aria-label={isInvoiceFullySettled(sale) ? 'Customer ledger' : 'Collect payment in ledger'}
                            >
                              <Wallet className="h-4 w-4" />
                            </button>
                          )}
                          {saleHasReceipt(sale) && (
                            <button
                              onClick={() => handlePrintPaymentReceipt(sale)}
                              disabled={loadingReceiptSaleId === sale.id}
                              className="inline-flex h-8 w-8 items-center justify-center text-neutral-700 hover:bg-neutral-100 rounded-md disabled:opacity-50"
                              title="Print payment receipt"
                              aria-label="Print payment receipt"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleEditSale(sale)}
                              className="inline-flex h-8 w-8 items-center justify-center text-neutral-700 hover:bg-neutral-100 rounded-md"
                              title="Edit Invoice"
                              aria-label="Edit Invoice"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteSale(sale.id)}
                              className="bg-red-50 text-red-600 hover:text-white hover:bg-red-600 border border-red-300 p-1.5 rounded transition-colors shadow-sm"
                              title="Delete Invoice (Admin Only)"
                              aria-label="Delete Invoice (Admin Only)"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {sales.map((sale) => {
                const payBadge = getInvoicePaymentBadge(sale)
                return (
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
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${payBadge.colorClass}`}>
                        {payBadge.label}
                      </span>
                      {sale.primaryPaymentMode && (
                        <div className="text-xs text-gray-500 mt-1">Method: {sale.primaryPaymentMode}</div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-gray-500">Customer</div>
                      <div className="font-medium text-gray-900">
                        {sale.customerName || 'Cash Customer'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Total</div>
                      <div className="font-medium text-gray-900">
                        {formatCurrency(sale.grandTotal || 0)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button
                      onClick={() => handleViewInvoice(sale)}
                      className="min-h-11 inline-flex items-center justify-center px-3 py-2 border border-primary-300 rounded-md text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </button>
                    {sale.customerId && (
                      <button
                        type="button"
                        onClick={() => openCustomerLedgerForSale(sale)}
                        className="min-h-11 inline-flex items-center justify-center px-3 py-2 border border-emerald-200 rounded-md text-sm font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
                      >
                        <Wallet className="h-4 w-4 mr-2" aria-hidden />
                        {isInvoiceFullySettled(sale) ? 'Ledger' : 'Collect'}
                      </button>
                    )}
                    {saleHasReceipt(sale) && (
                      <button
                        onClick={() => handlePrintPaymentReceipt(sale)}
                        disabled={loadingReceiptSaleId === sale.id}
                        className="min-h-11 inline-flex items-center justify-center px-3 py-2 border border-neutral-300 rounded-md text-sm font-medium text-neutral-800 bg-white hover:bg-neutral-50 disabled:opacity-50"
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Receipt
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => handleEditSale(sale)}
                        className="min-h-11 inline-flex items-center justify-center px-3 py-2 border border-neutral-300 rounded-md text-sm font-medium text-neutral-800 bg-white hover:bg-neutral-50"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteSale(sale.id)}
                        className="min-h-11 inline-flex items-center justify-center px-3 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                )
              })}
            </div>

            {/* Pagination */}
            {(totalPages > 1 || totalCount > 10) && (
              <div className="bg-gray-50 px-3 py-1.5 flex items-center justify-between border-t border-gray-200 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    {[10, 20, 50, 100].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
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

      <ReceiptPreviewModal
        paymentIds={receiptPreviewPaymentIds}
        isOpen={showReceiptPreviewModal}
        onClose={() => {
          setShowReceiptPreviewModal(false)
          setReceiptPreviewPaymentIds([])
        }}
      />

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


