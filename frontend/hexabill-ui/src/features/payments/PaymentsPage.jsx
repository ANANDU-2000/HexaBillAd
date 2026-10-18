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
import { paymentsAPI, customersAPI } from '../../services/index'
import { useDebounce } from '../../hooks/useDebounce'
import { canManagePayments } from '../../utils/roles'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import { localDateString } from '../../utils/dateFormat'
import { readPaymentsStateFromParams, syncPaymentsSearchParams, paymentListParams, paymentDateRangeError } from '../../utils/paymentsUrl'
import { getReturnLabel, showReturnToPrompt } from '../../utils/returnNavigation'
import { offerReceiptPreviewAfterPayment } from '../../utils/offerReceiptPreview'
import { canReceivePaymentReceipt, currentReceiptSelection, receiptIneligibilityReason, paymentStatusLabel, receiptSelectionSummary, toggleVisibleReceiptSelection, mergeSelectedPaymentRecords } from '../../utils/receiptEligibility'
import { useBranding } from '../../tenant/TenantBrandingContext'
import Alert from '../../components/ui/Alert'
import { createLedgerPaymentJournal, createPaymentBatchJournal, ledgerPaymentAccountPrefix, ledgerPaymentForm, ledgerPaymentScope, paymentBatchScope } from '../../utils/ledgerPaymentIntent'

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

  const bulkRows = savedBatch ? savedBatch.rows.map(row => ({
    ...row.request, method: row.request.mode, paymentDate: JSON.parse(row.form).date,
    confirmed: row.confirmed,
  })) : bulkPayments

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

  useEffect(() => {
    fetchDataRef.current?.()
    return () => { listRequestRef.current += 1 }
  }, [debouncedSearchTerm, filterMethod, filterStatus, fromDate, toDate, page, accountPrefix])

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
    setLoading(true)
    setListError('')
    try {
      const [paymentsRes, customersRes] = await Promise.all([
        paymentsAPI.getPayments(paymentListParams({
          page, search: debouncedSearchTerm, method: filterMethod, status: filterStatus, fromDate, toDate
        })),
        loadAllCustomerPages(customersAPI.getCustomers)
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
      const rows = data.items || []
      setPayments(previous => mergeSelectedPaymentRecords(previous, rows, selectedPaymentIdsRef.current))
      setFilteredPayments(rows)
      setListScope(scope)
      if (customersRes.items?.length || customersRes.response?.success) setCustomers(customersRes.items)
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
      if (prefix === accountPrefixRef.current) toast.error(error?.response?.data?.message || error.message || 'Payment is unconfirmed. Retry the previous payment.')
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
        const drafts = bulkPayments.map(data => {
          // Check the customer first: paymentDraft would otherwise report "customer or an invoice", and this dialog has no invoice field.
          if (!data.customerId) throw new Error('Select a customer for every bulk payment.')
          const draft = paymentDraft(data)
          if (!draft.request.customerId) throw new Error('Select a customer for every bulk payment.')
          return {...draft,scope:ledgerPaymentScope({...recoveryIdentity,customerId:draft.request.customerId})}
        })
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
      toast.success(`Confirmed ${batch.rows.length} payment(s).`)
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

  return (
    <div className={`min-h-0 flex-1 space-y-6 overflow-y-auto ${receiptSelectedIds.length ? 'pb-48 lg:pb-20' : ''}`}>
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
          Previous payment of {money(intent.request.amount)} for customer {intent.request.customerId ?? 'Cash Customer'} is unconfirmed. Confirm it before recording another payment for this customer.
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-neutral-900">Payments</h1>
          <p className="text-sm text-neutral-600 sm:text-base">Manage customer payments and cheque status. Customer balance reflects cleared payments only; mark cheques as cleared when they clear.</p>
        </div>
        <div className="mt-3 flex flex-nowrap items-center gap-2 sm:gap-3 lg:mt-0 lg:shrink-0">
          <button
            onClick={() => fetchDataRef.current?.()}
            aria-label="Refresh"
            title="Refresh"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 sm:w-auto sm:px-4 sm:text-sm sm:font-medium"
          >
            <RefreshCw className="h-4 w-4 sm:mr-2" aria-hidden />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowBulkPaymentModal(true)}
            disabled={submitting || Boolean(user?.supportReadOnly) || listScope !== accountPrefix}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center whitespace-nowrap rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50 sm:flex-none sm:px-4"
            title="Add multiple payments at once"
          >
            Bulk Payment
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={submitting || Boolean(user?.supportReadOnly) || listScope !== accountPrefix}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center whitespace-nowrap rounded-md bg-primary-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 sm:flex-none sm:px-4"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add Payment
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div data-sticky-toolbar className="sticky top-0 z-20 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-[1_1_10rem] sm:max-w-[26rem]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search" aria-label="Search payments" maxLength={120}
                placeholder="Invoice, customer or reference"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
                className="min-h-[44px] w-full rounded-md border border-neutral-300 py-2 pl-10 pr-3 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <button
            type="button" aria-label="Payment date filters" aria-expanded={showDateFilters}
            onClick={() => setShowDateFilters(value => !value)}
            title={fromDate || toDate ? ('Payment dates: ' + (fromDate || 'any') + ' to ' + (toDate || 'any')) : 'Filter by payment date'}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Filter className="h-4 w-4" /> Dates
            {(fromDate || toDate) && <span className="h-2 w-2 rounded-full bg-primary-600" aria-label="Date range active" />}
          </button>
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            <select
              aria-label="Payment method" value={filterMethod}
              onChange={(e) => { setFilterMethod(e.target.value); setPage(1) }}
              className="min-h-[44px] min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 text-sm sm:w-32 sm:flex-none"
            >
              <option value="">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="Online">Online</option>
              <option value="Debit">Debit</option>
              <option value="Credit">Credit</option>
            </select>
            <select
              aria-label="Payment status" value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
              className="min-h-[44px] min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 text-sm sm:w-32 sm:flex-none"
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="credit">Credit</option>
              <option value="void">Voided</option>
              <option value="returned">Returned</option>
            </select>
            {(filterMethod || filterStatus || searchTerm || fromDate || toDate) && (
              <button
                type="button" aria-label="Clear payment filters"
                onClick={() => {
                  setSearchTerm(''); setFilterMethod(''); setFilterStatus('')
                  setFromDate(''); setToDate(''); setPage(1)
                }}
                className="min-h-[44px] shrink-0 rounded-md border border-neutral-300 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >Clear</button>
            )}
          </div>
        </div>
        {showDateFilters && (
          <div className="mt-3 border-t border-neutral-200 pt-3">
            <DateRangeFilter
              label="Payment date range" from={fromDate} to={toDate} error={dateRangeError}
              onChange={({ from, to }) => { setFromDate(from); setToDate(to); setPage(1) }}
            />
          </div>
        )}
        {(fromDate || toDate) && <p className="mt-2 text-xs text-neutral-600">Payment date: {fromDate || 'Any date'} to {toDate || 'Any date'}</p>}
      </div>
      {(dateRangeError || listError) && (
        <Alert
          tone="error"
          action={!dateRangeError && <button type="button" onClick={fetchData} className="min-h-[36px] rounded-sm border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-50">Try again</button>}
        >
          {dateRangeError || listError}
        </Alert>
      )}

      <p className="text-xs text-neutral-600 px-1">Receipts are for cleared incoming payments only (cash, cheque, online, debit).</p>

      {/* Payments Table - Desktop */}
      <div className={(dateRangeError || listError ? 'hidden' : 'hidden xl:block') + ' bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden'}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectionSummary.allVisibleSelected}
                    disabled={eligibleFilteredReceiptIds.length === 0}
                    onChange={toggleSelectAllPayments}
                    className="rounded border-neutral-300 disabled:opacity-40"
                    aria-label="Select all eligible payments for receipt"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="sticky right-0 z-10 bg-neutral-50 px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {loading || listScope !== accountPrefix ? (
                <tr><td colSpan="9"><LoadingCard message="Loading payments..." /></td></tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <CreditCard className="h-12 w-12 text-neutral-400 mb-4" />
                      <p className="text-neutral-500 text-lg font-medium">No payments found</p>
                      <p className="text-neutral-500 text-sm mt-1">
                        {searchTerm ? 'Try adjusting your search criteria' : 'Get started by adding a new payment'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="group hover:bg-neutral-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      {canEditPayments && !user?.supportReadOnly && canReceivePaymentReceipt(payment) && <input
                        type="checkbox"
                        checked={receiptSelectedIds.includes(payment.id)}
                        onChange={() => togglePaymentSelection(payment.id)}
                        className="rounded border-neutral-300 disabled:opacity-40"
                        aria-label={`Select payment ${payment.id} for receipt`}
                      />}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-neutral-900">{payment.invoiceNo || '-'}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-neutral-900">{payment.customerName || '-'}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {money(payment.amount)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <CreditCard className="h-4 w-4 text-neutral-400 mr-2" />
                        <span className="text-sm text-neutral-900">{getPaymentMethod(payment)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {payment.ref || payment.reference || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(payment.status, getChequeStatus(payment), getPaymentMethod(payment))}
                        <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.status, getChequeStatus(payment), getPaymentMethod(payment))}`}>
                          {paymentStatusLabel(payment)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {formatDate(payment.paymentDate)}
                    </td>
                    <td className="sticky right-0 z-10 bg-white group-hover:bg-neutral-50 px-4 py-4 whitespace-nowrap text-sm font-medium shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12)]">
                      <div className="flex items-center space-x-2">
                        {canEditPayments && (
                          <button
                            type="button"
                            onClick={() => handleEdit(payment)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit Payment"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {canEditPayments && (
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(payment)}
                            className="text-error hover:text-red-900"
                            title="Void payment"
                            aria-label="Void payment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openReceiptPreview([payment.id])}
                          disabled={!canReceivePaymentReceipt(payment)}
                          className="text-indigo-600 hover:text-indigo-900 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={canReceivePaymentReceipt(payment) ? 'Print payment receipt' : receiptIneligibilityReason(payment)}
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        {getPaymentMethod(payment) === 'Cheque' && getChequeStatus(payment) === 'Pending' && (
                          <div className="inline-flex space-x-1 ml-2">
                            <button
                              onClick={() => handleChequeStatusUpdate(payment.id, 'Cleared')}
                              className="text-success hover:text-green-900 text-xs px-2 py-1 border border-green-300 rounded"
                            >
                              Mark cleared
                            </button>
                            <button
                              onClick={() => handleChequeStatusUpdate(payment.id, 'Returned')}
                              className="text-error hover:text-red-900 text-xs px-2 py-1 border border-red-300 rounded"
                            >
                              Return
                            </button>
                          </div>
                        )}
                        {getPaymentMethod(payment) === 'Cheque' && getChequeStatus(payment) === 'Cleared' && (
                          <button
                            onClick={() => handleChequeStatusUpdate(payment.id, 'Pending')}
                            className="text-warning hover:text-amber-900 text-xs px-2 py-1 border border-amber-300 rounded"
                            title="Revert to pending (e.g. cheque not yet cleared)"
                          >
                            Mark pending
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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

      {/* Payments Cards - Mobile */}
      <div className={(dateRangeError || listError ? 'hidden' : 'xl:hidden') + ' space-y-3'}>
        {loading || listScope !== accountPrefix ? <LoadingCard message="Loading payments..." /> : filteredPayments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-8 text-center">
            <CreditCard className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
            <p className="text-neutral-500 text-lg font-medium">No payments found</p>
            <p className="text-neutral-500 text-sm mt-1">
              {searchTerm ? 'Try adjusting your search criteria' : 'Get started by adding a new payment'}
            </p>
          </div>
        ) : (
          filteredPayments.map((payment) => (
            <div key={payment.id} className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                {canEditPayments && !user?.supportReadOnly && canReceivePaymentReceipt(payment) && (
                  <input type="checkbox" checked={receiptSelectedIds.includes(payment.id)} onChange={() => togglePaymentSelection(payment.id)}
                    aria-label={`Select payment ${payment.id} for receipt`} className="mt-1 mr-1 min-h-[24px] min-w-[24px] shrink-0 rounded border-neutral-300" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{payment.customerName || 'Unknown'}</p>
                  <p className="truncate text-xs text-neutral-500">{payment.invoiceNo || 'General Payment'}</p>
                </div>
                <p className="shrink-0 whitespace-nowrap text-base font-bold tabular-nums text-neutral-900">{money(payment.amount)}</p>
              </div>
              <div className="flex items-center gap-3 mb-3 text-xs text-neutral-500">
                <div className="flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>{getPaymentMethod(payment)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatDate(payment.paymentDate)}</span>
                </div>
                {payment.ref && (
                  <span className="truncate max-w-[100px]">Ref: {payment.ref}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {getStatusIcon(payment.status, getChequeStatus(payment), getPaymentMethod(payment))}
                  <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(payment.status, getChequeStatus(payment), getPaymentMethod(payment))}`}>
                    {paymentStatusLabel(payment)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {canEditPayments && (
                    <button
                      type="button"
                      onClick={() => handleEdit(payment)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                  {canEditPayments && (
                    <button
                      type="button"
                      onClick={() => handleDeletePayment(payment)}
                      className="p-2 text-error hover:bg-error-bg rounded-lg"
                      title="Void payment"
                      aria-label="Void payment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openReceiptPreview([payment.id])}
                    disabled={!canReceivePaymentReceipt(payment)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px]"
                    title={canReceivePaymentReceipt(payment) ? 'Print payment receipt' : receiptIneligibilityReason(payment)}
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                  {getPaymentMethod(payment) === 'Cheque' && getChequeStatus(payment) === 'Pending' && (
                    <>
                      <button
                        onClick={() => handleChequeStatusUpdate(payment.id, 'Cleared')}
                        className="text-xs px-2 py-1 text-success-fg bg-success-bg border border-success-border rounded-lg"
                      >
                        Mark cleared
                      </button>
                      <button
                        onClick={() => handleChequeStatusUpdate(payment.id, 'Returned')}
                        className="text-xs px-2 py-1 text-error-fg bg-error-bg border border-error-border rounded-lg"
                      >
                        Return
                      </button>
                    </>
                  )}
                  {getPaymentMethod(payment) === 'Cheque' && getChequeStatus(payment) === 'Cleared' && (
                    <button
                      onClick={() => handleChequeStatusUpdate(payment.id, 'Pending')}
                      className="text-xs px-2 py-1 text-warning-fg bg-warning-bg border border-warning-border rounded-lg"
                    >
                      Mark pending
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {!dateRangeError && !listError && (
        <nav aria-label="Payment pagination" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-xs text-neutral-600">
            {loading || listScope !== accountPrefix ? 'Loading payments...' : totalCount === 0 ? '0 matching payments' :
              'Showing ' + ((page - 1) * 25 + 1) + '–' + Math.min(totalCount, (page - 1) * 25 + filteredPayments.length) + ' of ' + totalCount + ' matching payments'}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={loading || listScope !== accountPrefix || page <= 1} onClick={() => setPage(value => value - 1)}
              className="min-h-[44px] rounded-md border border-neutral-300 px-3 text-sm disabled:opacity-40">Previous</button>
            <span className="text-xs text-neutral-600">Page {page} of {totalPages}</span>
            <button type="button" disabled={loading || listScope !== accountPrefix || page >= totalPages} onClick={() => setPage(value => value + 1)}
              className="min-h-[44px] rounded-md border border-neutral-300 px-3 text-sm disabled:opacity-40">Next</button>
          </div>
        </nav>
      )}

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
        size="xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600 mb-4">
            Add multiple payments at once. Each row represents one payment.
          </p>
          <div className="hidden gap-2 px-1 text-xs font-medium text-neutral-500 md:grid md:grid-cols-[1.5rem_minmax(0,2fr)_7rem_8rem_9rem_minmax(0,1.2fr)_2rem]">
            <span aria-hidden>#</span><span>Customer</span><span>Amount</span><span>Method</span><span>Date</span><span>Reference</span><span />
          </div>
          {bulkRows.map((payment, index) => {
            const locked = submitting || Boolean(savedBatch)
            const patch = (fields) => { const updated = [...bulkPayments]; updated[index] = { ...updated[index], ...fields }; setBulkPayments(updated) }
            const refRequired = ['CHEQUE', 'ONLINE'].includes(String(payment.method).toUpperCase())
            const cell = 'min-w-0'
            const mini = (text) => <span className="mb-0.5 block text-[11px] font-medium text-neutral-500 md:hidden">{text}</span>
            return (
              <div key={index} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-neutral-200 p-2 md:grid-cols-[1.5rem_minmax(0,2fr)_7rem_8rem_9rem_minmax(0,1.2fr)_2rem] md:items-center md:border-0 md:border-b md:rounded-none md:p-1">
                <span className="col-span-2 flex items-center justify-between text-xs font-medium text-neutral-600 md:col-span-1 md:block">
                  <span>{index + 1}</span>
                  {savedBatch && <span className="md:hidden">{payment.confirmed ? 'Confirmed' : 'Awaiting confirmation'}</span>}
                </span>
                <div className={`col-span-2 md:col-span-1 ${cell}`}>{mini('Customer')}
                  <Select
                    aria-label="Customer" className="md:!min-h-9 md:!py-1 text-sm" disabled={locked}
                    options={[{ value: '', label: 'Select Customer' }, ...customers.map(customerOption)]}
                    value={payment.customerId}
                    onChange={(e) => patch({ customerId: e.target.value })}
                  />
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
