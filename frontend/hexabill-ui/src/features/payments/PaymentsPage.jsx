import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { loadAllCustomerPages } from '../../utils/loadAllPages'
import { fixMoney } from '../../utils/productFields'
import { statusTone } from '../../utils/statusTone'
import { useForm } from 'react-hook-form'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { 
  Plus, 
  Search, 
  Filter, 
  RefreshCw,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  DollarSign,
  Calendar,
  Edit,
  Trash2,
  FileText,
  User,
  Phone,
  Mail,
  MapPin,
  Printer,
  X
} from 'lucide-react'
import { formatCurrency, formatBalance, formatBalanceWithColor } from '../../utils/currency'
import { LoadingCard, LoadingButton } from '../../components/Loading'
import { Input, Select } from '../../components/Form'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import DateField from '../../components/ui/DateField'
import Modal from '../../components/Modal'
import ReceiptPreviewModal from '../../components/ReceiptPreviewModal'
import EditPaymentModal from '../../components/EditPaymentModal'
import ConfirmDangerModal from '../../components/ConfirmDangerModal'
import { paymentsAPI, customersAPI, legacyAPI } from '../../services/index'
import { useDebounce } from '../../hooks/useDebounce'
import { canManagePayments } from '../../utils/roles'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import { localDateString } from '../../utils/dateFormat'
import { readPaymentsStateFromParams, syncPaymentsSearchParams, paymentListParams, paymentDateRangeError } from '../../utils/paymentsUrl'
import { getReturnLabel, showReturnToPrompt } from '../../utils/returnNavigation'
import { offerReceiptPreviewAfterPayment } from '../../utils/offerReceiptPreview'
import { canReceivePaymentReceipt as canReceiveBase, currentReceiptSelection, receiptIneligibilityReason, paymentStatusLabel, receiptSelectionSummary, toggleVisibleReceiptSelection, mergeSelectedPaymentRecords } from '../../utils/receiptEligibility'
import { useBranding } from '../../tenant/TenantBrandingContext'
import Alert from '../../components/ui/Alert'
import TableSkeleton from '../../components/ui/TableSkeleton'
import { ModernTable, Badge, OverflowMenu } from '../../components/ui'
import { statusKind } from '../../utils/statusTone'
import { bulkRowFromSaved, createLedgerPaymentJournal, createPaymentBatchJournal, isDefinitivePaymentRejection, ledgerPaymentAccountPrefix, ledgerPaymentForm, ledgerPaymentScope, paymentBatchScope, paymentRejectionMessage, reconcilePaymentKey, settleAllPendingPayments } from '../../utils/ledgerPaymentIntent'

// Historical payments come from the old system and are read-only. Their ids live in a different number
// space, so the page re-keys them ("h-<id>") and they can never be selected or receipted by mistake.
const canReceivePaymentReceipt = (payment) => !payment?.isHistorical && canReceiveBase(payment)

const PaymentsPage = () => {
  const { user } = useAuth()
  const { currency: tenantCurrency = 'AED' } = useBranding()
  const money = (value) => formatCurrency(value, tenantCurrency)
  const balance = (value) => formatBalance(value, tenantCurrency)
  // Name stays the label; phone and balance are secondary so the searchable list reads at a glance.
  const customerOption = (customer) => ({
    value: customer.id,
    label: customer.name,
    meta: customer.phone || '',
    hint: balance(customer.balance || 0),
    hintClassName: Number(customer.balance) > 0 ? 'text-red-600' : 'text-neutral-500'
  })
  const canEditPayments = canManagePayments(user)
  const location = useLocation()
  const navigate = useNavigate()
  const returnTo = typeof location.state?.returnTo === 'string' ? location.state.returnTo : null
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false) // Separate state for form submission
  const [payments, setPayments] = useState([])
  const [filteredPayments, setFilteredPayments] = useState([])
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '')
  const [filterMethod, setFilterMethod] = useState(() => searchParams.get('method') || '')
  const [filterStatus, setFilterStatus] = useState(() => searchParams.get('status') || '')
  const [fromDate, setFromDate] = useState(() => readPaymentsStateFromParams(searchParams).fromDate)
  const [toDate, setToDate] = useState(() => readPaymentsStateFromParams(searchParams).toDate)
  const [page, setPage] = useState(() => readPaymentsStateFromParams(searchParams).page)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [showDateFilters, setShowDateFilters] = useState(false)
  const [listError, setListError] = useState('')
  const listRequestRef = useRef(0)
  const fetchDataRef = useRef(null)
  const dateRangeError = paymentDateRangeError({ fromDate, toDate })
  const openedCustomerFromUrlRef = useRef(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [paymentToDelete, setPaymentToDelete] = useState(null)
  const [customers, setCustomers] = useState([])
  const [sales, setSales] = useState([])
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState(null)
  const [outstandingInvoices, setOutstandingInvoices] = useState([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false)
  const [bulkPayments, setBulkPayments] = useState([{ customerId: '', amount: '', method: 'Cash', paymentDate: localDateString(new Date()) }])
  const [selectedPaymentIds, setSelectedPaymentIds] = useState([])
  // Historical (migrated) payments: shown in the same list, only for tenants that actually own historical rows.
  const [historicalCount, setHistoricalCount] = useState(0)
  const [historyKnown, setHistoryKnown] = useState(false)
  const [source, setSource] = useState('all')
  const [pageSize, setPageSize] = useState(50)
  const customersLoadedScopeRef = useRef(null)

  const selectedPaymentIdsRef = useRef(selectedPaymentIds)
  selectedPaymentIdsRef.current = selectedPaymentIds
  const [listScope, setListScope] = useState(null)
  const [showReceiptPreviewModal, setShowReceiptPreviewModal] = useState(false)
  const [receiptPreviewPaymentIds, setReceiptPreviewPaymentIds] = useState([])
  const submittingRef = useRef(false)
  const recoveryStorage = useMemo(() => ({
    getItem: key => window.sessionStorage.getItem(key),
    setItem: (key, value) => window.sessionStorage.setItem(key, value),
    removeItem: key => window.sessionStorage.removeItem(key),
    key: index => window.sessionStorage.key(index),
    get length() { return window.sessionStorage.length },
  }), [])
  const paymentJournal = useMemo(() => createLedgerPaymentJournal(recoveryStorage), [recoveryStorage])
  const batchJournal = useMemo(() => createPaymentBatchJournal(recoveryStorage), [recoveryStorage])
  const recoveryIdentity = useMemo(() => ({ origin: window.location.origin,
    tenantId: user?.tenantId, userId: user?.id }), [user?.tenantId, user?.id])
  const accountPrefix = ledgerPaymentAccountPrefix(recoveryIdentity)
  const bulkScope = paymentBatchScope(recoveryIdentity)
  const accountPrefixRef = useRef(accountPrefix)
  accountPrefixRef.current = accountPrefix
  useEffect(() => {
    setPayments([])
    setFilteredPayments([])
    setSelectedPaymentIds([])
    setCustomers([])
    setSelectedCustomerDetails(null)
    setOutstandingInvoices([])
    setListScope(null)
  }, [accountPrefix])
  const [unconfirmedPayments, setUnconfirmedPayments] = useState([])
  const [savedBatch, setSavedBatch] = useState(null)
  const [bulkRowErrors, setBulkRowErrors] = useState({})
  const [recoveryError, setRecoveryError] = useState(null)
  const refreshRecovery = useCallback(() => {
    try {
      setUnconfirmedPayments(paymentJournal.list(recoveryIdentity))
      setSavedBatch(bulkScope ? batchJournal.read(bulkScope) : null)
      setRecoveryError(null)
    } catch (error) { setRecoveryError(error.message) }
  }, [paymentJournal, batchJournal, recoveryIdentity, bulkScope])
  useEffect(() => {
    setUnconfirmedPayments([])
    setSavedBatch(null)
    refreshRecovery()
  }, [refreshRecovery])

  // A stale pending entry is no longer a blocker (see above). Deep link from the Pending Bills page: open the group
  // (bulk) payment entry directly so several customers can be paid in one batch once the account scope is ready.
  const bulkParam = searchParams.get('bulk')
  useEffect(() => {
    if (bulkParam === '1' && accountPrefix && listScope === accountPrefix) setShowBulkPaymentModal(true)
  }, [bulkParam, accountPrefix, listScope])
  useEffect(() => {
    if (!accountPrefix || user?.supportReadOnly) return
    let cancelled = false
    settleAllPendingPayments(paymentJournal, recoveryIdentity, (key) => reconcilePaymentKey(paymentsAPI.findPaymentByIdempotencyKey, key))
      .then((outcomes) => {
        if (cancelled) return
        if (outcomes.some((outcome) => outcome.state === 'saved' || outcome.state === 'not_saved')) refreshRecovery()
      })
      .catch(() => { /* The server could not be reached: keep the banners for the Retry button. */ })
    return () => { cancelled = true }
  }, [accountPrefix, paymentJournal, recoveryIdentity, refreshRecovery, unconfirmedPayments, user?.supportReadOnly])

  // The name when the customer is in the loaded list; otherwise the id, never a bare number pretending to be a name.
  const customerLabel = (id) => {
    if (id == null) return 'Cash Customer'
    const found = customers.find(c => String(c.id) === String(id))
    return found?.name || `#${id}`
  }

  const bulkRows = savedBatch ? savedBatch.rows.map(row => ({
    ...row.request, saleId: row.request.saleId ? String(row.request.saleId) : 'ACCOUNT', method: row.request.mode, paymentDate: JSON.parse(row.form).date,
    confirmed: row.confirmed,
  })) : bulkPayments

  // Each bulk row loads its customer's real unpaid invoices so a payment can be applied to a bill, to all bills (oldest first), or on account.
  const [bulkInvoices, setBulkInvoices] = useState({})
  const bulkCustomerKey = [...new Set(bulkRows.map(r => String(r.customerId || '')).filter(Boolean))].join(',')
  useEffect(() => {
    if (!showBulkPaymentModal) { setBulkInvoices({}); return }
    const missing = bulkCustomerKey.split(',').filter(id => id && !bulkInvoices[id])
    if (!missing.length) return
    setBulkInvoices(prev => { const next = { ...prev }; missing.forEach(id => { next[id] = { loading: true, list: [] } }); return next })
    missing.forEach(async (id) => {
      let list = []
      try {
        const res = await paymentsAPI.getOutstandingInvoices(id)
        list = res?.success && Array.isArray(res.data) ? res.data.filter(inv => Number(inv.balanceAmount) > 0.005) : []
      } catch { list = [] }
      setBulkInvoices(prev => ({ ...prev, [id]: { loading: false, list } }))
      const total = list.reduce((sum, inv) => sum + Number(inv.balanceAmount || 0), 0)
      // Pre-fill untouched rows for this customer: pay all unpaid bills, amount = total owed (editable).
      setBulkPayments(rows => rows.map(r => (String(r.customerId) === id && !r.saleId && !r.amount)
        ? { ...r, saleId: list.length ? 'ALL' : 'ACCOUNT', amount: list.length ? total.toFixed(2) : '' }
        : r))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBulkPaymentModal, bulkCustomerKey])

  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm()

  const paymentMethod = watch('method')
  const selectedSaleId = watch('saleId')
  const selectedCustomerId = watch('customerId')

  const clearPaymentCustomerIdFromUrl = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('customerId')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const closeAddPaymentModal = useCallback(() => {
    if (submittingRef.current) return
    setShowAddModal(false)
    reset()
    clearPaymentCustomerIdFromUrl()
  }, [reset, clearPaymentCustomerIdFromUrl])

  useEffect(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      syncPaymentsSearchParams(params, {
        search: searchTerm,
        method: filterMethod,
        status: filterStatus,
        fromDate, toDate, page,
        customerId: showAddModal ? prev.get('customerId') : null
      })
      return params
    }, { replace: true })
  }, [searchTerm, filterMethod, filterStatus, fromDate, toDate, page, showAddModal, setSearchParams])

  useEffect(() => {
    const parsed = readPaymentsStateFromParams(searchParams)
    setSearchTerm((s) => (s === parsed.search ? s : parsed.search))
    setFilterMethod((m) => (m === parsed.method ? m : parsed.method))
    setFilterStatus((st) => (st === parsed.status ? st : parsed.status))
    setFromDate((value) => value === parsed.fromDate ? value : parsed.fromDate)
    setToDate((value) => value === parsed.toDate ? value : parsed.toDate)
    setPage((value) => value === parsed.page ? value : parsed.page)
  }, [searchParams])

  useEffect(() => {
    const customerIdParam = searchParams.get('customerId')
    if (!customerIdParam || openedCustomerFromUrlRef.current || loading) return
    openedCustomerFromUrlRef.current = true
    setShowAddModal(true)
    setValue('customerId', parseInt(customerIdParam, 10))
  }, [loading, searchParams, setValue])

  // Load customer details and outstanding invoices when selected
  useEffect(() => {
    let isMounted = true
    
    const loadCustomerDetails = async () => {
      if (selectedCustomerId && isMounted) {
        try {
          setLoadingInvoices(true)
          const [customerRes, invoicesRes] = await Promise.all([
            customersAPI.getCustomer(selectedCustomerId),
            customersAPI.getOutstandingInvoices(selectedCustomerId)
          ])
          if (isMounted) {
            if (customerRes.success && customerRes.data) {
              setSelectedCustomerDetails(customerRes.data)
            }
            if (invoicesRes.success && invoicesRes.data) {
              setOutstandingInvoices(invoicesRes.data || [])
            }
          }
        } catch (error) {
          console.error('Failed to load customer details:', error)
          if (isMounted) {
            setOutstandingInvoices([])
          }
        } finally {
          if (isMounted) {
            setLoadingInvoices(false)
          }
        }
      } else if (isMounted) {
        setSelectedCustomerDetails(null)
        setOutstandingInvoices([])
      }
    }
    loadCustomerDetails()
    
    return () => {
      isMounted = false
    }
  }, [selectedCustomerId])

  // How many historical payments this tenant owns (0 for most tenants): decides whether the Source filter exists.
  useEffect(() => {
    let cancelled = false
    setHistoryKnown(false)
    setHistoricalCount(0)
    setSource('all')
    legacyAPI.getPaymentsSummary()
      .then((res) => { if (!cancelled) setHistoricalCount(Number(res?.data?.historicalCount) || 0) })
      .catch(() => { /* no history information: behave like a tenant without history */ })
      .finally(() => { if (!cancelled) setHistoryKnown(true) })
    return () => { cancelled = true }
  }, [accountPrefix])

  useEffect(() => {
    fetchDataRef.current?.()
    return () => { listRequestRef.current += 1 }
  }, [debouncedSearchTerm, filterMethod, filterStatus, fromDate, toDate, page, pageSize, accountPrefix, historyKnown, historicalCount, source])

  const fetchData = async () => {
    const requestId = ++listRequestRef.current
    const scope = accountPrefixRef.current
    if (dateRangeError) {
      setLoading(false)
      setListError('')
      setPayments([])
      setTotalCount(0)
      setTotalPages(1)
      return
    }
    if (!historyKnown) return
    setLoading(true)
    setListError('')
    try {
      const params = paymentListParams({
        page, pageSize, search: debouncedSearchTerm, method: filterMethod, status: filterStatus, fromDate, toDate
      })
      // Tenants with historical payments get one merged, server-paged history; everyone else keeps the original list.
      const useUnified = historicalCount > 0 && source !== 'current'
      const needCustomers = customersLoadedScopeRef.current !== scope
      const [paymentsRes, customersRes] = await Promise.all([
        useUnified ? legacyAPI.getUnifiedPayments({ ...params, source }) : paymentsAPI.getPayments(params),
        // The customer list only feeds the add-payment pickers: load it once per account, not on every search or page.
        needCustomers ? loadAllCustomerPages(customersAPI.getCustomers) : Promise.resolve(null)
      ])
      if (requestId !== listRequestRef.current || scope !== accountPrefixRef.current) return
      if (!paymentsRes.success || !paymentsRes.data) throw new Error('Payments could not be loaded.')
      const data = paymentsRes.data
      const pages = Math.max(1, Number(data.totalPages) || 1)
      setTotalCount(Number(data.totalCount) || 0)
      setTotalPages(pages)
      if (page > pages) {
        setPage(pages)
        return
      }
      const rows = (data.items || []).map((row) => (row.isHistorical ? { ...row, historicalId: row.id, id: `h-${row.id}` } : row))
      setPayments(previous => mergeSelectedPaymentRecords(previous, rows, selectedPaymentIdsRef.current))
      setFilteredPayments(rows)
      setListScope(scope)
      if (customersRes && (customersRes.items?.length || customersRes.response?.success)) {
        setCustomers(customersRes.items)
        customersLoadedScopeRef.current = scope
      }
      setSales([])
    } catch (error) {
      if (requestId !== listRequestRef.current || scope !== accountPrefixRef.current) return
      setListError(error.response?.data?.message || 'Payments could not be loaded. Please try again.')
      setPayments([])
      setTotalCount(0)
      setTotalPages(1)
    } finally {
      if (requestId === listRequestRef.current && scope === accountPrefixRef.current) setLoading(false)
    }
  }

  fetchDataRef.current = fetchData
  // Listen for data update events to refresh when payments are made (uses ref to avoid stale closure)
  useEffect(() => {
    const handleDataUpdate = () => {
      customersLoadedScopeRef.current = null // customers may have changed: reload them with this refresh
      if (fetchDataRef.current) fetchDataRef.current()
    }
    window.addEventListener('dataUpdated', handleDataUpdate)
    window.addEventListener('paymentCreated', handleDataUpdate)
    return () => {
      window.removeEventListener('dataUpdated', handleDataUpdate)
      window.removeEventListener('paymentCreated', handleDataUpdate)
    }
  }, [])


  const executePayment = async (intent) => {
    if (user?.supportReadOnly) { toast.error('This support session is read-only.'); return }
    if (submittingRef.current || !accountPrefixRef.current || !intent.scope.startsWith(accountPrefixRef.current)) return
    const prefix = accountPrefixRef.current
    submittingRef.current = true
    setSubmitting(true)
    try {
      const send = intent.kind === 'allocate' ? paymentsAPI.allocatePayment : paymentsAPI.createPayment
      const response = await send(intent.request, intent.idempotencyKey)
      const paymentBody = response?.data?.payment || response?.data
      if (response?.success === false || !paymentBody?.id) throw new Error(response?.message || 'Payment is unconfirmed. Retry the previous payment.')
      paymentJournal.complete(intent.scope, intent.idempotencyKey)
      if (prefix !== accountPrefixRef.current) return
      const paymentResult = response?.data?.payment || response?.data
      const voided = String(paymentResult?.status || '').toUpperCase() === 'VOID'
      toast.success(voided ? 'Previous payment is void. No new payment was recorded.' : 'Payment confirmed successfully!')
      if (!voided) offerReceiptPreviewAfterPayment(paymentResult, (paymentId) => {
        setReceiptPreviewPaymentIds([paymentId])
        setShowReceiptPreviewModal(true)
      })
      showReturnToPrompt(navigate, returnTo)
      setShowAddModal(false)
      reset()
      clearPaymentCustomerIdFromUrl()
      setSelectedPayment(null)
      await fetchDataRef.current?.()
      window.dispatchEvent(new CustomEvent('paymentCreated', { detail: { payment: response.data } }))
      window.dispatchEvent(new CustomEvent('dataUpdated'))
    } catch (error) {
      // A 400/422 means the server refused this payment and saved nothing for its key: release it instead of leaving a retry banner.
      const refused = isDefinitivePaymentRejection(error)
      if (refused) paymentJournal.discard(intent.scope, intent.idempotencyKey)
      if (prefix === accountPrefixRef.current) toast.error(refused ? paymentRejectionMessage(error) : (error?.response?.data?.message || error.message || 'Payment is unconfirmed. Retry the previous payment.'))
    } finally {
      submittingRef.current = false
      if (prefix === accountPrefixRef.current) { setSubmitting(false); refreshRecovery() }
    }
  }

  const paymentDraft = (data) => {
    const amountFix = fixMoney(data.amount, 'Amount')
    const amount = amountFix.value
    if (!(amount > 0)) throw new Error('Type the amount received, for example 250.00')
    if (amountFix.note) toast(`We fixed: ${amountFix.note}`, { duration: 7000 })
    const customerId = data.customerId ? Number(data.customerId) : null
    const saleId = data.saleId ? Number(data.saleId) : null
    if (!customerId && !saleId) throw new Error('Pick the customer or the invoice this payment is for.')
    const selectedMode = String(data.method || 'CASH').toUpperCase()
    const mode = selectedMode === 'PENDING' ? 'CREDIT' : selectedMode
    if (!['CASH','CHEQUE','ONLINE','CREDIT','DEBIT'].includes(mode)) throw new Error('Pick how it was paid: Cash, Cheque or Online Transfer.')
    if (['CHEQUE', 'ONLINE'].includes(mode) && !String(data.ref || data.reference || '').trim()) {
      throw new Error(mode === 'CHEQUE' ? 'Type the cheque number, for example CHQ001' : 'Type the transaction reference, for example TXN123456')
    }
    let paymentDate = data.paymentDate
    if (/^\d{4}-\d{2}-\d{2}$/.test(paymentDate || '')) paymentDate = new Date(paymentDate + 'T00:00:00Z').toISOString()
    else if (!paymentDate) paymentDate = new Date().toISOString()
    return {kind:'create',form:ledgerPaymentForm(data,false),request:{
      saleId,customerId,amount,mode,reference:data.ref || data.reference || null,paymentDate,
    }}
  }

  const onSubmit = async (data) => {
    if (user?.supportReadOnly) { toast.error('This support session is read-only.'); return }
    if (submittingRef.current) return
    try {
      const scope = ledgerPaymentScope({...recoveryIdentity,customerId:data.customerId || 'cash'})
      const previous = paymentJournal.read(scope)
      if (previous) {
        if (previous.form !== ledgerPaymentForm(data,false)) throw new Error('Retry the previous payment before recording a different payment.')
        await executePayment(previous)
        return
      }
      if (savedBatch?.rows.some(row => row.scope === scope && !row.confirmed)) {
        throw new Error('Resume the saved bulk payments before recording a new payment for this customer.')
      }
      const draft = paymentDraft(data)
      // Validate a new request against the visible balance, never a recovered request.
      const paymentAmount = draft.request.amount
      if (data.saleId) {
        const selectedInvoice = outstandingInvoices.find(inv => inv.id === Number(data.saleId))
        if (selectedInvoice && paymentAmount > selectedInvoice.balanceAmount + 0.01) {
          throw new Error(`This payment (${paymentAmount.toFixed(2)}) is more than the invoice balance (${Number(selectedInvoice.balanceAmount).toFixed(2)}). Type ${Number(selectedInvoice.balanceAmount).toFixed(2)} or less.`)
        }
      } else if (selectedCustomerDetails) {
        const customerBalance = Math.abs(selectedCustomerDetails.balance || 0)
        if (customerBalance > 0 && paymentAmount > customerBalance + 0.01) {
          throw new Error(`This payment (${paymentAmount.toFixed(2)}) is more than the customer owes (${customerBalance.toFixed(2)}). Type ${customerBalance.toFixed(2)} or less.`)
        }
      }
      const intent = paymentJournal.begin(scope,draft)
      refreshRecovery()
      await executePayment(intent)
    } catch (error) { toast.error(error.message); refreshRecovery() }
  }

  const saveBulkPayments = async () => {
    if (user?.supportReadOnly) { toast.error('This support session is read-only.'); return }
    if (submittingRef.current) return
    const prefix = accountPrefixRef.current
    try {
      if (!savedBatch) {
        // Expand each row into real payments: a chosen invoice -> one payment on it; "all unpaid" -> oldest-first split across the bills; "on account" -> customer only.
        const used = {} // saleId -> amount already planned in this batch (two rows must not overpay one bill)
        const drafts = []
        bulkPayments.forEach((data, rowIndex) => {
          const label = `Row ${rowIndex + 1}`
          if (!data.customerId) throw new Error(`${label}: select a customer.`)
          const base = paymentDraft({ ...data, saleId: '' })
          if (!base.request.customerId) throw new Error(`${label}: select a customer.`)
          const scope = ledgerPaymentScope({ ...recoveryIdentity, customerId: base.request.customerId })
          const list = bulkInvoices[String(data.customerId)]?.list || []
          const mode = data.saleId || (list.length ? 'ALL' : 'ACCOUNT')
          const push = (saleId, amount) => {
            const rounded = Math.round(amount * 100) / 100
            if (!(rounded > 0)) return
            const draft = paymentDraft({ ...data, saleId: saleId || '', amount: rounded })
            drafts.push({ ...draft, scope })
          }
          if (mode === 'ACCOUNT') { push(null, base.request.amount); return }
          if (mode === 'ALL') {
            let left = base.request.amount
            const sorted = [...list].sort((a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate))
            for (const inv of sorted) {
              if (left <= 0.004) break
              const room = Number(inv.balanceAmount) - (used[inv.id] || 0)
              if (room <= 0.004) continue
              const part = Math.min(left, room)
              used[inv.id] = (used[inv.id] || 0) + part
              push(inv.id, part)
              left -= part
            }
            if (left > 0.01) throw new Error(`${label}: amount is ${left.toFixed(2)} more than all unpaid invoices. Lower it or choose "On account".`)
            return
          }
          const inv = list.find(i => String(i.id) === String(mode))
          if (!inv) throw new Error(`${label}: the chosen invoice is no longer unpaid. Pick again.`)
          const room = Number(inv.balanceAmount) - (used[inv.id] || 0)
          if (base.request.amount > room + 0.01) throw new Error(`${label}: invoice ${inv.invoiceNo} has only ${room.toFixed(2)} left to pay. Type ${room.toFixed(2)} or less.`)
          used[inv.id] = (used[inv.id] || 0) + base.request.amount
          push(inv.id, base.request.amount)
        })
        if (!drafts.length) throw new Error('Enter an amount for at least one payment.')
        batchJournal.begin(bulkScope,drafts)
        refreshRecovery()
      }
      submittingRef.current = true
      setSubmitting(true)
      const batch = await batchJournal.execute(bulkScope, (request,key) => {
        if (prefix !== accountPrefixRef.current) throw new Error('Workspace changed. Resume the saved batch in its original workspace.')
        return paymentsAPI.createPayment(request,key)
      }, progress => { if (prefix === accountPrefixRef.current) setSavedBatch(progress) })
      if (prefix !== accountPrefixRef.current) return
      if (batch.rejected) {
        // The server refused a payment (nothing saved for it). Confirmed rows stay recorded; the refused row and the unsent ones come back editable.
        if (batch.rows.length) toast.success(`Confirmed ${batch.rows.length} payment(s).`)
        toast.error(batch.rejected.message)
        setBulkPayments(batch.rejected.rows.map(bulkRowFromSaved))
        setBulkRowErrors({ 0: batch.rejected.message })
        window.dispatchEvent(new CustomEvent('dataUpdated'))
        return
      }
      toast.success(`Confirmed ${batch.rows.length} payment(s).`)
      setBulkRowErrors({})
      setShowBulkPaymentModal(false)
      setBulkPayments([{customerId:'',amount:'',method:'Cash',paymentDate:localDateString(new Date())}])
      window.dispatchEvent(new CustomEvent('dataUpdated'))
    } catch (error) {
      if (prefix === accountPrefixRef.current) toast.error(error?.response?.data?.message || error.message || 'Batch paused. Resume the saved payments.')
    } finally {
      submittingRef.current = false
      if (prefix === accountPrefixRef.current) {
        setSubmitting(false)
        refreshRecovery()
        await fetchDataRef.current?.()
      }
    }
  }

  const handleEdit = (payment) => {
    setEditingPayment(payment)
  }

  const handleDeletePayment = (payment) => {
    setPaymentToDelete(payment)
  }

  const confirmDeletePayment = async () => {
    if (!paymentToDelete?.id) return
    try {
      toast.loading('Voiding payment...', { id: 'delete-payment' })
      const response = await paymentsAPI.deletePayment(paymentToDelete.id)
      if (response?.success) {
        toast.success('Payment voided; history retained', { id: 'delete-payment' })
        setSelectedPaymentIds(ids => ids.filter(id => id !== paymentToDelete.id))
        setPaymentToDelete(null)
        await fetchDataRef.current?.()
        window.dispatchEvent(new CustomEvent('dataUpdated'))
      } else {
        toast.error(response?.message || 'Failed to void payment', { id: 'delete-payment' })
      }
    } catch (error) {
      console.error('Failed to void payment:', error)
      if (!error?._handledByInterceptor) {
        toast.error(error?.response?.data?.message || 'Failed to void payment', { id: 'delete-payment' })
      }
    }
  }

  const eligibleReceiptPayments = useMemo(
    () => (canEditPayments && !user?.supportReadOnly && listScope === accountPrefix ? payments.filter(canReceivePaymentReceipt) : []),
    [payments, canEditPayments, user?.supportReadOnly, listScope, accountPrefix]
  )

  const receiptSelectedIds = useMemo(
    () => currentReceiptSelection(eligibleReceiptPayments, selectedPaymentIds),
    [eligibleReceiptPayments, selectedPaymentIds]
  )

  useEffect(() => {
    setSelectedPaymentIds((prev) => currentReceiptSelection(eligibleReceiptPayments, prev))
  }, [eligibleReceiptPayments])

  const openReceiptPreview = (ids) => {
    const list = Array.isArray(ids) ? ids : [ids]
    if (list.length === 1) {
      const payment = payments.find((p) => Number(p.id) === Number(list[0]))
      if (payment && !canReceivePaymentReceipt(payment)) {
        toast.error(receiptIneligibilityReason(payment))
        return
      }
    }
    const eligible = currentReceiptSelection(payments, list)
    if (eligible.length === 0) {
      toast.error('Select cleared incoming payments to generate a receipt.')
      return
    }
    if (eligible.length !== list.length) {
      toast.error('One or more selected payments cannot produce a receipt.')
      return
    }
    const { customerCount } = receiptSelectionSummary(payments,eligible)
    if (customerCount > 1) {
      toast.error(`Combined receipt requires payments from one customer. ${customerCount} customers are selected.`)
      return
    }
    setReceiptPreviewPaymentIds(eligible)
    setShowReceiptPreviewModal(true)
  }

  const handleGenerateReceiptFromBar = () => {
    if (receiptSelectedIds.length === 0) {
      toast.error('Select cleared incoming payments to generate a receipt.')
      return
    }
    openReceiptPreview(receiptSelectedIds)
  }

  const togglePaymentSelection = (id) => {
    const payment = payments.find((p) => Number(p.id) === Number(id))
    if (payment && !canReceivePaymentReceipt(payment)) {
      toast.error(receiptIneligibilityReason(payment))
      return
    }
    setSelectedPaymentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const eligibleFilteredReceiptIds = useMemo(
    () => canEditPayments && !user?.supportReadOnly && listScope === accountPrefix ? filteredPayments.filter(canReceivePaymentReceipt).map(p => p.id) : [],
    [filteredPayments,canEditPayments,user?.supportReadOnly,listScope,accountPrefix]
  )

  const selectionSummary = receiptSelectionSummary(eligibleReceiptPayments,receiptSelectedIds,filteredPayments)
  const selectedTotal = selectionSummary.total
  const toggleSelectAllPayments = () => setSelectedPaymentIds(prev => toggleVisibleReceiptSelection(prev,eligibleFilteredReceiptIds))

  const handleChequeStatusUpdate = async (paymentId, status) => {
    try {
      // FIX: Use correct API endpoint for updating payment status
      const response = await paymentsAPI.updatePaymentStatus(paymentId, status)
      if (response.success) {
        toast.success(`Cheque status updated to ${status}`)
        setSelectedPaymentIds(ids => ids.filter(id => id !== paymentId))
        fetchDataRef.current?.()
        // Trigger global update event to refresh customer balances
        window.dispatchEvent(new CustomEvent('dataUpdated'))
      } else {
        toast.error(response.message || 'Failed to update cheque status')
      }
    } catch (error) {
      console.error('Failed to update cheque status:', error)
      toast.error(error?.response?.data?.message || 'Failed to update cheque status')
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', timeZone: 'UTC'
      })
    } catch (error) {
      return dateString
    }
  }

  const getStatusIcon = (status) => {
    const state = String(status || '').toUpperCase()
    if (state === 'CLEARED') return <CheckCircle className="h-5 w-5 text-green-500" />
    if (state === 'VOID' || state === 'RETURNED') return <XCircle className="h-5 w-5 text-red-500" />
    return <Clock className="h-5 w-5 text-yellow-500" />
  }

  const getPaymentMethod = (p) => (p.method || p.mode || '').toLowerCase().replace(/^./, c => c.toUpperCase())
  const getChequeStatus = (p) => p.chequeStatus || (p.status === 'CLEARED' ? 'Cleared' : p.status === 'RETURNED' ? 'Returned' : p.status === 'VOID' ? 'Void' : 'Pending')
  const getStatusColor = (status) => {
    return statusTone(status, 'cheque')
  }

  const statusBadge = (payment) => (
    <Badge variant={statusKind(payment.status, 'cheque')} dot size="lg">{paymentStatusLabel(payment)}</Badge>
  )

  const paymentColumns = [
    {
      key: 'select',
      mobile: 'hidden',
      width: '2.75rem',
      label: (
        <label className="-m-2 flex h-10 w-10 cursor-pointer items-center justify-center" title="Tick cleared incoming payments to print one combined receipt">
          <input
            type="checkbox"
            checked={selectionSummary.allVisibleSelected}
            disabled={eligibleFilteredReceiptIds.length === 0}
            onChange={toggleSelectAllPayments}
            className="h-5 w-5 rounded border-neutral-300 disabled:opacity-40"
            aria-label="Select all eligible payments for receipt"
          />
        </label>
      ),
      render: (payment) => (canEditPayments && !user?.supportReadOnly && canReceivePaymentReceipt(payment)
        ? (
          <label className="-m-2 flex h-10 w-10 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              checked={receiptSelectedIds.includes(payment.id)}
              onChange={() => togglePaymentSelection(payment.id)}
              className="h-5 w-5 rounded border-neutral-300"
              aria-label={`Select payment ${payment.id} for receipt`}
            />
          </label>
        )
        : null)
    },
    {
      key: 'customerName',
      label: 'Customer',
      mobile: 'title',
      render: (payment) => (
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-semibold text-text-primary" title={payment.customerName || ''}>{payment.customerName || 'Cash customer'}</div>
          <div className="text-sm text-neutral-600">
            {payment.invoiceNo || 'General payment'}
            {payment.isHistorical && <Badge variant="neutral" size="lg" className="ms-2 align-middle">Historical</Badge>}
          </div>
        </div>
      )
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (payment) => (
        <div className="leading-tight">
          <div className="font-semibold">{money(payment.amount)}</div>
          <div className="text-sm text-neutral-600 lg:hidden">{getPaymentMethod(payment)}</div>
        </div>
      )
    },
    {
      key: 'method',
      label: 'Method',
      hideBelow: 'lg',
      mobile: 'hidden',
      render: (payment) => (
        <div className="leading-tight">
          <div>{getPaymentMethod(payment) || '-'}</div>
          {(payment.ref || payment.reference) && <div className="text-sm text-neutral-600">{payment.ref || payment.reference}</div>}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (payment) => (
        <div className="leading-tight">
          {statusBadge(payment)}
          <div className="mt-1 text-sm tabular-nums text-neutral-600 lg:hidden">{formatDate(payment.paymentDate)}</div>
        </div>
      )
    },
    { key: 'paymentDate', label: 'Date', hideBelow: 'lg', mobile: 'hidden', render: (payment) => <span className="whitespace-nowrap tabular-nums">{formatDate(payment.paymentDate)}</span> }
  ]

  // One visible next step per row, the rest under a labelled "More". Historical rows are read-only.
  const renderPaymentActions = (payment) => {
    if (payment.isHistorical) return <span className="text-sm text-neutral-500">Read-only</span>
    const method = getPaymentMethod(payment)
    const chequeStatus = getChequeStatus(payment)
    const pendingCheque = method === 'Cheque' && chequeStatus === 'Pending'
    const canReceipt = canReceivePaymentReceipt(payment)
    return (
      <div className="flex items-center justify-end gap-2">
        {pendingCheque && canEditPayments && (
          <button type="button" onClick={() => handleChequeStatusUpdate(payment.id, 'Cleared')} className="btn btn-secondary px-3 border-success-border text-success-fg hover:bg-success-bg">
            <CheckCircle className="h-4 w-4" aria-hidden />
            Mark cleared
          </button>
        )}
        {!pendingCheque && canReceipt && (
          <button type="button" onClick={() => openReceiptPreview([payment.id])} className="btn btn-secondary px-3" aria-label={`Print receipt for payment ${payment.id}`}>
            <Printer className="h-4 w-4" aria-hidden />
            Receipt
          </button>
        )}
        <OverflowMenu
          label={`More actions for payment ${payment.id}`}
          buttonText="More"
          buttonClassName="px-3"
          showLabel
          items={[
            { label: 'Print receipt', icon: Printer, hidden: !pendingCheque && canReceipt, disabled: !canReceipt, onClick: () => openReceiptPreview([payment.id]) },
            { label: 'Edit payment', icon: Edit, hidden: !canEditPayments, onClick: () => handleEdit(payment) },
            { label: 'Return cheque', icon: XCircle, hidden: !(canEditPayments && pendingCheque), separatorBefore: true, onClick: () => handleChequeStatusUpdate(payment.id, 'Returned') },
            { label: 'Mark cheque pending again', icon: Clock, hidden: !(canEditPayments && method === 'Cheque' && chequeStatus === 'Cleared'), onClick: () => handleChequeStatusUpdate(payment.id, 'Pending') },
            { label: 'Void payment', icon: Trash2, danger: true, hidden: !canEditPayments, separatorBefore: true, onClick: () => handleDeletePayment(payment) }
          ]}
        />
      </div>
    )
  }

  const filtersActive = Boolean(debouncedSearchTerm || filterMethod || filterStatus || fromDate || toDate)
  const showSourceFilter = historyKnown && historicalCount > 0
  const tableBusy = loading || listScope !== accountPrefix

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-3 ${receiptSelectedIds.length ? 'pb-48 lg:pb-20' : ''}`}>
      {returnTo && (
        <button
          type="button"
          onClick={() => navigate(returnTo)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back to {getReturnLabel(returnTo)}
        </button>
      )}
      {/* Header */}
      {recoveryError && <Alert tone="error">{recoveryError}</Alert>}
      {unconfirmedPayments.map(intent => (
        <Alert
          key={intent.idempotencyKey}
          tone="warning"
          action={<button type="button" disabled={submitting} onClick={() => executePayment(intent)} className="min-h-[36px] rounded-sm border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-50">Retry previous payment</button>}
        >
          Previous payment of {money(intent.request.amount)} for customer {customerLabel(intent.request.customerId)} is unconfirmed. Confirm it before recording another payment for this customer.
        </Alert>
      ))}
      {savedBatch && (
        <Alert
          tone="warning"
          action={<button type="button" disabled={submitting} onClick={() => setShowBulkPaymentModal(true)} className="min-h-[36px] rounded-sm border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-50">Resume bulk payments</button>}
        >
          Saved bulk payments: {savedBatch.rows.filter(row => row.confirmed).length} of {savedBatch.rows.length} confirmed. Remaining payments retain their original amounts and keys.
        </Alert>
      )}
      {/* Header and filters in one block: title with the real total, one primary action, filters on one row. */}
      <div className="shrink-0 rounded-lg border border-surface-border bg-white">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-3 sm:px-4">
          <div className="min-w-0 lg:w-44 lg:shrink-0">
            <h1 className="text-lg font-semibold text-text-primary">Payments</h1>
            <p className="text-sm text-neutral-600 tabular-nums" aria-live="polite">
              {tableBusy && !payments.length ? 'Loading...' : `${totalCount.toLocaleString()} ${filtersActive ? 'matching ' : ''}payment${totalCount === 1 ? '' : 's'}`}
            </p>
          </div>
          {showSourceFilter && (
            <div role="group" aria-label="Payment source" className="inline-flex rounded-md border border-neutral-300 bg-white p-0.5">
              {[['all', 'All'], ['current', 'Recorded here'], ['historical', 'Historical']].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={source === id}
                  onClick={() => { setSource(id); setPage(1) }}
                  className={`min-h-[40px] rounded px-3 text-sm font-medium ${source === id ? 'bg-primary-600 text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="ms-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBulkPaymentModal(true)}
              disabled={submitting || Boolean(user?.supportReadOnly) || listScope !== accountPrefix}
              className="btn btn-secondary disabled:opacity-50"
              title="Add multiple payments at once"
            >
              Bulk Payment
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              disabled={submitting || Boolean(user?.supportReadOnly) || listScope !== accountPrefix}
              className="btn btn-primary disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add Payment
            </button>
          </div>
        </div>
        <div data-sticky-toolbar className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-3 sm:px-4">
          <div className="relative min-w-0 flex-[1_1_100%] lg:flex-[1_1_14rem] lg:max-w-[26rem]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input
              type="search" aria-label="Search payments" maxLength={120}
              placeholder="Search customer, invoice or reference"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
              className="input h-11 w-full pl-9"
            />
          </div>
          <select
            aria-label="Payment method" value={filterMethod}
            onChange={(e) => { setFilterMethod(e.target.value); setPage(1) }}
            className="input h-11 min-w-0 flex-1 lg:w-32 lg:flex-none"
          >
            <option value="">All methods</option>
            <option value="Cash">Cash</option>
            <option value="Cheque">Cheque</option>
            <option value="Online">Online</option>
            <option value="Debit">Debit</option>
            <option value="Credit">Credit</option>
          </select>
          <select
            aria-label="Payment status" value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
            className="input h-11 min-w-0 flex-1 lg:w-32 lg:flex-none"
          >
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="credit">Credit</option>
            <option value="void">Voided</option>
            <option value="returned">Returned</option>
          </select>
          <button
            type="button" aria-label="Payment date filters" aria-expanded={showDateFilters}
            onClick={() => setShowDateFilters(value => !value)}
            title={fromDate || toDate ? ('Payment dates: ' + (fromDate || 'any') + ' to ' + (toDate || 'any')) : 'Filter by payment date'}
            className="btn btn-secondary"
          >
            <Filter className="h-4 w-4" aria-hidden /> Dates
            {(fromDate || toDate) && <span className="h-2 w-2 rounded-full bg-primary-600" aria-label="Date range active" />}
          </button>
          <button type="button" onClick={() => fetchDataRef.current?.()} className="btn btn-ghost">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
          {filtersActive && (
            <button
              type="button" aria-label="Clear payment filters"
              onClick={() => {
                setSearchTerm(''); setFilterMethod(''); setFilterStatus('')
                setFromDate(''); setToDate(''); setPage(1)
              }}
              className="btn btn-ghost"
            >Clear filters</button>
          )}
        </div>
        {showDateFilters && (
          <div className="border-t border-surface-border px-3 pb-3 pt-3 sm:px-4">
            <DateRangeFilter
              label="Payment date range" from={fromDate} to={toDate} error={dateRangeError}
              onChange={({ from, to }) => { setFromDate(from); setToDate(to); setPage(1) }}
            />
          </div>
        )}
      </div>
      {(dateRangeError || listError) && (
        <div className="shrink-0">
          <Alert
            tone="error"
            action={!dateRangeError && <button type="button" onClick={fetchData} className="btn btn-secondary">Try again</button>}
          >
            {dateRangeError || listError}
          </Alert>
        </div>
      )}

      {!dateRangeError && !listError && (
        <ModernTable
          fill
          stickyHeader
          mobileCards
          busy={tableBusy && payments.length > 0}
          loading={tableBusy && payments.length === 0}
          caption="Payments"
          data={filteredPayments}
          columns={paymentColumns}
          actions={renderPaymentActions}
          actionsLabel="Actions"
          totalCount={totalCount}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={(next) => setPage(next)}
          pageSize={pageSize}
          pageSizeOptions={[25, 50, 100]}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
          emptyTitle={filtersActive ? 'No payments match these filters' : 'No payments yet'}
          emptyDescription={filtersActive ? 'Clear the filters or try a different name or invoice number.' : 'Record the first payment to see it here.'}
          emptyAction={filtersActive
            ? { label: 'Clear filters', onClick: () => { setSearchTerm(''); setFilterMethod(''); setFilterStatus(''); setFromDate(''); setToDate(''); setPage(1) } }
            : { label: 'Add payment', icon: Plus, onClick: () => setShowAddModal(true) }}
        />
      )}

      {/* Selection action bar - Generate Receipt */}
      {receiptSelectedIds.length > 0 && (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200 shadow-lg px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-neutral-700">
            {receiptSelectedIds.length} payment(s) selected — Total: {money(selectedTotal)}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleGenerateReceiptFromBar}
              className="inline-flex min-h-[44px] items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              <Printer className="h-4 w-4" />
              Generate Receipt
            </button>
            <button
              type="button"
              onClick={() => setSelectedPaymentIds([])}
              className="min-h-[44px] px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Payment Receipt Preview Modal (from ledger) */}
      <ReceiptPreviewModal
        paymentIds={receiptPreviewPaymentIds}
        isOpen={showReceiptPreviewModal}
        onClose={() => {
          setShowReceiptPreviewModal(false)
          setReceiptPreviewPaymentIds([])
          setSelectedPaymentIds([])
        }}
        onSuccess={() => fetchDataRef.current?.()}
      />

      {/* Add Payment Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={closeAddPaymentModal}
        title="Add New Payment"
        size="lg"
      >
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Select
              label="Customer (Optional - if not selecting invoice)"
              options={[
                { value: '', label: 'Select Customer' },
                ...customers.map(customerOption)
              ]}
              error={errors.customerId?.message}
              {...register('customerId', { 
                validate: (value) => {
                  if (!value && !selectedSaleId) {
                    return 'Please select either a customer or an invoice'
                  }
                  return true
                }
              })}
            />

            <Select
              label="Invoice/Sale (Optional - if not selecting customer)"
              options={[
                { value: '', label: 'Select Invoice' },
                // PERFORMANCE FIX: Only show outstanding invoices (loads dynamically when customer selected)
                // Removed fallback to sales list (which was loaded unnecessarily on page load)
                ...(selectedCustomerId && outstandingInvoices.length > 0
                  ? outstandingInvoices.map(inv => ({
                      value: inv.id,
                      label: `${inv.invoiceNo} - Balance: ${money(inv.balanceAmount)} ${inv.daysOverdue > 0 ? `(${inv.daysOverdue} days overdue)` : ''}`
                    }))
                  : [])
              ]}
              error={errors.saleId?.message}
              disabled={selectedCustomerId && loadingInvoices}
              {...register('saleId', { 
                validate: (value) => {
                  if (!value && !selectedCustomerId) {
                    return 'Please select either an invoice or a customer'
                  }
                  return true
                }
              })}
            />

            <Select
              label="Payment Method"
              options={[
                { value: 'Cash', label: 'Cash' },
                { value: 'Cheque', label: 'Cheque' },
                { value: 'Online', label: 'Online Transfer' },
                { value: 'Pending', label: 'Pending/Credit' }
              ]}
              required
              error={errors.method?.message}
              {...register('method', { required: 'Pick how it was paid: Cash, Cheque or Online Transfer.' })}
            />

            <Input
              label="Amount"
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="e.g. 250.00"
              error={errors.amount?.message}
              {...register('amount', { 
                required: 'Type the amount received, for example 250.00',
                min: { value: 0.01, message: 'Type an amount above 0, for example 250.00' }
              })}
            />

            <Input
              label="Payment Date"
              type="date"
              required
              error={errors.paymentDate?.message}
              defaultValue={localDateString(new Date())}
              {...register('paymentDate', { required: 'Pick the date the money was received' })}
            />

            {/* Auto-fill amount from selected invoice */}
            {selectedSaleId && outstandingInvoices.length > 0 && (
              <div className="md:col-span-2">
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-primary-900 mb-2">Selected Invoice Details:</p>
                  {(() => {
                    const selectedInv = outstandingInvoices.find(inv => inv.id === parseInt(selectedSaleId))
                    if (selectedInv) {
                      return (
                        <div className="space-y-1 text-sm">
                          <p><span className="font-medium">Invoice:</span> {selectedInv.invoiceNo}</p>
                          <p><span className="font-medium">Total:</span> {money(selectedInv.grandTotal)}</p>
                          <p><span className="font-medium">Paid:</span> {money(selectedInv.paidAmount)}</p>
                          <p className="text-error font-semibold">
                            <span className="font-medium">Balance Due:</span> {money(selectedInv.balanceAmount)}
                            {selectedInv.daysOverdue > 0 && (
                              <span className="ml-2 text-orange-600">({selectedInv.daysOverdue} days overdue)</span>
                            )}
                          </p>
                          <button
                            type="button"
                            onClick={() => setValue('amount', selectedInv.balanceAmount)}
                            className="mt-2 text-xs text-primary-600 hover:text-primary-800 underline"
                          >
                            Fill Full Balance Amount
                          </button>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              </div>
            )}

            {/* Outstanding Invoices List for Selected Customer */}
            {selectedCustomerId && outstandingInvoices.length > 0 && !selectedSaleId && (
              <div className="md:col-span-2">
                <div className="bg-white border border-neutral-200 border-l-4 border-l-warning rounded-sm p-4">
                  <p className="text-sm font-medium text-yellow-900 mb-3">
                    Outstanding Invoices for {selectedCustomerDetails?.name || 'Customer'}:
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {outstandingInvoices.map((inv) => (
                      <div key={inv.id} className="bg-white border border-yellow-200 rounded p-3 flex justify-between items-center hover:bg-yellow-50">
                        <div>
                          <p className="font-medium text-sm">{inv.invoiceNo}</p>
                          <p className="text-xs text-neutral-600">
                            {new Date(inv.invoiceDate).toLocaleDateString()} • 
                            {inv.daysOverdue > 0 ? (
                              <span className="text-error font-semibold"> {inv.daysOverdue} days overdue</span>
                            ) : (
                              <span className="text-success"> Not due yet</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-error">{money(inv.balanceAmount)}</p>
                          <button
                            type="button"
                            onClick={() => {
                              setValue('saleId', inv.id)
                              setValue('amount', inv.balanceAmount)
                            }}
                            className="text-xs text-primary-600 hover:text-primary-800 underline mt-1"
                          >
                            Select & Fill
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'Cheque' && (
              <>
                <Input
                  label="Cheque Number"
                  placeholder="e.g. CHQ001"
                  error={errors.ref?.message}
                  {...register('ref')}
                />
                <Input
                  label="Bank Name"
                  placeholder="e.g. Emirates NBD"
                  error={errors.bankName?.message}
                  {...register('bankName')}
                />
              </>
            )}

            {paymentMethod === 'Online' && (
              <Input
                label="Transaction Reference"
                placeholder="e.g. TXN123456"
                error={errors.ref?.message}
                {...register('ref')}
              />
            )}

            <div className="md:col-span-2">
              <Input
                label="Notes"
                placeholder="e.g. Paid by the shop owner at delivery"
                error={errors.notes?.message}
                {...register('notes')}
              />
            </div>
          </div>

          {/* Customer Details Section */}
          {selectedCustomerDetails && (
            <div className="mt-6 border-t pt-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2" />
                Customer Details
              </h3>
              <div className="bg-neutral-50 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start">
                  <User className="h-4 w-4 text-neutral-400 mt-1 mr-2" />
                  <div>
                    <p className="text-xs text-neutral-500">Name</p>
                    <p className="text-sm font-medium text-neutral-900">{selectedCustomerDetails.name}</p>
                  </div>
                </div>
                {selectedCustomerDetails.phone && (
                  <div className="flex items-start">
                    <Phone className="h-4 w-4 text-neutral-400 mt-1 mr-2" />
                    <div>
                      <p className="text-xs text-neutral-500">Phone</p>
                      <p className="text-sm font-medium text-neutral-900">{selectedCustomerDetails.phone}</p>
                    </div>
                  </div>
                )}
                {selectedCustomerDetails.email && (
                  <div className="flex items-start">
                    <Mail className="h-4 w-4 text-neutral-400 mt-1 mr-2" />
                    <div>
                      <p className="text-xs text-neutral-500">Email</p>
                      <p className="text-sm font-medium text-neutral-900">{selectedCustomerDetails.email}</p>
                    </div>
                  </div>
                )}
                {selectedCustomerDetails.address && (
                  <div className="flex items-start md:col-span-2">
                    <MapPin className="h-4 w-4 text-neutral-400 mt-1 mr-2" />
                    <div>
                      <p className="text-xs text-neutral-500">Address</p>
                      <p className="text-sm font-medium text-neutral-900">{selectedCustomerDetails.address}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start">
                  <DollarSign className="h-4 w-4 text-neutral-400 mt-1 mr-2" />
                  <div>
                    <p className="text-xs text-neutral-500">Account Balance</p>
                    <p className={`text-sm font-medium ${(selectedCustomerDetails.balance || 0) < 0 ? 'text-success' : (selectedCustomerDetails.balance || 0) > 0 ? 'text-error' : 'text-neutral-600'}`}>
                      {balance(selectedCustomerDetails.balance || 0)}
                    </p>
                  </div>
                </div>
                {selectedCustomerDetails.trn && (
                  <div className="flex items-start">
                    <FileText className="h-4 w-4 text-neutral-400 mt-1 mr-2" />
                    <div>
                      <p className="text-xs text-neutral-500">TRN</p>
                      <p className="text-sm font-medium text-neutral-900">{selectedCustomerDetails.trn}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={closeAddPaymentModal}
              disabled={submitting}
              className="px-4 py-2 border border-neutral-300 rounded-md shadow-sm text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <LoadingButton type="submit" loading={submitting}>
              {submitting ? 'Submitting...' : 'Add Payment'}
            </LoadingButton>
          </div>
        </form>
      </Modal>

      {/* Edit Payment Modal — always PUT updatePayment (never create); invoices loaded by customerId */}
      <EditPaymentModal
        isOpen={!!editingPayment}
        payment={editingPayment}
        outstandingInvoices={
          editingPayment?.customerId &&
          String(editingPayment.customerId) === String(selectedCustomerId)
            ? outstandingInvoices
            : []
        }
        allInvoices={[]}
        onClose={() => setEditingPayment(null)}
        onSaved={async () => {
          setSelectedPaymentIds(ids => ids.filter(id => id !== editingPayment?.id))
          setEditingPayment(null)
          await fetchDataRef.current?.()
        }}
      />

      <ConfirmDangerModal
        isOpen={!!paymentToDelete}
        title="VOID PAYMENT"
        message={paymentToDelete
          ? `Amount: ${money(paymentToDelete.amount)}\nMode: ${getPaymentMethod(paymentToDelete)}\nDate: ${formatDate(paymentToDelete.paymentDate)}\n\nThis will reverse the payment effects on the invoice and customer balance. The original payment and linked adjustment stay in history.\n\nVoid this payment?`
          : ''}
        confirmLabel="Void payment"
        onConfirm={confirmDeletePayment}
        onClose={() => setPaymentToDelete(null)}
      />

      {/* Bulk Payment Modal */}
      <Modal
        isOpen={showBulkPaymentModal}
        onClose={() => {
          if (submittingRef.current) return
          setShowBulkPaymentModal(false)
          if (!savedBatch) setBulkPayments([{ customerId: '', amount: '', method: 'Cash', paymentDate: localDateString(new Date()) }])
        }}
        title="Bulk Payment Entry"
        size="3xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600 mb-4">
            Pick a customer, then the invoice to pay (or all unpaid invoices, oldest first). The amount fills in and stays editable, so partial payments work. Each row is one receipt entry.
          </p>
          <div className="hidden gap-2 px-1 text-xs font-medium text-neutral-500 md:grid md:grid-cols-[1.5rem_minmax(0,1.5fr)_minmax(0,1.6fr)_7rem_8rem_9rem_minmax(0,1fr)_2rem]">
            <span aria-hidden>#</span><span>Customer</span><span>Invoice</span><span>Amount</span><span>Method</span><span>Date</span><span>Reference</span><span />
          </div>
          {bulkRows.map((payment, index) => {
            const locked = submitting || Boolean(savedBatch)
            const patch = (fields) => { const updated = [...bulkPayments]; updated[index] = { ...updated[index], ...fields }; setBulkPayments(updated); setBulkRowErrors(({ [index]: _cleared, ...rest }) => rest) }
            const refRequired = ['CHEQUE', 'ONLINE'].includes(String(payment.method).toUpperCase())
            const cell = 'min-w-0'
            const mini = (text) => <span className="mb-0.5 block text-[11px] font-medium text-neutral-500 md:hidden">{text}</span>
            const info = bulkInvoices[String(payment.customerId)]
            const invoices = info?.list || []
            const owed = invoices.reduce((sum, inv) => sum + Number(inv.balanceAmount || 0), 0)
            const invoiceMode = payment.saleId || (invoices.length ? 'ALL' : 'ACCOUNT')
            const chosenInvoice = invoices.find(inv => String(inv.id) === String(invoiceMode))
            const invoiceOptions = !payment.customerId
              ? [{ value: '', label: 'Select a customer first' }]
              : [
                  ...(invoices.length ? [{ value: 'ALL', label: `All unpaid invoices (oldest first)`, hint: balance(owed), meta: `${invoices.length} unpaid` }] : []),
                  ...invoices.map(inv => ({
                    value: String(inv.id),
                    label: inv.invoiceNo,
                    meta: `${inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : ''}${inv.daysOverdue > 0 ? ` · ${inv.daysOverdue}d overdue` : ''}${Number(inv.paidAmount) > 0 ? ` · part paid` : ''}`,
                    hint: balance(inv.balanceAmount),
                    hintClassName: 'text-red-600',
                  })),
                  { value: 'ACCOUNT', label: 'On account (no invoice)' },
                ]
            const capacity = invoiceMode === 'ALL' ? owed : chosenInvoice ? Number(chosenInvoice.balanceAmount) : null
            const typed = Number(payment.amount) || 0
            const overpay = capacity != null && typed > capacity + 0.01
            const onCustomer = (customerId) => {
              const cached = bulkInvoices[String(customerId)]
              const list = cached?.list
              const total = (list || []).reduce((sum, inv) => sum + Number(inv.balanceAmount || 0), 0)
              patch(list
                ? { customerId, saleId: list.length ? 'ALL' : 'ACCOUNT', amount: list.length ? total.toFixed(2) : '' }
                : { customerId, saleId: '', amount: '' })
            }
            const onInvoice = (value) => {
              const inv = invoices.find(i => String(i.id) === String(value))
              patch({ saleId: value, amount: value === 'ALL' ? owed.toFixed(2) : inv ? Number(inv.balanceAmount).toFixed(2) : payment.amount })
            }
            return (
              <div key={index} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-neutral-200 p-2 md:grid-cols-[1.5rem_minmax(0,1.5fr)_minmax(0,1.6fr)_7rem_8rem_9rem_minmax(0,1fr)_2rem] md:items-center md:border-0 md:border-b md:rounded-none md:p-1">
                <span className="col-span-2 flex items-center justify-between text-xs font-medium text-neutral-600 md:col-span-1 md:block">
                  <span>{index + 1}</span>
                  {savedBatch && <span className="md:hidden">{payment.confirmed ? 'Confirmed' : 'Awaiting confirmation'}</span>}
                </span>
                <div className={`col-span-2 md:col-span-1 ${cell}`}>{mini('Customer')}
                  <Select
                    aria-label="Customer" className="md:!min-h-9 md:!py-1 text-sm" disabled={locked}
                    options={[{ value: '', label: 'Select Customer' }, ...customers.map(customerOption)]}
                    value={payment.customerId}
                    onChange={(e) => onCustomer(e.target.value)}
                  />
                </div>
                <div className={`col-span-2 md:col-span-1 ${cell}`}>{mini('Invoice')}
                  <Select
                    aria-label="Invoice" className="md:!min-h-9 md:!py-1 text-sm" searchable
                    disabled={locked || !payment.customerId || info?.loading}
                    options={info?.loading ? [{ value: '', label: 'Loading invoices…' }] : invoiceOptions}
                    value={info?.loading ? '' : (payment.customerId ? invoiceMode : '')}
                    onChange={(e) => onInvoice(e.target.value)}
                  />
                  {payment.customerId && !info?.loading && (
                    <p className={`mt-0.5 text-[11px] ${overpay ? 'text-error' : 'text-neutral-500'}`}>
                      {invoices.length ? `Owes ${balance(owed)} on ${invoices.length} invoice${invoices.length === 1 ? '' : 's'}` : 'No unpaid invoices'}
                      {capacity != null && typed > 0 && !overpay && typed < capacity - 0.01 ? ` · partial, ${balance(capacity - typed)} stays due` : ''}
                      {overpay ? ` · more than ${balance(capacity)} due` : ''}
                    </p>
                  )}
                </div>
                <div className={cell}>{mini('Amount')}
                  <input aria-label="Amount" disabled={locked} type="number" step="0.01" placeholder="0.00" value={payment.amount}
                    onChange={(e) => patch({ amount: e.target.value })}
                    className="block w-full min-h-[44px] rounded-md border border-neutral-300 bg-white px-2 text-sm md:min-h-0 md:h-9 disabled:bg-neutral-50 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
                </div>
                <div className={cell}>{mini('Method')}
                  <Select
                    aria-label="Payment Method" className="md:!min-h-9 md:!py-1 text-sm" disabled={locked}
                    options={[{ value: 'CASH', label: 'Cash' }, { value: 'CHEQUE', label: 'Cheque' }, { value: 'ONLINE', label: 'Online Transfer' }]}
                    value={String(payment.method).toUpperCase()}
                    onChange={(e) => patch({ method: e.target.value })}
                  />
                </div>
                <div className={cell}>{mini('Date')}
                  <DateField aria-label="Payment Date" shortcuts={false} disabled={locked} value={payment.paymentDate}
                    onChange={(e) => patch({ paymentDate: e.target.value })} />
                </div>
                <div className={`col-span-2 md:col-span-1 ${cell}`}>{mini(refRequired ? 'Reference *' : 'Reference')}
                  <input aria-label="Reference" disabled={locked} required={refRequired} placeholder={refRequired ? 'Required' : 'Optional'} value={payment.reference || ''}
                    onChange={(e) => patch({ reference: e.target.value })}
                    className="block w-full min-h-[44px] rounded-md border border-neutral-300 bg-white px-2 text-sm md:min-h-0 md:h-9 disabled:bg-neutral-50 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
                </div>
                <div className="col-span-2 flex items-center justify-end md:col-span-1">
                  {!savedBatch && bulkPayments.length > 1 ? (
                    <button type="button" aria-label={`Remove payment ${index + 1}`} title="Remove"
                      onClick={() => setBulkPayments(bulkPayments.filter((_, i) => i !== index))}
                      className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-error"><X className="h-4 w-4" /></button>
                  ) : savedBatch ? (
                    <span className="hidden text-[11px] text-neutral-500 md:inline" title={payment.confirmed ? 'Confirmed' : 'Awaiting confirmation'}>{payment.confirmed ? '✓' : '…'}</span>
                  ) : null}
                </div>
                {bulkRowErrors[index] && (
                  <p role="alert" className="col-span-2 border-l-4 border-l-error bg-white py-1 pl-2 text-xs text-neutral-800 md:col-span-8">{bulkRowErrors[index]}</p>
                )}
              </div>
            )
          })}
          <p className="text-right text-sm text-neutral-600" aria-live="polite">
            {bulkPayments.length} payment{bulkPayments.length === 1 ? '' : 's'} · Total{' '}
            <span className="font-semibold text-neutral-900 tabular-nums">{balance(bulkPayments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0))}</span>
          </p>
          <div className="flex justify-between">
            <button
              type="button"
              disabled={submitting || Boolean(savedBatch)}
              onClick={() => {
                setBulkPayments([...bulkPayments, { customerId: '', amount: '', method: 'Cash', paymentDate: localDateString(new Date()) }])
              }}
              className="px-4 py-2 border border-neutral-300 rounded-md shadow-sm text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50"
            >
              <Plus className="h-4 w-4 inline mr-2" />
              Add Another Payment
            </button>
            <div className="space-x-3">
              <button
                type="button"
                onClick={() => {
                  if (submittingRef.current) return
                  setShowBulkPaymentModal(false)
                  if (!savedBatch) setBulkPayments([{ customerId: '', amount: '', method: 'Cash', paymentDate: localDateString(new Date()) }])
                }}
                className="px-4 py-2 border border-neutral-300 rounded-md shadow-sm text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50"
              >
                Cancel
              </button>
              <LoadingButton
                onClick={saveBulkPayments}
                loading={submitting}
              >
                {savedBatch ? `Retry remaining payments (${savedBatch.rows.filter(row => !row.confirmed).length})` : `Save All Payments (${bulkPayments.length})`}
              </LoadingButton>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default PaymentsPage
