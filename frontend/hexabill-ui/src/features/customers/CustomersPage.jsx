import { useState, useEffect } from 'react'
import { loadAllCustomerPages } from '../../utils/loadAllPages'
import { useForm } from 'react-hook-form'
import { useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { useCreateIntent } from '../../hooks/useCreateIntent'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Download,
  Phone,
  Mail,
  CreditCard,
  Filter,
  RefreshCw,
  Users,
  AlertCircle,
  UserPlus,
  DollarSign,
  BookOpen,
  Inbox,
  MessageCircle
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { OverflowMenu, TableSkeleton, ModernTable, ErrorState } from '../../components/ui'
import { formatCurrency, formatBalance, formatBalanceWithColor } from '../../utils/currency'
import { moneyTone, moneyWord } from '../../utils/moneyTone'
import { isAdminOrOwner, canAccessPage } from '../../utils/roles'  // CRITICAL: Multi-tenant role checking
import { validateEmail } from '../../utils/validation'
import { useBranchesRoutes } from '../../contexts/BranchesRoutesContext'
import { LoadingCard, LoadingButton } from '../../components/Loading'
import { Input, Select, TextArea } from '../../components/Form'
import Modal from '../../components/Modal'
import { customersAPI, routesAPI } from '../../services/index'
import { TabNavigation } from '../../components/ui/index'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'
import ConfirmDangerModal from '../../components/ConfirmDangerModal'
import CustomerPinField from '../../components/CustomerPinField'
import { isValidPoint } from '../../utils/shopLocation'
import { localDateString } from '../../utils/dateFormat'
import { saveOutcomeIsUncertain, uncertainSaveMessage } from '../../utils/apiError'
import { readCustomersStateFromParams, syncCustomersSearchParams } from '../../utils/customersUrl'
import { buildCustomerLedgerHref } from '../../utils/customerLedgerUrl'

function buildCustomerPayload(data) {
  return {
    ...data,
    // Optional blanks must have the same API representation on every save path.
    creditLimit: Number.isFinite(data.creditLimit) ? data.creditLimit : 0,
    email: (data.email || '').trim() || null,
    branchId: data.branchId ? parseInt(data.branchId, 10) : null,
    routeId: data.routeId ? parseInt(data.routeId, 10) : null,
    mainLatitude: data.mainLatitude !== '' && data.mainLatitude != null ? Number(data.mainLatitude) : null,
    mainLongitude: data.mainLongitude !== '' && data.mainLongitude != null ? Number(data.mainLongitude) : null,
    clearMainLocation: !!data.clearMainLocation,
  }
}

/** wa.me URL with digits-only MSISDN; Gulf-oriented defaults for UAE-style local numbers. */
function buildWhatsAppUrlFromPhone(phone) {
  if (!phone || typeof phone !== 'string') return null
  const d = phone.replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('971') || d.startsWith('966') || d.startsWith('973')) return `https://wa.me/${d}`
  if (d.startsWith('0') && d.length >= 9) return `https://wa.me/971${d.slice(1)}`
  if (d.length === 9 && d.startsWith('5')) return `https://wa.me/971${d}`
  return `https://wa.me/${d}`
}

// Customers not seen for this many days with money owed are shown as overdue (same rule the list tabs use).
const OVERDUE_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

function daysSince (value) {
  if (!value) return null
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / DAY_MS) : null
}

// "Today", "Yesterday", "12 days ago"; the exact date is the tooltip. Older than 90 days shows the date.
function seenLabel (value) {
  const d = daysSince(value)
  if (d === null) return { text: 'No activity', title: '' }
  const title = new Date(value).toLocaleDateString('en-GB')
  if (d <= 0) return { text: 'Today', title }
  if (d === 1) return { text: 'Yesterday', title }
  if (d <= 90) return { text: `${d} days ago`, title }
  return { text: title, title }
}

function isOverdueCustomer (c) {
  const pending = Number(c.pendingBalance ?? c.balance) || 0
  if (pending <= 0) return false
  const d = daysSince(c.lastActivity)
  return d === null || d >= OVERDUE_DAYS
}

// What the customer owes, in plain words. Colour always comes with a word.
function BalanceCell ({ customer }) {
  const balance = Number(customer.balance) || 0
  if (balance === 0) {
    return (
      <div className="leading-tight">
        <div className="text-neutral-500">{formatCurrency(0)}</div>
        <div className="text-sm text-neutral-500">Settled</div>
      </div>
    )
  }
  const overdue = isOverdueCustomer(customer)
  return (
    <div className="leading-tight">
      <div className={`font-semibold ${moneyTone('due', balance)}`}>{formatCurrency(Math.abs(balance))}</div>
      <div className={`text-sm ${balance > 0 ? 'text-error-fg' : 'text-success-fg'}`}>
        {balance > 0 ? (overdue ? 'Overdue 30+ days' : moneyWord('due', balance)) : moneyWord('due', balance)}
      </div>
    </div>
  )
}

const CustomersPage = () => {
  const { user } = useAuth()
  const { branches, routes } = useBranchesRoutes()
  const navigate = useNavigate()
  const location = useLocation()
  const listReturnTo = location.pathname + location.search
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState([])
  const [filterCounts, setFilterCounts] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '')
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'all')
  const [currentPage, setCurrentPage] = useState(() => Number(searchParams.get('page')) || 1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const PAGE_SIZE_OPTIONS = [25, 50, 100]
  const [pageSize, setPageSize] = useState(50)
  const [sortBy, setSortBy] = useState('name')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showLedgerModal, setShowLedgerModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [ledgerData, setLedgerData] = useState([])
  const [saving, setSaving] = useState(false)
  const [dangerModal, setDangerModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    requireTypedText: null,
    onConfirm: () => { }
  })
  const [duplicateConfirm, setDuplicateConfirm] = useState({ isOpen: false, data: null, existingName: '' })
  const [stopLocationEnabled, setStopLocationEnabled] = useState(false)

  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm()

  const openAddCustomer = () => {
    reset({ branchId: '', routeId: '', name: '', phone: '', email: '', trn: '', creditLimit: '', customerType: 'Credit', paymentTerms: '', address: '', location: '' })
    setShowAddModal(true)
  }
  useCreateIntent(openAddCustomer)

  const selectedBranchId = watch('branchId')
  const watchMainLat = watch('mainLatitude')
  const watchMainLng = watch('mainLongitude')
  const watchClearMain = watch('clearMainLocation')
  const savedPoint = isValidPoint(selectedCustomer?.mainLatitude, selectedCustomer?.mainLongitude)
    ? { lat: Number(selectedCustomer.mainLatitude), lng: Number(selectedCustomer.mainLongitude) }
    : null

  useEffect(() => {
    routesAPI.getStopLocationFeatureFlag()
      .then((res) => setStopLocationEnabled(!!(res?.data?.enabled ?? res?.enabled)))
      .catch(() => setStopLocationEnabled(false))
  }, [])

  // Fetch page 1 on mount and when search or page size changes (PRODUCTION_MASTER_TODO #42: pagination)
  useEffect(() => {
    fetchCustomers(1)
  }, [debouncedSearchTerm, pageSize, sortBy, activeTab])

  // Handle ?edit=ID URL parameter from Customer Ledger
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId && customers.length > 0) {
      const customerToEdit = customers.find(c => c.id === parseInt(editId))
      if (customerToEdit) {
        handleEdit(customerToEdit)
        // Remove the edit parameter from URL after opening modal
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.delete('edit')
          return next
        }, { replace: true })
      } else {
        // Customer not found - show error and remove param
        console.error(`Customer with ID ${editId} not found`)
        toast.error(`Customer with ID ${editId} not found. Showing all customers.`)
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.delete('edit')
          return next
        }, { replace: true })
      }
    } else if (editId && !loading && customers.length === 0) {
      // Customers loaded but empty - customer doesn't exist
      toast.error(`Customer with ID ${editId} not found.`)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('edit')
        return next
      }, { replace: true })
    }
  }, [customers, searchParams, loading, setSearchParams])

  // Sync filter state to URL so filters survive navigation and browser back
  useEffect(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      syncCustomersSearchParams(params, {
        search: searchTerm,
        activeTab,
        currentPage,
        editId: params.get('edit')
      })
      return params
    }, { replace: true })
  }, [searchTerm, activeTab, currentPage, setSearchParams])

  useEffect(() => {
    const parsed = readCustomersStateFromParams(searchParams)
    setSearchTerm((s) => (s === parsed.search ? s : parsed.search))
    setActiveTab((t) => (t === parsed.activeTab ? t : parsed.activeTab))
    setCurrentPage((p) => (p === parsed.currentPage ? p : parsed.currentPage))
  }, [searchParams])

  const fetchCustomers = async (page = 1, append = false) => {
    try {
      setLoading(true)
      setLoadError(false)
      // Server-side search, tab filter and counts: every tab covers ALL customers, not just the loaded page.
      const searchParam = debouncedSearchTerm || undefined
      const countsRequest = customersAPI.getCustomerFilterCounts({ search: searchParam })
        .then((res) => { if (res?.success && res.data) setFilterCounts(res.data) })
        .catch(() => { /* counts are informational; the list still works */ })
      const response = await customersAPI.getCustomers({
        page,
        pageSize,
        search: searchParam,
        ...(activeTab && activeTab !== 'all' ? { filter: activeTab } : {}),
        ...(sortBy && sortBy !== 'name' ? { sortBy } : {})
      })
      await countsRequest
      if (response.success && response.data) {
        const newCustomers = response.data.items || []
        if (append) {
          setCustomers(prev => [...prev, ...newCustomers])
        } else {
          setCustomers(newCustomers)
        }
        setTotalPages(response.data.totalPages || 1)
        setTotalCount(response.data.totalCount || 0)
        setHasMore(page < (response.data.totalPages || 1))
        setCurrentPage(page)
      } else {
        if (!append) setCustomers([])
        setLoadError(true)
      }
    } catch (error) {
      console.error('Failed to load customers:', error)
      setLoadError(true)
      // Only show error if it's not a network error (handled by interceptor)
      if (!error?._handledByInterceptor && (error.response || (!error.code || error.code !== 'ERR_NETWORK'))) {
        toast.error(error?.response?.data?.message || 'Failed to load customers')
      }
      if (!append) setCustomers([])
    } finally {
      setLoading(false)
      setHasLoadedOnce(true)
    }
  }

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchCustomers(currentPage + 1, true)
    }
  }

  const onSubmit = async (data) => {
    if (saving) {
      toast.error('Please wait, operation in progress...')
      return
    }

    // Payment terms required when credit limit > 0
    const creditLimitNum = Number(data.creditLimit) || 0
    if (creditLimitNum > 0 && !(data.paymentTerms || '').trim()) {
      toast.error('Payment terms are required when credit limit is set')
      return
    }

    // Duplicate phone blocks; duplicate email asks for confirmation (Add only)
    if (!selectedCustomer) {
      const phoneNorm = (data.phone || '').trim().replace(/\s/g, '')
      const emailNorm = (data.email || '').trim().toLowerCase()
      // The screen shows one page; check every customer so a clash beyond the first page is still caught early.
      let knownCustomers = customers
      if (phoneNorm || emailNorm) {
        try { knownCustomers = (await loadAllCustomerPages(customersAPI.getCustomers)).items } catch (_) { /* fall back to the page on screen */ }
      }
      // The server rejects a duplicate phone for the tenant, so do not offer "Add anyway" for it.
      const phoneDuplicate = phoneNorm && knownCustomers.find(c => (c.phone || '').replace(/\s/g, '') === phoneNorm)
      if (phoneDuplicate) {
        toast.error(`Customer "${phoneDuplicate.name}" already uses this phone number. Use a different number or open that customer.`)
        return
      }
      const duplicate = emailNorm && knownCustomers.find(c => (c.email || '').trim().toLowerCase() === emailNorm)
      if (duplicate) {
        setDuplicateConfirm({ isOpen: true, data, existingName: duplicate.name })
        return
      }
    }

    try {
      setSaving(true)
      const payload = buildCustomerPayload(data)
      let response
      if (selectedCustomer) {
        response = await customersAPI.updateCustomer(selectedCustomer.id, payload)
      } else {
        response = await customersAPI.createCustomer(payload)
      }

      if (response?.success !== false && response?.data?.id) {
        toast.success(selectedCustomer ? 'Customer updated successfully!' : 'Customer added successfully!')
        window.dispatchEvent(new CustomEvent('dataUpdated'))
        await fetchCustomers()
        reset()
        setShowAddModal(false)
        setShowEditModal(false)
        setSelectedCustomer(null)
      } else if (!selectedCustomer) {
        const found = await customersAPI.getCustomers({ search: data.name, pageSize: 20 }).catch(() => null)
        const items = found?.data?.items ?? found?.items ?? []
        const saved = items.find(c => String(c.name || '').toLowerCase() === String(data.name || '').toLowerCase())
        if (saved?.id) {
          toast.success('Customer added successfully!')
          window.dispatchEvent(new CustomEvent('dataUpdated'))
          await fetchCustomers()
          reset()
          setShowAddModal(false)
        } else {
          toast.error(response.message || 'Failed to save customer')
        }
      } else {
        toast.error(response.message || 'Failed to save customer')
      }
    } catch (error) {
      console.error('Failed to save customer:', error)
      if (!selectedCustomer && saveOutcomeIsUncertain(error)) {
        try {
          const found = await customersAPI.getCustomers({ search: data.name, pageSize: 20 })
          const items = found?.data?.items ?? found?.items ?? []
          const saved = items.find(c => String(c.name || '').toLowerCase() === String(data.name || '').toLowerCase())
          if (saved?.id) {
            toast.success('Customer added successfully!')
            window.dispatchEvent(new CustomEvent('dataUpdated'))
            await fetchCustomers()
            reset()
            setShowAddModal(false)
            return
          }
        } catch (_) { /* keep the error below */ }
      }
      if (!error?._handledByInterceptor) toast.error(error?.response?.data?.message || (saveOutcomeIsUncertain(error) ? uncertainSaveMessage('customer') : 'Failed to save customer'))
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicateConfirmAdd = async () => {
    if (!duplicateConfirm.data) {
      setDuplicateConfirm({ isOpen: false, data: null, existingName: '' })
      return
    }
    const data = duplicateConfirm.data
    setDuplicateConfirm({ isOpen: false, data: null, existingName: '' })
    const payload = buildCustomerPayload(data)
    try {
      setSaving(true)
      const response = await customersAPI.createCustomer(payload)
      if (response?.success !== false && response?.data?.id) {
        toast.success('Customer added successfully!')
        window.dispatchEvent(new CustomEvent('dataUpdated'))
        await fetchCustomers()
        reset()
        setShowAddModal(false)
      } else {
        const found = await customersAPI.getCustomers({ search: data.name, pageSize: 20 }).catch(() => null)
        const items = found?.data?.items ?? found?.items ?? []
        const saved = items.find(c => String(c.name || '').toLowerCase() === String(data.name || '').toLowerCase())
        if (saved?.id) {
          toast.success('Customer added successfully!')
          window.dispatchEvent(new CustomEvent('dataUpdated'))
          await fetchCustomers()
          reset()
          setShowAddModal(false)
        } else {
          toast.error(response.message || 'Failed to save customer')
        }
      }
    } catch (error) {
      if (saveOutcomeIsUncertain(error)) {
        try {
          const found = await customersAPI.getCustomers({ search: data.name, pageSize: 20 })
          const items = found?.data?.items ?? found?.items ?? []
          const saved = items.find(c => String(c.name || '').toLowerCase() === String(data.name || '').toLowerCase())
          if (saved?.id) {
            toast.success('Customer added successfully!')
            window.dispatchEvent(new CustomEvent('dataUpdated'))
            await fetchCustomers()
            reset()
            setShowAddModal(false)
            return
          }
        } catch (_) { /* keep the error below */ }
      }
      if (!error?._handledByInterceptor) toast.error(error?.response?.data?.message || (saveOutcomeIsUncertain(error) ? uncertainSaveMessage('customer') : 'Failed to save customer'))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (customer) => {
    setSelectedCustomer(customer)
    setValue('name', customer.name)
    setValue('phone', customer.phone)
    setValue('email', customer.email)
    setValue('trn', customer.trn)
    setValue('address', customer.address)
    setValue('location', customer.location || '')
    setValue('mainLatitude', customer.mainLatitude ?? '')
    setValue('mainLongitude', customer.mainLongitude ?? '')
    setValue('clearMainLocation', false)
    setValue('creditLimit', customer.creditLimit)
    setValue('customerType', customer.customerType || 'Credit')
    setValue('branchId', customer.branchId || '')
    setValue('routeId', customer.routeId || '')
    setValue('paymentTerms', customer.paymentTerms || '')
    setShowEditModal(true)
  }

  const handleExportCustomers = () => {
    try {
      // Create CSV content
      const headers = ['Name', 'Phone', 'Email', 'TRN', 'Address', 'Location', 'Customer Type', 'Credit Limit', 'Payment Terms', 'Balance', 'Branch', 'Route']
      const rows = customers.map(c => [
        c.name || '',
        c.phone || '',
        c.email || '',
        c.trn || '',
        c.address || '',
        c.location || '',
        c.customerType || 'Credit',
        (c.creditLimit || 0).toString(),
        c.paymentTerms || '',
        (c.balance || 0).toString(),
        branches.find(b => b.id === c.branchId)?.name || '',
        routes.find(r => r.id === c.routeId)?.name || ''
      ])
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','))
      ].join('\n')
      
      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customers_export_${localDateString(new Date())}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Customers exported successfully')
    } catch (error) {
      console.error('Failed to export customers:', error)
      toast.error('Failed to export customers')
    }
  }

  const handleImportCustomers = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      if (lines.length < 2) {
        toast.error('CSV file must have at least a header row and one data row')
        return
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const nameIndex = headers.findIndex(h => h.toLowerCase().includes('name'))
      const phoneIndex = headers.findIndex(h => h.toLowerCase().includes('phone'))
      const emailIndex = headers.findIndex(h => h.toLowerCase().includes('email'))
      
      if (nameIndex === -1 || phoneIndex === -1) {
        toast.error('CSV must have "Name" and "Phone" columns')
        return
      }

      let successCount = 0
      let errorCount = 0

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const name = values[nameIndex]
        const phone = values[phoneIndex]
        
        if (!name || !phone) {
          errorCount++
          continue
        }

        const customerData = {
          name,
          phone,
          email: values[emailIndex] || '',
          trn: headers.includes('TRN') ? values[headers.findIndex(h => h.toLowerCase() === 'trn')] || '' : '',
          address: headers.includes('Address') ? values[headers.findIndex(h => h.toLowerCase() === 'address')] || '' : '',
          location: headers.includes('Location') ? values[headers.findIndex(h => h.toLowerCase() === 'location')] || '' : '',
          customerType: headers.includes('Customer Type') ? values[headers.findIndex(h => h.toLowerCase().includes('type'))] || 'Credit' : 'Credit',
          creditLimit: headers.includes('Credit Limit') ? parseFloat(values[headers.findIndex(h => h.toLowerCase().includes('limit'))] || '0') : 0,
          paymentTerms: headers.includes('Payment Terms') ? values[headers.findIndex(h => h.toLowerCase().includes('terms'))] || '' : '',
          branchId: headers.includes('Branch') ? (() => {
            const branchName = values[headers.findIndex(h => h.toLowerCase() === 'branch')] || ''
            return branches.find(b => b.name === branchName)?.id || null
          })() : null,
          routeId: headers.includes('Route') ? (() => {
            const routeName = values[headers.findIndex(h => h.toLowerCase() === 'route')] || ''
            return routes.find(r => r.name === routeName)?.id || null
          })() : null
        }

        try {
          const response = await customersAPI.createCustomer(customerData)
          if (response.success) {
            successCount++
          } else {
            errorCount++
          }
        } catch (error) {
          errorCount++
        }
      }

      toast.success(`Import completed: ${successCount} successful, ${errorCount} failed`)
      if (successCount > 0) window.dispatchEvent(new CustomEvent('dataUpdated'))
      await fetchCustomers(1, false)
      event.target.value = '' // Reset file input
    } catch (error) {
      console.error('Failed to import customers:', error)
      toast.error('Failed to import customers')
      event.target.value = ''
    }
  }

  const handleSendStatement = async (customerId) => {
    try {
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - 30) // Last 30 days
      const toDate = new Date()
      const blob = await customersAPI.getCustomerStatement(customerId, localDateString(fromDate), localDateString(toDate))
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customer_statement_${customerId}_${localDateString(new Date())}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Statement downloaded successfully')
    } catch (error) {
      console.error('Failed to download statement:', error)
      toast.error('Failed to download statement')
    }
  }

  const handleDelete = (customerId) => {
    const customer = customers.find(c => c.id === customerId)
    const customerName = customer?.name || 'Customer'

    // First check if customer has transactions
    const hasTransactions = (customer?.balance || 0) !== 0

    if (hasTransactions) {
      // Customer has transactions - offer force delete option
      setDangerModal({
        isOpen: true,
        title: 'Force Delete Customer?',
        message: `WARNING: This customer has transactions. Force Delete will permanently delete:
          • Customer: ${customerName}
          • All Sales/Invoices
          • All Payments
          • All Sale Returns
          • Stock will be restored
          
          THIS CANNOT BE UNDONE!`,
        confirmLabel: 'Force Delete Everything',
        requireTypedText: `DELETE ${customerName.toUpperCase()}`,
        onConfirm: () => performDelete(customerId, true, customerName)
      })
    } else {
      // No transactions - regular delete
      setDangerModal({
        isOpen: true,
        title: 'Delete Customer?',
        message: `Are you sure you want to delete "${customerName}"? This action cannot be undone!`,
        confirmLabel: 'Delete Customer',
        onConfirm: () => performDelete(customerId, false, customerName)
      })
    }
  }

  const performDelete = async (customerId, forceDelete, customerName) => {
    try {
      const response = await customersAPI.deleteCustomer(customerId, forceDelete)
      if (response.success) {
        const summary = response.data
        if (forceDelete && summary) {
          toast.success(
            `Customer "${customerName}" and all data deleted!\n` +
            `Deleted: ${summary.salesDeleted} sales, ${summary.paymentsDeleted} payments, ${summary.saleReturnsDeleted} returns.` +
            (summary.stockRestored ? ' Stock restored.' : ''),
            { duration: 5000 }
          )
          window.dispatchEvent(new CustomEvent('dataUpdated'))
        } else {
          toast.success('Customer deleted successfully!')
          window.dispatchEvent(new CustomEvent('dataUpdated'))
        }
        // Update state directly without full page reload
        setCustomers(prev => prev.filter(c => c.id !== customerId))
      } else {
        toast.error(response.message || 'Failed to delete customer')
      }
    } catch (error) {
      console.error('Failed to delete customer:', error)
      if (!error?._handledByInterceptor) toast.error(error?.response?.data?.message || 'Failed to delete customer')
    }
  }

  const openCollectInLedger = (customer) => {
    if (!customer?.id) return
    navigate(
      buildCustomerLedgerHref({ customerId: customer.id, tab: 'payments', openPayment: true }),
      { state: { returnTo: listReturnTo } }
    )
  }

  const handleViewLedger = async (customer) => {
    setSelectedCustomer(customer)
    try {
      const response = await customersAPI.getCustomerLedger(customer.id)
      if (response.success) {
        setLedgerData(response.data || [])
      }
      setShowLedgerModal(true)
    } catch (error) {
      if (!error?._handledByInterceptor) toast.error('Failed to load ledger data')
      setShowLedgerModal(true)
    }
  }

  const handleRecalculateBalance = async (customerId) => {
    try {
      toast.loading('Recalculating balance...')
      const response = await customersAPI.recalculateBalance(customerId)
      if (response.success) {
        toast.success('Balance recalculated successfully!')
        window.dispatchEvent(new CustomEvent('dataUpdated'))
        fetchCustomers() // Refresh customer list
      } else {
        toast.error(response.message || 'Failed to recalculate balance')
      }
    } catch (error) {
      console.error('Failed to recalculate balance:', error)
      if (!error?._handledByInterceptor) toast.error(error?.response?.data?.message || 'Failed to recalculate balance')
    }
  }

  const handleExportStatement = async () => {
    if (!selectedCustomer) return

    try {
      toast.loading('Generating statement PDF...')
      const blob = await customersAPI.getCustomerStatement(selectedCustomer.id)

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customer_statement_${selectedCustomer.id}_${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      toast.success('Statement exported successfully!')
    } catch (error) {
      console.error('Failed to export statement:', error)
      if (!error?._handledByInterceptor) toast.error('Failed to export statement')
    }
  }

  const handleShareWhatsApp = () => {
    const message = `Customer Statement for ${selectedCustomer?.name}\n\nPlease find attached the statement for the period.`
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  // One action list for desktop and phone rows (UX-C03). Ledger first; Collect only when owed.
  const customerMenuItems = (customer) => {
    const waUrl = buildWhatsAppUrlFromPhone(customer.phone)
    return [
      { label: 'Quick ledger view', icon: Eye, onClick: () => handleViewLedger(customer) },
      { label: 'Collect payment', icon: DollarSign, hidden: !((Number(customer.balance) || 0) > 0), onClick: () => openCollectInLedger(customer) },
      { label: 'WhatsApp', icon: MessageCircle, hidden: !waUrl, onClick: () => window.open(waUrl, '_blank', 'noopener,noreferrer') },
      { label: 'Send statement', icon: Mail, onClick: () => handleSendStatement(customer.id) },
      { label: 'Edit customer', icon: Edit, onClick: () => handleEdit(customer) },
      { label: 'Delete customer', icon: Trash2, danger: true, separatorBefore: true, hidden: !isAdminOrOwner(user), onClick: () => handleDelete(customer.id) },
    ]
  }

  const count = (key) => (filterCounts ? filterCounts[key] : null)
  const tabs = [
    { id: 'all', label: 'All', icon: Users, badge: count('all') },
    { id: 'outstanding', label: 'Owes money', icon: AlertCircle, badge: count('outstanding') },
    { id: 'overdue', label: 'Overdue', icon: AlertCircle, badge: count('overdue') },
    { id: 'active', label: 'Active', icon: UserPlus, badge: count('active') },
    { id: 'inactive', label: 'Inactive', icon: Users, badge: count('inactive') }
  ]

  // Sorting is done by the server for the whole list. Header clicks map to the sorts it supports.
  const SORT_BY_COLUMN = { name: 'name', balance: 'balanceDesc', lastActivity: 'activityDesc' }
  const COLUMN_BY_SORT = { name: 'name', balanceDesc: 'balance', activityDesc: 'lastActivity' }
  const tableSort = { key: COLUMN_BY_SORT[sortBy] || 'name', direction: sortBy === 'name' || !sortBy ? 'asc' : 'desc' }
  const handleSortChange = (key) => {
    setSortBy(SORT_BY_COLUMN[key] || 'name')
    setCurrentPage(1)
  }

  const openLedgerPage = (customer) =>
    navigate(buildCustomerLedgerHref({ customerId: customer.id }), { state: { returnTo: listReturnTo } })
  const openDetails = (customer) =>
    navigate(`/customers/${customer.id}`, { state: { returnTo: location.pathname + location.search } })

  const columns = [
    {
      key: 'name',
      label: 'Customer',
      sortable: true,
      mobile: 'title',
      render: (c) => (
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => openDetails(c)}
            title={c.name}
            className="line-clamp-2 block min-h-[32px] py-1 text-start text-sm font-semibold text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {c.name}
          </button>
          {c.phone && <div className="text-sm tabular-nums text-neutral-600">{c.phone}</div>}
        </div>
      )
    },
    { key: 'phone', label: 'Phone', mobile: 'hidden', hideBelow: 'xl', render: (c) => <span className="tabular-nums">{c.phone || '-'}</span> },
    {
      key: 'balance',
      label: 'Balance due',
      align: 'right',
      sortable: true,
      render: (c) => <BalanceCell customer={c} />
    },
    {
      key: 'lastActivity',
      label: 'Last activity',
      sortable: true,
      hideBelow: 'lg',
      render: (c) => { const seen = seenLabel(c.lastActivity); return <span title={seen.title}>{seen.text}</span> }
    },
    {
      key: 'lastPaymentDate',
      label: 'Last payment',
      hideBelow: 'xl',
      render: (c) => { const seen = seenLabel(c.lastPaymentDate); return <span title={seen.title}>{c.lastPaymentDate ? seen.text : 'None yet'}</span> }
    },
    { key: 'creditLimit', label: 'Credit limit', align: 'right', hideBelow: 'xl', mobile: 'hidden', render: (c) => (Number(c.creditLimit) > 0 ? formatCurrency(c.creditLimit) : <span className="text-neutral-500">No limit</span>) },
    { key: 'totalSales', label: 'Total sales', align: 'right', hideBelow: 'xl', mobile: 'hidden', render: (c) => formatCurrency(c.totalSales) }
  ]

  // Visible, labelled actions: no hunting for icons. Secondary actions sit under a labelled "More".
  const renderActions = (c) => (
    <div className="flex items-center justify-end gap-2">
      <button type="button" onClick={() => openLedgerPage(c)} className="btn btn-secondary px-3" aria-label={`Open ledger for ${c.name}`}>
        <BookOpen className="h-4 w-4" aria-hidden />
        Ledger
      </button>
      {(Number(c.balance) || 0) > 0 && (
        <button type="button" onClick={() => openCollectInLedger(c)} className="btn btn-secondary px-3 border-primary-300 text-primary-700 hover:bg-primary-50" aria-label={`Collect payment from ${c.name}`}>
          <DollarSign className="h-4 w-4" aria-hidden />
          Collect
        </button>
      )}
      <OverflowMenu label={`More actions for ${c.name}`} buttonText="More" buttonClassName="px-3" showLabel items={customerMenuItems(c)} />
    </div>
  )

  if (loading && !hasLoadedOnce) {
    return <div className="p-4"><TableSkeleton rows={10} /></div>
  }

  const filtersActive = Boolean(debouncedSearchTerm) || activeTab !== 'all'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 max-w-full">
      {/* Header: title with the real total, one primary action; search and sort on one row; tabs carry server-side counts. */}
      <div className="shrink-0 rounded-lg border border-surface-border bg-white">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-3 sm:px-4">
          <div className="min-w-0 lg:w-44 lg:shrink-0">
            <h1 className="text-lg font-semibold text-text-primary">Customers</h1>
            <p className="text-sm text-neutral-600 tabular-nums" aria-live="polite">
              {filterCounts ? `${filterCounts.all} customers` : `${totalCount} customers`}
            </p>
          </div>
          <div className="relative order-last min-w-0 basis-full lg:order-none lg:basis-0 lg:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
            <input
              type="search"
              placeholder="Search by name, phone or TRN"
              aria-label="Search customers"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input h-11 w-full pl-9"
            />
          </div>
          {/* Phones have no column headers to click, so they keep a sort menu. */}
          <label htmlFor="customer-sort" className="sr-only">Sort customers</label>
          <select
            id="customer-sort"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value)
              setCurrentPage(1)
            }}
            className="input order-last h-11 w-40 shrink-0 md:hidden"
          >
            <option value="name">Name A-Z</option>
            <option value="balanceDesc">Highest balance</option>
            <option value="activityDesc">Recent activity</option>
          </select>
          <div className="ms-auto flex shrink-0 items-center gap-2">
            <button type="button" onClick={openAddCustomer} className="btn btn-primary">
              <Plus className="h-4 w-4" aria-hidden />
              Add customer
            </button>
            <OverflowMenu
              label="More customer actions"
              buttonText="More"
              showLabel
              items={[
                { label: 'Refresh', icon: RefreshCw, onClick: () => fetchCustomers(currentPage) },
                { label: 'Export CSV', icon: Download, onClick: handleExportCustomers },
                { label: 'Import CSV', icon: Inbox, onClick: () => document.getElementById('csv-import-input')?.click() },
                { label: 'Overdue invoices report', icon: AlertCircle, separatorBefore: true, hidden: !canAccessPage(user, 'reports'), onClick: () => navigate('/reports?tab=overdue') },
              ]}
            />
          </div>
          <input id="csv-import-input" type="file" accept=".csv" className="hidden" onChange={handleImportCustomers} />
        </div>
        <div className="mt-1 px-1 sm:px-2">
          <TabNavigation tabs={tabs} activeTab={activeTab} onChange={(id) => { setActiveTab(id); setCurrentPage(1) }} ariaLabel="Customer lists" />
        </div>
      </div>

      {loadError && (
        <div className="shrink-0">
          <ErrorState message="The customer list could not be loaded." onAction={() => fetchCustomers(currentPage)} />
        </div>
      )}

      <ModernTable
        fill
        stickyHeader
        mobileCards
        busy={loading}
        caption="Customers"
        data={customers}
        columns={columns}
        actions={renderActions}
        sort={tableSort}
        onSortChange={handleSortChange}
        totalCount={totalCount}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => fetchCustomers(page)}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageSizeChange={(n) => { setPageSize(n); setCurrentPage(1) }}
        emptyTitle={filtersActive ? 'No customers match' : 'No customers yet'}
        emptyDescription={filtersActive ? 'Try a different name or phone number, or choose another tab.' : 'Add your first customer to start creating invoices from POS.'}
        emptyAction={{ label: 'Add customer', icon: Plus, onClick: openAddCustomer }}
      />

      {/* Add Customer Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          reset()
          setSaving(false)
        }}
        title="Add New Customer"
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Customer Name"
              placeholder="ABC Restaurant"
              required
              error={errors.name?.message}
              {...register('name', {
                required: 'Customer name is required',
                maxLength: { value: 200, message: 'Customer name must be 200 characters or fewer' }
              })}
            />

            <Input
              label="Phone Number"
              placeholder="+971 50 123 4567"
              required
              error={errors.phone?.message}
              {...register('phone', {
                required: 'Phone number is required',
                maxLength: { value: 20, message: 'Phone number must be 20 characters or fewer' }
              })}
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="info@abcrestaurant.com"
              error={errors.email?.message}
              {...register('email', {
                validate: (v) => !v || validateEmail(v) ? true : 'Enter a valid email address',
                maxLength: { value: 100, message: 'Email must be 100 characters or fewer' }
              })}
            />

            <Input
              label="TRN Number"
              placeholder="TRN123456789"
              error={errors.trn?.message}
              {...register('trn', {
                maxLength: { value: 50, message: 'TRN must be 50 characters or fewer' }
              })}
            />

            <Input
              label="Credit Limit"
              type="number"
              min="0"
              step="0.01"
              placeholder="50000"
              error={errors.creditLimit?.message}
              {...register('creditLimit', {
                valueAsNumber: true,
                min: { value: 0, message: 'Credit limit must be positive' },
                max: { value: 99999999.99, message: 'Credit limit must be 99,999,999.99 or less' }
              })}
            />

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Customer Type</label>
              <select aria-label="Customer Type"
                {...register('customerType')}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="Credit">Credit (Can have outstanding balance)</option>
                <option value="Cash">Cash (Must pay immediately)</option>
              </select>
              <p className="mt-1 text-xs text-neutral-500">Credit customers can have outstanding balance, Cash customers must pay immediately</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Payment Terms</label>
              <select aria-label="payment terms"
                {...register('paymentTerms')}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select payment terms</option>
                <option value="Cash on Delivery">Cash on Delivery</option>
                <option value="Net 7">Net 7</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 60">Net 60</option>
                <option value="Net 90">Net 90</option>
                <option value="Custom">Custom</option>
              </select>
              <p className="mt-1 text-xs text-warning">Required when Credit Limit &gt; 0</p>
            </div>

            {/* Branch and Route (PRODUCTION_MASTER_TODO #10) */}
            {branches.length > 0 && (
              <>
                <div>
                  {/* Same rule as the edit form. Both forms share one useForm, so the edit form's
                      rule already applied here; the add form just never said so or showed the error. */}
                  <label htmlFor="add-customer-branch" className="block text-sm font-medium text-neutral-700 mb-1">
                    Branch {branches.length > 0 && <span className="text-error" aria-hidden>*</span>}
                  </label>
                  <select
                    id="add-customer-branch"
                    aria-invalid={!!errors.branchId}
                    aria-describedby={errors.branchId ? 'add-customer-branch-error' : undefined}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${errors.branchId ? 'border-error' : 'border-neutral-300'}`}
                    {...register('branchId', {
                      required: branches.length > 0 ? 'Branch is required when company has branches' : false,
                      onChange: (e) => {
                        setValue('branchId', e.target.value)
                        setValue('routeId', '')
                      }
                    })}
                  >
                    <option value="">Select branch</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  {errors.branchId && (
                    <p id="add-customer-branch-error" role="alert" className="mt-1 text-xs font-medium text-error-fg">{errors.branchId.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="add-customer-route" className="block text-sm font-medium text-neutral-700 mb-1">
                    Route {selectedBranchId && <span className="text-error" aria-hidden>*</span>}
                  </label>
                  <select
                    id="add-customer-route"
                    aria-invalid={!!errors.routeId}
                    aria-describedby={errors.routeId ? 'add-customer-route-error' : undefined}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed ${errors.routeId ? 'border-error' : 'border-neutral-300'}`}
                    {...register('routeId', {
                      required: selectedBranchId ? 'Route is required when branch is selected' : false
                    })}
                    disabled={!selectedBranchId}
                  >
                    <option value="">
                      {selectedBranchId ? 'Select route' : 'Select branch first'}
                    </option>
                    {(selectedBranchId ? routes.filter(r => r.branchId === parseInt(selectedBranchId, 10)) : []).map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  {errors.routeId && (
                    <p id="add-customer-route-error" role="alert" className="mt-1 text-xs font-medium text-error-fg">{errors.routeId.message}</p>
                  )}
                </div>
              </>
            )}

            <div className="md:col-span-2">
              <TextArea
                label="Address"
                placeholder="Dubai Marina, Dubai, UAE"
                rows={3}
                error={errors.address?.message}
                {...register('address')}
              />
            </div>

            <div className="md:col-span-2">
              <Input
                label="Location (optional)"
                placeholder="Area / landmark (e.g. Mussafah, ICAD)"
                error={errors.location?.message}
                {...register('location')}
              />
            </div>
            {stopLocationEnabled && (
              <>
                <input type="hidden" {...register('mainLatitude')} />
                <input type="hidden" {...register('mainLongitude')} />
                <CustomerPinField
                  lat={watchMainLat}
                  lng={watchMainLng}
                  onChange={({ lat, lng }) => { setValue('mainLatitude', lat); setValue('mainLongitude', lng); setValue('clearMainLocation', false) }}
                  onClear={() => { setValue('mainLatitude', ''); setValue('mainLongitude', '') }}
                />
              </>
            )}
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false)
                reset()
              }}
              className="px-4 py-2 border border-neutral-300 rounded-md shadow-sm text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50"
            >
              Cancel
            </button>
            <LoadingButton type="submit" loading={saving}>
              Add Customer
            </LoadingButton>
          </div>
        </form>
      </Modal>

      {/* Duplicate phone/email confirm */}
      {duplicateConfirm.isOpen && (
        <Modal
          isOpen
          title="Duplicate email"
          onClose={() => setDuplicateConfirm({ isOpen: false, data: null, existingName: '' })}
        >
          <p className="text-sm text-neutral-600 mb-4">
            A customer named <strong>{duplicateConfirm.existingName}</strong> already has this email. Add anyway?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDuplicateConfirm({ isOpen: false, data: null, existingName: '' })}
              className="px-4 py-2 border border-neutral-300 rounded-md text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDuplicateConfirmAdd}
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add anyway'}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Customer Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedCustomer(null)
          reset()
          setSaving(false)
        }}
        title="Edit Customer"
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Customer Name"
              placeholder="ABC Restaurant"
              required
              error={errors.name?.message}
              {...register('name', {
                required: 'Customer name is required',
                maxLength: { value: 200, message: 'Customer name must be 200 characters or fewer' }
              })}
            />

            <Input
              label="Phone Number"
              placeholder="+971 50 123 4567"
              required
              error={errors.phone?.message}
              {...register('phone', {
                required: 'Phone number is required',
                maxLength: { value: 20, message: 'Phone number must be 20 characters or fewer' }
              })}
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="info@abcrestaurant.com"
              error={errors.email?.message}
              {...register('email', {
                validate: (v) => !v || validateEmail(v) ? true : 'Enter a valid email address',
                maxLength: { value: 100, message: 'Email must be 100 characters or fewer' }
              })}
            />

            <Input
              label="TRN Number"
              placeholder="TRN123456789"
              error={errors.trn?.message}
              {...register('trn', {
                maxLength: { value: 50, message: 'TRN must be 50 characters or fewer' }
              })}
            />

            <Input
              label="Credit Limit"
              type="number"
              min="0"
              step="0.01"
              placeholder="50000"
              error={errors.creditLimit?.message}
              {...register('creditLimit', {
                valueAsNumber: true,
                min: { value: 0, message: 'Credit limit must be positive' },
                max: { value: 99999999.99, message: 'Credit limit must be 99,999,999.99 or less' }
              })}
            />

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Customer Type</label>
              <select aria-label="Customer Type"
                {...register('customerType')}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="Credit">Credit (Can have outstanding balance)</option>
                <option value="Cash">Cash (Must pay immediately)</option>
              </select>
              <p className="mt-1 text-xs text-neutral-500">Credit customers can have outstanding balance, Cash customers must pay immediately</p>
            </div>

            <div className="md:col-span-2">
              <TextArea
                label="Address"
                placeholder="Dubai Marina, Dubai, UAE"
                rows={3}
                error={errors.address?.message}
                {...register('address')}
              />
            </div>

            <div className="md:col-span-2">
              <Input
                label="Location (optional)"
                placeholder="Area / landmark (e.g. Mussafah, ICAD)"
                error={errors.location?.message}
                {...register('location')}
              />
            </div>

            {stopLocationEnabled && (
              <>
                <input type="hidden" {...register('mainLatitude')} />
                <input type="hidden" {...register('mainLongitude')} />
                <CustomerPinField
                  lat={watchMainLat}
                  lng={watchMainLng}
                  saved={savedPoint}
                  updatedAt={selectedCustomer?.locationUpdatedAt}
                  updatedByMe={!!selectedCustomer?.locationUpdatedBy && selectedCustomer.locationUpdatedBy === user?.id}
                  clearing={!!watchClearMain}
                  onChange={({ lat, lng }) => { setValue('mainLatitude', lat); setValue('mainLongitude', lng); setValue('clearMainLocation', false) }}
                  onClear={() => { setValue('mainLatitude', savedPoint ? savedPoint.lat : ''); setValue('mainLongitude', savedPoint ? savedPoint.lng : '') }}
                  onRemoveSaved={(remove) => setValue('clearMainLocation', !!remove)}
                />
              </>
            )}


            {/* Branch and Route Assignment */}
            {branches.length > 0 && (
              <>
                <div>
                  <label htmlFor="edit-customer-branch" className="block text-sm font-medium text-neutral-700 mb-1">
                    Branch {branches.length > 0 && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    id="edit-customer-branch"
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${errors.branchId ? 'border-red-500' : 'border-neutral-300'}`}
                    {...register('branchId', {
                      required: branches.length > 0 ? 'Branch is required when company has branches' : false,
                      onChange: (e) => {
                        setValue('branchId', e.target.value)
                        setValue('routeId', '') // Clear route when branch changes
                      }
                    })}
                  >
                    <option value="">Select branch</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  {errors.branchId && (
                    <p className="mt-1 text-sm text-error">{errors.branchId.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="edit-customer-route" className="block text-sm font-medium text-neutral-700 mb-1">
                    Route {selectedBranchId && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    id="edit-customer-route"
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed ${errors.routeId ? 'border-red-500' : 'border-neutral-300'}`}
                    {...register('routeId', {
                      required: selectedBranchId ? 'Route is required when branch is selected' : false
                    })}
                    disabled={!selectedBranchId}
                  >
                    <option value="">
                      {selectedBranchId ? 'Select route' : 'Select branch first'}
                    </option>
                    {(selectedBranchId ? routes.filter(r => r.branchId === parseInt(selectedBranchId, 10)) : []).map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  {errors.routeId && (
                    <p className="mt-1 text-sm text-error">{errors.routeId.message}</p>
                  )}
                </div>
              </>
            )}

            {/* Payment Terms */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Payment Terms</label>
              <select aria-label="payment terms"
                {...register('paymentTerms')}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select payment terms</option>
                <option value="Cash on Delivery">Cash on Delivery</option>
                <option value="Net 7">Net 7</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 60">Net 60</option>
                <option value="Net 90">Net 90</option>
                <option value="Custom">Custom</option>
              </select>
              <p className="mt-1 text-xs text-neutral-500">Required when credit limit &gt; 0</p>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false)
                setSelectedCustomer(null)
                reset()
              }}
              className="px-4 py-2 border border-neutral-300 rounded-md shadow-sm text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50"
            >
              Cancel
            </button>
            <LoadingButton type="submit" loading={saving}>
              Update Customer
            </LoadingButton>
          </div>
        </form>
      </Modal>

      {/* Customer Ledger Modal */}
      <Modal
        isOpen={showLedgerModal}
        onClose={() => {
          setShowLedgerModal(false)
          setSelectedCustomer(null)
        }}
        title={`Customer Ledger - ${selectedCustomer?.name}`}
        size="xl"
        allowFullscreen={true}
      >
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-neutral-50 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-500">Current Balance</p>
                <p className={`text-lg font-semibold ${selectedCustomer?.balance < 0 ? 'text-success' : selectedCustomer?.balance > 0 ? 'text-error' : 'text-neutral-600'
 }`}>
                  {formatBalance(selectedCustomer?.balance || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Credit Limit</p>
                <p className="text-lg font-semibold text-neutral-900">
                  {formatCurrency(selectedCustomer?.creditLimit || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Available Credit</p>
                <p className="text-lg font-semibold text-neutral-900">
                  {formatCurrency((selectedCustomer?.creditLimit || 0) - (selectedCustomer?.balance || 0))}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap justify-end gap-2 mb-4">
            <Link
              to={buildCustomerLedgerHref({
                customerId: selectedCustomer?.id,
                tab: 'payments',
                openPayment: true
              })}
              state={{ returnTo: location.pathname + location.search }}
              onClick={() => setShowLedgerModal(false)}
              className="inline-flex min-h-[44px] items-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
            >
              <DollarSign className="h-4 w-4 mr-2" aria-hidden />
              Record payment
            </Link>
            <Link
              to={buildCustomerLedgerHref({ customerId: selectedCustomer?.id })}
              state={{ returnTo: location.pathname + location.search }}
              onClick={() => setShowLedgerModal(false)}
              className="inline-flex min-h-[44px] items-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
            >
              <CreditCard className="h-4 w-4 mr-2" aria-hidden />
              Open Ledger
            </Link>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 ">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 ">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 ">
                    Reference
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 ">
                    Debit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 ">
                    Credit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 ">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {ledgerData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-neutral-500 text-sm">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  ledgerData.map((entry, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                        {new Date(entry.date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                        {entry.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                        {entry.reference}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${entry.balance < 0 ? 'text-success' : entry.balance > 0 ? 'text-error' : 'text-neutral-900'
 }`}>
                        {formatBalance(entry.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleShareWhatsApp}
              className="inline-flex items-center px-4 py-2 border border-neutral-300 rounded-md shadow-sm text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50"
            >
              <Phone className="h-4 w-4 mr-2" />
              Share via WhatsApp
            </button>
            <button
              onClick={handleExportStatement}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Statement
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDangerModal
        isOpen={dangerModal.isOpen}
        title={dangerModal.title}
        message={dangerModal.message}
        confirmLabel={dangerModal.confirmLabel}
        requireTypedText={dangerModal.requireTypedText}
        onConfirm={dangerModal.onConfirm}
        onClose={() => setDangerModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}

export default CustomersPage
