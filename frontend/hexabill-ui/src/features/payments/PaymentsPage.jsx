import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
  Printer
} from 'lucide-react'
import { formatCurrency, formatBalance, formatBalanceWithColor } from '../../utils/currency'
import { LoadingCard, LoadingButton } from '../../components/Loading'
import { Input, Select } from '../../components/Form'
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
import { readPaymentsStateFromParams, syncPaymentsSearchParams } from '../../utils/paymentsUrl'
import { getReturnLabel, showReturnToPrompt } from '../../utils/returnNavigation'
import { offerReceiptPreviewAfterPayment } from '../../utils/offerReceiptPreview'
import { canReceivePaymentReceipt, currentReceiptSelection, receiptIneligibilityReason, paymentStatusLabel, receiptSelectionSummary, toggleVisibleReceiptSelection } from '../../utils/receiptEligibility'
import { useBranding } from '../../tenant/TenantBrandingContext'
import { createLedgerPaymentJournal, createPaymentBatchJournal, ledgerPaymentAccountPrefix, ledgerPaymentForm, ledgerPaymentScope, paymentBatchScope } from '../../utils/ledgerPaymentIntent'

const PaymentsPage = () => {
  const { user } = useAuth()
  const { currency: tenantCurrency = 'AED' } = useBranding()
  const money = (value) => formatCurrency(value, tenantCurrency)
  const balance = (value) => formatBalance(value, tenantCurrency)
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
        customerId: showAddModal ? prev.get('customerId') : null
      })
      return params
    }, { replace: true })
  }, [searchTerm, filterMethod, filterStatus, showAddModal, setSearchParams])

  useEffect(() => {
    const parsed = readPaymentsStateFromParams(searchParams)
    setSearchTerm((s) => (s === parsed.search ? s : parsed.search))
    setFilterMethod((m) => (m === parsed.method ? m : parsed.method))
    setFilterStatus((st) => (st === parsed.status ? st : parsed.status))
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
    let isMounted = true
    
    // Define fetchData before using it
    const fetchDataSafe = async () => {
      if (!isMounted) return
      
      try {
        setLoading(true)
        
        // PERFORMANCE FIX: Remove unnecessary salesAPI.getSales() call
        // Invoices load dynamically when customer is selected via getOutstandingInvoices()
        // This saves loading 100 sales on every page load
        const [paymentsRes, customersRes] = await Promise.all([
          paymentsAPI.getPayments({ page: 1, pageSize: 100 }),
          customersAPI.getCustomers({ page: 1, pageSize: 100 })
        ])
        
        if (!isMounted) return
        
        if (paymentsRes.success && paymentsRes.data) {
          setPayments(paymentsRes.data.items || paymentsRes.data || [])
        } else {
          setPayments([])
        }
        
        if (customersRes.success && customersRes.data) {
          setCustomers(customersRes.data.items || customersRes.data || [])
        } else {
          setCustomers([])
        }
        
        // Sales are no longer loaded on page load - they load dynamically when customer is selected
        setSales([])
      } catch (error) {
        if (!isMounted) return
        console.error('Failed to load payments data:', error)
        toast.error(error.response?.data?.message || 'Failed to load payments data')
        setPayments([])
        setCustomers([])
        setSales([])
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }
    
    fetchDataSafe()
    
    // Auto-refresh DISABLED - prevents UI interruption during user actions
    // User can manually refresh with refresh button
    
    return () => {
      isMounted = false
    }
  }, []) // Only run once on mount

  useEffect(() => {
    filterPayments()
  }, [payments, debouncedSearchTerm, filterMethod, filterStatus])

  const fetchDataRef = useRef(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // PERFORMANCE FIX: Remove unnecessary salesAPI.getSales() call
      // Invoices load dynamically when customer is selected
      const [paymentsRes, customersRes] = await Promise.all([
        paymentsAPI.getPayments({ page: 1, pageSize: 100 }),
        customersAPI.getCustomers({ page: 1, pageSize: 100 })
      ])
      
      if (paymentsRes.success && paymentsRes.data) {
        setPayments(paymentsRes.data.items || paymentsRes.data || [])
      } else {
        console.warn('Payments response:', paymentsRes)
        setPayments([])
      }
      
      if (customersRes.success && customersRes.data) {
        setCustomers(customersRes.data.items || customersRes.data || [])
      } else {
        console.warn('Customers response:', customersRes)
        setCustomers([])
      }
      
      // Sales are no longer loaded - they load dynamically when customer is selected
      setSales([])
    } catch (error) {
      console.error('Failed to load payments data:', error)
      console.error('Error details:', error.response?.data || error.message)
      toast.error(error.response?.data?.message || 'Failed to load payments data')
      setPayments([])
      setCustomers([])
      setSales([])
    } finally {
      setLoading(false)
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

  const filterPayments = () => {
    let filtered = payments

    // Apply search filter
    if (debouncedSearchTerm) {
      filtered = filtered.filter(payment =>
        (payment.invoiceNo || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (payment.customerName || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (payment.ref || payment.reference || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      )
    }

    // Apply method filter (use normalized method)
    if (filterMethod) {
      filtered = filtered.filter(payment =>
        getPaymentMethod(payment).toLowerCase() === filterMethod.toLowerCase()
      )
    }

    // Filter by the authoritative state, independently of payment method.
    if (filterStatus) {
      filtered = filtered.filter(payment => {
        const status = String(payment.status ?? payment.Status ?? '').toUpperCase()
        if (filterStatus === 'completed') return status === 'CLEARED'
        if (filterStatus === 'pending') return status === 'PENDING'
        if (filterStatus === 'credit') return status === 'PENDING' && getPaymentMethod(payment) === 'Credit'
        if (filterStatus === 'void') return status === 'VOID'
        if (filterStatus === 'returned') return status === 'RETURNED'
        return true
      })
    }

    setFilteredPayments(filtered)
  }

  const executePayment = async (intent) => {
    if (user?.supportReadOnly) { toast.error('This support session is read-only.'); return }
    if (submittingRef.current || !accountPrefixRef.current || !intent.scope.startsWith(accountPrefixRef.current)) return
    const prefix = accountPrefixRef.current
    submittingRef.current = true
    setSubmitting(true)
    try {
      const send = intent.kind === 'allocate' ? paymentsAPI.allocatePayment : paymentsAPI.createPayment
      const response = await send(intent.request, intent.idempotencyKey)
      if (!response?.success) throw new Error(response?.message || 'Payment is unconfirmed. Retry the previous payment.')
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
      await fetchData()
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
    const amount = Number(data.amount)
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Please enter a valid positive payment amount.')
    const customerId = data.customerId ? Number(data.customerId) : null
    const saleId = data.saleId ? Number(data.saleId) : null
    if (!customerId && !saleId) throw new Error('Please select a customer or an invoice.')
    const selectedMode = String(data.method || 'CASH').toUpperCase()
    const mode = selectedMode === 'PENDING' ? 'CREDIT' : selectedMode
    if (!['CASH','CHEQUE','ONLINE','CREDIT','DEBIT'].includes(mode)) throw new Error('Select a valid payment method.')
    if (['CHEQUE', 'ONLINE'].includes(mode) && !String(data.ref || data.reference || '').trim()) {
      throw new Error('Enter a reference for cheque or online payments.')
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
          throw new Error('Payment exceeds the invoice outstanding balance. Refresh the invoice before saving.')
        }
      } else if (selectedCustomerDetails) {
        const customerBalance = Math.abs(selectedCustomerDetails.balance || 0)
        if (customerBalance > 0 && paymentAmount > customerBalance + 0.01) {
          throw new Error('Payment exceeds the customer outstanding balance. Refresh the customer before saving.')
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
        await fetchData()
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
        setPaymentToDelete(null)
        await fetchData()
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
    () => (canEditPayments && !user?.supportReadOnly ? payments.filter(canReceivePaymentReceipt) : []),
    [payments, canEditPayments, user?.supportReadOnly]
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
    () => canEditPayments && !user?.supportReadOnly ? filteredPayments.filter(canReceivePaymentReceipt).map(p => p.id) : [],
    [filteredPayments,canEditPayments,user?.supportReadOnly]
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
        fetchData()
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
        year: 'numeric' 
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
    const state = String(status || '').toUpperCase()
    if (state === 'CLEARED') return 'bg-green-100 text-green-800'
    if (state === 'RETURNED') return 'bg-red-100 text-red-800'
    if (state === 'PENDING') return 'bg-yellow-100 text-yellow-800'
    return 'bg-neutral-100 text-neutral-800'
  }

  if (loading) {
    return <LoadingCard message="Loading payments..." />
  }

  return (
    <div className={`space-y-6 ${receiptSelectedIds.length ? 'pb-48 lg:pb-20' : ''}`}>
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
      {recoveryError && <p role="alert" className="rounded-lg border border-red-300 bg-error-bg p-3 text-sm text-red-800">{recoveryError}</p>}
      {unconfirmedPayments.map(intent => (
        <div key={intent.idempotencyKey} role="status" className="rounded-lg border border-amber-300 bg-warning-bg p-3 text-sm text-amber-950">
          <p>Previous payment of {money(intent.request.amount)} for customer {intent.request.customerId ?? 'Cash Customer'} is unconfirmed. Confirm it before recording another payment for this customer.</p>
          <button type="button" disabled={submitting} onClick={() => executePayment(intent)} className="mt-2 min-h-[44px] rounded border border-amber-400 px-3 font-medium">Retry previous payment</button>
        </div>
      ))}
      {savedBatch && <div role="status" className="rounded-lg border border-amber-300 bg-warning-bg p-3 text-sm text-amber-950">
        <p>Saved bulk payments: {savedBatch.rows.filter(row => row.confirmed).length} of {savedBatch.rows.length} confirmed. Remaining payments retain their original amounts and keys.</p>
        <button type="button" disabled={submitting} onClick={() => setShowBulkPaymentModal(true)} className="mt-2 min-h-[44px] rounded border border-amber-400 px-3 font-medium">Resume bulk payments</button>
      </div>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Payments</h1>
          <p className="text-neutral-600">Manage customer payments and cheque status. Customer balance reflects cleared payments only; mark cheques as cleared when they clear.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            onClick={() => fetchData()}
            className="inline-flex items-center px-4 py-2 border border-neutral-300 rounded-md shadow-sm text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={submitting || Boolean(user?.supportReadOnly)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 min-h-[44px]"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Payment
          </button>
          <button
            onClick={() => setShowBulkPaymentModal(true)}
            disabled={submitting || Boolean(user?.supportReadOnly)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-success hover:bg-green-700 min-h-[44px]"
            title="Add multiple payments at once"
          >
            <Plus className="h-4 w-4 mr-2" />
            Bulk Payment
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search payments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <div className="flex space-x-3">
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="w-32 px-3 py-2 border border-neutral-300 rounded-md shadow-sm text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
            >
              <option value="">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="Online">Online</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-32 px-3 py-2 border border-neutral-300 rounded-md shadow-sm text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="credit">Credit</option>
              <option value="void">Voided</option>
              <option value="returned">Returned</option>
            </select>
            {(filterMethod || filterStatus) && (
              <button
                onClick={() => {
                  setFilterMethod('')
                  setFilterStatus('')
                }}
                className="inline-flex items-center px-4 py-2 border border-neutral-300 rounded-md shadow-sm text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50"
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-neutral-600 px-1">Receipts are for cleared incoming payments only (cash, cheque, online, debit).</p>

      {/* Payments Table - Desktop */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
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
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {filteredPayments.length === 0 ? (
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
                  <tr key={payment.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      {canEditPayments && !user?.supportReadOnly && canReceivePaymentReceipt(payment) && <input
                        type="checkbox"
                        checked={receiptSelectedIds.includes(payment.id)}
                        onChange={() => togglePaymentSelection(payment.id)}
                        className="rounded border-neutral-300 disabled:opacity-40"
                        aria-label={`Select payment ${payment.id} for receipt`}
                      />}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-neutral-900">{payment.invoiceNo || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-neutral-900">{payment.customerName || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {money(payment.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <CreditCard className="h-4 w-4 text-neutral-400 mr-2" />
                        <span className="text-sm text-neutral-900">{getPaymentMethod(payment)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {payment.ref || payment.reference || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(payment.status, getChequeStatus(payment), getPaymentMethod(payment))}
                        <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.status, getChequeStatus(payment), getPaymentMethod(payment))}`}>
                          {paymentStatusLabel(payment)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {formatDate(payment.paymentDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
        onSuccess={fetchData}
      />

      {/* Payments Cards - Mobile */}
      <div className="md:hidden space-y-3">
        {filteredPayments.length === 0 ? (
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
              <div className="flex items-start justify-between mb-3">
                {canEditPayments && !user?.supportReadOnly && canReceivePaymentReceipt(payment) && (
                  <input type="checkbox" checked={receiptSelectedIds.includes(payment.id)} onChange={() => togglePaymentSelection(payment.id)}
                    aria-label={`Select payment ${payment.id} for receipt`} className="mt-1 mr-3 min-h-[24px] min-w-[24px] rounded border-neutral-300" />
                )}
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{payment.customerName || 'Unknown'}</p>
                  <p className="text-xs text-neutral-500">{payment.invoiceNo || 'General Payment'}</p>
                </div>
                <p className="text-base font-bold text-neutral-900">{money(payment.amount)}</p>
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

      {/* Add Payment Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={closeAddPaymentModal}
        title="Add New Payment"
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Select
              label="Customer (Optional - if not selecting invoice)"
              options={[
                { value: '', label: 'Select Customer' },
                ...customers.map(customer => ({
                  value: customer.id,
                  label: `${customer.name} ${customer.phone ? `(${customer.phone})` : ''} - Balance: ${balance(customer.balance || 0)}`
                }))
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
              {...register('method', { required: 'Payment method is required' })}
            />

            <Input
              label="Amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              required
              error={errors.amount?.message}
              {...register('amount', { 
                required: 'Amount is required',
                min: { value: 0.01, message: 'Amount must be greater than 0' }
              })}
            />

            <Input
              label="Payment Date"
              type="date"
              required
              error={errors.paymentDate?.message}
              defaultValue={localDateString(new Date())}
              {...register('paymentDate', { required: 'Payment date is required' })}
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
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
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
                  placeholder="CHQ001"
                  error={errors.ref?.message}
                  {...register('ref')}
                />
                <Input
                  label="Bank Name"
                  placeholder="Emirates NBD"
                  error={errors.bankName?.message}
                  {...register('bankName')}
                />
              </>
            )}

            {paymentMethod === 'Online' && (
              <Input
                label="Transaction Reference"
                placeholder="TXN123456"
                error={errors.ref?.message}
                {...register('ref')}
              />
            )}

            <div className="md:col-span-2">
              <Input
                label="Notes"
                placeholder="Additional payment notes..."
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
          setEditingPayment(null)
          await fetchData()
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
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600 mb-4">
            Add multiple payments at once. Each row represents one payment.
          </p>
          {bulkRows.map((payment, index) => (
            <div key={index} className="border border-neutral-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-neutral-700">Payment #{index + 1}{savedBatch ? (payment.confirmed ? ' · Confirmed' : ' · Awaiting confirmation') : ''}</span>
                {!savedBatch && bulkPayments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setBulkPayments(bulkPayments.filter((_, i) => i !== index))
                    }}
                    className="text-error hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  label="Customer"
                  disabled={submitting || Boolean(savedBatch)}
                  options={[
                    { value: '', label: 'Select Customer' },
                    ...customers.map(customer => ({
                      value: customer.id,
                      label: `${customer.name} ${customer.phone ? `(${customer.phone})` : ''} - Balance: ${balance(customer.balance || 0)}`
                    }))
                  ]}
                  value={payment.customerId}
                  onChange={(e) => {
                    const updated = [...bulkPayments]
                    updated[index].customerId = e.target.value
                    setBulkPayments(updated)
                  }}
                />
                <Input
                  label="Amount"
                  disabled={submitting || Boolean(savedBatch)}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={payment.amount}
                  onChange={(e) => {
                    const updated = [...bulkPayments]
                    updated[index].amount = e.target.value
                    setBulkPayments(updated)
                  }}
                />
                <Select
                  label="Payment Method"
                  disabled={submitting || Boolean(savedBatch)}
                  options={[
                    { value: 'CASH', label: 'Cash' },
                    { value: 'CHEQUE', label: 'Cheque' },
                    { value: 'ONLINE', label: 'Online Transfer' }
                  ]}
                  value={String(payment.method).toUpperCase()}
                  onChange={(e) => {
                    const updated = [...bulkPayments]
                    updated[index].method = e.target.value
                    setBulkPayments(updated)
                  }}
                />
                <Input
                  label="Payment Date"
                  disabled={submitting || Boolean(savedBatch)}
                  type="date"
                  value={payment.paymentDate}
                  onChange={(e) => {
                    const updated = [...bulkPayments]
                    updated[index].paymentDate = e.target.value
                    setBulkPayments(updated)
                  }}
                />
                <Input label="Reference" value={payment.reference || ''}
                  disabled={submitting || Boolean(savedBatch)}
                  required={['CHEQUE','ONLINE'].includes(String(payment.method).toUpperCase())}
                  onChange={e => { const updated=[...bulkPayments]; updated[index]={...updated[index],reference:e.target.value}; setBulkPayments(updated) }}
                />
              </div>
            </div>
          ))}
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
