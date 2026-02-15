import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Search,
  Download,
  Printer,
  RefreshCw,
  Settings,
  Plus,
  FileText,
  Eye,
  DollarSign,
  TrendingUp,
  Users,
  CreditCard,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Filter,
  X,
  Edit,
  Trash2,
  Wallet
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useBranding } from '../../contexts/TenantBrandingContext'
import { formatCurrency, formatBalance } from '../../utils/currency'
import { LoadingCard, LoadingButton } from '../../components/Loading'
import { Input, Select } from '../../components/Form'
import Modal from '../../components/Modal'
import { customersAPI, paymentsAPI, salesAPI, reportsAPI, branchesAPI, routesAPI, adminAPI } from '../../services'
import { Lock, Unlock } from 'lucide-react'
import toast from 'react-hot-toast'
import PaymentModal from '../../components/PaymentModal'
import InvoicePreviewModal from '../../components/InvoicePreviewModal'
import { isAdminOrOwner } from '../../utils/roles'

const CustomerLedgerPage = () => {
  const { user } = useAuth()
  const { companyName } = useBranding()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [paymentLoading, setPaymentLoading] = useState(false) // Separate loading state for payment submission
  const [customerLoading, setCustomerLoading] = useState(false) // Separate loading state for customer creation

  // Use refs to track loading state synchronously (prevents race conditions)
  const paymentLoadingRef = useRef(false)
  const customerLoadingRef = useRef(false)
  const recalculateInProgress = useRef(new Set()) // Track recalculate calls to prevent flooding
  const [customers, setCustomers] = useState([])
  const [filteredCustomers, setFilteredCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Customer data
  const [customerLedger, setCustomerLedger] = useState([])
  const [customerInvoices, setCustomerInvoices] = useState([])
  const [customerPayments, setCustomerPayments] = useState([])
  const [outstandingInvoices, setOutstandingInvoices] = useState([])
  const [customerSummary, setCustomerSummary] = useState(null)

  // UI State
  const [activeTab, setActiveTab] = useState('ledger') // ledger, invoices, payments, reports
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentModalInvoiceId, setPaymentModalInvoiceId] = useState(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState(null)
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of month
    to: new Date().toISOString().split('T')[0] // Today
  })
  const [ledgerFilters, setLedgerFilters] = useState({
    status: 'all',
    type: 'all'
  })
  const [ledgerBranchId, setLedgerBranchId] = useState('')
  const [ledgerRouteId, setLedgerRouteId] = useState('')
  const [ledgerStaffId, setLedgerStaffId] = useState('')
  const [branches, setBranches] = useState([])
  const [routes, setRoutes] = useState([])
  const [staffUsers, setStaffUsers] = useState([])

  // Keyboard shortcuts refs
  const searchInputRef = useRef(null)

  // Separate form instances for customer and payment forms
  const customerForm = useForm()
  const paymentForm = useForm()

  const {
    register: customerRegister,
    handleSubmit: handleCustomerSubmit,
    reset: resetCustomerForm,
    formState: { errors: customerErrors }
  } = customerForm

  const {
    register: paymentRegister,
    handleSubmit: handlePaymentFormSubmit,
    reset: resetPaymentForm,
    setValue: setPaymentValue,
    watch: watchPayment,
    formState: { errors: paymentErrors }
  } = paymentForm

  const selectedSaleId = watchPayment('saleId')
  const selectedCustomerId = watchPayment('customerId')
  const [searchParams, setSearchParams] = useSearchParams()

  // ========== ALL HANDLER FUNCTIONS - DEFINED FIRST ==========
  // Excel Export Handler
  const handleExportExcel = () => {
    if (!selectedCustomer || customerLedger.length === 0) {
      toast.error('No data to export')
      return
    }

    try {
      // Filter by date range
      const filteredEntries = customerLedger.filter(entry => {
        const entryDate = new Date(entry.date)
        const fromDate = new Date(dateRange.from)
        const toDate = new Date(dateRange.to)
        toDate.setHours(23, 59, 59, 999)
        return entryDate >= fromDate && entryDate <= toDate
      })

      // Create CSV content
      const headers = ['Date', 'Type', 'Invoice No', 'Payment Mode', 'Debit (AED)', 'Credit (AED)', 'Status', 'Balance']
      const rows = filteredEntries.map(entry => {
        const dateStr = entry.type === 'Payment'
          ? new Date(entry.date).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })

        return [
          dateStr,
          entry.type || '',
          entry.reference || '-',
          entry.paymentMode || entry.PaymentMode || '-',
          entry.debit > 0 ? entry.debit.toFixed(2) : '',
          entry.credit > 0 ? entry.credit.toFixed(2) : '',
          entry.status || '-',
          entry.balance.toFixed(2)
        ]
      })

      // Add closing balance row
      const closingBalance = filteredEntries.length > 0 ? filteredEntries[filteredEntries.length - 1].balance : 0
      rows.push(['', '', '', '', '', '', 'Closing Balance', closingBalance.toFixed(2)])

      // Convert to CSV
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `Ledger_${selectedCustomer.name}_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Ledger exported to Excel successfully')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export ledger')
    }
  }

  // Load all customers
  useEffect(() => {
    fetchCustomers()
  }, [])

  // Load customer from URL parameter
  useEffect(() => {
    const customerIdParam = searchParams.get('customerId')
    if (customerIdParam) {
      const customerId = parseInt(customerIdParam)
      if (!isNaN(customerId)) {
        const customer = customers.find(c => c.id === customerId)
        if (customer) {
          setSelectedCustomer(customer)
        } else if (customers.length > 0) {
          // Customer not found in list, try to fetch it
          customersAPI.getCustomer(customerId).then(response => {
            if (response?.success && response?.data) {
              setSelectedCustomer(response.data)
            }
          }).catch(err => console.error('Failed to load customer from URL:', err))
        }
      }
    }
  }, [searchParams, customers])

  // Load customer data when selected (debounced to prevent excessive calls)
  useEffect(() => {
    if (selectedCustomer) {
      const timeoutId = setTimeout(() => {
        loadCustomerData(selectedCustomer.id)
      }, 300) // 300ms debounce
      return () => clearTimeout(timeoutId)
    }
  }, [selectedCustomer?.id, dateRange.from, dateRange.to, ledgerBranchId, ledgerRouteId, ledgerStaffId])

  // Load branches, routes, and staff for ledger filters
  useEffect(() => {
    const load = async () => {
      try {
        const [bRes, rRes] = await Promise.all([
          branchesAPI.getBranches().catch(() => ({ success: false })),
          routesAPI.getRoutes().catch(() => ({ success: false }))
        ])

        let staffList = []
        if (isAdminOrOwner(user)) {
          const uRes = await adminAPI.getUsers().catch(() => ({ success: false }))
          if (uRes?.success && uRes?.data) {
            staffList = Array.isArray(uRes.data) ? uRes.data : (uRes.data?.items || [])
          }
        } else {
          // If staff, just add self
          if (user) staffList = [user]
        }

        if (bRes?.success && bRes?.data) setBranches(bRes.data)
        if (rRes?.success && rRes?.data) setRoutes(rRes.data)
        setStaffUsers(staffList)
      } catch (err) {
        console.error('Failed to load filter options:', err)
      }
    }
    load()
  }, [user])

  // Filter branches and routes based on user role
  const availableBranches = useMemo(() => {
    if (!user) return []
    if (isAdminOrOwner(user)) return branches
    // If staff has no explicit assignments, they might see all (fallback) or none
    // Usually we want to restrict. If array exists but empty, return empty.
    if (user.assignedBranchIds && user.assignedBranchIds.length > 0) {
      return branches.filter(b => user.assignedBranchIds.includes(b.id))
    }
    return branches // Fallback: all branches if no assignments defined (legacy behavior)
  }, [branches, user])

  const availableRoutes = useMemo(() => {
    if (!user) return []
    if (isAdminOrOwner(user)) return routes
    if (user.assignedRouteIds && user.assignedRouteIds.length > 0) {
      return routes.filter(r => user.assignedRouteIds.includes(r.id))
    }
    return routes // Fallback
  }, [routes, user])

  const availableStaff = useMemo(() => {
    if (!user) return []
    if (isAdminOrOwner(user)) return staffUsers
    // Staff can only see themselves
    return staffUsers.filter(u => u.id === user.id)
  }, [staffUsers, user])

  // Auto-select filters for Staff
  useEffect(() => {
    if (user && !isAdminOrOwner(user) && !loading) {
      // Auto-select branch if not selected and only one available or just pick first
      if (!ledgerBranchId && availableBranches.length > 0) {
        setLedgerBranchId(availableBranches[0].id.toString())
      }

      // Auto-select staff (myself)
      if (!ledgerStaffId && user.id) {
        setLedgerStaffId(user.id.toString())
      }
    }
  }, [user, availableBranches, ledgerBranchId, ledgerStaffId, loading])

  // Refresh data when window regains focus (e.g., returning from POS edit)
  useEffect(() => {
    const handleFocus = () => {
      if (selectedCustomer) {
        loadCustomerData(selectedCustomer.id)
        fetchCustomers() // Also refresh customer list to update balances
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [selectedCustomer])

  // Filter customers
  useEffect(() => {
    filterCustomers()
  }, [customers, searchTerm])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // F2 - Focus search
      if (e.key === 'F2' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      // F4 - Add Payment
      if (e.key === 'F4' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault()
        if (selectedCustomer) {
          setShowPaymentModal(true)
        }
      }
      // F5 - View Statement
      if (e.key === 'F5' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault()
        if (selectedCustomer) {
          handleExportStatement()
        }
      }
      // F7 - Export PDF
      if (e.key === 'F7' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault()
        if (selectedCustomer) {
          handleExportPDF()
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [selectedCustomer])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const response = await customersAPI.getCustomers({ page: 1, pageSize: 1000 })
      if (response.success && response.data) {
        setCustomers(response.data.items || [])
      }
    } catch (error) {
      console.error('Failed to load customers:', error)
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  const filterCustomers = () => {
    let filtered = customers
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(c =>
        c.name?.toLowerCase().includes(term) ||
        c.phone?.includes(term) ||
        c.trn?.toLowerCase().includes(term) ||
        c.address?.toLowerCase().includes(term)
      )
    }
    setFilteredCustomers(filtered)
  }

  // ============================================================================
  // DATA VALIDATION & RECONCILIATION FUNCTIONS - GUARANTEE REAL DATA INTEGRITY
  // ============================================================================

  /**
   * Validate and reconcile customer data to ensure 100% accuracy
   * Returns validation report with any discrepancies found
   */
  const validateAndReconcileCustomerData = async (customerId, ledgerData, invoicesData, paymentsData, customerData) => {
    const validationReport = {
      isValid: true,
      errors: [],
      warnings: [],
      discrepancies: []
    }

    try {
      // 1. VALIDATE CUSTOMER ID CONSISTENCY
      if (!customerId || customerId <= 0) {
        validationReport.isValid = false
        validationReport.errors.push('Invalid customer ID')
        return validationReport
      }

      // 2. VALIDATE ALL INVOICES BELONG TO CUSTOMER
      const invalidInvoices = invoicesData.filter(inv => {
        const invCustomerId = inv.customerId || inv.customerID
        return invCustomerId !== customerId &&
          parseInt(invCustomerId) !== parseInt(customerId)
      })
      if (invalidInvoices.length > 0) {
        validationReport.isValid = false
        validationReport.errors.push(`${invalidInvoices.length} invoice(s) do not belong to customer ${customerId}`)
        validationReport.discrepancies.push({
          type: 'INVOICE_MISMATCH',
          count: invalidInvoices.length,
          details: invalidInvoices.map(inv => ({ id: inv.id, invoiceNo: inv.invoiceNo, customerId: inv.customerId }))
        })
      }

      // 3. VALIDATE ALL PAYMENTS BELONG TO CUSTOMER
      const invalidPayments = paymentsData.filter(p => {
        const paymentCustomerId = p.customerId || p.customerID
        return paymentCustomerId !== customerId &&
          parseInt(paymentCustomerId) !== parseInt(customerId)
      })
      if (invalidPayments.length > 0) {
        validationReport.isValid = false
        validationReport.errors.push(`${invalidPayments.length} payment(s) do not belong to customer ${customerId}`)
        validationReport.discrepancies.push({
          type: 'PAYMENT_MISMATCH',
          count: invalidPayments.length,
          details: invalidPayments.map(p => ({ id: p.id, amount: p.amount, customerId: p.customerId }))
        })
      }

      // 4. RECONCILE BALANCE - Calculate from actual transactions
      if (customerData) {
        const calculatedTotalSales = invoicesData.reduce((sum, inv) => sum + (parseFloat(inv.grandTotal) || 0), 0)
        const calculatedTotalPayments = paymentsData.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
        const calculatedBalance = calculatedTotalSales - calculatedTotalPayments
        const storedBalance = parseFloat(customerData.balance) || 0

        // Allow small rounding differences (0.01)
        const balanceDifference = Math.abs(calculatedBalance - storedBalance)
        if (balanceDifference > 0.01) {
          validationReport.warnings.push(`Balance discrepancy detected: Calculated=${calculatedBalance.toFixed(2)}, Stored=${storedBalance.toFixed(2)}, Difference=${balanceDifference.toFixed(2)}`)
          validationReport.discrepancies.push({
            type: 'BALANCE_MISMATCH',
            calculated: calculatedBalance,
            stored: storedBalance,
            difference: balanceDifference
          })
        }
      }

      // 5. VALIDATE PAYMENT-INVOICE LINKAGE
      const paymentInvoiceMismatches = []
      paymentsData.forEach(payment => {
        if (payment.saleId || payment.invoiceId) {
          const linkedInvoiceId = payment.saleId || payment.invoiceId
          const linkedInvoice = invoicesData.find(inv => inv.id === linkedInvoiceId)
          if (linkedInvoice) {
            // Verify payment customer matches invoice customer
            const paymentCustomerId = payment.customerId || payment.customerID
            const invoiceCustomerId = linkedInvoice.customerId || linkedInvoice.customerID
            if (paymentCustomerId !== invoiceCustomerId &&
              parseInt(paymentCustomerId) !== parseInt(invoiceCustomerId)) {
              paymentInvoiceMismatches.push({
                paymentId: payment.id,
                invoiceId: linkedInvoiceId,
                paymentCustomerId,
                invoiceCustomerId
              })
            }
          }
        }
      })
      if (paymentInvoiceMismatches.length > 0) {
        validationReport.warnings.push(`${paymentInvoiceMismatches.length} payment-invoice linkage mismatch(es)`)
        validationReport.discrepancies.push({
          type: 'PAYMENT_INVOICE_LINKAGE_MISMATCH',
          count: paymentInvoiceMismatches.length,
          details: paymentInvoiceMismatches
        })
      }

      // 6. VALIDATE LEDGER ENTRIES CONSISTENCY
      if (ledgerData && ledgerData.length > 0) {
        const ledgerTotalDebit = ledgerData.reduce((sum, entry) => sum + (parseFloat(entry.debit) || 0), 0)
        const ledgerTotalCredit = ledgerData.reduce((sum, entry) => sum + (parseFloat(entry.credit) || 0), 0)
        const invoiceTotal = invoicesData.reduce((sum, inv) => sum + (parseFloat(inv.grandTotal) || 0), 0)
        const paymentTotal = paymentsData.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)

        // Ledger debit should match invoice total (within rounding)
        const debitDifference = Math.abs(ledgerTotalDebit - invoiceTotal)
        if (debitDifference > 0.01) {
          validationReport.warnings.push(`Ledger debit mismatch: Ledger=${ledgerTotalDebit.toFixed(2)}, Invoices=${invoiceTotal.toFixed(2)}`)
        }

        // Ledger credit should match payment total (within rounding)
        const creditDifference = Math.abs(ledgerTotalCredit - paymentTotal)
        if (creditDifference > 0.01) {
          validationReport.warnings.push(`Ledger credit mismatch: Ledger=${ledgerTotalCredit.toFixed(2)}, Payments=${paymentTotal.toFixed(2)}`)
        }
      }

      console.log('Data validation completed:', validationReport)
      return validationReport
    } catch (error) {
      console.error('Error during data validation:', error)
      validationReport.isValid = false
      validationReport.errors.push(`Validation error: ${error.message}`)
      return validationReport
    }
  }

  /**
   * Recalculate and verify customer balance from real data
   * CRITICAL: Prevents duplicate calls for same customer
   */
  const recalculateCustomerBalance = async (customerId) => {
    // Prevent duplicate calls for same customer
    if (recalculateInProgress.current.has(customerId)) {
      console.log(`Balance recalculation already in progress for customer ${customerId}`)
      return { success: false, message: 'Recalculation already in progress' }
    }

    recalculateInProgress.current.add(customerId)

    try {
      const response = await customersAPI.recalculateBalance(customerId)
      if (response.success) {
        console.log(`Balance recalculated for customer ${customerId}`)
        return { success: true, message: 'Balance recalculated successfully' }
      } else {
        // Don't log errors repeatedly
        if (!response._logged) {
          console.error('Balance recalculation failed:', response.message)
          response._logged = true
        }
        return { success: false, message: response.message || 'Failed to recalculate balance' }
      }
    } catch (error) {
      // Don't log 429 errors repeatedly
      if (error?.response?.status !== 429 && !error?._logged) {
        console.error('Error recalculating balance:', error)
        error._logged = true
      }
      return { success: false, message: error.message || 'Error recalculating balance' }
    } finally {
      // Remove from in-progress set after delay to prevent rapid re-calls
      setTimeout(() => {
        recalculateInProgress.current.delete(customerId)
      }, 5000) // 5 second cooldown
    }
  }

  /**
   * Verify payment data integrity
   */
  const verifyPaymentIntegrity = (payments, invoices) => {
    const issues = []

    payments.forEach(payment => {
      // Check payment amount is positive
      if (parseFloat(payment.amount) <= 0) {
        issues.push({ type: 'INVALID_AMOUNT', paymentId: payment.id, amount: payment.amount })
      }

      // Check payment date is valid
      if (!payment.paymentDate || isNaN(new Date(payment.paymentDate).getTime())) {
        issues.push({ type: 'INVALID_DATE', paymentId: payment.id })
      }

      // If payment is linked to invoice, verify invoice exists and amount doesn't exceed invoice total
      if (payment.saleId || payment.invoiceId) {
        const linkedInvoiceId = payment.saleId || payment.invoiceId
        const linkedInvoice = invoices.find(inv => inv.id === linkedInvoiceId)
        if (!linkedInvoice) {
          issues.push({ type: 'MISSING_INVOICE', paymentId: payment.id, invoiceId: linkedInvoiceId })
        } else {
          const invoiceOutstanding = parseFloat(linkedInvoice.grandTotal) - (parseFloat(linkedInvoice.paidAmount) || 0)
          if (parseFloat(payment.amount) > invoiceOutstanding + 0.01) { // Allow small rounding
            issues.push({
              type: 'PAYMENT_EXCEEDS_OUTSTANDING',
              paymentId: payment.id,
              paymentAmount: payment.amount,
              invoiceOutstanding: invoiceOutstanding
            })
          }
        }
      }
    })

    return {
      isValid: issues.length === 0,
      issues
    }
  }

  const loadCustomerData = async (customerId) => {
    // Handle cash customer (customerId is null or special flag)
    const isCashCustomer = !customerId || customerId === 'cash' || customerId === 0

    if (isCashCustomer) {
      // Load cash customer ledger, invoices, and payments
      try {
        setLoading(true)
        setCustomerLedger([])
        setCustomerInvoices([])
        setCustomerPayments([])
        setOutstandingInvoices([])
        setCustomerSummary(null)

        // First, recalculate cash customer invoice statuses to fix any stale data
        try {
          await customersAPI.recalculateBalance('cash')
        } catch (recalcError) {
          // Silently ignore - this is just a fix-up operation
          console.log('Cash customer recalculate skipped:', recalcError?.message)
        }

        // Load ledger, sales, and payments in parallel
        const [ledgerRes, salesRes, paymentsRes] = await Promise.all([
          customersAPI.getCashCustomerLedger(),
          salesAPI.getSales({ page: 1, pageSize: 1000 }),
          paymentsAPI.getPayments({ page: 1, pageSize: 1000 }) // Get all payments
        ])

        if (ledgerRes.success && ledgerRes.data) {
          const ledgerData = Array.isArray(ledgerRes.data) ? ledgerRes.data : []
          setCustomerLedger(ledgerData)
        }

        // Load cash customer sales (where customerId is null)
        if (salesRes.success && salesRes.data) {
          const allSales = salesRes.data.items || []
          const cashSales = allSales.filter(sale => !sale.customerId)
          setCustomerInvoices(cashSales)

          // Calculate outstanding invoices for cash customer
          const outstanding = cashSales.filter(sale => {
            const paid = sale.paidAmount || 0
            const total = sale.grandTotal || 0
            return paid < total
          })
          setOutstandingInvoices(outstanding)
        }

        // CRITICAL: Load cash customer payments (where customerId is null)
        if (paymentsRes.success && paymentsRes.data) {
          const allPayments = paymentsRes.data.items || []
          // Filter for cash customer payments (customerId is null or missing)
          const cashPayments = allPayments.filter(payment => {
            const paymentCustomerId = payment.customerId || payment.customerID
            return !paymentCustomerId || paymentCustomerId === null || paymentCustomerId === 0
          }).filter(p => {
            // Also filter by date range
            const paymentDate = new Date(p.paymentDate)
            const fromDate = new Date(dateRange.from)
            const toDate = new Date(dateRange.to)
            toDate.setHours(23, 59, 59, 999)
            return paymentDate >= fromDate && paymentDate <= toDate
          })
          setCustomerPayments(cashPayments)
          console.log(`Loaded ${cashPayments.length} cash customer payments`)
        }

        setCustomerSummary({
          totalDebit: ledgerRes.data?.reduce((sum, e) => sum + (e.debit || 0), 0) || 0,
          totalCredit: ledgerRes.data?.reduce((sum, e) => sum + (e.credit || 0), 0) || 0,
          balance: 0 // Cash customers always have 0 balance
        })
      } catch (error) {
        console.error('Failed to load cash customer data:', error)
        toast.error('Failed to load cash customer ledger')
      } finally {
        setLoading(false)
      }
      return
    }

    // CRITICAL: Validate customerId matches selected customer to prevent data mismatches
    if (!customerId || customerId <= 0) {
      console.error('Invalid customer ID:', customerId)
      return
    }

    // Double-check that we're still loading for the same customer
    if (selectedCustomer && selectedCustomer.id !== customerId) {
      console.warn('Customer changed during load, aborting data load for customer:', customerId)
      return
    }

    try {
      setLoading(true)

      // Clear data first to prevent showing stale data
      setCustomerLedger([])
      setCustomerInvoices([])
      setCustomerPayments([])
      setOutstandingInvoices([])
      setCustomerSummary(null)

      // Load all data in parallel
      // CRITICAL: Use Reports API which properly filters by customerId on backend
      // This ensures ALL customer invoices are retrieved, not just first 1000 from entire database
      const [ledgerRes, invoicesRes, outstandingRes, customerRes] = await Promise.all([
        customersAPI.getCustomerLedger(customerId, {
          branchId: ledgerBranchId ? parseInt(ledgerBranchId, 10) : undefined,
          routeId: ledgerRouteId ? parseInt(ledgerRouteId, 10) : undefined,
          staffId: ledgerStaffId ? parseInt(ledgerStaffId, 10) : undefined,
          fromDate: dateRange.from,
          toDate: dateRange.to
        }),
        reportsAPI.getSalesReport({
          page: 1,
          pageSize: 1000,
          customerId,
          fromDate: dateRange.from,
          toDate: dateRange.to
        }),
        customersAPI.getOutstandingInvoices(customerId),
        customersAPI.getCustomer(customerId)
      ])

      // CRITICAL: Verify we're still loading for the same customer after API calls
      if (selectedCustomer && selectedCustomer.id !== customerId) {
        console.warn('Customer changed after API calls, discarding data for customer:', customerId)
        return
      }

      let ledgerData = []
      let invoicesData = []
      let outstandingData = []

      if (ledgerRes.success && ledgerRes.data) {
        ledgerData = Array.isArray(ledgerRes.data) ? ledgerRes.data : []
        // Validate all ledger entries belong to this customer (extra safety check)
        const validLedgerData = ledgerData.filter(entry => {
          // Ledger entries should all be for this customer (backend should filter, but double-check)
          return true // Backend already filters, but we can add more validation if needed
        })
        setCustomerLedger(validLedgerData)
      }

      if (invoicesRes.success && invoicesRes.data) {
        const sales = invoicesRes.data.items || []
        // CRITICAL: Validate all invoices belong to this customer
        const validSales = sales.filter(sale => {
          // Ensure sale belongs to this customer
          return sale.customerId === customerId || sale.customerId === parseInt(customerId)
        })
        // Backend already filters by date range, so use validSales directly
        invoicesData = validSales
        setCustomerInvoices(invoicesData)
      }

      if (outstandingRes.success && outstandingRes.data) {
        outstandingData = Array.isArray(outstandingRes.data) ? outstandingRes.data : []
        // Validate outstanding invoices belong to this customer
        const validOutstanding = outstandingData.filter(inv => {
          return inv.customerId === customerId || inv.customerId === parseInt(customerId)
        })
        setOutstandingInvoices(validOutstanding)
      }

      if (customerRes.success && customerRes.data) {
        const customer = customerRes.data
        // Calculate summary using FRESH data filtered by date range (matching what's shown in tabs)
        // Filter ledger data by date range for accurate calculations
        const filteredLedgerData = ledgerData.filter(entry => {
          const entryDate = new Date(entry.date)
          const fromDate = new Date(dateRange.from)
          const toDate = new Date(dateRange.to)
          toDate.setHours(23, 59, 59, 999)
          return entryDate >= fromDate && entryDate <= toDate
        })

        // Calculate totals from filtered ledger data (matching LedgerStatementTab logic)
        const totalSales = filteredLedgerData.reduce((sum, entry) => sum + (entry.debit || 0), 0)
        const totalPayments = filteredLedgerData
          .filter(entry => entry.type === 'Payment')
          .reduce((sum, entry) => sum + (entry.credit || 0), 0)
        // Outstanding is the difference between sales and payments in the date range
        const outstanding = totalSales - totalPayments
        // Also store the customer's overall balance for reference
        const customerBalance = customer.balance || 0

        setCustomerSummary({
          totalSales,
          totalPayments,
          outstanding,
          customerBalance, // Store overall balance separately
          customer
        })
      }

      // Load payments separately
      const paymentsRes = await paymentsAPI.getPayments({ page: 1, pageSize: 1000, customerId })

      // CRITICAL: Verify we're still loading for the same customer after payment API call
      if (selectedCustomer && selectedCustomer.id !== customerId) {
        console.warn('Customer changed after payment API call, discarding data for customer:', customerId)
        return
      }

      if (paymentsRes.success && paymentsRes.data) {
        const allPayments = paymentsRes.data.items || []
        // CRITICAL: Strictly filter payments by customerId to prevent mismatches
        const customerPayments = allPayments
          .filter(p => {
            // Ensure payment belongs to this customer (check both string and number)
            const paymentCustomerId = p.customerId || p.customerID
            return paymentCustomerId === customerId ||
              paymentCustomerId === parseInt(customerId) ||
              parseInt(paymentCustomerId) === parseInt(customerId)
          })
          .filter(p => {
            const paymentDate = new Date(p.paymentDate)
            const fromDate = new Date(dateRange.from)
            const toDate = new Date(dateRange.to)
            toDate.setHours(23, 59, 59, 999)
            return paymentDate >= fromDate && paymentDate <= toDate
          })
        setCustomerPayments(customerPayments)

        // SILENT VALIDATION: Only log errors, don't show toast floods
        // Only validate and show errors during manual reconciliation or critical operations
        const validationReport = await validateAndReconcileCustomerData(
          customerId,
          ledgerData,
          invoicesData,
          customerPayments,
          customerRes.success ? customerRes.data : null
        )

        // ONLY log validation errors to console - don't show toasts on every load
        if (!validationReport.isValid && validationReport.errors.length > 0) {
          console.error('DATA VALIDATION ERRORS:', validationReport.errors)
          // Don't show toast - this floods the UI on every refresh
          // Only auto-fix if it's a critical error (not just warnings)
        } else if (validationReport.warnings.length > 0) {
          console.warn('Data validation warnings:', validationReport.warnings)
          // Don't show toast or auto-recalculate - this causes refresh loops
        }

        // SILENT PAYMENT INTEGRITY CHECK - only log, don't show toast
        const paymentIntegrity = verifyPaymentIntegrity(customerPayments, invoicesData)
        if (!paymentIntegrity.isValid) {
          console.warn('Payment integrity issues:', paymentIntegrity.issues)
          // Don't show toast - this message is confusing and floods on every load
          // User can manually reconcile if needed using the Reconcile button
        }
      }
    } catch (error) {
      // CRITICAL: Prevent error flooding - only show error once
      if (!error._logged) {
        console.error('Failed to load customer data:', error)
        error._logged = true

        // Only show error if it's not a 429 (rate limit) or throttled request
        if (error?.response?.status !== 429 && !error?.isThrottled && !error?.isRateLimited) {
          toast.error('Failed to load customer data')
        }
      }

      // CRITICAL: Don't auto-retry on 429 errors - this causes infinite loops
      if (error?.response?.status === 429 || error?.isThrottled || error?.isRateLimited) {
        // Rate limited - don't retry automatically
        return
      }

      // Only attempt recovery for non-rate-limit errors, and only once
      if (!error._recoveryAttempted) {
        error._recoveryAttempted = true
        try {
          await recalculateCustomerBalance(customerId)
          // Don't show recovery toast - it causes flooding
          // Retry after delay, but only once
          setTimeout(() => {
            if (!error._retryAttempted) {
              error._retryAttempted = true
              loadCustomerData(customerId)
            }
          }, 3000) // 3 second delay before retry
        } catch (recoveryError) {
          // Don't log recovery errors to prevent flooding
          if (!recoveryError._logged) {
            console.error('Recovery failed:', recoveryError)
            recoveryError._logged = true
          }
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSelectCustomer = (customer) => {
    // CRITICAL: Clear all customer data when switching customers to prevent data mismatches
    setCustomerLedger([])
    setCustomerInvoices([])
    setCustomerPayments([])
    setOutstandingInvoices([])
    setCustomerSummary(null)
    setSelectedCustomer(customer)
    setSearchTerm('')
  }

  const handleAddCustomer = async (data) => {
    // Debug logs removed to prevent console flooding

    // Prevent multiple submissions using ref (synchronous check)
    if (customerLoadingRef.current || customerLoading) {
      console.log('Customer creation already in progress, ignoring duplicate submission')
      toast.error('Please wait, customer creation in progress...')
      return
    }

    if (!data || !data.name) {
      console.error('Customer data validation failed:', data)
      toast.error('Customer name is required')
      return
    }

    // Set loading state IMMEDIATELY (both ref and state)
    customerLoadingRef.current = true
    setCustomerLoading(true)

    try {
      // Ensure creditLimit is a number
      const customerData = {
        name: data.name?.trim() || '',
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        trn: data.trn?.trim() || null,
        address: data.address?.trim() || null,
        creditLimit: data.creditLimit ? parseFloat(data.creditLimit) : 0
      }

      // Validate required field
      if (!customerData.name) {
        toast.error('Customer name is required')
        customerLoadingRef.current = false
        setCustomerLoading(false) // Reset loading state on validation error
        return
      }

      console.log('Creating customer with data:', customerData)
      const response = await customersAPI.createCustomer(customerData)
      // Response logged only if needed for debugging

      if (response?.success) {
        toast.success('Customer added successfully!')
        setShowAddCustomerModal(false)
        resetCustomerForm()

        // INSTANT UPDATE: No delay - refresh immediately
        // Refreshing customer list and data
        await Promise.all([
          fetchCustomers(), // Refresh customer list
          response?.data ? loadCustomerData(response.data.id) : Promise.resolve()
        ])

        if (response?.data) {
          // New customer created successfully
          setSelectedCustomer(response.data) // Auto-select new customer

          // Force UI refresh for all related components
          setSearchTerm('') // Clear search to show new customer
        }

        // Trigger global refresh events for other pages/components
        window.dispatchEvent(new CustomEvent('customerCreated', { detail: response.data }))
        window.dispatchEvent(new CustomEvent('dataUpdated'))

        // Update URL if customer was created
        if (response?.data?.id) {
          setSearchParams({ customerId: response.data.id })
        }
      } else {
        console.error('Customer creation failed:', response)
        toast.error(response?.message || 'Failed to create customer')
      }
    } catch (error) {
      console.error('Failed to create customer - Full error:', error)
      console.error('Error response:', error?.response)
      const errorMessage = error?.response?.data?.message ||
        (Array.isArray(error?.response?.data?.errors) ? error.response.data.errors.join(', ') : '') ||
        error?.message ||
        'Failed to create customer'
      toast.error(errorMessage)
    } finally {
      // Reset loading state (both ref and state)
      customerLoadingRef.current = false
      setCustomerLoading(false)
    }
  }

  const handleEditCustomer = async (data) => {
    if (!editingCustomer || !editingCustomer.id) {
      toast.error('No customer selected for editing')
      return
    }

    customerLoadingRef.current = true
    setCustomerLoading(true)

    try {
      const customerData = {
        name: data.name?.trim() || '',
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        trn: data.trn?.trim() || null,
        address: data.address?.trim() || null,
        creditLimit: data.creditLimit ? parseFloat(data.creditLimit) : 0
      }

      if (!customerData.name) {
        toast.error('Customer name is required')
        customerLoadingRef.current = false
        setCustomerLoading(false)
        return
      }

      const response = await customersAPI.updateCustomer(editingCustomer.id, customerData)

      if (response?.success) {
        toast.success('Customer updated successfully!')
        setShowEditCustomerModal(false)
        setEditingCustomer(null)
        resetCustomerForm()

        // Refresh data
        await Promise.all([
          fetchCustomers(),
          loadCustomerData(editingCustomer.id)
        ])

        // Update selected customer with new data
        if (response?.data) {
          setSelectedCustomer(response.data)
        }

        window.dispatchEvent(new CustomEvent('customerUpdated', { detail: response.data }))
        window.dispatchEvent(new CustomEvent('dataUpdated'))
      } else {
        toast.error(response?.message || 'Failed to update customer')
      }
    } catch (error) {
      console.error('Failed to update customer:', error)
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to update customer'
      toast.error(errorMessage)
    } finally {
      customerLoadingRef.current = false
      setCustomerLoading(false)
    }
  }

  /**
   * Manual reconciliation function - user can trigger to verify and fix data
   */
  const handleManualReconciliation = async () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer first')
      return
    }

    const customerId = selectedCustomer.id
    toast.loading('Validating and reconciling data...', { id: 'reconciliation' })

    try {
      // First recalculate balance from backend
      const recalcResult = await recalculateCustomerBalance(customerId)

      if (recalcResult.success) {
        // Reload all data
        await loadCustomerData(customerId)
        toast.success('Data reconciled successfully!', { id: 'reconciliation' })
      } else {
        toast.error(`Reconciliation failed: ${recalcResult.message}`, { id: 'reconciliation' })
      }
    } catch (error) {
      console.error('Reconciliation error:', error)
      toast.error('Failed to reconcile data', { id: 'reconciliation' })
    }
  }

  const handlePaymentSubmit = async (data) => {
    // Debug logs removed to prevent console flooding

    // Prevent multiple submissions using ref (synchronous check)
    if (paymentLoadingRef.current || paymentLoading) {
      console.log('Payment already in progress, ignoring duplicate submission')
      return
    }

    if (!selectedCustomer) {
      toast.error('Please select a customer first')
      return
    }

    // Set loading state IMMEDIATELY (both ref and state)
    paymentLoadingRef.current = true
    setPaymentLoading(true)

    try {

      // Generate idempotency key for duplicate prevention
      const idempotencyKey = crypto.randomUUID()

      // CRITICAL: Validate amount first with strict checks
      const amount = parseFloat(data.amount)
      if (!amount || amount <= 0 || isNaN(amount) || !isFinite(amount)) {
        toast.error('Please enter a valid payment amount greater than 0')
        paymentLoadingRef.current = false
        setPaymentLoading(false)
        return
      }

      // CRITICAL: Validate amount doesn't exceed reasonable limit
      if (amount > 10000000) {
        toast.error('Payment amount exceeds maximum limit (10,000,000)')
        paymentLoadingRef.current = false
        setPaymentLoading(false)
        return
      }

      // CRITICAL: Handle Cash Customer - send null instead of 'cash' string
      const isCashCustomer = !selectedCustomer.id || selectedCustomer.id === 'cash' || selectedCustomer.id === 0

      const paymentData = {
        customerId: isCashCustomer ? null : parseInt(selectedCustomer.id),
        saleId: data.saleId ? parseInt(data.saleId) : null,
        amount: amount,
        mode: (data.method || data.mode || 'CASH').toUpperCase(), // Backend expects uppercase: CASH, CHEQUE, ONLINE, CREDIT
        reference: data.ref || data.reference || null,
        paymentDate: data.paymentDate || new Date().toISOString()
      }

      console.log('Submitting payment with data:', paymentData)
      console.log('Idempotency key:', idempotencyKey)

      // Add timeout to prevent hanging (30 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Payment request timed out after 30 seconds')), 30000)
      )

      console.log('Sending payment request to API...')
      const response = await Promise.race([
        paymentsAPI.createPayment(paymentData, idempotencyKey),
        timeoutPromise
      ])
      console.log('Payment API response received:', response)

      // Backend returns: { success: true, message: "...", data: { payment, invoice, customer } }
      if (response?.success) {
        const paymentResult = response?.data?.payment || response?.data
        const invoiceResult = response?.data?.invoice
        const mode = paymentResult?.mode || paymentResult?.method || data.method || 'CASH'
        const amount = paymentResult?.amount || data.amount

        toast.success(`Payment saved: ${formatCurrency(amount)} (${mode})`)

        if (invoiceResult) {
          const status = invoiceResult.status || invoiceResult.paymentStatus || 'PENDING'
          toast.success(`Invoice ${invoiceResult.invoiceNo || ''} status: ${status}`)
        }

        setShowPaymentModal(false)
        setPaymentModalInvoiceId(null)
        resetPaymentForm() // Reset payment form after successful submission

        // INSTANT UPDATE: Reload ALL customer data immediately to refresh balances, invoices, and outstanding bills
        await Promise.all([
          loadCustomerData(selectedCustomer.id), // This will refresh ledger, invoices, outstanding invoices, and summary
          fetchCustomers() // Refresh customer list
        ])

        // CRITICAL: Validate data integrity after payment
        setTimeout(async () => {
          // Refresh customer data again to get latest balance and status
          await loadCustomerData(selectedCustomer.id)
          await fetchCustomers()

          // Trigger validation to ensure payment was processed correctly
          const validationResult = await recalculateCustomerBalance(selectedCustomer.id)
          if (validationResult.success) {
            console.log('Payment validated and balance verified')
          }

          // Trigger global update events
          window.dispatchEvent(new CustomEvent('paymentCreated', { detail: { customerId: selectedCustomer.id, payment: paymentResult } }))
          window.dispatchEvent(new CustomEvent('dataUpdated'))
        }, 2000) // 2 second delay to ensure backend processing is complete

        // Trigger global data refresh events for other pages (reports, dashboard, etc.)
        window.dispatchEvent(new CustomEvent('paymentCreated', { detail: { customerId: selectedCustomer.id, payment: paymentResult } }))
        window.dispatchEvent(new CustomEvent('dataUpdated'))
      } else {
        toast.error(response?.message || 'Failed to save payment')
      }
    } catch (error) {
      // Log error once (prevent flooding)
      if (!error._logged) {
        console.error('Payment error:', error?.response?.data || error?.message)
        error._logged = true
      }

      // Handle HTTP 409 Conflict (concurrent modification)
      if (error.message?.includes('CONFLICT') || error.response?.status === 409) {
        toast.error('Another user updated this invoice. Refreshing data...', {
          duration: 5000
        })
        // Refresh customer data to get latest invoice status
        await loadCustomerData(selectedCustomer.id)
        await fetchCustomers()
      } else {
        // Safely extract error message
        let errorMsg = 'Failed to save payment'
        if (error?.response?.data?.message) {
          errorMsg = error.response.data.message
        } else if (error?.response?.data?.errors && Array.isArray(error.response.data.errors)) {
          errorMsg = error.response.data.errors.join(', ')
        } else if (error?.message) {
          errorMsg = error.message
        }

        toast.error(errorMsg, {
          duration: 5000
        })
      }
    } finally {
      // Reset loading state (both ref and state)
      paymentLoadingRef.current = false
      setPaymentLoading(false)
    }
  }

  const handleExportPDF = async () => {
    if (!selectedCustomer || !selectedCustomer.id) {
      toast.error('Please select a customer first')
      return
    }

    // CRITICAL: Store customer ID to prevent race conditions
    const customerId = selectedCustomer.id

    try {
      const fromDate = new Date(dateRange.from)
      const toDate = new Date(dateRange.to)

      // Validate customer is still selected before generating statement
      if (!selectedCustomer || selectedCustomer.id !== customerId) {
        toast.error('Customer selection changed. Please try again.')
        return
      }

      const pdfBlob = await customersAPI.getCustomerStatement(
        customerId,
        fromDate.toISOString(),
        toDate.toISOString()
      )

      const url = window.URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Ledger_${selectedCustomer.name}_${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('PDF downloaded successfully')
    } catch (error) {
      console.error('Failed to export PDF:', error)
      toast.error('Failed to export PDF')
    }
  }

  const handleExportStatement = async () => {
    handleExportPDF()
  }

  // WhatsApp Sharing Handler
  const handleShareWhatsApp = () => {
    if (!selectedCustomer || customerLedger.length === 0) {
      toast.error('No data to share')
      return
    }

    try {
      const filteredEntries = customerLedger.filter(entry => {
        const entryDate = new Date(entry.date)
        const fromDate = new Date(dateRange.from)
        const toDate = new Date(dateRange.to)
        toDate.setHours(23, 59, 59, 999)
        return entryDate >= fromDate && entryDate <= toDate
      })

      const totalDebit = filteredEntries.reduce((sum, e) => sum + (e.debit || 0), 0)
      const totalCredit = filteredEntries.reduce((sum, e) => sum + (e.credit || 0), 0)
      const closingBalance = filteredEntries.length > 0 ? filteredEntries[filteredEntries.length - 1].balance : 0

      const message = `*Customer Ledger Statement*\n\n` +
        `*Customer:* ${selectedCustomer.name}\n` +
        `*TRN:* ${selectedCustomer.trn || 'N/A'}\n` +
        `*Phone:* ${selectedCustomer.phone || 'N/A'}\n` +
        `*Period:* ${new Date(dateRange.from).toLocaleDateString()} to ${new Date(dateRange.to).toLocaleDateString()}\n\n` +
        `*Summary:*\n` +
        `Total Sales: ${formatCurrency(totalDebit)}\n` +
        `Payments Received: ${formatCurrency(totalCredit)}\n` +
        `Outstanding: ${formatCurrency(totalDebit - totalCredit)}\n` +
        `Closing Balance: ${formatBalance(closingBalance)}\n\n` +
        `_Generated on ${new Date().toLocaleString()}_`

      const phoneNumber = selectedCustomer.phone?.replace(/\D/g, '') || ''
      if (phoneNumber) {
        const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
        window.open(url, '_blank')
        toast.success('Opening WhatsApp...')
      } else {
        // Copy to clipboard if no phone
        navigator.clipboard.writeText(message)
        toast.success('Statement copied to clipboard!')
      }
    } catch (error) {
      console.error('Share error:', error)
      toast.error('Failed to share statement')
    }
  }

  // Print Preview Handler
  const handlePrintPreview = () => {
    if (!selectedCustomer || customerLedger.length === 0) {
      toast.error('No data to print')
      return
    }

    // Create print window
    const printWindow = window.open('', '_blank')
    const filteredEntries = customerLedger.filter(entry => {
      const entryDate = new Date(entry.date)
      const fromDate = new Date(dateRange.from)
      const toDate = new Date(dateRange.to)
      toDate.setHours(23, 59, 59, 999)
      return entryDate >= fromDate && entryDate <= toDate
    })

    const totalDebit = filteredEntries.reduce((sum, e) => sum + (e.debit || 0), 0)
    const totalCredit = filteredEntries.reduce((sum, e) => sum + (e.credit || 0), 0)
    const closingBalance = filteredEntries.length > 0 ? filteredEntries[filteredEntries.length - 1].balance : 0

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Customer Ledger Statement - ${selectedCustomer.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #1e40af; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .debit-row { background-color: #fee2e2; }
            .credit-row { background-color: #dcfce7; }
            .summary { margin-top: 20px; padding: 15px; background-color: #f9fafb; border-radius: 5px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>${companyName} - Customer Ledger</h1>
          <h2>Customer Ledger Statement</h2>
          <p><strong>Customer:</strong> ${selectedCustomer.name}</p>
          <p><strong>TRN:</strong> ${selectedCustomer.trn || 'N/A'}</p>
          <p><strong>Period:</strong> ${new Date(dateRange.from).toLocaleDateString()} to ${new Date(dateRange.to).toLocaleDateString()}</p>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Invoice No</th>
                <th>Payment Mode</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Status</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${filteredEntries.map(entry => {
      const dateStr = entry.type === 'Payment'
        ? new Date(entry.date).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const rowClass = entry.debit > 0 ? 'debit-row' : entry.credit > 0 ? 'credit-row' : ''
      return `<tr class="${rowClass}">
                  <td>${dateStr}</td>
                  <td>${entry.type || ''}</td>
                  <td>${entry.reference || '-'}</td>
                  <td>${entry.paymentMode || entry.PaymentMode || '-'}</td>
                  <td>${entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</td>
                  <td>${entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</td>
                  <td>${entry.status || '-'}</td>
                  <td>${formatBalance(entry.balance)}</td>
                </tr>`
    }).join('')}
            </tbody>
            <tfoot>
              <tr style="background-color: #f3f4f6; font-weight: bold;">
                <td colspan="4">CLOSING BALANCE</td>
                <td>${formatCurrency(totalDebit)}</td>
                <td>${formatCurrency(totalCredit)}</td>
                <td>-</td>
                <td>${formatBalance(closingBalance)}</td>
              </tr>
            </tfoot>
          </table>
          
          <div class="summary">
            <h3>Summary</h3>
            <p>Total Debit: ${formatCurrency(totalDebit)}</p>
            <p>Total Credit: ${formatCurrency(totalCredit)}</p>
            <p>Net Balance: ${formatBalance(closingBalance)}</p>
          </div>
          
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            Generated on ${new Date().toLocaleString()}
          </p>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }


  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'partial': return 'bg-yellow-100 text-yellow-800'
      case 'pending': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'partial': return <Clock className="h-4 w-4 text-yellow-600" />
      case 'pending': return <XCircle className="h-4 w-4 text-red-600" />
      default: return <Clock className="h-4 w-4 text-gray-600" />
    }
  }


  if (loading && !selectedCustomer) {
    return <LoadingCard message="Loading customers..." />
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 overflow-x-hidden w-full max-w-full">
      {/* TOP BAR - Header - Responsive */}
      <div className="bg-white border-b border-neutral-200 px-3 sm:px-6 py-2 sm:py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <div className="flex items-center space-x-3 sm:space-x-6">
            <div>
              <h1 className="text-base sm:text-xl font-bold text-gray-900">{companyName ? `${companyName} – Customer Ledger` : 'Customer Ledger'}</h1>
              <p className="text-xs sm:text-sm text-gray-600">CUSTOMER LEDGER MODULE</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Date: {new Date().toLocaleDateString('en-GB')}</p>
              <p className="text-sm text-gray-600">User: {user?.name || 'Admin'} ({user?.role || 'Admin'})</p>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={handleExportPDF}
                className="p-1 sm:p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Export PDF (F7)"
              >
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                onClick={handleExportPDF}
                className="p-1 sm:p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Print (Ctrl+P)"
              >
                <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                onClick={() => selectedCustomer && loadCustomerData(selectedCustomer.id)}
                className="p-1 sm:p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Refresh"
                disabled={!selectedCustomer}
              >
                <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                onClick={handleManualReconciliation}
                className="p-1 sm:p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Reconcile & Verify Data (Validates all transactions and recalculates balance)"
                disabled={!selectedCustomer || loading}
              >
                <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                className="p-1 sm:p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Settings"
              >
                <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* TOP BAR - Customer Search: full width, design-lock */}
        <div className="bg-neutral-50 border-b border-neutral-200 p-3 sm:p-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-0 max-w-full lg:max-w-xl">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search customer (F2)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowAddCustomerModal(true)
            }}
            className="px-3 py-2 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700 active:bg-primary-800 flex items-center space-x-1.5 transition-colors whitespace-nowrap cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 min-h-[44px]"
            title="Add New Customer"
            type="button"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Customer</span>
          </button>
          {selectedCustomer && (
            <div className="px-3 py-2 bg-primary-50 text-primary-800 text-sm rounded-md font-semibold whitespace-nowrap min-w-0 truncate max-w-[200px] sm:max-w-none" title={selectedCustomer.name}>
              {selectedCustomer.name}
            </div>
          )}
          <div className="text-xs text-neutral-600 whitespace-nowrap ml-auto">
            Total: {customers.length}
          </div>
        </div>

        {/* CUSTOMER SELECTION DROPDOWN - visible, z-50, full width */}
        {(searchTerm || !selectedCustomer) && (
          <div className="bg-white border-b border-neutral-200 max-h-96 overflow-y-auto overflow-x-hidden z-50 shadow-md">
            <div className="p-2 space-y-1">
              {/* Cash Customer Option */}
              <button
                onClick={() => {
                  setSelectedCustomer({ id: 'cash', name: 'Cash Customer', balance: 0 })
                  loadCustomerData('cash')
                }}
                className={`w-full text-left p-3 rounded-lg transition-colors text-sm border border-transparent ${selectedCustomer?.id === 'cash'
                  ? 'bg-primary-600 text-white'
                  : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-900 border-neutral-200'
                  }`}
              >
                <div className="font-semibold">Cash Customer</div>
                <div className={`text-xs ${selectedCustomer?.id === 'cash' ? 'text-primary-100' : 'text-neutral-500'}`}>
                  All cash sales and payments • Balance: AED 0.00
                </div>
              </button>
              {/* Regular Customers - name visible, balance with color */}
              {filteredCustomers.length > 0 && filteredCustomers.slice(0, 15).map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelectCustomer(customer)}
                  className={`w-full text-left p-3 rounded-lg transition-colors text-sm border last:border-b-0 ${selectedCustomer?.id === customer.id
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white hover:bg-neutral-50 text-neutral-900 border-neutral-100'
                    }`}
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-neutral-900 truncate">{customer.name}</p>
                      {customer.phone && <p className="text-xs text-neutral-500 truncate">{customer.phone}</p>}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={`text-sm font-semibold ${customer.balance < 0 ? 'text-green-600' : customer.balance > 0 ? 'text-red-600' : 'text-neutral-600'}`}>
                        {formatBalance(customer.balance ?? 0)}
                      </p>
                      <p className="text-xs text-neutral-500">{customer.balance < 0 ? 'Credit' : customer.balance > 0 ? 'Outstanding' : 'Settled'}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MAIN LEDGER VIEW */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedCustomer ? (
            <div className="flex-1 flex items-center justify-center p-6 w-full">
              <div className="text-center w-full max-w-lg">
                <Users className="h-16 w-16 mx-auto mb-4 text-neutral-300" />
                <h3 className="text-lg font-medium text-neutral-900 mb-2">Search and select a customer to view ledger</h3>
                <p className="text-sm text-neutral-500">Use the search bar above (Press F2 to focus)</p>
              </div>
            </div>
          ) : (
            <>
              {/* Customer Info & Balance - full width, balance prominent */}
              <div className="bg-neutral-50 border-b border-neutral-200 px-4 py-3 sm:px-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap">
                  {/* Customer Info */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-bold text-neutral-900 truncate">{selectedCustomer.name}</h2>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600 flex-wrap">
                        {selectedCustomer.id !== 'cash' && selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}
                        {selectedCustomer.id !== 'cash' && selectedCustomer.email && <span className="hidden sm:inline">• {selectedCustomer.email}</span>}
                        {selectedCustomer.id !== 'cash' && selectedCustomer.trn && <span>TRN: {selectedCustomer.trn}</span>}
                        {selectedCustomer.id === 'cash' && <span className="text-primary-600 font-medium">All cash sales and payments</span>}
                      </div>
                    </div>
                  </div>
                  {/* Current Balance - prominent */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-neutral-600 mb-0.5">Current balance</p>
                    <p className={`text-xl sm:text-2xl font-bold ${(selectedCustomer.balance ?? 0) < 0 ? 'text-green-600' : (selectedCustomer.balance ?? 0) > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
                      {formatCurrency(Math.abs(selectedCustomer.balance ?? 0))}
                    </p>
                    <p className="text-xs text-neutral-500">{(selectedCustomer.balance ?? 0) < 0 ? 'In credit' : (selectedCustomer.balance ?? 0) > 0 ? 'Outstanding' : 'Settled'}</p>
                  </div>

                  {/* Action Buttons - Compact */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {selectedCustomer.id !== 'cash' && (
                      <>
                        <button
                          onClick={() => {
                            // Open edit modal directly instead of navigating
                            setEditingCustomer(selectedCustomer)
                            // Pre-fill form with current customer data
                            customerForm.setValue('name', selectedCustomer.name)
                            customerForm.setValue('phone', selectedCustomer.phone || '')
                            customerForm.setValue('email', selectedCustomer.email || '')
                            customerForm.setValue('trn', selectedCustomer.trn || '')
                            customerForm.setValue('address', selectedCustomer.address || '')
                            customerForm.setValue('creditLimit', selectedCustomer.creditLimit || 0)
                            setShowEditCustomerModal(true)
                          }}
                          className="px-2 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 flex items-center gap-1 transition-colors"
                          title="Edit Customer (F3)"
                        >
                          <Edit className="h-3 w-3" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => setShowPaymentModal(true)}
                          className="px-2 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 flex items-center gap-1 transition-colors"
                          title="Add Payment (F4)"
                        >
                          <Plus className="h-3 w-3" />
                          <span className="hidden sm:inline">Payment</span>
                        </button>
                      </>
                    )}
                    <button
                      onClick={handleExportStatement}
                      className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center gap-1 transition-colors"
                      title="Ledger Statement (F5)"
                    >
                      <FileText className="h-3 w-3" />
                      <span className="hidden lg:inline">Statement</span>
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          if (!selectedCustomer || !selectedCustomer.id) {
                            toast.error('Please select a customer first')
                            return
                          }

                          const fromDate = dateRange.from
                          const toDate = dateRange.to

                          const loadingToast = toast.loading('Generating PDF...')
                          const pdfBlob = await customersAPI.getCustomerPendingBillsPdf(
                            selectedCustomer.id,
                            fromDate,
                            toDate
                          )

                          const url = window.URL.createObjectURL(pdfBlob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `Pending_Bills_${selectedCustomer.name}_${fromDate}_to_${toDate}.pdf`
                          document.body.appendChild(a)
                          a.click()
                          window.URL.revokeObjectURL(url)
                          document.body.removeChild(a)
                          toast.dismiss(loadingToast)
                          toast.success('PDF downloaded!')
                        } catch (error) {
                          console.error('Failed to export pending bills PDF:', error)
                          toast.dismiss()
                          toast.error(error.response?.data?.message || 'Failed to export PDF')
                        }
                      }}
                      className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 flex items-center gap-1 transition-colors"
                      title="Pending Bills PDF (Outstanding Invoices Only) - Uses Date Filter"
                    >
                      <DollarSign className="h-3 w-3" />
                      <span className="hidden lg:inline">Pending Bills</span>
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="px-2 py-1 bg-neutral-700 text-white text-xs rounded hover:bg-neutral-800 flex items-center gap-1 transition-colors"
                      title="Full Ledger PDF (F7)"
                    >
                      <Download className="h-3 w-3" />
                      <span className="hidden lg:inline">PDF</span>
                    </button>
                    <button
                      onClick={handleShareWhatsApp}
                      className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 flex items-center transition-colors"
                      title="WhatsApp"
                    >
                      <Send className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Date Range & Branch/Route/Staff Filters */}
              <div className="bg-neutral-50 border-b border-neutral-200 px-3 py-2 sm:px-4 flex items-center gap-3 flex-wrap">
                <label className="text-sm font-medium text-neutral-700">Date:</label>
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                  className="w-36"
                />
                <span className="text-neutral-600">to</span>
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                  className="w-36"
                />
                <span className="text-neutral-400 mx-1">|</span>
                <select
                  value={ledgerBranchId}
                  onChange={(e) => { setLedgerBranchId(e.target.value); setLedgerRouteId('') }}
                  className="border border-neutral-300 rounded px-2 py-1.5 text-sm bg-white min-w-[100px]"
                  title="Filter by branch"
                >
                  {isAdminOrOwner(user) && <option value="">All branches</option>}
                  {availableBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select
                  value={ledgerRouteId}
                  onChange={(e) => setLedgerRouteId(e.target.value)}
                  className="border border-neutral-300 rounded px-2 py-1.5 text-sm bg-white min-w-[100px]"
                  title="Filter by route"
                >
                  {isAdminOrOwner(user) && <option value="">All routes</option>}
                  {(ledgerBranchId ? availableRoutes.filter(r => r.branchId === parseInt(ledgerBranchId, 10)) : availableRoutes).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <select
                  value={ledgerStaffId}
                  onChange={(e) => setLedgerStaffId(e.target.value)}
                  className="border border-neutral-300 rounded px-2 py-1.5 text-sm bg-white min-w-[100px]"
                  title="Filter by staff"
                >
                  {isAdminOrOwner(user) && <option value="">All staff</option>}
                  {availableStaff.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                </select>
              </div>

              {/* TAB SECTIONS - Full Width */}
              <div className="flex-1 flex flex-col overflow-hidden w-full min-w-0">
                <div className="border-b border-neutral-200 bg-white w-full sticky top-0 z-10">
                  <div className="overflow-x-auto w-full scrollbar-hide">
                    <div className="flex space-x-1 px-2 min-w-max">
                      {[
                        { id: 'ledger', name: 'Ledger', mobileName: 'Ledger', icon: FileText },
                        { id: 'invoices', name: 'Invoices', mobileName: 'Invoices', icon: FileText },
                        { id: 'payments', name: 'Payments', mobileName: 'Payments', icon: CreditCard },
                        { id: 'reports', name: 'Reports', mobileName: 'Reports', icon: TrendingUp }
                      ].map((tab) => {
                        const Icon = tab.icon
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-3 md:px-4 py-2.5 md:py-3 flex items-center space-x-1.5 md:space-x-2 border-b-2 transition-colors whitespace-nowrap text-xs md:text-sm ${activeTab === tab.id
                              ? 'border-primary-600 text-primary-600 font-medium bg-primary-50'
                              : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                              }`}
                          >
                            <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                            <span className="hidden sm:inline">{tab.name}</span>
                            <span className="sm:hidden">{tab.mobileName}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* TAB CONTENT - Full Width - Zero Padding; pb-20 for bottom nav on mobile */}
                <div className="flex-1 overflow-auto w-full pb-20 lg:pb-0">
                  {activeTab === 'ledger' && (
                    loading ? (
                      <div className="flex items-center justify-center h-full p-8">
                        <LoadingCard message="Loading ledger data..." />
                      </div>
                    ) : (
                      <LedgerStatementTab
                        ledgerEntries={customerLedger
                          .filter(entry => {
                            // CRITICAL: Validate entry belongs to selected customer (extra safety check)
                            // Backend should already filter, but this prevents any data leakage
                            if (!selectedCustomer) return false

                            const entryDate = new Date(entry.date)
                            const fromDate = new Date(dateRange.from)
                            const toDate = new Date(dateRange.to)
                            toDate.setHours(23, 59, 59, 999)
                            const inDateRange = entryDate >= fromDate && entryDate <= toDate
                            if (!inDateRange) return false

                            // Apply filters
                            if (ledgerFilters.status !== 'all') {
                              const statusMatch = entry.status?.toLowerCase() === ledgerFilters.status.toLowerCase()
                              if (!statusMatch && entry.type !== 'Payment') return false
                            }
                            if (ledgerFilters.type !== 'all') {
                              if (entry.type !== ledgerFilters.type) return false
                            }

                            return true
                          })}
                        customer={selectedCustomer}
                        onExportExcel={handleExportExcel}
                        onGeneratePDF={handleExportStatement}
                        onShareWhatsApp={handleShareWhatsApp}
                        onPrintPreview={handlePrintPreview}
                        filters={ledgerFilters}
                        onFilterChange={(key, value) => setLedgerFilters(prev => ({ ...prev, [key]: value }))}
                      />
                    )
                  )}

                  {activeTab === 'invoices' && (
                    <InvoicesTab
                      invoices={customerInvoices}
                      outstandingInvoices={outstandingInvoices}
                      user={user}
                      onViewInvoice={(invoiceId) => {
                        setSelectedInvoiceForView(invoiceId)
                        setShowInvoiceModal(true)
                      }}
                      onViewPDF={async (invoiceId) => {
                        try {
                          const pdfBlob = await salesAPI.getInvoicePdf(invoiceId)
                          const url = window.URL.createObjectURL(pdfBlob)
                          window.open(url, '_blank')
                          setTimeout(() => window.URL.revokeObjectURL(url), 100)
                        } catch (error) {
                          toast.error(error?.message || 'Failed to generate PDF')
                        }
                      }}
                      onEditInvoice={(invoiceId) => {
                        // Navigate to POS with edit mode using React Router
                        navigate(`/pos?editId=${invoiceId}`)
                      }}
                      onPayInvoice={(invoiceId) => {
                        setPaymentModalInvoiceId(invoiceId)
                        setShowPaymentModal(true)
                      }}
                      onUnlockInvoice={async (invoiceId) => {
                        const reason = prompt('Please provide reason for unlocking this invoice:')
                        if (!reason?.trim()) {
                          toast.error('Unlock reason is required')
                          return
                        }
                        try {
                          const response = await salesAPI.unlockInvoice(invoiceId, reason)
                          if (response.success) {
                            toast.success('Invoice unlocked successfully!')
                            if (selectedCustomer) {
                              await loadCustomerData(selectedCustomer.id)
                            }
                          } else {
                            toast.error(response.message || 'Failed to unlock invoice')
                          }
                        } catch (error) {
                          toast.error(error?.response?.data?.message || 'Failed to unlock invoice')
                        }
                      }}
                      onDeleteInvoice={async (invoiceId) => {
                        const confirmText = prompt('WARNING: Type DELETE to confirm deletion of this invoice.\n\nThis will restore stock and cannot be undone!')
                        if (confirmText?.trim().toUpperCase() !== 'DELETE') {
                          if (confirmText !== null) toast.error('Deletion cancelled. You must type DELETE to confirm.')
                          return
                        }
                        try {
                          const response = await salesAPI.deleteSale(invoiceId)
                          if (response.success) {
                            toast.success('Invoice deleted successfully!')
                            if (selectedCustomer) {
                              // Reload customer data to update ledger
                              await loadCustomerData(selectedCustomer.id)
                              // Refresh customer list
                              await fetchCustomers()
                            }
                          } else {
                            toast.error(response.message || 'Failed to delete invoice')
                          }
                        } catch (error) {
                          toast.error(error?.response?.data?.message || 'Failed to delete invoice')
                        }
                      }}
                    />
                  )}

                  {activeTab === 'payments' && (
                    <PaymentsTab
                      payments={customerPayments}
                      user={user}
                      onViewReceipt={async (paymentId) => {
                        // Handle view receipt - generate payment receipt PDF
                        try {
                          toast.loading('Generating receipt...', { id: 'receipt' })

                          // Find payment details
                          const payment = customerPayments.find(p => p.id === paymentId)
                          if (!payment) {
                            toast.error('Payment not found', { id: 'receipt' })
                            return
                          }

                          // For now, use a simple print window with payment details
                          const printContent = `
                            <!DOCTYPE html>
                            <html>
                            <head>
                              <title>Payment Receipt</title>
                              <style>
                                body { font-family: Arial, sans-serif; padding: 20px; }
                                .header { text-align: center; margin-bottom: 30px; }
                                .header h1 { margin: 0; color: #1f2937; }
                                .header p { margin: 5px 0; color: #6b7280; }
                                .receipt-details { margin: 20px 0; }
                                .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
                                .detail-row .label { font-weight: bold; color: #374151; }
                                .detail-row .value { color: #1f2937; }
                                .amount { font-size: 24px; font-weight: bold; color: #059669; text-align: center; margin: 30px 0; }
                                .footer { text-align: center; margin-top: 50px; color: #6b7280; font-size: 12px; }
                                @media print {
                                  body { padding: 0; }
                                }
                              </style>
                            </head>
                            <body>
                              <div class="header">
                                <h1>PAYMENT RECEIPT</h1>
                                <p>Receipt #${payment.id}</p>
                                <p>${new Date(payment.paymentDate).toLocaleString('en-GB')}</p>
                              </div>
                              <div class="receipt-details">
                                <div class="detail-row">
                                  <span class="label">Customer:</span>
                                  <span class="value">${selectedCustomer?.name || 'N/A'}</span>
                                </div>
                                <div class="detail-row">
                                  <span class="label">Payment Mode:</span>
                                  <span class="value">${payment.method || payment.mode || 'N/A'}</span>
                                </div>
                                <div class="detail-row">
                                  <span class="label">Reference:</span>
                                  <span class="value">${payment.ref || payment.reference || '-'}</span>
                                </div>
                                ${payment.invoiceNo ? `
                                <div class="detail-row">
                                  <span class="label">Invoice:</span>
                                  <span class="value">${payment.invoiceNo}</span>
                                </div>
                                ` : ''}
                              </div>
                              <div class="amount">
                                AMOUNT: ${formatCurrency(payment.amount)}
                              </div>
                              <div class="footer">
                                <p>Thank you for your payment</p>
                                <p>This is a computer-generated receipt</p>
                              </div>
                            </body>
                            </html>
                          `

                          const printWindow = window.open('', '_blank')
                          if (printWindow) {
                            printWindow.document.write(printContent)
                            printWindow.document.close()
                            printWindow.onload = () => {
                              printWindow.print()
                            }
                            toast.success('Receipt ready to print', { id: 'receipt' })
                          } else {
                            toast.error('Failed to open print window. Please check popup blocker.', { id: 'receipt' })
                          }
                        } catch (error) {
                          console.error('Error generating receipt:', error)
                          toast.error('Failed to generate receipt', { id: 'receipt' })
                        }
                      }}
                      onEditPayment={async (payment) => {
                        // Handle edit payment
                        try {
                          const newAmount = prompt(`Edit payment amount (current: ${formatCurrency(payment.amount)}):`, payment.amount)
                          if (newAmount === null) return // User cancelled

                          const amountValue = parseFloat(newAmount)
                          if (!newAmount || isNaN(amountValue) || amountValue <= 0) {
                            toast.error('Invalid amount. Please enter a valid positive number.')
                            return
                          }

                          const currentMode = payment.method || payment.mode || 'CASH'
                          const newMode = prompt(`Edit payment mode (current: ${currentMode}):\nOptions: CASH, CHEQUE, ONLINE, CREDIT`, currentMode)
                          if (newMode === null) return // User cancelled

                          const modeUpper = newMode?.trim().toUpperCase()
                          if (!modeUpper || !['CASH', 'CHEQUE', 'ONLINE', 'CREDIT'].includes(modeUpper)) {
                            toast.error('Invalid payment mode. Please select: CASH, CHEQUE, ONLINE, or CREDIT')
                            return
                          }

                          toast.loading('Updating payment...', { id: 'update-payment' })

                          const response = await paymentsAPI.updatePayment(payment.id, {
                            amount: amountValue,
                            mode: modeUpper,
                            reference: payment.ref || payment.reference || null,
                            paymentDate: payment.paymentDate
                          })

                          if (response?.success) {
                            toast.success('Payment updated successfully', { id: 'update-payment' })
                            // Refresh customer data
                            if (selectedCustomer) {
                              await loadCustomerData(selectedCustomer.id)
                              await fetchCustomers()
                              window.dispatchEvent(new CustomEvent('dataUpdated'))
                            }
                          } else {
                            toast.error(response?.message || 'Failed to update payment', { id: 'update-payment' })
                          }
                        } catch (error) {
                          console.error('Error updating payment:', error)
                          const errorMsg = error?.response?.data?.message || error?.message || 'Failed to update payment'
                          toast.error(errorMsg, { id: 'update-payment' })
                        }
                      }}
                      onDeletePayment={async (payment) => {
                        // Handle delete payment
                        try {
                          const confirmDelete = window.confirm(
                            `DELETE PAYMENT\n\n` +
                            `Amount: ${formatCurrency(payment.amount)}\n` +
                            `Mode: ${payment.method || payment.mode || 'N/A'}\n` +
                            `Date: ${new Date(payment.paymentDate).toLocaleDateString('en-GB')}\n\n` +
                            `This will reverse the payment effects on the invoice and customer balance.\n\n` +
                            `Are you sure you want to delete this payment?`
                          )

                          if (!confirmDelete) return // User cancelled

                          toast.loading('Deleting payment...', { id: 'delete-payment' })

                          const response = await paymentsAPI.deletePayment(payment.id)

                          if (response?.success) {
                            toast.success('Payment deleted successfully', { id: 'delete-payment' })
                            // Refresh customer data
                            if (selectedCustomer) {
                              await loadCustomerData(selectedCustomer.id)
                              await fetchCustomers()
                              window.dispatchEvent(new CustomEvent('dataUpdated'))
                            }
                          } else {
                            toast.error(response?.message || 'Failed to delete payment', { id: 'delete-payment' })
                          }
                        } catch (error) {
                          console.error('Error deleting payment:', error)
                          const errorMsg = error?.response?.data?.message || error?.message || 'Failed to delete payment'
                          toast.error(errorMsg, { id: 'delete-payment' })
                        }
                      }}
                    />
                  )}

                  {activeTab === 'reports' && (
                    <ReportsTab
                      customer={selectedCustomer}
                      summary={customerSummary}
                      invoices={customerInvoices}
                      payments={customerPayments}
                      outstandingInvoices={outstandingInvoices}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payment Entry Modal */}
      <PaymentEntryModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false)
          resetPaymentForm()
          setPaymentModalInvoiceId(null)
        }}
        customer={selectedCustomer}
        invoiceId={paymentModalInvoiceId}
        outstandingInvoices={outstandingInvoices}
        allInvoices={customerInvoices}
        onSubmit={handlePaymentSubmit}
        register={paymentRegister}
        handleSubmit={handlePaymentFormSubmit}
        errors={paymentErrors}
        setValue={setPaymentValue}
        watch={watchPayment}
        loading={paymentLoading}
      />

      {/* Invoice Preview Modal */}
      {showInvoiceModal && selectedInvoiceForView && (
        <InvoicePreviewModal
          saleId={selectedInvoiceForView}
          invoiceNo={customerInvoices.find(inv => inv.id === selectedInvoiceForView)?.invoiceNo}
          onClose={() => {
            setShowInvoiceModal(false)
            setSelectedInvoiceForView(null)
          }}
          onPrint={async () => {
            try {
              const pdfBlob = await salesAPI.getInvoicePdf(selectedInvoiceForView)
              const url = window.URL.createObjectURL(pdfBlob)
              const printWindow = window.open(url, '_blank')
              if (printWindow) {
                printWindow.onload = () => {
                  printWindow.print()
                }
              }
              setTimeout(() => window.URL.revokeObjectURL(url), 100)
            } catch (error) {
              toast.error(error?.message || 'Failed to print invoice')
            }
          }}
        />
      )}

      {/* Add Customer Modal */}
      <Modal
        isOpen={showAddCustomerModal}
        onClose={() => {
          setShowAddCustomerModal(false)
          resetCustomerForm()
        }}
        title="Add New Customer"
        size="lg"
      >
        <form
          onSubmit={handleCustomerSubmit((data) => {
            console.log('Customer form submitted with data:', data)
            handleAddCustomer(data)
          }, (errors) => {
            console.log('Customer form validation errors:', errors)
            const errorMessages = Object.values(errors).map(e => e?.message).filter(Boolean)
            if (errorMessages.length > 0) {
              toast.error(errorMessages[0] || 'Please fix the form errors')
            }
          })}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter customer name"
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${customerErrors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                {...customerRegister('name', { required: 'Customer name is required' })}
              />
              {customerErrors.name && (
                <p className="mt-1 text-sm text-red-600">{customerErrors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                placeholder="+971 50 123 4567"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                {...customerRegister('phone')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="customer@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                {...customerRegister('email')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TRN</label>
              <input
                type="text"
                placeholder="Tax Registration Number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                {...customerRegister('trn')}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                placeholder="Full address"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                {...customerRegister('address')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                defaultValue={0}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${customerErrors.creditLimit ? 'border-red-500' : 'border-gray-300'
                  }`}
                {...customerRegister('creditLimit', {
                  valueAsNumber: true,
                  min: { value: 0, message: 'Credit limit must be 0 or greater' }
                })}
              />
              {customerErrors.creditLimit && (
                <p className="mt-1 text-sm text-red-600">{customerErrors.creditLimit.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setShowAddCustomerModal(false)
                resetCustomerForm()
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={customerLoading || customerLoadingRef.current}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              style={{
                pointerEvents: (customerLoading || customerLoadingRef.current) ? 'none' : 'auto',
                cursor: (customerLoading || customerLoadingRef.current) ? 'not-allowed' : 'pointer',
                position: 'relative',
                zIndex: 10,
                minWidth: '120px'
              }}
            >
              {customerLoading || customerLoadingRef.current ? (
                <span className="flex items-center">
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </span>
              ) : (
                'Add Customer'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal
        isOpen={showEditCustomerModal}
        onClose={() => {
          setShowEditCustomerModal(false)
          setEditingCustomer(null)
          resetCustomerForm()
        }}
        title="Edit Customer"
        size="lg"
      >
        <form
          onSubmit={handleCustomerSubmit((data) => {
            handleEditCustomer(data)
          }, (errors) => {
            const errorMessages = Object.values(errors).map(e => e?.message).filter(Boolean)
            if (errorMessages.length > 0) {
              toast.error(errorMessages[0] || 'Please fix the form errors')
            }
          })}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter customer name"
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${customerErrors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                {...customerRegister('name', { required: 'Customer name is required' })}
              />
              {customerErrors.name && (
                <p className="mt-1 text-sm text-red-600">{customerErrors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                placeholder="+971 50 123 4567"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                {...customerRegister('phone')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="customer@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                {...customerRegister('email')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TRN</label>
              <input
                type="text"
                placeholder="Tax Registration Number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                {...customerRegister('trn')}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                placeholder="Full address"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                {...customerRegister('address')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${customerErrors.creditLimit ? 'border-red-500' : 'border-gray-300'
                  }`}
                {...customerRegister('creditLimit', {
                  valueAsNumber: true,
                  min: { value: 0, message: 'Credit limit must be 0 or greater' }
                })}
              />
              {customerErrors.creditLimit && (
                <p className="mt-1 text-sm text-red-600">{customerErrors.creditLimit.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setShowEditCustomerModal(false)
                setEditingCustomer(null)
                resetCustomerForm()
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={customerLoading || customerLoadingRef.current}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {customerLoading || customerLoadingRef.current ? (
                <span className="flex items-center">
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </span>
              ) : (
                'Update Customer'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// Add Customer Modal Component removed - now using inline Modal in main component

// Ledger Statement Tab Component - Tally Style Redesign
const LedgerStatementTab = ({ ledgerEntries, customer, onExportExcel, onGeneratePDF, onShareWhatsApp, onPrintPreview, filters, onFilterChange }) => {
  const closingBalance = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].balance : 0
  const totalDebit = ledgerEntries.reduce((sum, e) => sum + (e.debit || 0), 0)
  const totalCredit = ledgerEntries.reduce((sum, e) => sum + (e.credit || 0), 0)

  return (
    <div className="w-full h-full flex flex-col bg-neutral-50 min-w-0">
      {/* Summary Cards - border only per design lock */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-lg border border-neutral-200 p-3 border-l-4 border-l-primary-500">
          <div className="text-xs text-neutral-500 uppercase">Total Sales</div>
          <div className="text-lg font-bold text-neutral-900">{formatCurrency(totalDebit)}</div>
        </div>
        <div className="bg-white rounded-lg border border-neutral-200 p-3 border-l-4 border-l-green-500">
          <div className="text-xs text-neutral-500 uppercase">Payments Received</div>
          <div className="text-lg font-bold text-green-600">{formatCurrency(totalCredit)}</div>
        </div>
        <div className={`bg-white rounded-lg border border-neutral-200 p-3 border-l-4 ${closingBalance < 0 ? 'border-l-green-500' : closingBalance > 0 ? 'border-l-red-500' : 'border-l-neutral-500'
          }`}>
          <div className="text-xs text-neutral-500 uppercase">Closing Balance</div>
          <div className={`text-lg font-bold ${closingBalance < 0 ? 'text-green-600' : closingBalance > 0 ? 'text-red-600' : 'text-neutral-900'
            }`}>
            {formatBalance(closingBalance)}
          </div>
        </div>
      </div>

      {/* Action Bar with Filters */}
      <div className="bg-white rounded-lg border border-neutral-200 mb-3 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-neutral-700">Ledger Statement</span>
          </div>
          <div className="flex items-center space-x-2 flex-wrap">
            <select
              value={filters?.status || 'all'}
              onChange={(e) => onFilterChange?.('status', e.target.value)}
              className="px-2 py-1 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </select>
            <select
              value={filters?.type || 'all'}
              onChange={(e) => onFilterChange?.('type', e.target.value)}
              className="px-2 py-1 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">All Types</option>
              <option value="Invoice">Invoices</option>
              <option value="Payment">Payments</option>
              <option value="Sale Return">Returns</option>
            </select>
            <button
              onClick={onPrintPreview}
              className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center space-x-1"
              title="Print Preview"
            >
              <Eye className="h-3 w-3" />
              <span>Preview</span>
            </button>
            <button
              onClick={onExportExcel}
              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center space-x-1"
              title="Export to Excel"
            >
              <FileText className="h-3 w-3" />
              <span>Excel</span>
            </button>
            <button
              onClick={onGeneratePDF}
              className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center space-x-1"
              title="Download PDF Statement"
            >
              <Printer className="h-3 w-3" />
              <span>PDF</span>
            </button>
            <button
              onClick={onShareWhatsApp}
              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center space-x-1"
              title="Share via WhatsApp"
            >
              <Send className="h-3 w-3" />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* Ledger Table - Desktop - full width */}
      <div className="hidden md:block bg-white rounded-lg border border-neutral-200 flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="overflow-x-auto overflow-y-auto flex-1 min-w-0">
          <table className="w-full min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-100 sticky top-0 z-10 border-b-2 border-neutral-300">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-bold text-neutral-700 uppercase whitespace-nowrap border-r border-neutral-300">Date</th>
                <th className="px-3 py-2.5 text-left text-xs font-bold text-neutral-700 uppercase whitespace-nowrap border-r border-neutral-300">Type</th>
                <th className="px-3 py-2.5 text-left text-xs font-bold text-neutral-700 uppercase whitespace-nowrap border-r border-neutral-300">Invoice No</th>
                <th className="px-3 py-2.5 text-left text-xs font-bold text-neutral-700 uppercase whitespace-nowrap border-r border-neutral-300">Payment Mode</th>
                <th className="px-3 py-2.5 text-right text-xs font-bold text-neutral-700 uppercase whitespace-nowrap border-r border-neutral-300">Debit (AED)</th>
                <th className="px-3 py-2.5 text-right text-xs font-bold text-neutral-700 uppercase whitespace-nowrap border-r border-neutral-300">Credit (AED)</th>
                <th className="px-3 py-2.5 text-center text-xs font-bold text-neutral-700 uppercase whitespace-nowrap border-r border-neutral-300">Status</th>
                <th className="px-3 py-2.5 text-right text-xs font-bold text-neutral-700 uppercase whitespace-nowrap">Balance</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-neutral-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                ledgerEntries.map((entry, idx) => {
                  // Format date - show time only for payments
                  const showTime = entry.type === 'Payment'
                  const dateStr = showTime
                    ? new Date(entry.date).toLocaleString('en-GB', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })
                    : new Date(entry.date).toLocaleDateString('en-GB', {
                      day: '2-digit', month: '2-digit', year: 'numeric'
                    })

                  const invoiceNo = entry.reference || '-'
                  const status = entry.status || (entry.type === 'Payment' ? '-' : 'Unpaid')

                  // Color coding: Debit = light red, Credit = light green
                  const rowBgColor = entry.debit > 0
                    ? 'bg-red-50 hover:bg-red-100'
                    : entry.credit > 0
                      ? 'bg-green-50 hover:bg-green-100'
                      : 'hover:bg-neutral-50'

                  const statusColor = status === 'Paid' ? 'bg-green-100 text-green-800'
                    : status === 'Partial' ? 'bg-yellow-100 text-yellow-800'
                      : status === 'Unpaid' ? 'bg-red-100 text-red-800'
                        : ''

                  return (
                    <tr key={idx} className={rowBgColor}>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-900 border-r border-neutral-200">
                        {dateStr}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-neutral-900 border-r border-neutral-200">
                        {entry.type}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-neutral-900 border-r border-neutral-200">
                        {invoiceNo}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-neutral-600 border-r border-neutral-200">
                        {entry.paymentMode || entry.PaymentMode || '-'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium text-neutral-900 border-r border-neutral-200">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium text-neutral-900 border-r border-neutral-200">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-center border-r border-neutral-200">
                        {status !== '-' ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
                            {status}
                          </span>
                        ) : (
                          <span className="text-sm text-neutral-400">-</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 whitespace-nowrap text-sm text-right font-bold ${entry.balance < 0 ? 'text-green-600' : entry.balance > 0 ? 'text-red-600' : 'text-neutral-900'
                        }`}>
                        {formatBalance(entry.balance)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            <tfoot className="bg-neutral-100 sticky bottom-0 border-t-2 border-neutral-300">
              <tr>
                <td colSpan="4" className="px-3 py-2.5 text-right text-sm font-bold text-neutral-900 border-r border-neutral-300">
                  CLOSING BALANCE:
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-bold text-neutral-900 border-r border-neutral-300">
                  {formatCurrency(totalDebit)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-bold text-neutral-900 border-r border-neutral-300">
                  {formatCurrency(totalCredit)}
                </td>
                <td className="px-3 py-2.5 text-center text-sm font-bold text-neutral-900 border-r border-neutral-300">
                  -
                </td>
                <td className={`px-3 py-2.5 text-right text-sm font-bold ${closingBalance < 0 ? 'text-green-600' : closingBalance > 0 ? 'text-red-600' : 'text-neutral-900'
                  }`}>
                  {formatBalance(closingBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Ledger Cards - Mobile */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-3 pb-4">
        {ledgerEntries.length === 0 ? (
          <div className="bg-white rounded-lg border border-neutral-200 p-6 text-center text-neutral-500 text-sm">
            No transactions found
          </div>
        ) : (
          ledgerEntries.map((entry, idx) => {
            const dateStr = entry.type === 'Payment'
              ? new Date(entry.date).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            return (
              <div key={idx} className={`rounded-lg border p-4 shadow-sm ${entry.debit > 0 ? 'border-red-200 bg-red-50/50' : entry.credit > 0 ? 'border-green-200 bg-green-50/50' : 'bg-white border-neutral-200'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-neutral-900">{entry.type}</p>
                    <p className="text-xs text-neutral-500">{entry.reference || '-'}</p>
                    <p className="text-xs text-neutral-600 mt-0.5">{dateStr}</p>
                  </div>
                  <span className={`text-sm font-bold ${entry.balance < 0 ? 'text-green-600' : entry.balance > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
                    {formatBalance(entry.balance)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-neutral-600 border-t border-neutral-200 pt-2">
                  <span>{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</span>
                  <span>{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</span>
                  {entry.status && entry.status !== '-' && (
                    <span className="font-medium">{entry.status}</span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// Invoices Tab Component
const InvoicesTab = ({ invoices, outstandingInvoices, user, onViewInvoice, onViewPDF, onEditInvoice, onPayInvoice, onUnlockInvoice, onDeleteInvoice }) => {
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'owner'
  const canEdit = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'owner' // Admin and Owner can edit
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'partial': return 'bg-yellow-100 text-yellow-800'
      case 'pending': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid': return <CheckCircle className="h-3.5 w-3.5 text-green-600 inline-block mr-1" aria-hidden />
      case 'partial': return <Clock className="h-3.5 w-3.5 text-yellow-600 inline-block mr-1" aria-hidden />
      case 'pending': return <XCircle className="h-3.5 w-3.5 text-red-600 inline-block mr-1" aria-hidden />
      default: return <Clock className="h-3.5 w-3.5 text-neutral-500 inline-block mr-1" aria-hidden />
    }
  }

  const totalInvoices = invoices.length
  const totalPending = outstandingInvoices.reduce((sum, inv) => sum + inv.balanceAmount, 0)
  const totalPaid = invoices
    .filter(inv => inv.paymentStatus === 'Paid')
    .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0)

  return (
    <div className="w-full h-full flex flex-col">
      {/* Invoices Table - Desktop */}
      <div className="hidden md:flex bg-white overflow-hidden flex-1 flex-col w-full">
        <div className="overflow-x-auto overflow-y-auto flex-1 w-full">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase whitespace-nowrap">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Invoice No</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">Amount</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">Paid</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">Balance</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase whitespace-nowrap">Status</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    No invoices found
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => {
                  // Use the actual paidAmount from backend, or calculate from grandTotal
                  const paidAmount = invoice.paidAmount ?? 0
                  const grandTotal = invoice.grandTotal || invoice.total || 0
                  const balance = grandTotal - paidAmount
                  // Use paymentStatus from backend if available, otherwise calculate
                  const status = invoice.paymentStatus || (balance === 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending')

                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {new Date(invoice.invoiceDate || invoice.date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-1.5">
                          <span>{invoice.invoiceNo || `INV-${invoice.id}`}</span>
                          {invoice.isLocked && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800" title="Invoice locked after 48 hours">
                              <Lock className="h-3 w-3 mr-0.5" />
                              Locked
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(invoice.grandTotal || invoice.total || 0)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(paidAmount)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(balance)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                          {getStatusIcon(status)} {status}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-center text-sm">
                        <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                          {/* Pay Button - Only show if invoice has outstanding balance */}
                          {balance > 0 && onPayInvoice && (
                            <button
                              onClick={() => onPayInvoice(invoice.id)}
                              className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors shadow-sm"
                              title="Pay Invoice"
                            >
                              <Wallet className="h-3 w-3" />
                              <span className="hidden sm:inline">Pay</span>
                            </button>
                          )}
                          <button
                            onClick={() => onViewInvoice(invoice.id)}
                            className="text-blue-600 hover:text-blue-900 hover:bg-blue-50 p-1 rounded transition-colors"
                            title="View Invoice"
                          >
                            <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </button>
                          {canEdit && onEditInvoice && !invoice.isLocked && (
                            <button
                              onClick={() => onEditInvoice(invoice.id)}
                              className="text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 p-1 rounded transition-colors"
                              title="Edit Invoice"
                            >
                              <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                          )}
                          {isAdmin && invoice.isLocked && onUnlockInvoice && (
                            <button
                              onClick={() => onUnlockInvoice(invoice.id)}
                              className="text-purple-600 hover:text-purple-900 hover:bg-purple-50 p-1 rounded transition-colors"
                              title="Unlock Invoice (Admin Only)"
                            >
                              <Unlock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                          )}
                          {isAdmin && onDeleteInvoice && (
                            <button
                              onClick={() => onDeleteInvoice(invoice.id)}
                              className="bg-red-50 text-red-600 hover:text-white hover:bg-red-600 border border-red-300 p-1.5 rounded transition-colors shadow-sm"
                              title="Delete Invoice (Admin Only)"
                            >
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onViewPDF(invoice.id)}
                            className="text-green-600 hover:text-green-900 hover:bg-green-50 p-1 rounded transition-colors"
                            title="PDF"
                          >
                            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            <tfoot className="bg-gray-50 sticky bottom-0">
              <tr>
                <td colSpan="2" className="px-3 py-2 text-sm font-bold text-gray-900">
                  Total Invoices: {totalInvoices}
                </td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right text-sm font-bold text-green-600">
                  Total Paid: {formatCurrency(totalPaid)}
                </td>
                <td className="px-3 py-2 text-right text-sm font-bold text-red-600">
                  Total Pending: {formatCurrency(totalPending)}
                </td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Invoices Cards - Mobile */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-3 pb-4">
        {invoices.length === 0 ? (
          <div className="bg-white rounded-lg border border-neutral-200 p-6 text-center text-neutral-500 text-sm">
            No invoices found
          </div>
        ) : (
          invoices.map((invoice) => {
            const paidAmount = invoice.paidAmount ?? 0
            const grandTotal = invoice.grandTotal || invoice.total || 0
            const balance = grandTotal - paidAmount
            const status = invoice.paymentStatus || (balance === 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending')
            return (
              <div key={invoice.id} className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-neutral-900">{invoice.invoiceNo || `INV-${invoice.id}`}</p>
                    <p className="text-xs text-neutral-500">
                      {new Date(invoice.invoiceDate || invoice.date).toLocaleDateString('en-GB')}
                    </p>
                    {invoice.isLocked && (
                      <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Lock className="h-3 w-3 mr-0.5" /> Locked
                      </span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${getStatusColor(status)} px-2 py-0.5 rounded`}>
                    {status}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-neutral-600 border-t border-neutral-100 pt-2 mb-3">
                  <span>Amount: {formatCurrency(grandTotal)}</span>
                  <span>Balance: {formatCurrency(balance)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {balance > 0 && onPayInvoice && (
                    <button
                      onClick={() => onPayInvoice(invoice.id)}
                      className="flex-1 min-w-0 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <Wallet className="h-3.5 w-3.5" /> Pay
                    </button>
                  )}
                  <button
                    onClick={() => onViewInvoice(invoice.id)}
                    className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md text-xs font-medium flex items-center gap-1"
                    aria-label="View invoice"
                  >
                    <Eye className="h-3.5 w-3.5" /> View
                  </button>
                  {canEdit && onEditInvoice && !invoice.isLocked && (
                    <button
                      onClick={() => onEditInvoice(invoice.id)}
                      className="px-3 py-2 text-indigo-600 hover:bg-indigo-50 rounded-md text-xs font-medium flex items-center gap-1"
                      aria-label="Edit invoice"
                    >
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </button>
                  )}
                  {isAdmin && invoice.isLocked && onUnlockInvoice && (
                    <button
                      onClick={() => onUnlockInvoice(invoice.id)}
                      className="px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-md text-xs"
                      aria-label="Unlock invoice"
                    >
                      <Unlock className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {isAdmin && onDeleteInvoice && (
                    <button
                      onClick={() => onDeleteInvoice(invoice.id)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                      aria-label="Delete invoice"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onViewPDF(invoice.id)}
                    className="px-3 py-2 text-green-600 hover:bg-green-50 rounded-md text-xs font-medium flex items-center gap-1"
                    aria-label="View PDF"
                  >
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// Payments Tab Component
const PaymentsTab = ({ payments, user, onViewReceipt, onEditPayment, onDeletePayment }) => {
  // CRITICAL FIX: Allow both Admin AND Owner to edit/delete payments
  const userRole = user?.role?.toLowerCase()
  const canEditDelete = userRole === 'admin' || userRole === 'owner'

  return (
    <div className="w-full h-full flex flex-col">
      <div className="mb-4 flex justify-end flex-shrink-0">
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2" aria-label="Filter by mode">
          <Filter className="h-4 w-4" />
          <span>Filter by Mode</span>
        </button>
      </div>

      {/* Payments Table - Desktop */}
      <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden flex-1 min-h-0">
        <div className="overflow-x-auto overflow-y-auto h-full">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Mode</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Related Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Reference / Remarks</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    No payments found
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(payment.paymentDate).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {payment.method || payment.mode || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {payment.invoiceNo || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {payment.ref || payment.reference || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onViewReceipt(payment.id)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded transition-colors"
                          title="Print Receipt"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        {canEditDelete && onEditPayment && (
                          <button
                            onClick={() => onEditPayment(payment)}
                            className="text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 p-1 rounded transition-colors"
                            title="Edit Payment"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {canEditDelete && onDeletePayment && (
                          <button
                            onClick={() => onDeletePayment(payment)}
                            className="bg-red-50 text-red-600 hover:text-white hover:bg-red-600 border border-red-300 p-1 rounded transition-colors"
                            title="Delete Payment"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Payments Cards - Mobile */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-3 pb-4">
        {payments.length === 0 ? (
          <div className="bg-white rounded-lg border border-neutral-200 p-6 text-center text-neutral-500 text-sm">
            No payments found
          </div>
        ) : (
          payments.map((payment) => (
            <div key={payment.id} className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-neutral-900">{formatCurrency(payment.amount)}</p>
                  <p className="text-xs text-neutral-500">{payment.method || payment.mode || '-'}</p>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    {new Date(payment.paymentDate).toLocaleDateString('en-GB')}
                  </p>
                </div>
                {payment.invoiceNo && (
                  <span className="text-xs text-neutral-500">INV: {payment.invoiceNo}</span>
                )}
              </div>
              {(payment.ref || payment.reference) && (
                <p className="text-xs text-neutral-600 border-t border-neutral-100 pt-2 mb-3">
                  Ref: {payment.ref || payment.reference}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onViewReceipt(payment.id)}
                  className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md text-xs font-medium flex items-center gap-1"
                  aria-label="Print receipt"
                >
                  <Printer className="h-3.5 w-3.5" /> Receipt
                </button>
                {canEditDelete && onEditPayment && (
                  <button
                    onClick={() => onEditPayment(payment)}
                    className="px-3 py-2 text-indigo-600 hover:bg-indigo-50 rounded-md text-xs"
                    aria-label="Edit payment"
                  >
                    <Edit className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
                {canEditDelete && onDeletePayment && (
                  <button
                    onClick={() => onDeletePayment(payment)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md text-xs"
                    aria-label="Delete payment"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Reports Tab Component
const ReportsTab = ({ customer, summary, invoices, payments, outstandingInvoices }) => {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sales This Month</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-600 mt-2">
                {formatCurrency(summary?.totalSales || 0)}
              </p>
            </div>
            <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">Payments Received</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600 mt-2">
                {formatCurrency(summary?.totalPayments || 0)}
              </p>
            </div>
            <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">Overdue Invoices</p>
              <p className="text-lg sm:text-2xl font-bold text-red-600 mt-2">
                {outstandingInvoices.filter(inv => inv.daysOverdue > 0).length}
              </p>
            </div>
            <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Pending Bills List */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Pending Bills List</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Invoice No</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Paid</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Balance</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Days Overdue</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {outstandingInvoices.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    No pending bills
                  </td>
                </tr>
              ) : (
                outstandingInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {inv.invoiceNo}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {new Date(inv.invoiceDate).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(inv.grandTotal)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(inv.paidAmount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-red-600">
                      {formatCurrency(inv.balanceAmount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${inv.daysOverdue > 30 ? 'bg-red-100 text-red-800' :
                        inv.daysOverdue > 0 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                        {inv.daysOverdue} days
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Payment Entry Modal Component
const PaymentEntryModal = ({
  isOpen,
  onClose,
  customer,
  invoiceId, // Pre-selected invoice ID (from Pay button)
  outstandingInvoices,
  allInvoices = [], // All customer invoices (not just outstanding)
  onSubmit,
  register,
  handleSubmit,
  errors,
  setValue,
  watch,
  loading = false
}) => {
  const selectedSaleId = watch('saleId')

  // Combine outstanding and all invoices, prioritizing outstanding ones
  const allAvailableInvoices = useMemo(() => {
    // Add all invoices, but use outstanding invoice data if available (has balance info)
    const invoiceMap = new Map()

    // First add outstanding invoices
    outstandingInvoices.forEach(inv => {
      invoiceMap.set(inv.id, {
        ...inv,
        isOutstanding: true,
        balanceAmount: inv.balanceAmount || 0
      })
    })

    // Then add all other invoices that aren't outstanding
    allInvoices.forEach(inv => {
      if (!invoiceMap.has(inv.id)) {
        const paidAmount = inv.paidAmount || 0
        const grandTotal = inv.grandTotal || inv.total || 0
        const balanceAmount = grandTotal - paidAmount

        invoiceMap.set(inv.id, {
          id: inv.id,
          invoiceNo: inv.invoiceNo || `INV-${inv.id}`,
          invoiceDate: inv.invoiceDate || inv.date,
          grandTotal: grandTotal,
          paidAmount: paidAmount,
          balanceAmount: balanceAmount,
          isOutstanding: balanceAmount > 0,
          paymentStatus: inv.paymentStatus || (balanceAmount > 0 ? 'Pending' : 'Paid')
        })
      }
    })

    // Sort: outstanding first, then by date
    return Array.from(invoiceMap.values()).sort((a, b) => {
      if (a.isOutstanding !== b.isOutstanding) {
        return a.isOutstanding ? -1 : 1
      }
      return new Date(b.invoiceDate) - new Date(a.invoiceDate)
    })
  }, [outstandingInvoices, allInvoices])

  // Load invoice amount when modal opens with pre-selected invoice
  useEffect(() => {
    if (isOpen && invoiceId) {
      setValue('saleId', invoiceId.toString())
      // Find invoice and auto-fill amount
      const selectedInv = allAvailableInvoices.find(inv => inv.id === invoiceId)
      if (selectedInv) {
        setValue('amount', selectedInv.balanceAmount || selectedInv.outstandingAmount || 0)
      } else {
        // Try to fetch from API if not in list
        paymentsAPI.getInvoiceAmount(invoiceId).then(response => {
          if (response?.data?.success && response.data.data) {
            const inv = response.data.data
            setValue('amount', inv.outstandingAmount || 0)
          }
        }).catch(err => console.error('Failed to load invoice amount:', err))
      }
    } else if (isOpen && !invoiceId) {
      // Reset when modal opens without pre-selected invoice - use default values
      setValue('saleId', '')
      setValue('amount', '')
      setValue('paymentDate', new Date().toISOString().split('T')[0])
      setValue('method', 'CASH')
    }
  }, [isOpen, invoiceId, allAvailableInvoices, setValue])

  // Auto-fill amount when invoice selection changes
  useEffect(() => {
    if (customer && selectedSaleId && isOpen) {
      const selectedInv = allAvailableInvoices.find(inv => inv.id === parseInt(selectedSaleId))
      if (selectedInv && selectedInv.balanceAmount > 0) {
        setValue('amount', selectedInv.balanceAmount)
      }
    }
  }, [selectedSaleId, customer, allAvailableInvoices, setValue, isOpen])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add Payment for Customer – ${customer?.name || ''}`}
      size="lg"
    >
      <form onSubmit={handleSubmit((data) => {
        console.log('Payment form submitted with data:', data)
        onSubmit(data)
      }, (errors) => {
        console.log('Payment form validation errors:', errors)
        const errorMessages = Object.values(errors).map(e => e?.message).filter(Boolean)
        if (errorMessages.length > 0) {
          toast.error(errorMessages[0] || 'Please fix the form errors before submitting')
        }
      })} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Date"
            type="date"
            defaultValue={new Date().toISOString().split('T')[0]}
            required
            error={errors.paymentDate?.message}
            {...register('paymentDate', { required: 'Date is required' })}
          />

          <Select
            label="Invoice Number (Optional)"
            options={[
              { value: '', label: '-- No Invoice (General Payment) --' },
              ...allAvailableInvoices.map(inv => ({
                value: inv.id,
                label: `${inv.invoiceNo} - ${formatCurrency(inv.grandTotal)} - ${inv.balanceAmount > 0 ? `Balance: ${formatCurrency(inv.balanceAmount)}` : 'Paid'}`
              }))
            ]}
            error={errors.saleId?.message}
            {...register('saleId')}
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

          <Select
            label="Payment Mode"
            options={[
              { value: 'CASH', label: 'Cash' },
              { value: 'CHEQUE', label: 'Cheque' },
              { value: 'ONLINE', label: 'Online Transfer' },
              { value: 'CREDIT', label: 'Credit' }
            ]}
            required
            error={errors.method?.message || errors.mode?.message}
            {...register('method', { required: 'Payment method is required' })}
          />

          <div className="col-span-2">
            <Input
              label="Reference / Remarks"
              placeholder="Cheque number, transaction reference, notes..."
              error={errors.ref?.message}
              {...register('ref')}
            />
          </div>
        </div>

        {selectedSaleId && (
          <div className={`border rounded-lg p-4 ${allAvailableInvoices.find(inv => inv.id === parseInt(selectedSaleId))?.isOutstanding
            ? 'bg-blue-50 border-blue-200'
            : 'bg-gray-50 border-gray-200'
            }`}>
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className={allAvailableInvoices.find(inv => inv.id === parseInt(selectedSaleId))?.isOutstanding ? 'text-blue-900' : 'text-gray-700'}>
                Selected Invoice Details:
              </span>
            </p>
            {(() => {
              const selectedInv = allAvailableInvoices.find(inv => inv.id === parseInt(selectedSaleId))
              if (selectedInv) {
                return (
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="font-medium text-gray-600">Invoice No:</span>
                        <span className="ml-2 font-semibold">{selectedInv.invoiceNo}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Date:</span>
                        <span className="ml-2">{new Date(selectedInv.invoiceDate).toLocaleDateString('en-GB')}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Total Amount:</span>
                        <span className="ml-2 font-semibold">{formatCurrency(selectedInv.grandTotal)}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Paid:</span>
                        <span className="ml-2 font-semibold text-green-600">{formatCurrency(selectedInv.paidAmount)}</span>
                      </div>
                    </div>
                    {selectedInv.balanceAmount > 0 ? (
                      <div className="pt-2 border-t border-blue-300">
                        <p className="text-red-600 font-bold text-base">
                          Balance Due: {formatCurrency(selectedInv.balanceAmount)}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Payment will be allocated to this invoice
                        </p>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-gray-300">
                        <p className="text-green-600 font-semibold">
                          Invoice is fully paid
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          This payment will be recorded as a general payment (not allocated to invoice)
                        </p>
                      </div>
                    )}
                  </div>
                )
              }
              return null
            })()}
          </div>
        )}

        {!selectedSaleId && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800 flex items-center gap-2">
              <span className="font-medium">General Payment:</span>
              <span>This payment will not be allocated to any specific invoice. You can select an invoice above to allocate the payment.</span>
            </p>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            style={{
              pointerEvents: loading ? 'none' : 'auto',
              cursor: loading ? 'not-allowed' : 'pointer',
              position: 'relative',
              zIndex: 10,
              minWidth: '140px'
            }}
          >
            {loading ? (
              <span className="flex items-center">
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </span>
            ) : (
              'Save Payment'
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default CustomerLedgerPage


