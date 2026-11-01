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
  Square,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Hash
} from 'lucide-react'
import { OverflowMenu } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { salesAPI, paymentsAPI, legacyAPI } from '../../services/index'
import { formatCurrency } from '../../utils/currency'
import { getInvoicePaymentBadge, isInvoiceFullySettled } from '../../utils/salePaymentSettlement'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'
import { Input } from '../../components/Form'
import InvoicePreviewModal from '../../components/InvoicePreviewModal'
import ReceiptPreviewModal from '../../components/ReceiptPreviewModal'
import ConfirmDangerModal from '../../components/ConfirmDangerModal'
import LegacyInvoiceDetailModal from '../../components/LegacyInvoiceDetailModal'
import ChangeInvoiceNumberModal from './ChangeInvoiceNumberModal'
import { canChangeInvoiceNumber, isRenumberableSale } from '../../utils/invoiceNumberChange'
import { syncBillingHistorySearchParams } from '../../utils/billingHistoryUrl'
import { buildCustomerLedgerHref } from '../../utils/customerLedgerUrl'

const BillingHistoryPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  // Navigation tab: 'operating' | 'legacy' | 'all'
  const isFrozenHub1 = user?.tenantId === 20 || (typeof window !== 'undefined' && window.location.hostname.includes('frozenhub') && !window.location.hostname.includes('frozenhub2'))
  // Navigation tab: 'all' | 'operating' | 'legacy' - defaults to 'all' for FrozenHub 1 continuity
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || (isFrozenHub1 ? 'all' : 'operating'))

  // Shared state
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [currentPage, setCurrentPage] = useState(() => Number(searchParams.get('page')) || 1)
  const [pageSize, setPageSize] = useState(20) // Corrected default matching select options
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [dateFilter, setDateFilter] = useState(() => ({
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || ''
  }))
  const [datesOpen, setDatesOpen] = useState(false)
  const [listError, setListError] = useState(false)

  // Operating FrozenHub State
  const [sales, setSales] = useState([])
  const [selectedSale, setSelectedSale] = useState(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [selectedInvoices, setSelectedInvoices] = useState([])
  const [saleToDelete, setSaleToDelete] = useState(null)
  const [showReceiptPreviewModal, setShowReceiptPreviewModal] = useState(false)
  const [receiptPreviewPaymentIds, setReceiptPreviewPaymentIds] = useState([])
  const [loadingReceiptSaleId, setLoadingReceiptSaleId] = useState(null)
  const canRenumber = canChangeInvoiceNumber(user?.role)
  const [saleToRenumber, setSaleToRenumber] = useState(null)

  // Legacy Starplus State
  const [legacyFilter, setLegacyFilter] = useState('active') // 'active' | 'pending' | 'deleted' | 'all'
  const [legacyInvoices, setLegacyInvoices] = useState([])
  const [selectedLegacyInvoiceId, setSelectedLegacyInvoiceId] = useState(null)
  const [showLegacyModal, setShowLegacyModal] = useState(false)
  const [legacyReconciliation, setLegacyReconciliation] = useState(null)

  // Unified All History State
  const [unifiedInvoices, setUnifiedInvoices] = useState([])

  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'owner'
  const canEdit = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'owner'

  // Fetch Legacy Reconciliation metrics once
  useEffect(() => {
    if (activeTab === 'legacy' && !legacyReconciliation) {
      legacyAPI.getReconciliation().then(res => {
        if (res?.success && res.data) setLegacyReconciliation(res.data)
      }).catch(err => console.warn('Legacy reconciliation fetch error:', err))
    }
  }, [activeTab, legacyReconciliation])

  // Core Data Fetcher
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setListError(false)

      const baseParams = {
        page: currentPage,
        pageSize: pageSize
      }

      if (debouncedSearch.trim()) {
        baseParams.search = debouncedSearch.trim()
      }

      if (dateFilter.from) {
        baseParams.fromDate = dateFilter.from
      }
      if (dateFilter.to) {
        baseParams.toDate = dateFilter.to
      }

      if (activeTab === 'operating') {
        const response = await salesAPI.getSales(baseParams)
        if (response.success && response.data) {
          setSales(response.data.items || [])
          setTotalCount(response.data.totalCount || 0)
          setTotalPages(response.data.totalPages || 1)
        } else {
          setListError(true)
        }
      } else if (activeTab === 'legacy') {
        const legacyParams = {
          ...baseParams,
          includeDeleted: legacyFilter === 'deleted' || legacyFilter === 'all',
          pendingOnly: legacyFilter === 'pending' ? true : undefined
        }
        if (legacyFilter === 'deleted') {
          // If deleted specifically selected, includeDeleted = true is set
        }
        const response = await legacyAPI.getInvoices(legacyParams)
        if (response.success && response.data) {
          let items = response.data.items || []
          if (legacyFilter === 'deleted') {
            items = items.filter(i => i.isDeleted)
          }
          setLegacyInvoices(items)
          setTotalCount(response.data.totalCount || 0)
          setTotalPages(response.data.totalPages || 1)
        } else {
          setListError(true)
        }
      } else if (activeTab === 'all') {
        const response = await legacyAPI.getUnifiedInvoices(baseParams)
        if (response.success && response.data) {
          setUnifiedInvoices(response.data.items || [])
          setTotalCount(response.data.totalCount || 0)
          setTotalPages(response.data.totalPages || 1)
        } else {
          setListError(true)
        }
      }
    } catch (error) {
      console.error('Error fetching billing data:', error)
      setListError(true)
    } finally {
      setLoading(false)
    }
  }, [activeTab, legacyFilter, currentPage, pageSize, debouncedSearch, dateFilter])

  const fetchDataRef = useRef(fetchData)
  fetchDataRef.current = fetchData

  // Sync state to URL params
  useEffect(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.set('tab', activeTab)
      syncBillingHistorySearchParams(params, {
        search: debouncedSearch,
        page: currentPage,
        from: dateFilter.from,
        to: dateFilter.to
      })
      return params
    }, { replace: true })
  }, [activeTab, debouncedSearch, currentPage, dateFilter.from, dateFilter.to, setSearchParams])

  // Sync URL params to state on popstate / external navigation
  useEffect(() => {
    const tab = searchParams.get('tab') || (isFrozenHub1 ? 'all' : 'operating')
    const page = Number(searchParams.get('page')) || 1
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    const search = searchParams.get('search') || ''
    setActiveTab((t) => (t === tab ? t : tab))
    setCurrentPage((c) => (c === page ? c : page))
    setDateFilter((d) => (d.from === from && d.to === to ? d : { from, to }))
    setSearchTerm((s) => (s === search ? s : search))
  }, [searchParams])

  // Trigger fetch when parameters change
  useEffect(() => {
    fetchDataRef.current()
  }, [activeTab, legacyFilter, currentPage, pageSize, debouncedSearch, dateFilter.from, dateFilter.to])

  // Reset to page 1 on search change
  const prevSearch = useRef(debouncedSearch)
  useEffect(() => {
    if (prevSearch.current !== debouncedSearch) {
      prevSearch.current = debouncedSearch
      if (currentPage !== 1) setCurrentPage(1)
    }
  }, [debouncedSearch, currentPage])

  // Refresh on external data update
  useEffect(() => {
    const handleDataUpdate = () => {
      fetchDataRef.current()
    }
    window.addEventListener('dataUpdated', handleDataUpdate)
    return () => {
      window.removeEventListener('dataUpdated', handleDataUpdate)
    }
  }, [])

  const handleTabChange = (newTab) => {
    setActiveTab(newTab)
    setCurrentPage(1)
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set('tab', newTab)
      p.set('page', '1')
      return p
    })
  }

  const handleSearch = (e) => {
    e.preventDefault()
    if (dateFilter.from && dateFilter.to && dateFilter.from > dateFilter.to) {
      toast.error('From date must be on or before To date')
      return
    }
    setCurrentPage(1)
    fetchData()
  }

  const clearFilters = () => {
    setSearchTerm('')
    setDateFilter({ from: '', to: '' })
    setCurrentPage(1)
    setTimeout(() => fetchData(), 50)
  }

  const handleViewInvoice = (sale) => {
    setSelectedSale(sale)
    setShowInvoiceModal(true)
  }

  const handleViewLegacyInvoice = (legacyId) => {
    setSelectedLegacyInvoiceId(legacyId)
    setShowLegacyModal(true)
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
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    } catch {
      return '—'
    }
  }

  const shortDate = (value) => {
    const d = value ? new Date(value) : null
    if (!d || Number.isNaN(d.getTime())) return ''
    const opts = d.getFullYear() === new Date().getFullYear()
      ? { day: '2-digit', month: 'short' }
      : { day: '2-digit', month: 'short', year: '2-digit' }
    return d.toLocaleDateString('en-GB', opts)
  }

  const dateRangeLabel = dateFilter.from || dateFilter.to
    ? `${dateFilter.from ? formatDate(dateFilter.from) : 'start'} to ${dateFilter.to ? formatDate(dateFilter.to) : 'today'}`
    : 'all dates'

  return (
    <div className="space-y-3 max-w-full overflow-x-hidden h-full min-h-0 flex flex-col">
      {/* Top Header & Tab Navigation Strip */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-neutral-900">Billing History</h1>
            <p className="text-xs text-neutral-500">
              {activeTab === 'operating' && `Showing ${sales.length} of ${totalCount} active FrozenHub invoices`}
              {activeTab === 'legacy' && `Showing ${legacyInvoices.length} of ${totalCount} historical Starplus invoices`}
              {activeTab === 'all' && `Showing ${unifiedInvoices.length} of ${totalCount} combined historical & operating invoices`}
            </p>
          </div>
          {activeTab === 'operating' && selectedInvoices.length > 0 && (
            <button
              onClick={handleCombinedPdf}
              className="inline-flex items-center px-3 py-1.5 bg-success text-white rounded-md text-xs font-medium hover:bg-green-700"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Combined PDF ({selectedInvoices.length})
            </button>
          )}
        </div>

        {/* 3-Tab Selector */}
        <div className="flex items-center border-b border-neutral-200 gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => handleTabChange('operating')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'operating'
                ? 'border-primary-600 text-primary-700 bg-primary-50/40 rounded-t-lg'
                : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:border-neutral-300'
            }`}
          >
            FrozenHub Invoices
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('legacy')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'legacy'
                ? 'border-amber-600 text-amber-800 bg-amber-50/50 rounded-t-lg'
                : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:border-neutral-300'
            }`}
          >
            <span>Legacy Starplus Invoices</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">Archive</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('all')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'border-purple-600 text-purple-700 bg-purple-50/40 rounded-t-lg'
                : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:border-neutral-300'
            }`}
          >
            <span>All History</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800">Unified</span>
          </button>
        </div>

        {/* Legacy Tab Info Banner & Sub-filter Buttons */}
        {activeTab === 'legacy' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
              <span>
                <strong className="font-semibold">Starplus Historical Archive:</strong> 5,109 immutable records migrated from Starplus (TRN 100366253100003).
                {legacyReconciliation && (
                  <span className="ml-1 text-amber-800">
                    Total: {formatCurrency(legacyReconciliation.activeGrandTotal)} · 93 Cutover Pending ({formatCurrency(legacyReconciliation.positiveOutstandingSum)})
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => { setLegacyFilter('active'); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  legacyFilter === 'active'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                Active Bills (4,916)
              </button>
              <button
                type="button"
                onClick={() => { setLegacyFilter('pending'); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  legacyFilter === 'pending'
                    ? 'bg-rose-600 text-white'
                    : 'bg-white text-rose-700 border border-rose-300 hover:bg-rose-50'
                }`}
              >
                Cutover Pending (93)
              </button>
              <button
                type="button"
                onClick={() => { setLegacyFilter('deleted'); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  legacyFilter === 'deleted'
                    ? 'bg-neutral-700 text-white'
                    : 'bg-white text-neutral-600 border border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                Deleted Bills (193)
              </button>
              <button
                type="button"
                onClick={() => { setLegacyFilter('all'); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  legacyFilter === 'all'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-600 border border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                All (5,109)
              </button>
            </div>
          </div>
        )}

        {/* Search & Date Filters */}
        <form onSubmit={handleSearch} className="bg-white border border-neutral-200 rounded-lg p-2">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
              <input
                type="search"
                placeholder={
                  activeTab === 'operating'
                    ? 'Search FrozenHub invoices (number, customer, status)...'
                    : activeTab === 'legacy'
                    ? 'Search historical Starplus invoices (number e.g. 6996, 2158, customer)...'
                    : 'Search all invoices across FrozenHub & Starplus...'
                }
                aria-label="Search invoices"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input w-full pl-9 text-xs sm:text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setDatesOpen((v) => !v)}
              className="md:hidden btn btn-secondary shrink-0"
              aria-expanded={datesOpen}
              aria-label={`Date range: ${dateRangeLabel}`}
            >
              <Calendar className="h-4 w-4" aria-hidden />
              {(dateFilter.from || dateFilter.to) && <span className="h-2 w-2 rounded-full bg-primary-600" aria-hidden />}
            </button>
            <div className="hidden md:flex items-center gap-2">
              <label className="sr-only" htmlFor="bh-from-md">From date</label>
              <input id="bh-from-md" type="date" value={dateFilter.from} onChange={(e) => { setDateFilter({ ...dateFilter, from: e.target.value }); setCurrentPage(1) }} className="input w-40 text-xs sm:text-sm" />
              <span className="text-xs text-neutral-500">to</span>
              <label className="sr-only" htmlFor="bh-to-md">To date</label>
              <input id="bh-to-md" type="date" value={dateFilter.to} onChange={(e) => { setDateFilter({ ...dateFilter, to: e.target.value }); setCurrentPage(1) }} className="input w-40 text-xs sm:text-sm" />
            </div>
            {(searchTerm || dateFilter.from || dateFilter.to) && (
              <button type="button" onClick={clearFilters} className="btn btn-ghost shrink-0" aria-label="Clear filters">
                <X className="h-4 w-4" aria-hidden />
                <span className="hidden lg:inline text-xs">Clear</span>
              </button>
            )}
            <button type="button" onClick={() => fetchData()} className="hidden md:inline-flex btn btn-ghost shrink-0" aria-label="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            </button>
          </div>
          {datesOpen && (
            <div className="mt-2 grid grid-cols-2 gap-2 md:hidden">
              <label className="flex min-w-0 flex-col gap-0.5 text-xs text-neutral-600">
                From
                <input type="date" value={dateFilter.from} onChange={(e) => { setDateFilter({ ...dateFilter, from: e.target.value }); setCurrentPage(1) }} className="input min-w-0 text-xs" />
              </label>
              <label className="flex min-w-0 flex-col gap-0.5 text-xs text-neutral-600">
                To
                <input type="date" value={dateFilter.to} onChange={(e) => { setDateFilter({ ...dateFilter, to: e.target.value }); setCurrentPage(1) }} className="input min-w-0 text-xs" />
              </label>
            </div>
          )}
        </form>
      </div>

      {/* Main Table Content */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden flex-1 min-h-0 overflow-y-auto">
        {loading && ((activeTab === 'operating' && sales.length === 0) || (activeTab === 'legacy' && legacyInvoices.length === 0) || (activeTab === 'all' && unifiedInvoices.length === 0)) ? (
          <div className="py-16 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary-600" />
            <p className="mt-2 text-sm text-neutral-500">Loading invoice records…</p>
          </div>
        ) : listError ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-8 w-8 mx-auto text-rose-500" />
            <p className="mt-2 text-sm text-neutral-700">Unable to load billing data.</p>
            <button type="button" className="mt-2 text-sm text-primary-700 font-semibold" onClick={() => fetchData()}>Retry</button>
          </div>
        ) : (
          <>
            {/* TAB 1: OPERATING FROZENHUB INVOICES */}
            {activeTab === 'operating' && (
              sales.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-neutral-400" />
                  <h3 className="mt-2 text-sm font-medium text-neutral-900">No FrozenHub invoices found</h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    {searchTerm || dateFilter.from || dateFilter.to ? 'Try adjusting your filters' : 'Start by creating your first invoice from POS'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            <button onClick={toggleSelectAll} className="text-neutral-500 hover:text-neutral-700">
                              {selectedInvoices.length === sales.length && sales.length > 0 ? (
                                <CheckSquare className="h-4 w-4 text-primary-600" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          </th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Invoice #</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Date</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Customer</th>
                          <th className="px-3 py-1.5 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">Subtotal</th>
                          <th className="px-3 py-1.5 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">VAT</th>
                          <th className="px-3 py-1.5 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">Total</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Method</th>
                          <th className="px-3 py-1.5 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider sticky right-0 z-20 bg-neutral-50">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-neutral-200">
                        {sales.map((sale) => {
                          const payBadge = getInvoicePaymentBadge(sale)
                          return (
                            <tr key={sale.id} className="group hover:bg-neutral-50">
                              <td className="px-3 py-1.5 whitespace-nowrap">
                                <button onClick={() => toggleSelectInvoice(sale.id)} className="text-neutral-500 hover:text-primary-600">
                                  {selectedInvoices.includes(sale.id) ? (
                                    <CheckSquare className="h-4 w-4 text-primary-600" />
                                  ) : (
                                    <Square className="h-4 w-4" />
                                  )}
                                </button>
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-sm font-semibold text-neutral-900">
                                {sale.invoiceNo || `#${sale.id}`}
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-xs text-neutral-600">
                                {formatDate(sale.invoiceDate)}
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-sm text-neutral-900 font-medium">
                                {sale.customerName || 'Cash Customer'}
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-right text-sm text-neutral-900">
                                {formatCurrency(sale.subtotal || 0)}
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-right text-sm text-neutral-900">
                                {formatCurrency(sale.vatTotal || 0)}
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-right text-sm font-bold text-neutral-900">
                                {formatCurrency(sale.grandTotal || 0)}
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${payBadge.colorClass}`}>
                                  {payBadge.label}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-xs text-neutral-600">
                                {sale.primaryPaymentMode || '—'}
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-right text-sm font-medium sticky right-0 z-10 bg-white group-hover:bg-neutral-50">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button onClick={() => handleViewInvoice(sale)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-primary-600 hover:bg-primary-50" title="View Invoice">
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  {sale.customerId && (
                                    <button type="button" onClick={() => openCustomerLedgerForSale(sale)} className="inline-flex h-8 w-8 items-center justify-center text-emerald-700 hover:bg-emerald-50 rounded-md" title="Customer ledger">
                                      <Wallet className="h-4 w-4" />
                                    </button>
                                  )}
                                  {saleHasReceipt(sale) && (
                                    <button onClick={() => handlePrintPaymentReceipt(sale)} disabled={loadingReceiptSaleId === sale.id} className="inline-flex h-8 w-8 items-center justify-center text-neutral-700 hover:bg-neutral-100 rounded-md disabled:opacity-50" title="Print receipt">
                                      <Printer className="h-4 w-4" />
                                    </button>
                                  )}
                                  {canEdit && (
                                    <button onClick={() => handleEditSale(sale)} className="inline-flex h-8 w-8 items-center justify-center text-neutral-700 hover:bg-neutral-100 rounded-md" title="Edit Invoice">
                                      <Edit className="h-4 w-4" />
                                    </button>
                                  )}
                                  {isAdmin && (
                                    <button onClick={() => handleDeleteSale(sale.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-rose-50 hover:text-rose-600" title="Delete Invoice">
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

                  {/* Mobile View */}
                  <ul className="md:hidden divide-y divide-neutral-200">
                    {sales.map((sale) => {
                      const payBadge = getInvoicePaymentBadge(sale)
                      const settled = isInvoiceFullySettled(sale)
                      return (
                        <li key={sale.id} className="flex items-center gap-2 px-3 py-2">
                          <button type="button" onClick={() => handleViewInvoice(sale)} className="min-w-0 flex-1 text-start">
                            <span className="flex items-center justify-between gap-2">
                              <span className="shrink-0 text-sm font-semibold text-neutral-900">{sale.invoiceNo || `#${sale.id}`}</span>
                              <span className="min-w-0 truncate text-sm font-semibold tabular-nums text-neutral-900">{formatCurrency(sale.grandTotal || 0)}</span>
                            </span>
                            <span className="mt-0.5 flex items-center justify-between gap-2 text-xs">
                              <span className="truncate text-neutral-600">{sale.customerName || 'Cash Customer'}</span>
                              <span className="flex shrink-0 items-center gap-1.5">
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${payBadge.colorClass}`}>{payBadge.label}</span>
                                <span className="tabular-nums text-neutral-500">{shortDate(sale.invoiceDate)}</span>
                              </span>
                            </span>
                          </button>
                          {sale.customerId && !settled && (
                            <button type="button" onClick={() => openCustomerLedgerForSale(sale)} className="btn btn-secondary btn-sm shrink-0 text-xs">
                              Collect
                            </button>
                          )}
                          <OverflowMenu
                            label={`Actions for ${sale.invoiceNo || sale.id}`}
                            items={[
                              { label: 'View invoice', icon: Eye, onClick: () => handleViewInvoice(sale) },
                              { label: 'Customer ledger', icon: Wallet, hidden: !sale.customerId, onClick: () => openCustomerLedgerForSale(sale) },
                              { label: 'Print receipt', icon: Printer, hidden: !saleHasReceipt(sale), disabled: loadingReceiptSaleId === sale.id, onClick: () => handlePrintPaymentReceipt(sale) },
                              { label: 'Edit invoice', icon: Edit, hidden: !canEdit, onClick: () => handleEditSale(sale) },
                              { label: 'Delete invoice', icon: Trash2, hidden: !isAdmin, danger: true, separatorBefore: true, onClick: () => handleDeleteSale(sale.id) },
                            ]}
                          />
                        </li>
                      )
                    })}
                  </ul>
                </>
              )
            )}

            {/* TAB 2: LEGACY STARPLUS INVOICES */}
            {activeTab === 'legacy' && (
              legacyInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-neutral-400" />
                  <h3 className="mt-2 text-sm font-medium text-neutral-900">No historical invoices found</h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Try adjusting your search terms or filter selection.
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-xs">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-neutral-600 uppercase tracking-wider">Invoice #</th>
                          <th className="px-3 py-2 text-left font-semibold text-neutral-600 uppercase tracking-wider">Date</th>
                          <th className="px-3 py-2 text-left font-semibold text-neutral-600 uppercase tracking-wider">Customer</th>
                          <th className="px-3 py-2 text-center font-semibold text-neutral-600 uppercase tracking-wider">Items</th>
                          <th className="px-3 py-2 text-right font-semibold text-neutral-600 uppercase tracking-wider">Subtotal</th>
                          <th className="px-3 py-2 text-right font-semibold text-neutral-600 uppercase tracking-wider">VAT</th>
                          <th className="px-3 py-2 text-right font-semibold text-neutral-600 uppercase tracking-wider">Grand Total</th>
                          <th className="px-3 py-2 text-right font-semibold text-neutral-600 uppercase tracking-wider">Paid</th>
                          <th className="px-3 py-2 text-right font-semibold text-neutral-600 uppercase tracking-wider">Outstanding</th>
                          <th className="px-3 py-2 text-center font-semibold text-neutral-600 uppercase tracking-wider">Status</th>
                          <th className="px-3 py-2 text-center font-semibold text-neutral-600 uppercase tracking-wider sticky right-0 bg-neutral-50">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-neutral-200">
                        {legacyInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-neutral-50/80">
                            <td className="px-3 py-2 font-bold text-neutral-900 whitespace-nowrap">
                              #{inv.legacyInvoiceNumber}
                              {inv.isDeleted ? (
                                <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-200 text-neutral-700">
                                  Deleted
                                </span>
                              ) : inv.reportedAsPending ? (
                                <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                                  Cutover Pending
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">
                              {formatDate(inv.invoiceDate)}
                            </td>
                            <td className="px-3 py-2 font-medium text-neutral-900 max-w-[180px] truncate" title={inv.customerName}>
                              {inv.customerName || <span className="text-neutral-400 italic">Walk-in Cash</span>}
                            </td>
                            <td className="px-3 py-2 text-center text-neutral-600">
                              {inv.itemCount > 0 ? (
                                `${inv.itemCount} item${inv.itemCount > 1 ? 's' : ''}`
                              ) : (
                                <span className="text-amber-700 font-medium" title="Line items not present in original export">Incomplete</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-neutral-800 whitespace-nowrap">
                              {formatCurrency(inv.subtotal)}
                            </td>
                            <td className="px-3 py-2 text-right text-neutral-800 whitespace-nowrap">
                              {formatCurrency(inv.vatTotal)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-neutral-900 whitespace-nowrap">
                              {formatCurrency(inv.grandTotal)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-emerald-700 whitespace-nowrap">
                              {formatCurrency(inv.paidAmount)}
                            </td>
                            <td className={`px-3 py-2 text-right font-bold whitespace-nowrap ${inv.outstandingCalculated > 0.005 ? 'text-rose-600' : 'text-neutral-400'}`}>
                              {inv.outstandingCalculated > 0.005 ? formatCurrency(inv.outstandingCalculated) : 'AED 0.00'}
                            </td>
                            <td className="px-3 py-2 text-center whitespace-nowrap">
                              {inv.outstandingCalculated <= 0.005 ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
                                  Paid
                                </span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 text-rose-800">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center sticky right-0 bg-white hover:bg-neutral-50 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleViewLegacyInvoice(inv.id)}
                                className="px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-md border border-amber-200 transition"
                              >
                                View Items
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>


                  {/* Mobile View */}
                  <ul className="md:hidden divide-y divide-neutral-200">
                    {legacyInvoices.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between p-3 hover:bg-neutral-50">
                        <button
                          type="button"
                          onClick={() => handleViewLegacyInvoice(inv.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-neutral-900">
                              #{inv.legacyInvoiceNumber}
                              {inv.reportedAsPending && (
                                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">Pending</span>
                              )}
                            </span>
                            <span className="font-bold text-sm text-neutral-900">{formatCurrency(inv.grandTotal)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                            <span className="truncate max-w-[180px] font-medium text-neutral-700">{inv.customerName || 'Cash Customer'}</span>
                            <span>{formatDate(inv.invoiceDate)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px]">
                            <span className="text-neutral-500">{inv.itemCount} items · Paid {formatCurrency(inv.paidAmount)}</span>
                            {inv.outstandingCalculated > 0.005 ? (
                              <span className="font-bold text-rose-600">Due: {formatCurrency(inv.outstandingCalculated)}</span>
                            ) : (
                              <span className="font-medium text-emerald-600">Settled</span>
                            )}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleViewLegacyInvoice(inv.id)}
                          className="ml-2 px-2.5 py-1 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 shrink-0"
                        >
                          View
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )
            )}

            {/* TAB 3: UNIFIED ALL HISTORY */}
            {activeTab === 'all' && (
              unifiedInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-neutral-400" />
                  <h3 className="mt-2 text-sm font-medium text-neutral-900">No invoices found</h3>
                  <p className="mt-1 text-sm text-neutral-500">Try adjusting your search criteria.</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-xs">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-neutral-600 uppercase tracking-wider">Invoice #</th>
                          <th className="px-3 py-2 text-left font-semibold text-neutral-600 uppercase tracking-wider">Source Company</th>
                          <th className="px-3 py-2 text-left font-semibold text-neutral-600 uppercase tracking-wider">Date</th>
                          <th className="px-3 py-2 text-left font-semibold text-neutral-600 uppercase tracking-wider">Customer</th>
                          <th className="px-3 py-2 text-center font-semibold text-neutral-600 uppercase tracking-wider">Items</th>
                          <th className="px-3 py-2 text-right font-semibold text-neutral-600 uppercase tracking-wider">Subtotal</th>
                          <th className="px-3 py-2 text-right font-semibold text-neutral-600 uppercase tracking-wider">VAT</th>
                          <th className="px-3 py-2 text-right font-semibold text-neutral-600 uppercase tracking-wider">Grand Total</th>
                          <th className="px-3 py-2 text-right font-semibold text-neutral-600 uppercase tracking-wider">Paid</th>
                          <th className="px-3 py-2 text-right font-semibold text-neutral-600 uppercase tracking-wider">Outstanding</th>
                          <th className="px-3 py-2 text-center font-semibold text-neutral-600 uppercase tracking-wider">Payment Status</th>
                          <th className="px-3 py-2 text-center font-semibold text-neutral-600 uppercase tracking-wider sticky right-0 bg-neutral-50">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-neutral-200">
                        {unifiedInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-neutral-50/80">
                            <td className="px-3 py-2 font-bold text-neutral-900 whitespace-nowrap">
                              #{inv.invoiceNumber}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {inv.isLegacy ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                  STARPLUS
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                  FROZENHUB
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">
                              {formatDate(inv.invoiceDate)}
                            </td>
                            <td className="px-3 py-2 font-medium text-neutral-900 max-w-[180px] truncate" title={inv.customerName}>
                              {inv.customerName || <span className="text-neutral-400 italic">Walk-in</span>}
                            </td>
                            <td className="px-3 py-2 text-center text-neutral-600">
                              {inv.itemCount}
                            </td>
                            <td className="px-3 py-2 text-right text-neutral-800 whitespace-nowrap">
                              {formatCurrency(inv.subtotal)}
                            </td>
                            <td className="px-3 py-2 text-right text-neutral-800 whitespace-nowrap">
                              {formatCurrency(inv.vatTotal)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-neutral-900 whitespace-nowrap">
                              {formatCurrency(inv.grandTotal)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-emerald-700 whitespace-nowrap">
                              {formatCurrency(inv.paidAmount)}
                            </td>
                            <td className={`px-3 py-2 text-right font-bold whitespace-nowrap ${inv.outstandingBalance > 0.005 ? 'text-rose-600' : 'text-neutral-400'}`}>
                              {inv.outstandingBalance > 0.005 ? formatCurrency(inv.outstandingBalance) : 'AED 0.00'}
                            </td>
                            <td className="px-3 py-2 text-center whitespace-nowrap">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                inv.paymentStatus === 'Paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : inv.paymentStatus === 'Partial'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {inv.paymentStatus}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center sticky right-0 bg-white hover:bg-neutral-50 whitespace-nowrap">
                              {inv.isLegacy ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewLegacyInvoice(inv.legacyInvoiceId)}
                                  className="px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-md border border-amber-200 transition"
                                >
                                  View
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSale({ id: inv.operatingSaleId, invoiceNo: inv.invoiceNumber })
                                    setShowInvoiceModal(true)
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-md border border-primary-200 transition"
                                >
                                  View
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View */}
                  <ul className="md:hidden divide-y divide-neutral-200">
                    {unifiedInvoices.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between p-3 hover:bg-neutral-50">
                        <button
                          type="button"
                          onClick={() => {
                            if (inv.isLegacy) handleViewLegacyInvoice(inv.legacyInvoiceId)
                            else {
                              setSelectedSale({ id: inv.operatingSaleId, invoiceNo: inv.invoiceNumber })
                              setShowInvoiceModal(true)
                            }
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {inv.isLegacy ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">STARPLUS</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800">FROZENHUB</span>
                              )}
                              <span className="font-bold text-sm text-neutral-900">#{inv.invoiceNumber}</span>
                            </div>
                            <span className="font-bold text-sm text-neutral-900">{formatCurrency(inv.grandTotal)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                            <span className="truncate max-w-[180px] font-medium text-neutral-700">{inv.customerName || 'Cash Customer'}</span>
                            <span>{formatDate(inv.invoiceDate)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px]">
                            <span className="text-neutral-500">Paid: {formatCurrency(inv.paidAmount)}</span>
                            {inv.outstandingBalance > 0.005 ? (
                              <span className="font-bold text-rose-600">Due: {formatCurrency(inv.outstandingBalance)}</span>
                            ) : (
                              <span className="font-medium text-emerald-600">Settled</span>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )
            )}

            {/* Pagination Controls (Shared across all tabs) */}
            {(totalPages > 1 || totalCount > 10) && (
              <div className="bg-neutral-50 px-3 py-2 flex items-center justify-between border-t border-neutral-200 flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-600">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="border border-neutral-300 rounded px-2 py-1 text-xs bg-white"
                  >
                    {[10, 20, 30, 50, 100].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="text-neutral-700">
                  Page <span className="font-semibold">{currentPage}</span> of{' '}
                  <span className="font-semibold">{totalPages}</span> ({totalCount} total)
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center px-2.5 py-1.5 border border-neutral-300 rounded-md text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center px-2.5 py-1.5 border border-neutral-300 rounded-md text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* FrozenHub Invoice Preview Modal */}
      {showInvoiceModal && selectedSale && (
        <InvoicePreviewModal
          saleId={selectedSale.id}
          invoiceNo={selectedSale.invoiceNo}
          onInvoiceNumberChanged={() => fetchSales()}
          onClose={() => {
            setShowInvoiceModal(false)
            setSelectedSale(null)
          }}
        />
      )}

      {/* Legacy Starplus Detail Modal */}
      {showLegacyModal && selectedLegacyInvoiceId && (
        <LegacyInvoiceDetailModal
          invoiceId={selectedLegacyInvoiceId}
          isOpen={showLegacyModal}
          onClose={() => {
            setShowLegacyModal(false)
            setSelectedLegacyInvoiceId(null)
          }}
        />
      )}

      {/* Receipt Modal */}
      <ReceiptPreviewModal
        paymentIds={receiptPreviewPaymentIds}
        isOpen={showReceiptPreviewModal}
        onClose={() => {
          setShowReceiptPreviewModal(false)
          setReceiptPreviewPaymentIds([])
        }}
      />

      <ChangeInvoiceNumberModal
        isOpen={!!saleToRenumber}
        sale={saleToRenumber}
        onClose={() => setSaleToRenumber(null)}
        onChanged={() => fetchData()}
      />

      {/* Danger Delete Modal */}
      <ConfirmDangerModal
        isOpen={!!saleToDelete}
        onClose={() => setSaleToDelete(null)}
        onConfirm={handleConfirmDeleteSale}
        title="Delete invoice"
        message="This removes the invoice from active billing and balances, restores its stock and voids its payments. The invoice number is never reused and the record stays in the audit log. This cannot be undone from here."
        confirmLabel="Delete"
        requireTypedText="DELETE"
      />
    </div>
  )
}

export default BillingHistoryPage
