import { useState, useEffect } from 'react'
import { 
  Download, 
  Filter,
  X,
  FileText
} from 'lucide-react'
import { formatCurrency, formatBalance } from '../../utils/currency'
import toast from 'react-hot-toast'
import { LoadingCard } from '../../components/Loading'
import { Input, Select } from '../../components/Form'
import { reportsAPI } from '../../services'

const SalesLedgerPage = () => {
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  })
  const [filters, setFilters] = useState({
    date: '',
    name: '',
    type: '',
    status: '',
    invoiceNo: '',
    realPendingMin: '',
    realPendingMax: '',
    realGotPaymentMin: '',
    realGotPaymentMax: ''
  })
  const [reportData, setReportData] = useState({
    salesLedger: [],
    salesLedgerSummary: null
  })
  const [showFilters, setShowFilters] = useState(true)

  useEffect(() => {
    fetchSalesLedger()
  }, [dateRange])

  // Listen for data update events to refresh when payments are made
  useEffect(() => {
    const handleDataUpdate = () => {
      fetchSalesLedger()
    }
    
    window.addEventListener('dataUpdated', handleDataUpdate)
    
    return () => {
      window.removeEventListener('dataUpdated', handleDataUpdate)
    }
  }, [])

  const fetchSalesLedger = async () => {
    setLoading(true)
    try {
      const ledgerResponse = await reportsAPI.getComprehensiveSalesLedger({
        fromDate: dateRange.from,
        toDate: dateRange.to
      })

      if (ledgerResponse?.success && ledgerResponse?.data) {
        const entries = ledgerResponse.data.entries || []
        const summary = ledgerResponse.data.summary || {}
        
        const ledgerWithBalance = entries.map(entry => ({
          date: new Date(entry.date),
          type: entry.type,
          invoiceNo: entry.invoiceNo || '-',
          customerId: entry.customerId,
          customerName: entry.customerName || 'Cash Customer',
          paymentMode: entry.paymentMode || '-',
          // CRITICAL: Handle both camelCase and PascalCase from backend
          grandTotal: entry.grandTotal || entry.GrandTotal || 0, // Full invoice amount
          paidAmount: entry.paidAmount || entry.PaidAmount || 0, // Amount paid for invoice
          realPending: entry.realPending || entry.RealPending || 0,
          realGotPayment: entry.realGotPayment || entry.RealGotPayment || 0, // For sales: shows paidAmount, for payments: shows payment amount
          status: entry.status || 'Unpaid',
          customerBalance: entry.customerBalance || entry.CustomerBalance || 0,
          planDate: entry.planDate ? new Date(entry.planDate) : null,
          saleId: entry.saleId || entry.SaleId,
          paymentId: entry.paymentId || entry.PaymentId
        }))

        setReportData({
          salesLedger: ledgerWithBalance,
          salesLedgerSummary: summary
        })
      } else {
        setReportData({ salesLedger: [], salesLedgerSummary: null })
      }
    } catch (error) {
      console.error('Error loading sales ledger:', error)
      toast.error('Failed to load sales ledger')
      setReportData({ salesLedger: [], salesLedgerSummary: null })
    } finally {
      setLoading(false)
    }
  }

  // Apply filters to sales ledger data
  const getFilteredLedger = () => {
    let filteredLedger = [...reportData.salesLedger]
    
    if (filters.date) {
      const filterDate = new Date(filters.date)
      filterDate.setHours(0, 0, 0, 0)
      const filterDateEnd = new Date(filterDate)
      filterDateEnd.setHours(23, 59, 59, 999)
      
      filteredLedger = filteredLedger.filter(entry => {
        const entryDate = new Date(entry.date)
        return entryDate >= filterDate && entryDate <= filterDateEnd
      })
    }
    
    if (filters.name) {
      const nameFilter = filters.name.toLowerCase()
      filteredLedger = filteredLedger.filter(entry =>
        (entry.customerName || '').toLowerCase().includes(nameFilter)
      )
    }
    
    if (filters.type) {
      filteredLedger = filteredLedger.filter(entry =>
        entry.type === filters.type
      )
    }
    
    if (filters.status) {
      filteredLedger = filteredLedger.filter(entry => {
        const normalizeStatus = (status) => {
          if (!status || status === '-') return 'Unpaid'
          const statusUpper = status.toUpperCase()
          if (statusUpper === 'PAID' || statusUpper === 'CLEARED') return 'Paid'
          if (statusUpper === 'PARTIAL') return 'Partial'
          if (statusUpper === 'UNPAID' || statusUpper === 'PENDING' || statusUpper === 'DUE') return 'Unpaid'
          return status
        }
        
        const normalizedEntryStatus = normalizeStatus(entry.status)
        const normalizedFilterStatus = normalizeStatus(filters.status)
        
        return normalizedEntryStatus === normalizedFilterStatus
      })
    }
    
    if (filters.invoiceNo) {
      const invoiceFilter = filters.invoiceNo.toLowerCase()
      filteredLedger = filteredLedger.filter(entry =>
        (entry.invoiceNo || '').toLowerCase().includes(invoiceFilter)
      )
    }
    
    if (filters.realPendingMin) {
      const realPendingMin = parseFloat(filters.realPendingMin)
      filteredLedger = filteredLedger.filter(entry =>
        (entry.realPending || 0) >= realPendingMin
      )
    }
    if (filters.realPendingMax) {
      const realPendingMax = parseFloat(filters.realPendingMax)
      filteredLedger = filteredLedger.filter(entry =>
        (entry.realPending || 0) <= realPendingMax
      )
    }
    
    if (filters.realGotPaymentMin) {
      const realGotPaymentMin = parseFloat(filters.realGotPaymentMin)
      filteredLedger = filteredLedger.filter(entry =>
        (entry.realGotPayment || 0) >= realGotPaymentMin
      )
    }
    if (filters.realGotPaymentMax) {
      const realGotPaymentMax = parseFloat(filters.realGotPaymentMax)
      filteredLedger = filteredLedger.filter(entry =>
        (entry.realGotPayment || 0) <= realGotPaymentMax
      )
    }
    
    return filteredLedger.map(entry => ({
      ...entry,
      balance: entry.customerBalance || 0
    }))
  }

  const filteredLedger = getFilteredLedger()
  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  // Calculate filtered summary - REAL CALCULATIONS (CORRECTED & SIMPLIFIED)
  const salesEntries = filteredLedger.filter(e => e.type === 'Sale')
  const paymentEntries = filteredLedger.filter(e => e.type === 'Payment')
  
  // CRITICAL CORRECTIONS - REAL DATA CALCULATIONS:
  // 1. Total Sales = Sum of GrandTotal from all sales (invoice amounts) - REAL BILL AMOUNTS
  const totalSales = salesEntries.reduce((sum, e) => sum + (e.grandTotal || 0), 0)
  
  // 2. Total Paid Amount = ONLY from sales entries (paidAmount field)
  // CRITICAL: paidAmount on sales already includes all payments received for that invoice
  // We should NOT add payment entries separately to avoid double-counting
  // When type="Sale" is selected, payment entries should not be in the list anyway
  let totalPayments = salesEntries.reduce((sum, e) => sum + (e.paidAmount || 0), 0)
  
  // Only add payment entries if type filter is "Payment" only (not "Sale")
  // This ensures: Total Payments <= Total Sales (logically correct)
  if (filters.type === 'Payment' && paymentEntries.length > 0) {
    // When showing only payments, use payment amounts
    totalPayments = paymentEntries.reduce((sum, e) => sum + (e.realGotPayment || 0), 0)
  } else if (filters.type === '' && paymentEntries.length > 0) {
    // When showing both, use sales paidAmount (more accurate, already includes payments)
    // Don't double-count by adding payment entries
    totalPayments = salesEntries.reduce((sum, e) => sum + (e.paidAmount || 0), 0)
  }
  
  // 3. Real Pending = Sum of unpaid amounts (GrandTotal - PaidAmount) from sales only
  // This is the amount still owed on invoices
  const totalRealPending = salesEntries.reduce((sum, e) => sum + (e.realPending || 0), 0)
  
  // 4. Pending Balance = Total Sales - Total Payments (net outstanding)
  // This is the actual amount still owed after all payments
  // CRITICAL: Ensure payments never exceed sales (logically impossible)
  const pendingBalance = Math.max(0, totalSales - totalPayments)
  
  // Total Invoices = Count of sales entries (not transactions)
  const totalInvoices = salesEntries.length
  
  const filteredSummary = {
    totalSales,           // Total bill amounts (invoices)
    totalPayments,        // Total paid (from sales + payments)
    totalRealPending,     // Total pending (unpaid amounts)
    totalRealGotPayment: totalPayments, // Alias for compatibility
    pendingBalance,       // Net balance (Sales - Payments)
    totalInvoices         // Count of invoices
  }

  const handleExport = async () => {
    try {
      toast.loading('Generating PDF...')
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
      
      // Build query params with filters
      const params = new URLSearchParams({
        fromDate: dateRange.from,
        toDate: dateRange.to
      })
      
      // Add type filter if selected
      if (filters.type) {
        params.append('type', filters.type)
      }
      
      const response = await fetch(
        `${API_BASE_URL}/reports/sales-ledger/export/pdf?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      )
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const fileName = filters.type 
          ? `sales_ledger_${filters.type.toLowerCase()}_${dateRange.from}_${dateRange.to}.pdf`
          : `sales_ledger_${dateRange.from}_${dateRange.to}.pdf`
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
        toast.dismiss()
        toast.success('PDF exported successfully!')
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to export PDF')
      }
    } catch (error) {
      console.error('Failed to export PDF:', error)
      toast.dismiss()
      toast.error(error.message || 'Failed to export PDF')
    }
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-50 overflow-hidden w-full">
      {/* Header — full width, filters horizontal, export right */}
      <div className="flex-shrink-0 bg-white border-b border-neutral-200 px-4 lg:px-6 xl:px-8 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div>
            <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-neutral-900">Sales Ledger</h1>
            <p className="text-xs text-neutral-600 hidden md:block">Comprehensive sales and payment tracking</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex gap-2">
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="flex-1 md:flex-initial px-2 py-1.5 border border-gray-300 rounded text-xs"
              />
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="flex-1 md:flex-initial px-2 py-1.5 border border-gray-300 rounded text-xs"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-2 md:px-3 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 flex items-center gap-1"
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{showFilters ? 'Hide' : 'Show'}</span>
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters - Collapsible */}
      {showFilters && (
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 px-4 py-3 overflow-y-auto max-h-64">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Filter className="h-4 w-4 text-blue-600 mr-2" />
              <h3 className="text-sm lg:text-base font-semibold text-gray-900">Filters</h3>
            </div>
            {hasActiveFilters && (
              <span className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                {Object.values(filters).filter(v => v !== '').length} active
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-3">
            <Input
              label="Date"
              type="date"
              value={filters.date}
              onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
            />
            <Input
              label="Customer Name"
              type="text"
              placeholder="Search..."
              value={filters.name}
              onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
            />
            <Select
              label="Type"
              options={[
                { value: '', label: 'All Types' },
                { value: 'Sale', label: 'Sale' },
                { value: 'Payment', label: 'Payment' }
              ]}
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            />
            <Select
              label="Status"
              options={[
                { value: '', label: 'All Status' },
                { value: 'Paid', label: 'Paid' },
                { value: 'Partial', label: 'Partial' },
                { value: 'Unpaid', label: 'Unpaid' }
              ]}
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            />
            <Input
              label="Invoice No"
              type="text"
              placeholder="Search..."
              value={filters.invoiceNo}
              onChange={(e) => setFilters(prev => ({ ...prev, invoiceNo: e.target.value }))}
            />
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Real Pending Range</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.realPendingMin}
                  onChange={(e) => setFilters(prev => ({ ...prev, realPendingMin: e.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.realPendingMax}
                  onChange={(e) => setFilters(prev => ({ ...prev, realPendingMax: e.target.value }))}
                />
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Real Got Payment Range</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.realGotPaymentMin}
                  onChange={(e) => setFilters(prev => ({ ...prev, realGotPaymentMin: e.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.realGotPaymentMax}
                  onChange={(e) => setFilters(prev => ({ ...prev, realGotPaymentMax: e.target.value }))}
                />
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-end">
              <button
                onClick={() => setFilters({
                  date: '',
                  name: '',
                  type: '',
                  status: '',
                  invoiceNo: '',
                  realPendingMin: '',
                  realPendingMax: '',
                  realGotPaymentMin: '',
                  realGotPaymentMax: ''
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards - Fixed */}
      <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1.5 md:gap-2 lg:gap-3 px-2 md:px-4 py-2 md:py-3 bg-white border-b border-gray-200">
        <div className="bg-blue-50 rounded p-1.5 md:p-2 lg:p-3 border-l-2 md:border-l-4 border-blue-500">
          <div className="text-xs md:text-xs lg:text-xs text-gray-600 uppercase mb-0.5">Sales</div>
          <div className="text-sm md:text-base lg:text-lg font-bold text-gray-900 truncate">
            {formatCurrency(filteredSummary.totalSales)}
          </div>
        </div>
        <div className="bg-green-50 rounded p-1.5 md:p-2 lg:p-3 border-l-2 md:border-l-4 border-green-500">
          <div className="text-xs md:text-xs lg:text-xs text-gray-600 uppercase mb-0.5">Received</div>
          <div className="text-sm md:text-base lg:text-lg font-bold text-green-600 truncate">
            {formatCurrency(filteredSummary.totalPayments)}
          </div>
        </div>
        <div className="bg-yellow-50 rounded p-1.5 md:p-2 lg:p-3 border-l-2 md:border-l-4 border-yellow-500">
          <div className="text-xs md:text-xs lg:text-xs text-gray-600 uppercase mb-0.5">Unpaid</div>
          <div className="text-sm md:text-base lg:text-lg font-bold text-yellow-600 truncate">
            {formatCurrency(filteredSummary.totalRealPending)}
          </div>
        </div>
        <div className="bg-orange-50 rounded p-1.5 md:p-2 lg:p-3 border-l-2 md:border-l-4 border-orange-500">
          <div className="text-xs md:text-xs lg:text-xs text-gray-600 uppercase mb-0.5">Balance</div>
          <div className={`text-sm md:text-base lg:text-lg font-bold truncate ${
            filteredSummary.pendingBalance > 0 ? 'text-red-600' : 
            filteredSummary.pendingBalance < 0 ? 'text-green-600' : 
            'text-gray-600'
          }`}>
            {formatBalance(filteredSummary.pendingBalance)}
          </div>
        </div>
        <div className="bg-purple-50 rounded p-1.5 md:p-2 lg:p-3 border-l-2 md:border-l-4 border-purple-500">
          <div className="text-xs md:text-xs lg:text-xs text-gray-600 uppercase mb-0.5">Invoices</div>
          <div className="text-sm md:text-base lg:text-lg font-bold text-purple-600">
            {filteredSummary.totalInvoices || 0}
          </div>
        </div>
        <div className="bg-indigo-50 rounded p-1.5 md:p-2 lg:p-3 border-l-2 md:border-l-4 border-indigo-500">
          <div className="text-xs md:text-xs lg:text-xs text-gray-600 uppercase mb-0.5">Total</div>
          <div className="text-sm md:text-base lg:text-lg font-bold text-indigo-600">
            {filteredLedger.length}
          </div>
        </div>
      </div>

      {/* Table - Scrollable */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingCard message="Loading sales ledger..." />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden bg-white w-full">
          {/* Desktop Table — full width, horizontal scroll */}
          <div className="hidden md:block h-full overflow-x-auto overflow-y-auto w-full">
            <table className="w-full min-w-[1200px] divide-y divide-gray-200 text-xs lg:text-sm">
              <thead className="bg-gray-100 sticky top-0 z-20 border-b-2 border-gray-300">
                <tr>
                  <th className="px-2 lg:px-3 py-2 text-left text-xs lg:text-xs font-bold text-gray-700 uppercase whitespace-nowrap border-r border-gray-300">
                    Date
                  </th>
                  <th className="px-2 lg:px-3 py-2 text-left text-xs lg:text-xs font-bold text-gray-700 uppercase whitespace-nowrap border-r border-gray-300">
                    Type
                  </th>
                  <th className="px-2 lg:px-3 py-2 text-left text-xs lg:text-xs font-bold text-gray-700 uppercase whitespace-nowrap border-r border-gray-300">
                    Invoice No
                  </th>
                  <th className="px-2 lg:px-3 py-2 text-left text-xs lg:text-xs font-bold text-gray-700 uppercase whitespace-nowrap border-r border-gray-300">
                    Customer
                  </th>
                  <th className="px-2 lg:px-3 py-2 text-left text-xs lg:text-xs font-bold text-gray-700 uppercase whitespace-nowrap border-r border-gray-300">
                    Payment Mode
                  </th>
                  <th className="px-2 lg:px-3 py-2 text-right text-xs lg:text-xs font-bold text-gray-700 uppercase whitespace-nowrap border-r border-gray-300">
                    Bill Amount
                  </th>
                  <th className="px-2 lg:px-3 py-2 text-right text-xs lg:text-xs font-bold text-gray-700 uppercase whitespace-nowrap border-r border-gray-300">
                    Paid Amount
                  </th>
                  <th className="px-2 lg:px-3 py-2 text-right text-xs lg:text-xs font-bold text-gray-700 uppercase whitespace-nowrap border-r border-gray-300">
                    Pending
                  </th>
                  <th className="px-2 lg:px-3 py-2 text-center text-xs lg:text-xs font-bold text-gray-700 uppercase whitespace-nowrap border-r border-gray-300">
                    Status
                  </th>
                  <th className="px-2 lg:px-3 py-2 text-right text-xs lg:text-xs font-bold text-gray-700 uppercase whitespace-nowrap">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No transactions found matching the filters</p>
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((entry, idx) => {
                    // Single date column - show date only (no time, no plan date)
                    const dateStr = new Date(entry.date).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })

                    const rowBgColor = entry.type === 'Payment'
                      ? 'bg-green-50 hover:bg-green-100'
                      : 'hover:bg-gray-50'

                    const normalizeStatusForDisplay = (status) => {
                      if (!status || status === '-') return 'Unpaid'
                      const statusUpper = (status || '').toUpperCase()
                      if (statusUpper === 'PAID' || statusUpper === 'CLEARED') return 'Paid'
                      if (statusUpper === 'PARTIAL') return 'Partial'
                      if (statusUpper === 'UNPAID' || statusUpper === 'PENDING' || statusUpper === 'DUE') return 'Unpaid'
                      return status
                    }
                    
                    const displayStatus = normalizeStatusForDisplay(entry.status)
                    
                    const statusColor =
                      displayStatus === 'Paid'
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : displayStatus === 'Partial'
                        ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                        : displayStatus === 'Unpaid'
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-gray-100 text-gray-800 border-gray-300'

                    const customerBalance = entry.customerBalance || 0

                    return (
                      <tr key={idx} className={rowBgColor}>
                        <td className="px-2 lg:px-3 py-1.5 lg:py-2 whitespace-nowrap text-xs lg:text-sm text-gray-900 border-r border-gray-200">
                          {dateStr}
                        </td>
                        <td className="px-2 lg:px-3 py-1.5 lg:py-2 whitespace-nowrap text-xs lg:text-sm font-medium text-gray-900 border-r border-gray-200">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                            entry.type === 'Payment' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {entry.type}
                          </span>
                        </td>
                        <td className="px-2 lg:px-3 py-1.5 lg:py-2 whitespace-nowrap text-xs lg:text-sm font-semibold text-gray-900 border-r border-gray-200">
                          {entry.invoiceNo}
                        </td>
                        <td className="px-2 lg:px-3 py-1.5 lg:py-2 whitespace-nowrap text-xs lg:text-sm text-gray-900 border-r border-gray-200">
                          {entry.customerName}
                        </td>
                        <td className="px-2 lg:px-3 py-1.5 lg:py-2 whitespace-nowrap text-xs lg:text-sm text-gray-600 border-r border-gray-200">
                          {entry.paymentMode || '-'}
                        </td>
                        {/* Bill Amount - Show GrandTotal for Sales, payment amount for Payments */}
                        <td className="px-2 lg:px-3 py-1.5 lg:py-2 whitespace-nowrap text-xs lg:text-sm text-right font-bold text-blue-600 border-r border-gray-200">
                          {entry.type === 'Sale' 
                            ? formatCurrency(entry.grandTotal || 0) 
                            : entry.type === 'Payment'
                            ? formatCurrency(entry.realGotPayment || 0)
                            : '-'}
                        </td>
                        {/* Paid Amount - Show actual paid amount for Sales, payment amount for Payments */}
                        <td className="px-2 lg:px-3 py-1.5 lg:py-2 whitespace-nowrap text-xs lg:text-sm text-right font-semibold text-green-600 border-r border-gray-200">
                          {entry.type === 'Sale'
                            ? (entry.paidAmount > 0 ? formatCurrency(entry.paidAmount) : '-')
                            : entry.type === 'Payment'
                            ? formatCurrency(entry.realGotPayment || 0)
                            : '-'}
                        </td>
                        {/* Pending - Show only for Sales (unpaid amount) */}
                        <td className="px-2 lg:px-3 py-1.5 lg:py-2 whitespace-nowrap text-xs lg:text-sm text-right font-semibold text-red-600 border-r border-gray-200">
                          {entry.type === 'Sale' && entry.realPending > 0 
                            ? formatCurrency(entry.realPending) 
                            : '-'}
                        </td>
                        <td className="px-2 lg:px-3 py-1.5 lg:py-2 whitespace-nowrap text-center border-r border-gray-200">
                          {displayStatus && displayStatus !== '-' ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${statusColor}`}>
                              {displayStatus}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td
                          className={`px-2 lg:px-3 py-1.5 lg:py-2 whitespace-nowrap text-xs lg:text-sm text-right font-bold ${
                            customerBalance < 0
                              ? 'text-green-600'
                              : customerBalance > 0
                              ? 'text-red-600'
                              : 'text-gray-900'
                          }`}
                        >
                          {formatBalance(customerBalance)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot className="bg-gray-200 sticky bottom-0 border-t-4 border-gray-400">
                {/* First Total Row - Main Totals */}
                <tr className="bg-blue-50">
                  <td
                    colSpan="5"
                    className="px-2 lg:px-3 py-3 text-right text-xs lg:text-sm font-bold text-gray-900 border-r border-gray-300"
                  >
                    TOTALS:
                  </td>
                  {/* Bill Amount Total */}
                  <td className="px-2 lg:px-3 py-3 text-right text-xs lg:text-sm font-bold text-blue-700 border-r border-gray-300">
                    {formatCurrency(filteredSummary.totalSales)}
                  </td>
                  {/* Paid Amount Total */}
                  <td className="px-2 lg:px-3 py-3 text-right text-xs lg:text-sm font-bold text-green-700 border-r border-gray-300">
                    {formatCurrency(filteredSummary.totalPayments)}
                  </td>
                  {/* Pending Total */}
                  <td className="px-2 lg:px-3 py-3 text-right text-xs lg:text-sm font-bold text-red-700 border-r border-gray-300">
                    {formatCurrency(filteredSummary.totalRealPending)}
                  </td>
                  {/* Status */}
                  <td className="px-2 lg:px-3 py-3 text-center text-xs lg:text-sm font-bold text-gray-900 border-r border-gray-300">
                    -
                  </td>
                  {/* Customer Balance */}
                  <td className="px-2 lg:px-3 py-3 text-right text-xs lg:text-sm font-bold border-r border-gray-300">
                    <span className={filteredSummary.pendingBalance > 0 ? 'text-red-700' : filteredSummary.pendingBalance < 0 ? 'text-green-700' : 'text-gray-900'}>
                      {formatBalance(filteredSummary.pendingBalance)}
                    </span>
                  </td>
                </tr>
                {/* Second Total Row - Summary */}
                <tr className="bg-yellow-50">
                  <td
                    colSpan="5"
                    className="px-2 lg:px-3 py-2 text-right text-xs lg:text-xs font-semibold text-gray-700 border-r border-gray-300"
                  >
                    SUMMARY:
                  </td>
                  <td className="px-2 lg:px-3 py-2 text-right text-xs lg:text-xs font-semibold text-blue-700 border-r border-gray-300">
                    Sales: {formatCurrency(filteredSummary.totalSales)}
                  </td>
                  <td className="px-2 lg:px-3 py-2 text-right text-xs lg:text-xs font-semibold text-green-700 border-r border-gray-300">
                    Paid: {formatCurrency(filteredSummary.totalPayments)}
                  </td>
                  <td className="px-2 lg:px-3 py-2 text-right text-xs lg:text-xs font-semibold text-red-700 border-r border-gray-300">
                    Pending: {formatCurrency(filteredSummary.totalRealPending)}
                  </td>
                  <td className="px-2 lg:px-3 py-2 text-center text-xs lg:text-xs font-semibold text-gray-700 border-r border-gray-300">
                    -
                  </td>
                  <td className="px-2 lg:px-3 py-2 text-right text-xs lg:text-xs font-semibold text-orange-700 border-r border-gray-300">
                    Net: {formatBalance(filteredSummary.pendingBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Card View - Shown only on mobile */}
          <div className="md:hidden h-full overflow-auto px-2 py-2 space-y-2">
            {filteredLedger.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mb-2 text-gray-300" />
                <p className="text-sm">No transactions found</p>
              </div>
            ) : (
              filteredLedger.map((entry, idx) => {
                const dateStr = new Date(entry.date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                })
                const normalizeStatusForDisplay = (status) => {
                  if (!status || status === '-') return 'Unpaid'
                  const statusUpper = (status || '').toUpperCase()
                  if (statusUpper === 'PAID' || statusUpper === 'CLEARED') return 'Paid'
                  if (statusUpper === 'PARTIAL') return 'Partial'
                  if (statusUpper === 'UNPAID' || statusUpper === 'PENDING' || statusUpper === 'DUE') return 'Unpaid'
                  return status
                }
                const displayStatus = normalizeStatusForDisplay(entry.status)
                const statusColor =
                  displayStatus === 'Paid'
                    ? 'bg-green-100 text-green-800'
                    : displayStatus === 'Partial'
                    ? 'bg-yellow-100 text-yellow-800'
                    : displayStatus === 'Unpaid'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'

                return (
                  <div
                    key={idx}
                    className={`rounded-lg border p-2.5 ${
                      entry.type === 'Payment'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                            entry.type === 'Payment' 
                              ? 'bg-green-600 text-white' 
                              : 'bg-blue-600 text-white'
                          }`}>
                            {entry.type}
                          </span>
                          <span className="text-xs font-bold text-gray-900">{entry.invoiceNo}</span>
                          {displayStatus && displayStatus !== '-' && (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${statusColor}`}>
                              {displayStatus}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">{entry.customerName}</div>
                        <div className="text-xs text-gray-500">{dateStr}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      <div>
                        <div className="text-xs text-gray-500 uppercase">Bill</div>
                        <div className="font-bold text-blue-600">
                          {entry.type === 'Sale' 
                            ? formatCurrency(entry.grandTotal || 0) 
                            : formatCurrency(entry.realGotPayment || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase">Paid</div>
                        <div className="font-bold text-green-600">
                          {entry.type === 'Sale'
                            ? (entry.paidAmount > 0 ? formatCurrency(entry.paidAmount) : '-')
                            : formatCurrency(entry.realGotPayment || 0)}
                        </div>
                      </div>
                      {entry.type === 'Sale' && entry.realPending > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 uppercase">Pending</div>
                          <div className="font-bold text-red-600">
                            {formatCurrency(entry.realPending)}
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="text-xs text-gray-500 uppercase">Balance</div>
                        <div className={`font-bold ${
                          entry.customerBalance < 0 ? 'text-green-600' :
                          entry.customerBalance > 0 ? 'text-red-600' :
                          'text-gray-900'
                        }`}>
                          {formatBalance(entry.customerBalance || 0)}
                        </div>
                      </div>
                    </div>
                    
                    {entry.paymentMode && entry.paymentMode !== '-' && (
                      <div className="mt-1.5 pt-1.5 border-t border-gray-200">
                        <span className="text-xs text-gray-500">Mode: </span>
                        <span className="text-xs font-medium text-gray-700">{entry.paymentMode}</span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesLedgerPage

