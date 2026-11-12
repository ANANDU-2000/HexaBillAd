import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { askAgentItem } from '../assistant/askAgent'
import { isAssistantEnabled } from '../assistant/assistantDraft'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  Search,
  Eye,
  Download,
  Printer,
  RefreshCw,
  FileText,
  Wallet,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Edit,
  CheckSquare,
  Square,
  AlertTriangle,
  Lock
} from 'lucide-react'
import { OverflowMenu, TableSkeleton } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { salesAPI, paymentsAPI, legacyAPI } from '../../services/index'
import { formatCurrency } from '../../utils/currency'
import { getInvoicePaymentBadge, isInvoiceFullySettled } from '../../utils/salePaymentSettlement'
import { historicalCollectionId } from '../../utils/customerBillRows'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'
import InvoicePreviewModal from '../../components/InvoicePreviewModal'
import ReceiptPreviewModal from '../../components/ReceiptPreviewModal'
import LoadStatusNotice from '../../components/LoadStatusNotice'
import { useRequestControl } from '../../hooks/useRequestControl'
import ConfirmDangerModal from '../../components/ConfirmDangerModal'
import LegacyInvoiceDetailModal from '../../components/LegacyInvoiceDetailModal'
import ChangeInvoiceNumberModal from './ChangeInvoiceNumberModal'
import { readBillingHistorySearchParams, syncBillingHistorySearchParams } from '../../utils/billingHistoryUrl'
import { PERIOD_PRESETS, resolvePeriod } from '../../utils/businessDateRange'
import { buildCustomerLedgerHref } from '../../utils/customerLedgerUrl'

const STATUS_OPTIONS = [
  { id: 'all', label: 'Any status' },
  { id: 'paid', label: 'Paid' },
  { id: 'partial', label: 'Partial' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'voided', label: 'Voided' }
]

const VOIDED_BADGE = { label: 'Voided', colorClass: 'bg-neutral-200 text-neutral-700 ring-1 ring-inset ring-neutral-300' }

// Where a Collect or Customer ledger action lands: a live sale id, or the negative id of a historical invoice.
const collectionTargetFor = (inv) => {
  if (inv.isLegacy) return historicalCollectionId(inv)
  if (inv.isDeleted || !inv.customerId) return undefined
  return isInvoiceFullySettled(toSale(inv)) ? undefined : inv.operatingSaleId
}

/** Shape an operating row so the existing sale helpers (badge, ledger, receipt) work unchanged. */
const toSale = (inv) => ({
  id: inv.operatingSaleId,
  invoiceNo: inv.invoiceNumber,
  customerId: inv.customerId,
  customerName: inv.customerName,
  grandTotal: inv.grandTotal,
  paidAmount: inv.paidAmount,
  paymentStatus: inv.paymentStatus
})

const rowBadge = (inv) => (inv.isDeleted ? VOIDED_BADGE : getInvoicePaymentBadge(toSale(inv)))

/**
 * Billing History: one list of every invoice this business can see, newest first.
 * Historical invoices brought over from the previous system sit in the same list, keep their
 * original number, date, amounts and issuer, and are read-only. Tenants without history simply
 * see their own invoices. The server enforces tenant scope; nothing here is tenant-specific.
 */
const BillingHistoryPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const initial = useMemo(() => readBillingHistorySearchParams(searchParams), []) // eslint-disable-line react-hooks/exhaustive-deps

  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [rows, setRows] = useState([])
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [searchTerm, setSearchTerm] = useState(initial.search)
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [currentPage, setCurrentPage] = useState(initial.page)
  const [pageSize, setPageSize] = useState(20)
  const [period, setPeriod] = useState(initial.period)
  const [customRange, setCustomRange] = useState({ from: initial.from, to: initial.to })
  const [status, setStatus] = useState(initial.status)
  const [sort, setSort] = useState(initial.sort)

  const [selectedSale, setSelectedSale] = useState(null)
  const [selectedInvoices, setSelectedInvoices] = useState([])
  const [saleToDelete, setSaleToDelete] = useState(null)
  const [showReceiptPreviewModal, setShowReceiptPreviewModal] = useState(false)
  const [receiptPreviewPaymentIds, setReceiptPreviewPaymentIds] = useState([])
  const [loadingReceiptSaleId, setLoadingReceiptSaleId] = useState(null)
  const [saleToRenumber, setSaleToRenumber] = useState(null)
  const [selectedLegacyInvoiceId, setSelectedLegacyInvoiceId] = useState(null)

  const role = user?.role?.toLowerCase()
  const isAdmin = role === 'admin' || role === 'owner'
  const canEdit = isAdmin

  // Effective inclusive Dubai date range for the request.
  const range = useMemo(() => {
    if (period === 'custom') return customRange
    return resolvePeriod(period) || { from: '', to: '' }
  }, [period, customRange])

  const listRequest = useRequestControl()
  const fetchData = useCallback(async () => {
    if (range.from && range.to && range.from > range.to) {
      setListError(false)
      setRows([])
      setTotalCount(0)
      setTotalPages(1)
      setLoading(false)
      return
    }
    // P-01: a newer request aborts this one; only the latest response is applied.
    const ticket = listRequest.start()
    setLoading(true)
    setListError(false)
    try {
      const params = { page: currentPage, pageSize }
      const q = debouncedSearch.trim()
      if (q) params.search = q
      if (range.from) params.fromDate = range.from
      if (range.to) params.toDate = range.to
      if (status !== 'all') params.status = status
      if (sort !== 'newest') params.sort = sort
      const response = await legacyAPI.getUnifiedInvoices(params, { signal: ticket.signal, silent: true })
      if (!ticket.isCurrent()) return // a newer request superseded this one
      if (response?.success && response.data) {
        setRows(response.data.items || [])
        setTotalCount(response.data.totalCount || 0)
        setTotalPages(Math.max(1, response.data.totalPages || 1))
      } else {
        setListError(true)
      }
    } catch (error) {
      const kind = ticket.classify(error)
      if (kind === 'superseded') return
      if (kind === 'error') console.error('Error fetching billing history:', error)
      setListError(true)
    } finally {
      if (ticket.isCurrent()) setLoading(false)
      ticket.finish()
    }
  }, [currentPage, pageSize, debouncedSearch, range.from, range.to, status, sort])

  const fetchDataRef = useRef(fetchData)
  fetchDataRef.current = fetchData

  // State → URL (also strips the deprecated ?tab= on first render).
  const lastWrittenSearch = useRef(initial.search.trim())
  useEffect(() => {
    lastWrittenSearch.current = debouncedSearch.trim()
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      syncBillingHistorySearchParams(params, {
        search: debouncedSearch,
        page: currentPage,
        period,
        from: customRange.from,
        to: customRange.to,
        status,
        sort
      })
      return params
    }, { replace: true })
  }, [debouncedSearch, currentPage, period, customRange.from, customRange.to, status, sort, setSearchParams])

  // URL → state for Back/Forward and links into this page.
  useEffect(() => {
    const s = readBillingHistorySearchParams(searchParams)
    setCurrentPage((c) => (c === s.page ? c : s.page))
    setPeriod((p) => (p === s.period ? p : s.period))
    if (s.period === 'custom') {
      setCustomRange((r) => (r.from === s.from && r.to === s.to ? r : { from: s.from, to: s.to }))
    }
    setStatus((v) => (v === s.status ? v : s.status))
    setSort((v) => (v === s.sort ? v : s.sort))
    // Only adopt the URL search when it came from navigation, not from our own debounced write
    // (otherwise characters typed during the debounce window would be lost).
    if (s.search.trim() !== lastWrittenSearch.current) {
      lastWrittenSearch.current = s.search.trim()
      setSearchTerm(s.search)
    }
  }, [searchParams])

  useEffect(() => {
    fetchDataRef.current()
  }, [currentPage, pageSize, debouncedSearch, range.from, range.to, status, sort])

  // Selection is per page and only for current (operating) invoices.
  useEffect(() => {
    setSelectedInvoices([])
  }, [currentPage, pageSize, debouncedSearch, range.from, range.to, status, sort])

  const prevSearch = useRef(debouncedSearch)
  useEffect(() => {
    if (prevSearch.current !== debouncedSearch) {
      prevSearch.current = debouncedSearch
      setCurrentPage(1)
    }
  }, [debouncedSearch])

  useEffect(() => {
    const handleDataUpdate = () => fetchDataRef.current()
    window.addEventListener('dataUpdated', handleDataUpdate)
    return () => window.removeEventListener('dataUpdated', handleDataUpdate)
  }, [])

  const choosePeriod = (id) => {
    if (id === 'custom') {
      // Start the custom range from whatever is currently shown.
      setCustomRange({ from: range.from || '', to: range.to || '' })
    }
    setPeriod(id)
    setCurrentPage(1)
  }

  const setCustomDate = (key, value) => {
    setPeriod('custom')
    setCustomRange((r) => ({ ...r, [key]: value }))
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setSearchTerm('')
    setPeriod('all')
    setCustomRange({ from: '', to: '' })
    setStatus('all')
    setSort('newest')
    setCurrentPage(1)
  }

  const hasFilters = !!searchTerm || period !== 'all' || status !== 'all' || sort !== 'newest'
  const rangeInvalid = !!(range.from && range.to && range.from > range.to)

  const billingReturnTo = location.pathname + location.search

  const openInvoice = (inv) => {
    if (inv.isLegacy) {
      setSelectedLegacyInvoiceId(inv.legacyInvoiceId)
    } else if (!inv.isDeleted) {
      setSelectedSale({ id: inv.operatingSaleId, invoiceNo: inv.invoiceNumber })
    }
  }

  const openCustomerLedger = (inv) => {
    if (!inv.customerId) {
      toast.error('This invoice has no customer ledger')
      return
    }
    const paymentTarget = collectionTargetFor(inv)
    navigate(
      buildCustomerLedgerHref({
        customerId: inv.customerId,
        recordPaymentSaleId: paymentTarget
      }),
      { state: { returnTo: billingReturnTo } }
    )
  }

  const handleEditSale = (inv) => {
    navigate(`/pos?editId=${inv.operatingSaleId}`, { state: { returnTo: billingReturnTo } })
  }

  const handleConfirmDeleteSale = async () => {
    if (!saleToDelete) return
    const saleId = saleToDelete
    setSaleToDelete(null)
    try {
      const response = await salesAPI.deleteSale(saleId)
      if (response.success) {
        toast.success('Invoice deleted successfully!', { id: 'invoice-delete', duration: 4000 })
        window.dispatchEvent(new CustomEvent('dataUpdated'))
        fetchDataRef.current()
      } else {
        toast.error(response.message || 'Failed to delete invoice', { id: 'invoice-delete' })
      }
    } catch (error) {
      console.error('Failed to delete sale:', error)
      toast.error(error?.response?.data?.message || 'Failed to delete invoice', { id: 'invoice-delete' })
    }
  }

  const hasReceipt = (inv) => {
    if (inv.isLegacy || inv.isDeleted) return false
    const badge = getInvoicePaymentBadge(toSale(inv))
    return badge.label === 'Paid' || badge.label === 'Partial'
  }

  const handlePrintPaymentReceipt = async (inv) => {
    const saleId = inv.operatingSaleId
    if (!saleId || !hasReceipt(inv)) {
      toast.error('No payment receipt for unpaid invoices')
      return
    }
    try {
      setLoadingReceiptSaleId(saleId)
      toast.loading('Loading payment receipt...', { id: 'bh-receipt' })
      const response = await paymentsAPI.getInvoiceReceiptPaymentIds(saleId)
      if (!response?.success || !Array.isArray(response.data)) {
        throw new Error(response?.message || 'Invoice payments could not be loaded. Please try again.')
      }
      if (response.data.length === 0) {
        toast.error('No cleared incoming payments found for this invoice', { id: 'bh-receipt' })
        return
      }
      toast.dismiss('bh-receipt')
      setReceiptPreviewPaymentIds(response.data)
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

  const selectableIds = rows.filter((r) => !r.isLegacy && !r.isDeleted).map((r) => r.operatingSaleId)
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedInvoices.includes(id))

  const toggleSelectInvoice = (saleId) => {
    setSelectedInvoices((prev) => (prev.includes(saleId) ? prev.filter((id) => id !== saleId) : [...prev, saleId]))
  }

  const toggleSelectAll = () => {
    setSelectedInvoices(allSelected ? [] : selectableIds)
  }

  const handleCombinedPdf = async () => {
    if (selectedInvoices.length === 0) {
      toast.error('Please select at least one invoice')
      return
    }
    try {
      toast.loading('Generating combined PDF...', { id: 'combined-pdf' })
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
      toast.success(`Combined PDF generated for ${selectedInvoices.length} invoice(s)`, { id: 'combined-pdf', duration: 4000 })
      setSelectedInvoices([])
    } catch (error) {
      console.error('Failed to generate combined PDF:', error)
      toast.error('Could not export the invoices.', { id: 'combined-pdf' })
    }
  }

  const formatDate = (value) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' })
  }

  const firstRow = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const lastRow = Math.min(totalCount, currentPage * pageSize)

  const rowActions = (inv) => {
    const sale = toSale(inv)
    return [
      { label: inv.isLegacy ? 'View invoice & items' : 'View invoice', icon: Eye, hidden: !inv.isLegacy && inv.isDeleted, onClick: () => openInvoice(inv) },
      { label: 'Customer ledger', icon: Wallet, hidden: !inv.customerId, onClick: () => openCustomerLedger(inv) },
      askAgentItem({ kind: 'invoice', label: inv.invoiceNumber }, { hidden: !isAssistantEnabled(import.meta.env) || !inv.invoiceNumber }),
      { label: 'Print receipt', icon: Printer, hidden: !hasReceipt(inv), disabled: loadingReceiptSaleId === sale.id, onClick: () => handlePrintPaymentReceipt(inv) },
      { label: 'Edit invoice', icon: Edit, hidden: !canEdit || inv.isLegacy || inv.isDeleted, onClick: () => handleEditSale(inv) },
      { label: 'Delete invoice', icon: Trash2, hidden: !isAdmin || inv.isLegacy || inv.isDeleted, danger: true, separatorBefore: true, onClick: () => setSaleToDelete(inv.operatingSaleId) }
    ]
  }

  const renderInvoiceNumber = (inv) => (
    <span className="inline-flex items-center gap-1">
      <span>{inv.invoiceNumber}</span>
      {inv.isLegacy && (
        <Lock
          className="h-3 w-3 text-neutral-400"
          aria-label="Original invoice, read-only"
          title={`Original invoice${inv.legacyIssuer ? ` issued by ${inv.legacyIssuer}` : ''}. Read-only.`}
        />
      )}
    </span>
  )

  return (
    <div className="space-y-2 max-w-full overflow-x-hidden h-full min-h-0 flex flex-col">
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-neutral-900">Billing History</h1>
            <p className="text-xs text-neutral-500" aria-live="polite">
              {loading ? 'Loading…' : listError ? '' : `${totalCount.toLocaleString('en-US')} invoice${totalCount === 1 ? '' : 's'}`}
            </p>
          </div>
          {selectedInvoices.length > 0 && (
            <button
              type="button"
              onClick={handleCombinedPdf}
              className="inline-flex items-center px-3 py-1.5 bg-success text-white rounded-md text-xs font-medium hover:bg-green-700"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Combined PDF ({selectedInvoices.length})
            </button>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); setCurrentPage(1); fetchDataRef.current() }}
          className="bg-white border border-neutral-200 rounded-lg p-2 space-y-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative basis-full sm:basis-auto min-w-0 sm:min-w-[9rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
              <input
                type="search"
                placeholder="Search invoice number or customer…"
                aria-label="Search invoices"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input w-full pl-9 text-xs sm:text-sm"
              />
            </div>
            <label className="sr-only" htmlFor="bh-status">Payment status</label>
            <select id="bh-status" value={status} onChange={(e) => { setStatus(e.target.value); setCurrentPage(1) }} className="input min-w-0 flex-1 sm:flex-none sm:w-auto text-xs sm:text-sm">
              {STATUS_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <label className="sr-only" htmlFor="bh-sort">Sort</label>
            <select id="bh-sort" value={sort} onChange={(e) => { setSort(e.target.value); setCurrentPage(1) }} className="input min-w-0 flex-1 sm:flex-none sm:w-auto text-xs sm:text-sm">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="btn btn-ghost shrink-0" aria-label="Clear filters">
                <X className="h-4 w-4" aria-hidden />
                <span className="hidden lg:inline text-xs">Clear</span>
              </button>
            )}
            <button type="button" onClick={() => fetchDataRef.current()} className="btn btn-ghost shrink-0" aria-label="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            </button>
          </div>
          <div className="flex flex-nowrap md:flex-wrap items-center gap-1 overflow-x-auto -mx-0.5 px-0.5 pb-0.5" role="group" aria-label="Date period">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => choosePeriod(p.id)}
                aria-pressed={period === p.id}
                className={`shrink-0 whitespace-nowrap px-3 min-h-11 lg:min-h-0 py-1 rounded-md text-xs font-semibold transition ${
                  period === p.id ? 'bg-primary-600 text-white' : 'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                {p.label}
              </button>
            ))}
            {period === 'custom' && (
              <span className="flex shrink-0 items-center gap-1.5 ml-1">
                <label className="sr-only" htmlFor="bh-from">From date</label>
                <input id="bh-from" type="date" value={customRange.from} onChange={(e) => setCustomDate('from', e.target.value)} className="input w-36 text-xs" />
                <span className="text-xs text-neutral-500">to</span>
                <label className="sr-only" htmlFor="bh-to">To date</label>
                <input id="bh-to" type="date" value={customRange.to} onChange={(e) => setCustomDate('to', e.target.value)} className="input w-36 text-xs" />
              </span>
            )}
            {period !== 'all' && period !== 'custom' && range.from && (
              <span className="ml-1 shrink-0 whitespace-nowrap text-xs text-neutral-500">
                {range.from === range.to ? formatDate(range.from) : `${formatDate(range.from)} – ${formatDate(range.to)}`}
              </span>
            )}
          </div>
          {rangeInvalid && <p className="text-xs text-rose-600">From date must be on or before To date.</p>}
        </form>
      </div>

      <LoadStatusNotice phase={listRequest.phase} onCancel={listRequest.cancel} onRetry={() => fetchDataRef.current()} className="mb-2" />
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden flex-1 min-h-0 overflow-y-auto">
        {loading && rows.length === 0 ? (
          <TableSkeleton rows={10} className="border-0 rounded-none" />
        ) : listError ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center" role="alert">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-error-bg text-error-fg" aria-hidden>
              <AlertTriangle className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-neutral-900">Billing history could not be loaded</p>
            <p className="max-w-xs text-xs text-neutral-500">No totals are shown until it loads.</p>
            <button type="button" className="mt-1 inline-flex min-h-touch items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 active:scale-[0.99]" onClick={() => fetchDataRef.current()}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-neutral-400" />
            <h3 className="mt-2 text-sm font-medium text-neutral-900">No invoices found</h3>
            <p className="mt-1 text-sm text-neutral-500">
              {hasFilters ? 'Try a different period, status or search.' : 'Create your first invoice from POS.'}
            </p>
          </div>
        ) : (
          <>
            <div className={`hidden md:block overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
              <table className="min-w-full divide-y divide-neutral-200 text-xs">
                <thead className="bg-neutral-50 sticky top-0 z-20">
                  <tr>
                    <th className="px-2 py-1.5 text-left">
                      <button type="button" onClick={toggleSelectAll} disabled={selectableIds.length === 0} className="text-neutral-500 hover:text-neutral-700 disabled:opacity-30" aria-label="Select all current invoices on this page">
                        {allSelected ? <CheckSquare className="h-4 w-4 text-primary-600" /> : <Square className="h-4 w-4" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 text-left font-semibold text-neutral-600">Invoice #</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-neutral-600">Date</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-neutral-600">Customer</th>
                    <th className="hidden xl:table-cell px-2 py-1.5 text-right font-semibold text-neutral-600">Subtotal</th>
                    <th className="hidden xl:table-cell px-2 py-1.5 text-right font-semibold text-neutral-600">VAT</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-neutral-600">Total</th>
                    <th className="hidden xl:table-cell px-2 py-1.5 text-right font-semibold text-neutral-600">Paid</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-neutral-600">Outstanding</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-neutral-600">Status</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-neutral-600 lg:sticky lg:right-0 bg-neutral-50">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-100">
                  {rows.map((inv) => {
                    const badge = rowBadge(inv)
                    const selectable = !inv.isLegacy && !inv.isDeleted
                    const outstanding = Number(inv.outstandingBalance) || 0
                    return (
                      <tr key={inv.id} className="group hover:bg-neutral-50">
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {selectable && (
                            <button type="button" onClick={() => toggleSelectInvoice(inv.operatingSaleId)} className="text-neutral-500 hover:text-primary-600" aria-label={`Select invoice ${inv.invoiceNumber}`}>
                              {selectedInvoices.includes(inv.operatingSaleId) ? <CheckSquare className="h-4 w-4 text-primary-600" /> : <Square className="h-4 w-4" />}
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap font-semibold text-neutral-900">
                          <button type="button" onClick={() => openInvoice(inv)} disabled={!inv.isLegacy && inv.isDeleted} className="hover:underline disabled:no-underline">
                            {renderInvoiceNumber(inv)}
                          </button>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-neutral-600">{formatDate(inv.invoiceDate)}</td>
                        <td className="px-2 py-1.5 font-medium text-neutral-900 max-w-[200px] truncate" title={inv.customerName || ''}>
                          {inv.customerName || <span className="text-neutral-400 italic">Cash customer</span>}
                        </td>
                        <td className="hidden xl:table-cell px-2 py-1.5 whitespace-nowrap text-right text-neutral-800 tabular-nums">{formatCurrency(inv.subtotal || 0)}</td>
                        <td className="hidden xl:table-cell px-2 py-1.5 whitespace-nowrap text-right text-neutral-800 tabular-nums">{formatCurrency(inv.vatTotal || 0)}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-right font-bold text-neutral-900 tabular-nums">{formatCurrency(inv.grandTotal || 0)}</td>
                        <td className="hidden xl:table-cell px-2 py-1.5 whitespace-nowrap text-right text-neutral-700 tabular-nums">{formatCurrency(inv.paidAmount || 0)}</td>
                        <td className={`px-2 py-1.5 whitespace-nowrap text-right tabular-nums ${outstanding > 0 && !inv.isDeleted ? 'font-semibold text-neutral-900' : 'text-neutral-400'}`}>
                          {formatCurrency(inv.isDeleted ? 0 : outstanding)}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.colorClass}`}>{badge.label}</span>
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-right lg:sticky lg:right-0 z-10 bg-white group-hover:bg-neutral-50">
                          <div className="flex items-center justify-end gap-1">
                            {(inv.isLegacy || !inv.isDeleted) && (
                              <button type="button" onClick={() => openInvoice(inv)} className="inline-flex h-11 w-11 lg:h-7 lg:w-7 items-center justify-center rounded-md text-primary-600 hover:bg-primary-50" title={inv.isLegacy ? 'View invoice & items' : 'View invoice'} aria-label={`View invoice ${inv.invoiceNumber}`}>
                                <Eye className="h-4 w-4" />
                              </button>
                            )}
                            {inv.customerId && (
                              <button type="button" onClick={() => openCustomerLedger(inv)} className="inline-flex h-11 w-11 lg:h-7 lg:w-7 items-center justify-center rounded-md text-emerald-700 hover:bg-emerald-50" title="Customer ledger" aria-label={`Customer ledger for invoice ${inv.invoiceNumber}`}>
                                <Wallet className="h-4 w-4" />
                              </button>
                            )}
                            {hasReceipt(inv) && (
                              <button type="button" onClick={() => handlePrintPaymentReceipt(inv)} disabled={loadingReceiptSaleId === inv.operatingSaleId} className="inline-flex h-11 w-11 lg:h-7 lg:w-7 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 disabled:opacity-50" title="Print receipt" aria-label={`Print receipt for invoice ${inv.invoiceNumber}`}>
                                <Printer className="h-4 w-4" />
                              </button>
                            )}
                            {canEdit && selectable && (
                              <button type="button" onClick={() => handleEditSale(inv)} className="inline-flex h-11 w-11 lg:h-7 lg:w-7 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100" title="Edit invoice" aria-label={`Edit invoice ${inv.invoiceNumber}`}>
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                            {isAdmin && selectable && (
                              <button type="button" onClick={() => setSaleToDelete(inv.operatingSaleId)} className="inline-flex h-11 w-11 lg:h-7 lg:w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-rose-50 hover:text-rose-600" title="Delete invoice" aria-label={`Delete invoice ${inv.invoiceNumber}`}>
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

            <ul className={`md:hidden divide-y divide-neutral-200 ${loading ? 'opacity-60' : ''}`}>
              {rows.map((inv) => {
                const badge = rowBadge(inv)
                const outstanding = Number(inv.outstandingBalance) || 0
                const collectable = collectionTargetFor(inv) !== undefined
                return (
                  <li key={inv.id} className="flex items-center gap-2 px-3 py-2">
                    <button type="button" onClick={() => openInvoice(inv)} className="min-w-0 flex-1 text-start">
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold text-neutral-900">{renderInvoiceNumber(inv)}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">{formatCurrency(inv.grandTotal || 0)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2 text-xs">
                        <span className="break-words text-neutral-600">{inv.customerName || 'Cash customer'}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.colorClass}`}>{badge.label}</span>
                          <span className="tabular-nums text-neutral-500">{formatDate(inv.invoiceDate)}</span>
                        </span>
                      </span>
                      {outstanding > 0 && !inv.isDeleted && (
                        <span className="mt-0.5 block text-xs text-neutral-600 tabular-nums">Due {formatCurrency(outstanding)}</span>
                      )}
                    </button>
                    {collectable && (
                      <button type="button" onClick={() => openCustomerLedger(inv)} className="btn btn-secondary btn-sm shrink-0 text-xs min-h-11 lg:min-h-0">
                        Collect
                      </button>
                    )}
                    <OverflowMenu label={`Actions for ${inv.invoiceNumber}`} items={rowActions(inv)} />
                  </li>
                )
              })}
            </ul>

            <div className="bg-neutral-50 px-3 py-2 flex items-center justify-between border-t border-neutral-200 flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2">
                <label htmlFor="bh-page-size" className="text-neutral-600">Rows</label>
                <select
                  id="bh-page-size"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                  className="border border-neutral-300 rounded px-2 py-1 text-xs bg-white"
                >
                  {[20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="text-neutral-700 tabular-nums">
                {firstRow.toLocaleString('en-US')}–{lastRow.toLocaleString('en-US')} of {totalCount.toLocaleString('en-US')}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || loading}
                  className="inline-flex items-center px-2.5 py-1.5 border border-neutral-300 rounded-md text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                  Previous
                </button>
                <span className="text-neutral-600 tabular-nums">{currentPage} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || loading}
                  className="inline-flex items-center px-2.5 py-1.5 border border-neutral-300 rounded-md text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedSale && (
        <InvoicePreviewModal
          saleId={selectedSale.id}
          invoiceNo={selectedSale.invoiceNo}
          onInvoiceNumberChanged={() => fetchDataRef.current()}
          onClose={() => setSelectedSale(null)}
        />
      )}

      {selectedLegacyInvoiceId && (
        <LegacyInvoiceDetailModal
          invoiceId={selectedLegacyInvoiceId}
          isOpen
          onClose={() => setSelectedLegacyInvoiceId(null)}
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

      <ChangeInvoiceNumberModal
        isOpen={!!saleToRenumber}
        sale={saleToRenumber}
        onClose={() => setSaleToRenumber(null)}
        onChanged={() => fetchDataRef.current()}
      />

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
