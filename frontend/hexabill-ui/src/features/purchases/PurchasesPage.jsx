import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { Plus, Edit, Trash2, Eye, Save, Search, X, RefreshCw, ExternalLink, Users, CreditCard } from 'lucide-react'
import { purchasesAPI, productsAPI, settingsAPI, suppliersAPI } from '../../services/index'
import { formatCurrency } from '../../utils/currency'
import toast from 'react-hot-toast'
import ConfirmDangerModal from '../../components/ConfirmDangerModal'
import Modal from '../../components/Modal'
import { localDateString } from '../../utils/dateFormat'
import { mobilePageShellClass } from '../../components/tallyFormClasses'
import { ListSkeleton } from '../../components/mobile/index'
import { readPurchasesStateFromParams, syncPurchasesSearchParams } from '../../utils/purchasesUrl'

const tallyInputClass = 'w-full max-w-full px-3 py-1.5 min-h-[44px] text-base md:text-sm border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50'
const tallySelectClass = tallyInputClass
const tallyLabelClass = 'block text-xs font-medium text-neutral-600 mb-1'
const tallySectionClass = 'mb-4 w-full max-w-full'
const tallySectionTitleClass = 'text-sm font-semibold text-neutral-900 mb-2'
const tallyVoucherShellClass = 'bg-white rounded-lg border border-neutral-200 p-3 sm:p-4 mb-4 w-full max-w-full overflow-hidden'

const VoucherSection = ({ title, children }) => (
  <div className={tallySectionClass}>
    <h3 className={tallySectionTitleClass}>{title}</h3>
    {children}
  </div>
)

const PurchasesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(() => Number(searchParams.get('page')) || 1)
  const [totalPages, setTotalPages] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState(null)

  // Filter states - initialized from URL params so filters survive navigation
  const [filterPeriod, setFilterPeriod] = useState(() => searchParams.get('period') || 'all')
  const [startDate, setStartDate] = useState(() => searchParams.get('startDate') || '')
  const [endDate, setEndDate] = useState(() => searchParams.get('endDate') || '')
  const [supplierSearch, setSupplierSearch] = useState(() => searchParams.get('supplier') || '')
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('category') || '')
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'all')
  const [exportingCsv, setExportingCsv] = useState(false)
  const [bulkFixingItc, setBulkFixingItc] = useState(false)

  // Analytics state
  const [analytics, setAnalytics] = useState(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  // Pending summary: total to pay + Unpaid / Partial / Paid counts
  const [pendingSummary, setPendingSummary] = useState(null)

  const [formData, setFormData] = useState({
    supplierName: '',
    invoiceNo: '',
    purchaseDate: localDateString(new Date()),
    expenseCategory: 'Inventory', // Default category
    paymentType: 'Credit', // Cash or Credit (pay later)
    isTaxClaimable: true, // VAT Return: include input VAT in Box 9b
    items: []
  })
  const [supplierSuggestions, setSupplierSuggestions] = useState([])
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false)
  const [supplierBalance, setSupplierBalance] = useState(null)
  const [supplierPickedFromList, setSupplierPickedFromList] = useState(false)
  const supplierPickedRef = useRef(false)
  const [products, setProducts] = useState([])
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [showProductSearch, setShowProductSearch] = useState(false)
  const searchInputRef = useRef(null)
  const formRef = useRef(null) // CRITICAL: Ref for scrolling to form
  const [vatPercent, setVatPercent] = useState(5) // From company settings; fallback when settings unavailable (TODO #5)
  const [dangerModal, setDangerModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    onConfirm: () => { }
  })
  const [supplierRegisterModal, setSupplierRegisterModal] = useState({ open: false, name: '' })
  const navigate = useNavigate()
  const [expandedPurchaseId, setExpandedPurchaseId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [mobileVoucherSection, setMobileVoucherSection] = useState('supplier')

  const toggleVoucherSection = (sectionId) => {
    setMobileVoucherSection((s) => (s === sectionId ? '' : sectionId))
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB')
  }

  // Sync filter state to URL so filters survive navigation and browser back
  useEffect(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      syncPurchasesSearchParams(params, {
        statusFilter,
        filterPeriod,
        startDate,
        endDate,
        supplierSearch,
        categoryFilter,
        currentPage
      })
      return params
    }, { replace: true })
  }, [statusFilter, filterPeriod, startDate, endDate, supplierSearch, categoryFilter, currentPage, setSearchParams])

  useEffect(() => {
    const parsed = readPurchasesStateFromParams(searchParams)
    setCurrentPage((p) => (p === parsed.currentPage ? p : parsed.currentPage))
    setFilterPeriod((v) => (v === parsed.filterPeriod ? v : parsed.filterPeriod))
    setStartDate((v) => (v === parsed.startDate ? v : parsed.startDate))
    setEndDate((v) => (v === parsed.endDate ? v : parsed.endDate))
    setSupplierSearch((v) => (v === parsed.supplierSearch ? v : parsed.supplierSearch))
    setCategoryFilter((v) => (v === parsed.categoryFilter ? v : parsed.categoryFilter))
    setStatusFilter((v) => (v === parsed.statusFilter ? v : parsed.statusFilter))
  }, [searchParams])

  useEffect(() => {
    loadPurchases()
    loadProducts()
    loadAnalytics()
    loadPendingSummary()
  }, [currentPage, filterPeriod, startDate, endDate, supplierSearch, categoryFilter, statusFilter])

  useEffect(() => {
    if (showProductSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showProductSearch])

  // F3 focuses product search (Phase 7.5)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F3') {
        e.preventDefault()
        if (showForm && searchInputRef.current) {
          searchInputRef.current.focus()
          setShowProductSearch(true)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showForm])

  // Supplier autocomplete â€” require â‰¥2 chars (match backend), debounce
  useEffect(() => {
    const q = (formData.supplierName || '').trim()
    if (!q || q.length < 2) {
      setSupplierSuggestions([])
      setShowSupplierSuggestions(false)
      if (!q) setSupplierBalance(null)
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await suppliersAPI.searchSuppliers(q, 10)
        if (res?.success && res?.data?.length) {
          setSupplierSuggestions(res.data)
          setShowSupplierSuggestions(true)
        } else {
          setSupplierSuggestions([])
        }
      } catch {
        setSupplierSuggestions([])
      }
    }, 300)
    return () => clearTimeout(t)
  }, [formData.supplierName])

  // Fetch supplier balance when supplier selected (Phase 7.4)
  useEffect(() => {
    const name = (formData.supplierName || '').trim()
    if (!name) {
      setSupplierBalance(null)
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await suppliersAPI.getSupplierBalance(name)
        if (res?.success && res?.data) setSupplierBalance(res.data)
        else setSupplierBalance(null)
      } catch {
        setSupplierBalance(null)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [formData.supplierName])

  // Fetch VAT from company settings (no hardcoded 5% â€” TODO #5)
  useEffect(() => {
    const fetchVat = async () => {
      try {
        const res = await settingsAPI.getCompanySettings()
        if (res?.success && res?.data?.vatPercent != null) {
          const v = parseFloat(res.data.vatPercent)
          if (!Number.isNaN(v) && v >= 0) setVatPercent(v)
        }
      } catch (_) { /* keep default */ }
    }
    fetchVat()
  }, [])

  const loadPurchases = async () => {
    try {
      setLoading(true)
      const params = { page: currentPage, pageSize: 10 }

      // Apply date filters based on period
      const dateRange = getDateRangeFromPeriod(filterPeriod)
      if (dateRange.startDate) params.startDate = dateRange.startDate
      if (dateRange.endDate) params.endDate = dateRange.endDate

      // Custom date range
      if (filterPeriod === 'custom') {
        if (startDate) params.startDate = startDate
        if (endDate) params.endDate = endDate
      }

      // Apply supplier filter
      if (supplierSearch) params.supplierName = supplierSearch

      // Apply category filter
      if (categoryFilter) params.category = categoryFilter

      // Apply status filter (paid, partial, unpaid, overdue)
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter

      const response = await purchasesAPI.getPurchases(params)
      if (response.success) {
        setPurchases(response.data.items)
        setTotalPages(response.data.totalPages)
      }
    } catch (error) {
      toast.error('Failed to load purchases')
    } finally {
      setLoading(false)
    }
  }

  const loadAnalytics = async () => {
    try {
      setLoadingAnalytics(true)
      const params = {}

      // Apply date filters for analytics
      const dateRange = getDateRangeFromPeriod(filterPeriod)
      if (dateRange.startDate) params.startDate = dateRange.startDate
      if (dateRange.endDate) params.endDate = dateRange.endDate

      if (filterPeriod === 'custom') {
        if (startDate) params.startDate = startDate
        if (endDate) params.endDate = endDate
      }

      const response = await purchasesAPI.getPurchaseAnalytics(params)
      if (response.success) {
        // Validate and sanitize analytics data to prevent calculation errors
        const sanitizedAnalytics = {
          totalAmount: Number(response.data.totalAmount) || 0,
          totalCount: Number(response.data.totalCount) || 0,
          totalItems: Number(response.data.totalItems) || 0,
          totalVat: Number(response.data.totalVat) || 0,
          todayTotal: Number(response.data.todayTotal) || 0,
          todayCount: Number(response.data.todayCount) || 0,
          yesterdayTotal: Number(response.data.yesterdayTotal) || 0,
          yesterdayCount: Number(response.data.yesterdayCount) || 0,
          thisWeekTotal: Number(response.data.thisWeekTotal) || 0,
          thisWeekCount: Number(response.data.thisWeekCount) || 0,
          lastWeekTotal: Number(response.data.lastWeekTotal) || 0,
          lastWeekCount: Number(response.data.lastWeekCount) || 0,
          topSupplierToday: response.data.topSupplierToday || null,
          topSupplierTodayAmount: Number(response.data.topSupplierTodayAmount) || 0,
          topSupplierWeek: response.data.topSupplierWeek || null,
          topSupplierWeekAmount: Number(response.data.topSupplierWeekAmount) || 0,
          dailyStats: (response.data.dailyStats || []).map(stat => ({
            date: stat.date,
            totalAmount: Number(stat.totalAmount) || 0,
            count: Number(stat.count) || 0,
            itemCount: Number(stat.itemCount) || 0
          })),
          supplierStats: (response.data.supplierStats || []).map(stat => ({
            supplierName: stat.supplierName || 'Unknown',
            totalAmount: Number(stat.totalAmount) || 0,
            count: Number(stat.count) || 0,
            itemCount: Number(stat.itemCount) || 0
          }))
        }
        setAnalytics(sanitizedAnalytics)
      }
    } catch (error) {
      console.error('Failed to load analytics:', error)
      // Set empty analytics to prevent UI errors
      setAnalytics({
        totalAmount: 0,
        totalCount: 0,
        totalItems: 0,
        totalVat: 0,
        todayTotal: 0,
        todayCount: 0,
        yesterdayTotal: 0,
        yesterdayCount: 0,
        thisWeekTotal: 0,
        thisWeekCount: 0,
        lastWeekTotal: 0,
        lastWeekCount: 0,
        topSupplierToday: null,
        topSupplierTodayAmount: 0,
        topSupplierWeek: null,
        topSupplierWeekAmount: 0,
        dailyStats: [],
        supplierStats: []
      })
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const loadPendingSummary = async () => {
    try {
      const response = await purchasesAPI.getPurchasePendingSummary()
      if (response?.success && response?.data) {
        setPendingSummary(response.data)
      } else {
        setPendingSummary(null)
      }
    } catch {
      setPendingSummary(null)
    }
  }

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true)
      const params = {}
      const dateRange = getDateRangeFromPeriod(filterPeriod)
      if (dateRange.startDate) params.startDate = dateRange.startDate
      if (dateRange.endDate) params.endDate = dateRange.endDate
      if (filterPeriod === 'custom') {
        if (startDate) params.startDate = startDate
        if (endDate) params.endDate = endDate
      }
      if (supplierSearch) params.supplierName = supplierSearch
      if (categoryFilter) params.category = categoryFilter
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter
      const blob = await purchasesAPI.exportCsv(params)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `purchases_${localDateString(new Date())}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV downloaded')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to export CSV')
    } finally {
      setExportingCsv(false)
    }
  }

  const handleBulkSetTaxClaimable = async () => {
    try {
      setBulkFixingItc(true)
      const res = await purchasesAPI.bulkSetTaxClaimable()
      if (res?.success) {
        toast.success(res.message || 'Tax claimable updated')
        loadPurchases()
      } else {
        toast.error(res?.message || 'Failed to update')
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update tax claimable')
    } finally {
      setBulkFixingItc(false)
    }
  }

  const getDateRangeFromPeriod = (period) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    switch (period) {
      case 'today':
        return { startDate: localDateString(today), endDate: localDateString(today) }

      case 'yesterday': {
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        return { startDate: localDateString(yesterday), endDate: localDateString(yesterday) }
      }

      case 'week': {
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - today.getDay())
        return { startDate: localDateString(startOfWeek), endDate: localDateString(today) }
      }

      case 'lastWeek': {
        const startOfLastWeek = new Date(today)
        startOfLastWeek.setDate(today.getDate() - today.getDay() - 7)
        const endOfLastWeek = new Date(startOfLastWeek)
        endOfLastWeek.setDate(startOfLastWeek.getDate() + 6)
        return { startDate: localDateString(startOfLastWeek), endDate: localDateString(endOfLastWeek) }
      }

      case 'month': {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        return { startDate: localDateString(startOfMonth), endDate: localDateString(today) }
      }

      default:
        return {}
    }
  }

  const loadProducts = async () => {
    try {
      const response = await productsAPI.getProducts({ pageSize: 100 })
      if (response.success) {
        setProducts(response.data.items || [])
      }
    } catch (error) {
      console.error('Failed to load products')
    }
  }

  const searchProducts = async (query) => {
    if (!query || query.length < 2) {
      loadProducts()
      return
    }
    try {
      const response = await productsAPI.searchProducts(query, 20)
      if (response.success) {
        setProducts(response.data || [])
      }
    } catch (error) {
      console.error('Failed to search products')
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (productSearchTerm) {
        searchProducts(productSearchTerm)
      }
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [productSearchTerm])

  const addItem = (product) => {
    // CRITICAL FIX: Use sellPrice for purchase cost if costPrice is not available
    // This ensures price auto-fills correctly when product is selected
    const unitCost = product.costPrice || product.sellPrice || 0

    const newItem = {
      productId: product.id,
      productName: product.nameEn,
      sku: product.sku,
      unitType: product.unitType,
      qty: 1,
      unitCost: unitCost
    }
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, newItem]
    }))
    setShowProductSearch(false)
    setProductSearchTerm('')
  }

  const updateItem = (index, field, value) => {
    setFormData((prev) => {
      const newItems = [...prev.items]
      const numValue = value === '' ? '' : (field === 'qty' || field === 'unitCost' ? Number(value) : value)
      newItems[index] = { ...newItems[index], [field]: numValue }
      return { ...prev, items: newItems }
    })
  }

  const removeItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => {
      const qty = typeof item.qty === 'number' ? item.qty : 0
      const unitCost = typeof item.unitCost === 'number' ? item.unitCost : 0
      return sum + (qty * unitCost)
    }, 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (formData.items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    // Validate all items have valid quantities and unit costs
    const invalidItems = formData.items.filter(item => {
      const qty = typeof item.qty === 'number' ? item.qty : parseFloat(item.qty)
      const unitCost = typeof item.unitCost === 'number' ? item.unitCost : parseFloat(item.unitCost)
      return isNaN(qty) || qty <= 0 || isNaN(unitCost) || unitCost < 0
    })

    if (invalidItems.length > 0) {
      toast.error('All items must have valid quantity (> 0) and unit cost (>= 0)')
      return
    }

    const trimmedSupplier = (formData.supplierName || '').trim()
    if (!editingPurchase) {
      try {
        // Always bypass GET cache: stale /by-name responses (e.g. id 0 legacy stub) block save after supplier is created
        const res = await suppliersAPI.getSupplier(trimmedSupplier, { bypassCache: true })
        const d = res?.data
        const regId = Number(d?.id ?? d?.Id ?? 0) || 0
        if (!res?.success || !d || regId <= 0) {
          setSupplierRegisterModal({ open: true, name: trimmedSupplier })
          return
        }
      } catch (err) {
        if (err?.response?.status === 404) {
          setSupplierRegisterModal({ open: true, name: trimmedSupplier })
          return
        }
        toast.error('Could not verify supplier. Check your connection and try again.')
        return
      }
    }

    try {
      setSubmitting(true)
      const purchaseDate = formData.purchaseDate || localDateString(new Date())
      const purchaseData = {
        supplierName: (formData.supplierName || '').trim(),
        invoiceNo: (formData.invoiceNo || '').trim(),
        purchaseDate,
        expenseCategory: formData.expenseCategory || 'Inventory',
        isTaxClaimable: formData.isTaxClaimable !== false,
        items: formData.items.map(item => ({
          productId: Number(item.productId),
          unitType: (item.unitType || 'PCS').trim().toUpperCase(),
          qty: typeof item.qty === 'number' ? item.qty : parseFloat(item.qty) || 0,
          unitCost: typeof item.unitCost === 'number' ? item.unitCost : parseFloat(item.unitCost) || 0
        }))
      }

      let response
      if (editingPurchase) {
        response = await purchasesAPI.updatePurchase(editingPurchase.id, purchaseData)
        if (response.success) {
          toast.success('Purchase updated successfully!', { id: 'purchase-update', duration: 4000 })
        } else {
          toast.error(response.message || 'Failed to update purchase')
        }
      } else {
        response = await purchasesAPI.createPurchase(purchaseData)
        if (response.success) {
          toast.success('Purchase created! Stock has been updated. If Products still show 0 stock, go to Products and click Recompute Stock.', { id: 'purchase-create', duration: 6000 })
        } else {
          toast.error(response.message || 'Failed to create purchase', { id: 'purchase-create' })
        }
      }

      if (response.success) {
        setShowForm(false)
        setEditingPurchase(null)
        setFormData({
          supplierName: '',
          invoiceNo: '',
          purchaseDate: localDateString(new Date()),
          expenseCategory: 'Inventory',
          paymentType: 'Credit',
          isTaxClaimable: true,
          items: []
        })
        loadPurchases()
        loadAnalytics()
        loadPendingSummary()
        window.dispatchEvent(new CustomEvent('dataUpdated'))
        // After create: recompute stock from movements so product qty updates everywhere
        if (!editingPurchase) {
          productsAPI.recomputeStock().then(() => loadProducts()).catch(() => loadProducts())
        } else {
          setTimeout(() => loadProducts(), 150)
        }
      }
    } catch (error) {
      console.error('Purchase submit error:', error)
      const data = error?.response?.data
      const errors = data?.errors
      const errorMsg = (Array.isArray(errors) && errors.length && errors[0]) || data?.message || 'Failed to save purchase'
      toast.error(editingPurchase ? `Update failed: ${errorMsg}` : `Create failed: ${errorMsg}`, { duration: 6000 })
    } finally {
      setSubmitting(false)
    }
  }

  const handleNewPurchase = () => {
    setEditingPurchase(null)
    setFormData({
      supplierName: '',
      invoiceNo: '',
      purchaseDate: localDateString(new Date()),
      expenseCategory: 'Inventory',
      paymentType: 'Credit',
      isTaxClaimable: true,
      items: []
    })
        setMobileVoucherSection('supplier')
        setShowForm(true)

    // CRITICAL FIX: Scroll to form after it opens
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100) // Small delay to ensure form is rendered
  }

  const handleEditPurchase = (purchase) => {
    setEditingPurchase(purchase)
    setFormData({
      supplierName: purchase.supplierName || '',
      invoiceNo: purchase.invoiceNo || '',
      purchaseDate: purchase.purchaseDate ? localDateString(new Date(purchase.purchaseDate)) : localDateString(new Date()),
      expenseCategory: purchase.expenseCategory || 'Inventory',
      paymentType: 'Credit',
      isTaxClaimable: purchase.isTaxClaimable !== false,
      items: purchase.items?.map(item => ({
        productId: item.productId,
        productName: item.productName || item.product?.nameEn || '',
        sku: item.product?.sku || '',
        unitType: item.unitType || 'CRTN',
        qty: item.qty || 0,
        unitCost: item.unitCost || 0
      })) || []
    })
        setMobileVoucherSection('supplier')
        setShowForm(true)
  }

  const handleDeletePurchase = (purchase) => {
    const confirmMessage = `Invoice: ${purchase.invoiceNo}\n` +
      `Supplier: ${purchase.supplierName}\n` +
      `Amount: ${formatCurrency(purchase.totalAmount)}\n` +
      `Items: ${purchase.items?.length || 0}\n\n` +
      `This will reverse all stock changes and remove inventory transactions.`

    setDangerModal({
      isOpen: true,
      title: 'Delete Purchase?',
      message: confirmMessage,
      confirmLabel: 'Delete Purchase',
      onConfirm: async () => {
        try {
          const response = await purchasesAPI.deletePurchase(purchase.id)
          if (response.success) {
            toast.success(`Purchase deleted! Stock reversed for ${response.data.itemsCount} items.`, { id: 'purchase-delete', duration: 4000 })
            loadPurchases()
            loadAnalytics()
            loadPendingSummary()
            loadProducts()
            window.dispatchEvent(new CustomEvent('dataUpdated'))
          } else {
            toast.error(response.message || 'Failed to delete purchase', { id: 'purchase-delete' })
          }
        } catch (error) {
          console.error('Delete purchase error:', error)
          const errorMsg = error?.response?.data?.message || 'Failed to delete purchase'
          toast.error(`Delete failed: ${errorMsg}`)
        }
      }
    })
  }

  const canPayPurchase = (purchase) => {
    const status = (purchase.paymentStatus || '').toLowerCase()
    const balance = Number(purchase.balanceAmount ?? purchase.totalAmount ?? 0)
    return status !== 'paid' && balance > 0.009
  }

  const openPay = (purchase) => {
    navigate(`/suppliers/${encodeURIComponent(purchase.supplierName || '')}?recordPayment=1&amount=${purchase.balanceAmount ?? purchase.totalAmount}&ref=${encodeURIComponent(purchase.invoiceNo || '')}`, { state: { returnTo: location.pathname + location.search } })
  }

  const clearPurchaseFilters = () => {
    setCurrentPage(1)
    setFilterPeriod('all')
    setStartDate('')
    setEndDate('')
    setSupplierSearch('')
    setCategoryFilter('')
    setStatusFilter('all')
  }

  const statusChip = (id, label, count) => {
    const active = statusFilter === id
    const tone = id === 'paid' ? 'text-green-800' : id === 'unpaid' || id === 'overdue' ? 'text-red-800' : 'text-amber-800'
    return (
      <button
        type="button"
        onClick={() => { setCurrentPage(1); setStatusFilter(active ? 'all' : id) }}
        aria-pressed={active}
        className={`min-h-[44px] rounded-md border px-3 text-left ${active ? 'border-primary-600 bg-primary-50' : 'border-neutral-200 bg-white'}`}
      >
        <span className="block text-xs text-neutral-500">{label}</span>
        <span className={`block text-sm font-semibold tabular-nums ${tone}`}>{count}</span>
      </button>
    )
  }

  // Purchase page
  return (
    <div className={`h-full min-h-0 bg-neutral-50 overflow-x-hidden w-full flex flex-col ${mobilePageShellClass}`}>
      <div className="bg-white border-b border-neutral-200 px-3 sm:px-4 py-2 sticky top-0 z-20">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-neutral-900">Purchases</h1>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => { loadPurchases(); loadAnalytics(); loadPendingSummary() }}
              className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-neutral-300 bg-white"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/suppliers')}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 md:flex-none"
            >
              <Users className="h-4 w-4" />
              Add Supplier
            </button>
            <button
              type="button"
              onClick={handleNewPurchase}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-md bg-primary-600 px-3 text-sm font-medium text-white md:flex-none"
            >
              <Plus className="h-4 w-4" />
              New Purchase
            </button>
          </div>
        </div>
      </div>

      <div className="p-2 sm:p-4 w-full">
        <div className="mb-3 rounded-lg border border-neutral-200 bg-white p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
            <label className="text-xs font-medium text-neutral-500 lg:col-span-2">
              Supplier
              <input type="search" aria-label="Search supplier" placeholder="Search supplier or invoice" className="mt-1 block min-h-[44px] w-full rounded-md border border-neutral-300 px-2 text-base md:text-sm" value={supplierSearch} onChange={(e) => { setCurrentPage(1); setSupplierSearch(e.target.value) }} />
            </label>
            <label className="text-xs font-medium text-neutral-500">
              Status
              <select aria-label="Status" className="mt-1 block min-h-[44px] w-full rounded-md border border-neutral-300 bg-white px-2 text-base md:text-sm" value={statusFilter} onChange={(e) => { setCurrentPage(1); setStatusFilter(e.target.value) }}>
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </label>
            <label className="text-xs font-medium text-neutral-500">
              Period
              <select aria-label="Period" className="mt-1 block min-h-[44px] w-full rounded-md border border-neutral-300 bg-white px-2 text-base md:text-sm" value={filterPeriod} onChange={(e) => { setCurrentPage(1); setFilterPeriod(e.target.value) }}>
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This week</option>
                <option value="lastWeek">Last week</option>
                <option value="month">This month</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="text-xs font-medium text-neutral-500">
              Category
              <select aria-label="Category" className="mt-1 block min-h-[44px] w-full rounded-md border border-neutral-300 bg-white px-2 text-base md:text-sm" value={categoryFilter} onChange={(e) => { setCurrentPage(1); setCategoryFilter(e.target.value) }}>
                <option value="">All categories</option>
                <option value="Inventory">Inventory</option>
                <option value="Supplies">Supplies</option>
                <option value="Equipment">Equipment</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={handleExportCsv} disabled={exportingCsv} className="min-h-[44px] flex-1 rounded-md border border-neutral-300 bg-white px-2 text-sm">{exportingCsv ? 'Exportingâ€¦' : 'Export'}</button>
              <button type="button" onClick={clearPurchaseFilters} className="min-h-[44px] flex-1 rounded-md border border-neutral-300 bg-white px-2 text-sm">Clear</button>
            </div>
          </div>
          {filterPeriod === 'custom' && (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="text-xs font-medium text-neutral-500">From
                <input type="date" aria-label="From" className="mt-1 block min-h-[44px] w-full rounded-md border border-neutral-300 px-2 text-base md:text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label className="text-xs font-medium text-neutral-500">To
                <input type="date" aria-label="To" className="mt-1 block min-h-[44px] w-full rounded-md border border-neutral-300 px-2 text-base md:text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
            </div>
          )}
          {loading && <p className="mt-2 text-xs text-neutral-500">Loadingâ€¦</p>}
        </div>

        {pendingSummary && (
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <button type="button" onClick={() => { setCurrentPage(1); setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending') }} aria-pressed={statusFilter === 'pending'} className={`min-h-[44px] rounded-md border px-3 text-left ${statusFilter === 'pending' ? 'border-primary-600 bg-primary-50' : 'border-neutral-200 bg-white'}`}>
              <span className="block text-xs text-neutral-500">Pending</span>
              <span className="block text-sm font-semibold tabular-nums text-amber-800">{formatCurrency(pendingSummary.totalPendingToPay ?? 0)}</span>
            </button>
            {statusChip('unpaid', 'Unpaid', pendingSummary.unpaidCount ?? 0)}
            {statusChip('partial', 'Partial', pendingSummary.partialCount ?? 0)}
            {statusChip('paid', 'Paid', pendingSummary.paidCount ?? 0)}
            {statusChip('overdue', 'Overdue', pendingSummary.overdueCount ?? 0)}
          </div>
        )}

        {/* Purchase Form - Tally Style - mobile: single column, no horizontal scroll */}
        {showForm && (
          <div ref={formRef} className={`${tallyVoucherShellClass} shadow-lg`}>
            <div className="flex items-center justify-between mb-3 sm:mb-4 border-b-2 border-neutral-200 pb-2">
              <h2 className="text-base sm:text-lg font-bold text-primary-800">
                {editingPurchase ? 'Edit Purchase Entry' : 'New Purchase Entry'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-primary-500 hover:text-primary-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="pb-24 md:pb-0">
              {/* (1) Supplier Section */}
              <VoucherSection
                sectionId="supplier"
                title="Supplier"
                isOpen={mobileVoucherSection === 'supplier'}
                onToggle={toggleVoucherSection}
              >
                <div className="relative">
                  <label className={tallyLabelClass}>Supplier Name *</label>
                  <input
                    type="text"
                    required
                    className={tallyInputClass}
                    value={formData.supplierName}
                    onChange={(e) => {
                      supplierPickedRef.current = false
                      setSupplierPickedFromList(false)
                      setFormData((prev) => ({ ...prev, supplierName: e.target.value }))
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setShowSupplierSuggestions(false)
                        // Clear free-text that was not chosen from directory (reduces duplicate glitch)
                        const typed = (formData.supplierName || '').trim()
                        if (typed && !supplierPickedRef.current) {
                          const exact = supplierSuggestions.some((name) => {
                            const label = typeof name === 'string' ? name : (name?.name || String(name))
                            return label.trim().toLowerCase() === typed.toLowerCase()
                          })
                          if (!exact && supplierSuggestions.length > 0) {
                            // Keep typed free-text for legacy name-only purchases; only clear if partial match clutter
                            // Do not wipe â€” balance lookup still works by exact name.
                          }
                        }
                      }, 200)
                    }}
                    onFocus={() => supplierSuggestions.length > 0 && setShowSupplierSuggestions(true)}
                  />
                  {showSupplierSuggestions && supplierSuggestions.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white border-2 border-neutral-200 rounded shadow-lg max-h-48 overflow-y-auto">
                      {supplierSuggestions.map((name, i) => {
                        const label = typeof name === 'string' ? name : (name?.name || String(name))
                        const pickSupplier = (ev) => {
                          ev.preventDefault()
                          ev.stopPropagation()
                          supplierPickedRef.current = true
                          setSupplierPickedFromList(true)
                          setFormData((prev) => ({ ...prev, supplierName: label }))
                          setShowSupplierSuggestions(false)
                        }
                        return (
                          <button
                            key={`${label}-${i}`}
                            type="button"
                            className="block w-full text-left px-3 py-2 hover:bg-neutral-50 text-sm"
                            onMouseDown={pickSupplier}
                            onClick={pickSupplier}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {supplierPickedFromList && formData.supplierName.trim() && (
                    <p className="text-[10px] text-slate-500 mt-0.5">Selected from supplier directory</p>
                  )}
                </div>
              </VoucherSection>

              {/* (2) Invoice Information */}
              <VoucherSection
                sectionId="invoice"
                title="Invoice Information"
                isOpen={mobileVoucherSection === 'invoice'}
                onToggle={toggleVoucherSection}
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[11rem_11rem_minmax(0,1fr)_minmax(0,1fr)]">
                  <div>
                    <label className={tallyLabelClass}>Invoice No *</label>
                    <input type="text" required className={tallyInputClass} value={formData.invoiceNo} onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })} />
                  </div>
                  <div>
                    <label className={tallyLabelClass}>Purchase Date *</label>
                    <input type="date" required className={tallyInputClass} value={formData.purchaseDate} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })} />
                  </div>
                  <div>
                    <label className={tallyLabelClass}>Expense Category *</label>
                    <select required className={tallySelectClass} value={formData.expenseCategory} onChange={(e) => setFormData({ ...formData, expenseCategory: e.target.value })}>
                      <option value="Inventory">Inventory (Stock Items)</option>
                      <option value="Supplies">Supplies (Office/Packaging)</option>
                      <option value="Equipment">Equipment (Machinery/Tools)</option>
                      <option value="Maintenance">Maintenance & Repairs</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </VoucherSection>

              {/* (3) Payment Type + VAT Return ITC */}
              <VoucherSection
                sectionId="payment"
                title="Payment Type & VAT Return"
                isOpen={mobileVoucherSection === 'payment'}
                onToggle={toggleVoucherSection}
              >
                <div className="flex flex-wrap gap-4 items-center">
                  <select className={tallySelectClass} value={formData.paymentType} onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}>
                    <option value="Cash">Cash (Pay Now)</option>
                    <option value="Credit">Credit (Pay Later)</option>
                  </select>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isTaxClaimable !== false}
                      onChange={(e) => setFormData({ ...formData, isTaxClaimable: e.target.checked })}
                      className="rounded border-neutral-200 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm font-medium text-primary-700">Tax claimable (ITC)</span>
                    <span className="text-xs text-primary-500" title="Include input VAT in VAT Return Box 9b">Include in VAT Return</span>
                  </label>
                </div>
              </VoucherSection>

              {/* (4) Supplier Balance Info */}
              {formData.supplierName.trim() && supplierBalance != null && (
                <div className="mb-4 sm:mb-6 p-3 bg-amber-50 rounded-lg border-2 border-amber-200">
                  <h3 className="text-sm font-bold text-amber-800 mb-2">Supplier Balance</h3>
                  <p className="text-sm text-amber-800">Current due: {formatCurrency(supplierBalance?.netPayable || 0)}</p>
                  <p className="text-sm text-amber-700 mt-1">
                    After this purchase: {formatCurrency((supplierBalance?.netPayable || 0) + (calculateTotal() * (1 + vatPercent / 100)))}
                  </p>
                </div>
              )}

              {/* (5) Product Entry Table */}
              <VoucherSection
                sectionId="items"
                title="Product Entry & line items"
                isOpen={mobileVoucherSection === 'items'}
                onToggle={toggleVoucherSection}
              >
                <label className={tallyLabelClass}>Add Product (F3)</label>
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search products..."
                    className={tallyInputClass}
                    value={productSearchTerm}
                    onChange={(e) => {
                      setProductSearchTerm(e.target.value)
                      setShowProductSearch(true)
                    }}
                    onFocus={() => setShowProductSearch(true)}
                  />
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary-400" />
                </div>

                {showProductSearch && products.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-w-md bg-white border-2 border-neutral-200 rounded shadow-lg max-h-64 overflow-y-auto">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        className="p-2 border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                        onClick={() => addItem(product)}
                      >
                        <div className="flex justify-between">
                          <div>
                            <p className="font-medium text-sm">{product.nameEn}</p>
                            <p className="text-xs text-primary-500">SKU: {product.sku}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{formatCurrency(product.costPrice || 0)}</p>
                            <p className="text-xs text-primary-500">Stock: {product.stockQty}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              {/* Items - Mobile: vertical cards (no horizontal scroll); Desktop: table */}
              <div className="mb-4 w-full max-w-full mt-4">
                <div className="bg-neutral-50 p-2 border-b-2 border-neutral-200">
                  <h3 className="text-sm font-bold text-primary-800">Items</h3>
                </div>

                {/* Mobile: compact cards per item */}
                <div className="md:hidden space-y-2 max-h-[320px] overflow-y-auto border-2 border-neutral-200 border-t-0 rounded-b-lg p-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {formData.items.length === 0 ? (
                    <p className="text-center text-primary-500 text-sm py-4">No items. Search and add products above.</p>
                  ) : (
                    formData.items.map((item, index) => {
                      const qty = typeof item.qty === 'number' ? item.qty : parseFloat(item.qty) || 0
                      const cost = typeof item.unitCost === 'number' ? item.unitCost : parseFloat(item.unitCost) || 0
                      const subtotal = qty * cost
                      const vat = subtotal * (vatPercent / 100)
                      const total = subtotal + vat
                      return (
                        <div key={index} className="bg-neutral-50 rounded-lg border border-neutral-200 p-3">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-primary-800 text-sm truncate">{item.productName}</p>
                              <p className="text-xs text-primary-500">{item.sku}</p>
                            </div>
                            <button type="button" onClick={() => removeItem(index)} className="shrink-0 text-red-600 p-1" aria-label="Remove">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <label className="text-xs text-primary-500">Qty</label>
                              <input type="number" min="0" step="0.01" className="w-full min-h-11 px-2 border border-neutral-200 rounded text-base md:text-sm" value={item.qty === '' ? '' : item.qty} onChange={(e) => updateItem(index, 'qty', e.target.value)} />
                            </div>
                            <div>
                              <label className="text-xs text-primary-500">Unit</label>
                              <select className="w-full px-2 py-1 border border-neutral-200 rounded text-xs uppercase" value={item.unitType || 'PCS'} onChange={(e) => updateItem(index, 'unitType', e.target.value)}>
                                <option value="PCS">PCS</option>
                                <option value="CRTN">CRTN</option>
                                <option value="KG">KG</option>
                                <option value="BOX">BOX</option>
                                <option value="PKG">PKG</option>
                                <option value="BAG">BAG</option>
                                <option value="LTR">LTR</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-primary-500">Unit cost</label>
                              <input type="number" min="0" step="0.01" className="w-full min-h-11 px-2 border border-neutral-200 rounded text-base md:text-sm" value={item.unitCost === '' ? '' : item.unitCost} onChange={(e) => updateItem(index, 'unitCost', e.target.value)} />
                            </div>
                            <div className="flex flex-col justify-end">
                              <span className="text-xs text-primary-500">Total</span>
                              <span className="text-sm font-bold text-green-700">{formatCurrency(total)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                  {formData.items.length > 0 && (
                    <div className="pt-2 border-t border-neutral-200 mt-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-primary-600">Subtotal</span>
                        <span className="font-medium">{formatCurrency(calculateTotal())}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-orange-600">VAT ({vatPercent}%)</span>
                        <span className="font-medium text-orange-600">{formatCurrency(calculateTotal() * (vatPercent / 100))}</span>
                      </div>
                      <div className="flex justify-between text-base font-bold text-green-700 mt-1">
                        <span>Total</span>
                        <span>{formatCurrency(calculateTotal() * (1 + vatPercent / 100))}</span>
                      </div>
                      <label className="flex items-center gap-2 mt-2 text-sm text-primary-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isTaxClaimable !== false}
                          onChange={(e) => setFormData({ ...formData, isTaxClaimable: e.target.checked })}
                          className="rounded border-neutral-200 text-green-600"
                        />
                        <span>Tax claimable (ITC) â€“ include in VAT Return Box 9b</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Desktop: table */}
                <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[400px] w-full max-w-full border-2 border-neutral-200 border-t-0 rounded-b-lg" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <table className="w-full text-xs border-collapse min-w-[640px]">
                    <thead className="bg-neutral-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-2 border-r border-neutral-200 text-left">SL</th>
                        <th className="px-2 py-2 border-r border-neutral-200 text-left">Description</th>
                        <th className="px-2 py-2 border-r border-neutral-200 text-left">Unit</th>
                        <th className="px-2 py-2 border-r border-neutral-200 text-left">Qty</th>
                        <th className="px-2 py-2 border-r border-neutral-200 text-left">Unit Cost</th>
                        <th className="px-2 py-2 border-r border-neutral-200 text-left">Subtotal</th>
                        <th className="px-2 py-2 border-r border-neutral-200 text-left">VAT ({vatPercent}%)</th>
                        <th className="px-2 py-2 text-left">Total</th>
                        <th className="px-2 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-lime-200">
                      {formData.items.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="px-4 py-8 text-center text-primary-500">
                            No items. Search and add products.
                          </td>
                        </tr>
                      ) : (
                        formData.items.map((item, index) => (
                          <tr key={index} className="hover:bg-neutral-50">
                            <td className="px-2 py-2 border-r border-neutral-100 text-center">{index + 1}</td>
                            <td className="px-2 py-2 border-r border-neutral-100">
                              <div>
                                <p className="font-medium">{item.productName}</p>
                                <p className="text-primary-500">{item.sku}</p>
                              </div>
                            </td>
                            <td className="px-2 py-2 border-r border-neutral-100">
                              <select
                                className="w-full min-h-[44px] px-1 border border-neutral-200 rounded text-sm uppercase"
                                value={item.unitType || 'CRTN'}
                                onChange={(e) => updateItem(index, 'unitType', e.target.value)}
                              >
                                <option value="CRTN">CRTN</option>
                                <option value="KG">KG</option>
                                <option value="PIECE">PIECE</option>
                                <option value="BOX">BOX</option>
                                <option value="PKG">PKG</option>
                                <option value="BAG">BAG</option>
                                <option value="PC">PC</option>
                                <option value="UNIT">UNIT</option>
                                <option value="CTN">CTN</option>
                                <option value="PCS">PCS</option>
                                <option value="LTR">LTR</option>
                                <option value="MTR">MTR</option>
                              </select>
                            </td>
                            <td className="px-2 py-2 border-r border-neutral-100">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-20 min-h-[44px] px-1 border border-neutral-200 rounded text-sm"
                                value={item.qty === '' ? '' : item.qty}
                                onChange={(e) => updateItem(index, 'qty', e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-2 border-r border-neutral-100">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-20 min-h-[44px] px-1 border border-neutral-200 rounded text-sm"
                                value={item.unitCost === '' ? '' : item.unitCost}
                                onChange={(e) => updateItem(index, 'unitCost', e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-2 border-r border-neutral-100 text-primary-600">
                              {(() => {
                                const qty = typeof item.qty === 'number' ? item.qty : 0
                                const cost = typeof item.unitCost === 'number' ? item.unitCost : 0
                                return formatCurrency(qty * cost)
                              })()}
                            </td>
                            <td className="px-2 py-2 border-r border-neutral-100 text-orange-600">
                              {(() => {
                                const qty = typeof item.qty === 'number' ? item.qty : 0
                                const cost = typeof item.unitCost === 'number' ? item.unitCost : 0
                                return formatCurrency(qty * cost * (vatPercent / 100))
                              })()}
                            </td>
                            <td className="px-2 py-2 font-bold text-green-700">
                              {(() => {
                                const qty = typeof item.qty === 'number' ? item.qty : 0
                                const cost = typeof item.unitCost === 'number' ? item.unitCost : 0
                                return formatCurrency(qty * cost * (1 + vatPercent / 100))
                              })()}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-neutral-50">
                      <tr>
                        <td colSpan="5" className="px-2 py-2 text-right font-bold border-r border-neutral-200">Totals:</td>
                        <td className="px-2 py-2 font-bold text-primary-700 border-r border-neutral-200">
                          {formatCurrency(calculateTotal())}
                        </td>
                        <td className="px-2 py-2 font-bold text-orange-600 border-r border-neutral-200">
                          {formatCurrency(calculateTotal() * (vatPercent / 100))}
                        </td>
                        <td className="px-2 py-2 font-bold text-green-700">
                          {formatCurrency(calculateTotal() * (1 + vatPercent / 100))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              </VoucherSection>

              {/* (6) Totals - shown in items table foot; (7) Actions - sticky on mobile above BottomNav */}
              <div className="flex justify-end space-x-3 mt-4 md:static fixed bottom-[4.75rem] left-0 right-0 p-4 bg-white border-t-2 border-neutral-200 md:border-0 md:bottom-0 md:p-0 z-10 md:z-auto">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 min-h-11 border-2 border-neutral-200 rounded text-base font-medium hover:bg-neutral-50">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 min-h-11 bg-primary-600 text-white rounded text-base font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center">
                  <Save className="h-4 w-4 mr-2" /> {submitting ? 'Savingâ€¦' : 'Save Purchase'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Purchases List */}
        <div className="bg-white rounded-lg border-2 border-neutral-200 shadow-sm w-full overflow-hidden">
          <div className="p-3 sm:p-4 border-b-2 border-neutral-200 bg-neutral-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-primary-800">Purchase List</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/vat-return')}
                  className="px-2 py-1 rounded text-xs font-medium bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 flex items-center gap-1"
                  title="VAT Return â€“ track and fix zero values"
                >
                  <ExternalLink className="h-3 w-3" /> VAT Return
                </button>
                <button
                  type="button"
                  onClick={handleBulkSetTaxClaimable}
                  disabled={bulkFixingItc || loading}
                  className="px-2 py-1 rounded text-xs font-medium bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 disabled:opacity-50"
                  title="Mark all purchases with VAT as Tax claimable (ITC) for VAT Return"
                >
                  {bulkFixingItc ? 'Updatingâ€¦' : 'Mark all with VAT as claimable'}
                </button>
              </div>
            </div>
          </div>
          {loading ? (
            <div className="p-3" aria-busy="true" aria-label="Loading purchases">
              <ListSkeleton count={6} />
            </div>
          ) : (
            <>
              {/* Desktop Table - scroll contained, no page overflow */}
              <div className="hidden md:block overflow-x-auto max-w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-xs min-w-[700px]">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-2 border-r border-neutral-200 text-left">Invoice No</th>
                      <th className="px-3 py-2 border-r border-neutral-200 text-left">Supplier</th>
                      <th className="px-3 py-2 border-r border-neutral-200 text-left">Date</th>
                      <th className="px-3 py-2 border-r border-neutral-200 text-right">Subtotal</th>
                      <th className="px-3 py-2 border-r border-neutral-200 text-right">VAT ({vatPercent}%)</th>
                      <th className="px-3 py-2 border-r border-neutral-200 text-center" title="VAT Return: Tax claimable (ITC)">ITC</th>
                      <th className="px-3 py-2 border-r border-neutral-200 text-right">Total</th>
                      <th className="px-3 py-2 border-r border-neutral-200 text-right" title="Vendor discount / ledger credits">V.Disc</th>
                      <th className="px-3 py-2 border-r border-neutral-200 text-right">Paid</th>
                      <th className="px-3 py-2 border-r border-neutral-200 text-right">Balance</th>
                      <th className="px-3 py-2 border-r border-neutral-200 text-center">Status</th>
                      <th className="px-3 py-2 border-r border-neutral-200 text-center">Items</th>
                      <th className="px-3 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lime-200">
                    {purchases.length === 0 ? (
                      <tr>
                        <td colSpan="13" className="px-4 py-8 text-center">
                          <div className="text-primary-500">
                            {statusFilter && statusFilter !== 'all' ? (
                              <>
                                <p className="font-medium text-primary-700 mb-1">No {statusFilter} purchases found</p>
                                <p className="text-sm">Try a different status filter or clear filters</p>
                              </>
                            ) : filterPeriod === 'today' ? (
                              <>
                                <p className="font-medium text-primary-700 mb-1">No purchases found for today</p>
                                <p className="text-sm">Change filter to "All Time" to see all purchases or create a new purchase</p>
                              </>
                            ) : filterPeriod !== 'all' ? (
                              <>
                                <p className="font-medium text-primary-700 mb-1">No purchases found for selected period</p>
                                <p className="text-sm">Try changing the date range or clear filters</p>
                              </>
                            ) : (
                              <>
                                <p className="font-medium text-primary-700 mb-1">No purchases found</p>
                                <p className="text-sm">Create your first purchase to get started</p>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      purchases.map((purchase) => (
                        <tr key={purchase.id} className="hover:bg-neutral-50">
                          <td className="px-3 py-2 font-medium">{purchase.invoiceNo}</td>
                          <td className="px-3 py-2">{purchase.supplierName}</td>
                          <td className="px-3 py-2">{new Date(purchase.purchaseDate).toLocaleDateString('en-GB')}</td>
                          <td className="px-3 py-2 text-right">
                            {purchase.subtotal ? (
                              <span className="text-primary-700">{formatCurrency(purchase.subtotal)}</span>
                            ) : (
                              <span className="text-primary-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {purchase.vatTotal ? (
                              <span className="text-orange-600 font-medium">{formatCurrency(purchase.vatTotal)}</span>
                            ) : (
                              <span className="text-primary-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              (purchase.isTaxClaimable ?? purchase.IsTaxClaimable) !== false ? 'bg-green-100 text-green-800' : 'bg-neutral-100 text-neutral-500'
                            }`} title="VAT Return: Input Tax Credit claimable">
                              {(purchase.isTaxClaimable ?? purchase.IsTaxClaimable) !== false ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-green-700">{formatCurrency(purchase.totalAmount)}</td>
                          <td className="px-3 py-2 text-right text-purple-600">
                            {(purchase.vendorDiscountAmount ?? 0) > 0 ? formatCurrency(purchase.vendorDiscountAmount) : <span className="text-primary-400">-</span>}
                          </td>
                          <td className="px-3 py-2 text-right text-primary-600">{formatCurrency(purchase.paidAmount ?? 0)}</td>
                          <td className="px-3 py-2 text-right font-medium text-amber-700">{formatCurrency(purchase.balanceAmount ?? purchase.totalAmount ?? 0)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              (purchase.paymentStatus || '').toLowerCase() === 'paid' ? 'bg-green-100 text-green-800' :
                              (purchase.paymentStatus || '').toLowerCase() === 'partial' ? 'bg-amber-100 text-amber-800' :
                              (purchase.paymentStatus || '').toLowerCase() === 'overdue' ? 'bg-red-100 text-red-800' :
                              'bg-neutral-100 text-neutral-700'
                            }`}>
                              {purchase.paymentStatus || 'Unpaid'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">{purchase.items?.length || 0}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap justify-center gap-1">
                              {(canPayPurchase(purchase) && (
                                <button
                                  onClick={() => openPay(purchase)}
                                  className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 text-xs font-medium text-neutral-800"
                                  title={`Pay ${formatCurrency(purchase.balanceAmount ?? purchase.totalAmount ?? 0)}`}
                                >
                                  <CreditCard className="h-3.5 w-3.5" /> Pay
                                </button>
                              ))}
                              <button
                                onClick={() => navigate(`/suppliers/${encodeURIComponent(purchase.supplierName || '')}`, { state: { returnTo: location.pathname + location.search } })}
                                className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 text-xs font-medium text-neutral-800"
                                title="Supplier Ledger (full page)"
                              >
                                <Eye className="h-3.5 w-3.5" /> Ledger
                              </button>
                              <button
                                onClick={() => handleEditPurchase(purchase)}
                                className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 text-xs font-medium text-neutral-800"
                                title="Edit Purchase"
                                aria-label="Edit Purchase"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeletePurchase(purchase)}
                                className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-red-300 bg-white px-2 text-xs font-medium text-red-700"
                                title="Delete Purchase"
                                aria-label="Delete Purchase"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3 p-4">
                {purchases.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-primary-500">
                      {statusFilter && statusFilter !== 'all' ? (
                        <>
                          <p className="font-medium text-primary-700 mb-1">No {statusFilter} purchases found</p>
                          <p className="text-sm">Try a different status filter or clear filters</p>
                        </>
                      ) : filterPeriod === 'today' ? (
                        <>
                          <p className="font-medium text-primary-700 mb-1">No purchases found for today</p>
                          <p className="text-sm">Change filter to "All Time" to see all purchases or create a new purchase</p>
                        </>
                      ) : filterPeriod !== 'all' ? (
                        <>
                          <p className="font-medium text-primary-700 mb-1">No purchases found for selected period</p>
                          <p className="text-sm">Try changing the date range or clear filters</p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-primary-700 mb-1">No purchases found</p>
                          <p className="text-sm">Create your first purchase to get started</p>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  purchases.map((purchase) => {
                    const isExpanded = expandedPurchaseId === purchase.id
                    return (
                    <div key={purchase.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                      <button
                        type="button"
                        onClick={() => setExpandedPurchaseId(isExpanded ? null : purchase.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm font-semibold text-neutral-900">{purchase.invoiceNo}</p>
                            <p className="text-xs text-neutral-500">{purchase.supplierName}</p>
                            <p className="text-xs text-neutral-500">{formatDate(purchase.purchaseDate)}</p>
                            <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                              (purchase.paymentStatus || '').toLowerCase() === 'paid' ? 'bg-green-100 text-green-800' :
                              (purchase.paymentStatus || '').toLowerCase() === 'partial' || (purchase.paymentStatus || '').toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'
                            }`}>{purchase.paymentStatus || 'Unpaid'}</span>
                          </div>
                          <p className="text-base font-bold text-primary-800">{formatCurrency(purchase.totalAmount || 0)}</p>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                          <span>{formatCurrency(purchase.balanceAmount ?? purchase.totalAmount ?? 0)} due</span>
                          <span>{isExpanded ? 'Hide' : 'View'}</span>
                        </div>
                      </button>
                      {isExpanded && purchase.items?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                          <p className="text-xs font-medium text-primary-600 mb-2">Items</p>
                          {purchase.items.map((item, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row sm:justify-between gap-1 text-xs py-1">
                              <span className="text-primary-700 min-w-0 break-words">{item.productName || item.product?.nameEn || 'Item'}</span>
                              <span>{item.qty} Ã— {formatCurrency(item.unitCost || 0)} = {formatCurrency((item.qty || 0) * (item.unitCost || 0))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-100 text-xs">
                        <div>
                          <p className="text-primary-500">Paid</p>
                          <p className="font-medium text-green-600">{formatCurrency(purchase.paidAmount ?? 0)}</p>
                        </div>
                        <div>
                          <p className="text-primary-500">Balance</p>
                          <p className="font-medium text-amber-600">{formatCurrency(purchase.balanceAmount ?? purchase.totalAmount ?? 0)}</p>
                        </div>
                        <div>
                          <p className="text-primary-500">Status</p>
                          <span className={`inline-block px-1.5 py-0.5 rounded ${(purchase.paymentStatus || '').toLowerCase() === 'paid' ? 'bg-green-100 text-green-800' : (purchase.paymentStatus || '').toLowerCase() === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-700'}`}>
                            {purchase.paymentStatus || 'Unpaid'}
                          </span>
                          {purchase.isOverdue && (
                            <span className="inline-block ml-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-xs font-medium">Overdue</span>
                          )}
                        </div>
                        {purchase.subtotal != null && purchase.vatTotal != null && (
                          <>
                            <div>
                              <p className="text-primary-500">Subtotal</p>
                              <p className="font-medium text-primary-700">{formatCurrency(purchase.subtotal)}</p>
                            </div>
                            <div>
                              <p className="text-primary-500">VAT ({vatPercent}%)</p>
                              <p className="font-medium text-orange-600">{formatCurrency(purchase.vatTotal)}</p>
                            </div>
                          </>
                        )}
                        <div>
                          <p className="text-primary-500">ITC</p>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${(purchase.isTaxClaimable ?? purchase.IsTaxClaimable) !== false ? 'bg-green-100 text-green-800' : 'bg-neutral-200 text-neutral-600'}`}>
                            {(purchase.isTaxClaimable ?? purchase.IsTaxClaimable) !== false ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                        {canPayPurchase(purchase) && (
                          <button
                            onClick={() => openPay(purchase)}
                            className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 text-xs font-medium text-neutral-800"
                            title={`Pay ${formatCurrency(purchase.balanceAmount ?? purchase.totalAmount ?? 0)}`}
                          >
                            <CreditCard className="h-3.5 w-3.5" /> Pay
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/suppliers/${encodeURIComponent(purchase.supplierName || '')}`, { state: { returnTo: location.pathname + location.search } })}
                          className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 text-xs font-medium text-neutral-800"
                          title="Supplier Ledger"
                        >
                          <Eye className="h-3.5 w-3.5" /> Ledger
                        </button>
                        <button
                          onClick={() => handleEditPurchase(purchase)}
                          className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 text-xs font-medium text-neutral-800"
                          title="Edit Purchase"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePurchase(purchase)}
                          className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-red-300 bg-white px-2 text-xs font-medium text-red-700"
                          title="Delete Purchase"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                    )
                  })
                )}
              </div>
            </>
          )}

          {totalPages > 1 && (
            <div className="p-4 border-t border-neutral-200 flex justify-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-neutral-200 rounded text-xs disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-1 text-xs">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-neutral-200 rounded text-xs disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-3">
          <h2 className="mb-2 text-sm font-semibold text-neutral-900">This period</h2>
          {!analytics || !analytics.totalCount ? (
            <p className="text-sm text-neutral-500">No purchases in this period</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-neutral-500">Daily trend</p>
                <div className="flex h-24 items-end gap-1">
                  {(analytics.dailyStats || []).map((d, i) => (
                    <div key={i} className="flex-1 rounded-sm bg-neutral-400" style={{ height: `${Math.max(8, ((d.totalAmount || 0) / Math.max(...(analytics.dailyStats || []).map((x) => x.totalAmount || 0), 1)) * 100)}%` }} title={formatCurrency(d.totalAmount || 0)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-neutral-500">Top suppliers</p>
                <ul className="space-y-1">
                  {(analytics.supplierStats || []).slice(0, 5).map((s, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{s.supplierName}</span>
                      <span className="tabular-nums">{formatCurrency(s.totalAmount || 0)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
      <Modal
        isOpen={supplierRegisterModal.open}
        onClose={() => setSupplierRegisterModal({ open: false, name: '' })}
        title="Create supplier first"
        size="md"
      >
        <div className="space-y-4 text-sm text-primary-800">
          <p>
            <strong>{supplierRegisterModal.name || 'This supplier'}</strong> is not in your supplier directory yet.
            Add the supplier first, then return here to record the purchase.
          </p>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              className="px-4 py-2 rounded-lg border-2 border-primary-300 text-primary-800 font-medium hover:bg-primary-50 min-h-[44px]"
              onClick={() => setSupplierRegisterModal({ open: false, name: '' })}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 min-h-[44px]"
              onClick={() => {
                const n = supplierRegisterModal.name || ''
                setSupplierRegisterModal({ open: false, name: '' })
                try {
                  sessionStorage.setItem('hexabill.afterSupplierCreate', '/purchases')
                } catch (_) { /* ignore */ }
                navigate(`/suppliers?create=1&prefill=${encodeURIComponent(n)}`)
              }}
            >
              Go to Add Supplier
            </button>
          </div>
        </div>
      </Modal>
      {/* Confirm Danger Modal */}
      <ConfirmDangerModal
        isOpen={dangerModal.isOpen}
        title={dangerModal.title}
        message={dangerModal.message}
        confirmLabel={dangerModal.confirmLabel}
        onConfirm={dangerModal.onConfirm}
        onClose={() => setDangerModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}

export default PurchasesPage

