import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { statusTone } from '../../utils/statusTone'
import { useCreateIntent } from '../../hooks/useCreateIntent'
import { Plus, Edit, Trash2, Eye, Save, Search, X, RefreshCw, ExternalLink, Users, CreditCard, Filter, ChevronDown } from 'lucide-react'
import { purchasesAPI, productsAPI, settingsAPI, suppliersAPI } from '../../services/index'
import { formatCurrency } from '../../utils/currency'
import toast from 'react-hot-toast'
import ConfirmDangerModal from '../../components/ConfirmDangerModal'
import OverflowMenu from '../../components/ui/OverflowMenu'
import Modal from '../../components/Modal'
import { localDateString } from '../../utils/dateFormat'
import { mobilePageShellClass } from '../../components/tallyFormClasses'
import { ListSkeleton } from '../../components/mobile/index'
import { readPurchasesStateFromParams, syncPurchasesSearchParams } from '../../utils/purchasesUrl'
import { cleanText, fixMoney } from '../../utils/productFields'
import { saveOutcomeIsUncertain, uncertainSaveMessage } from '../../utils/apiError'
import { useAuth } from '../../hooks/useAuth'
import ProductPicker from './ProductPicker'
import { savePurchaseDraft, loadPurchaseDraft, clearPurchaseDraft } from '../../utils/purchaseDraft'

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
  const { user: authUser } = useAuth()
  const draftTenantId = authUser?.tenantId ?? authUser?.id ?? null
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  // A failed load is shown as an error, never as an empty list (the list keeps its last rows).
  const [listError, setListError] = useState(false)
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

  // Restore an unsaved new purchase after a route crash or reload (REL-01); saved edits are never restored.
  const draftRestoredRef = useRef(false)
  useEffect(() => {
    if (draftRestoredRef.current || draftTenantId == null) return
    draftRestoredRef.current = true
    const draft = loadPurchaseDraft(draftTenantId)
    if (draft) {
      setFormData(draft)
      setShowForm(true)
      toast('Restored your unsaved purchase.', { id: 'purchase-draft-restored' })
    }
  }, [draftTenantId])
  useEffect(() => {
    if (showForm && !editingPurchase && draftRestoredRef.current) savePurchaseDraft(draftTenantId, formData)
  }, [showForm, editingPurchase, formData, draftTenantId])

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

  // Supplier autocomplete — require ≥2 chars (match backend), debounce
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

  // Fetch VAT from company settings (no hardcoded 5% — TODO #5)
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
        setListError(false)
      } else {
        setListError(true)
      }
    } catch (error) {
      setListError(true)
      toast.error('Purchases could not be loaded. Check your connection, then try again.')
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

  const createAttemptRef = useRef(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (formData.items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    // Repair what can be repaired and tell the client; stop only when a quantity cannot be guessed.
    const notes = []
    const countBefore = formData.items.length
    const filledItems = formData.items.filter(item => item.productId)
    if (filledItems.length < countBefore) notes.push('Rows without a product were removed.')
    if (filledItems.length === 0) {
      toast.error('Pick at least one product, for example Beef Nan 250gm, and type its quantity')
      return
    }
    const fixedItems = []
    for (let i = 0; i < filledItems.length; i++) {
      const item = filledItems[i]
      const qty = typeof item.qty === 'number' ? item.qty : parseFloat(item.qty)
      if (!Number.isFinite(qty) || qty <= 0) {
        toast.error(`Row ${i + 1}: type the quantity, for example 10`)
        return
      }
      const cost = fixMoney(item.unitCost, `Row ${i + 1} unit cost`)
      if (cost.note) notes.push(cost.note)
      fixedItems.push({ ...item, qty: Math.round(qty * 1000) / 1000, unitCost: cost.value })
    }
    const supplierClean = cleanText(formData.supplierName)
    let invoiceClean = cleanText(formData.invoiceNo)
    const purchaseDateFixed = formData.purchaseDate || localDateString(new Date())
    if (!invoiceClean) {
      const now = new Date()
      invoiceClean = `PUR-${purchaseDateFixed.replace(/-/g, '')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
      notes.push(`Invoice number was empty, so ${invoiceClean} was used. You can change it by editing the purchase.`)
    }

    const trimmedSupplier = supplierClean
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
      const purchaseDate = purchaseDateFixed
      const purchaseData = {
        supplierName: supplierClean,
        invoiceNo: invoiceClean,
        purchaseDate,
        expenseCategory: formData.expenseCategory || 'Inventory',
        isTaxClaimable: formData.isTaxClaimable !== false,
        items: fixedItems.map(item => ({
          productId: Number(item.productId),
          unitType: (item.unitType || 'PCS').trim().toUpperCase(),
          qty: typeof item.qty === 'number' ? item.qty : parseFloat(item.qty) || 0,
          unitCost: typeof item.unitCost === 'number' ? item.unitCost : parseFloat(item.unitCost) || 0
        }))
      }

      let response
      createAttemptRef.current = editingPurchase ? null : { supplierName: supplierClean, invoiceNo: invoiceClean }
      if (editingPurchase) {
        response = await purchasesAPI.updatePurchase(editingPurchase.id, purchaseData)
        if (response?.success !== false && response?.data?.id) {
          toast.success('Purchase updated successfully!', { id: 'purchase-update', duration: 4000 })
        } else {
          toast.error(response.message || 'Failed to update purchase')
        }
      } else {
        response = await purchasesAPI.createPurchase(purchaseData)
        if (!(response?.success !== false && response?.data?.id)) {
          const found = await purchasesAPI.getPurchases({ supplierName: supplierClean, page: 1, pageSize: 20 }).catch(() => null)
          const rows = found?.data?.items ?? found?.items ?? []
          const match = rows.find(r => String(r.invoiceNo || '').trim().toLowerCase() === invoiceClean.toLowerCase())
          if (match?.id) response = { success: true, data: match }
        }
        if (response?.success !== false && response?.data?.id) {
          toast.success('Purchase created! Stock has been updated. If Products still show 0 stock, go to Products and click Recompute Stock.', { id: 'purchase-create', duration: 6000 })
        } else {
          toast.error(response.message || 'Failed to create purchase', { id: 'purchase-create' })
        }
      }

      if (response?.success !== false && response?.data?.id) {
        if (notes.length) toast(`We fixed: ${notes.join(' ')}`, { duration: 9000 })
        clearPurchaseDraft(draftTenantId)
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
      // The server may have saved the purchase even though the answer failed or never arrived.
      // A repeated supplier + invoice number is answered with 409, so a lost answer plus a match means it was saved.
      const attempt = createAttemptRef.current
      if (attempt && saveOutcomeIsUncertain(error)) {
        try {
          const found = await purchasesAPI.getPurchases({ supplierName: attempt.supplierName, page: 1, pageSize: 20 })
          const rows = found?.data?.items ?? found?.items ?? []
          if (rows.some(r => String(r.invoiceNo || '').trim().toLowerCase() === attempt.invoiceNo.toLowerCase())) {
            toast.success('Purchase created! Stock has been updated.', { id: 'purchase-create', duration: 6000 })
            clearPurchaseDraft(draftTenantId)
            setShowForm(false)
            setEditingPurchase(null)
            loadPurchases()
            loadAnalytics()
            loadPendingSummary()
            window.dispatchEvent(new CustomEvent('dataUpdated'))
            productsAPI.recomputeStock().then(() => loadProducts()).catch(() => loadProducts())
            return
          }
        } catch (_) { /* fall through to the message below */ }
      }
      if (!error?._handledByInterceptor) {
        const data = error?.response?.data
        const errors = data?.errors
        const errorMsg = (Array.isArray(errors) && errors.length && errors[0]) || data?.message
          || (saveOutcomeIsUncertain(error) ? uncertainSaveMessage('purchase') : 'Failed to save purchase')
        toast.error(editingPurchase ? `Update failed: ${errorMsg}` : `Create failed: ${errorMsg}`, { duration: 6000 })
      }
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

  // Row actions for desktop: one visible primary action (Pay supplier) plus a menu for the rest.
  const purchaseMenuItems = (purchase) => [
    { label: 'Supplier ledger', icon: Eye, onClick: () => navigate(`/suppliers/${encodeURIComponent(purchase.supplierName || '')}`, { state: { returnTo: location.pathname + location.search } }) },
    { label: 'Edit purchase', icon: Edit, onClick: () => handleEditPurchase(purchase) },
    { label: 'Delete purchase', icon: Trash2, danger: true, separatorBefore: true, onClick: () => handleDeletePurchase(purchase) },
  ]

  // The amount and invoice reference travel in router state, not the URL (PU-12).
  const openPay = (purchase) => {
    navigate(`/suppliers/${encodeURIComponent(purchase.supplierName || '')}`, {
      state: {
        returnTo: location.pathname + location.search,
        payment: { amount: purchase.balanceAmount ?? purchase.totalAmount, reference: purchase.invoiceNo || '' },
      },
    })
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

  const activeFilterCount = [statusFilter !== 'all', filterPeriod !== 'all', !!supplierSearch, !!categoryFilter].filter(Boolean).length

  const statusChip = (id, label, count) => {
    const active = statusFilter === id
    // Red only for overdue items that exist. Unpaid is an ordinary open balance, so it is neutral.
    const tone = id === 'paid' ? 'text-green-800' : id === 'partial' ? 'text-amber-800' : id === 'overdue' && count > 0 ? 'text-red-800' : 'text-neutral-900'
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
  useCreateIntent(handleNewPurchase)

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
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 md:flex-none"
            >
              <Users className="h-4 w-4" />
              Add Supplier
            </button>
            <button
              type="button"
              onClick={handleNewPurchase}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md bg-primary-600 px-3 text-sm font-medium text-white md:flex-none"
            >
              <Plus className="h-4 w-4" />
              New Purchase
            </button>
          </div>
        </div>
      </div>

      <div className="p-2 sm:p-4 w-full">
        <div className="mb-3 rounded-lg border border-neutral-200 bg-white p-3">
          {/* Below 1024px the filters sit behind one button (count of active filters), as on Expenses */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            aria-expanded={mobileFiltersOpen}
            aria-controls="purchase-filters"
            className="btn btn-secondary mb-2 flex w-full items-center justify-between lg:hidden"
          >
            <span className="inline-flex items-center gap-2">
              <Filter className="h-4 w-4" aria-hidden />
              Filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-primary-100 px-1.5 text-xs tabular-nums text-primary-700">{activeFilterCount}</span>
              )}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${mobileFiltersOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          <div id="purchase-filters" className={`${mobileFiltersOpen ? 'block' : 'hidden'} lg:block`}>
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
              <button type="button" onClick={handleExportCsv} disabled={exportingCsv} className="min-h-[44px] flex-1 rounded-md border border-neutral-300 bg-white px-2 text-sm">{exportingCsv ? 'Exporting…' : 'Export'}</button>
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
          </div>
          {loading && <p className="mt-2 text-xs text-neutral-500">Loading…</p>}
        </div>

        {pendingSummary && (
          <div className="mb-3 grid grid-cols-4 gap-2 lg:grid-cols-5">
            <button type="button" onClick={() => { setCurrentPage(1); setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending') }} aria-pressed={statusFilter === 'pending'} className={`col-span-4 min-h-[44px] rounded-md border px-3 text-left lg:col-span-1 ${statusFilter === 'pending' ? 'border-primary-600 bg-primary-50' : 'border-neutral-200 bg-white'}`}>
              <span className="block text-xs text-neutral-500">Pending</span>
              <span className="block text-sm font-semibold tabular-nums text-neutral-900">{formatCurrency(pendingSummary.totalPendingToPay ?? 0)}</span>
            </button>
            {statusChip('unpaid', 'Unpaid', pendingSummary.unpaidCount ?? 0)}
            {statusChip('partial', 'Partial', pendingSummary.partialCount ?? 0)}
            {statusChip('paid', 'Paid', pendingSummary.paidCount ?? 0)}
            {statusChip('overdue', 'Overdue', pendingSummary.overdueCount ?? 0)}
          </div>
        )}

        {/* Purchase Form - Tally Style - mobile: single column, no horizontal scroll */}
        {showForm && (
          <div ref={formRef} data-shell-hides-nav className={`${tallyVoucherShellClass} shadow-lg`}>
            <div className="flex items-center justify-between mb-3 sm:mb-4 border-b-2 border-neutral-200 pb-2">
              <h2 className="text-base sm:text-lg font-bold text-primary-800">
                {editingPurchase ? 'Edit Purchase Entry' : 'New Purchase Entry'}
              </h2>
              <button
                onClick={() => { clearPurchaseDraft(draftTenantId); setShowForm(false) }}
                className="text-primary-500 hover:text-primary-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleSubmit} className="pb-24 md:pb-0">
              {/* (1) Supplier Section */}
              <VoucherSection
                sectionId="supplier"
                title="Supplier"
                isOpen={mobileVoucherSection === 'supplier'}
                onToggle={toggleVoucherSection}
              >
                <div className="relative">
                  <label htmlFor="purchase-supplier" className={tallyLabelClass}>Supplier Name *</label>
                  <input
                    id="purchase-supplier"
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
                            // Do not wipe — balance lookup still works by exact name.
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
                    <p className="text-micro text-slate-500 mt-0.5">Selected from supplier directory</p>
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
                    <label htmlFor="purchase-invoice" className={tallyLabelClass}>Invoice No *</label>
                    <input id="purchase-invoice" type="text" placeholder="e.g. INV-1042 (empty = we make one)" className={tallyInputClass} value={formData.invoiceNo} onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="purchase-date" className={tallyLabelClass}>Purchase Date *</label>
                    <input id="purchase-date" type="date" required className={tallyInputClass} value={formData.purchaseDate} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="purchase-category" className={tallyLabelClass}>Expense Category *</label>
                    <select id="purchase-category" required className={tallySelectClass} value={formData.expenseCategory} onChange={(e) => setFormData({ ...formData, expenseCategory: e.target.value })}>
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
                      className="rounded border-neutral-200 text-success focus:ring-green-500"
                    />
                    <span className="text-sm font-medium text-primary-700">Tax claimable (ITC)</span>
                    <span className="text-xs text-primary-500" title="Include input VAT in VAT Return Box 9b">Include in VAT Return</span>
                  </label>
                </div>
              </VoucherSection>

              {/* (4) Supplier Balance Info */}
              {formData.supplierName.trim() && supplierBalance != null && (
                <div className="mb-4 sm:mb-6 p-3 bg-warning-bg rounded-lg border-2 border-warning-border">
                  <h3 className="text-sm font-bold text-amber-800 mb-2">Supplier Balance</h3>
                  <p className="text-sm text-amber-800">Current due: {formatCurrency(supplierBalance?.netPayable || 0)}</p>
                  <p className="text-sm text-warning-fg mt-1">
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
                <label htmlFor="purchase-product-search" className={tallyLabelClass}>Add Product (F3)</label>
                <ProductPicker
                  inputId="purchase-product-search"
                  inputRef={searchInputRef}
                  inputClassName={tallyInputClass}
                  value={productSearchTerm}
                  onChange={setProductSearchTerm}
                  products={products}
                  open={showProductSearch}
                  onOpenChange={setShowProductSearch}
                  onSelect={addItem}
                />

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
                            <button type="button" onClick={() => removeItem(index)} className="shrink-0 text-error p-1" aria-label="Remove">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <label className="text-xs text-primary-500">Qty</label>
                              <input type="number" inputMode="decimal" step="any" placeholder="e.g. 10" className="w-full min-h-11 px-2 border border-neutral-200 rounded text-base md:text-sm" value={item.qty === '' ? '' : item.qty} onChange={(e) => updateItem(index, 'qty', e.target.value)} />
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
                              <input type="number" inputMode="decimal" step="any" placeholder="e.g. 120.00" className="w-full min-h-11 px-2 border border-neutral-200 rounded text-base md:text-sm" value={item.unitCost === '' ? '' : item.unitCost} onChange={(e) => updateItem(index, 'unitCost', e.target.value)} />
                            </div>
                            <div className="flex flex-col justify-end">
                              <span className="text-xs text-primary-500">Total</span>
                              <span className="text-sm font-bold text-success-fg">{formatCurrency(total)}</span>
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
                      <div className="flex justify-between text-base font-bold text-success-fg mt-1">
                        <span>Total</span>
                        <span>{formatCurrency(calculateTotal() * (1 + vatPercent / 100))}</span>
                      </div>
                      <label className="flex items-center gap-2 mt-2 text-sm text-primary-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isTaxClaimable !== false}
                          onChange={(e) => setFormData({ ...formData, isTaxClaimable: e.target.checked })}
                          className="rounded border-neutral-200 text-success"
                        />
                        <span>Tax claimable (ITC) – include in VAT Return Box 9b</span>
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
                            <td className="px-2 py-2 font-bold text-success-fg">
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
                                className="text-error hover:text-red-800"
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
                        <td className="px-2 py-2 font-bold text-success-fg">
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
              <div className="flex justify-end space-x-3 mt-4 md:static fixed bottom-[var(--hb-bottom-nav-h,4.75rem)] left-0 right-0 p-4 bg-white border-t-2 border-neutral-200 md:border-0 md:bottom-0 md:p-0 z-10 md:z-auto">
                <button type="button" onClick={() => { clearPurchaseDraft(draftTenantId); setShowForm(false) }} className="px-4 py-2 min-h-11 border-2 border-neutral-200 rounded text-base font-medium hover:bg-neutral-50">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 min-h-11 bg-primary-600 text-white rounded text-base font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center">
                  <Save className="h-4 w-4 mr-2" /> {submitting ? 'Saving…' : 'Save Purchase'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Purchases List */}
        <div className="bg-white rounded-lg border-2 border-neutral-200 shadow-sm w-full overflow-hidden">
          <div className="p-3 sm:p-4 border-b-2 border-neutral-200 bg-neutral-50">
            <div className="flex items-center justify-between gap-2">
              <h3 className="min-w-0 truncate text-sm font-bold text-primary-800">Purchase List</h3>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/vat-return')}
                  className="px-2 py-1 rounded text-xs font-medium bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 flex items-center gap-1 whitespace-nowrap"
                  title="VAT Return – track and fix zero values"
                >
                  <ExternalLink className="h-3 w-3" /> VAT Return
                </button>
                <OverflowMenu
                  label="More list actions"
                  items={[
                    {
                      label: bulkFixingItc ? 'Updating…' : 'Mark VAT purchases as claimable',
                      onClick: handleBulkSetTaxClaimable,
                      disabled: bulkFixingItc || loading,
                    },
                  ]}
                />
              </div>
            </div>
          </div>
          {listError && !loading && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b border-error-border bg-error-bg px-3 py-2 text-sm">
              <p className="text-error-fg">Purchases could not be loaded. Check your connection, then try again.</p>
              <button type="button" onClick={() => loadPurchases()} className="btn btn-secondary">Try again</button>
            </div>
          )}
          {loading ? (
            <div className="p-3" aria-busy="true" aria-label="Loading purchases">
              <ListSkeleton count={6} />
            </div>
          ) : (
            <>
              {/* Desktop Table - scroll contained, no page overflow */}
              <div className="hidden xl:block overflow-x-auto max-w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
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
                    {purchases.length === 0 && !listError ? (
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
                          <td className="whitespace-nowrap px-3 py-2 font-medium text-neutral-900">{purchase.invoiceNo}</td>
                          <td className="px-3 py-2">{purchase.supplierName}</td>
                          <td className="px-3 py-2">{new Date(purchase.purchaseDate).toLocaleDateString('en-GB')}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                            {purchase.subtotal ? (
                              <span className="text-neutral-900">{formatCurrency(purchase.subtotal)}</span>
                            ) : (
                              <span className="text-primary-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                            {purchase.vatTotal ? (
                              <span className="text-neutral-900">{formatCurrency(purchase.vatTotal)}</span>
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
                          <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-neutral-900">{formatCurrency(purchase.totalAmount)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-neutral-900">
                            {(purchase.vendorDiscountAmount ?? 0) > 0 ? formatCurrency(purchase.vendorDiscountAmount) : <span className="text-primary-400">-</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-neutral-900">{formatCurrency(purchase.paidAmount ?? 0)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-neutral-900">{formatCurrency(purchase.balanceAmount ?? purchase.totalAmount ?? 0)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              statusTone(purchase.paymentStatus || 'Unpaid', 'invoice')
                            }`}>
                              {purchase.paymentStatus || 'Unpaid'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">{purchase.items?.length || 0}</td>
                          <td className="whitespace-nowrap px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              {canPayPurchase(purchase) && (
                                <button
                                  type="button"
                                  onClick={() => openPay(purchase)}
                                  className="inline-flex min-h-[40px] items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 text-xs font-medium text-neutral-800"
                                  title={`Pay ${formatCurrency(purchase.balanceAmount ?? purchase.totalAmount ?? 0)}`}
                                >
                                  <CreditCard className="h-3.5 w-3.5" aria-hidden /> Pay supplier
                                </button>
                              )}
                              <OverflowMenu label={`More actions for ${purchase.invoiceNo}`} items={purchaseMenuItems(purchase)} />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="xl:hidden space-y-3 p-4">
                {purchases.length === 0 && !listError ? (
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
                    const status = (purchase.paymentStatus || '').toLowerCase()
                    const balance = purchase.balanceAmount ?? purchase.totalAmount ?? 0
                    const statusClass = statusTone(purchase.isOverdue ? 'overdue' : (status || 'unpaid'), 'invoice')
                    return (
                    <div key={purchase.id} className="rounded-lg border border-neutral-200 bg-white">
                      <button
                        type="button"
                        onClick={() => setExpandedPurchaseId(isExpanded ? null : purchase.id)}
                        aria-expanded={isExpanded}
                        className="flex w-full flex-col gap-1 px-3 py-2.5 text-left"
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate text-sm font-semibold text-neutral-900">{purchase.invoiceNo}</span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">{formatCurrency(purchase.totalAmount || 0)}</span>
                        </span>
                        <span className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                          <span className="min-w-0 truncate">{purchase.supplierName} · {formatDate(purchase.purchaseDate)}</span>
                          <span className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${statusClass}`}>{purchase.isOverdue ? 'Overdue' : (purchase.paymentStatus || 'Unpaid')}</span>
                        </span>
                        {balance > 0 && (
                          <span className="text-xs tabular-nums text-neutral-600">{formatCurrency(balance)} due</span>
                        )}
                      </button>
                      {isExpanded && (
                        <div className="space-y-3 border-t border-neutral-100 px-3 py-3">
                          {purchase.items?.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-neutral-600">Items</p>
                              {purchase.items.map((item, idx) => (
                                <div key={idx} className="flex flex-col gap-1 text-xs sm:flex-row sm:justify-between">
                                  <span className="min-w-0 break-words text-neutral-800">{item.productName || item.product?.nameEn || 'Item'}</span>
                                  <span className="tabular-nums text-neutral-700">{item.qty} × {formatCurrency(item.unitCost || 0)} = {formatCurrency((item.qty || 0) * (item.unitCost || 0))}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                            <div>
                              <dt className="text-neutral-500">Paid</dt>
                              <dd className="font-medium tabular-nums text-neutral-900">{formatCurrency(purchase.paidAmount ?? 0)}</dd>
                            </div>
                            <div>
                              <dt className="text-neutral-500">Balance</dt>
                              <dd className="font-medium tabular-nums text-neutral-900">{formatCurrency(balance)}</dd>
                            </div>
                            {purchase.subtotal != null && purchase.vatTotal != null && (
                              <>
                                <div>
                                  <dt className="text-neutral-500">Subtotal</dt>
                                  <dd className="font-medium tabular-nums text-neutral-900">{formatCurrency(purchase.subtotal)}</dd>
                                </div>
                                <div>
                                  <dt className="text-neutral-500">VAT ({vatPercent}%)</dt>
                                  <dd className="font-medium tabular-nums text-neutral-900">{formatCurrency(purchase.vatTotal)}</dd>
                                </div>
                              </>
                            )}
                            <div>
                              <dt className="text-neutral-500">Claimable VAT (ITC)</dt>
                              <dd className="font-medium text-neutral-900">{(purchase.isTaxClaimable ?? purchase.IsTaxClaimable) !== false ? 'Yes' : 'No'}</dd>
                            </div>
                          </dl>
                          <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 pt-3">
                            {canPayPurchase(purchase) && (
                              <button
                                type="button"
                                onClick={() => openPay(purchase)}
                                className="inline-flex min-h-[44px] items-center gap-1 rounded-md bg-primary-600 px-3 text-xs font-medium text-white"
                                title={`Pay ${formatCurrency(balance)}`}
                              >
                                <CreditCard className="h-3.5 w-3.5" aria-hidden /> Pay supplier
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => navigate(`/suppliers/${encodeURIComponent(purchase.supplierName || '')}`, { state: { returnTo: location.pathname + location.search } })}
                              className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-800"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden /> Supplier ledger
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditPurchase(purchase)}
                              className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-800"
                            >
                              <Edit className="h-3.5 w-3.5" aria-hidden /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePurchase(purchase)}
                              className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-red-300 bg-white px-3 text-xs font-medium text-error-fg"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                            </button>
                          </div>
                        </div>
                      )}
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

