import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Download,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  FileText,
  Eye,
  RefreshCw,
  DollarSign,
  ShieldCheck
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { isAdminOrOwner } from '../../utils/roles'
import { formatCurrency, formatBalance } from '../../utils/currency'
import toast from 'react-hot-toast'
import { LoadingCard } from '../../components/Loading'
import { Input, Select } from '../../components/Form'
import { reportsAPI, productsAPI, customersAPI, profitAPI, paymentsAPI, branchesAPI, routesAPI } from '../../services'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

const ReportsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const initialTab = searchParams.get('tab') || 'summary'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  })
  const [filters, setFilters] = useState({
    branch: '',
    route: '',
    product: '',
    customer: '',
    category: '',
    status: '' // Pending, Paid, Partial for sales report
  })

  const [reportData, setReportData] = useState({
    summary: null,
    sales: [],
    salesList: [], // Detailed sales list for table display
    products: [],
    customers: [],
    expenses: [],
    profitLoss: null,
    outstandingBills: [],
    aiSuggestions: null,
  })
  const [loadingSales, setLoadingSales] = useState(false)
  const [productsList, setProductsList] = useState([])
  const [customersList, setCustomersList] = useState([])
  const [branchesList, setBranchesList] = useState([])
  const [routesList, setRoutesList] = useState([])

  // Request throttling and cancellation - AGGRESSIVE THROTTLING
  const fetchAbortControllerRef = useRef(null)
  const lastFetchTimeRef = useRef(0)
  const isFetchingRef = useRef(false)
  const FETCH_THROTTLE_MS = 2000 // Minimum 2 seconds between requests (reasonable throttling)
  const fetchTimeoutRef = useRef(null)
  const isTabChangingRef = useRef(false)
  const pendingTabChangeRef = useRef(null)
  const fetchReportDataRef = useRef(null) // Ref to store the latest fetchReportData
  const requestQueueRef = useRef([]) // Queue for pending requests
  const lastRequestParamsRef = useRef(null) // Track last request params to prevent duplicates
  const hasInitialLoadRef = useRef(false) // Track if initial load has happened
  const initialLoadTimeoutRef = useRef(null) // Timeout for initial load

  const { user } = useAuth()

  const tabs = [
    { id: 'summary', name: 'Summary', icon: BarChart3 },
    { id: 'sales', name: 'Sales Report', icon: TrendingUp },
    { id: 'products', name: 'Product Analysis', icon: PieChart },
    { id: 'customers', name: 'Customer Report', icon: FileText },
    { id: 'expenses', name: 'Expenses', icon: TrendingDown },
    { id: 'profit-loss', name: 'Profit & Loss', icon: TrendingUp, adminOnly: true },
    { id: 'outstanding', name: 'Outstanding Bills', icon: DollarSign },
    { id: 'ai', name: 'AI Insights', icon: Eye, adminOnly: true }
  ].filter(tab => !tab.adminOnly || isAdminOrOwner(user))

  // Update URL when tab changes (with debouncing to prevent request flood)
  const handleTabChange = (tabId) => {
    // Prevent rapid tab switching
    if (isTabChangingRef.current) {
      pendingTabChangeRef.current = tabId
      return
    }

    if (activeTab === tabId) {
      return // Already on this tab, no need to change
    }

    isTabChangingRef.current = true

    // Cancel any pending requests and timeouts
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort()
      fetchAbortControllerRef.current = null
    }
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
      fetchTimeoutRef.current = null
    }

    // Reset fetching flag to allow new requests after tab change
    isFetchingRef.current = false

    setActiveTab(tabId)
    setSearchParams({ tab: tabId })

    // Always fetch data when switching tabs to ensure fresh data is shown
    // Use a short delay to prevent rapid switching issues
    setTimeout(() => {
      isTabChangingRef.current = false

      // Fetch data for new tab
      if (fetchReportDataRef.current && !isFetchingRef.current) {
        fetchReportDataRef.current(true)
      }
    }, 300) // Short delay to ensure tab change is complete

    // Handle pending tab change if any
    if (pendingTabChangeRef.current) {
      const nextTab = pendingTabChangeRef.current
      pendingTabChangeRef.current = null
      setTimeout(() => handleTabChange(nextTab), 500) // Process after current change completes
    }
  }

  // Define fetchReportData FIRST before any useEffect that uses it
  const fetchReportData = useCallback(async (force = false) => {
    // AGGRESSIVE: Prevent ALL requests if one is in flight (unless forced)
    if (!force && isFetchingRef.current) {
      console.log('Request already in progress, skipping...')
      return
    }

    // Prevent fetching during tab changes
    if (isTabChangingRef.current && !force) {
      console.log('Tab change in progress, skipping fetch...')
      return
    }

    // Create request signature to prevent duplicates
    const requestSignature = JSON.stringify({
      dateRange,
      activeTab,
      filters
    })

    // AGGRESSIVE: Prevent duplicate requests (same params)
    if (!force && lastRequestParamsRef.current === requestSignature) {
      console.log('Duplicate request prevented (same params)')
      return
    }

    // Throttle requests to prevent 429 errors
    const now = Date.now()
    const timeSinceLastFetch = now - lastFetchTimeRef.current

    if (!force && timeSinceLastFetch < FETCH_THROTTLE_MS) {
      console.log(`Throttling request (${timeSinceLastFetch}ms < ${FETCH_THROTTLE_MS}ms)`)
      // Clear existing timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }
      // Schedule request after throttle period
      fetchTimeoutRef.current = setTimeout(() => {
        if (fetchReportDataRef.current && !isFetchingRef.current) {
          fetchReportDataRef.current(true)
        }
      }, FETCH_THROTTLE_MS - timeSinceLastFetch)
      return
    }

    // Cancel previous request if still pending
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort()
    }

    // Create new abort controller for this request
    fetchAbortControllerRef.current = new AbortController()
    const signal = fetchAbortControllerRef.current.signal

    // Mark as fetching and store request signature
    isFetchingRef.current = true
    lastFetchTimeRef.current = now
    lastRequestParamsRef.current = requestSignature

    try {
      setLoading(true)

      // Fetch summary report (with abort signal support if API supports it)
      const summaryParams = {
        fromDate: dateRange.from,
        toDate: dateRange.to,
        branchId: filters.branch ? parseInt(filters.branch, 10) : undefined,
        routeId: filters.route ? parseInt(filters.route, 10) : undefined
      }

      // Note: Most API calls don't support AbortSignal directly, but we track cancellation
      const summaryResponse = await reportsAPI.getSummaryReport(summaryParams)

      // Check if request was cancelled
      if (fetchAbortControllerRef.current?.signal?.aborted) {
        return
      }
      if (summaryResponse?.success && summaryResponse?.data) {
        const summary = summaryResponse.data
        // Handle both camelCase and PascalCase property names
        const salesToday = summary.salesToday || summary.SalesToday || 0
        const purchasesToday = summary.purchasesToday || summary.PurchasesToday || 0
        const expensesToday = summary.expensesToday || summary.ExpensesToday || 0
        const profitToday = summary.profitToday || summary.ProfitToday || 0

        setReportData(prev => ({
          ...prev,
          summary: {
            totalSales: salesToday,
            totalPurchases: purchasesToday,
            totalExpenses: expensesToday,
            netProfit: profitToday,
            salesGrowth: 0, // Calculate from previous period if needed
            profitMargin: profitToday && salesToday
              ? (profitToday / salesToday) * 100
              : 0
          }
        }))
      }

      // Fetch data based on active tab
      if (activeTab === 'sales') {
        setLoadingSales(true)
        try {
          const salesResponse = await reportsAPI.getSalesReport({
            fromDate: dateRange.from,
            toDate: dateRange.to,
            customerId: filters.customer ? parseInt(filters.customer) : undefined,
            status: filters.status || undefined,
            branchId: filters.branch ? parseInt(filters.branch, 10) : undefined,
            routeId: filters.route ? parseInt(filters.route, 10) : undefined,
            page: 1,
            pageSize: 100
          })
          if (salesResponse?.success && salesResponse?.data) {
            let salesData = salesResponse.data.items || []

            // Calculate balance and status for each sale
            salesData = salesData.map(sale => {
              const paidAmount = sale.paidAmount || 0
              const grandTotal = sale.grandTotal || 0
              const balance = grandTotal - paidAmount

              // Determine status based on balance
              let status = 'Pending'
              if (balance <= 0.01) {
                status = 'Paid'
              } else if (paidAmount > 0) {
                status = 'Partial'
              }

              // Calculate due date (30 days from invoice date)
              const dueDate = new Date(sale.invoiceDate)
              dueDate.setDate(dueDate.getDate() + 30)
              const today = new Date()
              const isOverdue = balance > 0.01 && dueDate < today

              return {
                ...sale,
                balance,
                status,
                isOverdue,
                dueDate
              }
            })

            // CRITICAL: Group by date for chart - track ALL customers' sales
            // Also track pending vs paid for accurate reporting
            const salesByDate = salesData.reduce((acc, sale) => {
              const date = new Date(sale.invoiceDate).toISOString().split('T')[0]
              if (!acc[date]) {
                acc[date] = { date, amount: 0, count: 0, pending: 0, paid: 0 }
              }
              acc[date].amount += sale.grandTotal || 0
              acc[date].count += 1

              // Track pending vs paid amounts
              if (sale.balance > 0.01) {
                acc[date].pending += sale.balance
              } else {
                acc[date].paid += sale.grandTotal || 0
              }

              return acc
            }, {})

            setReportData(prev => ({
              ...prev,
              sales: Object.values(salesByDate).sort((a, b) =>
                new Date(a.date) - new Date(b.date)
              ),
              salesList: salesData // Store detailed sales list for table display
            }))
          }
        } finally {
          setLoadingSales(false)
        }
      } else if (activeTab === 'products') {
        try {
          setLoading(true)
          console.log('Loading Product Analysis report:', { from: dateRange.from, to: dateRange.to })

          const productsResponse = await reportsAPI.getProductSalesReport({
            fromDate: dateRange.from,
            toDate: dateRange.to,
            productId: filters.product ? parseInt(filters.product) : undefined,
            category: filters.category || undefined,
            top: 20
          })

          console.log('Product Analysis response:', productsResponse)

          if (productsResponse?.success && productsResponse?.data) {
            const products = (productsResponse.data || []).map(p => ({
              name: p.productName || p.ProductName || p.sku || p.Sku || 'Unknown Product',
              sales: parseFloat(p.totalAmount || p.TotalAmount || 0),
              margin: parseFloat(p.profitMargin || p.ProfitMargin || 0),
              qty: parseFloat(p.totalQty || p.TotalQty || 0),
              sku: p.sku || p.Sku || 'N/A'
            }))

            console.log('Product Analysis data loaded:', {
              productCount: products.length,
              totalSales: products.reduce((sum, p) => sum + p.sales, 0)
            })

            setReportData(prev => ({ ...prev, products }))
          } else {
            console.error('Product Analysis response not successful:', productsResponse)
            toast.error(productsResponse?.message || 'Failed to load product sales data')
            setReportData(prev => ({ ...prev, products: [] }))
          }
        } catch (error) {
          console.error('Error loading product sales:', error)
          toast.error(error?.response?.data?.message || 'Failed to load product sales report')
          setReportData(prev => ({ ...prev, products: [] }))
        } finally {
          setLoading(false)
        }
      } else if (activeTab === 'customers') {
        try {
          setLoading(true)
          console.log('Loading Customer Report (Outstanding Customers)')

          const customersResponse = await reportsAPI.getOutstandingCustomers({ days: 30 })

          console.log('Customer Report response:', customersResponse)

          if (customersResponse?.success && customersResponse?.data) {
            const customers = (customersResponse.data || []).map(c => ({
              id: c.id || c.Id || 0,
              name: c.name || c.Name || 'Unknown Customer',
              phone: c.phone || c.Phone || '',
              total: parseFloat(c.balance || c.Balance || 0),
              creditLimit: parseFloat(c.creditLimit || c.CreditLimit || 0),
              invoices: c.invoiceCount || c.InvoiceCount || 0,
              lastOrder: c.lastOrderDate || c.LastOrderDate || ''
            }))

            // CRITICAL: Filter out customers with zero or negative balance
            const customersWithBalance = customers.filter(c => c.total > 0.01)

            console.log('Customer Report data loaded:', {
              totalCustomers: customers.length,
              customersWithBalance: customersWithBalance.length,
              totalOutstanding: customersWithBalance.reduce((sum, c) => sum + c.total, 0)
            })

            setReportData(prev => ({ ...prev, customers: customersWithBalance }))
          } else {
            console.error('Customer Report response not successful:', customersResponse)
            toast.error(customersResponse?.message || 'Failed to load customer data')
            setReportData(prev => ({ ...prev, customers: [] }))
          }
        } catch (error) {
          console.error('Error loading customers:', error)
          toast.error(error?.response?.data?.message || 'Failed to load customer report')
          setReportData(prev => ({ ...prev, customers: [] }))
        } finally {
          setLoading(false)
        }
      } else if (activeTab === 'expenses') {
        try {
          setLoading(true)
          console.log('Loading Expenses report:', { from: dateRange.from, to: dateRange.to })

          const expensesResponse = await reportsAPI.getExpensesByCategory({
            fromDate: dateRange.from,
            toDate: dateRange.to,
            branchId: filters.branch ? parseInt(filters.branch, 10) : undefined
          })

          console.log('Expenses response:', expensesResponse)

          if (expensesResponse?.success && expensesResponse?.data) {
            const expenses = (expensesResponse.data || []).map(e => ({
              categoryId: e.categoryId || e.CategoryId || 0,
              categoryName: e.categoryName || e.CategoryName || 'Uncategorized',
              categoryColor: e.categoryColor || e.CategoryColor || '#6B7280',
              totalAmount: parseFloat(e.totalAmount || e.TotalAmount || 0),
              expenseCount: parseInt(e.expenseCount || e.ExpenseCount || 0)
            }))

            console.log('Expenses data loaded:', {
              categoryCount: expenses.length,
              totalExpenses: expenses.reduce((sum, e) => sum + e.totalAmount, 0)
            })

            setReportData(prev => ({ ...prev, expenses }))
          } else {
            console.error('Expenses response not successful:', expensesResponse)
            toast.error(expensesResponse?.message || 'Failed to load expense data')
            setReportData(prev => ({ ...prev, expenses: [] }))
          }
        } catch (error) {
          console.error('Error loading expenses:', error)
          toast.error(error?.response?.data?.message || 'Failed to load expense report')
          setReportData(prev => ({ ...prev, expenses: [] }))
        } finally {
          setLoading(false)
        }
      } else if (activeTab === 'profit-loss') {
        try {
          setLoading(true)
          console.log('Loading Profit & Loss report:', { from: dateRange.from, to: dateRange.to })

          const profitResponse = await profitAPI.getProfitReport(dateRange.from, dateRange.to)

          console.log('Profit & Loss response:', profitResponse)

          if (profitResponse?.success && profitResponse?.data) {
            const profitData = profitResponse.data

            // CRITICAL: Format daily profit data for chart (convert date strings to Date objects)
            const formattedDailyProfit = (profitData.dailyProfit || []).map(day => ({
              date: day.date ? new Date(day.date).toISOString().split('T')[0] : day.date,
              sales: parseFloat(day.sales || 0),
              expenses: parseFloat(day.expenses || 0),
              profit: parseFloat(day.profit || 0)
            }))

            console.log('Profit & Loss data loaded:', {
              totalSales: profitData.totalSales,
              grossProfit: profitData.grossProfit,
              netProfit: profitData.netProfit,
              dailyProfitCount: formattedDailyProfit.length
            })

            setReportData(prev => ({
              ...prev,
              profitLoss: {
                totalSales: parseFloat(profitData.totalSales || 0),
                totalSalesWithVat: parseFloat(profitData.totalSalesWithVat || 0),
                totalPurchases: parseFloat(profitData.totalPurchases || 0),
                costOfGoodsSold: parseFloat(profitData.costOfGoodsSold || 0),
                totalExpenses: parseFloat(profitData.totalExpenses || 0),
                grossProfit: parseFloat(profitData.grossProfit || 0),
                grossProfitMargin: parseFloat(profitData.grossProfitMargin || 0),
                netProfit: parseFloat(profitData.netProfit || 0),
                netProfitMargin: parseFloat(profitData.netProfitMargin || 0),
                dailyProfit: formattedDailyProfit
              }
            }))
          } else {
            console.error('Profit & Loss response not successful:', profitResponse)
            toast.error(profitResponse?.message || 'Failed to load profit & loss data')
            setReportData(prev => ({ ...prev, profitLoss: null }))
          }
        } catch (error) {
          console.error('Error loading profit & loss:', error)
          toast.error(error?.response?.data?.message || 'Failed to load profit & loss report')
          setReportData(prev => ({ ...prev, profitLoss: null }))
        } finally {
          setLoading(false)
        }
      } else if (activeTab === 'outstanding') {
        try {
          setLoading(true)
          // CRITICAL: Get ALL pending bills regardless of invoice date
          // This ensures backdated invoices show as overdue
          // Only apply date filter if user has explicitly changed from default
          const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          const defaultTo = new Date().toISOString().split('T')[0]
          const isDefaultRange = dateRange.from === defaultFrom && dateRange.to === defaultTo

          const pendingBillsResponse = await reportsAPI.getPendingBills({
            // Only send date range if user explicitly changed it from default
            from: isDefaultRange ? undefined : dateRange.from,
            to: isDefaultRange ? undefined : dateRange.to,
            status: 'all'
          })
          console.log('Outstanding bills response:', pendingBillsResponse)
          if (pendingBillsResponse?.success && pendingBillsResponse?.data) {
            setReportData(prev => ({
              ...prev,
              outstandingBills: pendingBillsResponse.data || []
            }))
          } else if (pendingBillsResponse?.data && Array.isArray(pendingBillsResponse.data)) {
            // Handle case where data is directly in response
            setReportData(prev => ({
              ...prev,
              outstandingBills: pendingBillsResponse.data || []
            }))
          } else {
            // No data - set empty array
            setReportData(prev => ({
              ...prev,
              outstandingBills: []
            }))
          }
        } catch (error) {
          console.error('Error loading outstanding bills:', error)
          toast.error(error?.response?.data?.message || 'Failed to load outstanding bills')
          setReportData(prev => ({
            ...prev,
            outstandingBills: []
          }))
        } finally {
          setLoading(false)
        }
      } else if (activeTab === 'ai') {
        try {
          const aiResponse = await reportsAPI.getAISuggestions({ periodDays: 30 })
          if (aiResponse?.success && aiResponse?.data) {
            const suggestions = []
            const aiData = aiResponse.data

            // Generate suggestions from AI data
            if (aiData.restockCandidates && aiData.restockCandidates.length > 0) {
              aiData.restockCandidates.slice(0, 3).forEach(product => {
                suggestions.push({
                  type: 'restock',
                  title: 'Low Stock Alert',
                  description: `${product.nameEn || product.sku} running low (${product.stockQty} units left)`,
                  action: 'Create Purchase Order',
                  priority: 'high'
                })
              })
            }

            if (aiData.promotionCandidates && aiData.promotionCandidates.length > 0) {
              aiData.promotionCandidates.slice(0, 2).forEach(product => {
                const margin = product.sellPrice && product.costPrice
                  ? ((product.sellPrice - product.costPrice) / product.sellPrice * 100).toFixed(1)
                  : '0'
                suggestions.push({
                  type: 'promotion',
                  title: 'Promotion Opportunity',
                  description: `${product.nameEn || product.sku} has high margin (${margin}%)`,
                  action: 'Create Promotion',
                  priority: 'medium'
                })
              })
            }

            if (aiData.pendingCustomers && aiData.pendingCustomers.length > 0) {
              aiData.pendingCustomers.slice(0, 2).forEach(customer => {
                suggestions.push({
                  type: 'customer',
                  title: 'Outstanding Payment',
                  description: `${customer.name} has outstanding balance of ${formatCurrency(customer.balance)}`,
                  action: 'Send Reminder',
                  priority: 'medium'
                })
              })
            }

            setReportData(prev => ({ ...prev, aiSuggestions: suggestions }))
          }
        } catch (error) {
          console.error('Error loading AI suggestions:', error)
        }
      }
    } catch (error) {
      // Check if request was aborted (cancelled)
      const currentSignal = fetchAbortControllerRef.current?.signal
      if (error.name === 'AbortError' || (currentSignal && currentSignal.aborted)) {
        console.log('Request cancelled')
        return
      }

      // Don't show error for 429 (rate limit) - already handled by interceptor
      if (error?.response?.status === 429) {
        console.log('Rate limit exceeded, request throttled')
        // Reset fetching flag after delay
        setTimeout(() => {
          isFetchingRef.current = false
        }, 5000) // Wait 5 seconds before allowing next request
        return
      }

      // Only log error once, don't flood console
      if (!error._logged) {
        console.error('Error loading report data:', error)
        error._logged = true
      }

      // Error toast is already handled by API interceptor with throttling
      // Don't show duplicate error messages
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }, [dateRange, activeTab, filters])

  // Store latest fetchReportData in ref to avoid dependency issues
  useEffect(() => {
    fetchReportDataRef.current = fetchReportData
  }, [fetchReportData])

  // Sync activeTab with URL (on mount and when searchParams change, e.g. /reports?tab=outstanding)
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    const pathName = window.location.pathname

    if (pathName.includes('/outstanding')) {
      setActiveTab('outstanding')
      if (tabFromUrl !== 'outstanding') setSearchParams({ tab: 'outstanding' })
    } else if (tabFromUrl && tabs.find(t => t.id === tabFromUrl)) {
      setActiveTab(tabFromUrl)
    }
  }, [searchParams])

  // Listen for global data update events for instant refresh (with debouncing)
  useEffect(() => {
    let debounceTimer = null

    const handleDataUpdate = () => {
      // Skip if tab is changing or already fetching
      if (isTabChangingRef.current || isFetchingRef.current) {
        return
      }

      // AGGRESSIVE debounce - wait 15 seconds before refreshing
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(() => {
        // Only refresh if not already fetching and not changing tabs
        if (!isFetchingRef.current && !isTabChangingRef.current && fetchReportDataRef.current) {
          fetchReportDataRef.current(true) // Force refresh on data updates
        }
      }, 15000) // 15 second debounce (AGGRESSIVE)
    }

    window.addEventListener('dataUpdated', handleDataUpdate)
    window.addEventListener('paymentCreated', handleDataUpdate)
    window.addEventListener('customerCreated', handleDataUpdate)

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      window.removeEventListener('dataUpdated', handleDataUpdate)
      window.removeEventListener('paymentCreated', handleDataUpdate)
      window.removeEventListener('customerCreated', handleDataUpdate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only set up listeners once, use ref for fetchReportData

  // Load products, customers, branches for filters
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        const [productsRes, customersRes, branchesRes] = await Promise.all([
          productsAPI.getProducts({ page: 1, pageSize: 100 }),
          customersAPI.getCustomers({ page: 1, pageSize: 100 }),
          branchesAPI.getBranches().catch(() => ({ success: false }))
        ])
        if (productsRes?.success && productsRes?.data) {
          setProductsList(productsRes.data.items || [])
        }
        if (customersRes?.success && customersRes?.data) {
          setCustomersList(customersRes.data.items || [])
        }
        if (branchesRes?.success && branchesRes?.data) {
          setBranchesList(Array.isArray(branchesRes.data) ? branchesRes.data : [])
        }
      } catch (error) {
        console.error('Error loading filter data:', error)
      }
    }
    loadFilterData()
  }, [])

  // Load routes when branch filter changes (route dropdown filtered by branch)
  useEffect(() => {
    if (!filters.branch) {
      setRoutesList([])
      return
    }
    const branchId = parseInt(filters.branch, 10)
    if (!branchId) return
    routesAPI.getRoutes(branchId).then(res => {
      if (res?.success && res?.data) {
        setRoutesList(Array.isArray(res.data) ? res.data : [])
      } else {
        setRoutesList([])
      }
    }).catch(() => setRoutesList([]))
  }, [filters.branch])

  // Initial load ONLY ONCE on mount (separate from dependency-based refreshes)
  useEffect(() => {
    // Only do initial load once
    if (hasInitialLoadRef.current) {
      return
    }

    // Wait 1 second before initial load to prevent mount-time flooding
    initialLoadTimeoutRef.current = setTimeout(() => {
      if (!hasInitialLoadRef.current && fetchReportDataRef.current && !isFetchingRef.current) {
        hasInitialLoadRef.current = true
        fetchReportDataRef.current(true)
      }
    }, 1000) // 1 second delay before initial load (reasonable)

    return () => {
      if (initialLoadTimeoutRef.current) {
        clearTimeout(initialLoadTimeoutRef.current)
        initialLoadTimeoutRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  // Handle dependency-based refreshes (dateRange, activeTab, filters change)
  useEffect(() => {
    // Skip if initial load hasn't happened yet
    if (!hasInitialLoadRef.current) {
      return
    }

    // Skip if already fetching or tab changing
    if (isFetchingRef.current || isTabChangingRef.current) {
      return
    }

    // Cleanup any pending timeouts
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
      fetchTimeoutRef.current = null
    }

    // Debounce requests to prevent too many API calls, but not too aggressively
    fetchTimeoutRef.current = setTimeout(() => {
      // Double-check conditions before fetching
      if (
        !isFetchingRef.current &&
        !isTabChangingRef.current &&
        fetchReportDataRef.current &&
        hasInitialLoadRef.current
      ) {
        fetchReportDataRef.current(true)
      }
    }, 1000) // 1 second debounce (reduced from 10 seconds for better UX)

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
        fetchTimeoutRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, activeTab, filters]) // Only refresh when these change

  // Auto-refresh interval (separate useEffect) - DISABLED to prevent 429 errors
  useEffect(() => {
    // DISABLED: Auto-refresh causes too many requests
    // Users can manually refresh if needed
    return () => { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - never runs

  const handleExport = async (format) => {
    try {
      toast.loading(`Exporting ${format.toUpperCase()} report...`)
      const blob = await reportsAPI.exportReportPdf({ fromDate: dateRange.from, toDate: dateRange.to, format })

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report_${dateRange.from}_${dateRange.to}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      toast.dismiss()
      toast.success(`${format.toUpperCase()} report exported successfully!`)
    } catch (error) {
      console.error('Failed to export report:', error)
      toast.error('Failed to export report')
    }
  }

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6']

  if (loading) {
    return <LoadingCard message="Loading reports..." />
  }

  return (
    <div className="w-full space-y-6">
      {/* Header — full width */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-[#0F172A]">Reports & Analytics</h1>
          <p className="text-xs sm:text-sm text-[#475569]">Comprehensive business insights and analytics</p>
        </div>
        <div className="mt-2 sm:mt-0 flex flex-wrap gap-2 sm:space-x-3">
          <button
            onClick={() => fetchReportData()}
            className="inline-flex items-center justify-center px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#0F172A] bg-white hover:bg-[#F8FAFC] transition-colors duration-150"
          >
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="inline-flex items-center justify-center px-3 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-150"
          >
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export PDF</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>

      {/* Filters — horizontal full width */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4 lg:p-6 w-full">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-primary-600 mr-2" />
          <h3 className="text-base lg:text-lg font-semibold text-neutral-900">Filters</h3>
        </div>

        {/* Date Range Presets */}
        {activeTab === 'sales' && (
          <div className="mb-3 sm:mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0]
                setDateRange({ from: today, to: today })
              }}
              className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
            >
              Today
            </button>
            <button
              onClick={() => {
                const yesterday = new Date()
                yesterday.setDate(yesterday.getDate() - 1)
                const yesterdayStr = yesterday.toISOString().split('T')[0]
                setDateRange({ from: yesterdayStr, to: yesterdayStr })
              }}
              className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
            >
              Yesterday
            </button>
            <button
              onClick={() => {
                const to = new Date().toISOString().split('T')[0]
                const from = new Date()
                from.setDate(from.getDate() - 7)
                setDateRange({ from: from.toISOString().split('T')[0], to })
              }}
              className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => {
                const to = new Date()
                const from = new Date(to)
                from.setDate(from.getDate() - from.getDay()) // Start of week (Sunday)
                setDateRange({ from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] })
              }}
              className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
            >
              This Week
            </button>
            <button
              onClick={() => {
                const to = new Date().toISOString().split('T')[0]
                const from = new Date()
                from.setDate(1) // First day of month
                setDateRange({ from: from.toISOString().split('T')[0], to })
              }}
              className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
            >
              This Month
            </button>
            <button
              onClick={() => {
                const to = new Date().toISOString().split('T')[0]
                const from = new Date()
                from.setFullYear(from.getFullYear(), 0, 1) // First day of year
                setDateRange({ from: from.toISOString().split('T')[0], to })
              }}
              className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
            >
              This Year
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          <Input
            label="From Date"
            type="date"
            value={dateRange.from}
            onChange={(e) => {
              setDateRange(prev => ({ ...prev, from: e.target.value }))
            }}
            onBlur={() => {
              // AGGRESSIVE debounce - wait 3 seconds before fetching
              if (!isFetchingRef.current) {
                setTimeout(() => {
                  if (!isFetchingRef.current) {
                    fetchReportData(true)
                  }
                }, 3000) // 3 second delay (increased from 500ms)
              }
            }}
          />
          <Input
            label="To Date"
            type="date"
            value={dateRange.to}
            onChange={(e) => {
              setDateRange(prev => ({ ...prev, to: e.target.value }))
            }}
            onBlur={() => {
              // AGGRESSIVE debounce - wait 3 seconds before fetching
              if (!isFetchingRef.current) {
                setTimeout(() => {
                  if (!isFetchingRef.current) {
                    fetchReportData(true)
                  }
                }, 3000) // 3 second delay (increased from 500ms)
              }
            }}
          />
          <Select
            label="Branch"
            options={[
              { value: '', label: 'All Branches' },
              ...branchesList.map(b => ({ value: String(b.id), label: b.name || 'Branch' }))
            ]}
            value={filters.branch}
            onChange={(e) => {
              setFilters(prev => ({ ...prev, branch: e.target.value, route: '' }))
              if (!isFetchingRef.current) {
                setTimeout(() => { if (!isFetchingRef.current) fetchReportData(true) }, 3000)
              }
            }}
          />
          <Select
            label="Route"
            options={[
              { value: '', label: filters.branch ? 'All Routes' : 'Select branch first' },
              ...routesList.map(r => ({ value: String(r.id), label: r.name || 'Route' }))
            ]}
            value={filters.route}
            onChange={(e) => {
              setFilters(prev => ({ ...prev, route: e.target.value }))
              if (!isFetchingRef.current) {
                setTimeout(() => { if (!isFetchingRef.current) fetchReportData(true) }, 3000)
              }
            }}
          />
          <Select
            label="Product"
            options={[
              { value: '', label: 'All Products' },
              ...productsList.map(p => ({ value: p.id?.toString(), label: p.nameEn || p.sku || 'Unknown' }))
            ]}
            value={filters.product}
            onChange={(e) => {
              setFilters(prev => ({ ...prev, product: e.target.value }))
              // AGGRESSIVE debounce - wait 3 seconds before fetching
              if (!isFetchingRef.current) {
                setTimeout(() => {
                  if (!isFetchingRef.current) {
                    fetchReportData(true)
                  }
                }, 3000) // 3 second delay (increased from 500ms)
              }
            }}
          />
          <Select
            label="Customer"
            options={[
              { value: '', label: 'All Customers' },
              ...customersList.map(c => ({ value: c.id?.toString(), label: c.name || 'Unknown' }))
            ]}
            value={filters.customer}
            onChange={(e) => {
              setFilters(prev => ({ ...prev, customer: e.target.value }))
              // AGGRESSIVE debounce - wait 3 seconds before fetching
              if (!isFetchingRef.current) {
                setTimeout(() => {
                  if (!isFetchingRef.current) {
                    fetchReportData(true)
                  }
                }, 3000) // 3 second delay (increased from 500ms)
              }
            }}
          />
          {/* Status filter for Sales Report */}
          {activeTab === 'sales' && (
            <Select
              label="Status"
              options={[
                { value: '', label: 'All Status' },
                { value: 'Paid', label: 'Paid' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Partial', label: 'Partial' }
              ]}
              value={filters.status}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, status: e.target.value }))
                if (!isFetchingRef.current) {
                  setTimeout(() => {
                    if (!isFetchingRef.current) {
                      fetchReportData(true)
                    }
                  }, 3000)
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Tabs — scrollable horizontal pills (no overflow/overlap) */}
      <div className="bg-white rounded-lg border border-[#E5E7EB]">
        <div className="px-2 sm:px-4 py-2">
          <nav
            className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1"
            role="tablist"
            aria-label="Report sections"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 py-2 px-3 sm:px-4 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                    active
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-[#475569] bg-[#F8FAFC] border border-[#E5E7EB] hover:bg-primary-50 hover:border-primary-200 hover:text-primary-700'
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span>{tab.name.split(' ')[0]}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Summary Tab */}
          {activeTab === 'summary' && reportData.summary && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                <div className="bg-green-50 rounded-lg p-3 sm:p-4 lg:p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-green-600 flex-shrink-0" />
                    <div className="ml-2 sm:ml-3 lg:ml-4 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-green-600">Total Sales</p>
                      <p className="text-base sm:text-xl lg:text-2xl font-bold text-green-900 truncate">
                        {formatCurrency(reportData.summary.totalSales || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-3 sm:p-4 lg:p-6">
                  <div className="flex items-center">
                    <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-blue-600 flex-shrink-0" />
                    <div className="ml-2 sm:ml-3 lg:ml-4 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-blue-600">Total Purchases</p>
                      <p className="text-base sm:text-xl lg:text-2xl font-bold text-blue-900 truncate">
                        {formatCurrency(reportData.summary.totalPurchases || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 rounded-lg p-3 sm:p-4 lg:p-6">
                  <div className="flex items-center">
                    <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-red-600 flex-shrink-0" />
                    <div className="ml-2 sm:ml-3 lg:ml-4 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-red-600">Total Expenses</p>
                      <p className="text-base sm:text-xl lg:text-2xl font-bold text-red-900 truncate">
                        {formatCurrency(reportData.summary.totalExpenses || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-3 sm:p-4 lg:p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-purple-600 flex-shrink-0" />
                    <div className="ml-2 sm:ml-3 lg:ml-4 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-purple-600">Net Profit</p>
                      <p className="text-base sm:text-xl lg:text-2xl font-bold text-purple-900 truncate">
                        {formatCurrency(reportData.summary.netProfit || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend</h3>
                  {reportData.sales.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={reportData.sales}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Line type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      No sales data available for the selected period
                    </div>
                  )}
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown</h3>
                  {reportData.summary.totalExpenses > 0 ? (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      Expense breakdown chart coming soon
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      No expense data available
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sales Tab */}
          {activeTab === 'sales' && (
            <div className="space-y-6">
              {loadingSales ? (
                <LoadingCard message="Loading sales data..." />
              ) : (
                <>
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Performance</h3>
                    {reportData.sales.length > 0 ? (
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={reportData.sales}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} />
                          <YAxis axisLine={false} tickLine={false} />
                          <Tooltip formatter={(value) => formatCurrency(value)} />
                          <Bar dataKey="amount" fill="#10B981" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-64 text-gray-500">
                        No sales data available for the selected period
                      </div>
                    )}
                  </div>

                  {/* Sales Table with Status Colors */}
                  {reportData.salesList && reportData.salesList.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">Sales Details</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice No</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {reportData.salesList.map((sale, idx) => {
                              // Color coding: Paid = green, Pending = orange, Overdue = red
                              const statusColor = sale.status === 'Paid'
                                ? 'bg-green-100 text-green-800'
                                : sale.isOverdue
                                  ? 'bg-red-100 text-red-800'
                                  : sale.status === 'Partial'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-orange-100 text-orange-800'

                              return (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {sale.invoiceNo}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(sale.invoiceDate).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    {sale.customerName || 'Cash Customer'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                                    {formatCurrency(sale.grandTotal || 0)}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                                    {formatCurrency(sale.paidAmount || 0)}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                                    <span className={sale.balance > 0.01 ? 'text-red-600' : 'text-green-600'}>
                                      {formatCurrency(sale.balance || 0)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-center">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColor}`}>
                                      {sale.status}
                                      {sale.isOverdue && ' (Overdue)'}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Products Tab */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Products by Sales</h3>
                  {reportData.products && reportData.products.length > 0 ? (
                    <div className="space-y-4">
                      {reportData.products.map((product, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex items-center flex-1">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                              <span className="text-blue-600 font-semibold">#{index + 1}</span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{product.name}</p>
                              {product.qty > 0 && (
                                <p className="text-sm text-gray-600">
                                  Quantity Sold: {product.qty.toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">{formatCurrency(product.sales)}</p>
                            <p className="text-sm text-gray-600">Total Sales</p>
                          </div>
                        </div>
                      ))}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-gray-900">Total Sales</p>
                          <p className="font-bold text-lg text-green-600">
                            {formatCurrency(
                              reportData.products.reduce((sum, p) => sum + (p.sales || 0), 0)
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                      <PieChart className="h-12 w-12 mb-2 text-gray-400" />
                      <p>No product sales data available</p>
                      <p className="text-sm mt-1">Try selecting a different date range</p>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Sales Distribution</h3>
                  {reportData.products && reportData.products.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={reportData.products.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          interval={0}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="sales" fill="#3B82F6" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      No product sales data available for chart
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Customers Tab */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Outstanding Customers Report</h3>
                {reportData.customers && reportData.customers.length > 0 ? (
                  <div className="space-y-4">
                    {reportData.customers.map((customer, index) => (
                      <div key={customer.id || index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{customer.name}</p>
                          {customer.phone && (
                            <p className="text-sm text-gray-600">
                              Phone: {customer.phone}
                            </p>
                          )}
                          {customer.creditLimit > 0 && (
                            <p className="text-sm text-gray-500">
                              Credit Limit: {formatCurrency(customer.creditLimit)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold text-lg ${customer.total > (customer.creditLimit * 0.8)
                              ? 'text-red-600'
                              : customer.total > (customer.creditLimit * 0.5)
                                ? 'text-yellow-600'
                                : 'text-gray-900'
                            }`}>
                            {formatCurrency(customer.total)}
                          </p>
                          <p className="text-sm text-gray-600">Outstanding Balance</p>
                          {customer.creditLimit > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              {((customer.total / customer.creditLimit) * 100).toFixed(1)}% of limit
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-900">Total Outstanding</p>
                        <p className="font-bold text-lg text-red-600">
                          {formatCurrency(
                            reportData.customers.reduce((sum, c) => sum + (c.total || 0), 0)
                          )}
                        </p>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {reportData.customers.length} {reportData.customers.length === 1 ? 'customer' : 'customers'} with outstanding balance
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <FileText className="h-12 w-12 mb-2 text-gray-400" />
                    <p>No outstanding customers found</p>
                    <p className="text-sm mt-1">All customers have zero balance</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Expenses Tab */}
          {activeTab === 'expenses' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown by Category</h3>
                  {reportData.expenses && reportData.expenses.length > 0 ? (
                    <div className="space-y-4">
                      {reportData.expenses.map((expense, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <div
                              className="w-4 h-4 rounded-full mr-3"
                              style={{ backgroundColor: expense.categoryColor }}
                            />
                            <div>
                              <p className="font-medium text-gray-900">{expense.categoryName}</p>
                              <p className="text-sm text-gray-600">
                                {expense.expenseCount} {expense.expenseCount === 1 ? 'expense' : 'expenses'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">{formatCurrency(expense.totalAmount)}</p>
                            <p className="text-sm text-gray-600">
                              {reportData.summary && reportData.summary.totalExpenses > 0
                                ? ((expense.totalAmount / reportData.summary.totalExpenses) * 100).toFixed(1)
                                : 0}%
                            </p>
                          </div>
                        </div>
                      ))}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-gray-900">Total Expenses</p>
                          <p className="font-bold text-lg text-gray-900">
                            {formatCurrency(
                              reportData.expenses.reduce((sum, e) => sum + (e.totalAmount || 0), 0)
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      No expense data available for the selected period
                    </div>
                  )}
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Distribution</h3>
                  {reportData.expenses && reportData.expenses.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <RechartsPieChart>
                        <Pie
                          data={reportData.expenses.map(e => ({
                            name: e.categoryName,
                            value: e.totalAmount
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {reportData.expenses.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.categoryColor || COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      No expense data available for the selected period
                    </div>
                  )}
                </div>
              </div>

              {reportData.summary && reportData.summary.totalExpenses > 0 && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-600">Total Expenses for Selected Period</p>
                      <p className="text-3xl font-bold text-red-900 mt-2">
                        {formatCurrency(reportData.summary.totalExpenses || 0)}
                      </p>
                    </div>
                    <TrendingDown className="h-12 w-12 text-red-600" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Profit & Loss Tab */}
          {activeTab === 'profit-loss' && (
            <div className="space-y-6">
              {reportData.profitLoss ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                      <p className="text-sm font-medium text-green-600">Total Sales</p>
                      <p className="text-2xl font-bold text-green-900 mt-2">
                        {formatCurrency(reportData.profitLoss.totalSales || 0)}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                      <p className="text-sm font-medium text-blue-600">Total Purchases</p>
                      <p className="text-2xl font-bold text-blue-900 mt-2">
                        {formatCurrency(reportData.profitLoss.totalPurchases || 0)}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
                      <p className="text-sm font-medium text-purple-600">Gross Profit</p>
                      <p className="text-2xl font-bold text-purple-900 mt-2">
                        {formatCurrency(reportData.profitLoss.grossProfit || 0)}
                      </p>
                      <p className="text-xs text-purple-600 mt-1">
                        Margin: {reportData.profitLoss.grossProfitMargin?.toFixed(1) || (reportData.profitLoss.totalSales > 0
                          ? ((reportData.profitLoss.grossProfit / reportData.profitLoss.totalSales) * 100).toFixed(1)
                          : 0)}%
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-6 border border-red-200">
                      <p className="text-sm font-medium text-red-600">Total Expenses</p>
                      <p className="text-2xl font-bold text-red-900 mt-2">
                        {formatCurrency(reportData.profitLoss.totalExpenses || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border-2 border-green-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Net Profit / Loss</p>
                        <p className={`text-4xl font-bold mt-2 ${(reportData.profitLoss.netProfit || 0) >= 0 ? 'text-green-700' : 'text-red-700'
                          }`}>
                          {formatCurrency(reportData.profitLoss.netProfit || 0)}
                        </p>
                        <p className="text-sm text-gray-600 mt-2">
                          Net Profit Margin: {reportData.profitLoss.netProfitMargin?.toFixed(2) || (reportData.profitLoss.totalSales > 0
                            ? ((reportData.profitLoss.netProfit / reportData.profitLoss.totalSales) * 100).toFixed(2)
                            : 0)}%
                        </p>
                      </div>
                      <TrendingUp className={`h-16 w-16 ${(reportData.profitLoss.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`} />
                    </div>
                  </div>

                  {reportData.profitLoss.dailyProfit && reportData.profitLoss.dailyProfit.length > 0 ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Profit Trend</h3>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={reportData.profitLoss.dailyProfit}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value) => {
                              try {
                                return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                              } catch {
                                return value
                              }
                            }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis axisLine={false} tickLine={false} />
                          <Tooltip
                            formatter={(value) => formatCurrency(value)}
                            labelFormatter={(value) => {
                              try {
                                return new Date(value).toLocaleDateString()
                              } catch {
                                return value
                              }
                            }}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2} name="Profit" />
                          <Line type="monotone" dataKey="sales" stroke="#3B82F6" strokeWidth={2} name="Sales" />
                          <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} name="Expenses" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Profit Trend</h3>
                      <div className="flex items-center justify-center h-64 text-gray-500">
                        <p>No daily profit data available for the selected period</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Profit & Loss Summary</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-gray-700">Total Sales Revenue</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(reportData.profitLoss.totalSales || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-gray-700">Less: Cost of Goods Sold (COGS)</span>
                        <span className="font-semibold text-red-600">-{formatCurrency(reportData.profitLoss.costOfGoodsSold || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b-2 border-gray-300">
                        <span className="font-semibold text-gray-900">Gross Profit</span>
                        <span className="font-bold text-green-600">{formatCurrency(reportData.profitLoss.grossProfit || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-gray-700">Less: Operating Expenses</span>
                        <span className="font-semibold text-red-600">-{formatCurrency(reportData.profitLoss.totalExpenses || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-t-2 border-gray-400 bg-gray-50 rounded px-3">
                        <span className="font-bold text-lg text-gray-900">Net Profit / Loss</span>
                        <span className={`font-bold text-2xl ${(reportData.profitLoss.netProfit || 0) >= 0 ? 'text-green-700' : 'text-red-700'
                          }`}>
                          {formatCurrency(reportData.profitLoss.netProfit || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <TrendingUp className="h-12 w-12 mb-2 text-gray-400" />
                  <p>No profit & loss data available</p>
                  <p className="text-sm mt-1">Try selecting a different date range</p>
                </div>
              )}
            </div>
          )}

          {/* Outstanding Bills Tab */}
          {activeTab === 'outstanding' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Pending Bills & Outstanding Invoices</h3>
                    <p className="text-sm text-gray-600 mt-1">Invoices with unpaid or partially paid balances</p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        toast.loading('Generating PDF...')
                        const blob = await reportsAPI.exportPendingBillsPdf({
                          fromDate: dateRange.from,
                          toDate: dateRange.to
                        })

                        const url = window.URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `pending_bills_${dateRange.from}_${dateRange.to}.pdf`
                        document.body.appendChild(a)
                        a.click()
                        a.remove()
                        window.URL.revokeObjectURL(url)
                        toast.dismiss()
                        toast.success('PDF downloaded successfully!')
                      } catch (error) {
                        console.error('Failed to export PDF:', error)
                        toast.dismiss()
                        toast.error(error.message || 'Failed to export PDF')
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 transition-colors"
                    disabled={!reportData.outstandingBills || reportData.outstandingBills.length === 0}
                  >
                    <Download className="h-4 w-4" />
                    <span>Export PDF</span>
                  </button>
                </div>

                {reportData.outstandingBills && reportData.outstandingBills.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Invoice No</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Customer</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Total</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Paid</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Balance</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Days Overdue</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reportData.outstandingBills.map((bill) => (
                          <tr key={bill.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {bill.invoiceNo}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {bill.customerName || 'Cash Customer'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {new Date(bill.invoiceDate).toLocaleDateString('en-GB')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                              {formatCurrency(bill.grandTotal)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                              {formatCurrency(bill.paidAmount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-red-600">
                              {formatCurrency(bill.balanceAmount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bill.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' :
                                  bill.paymentStatus === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                }`}>
                                {bill.paymentStatus}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {bill.daysOverdue > 0 ? (
                                <span className={`font-medium ${bill.daysOverdue > 90 ? 'text-red-600' :
                                    bill.daysOverdue > 60 ? 'text-orange-600' :
                                      'text-yellow-600'
                                  }`}>
                                  {bill.daysOverdue} days
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                              <button
                                onClick={() => {
                                  if (bill.customerId) {
                                    navigate(`/ledger?customerId=${bill.customerId}`)
                                  } else {
                                    toast.error('Customer ID not available for this bill')
                                  }
                                }}
                                className="text-blue-600 hover:text-blue-800 font-medium hover:underline transition"
                                title={bill.customerName || 'View customer ledger'}
                              >
                                {bill.customerName ? bill.customerName : 'View Ledger'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan="4" className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                            Total Outstanding:
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-semibold text-green-600">
                            {formatCurrency(reportData.outstandingBills.reduce((sum, b) => sum + b.paidAmount, 0))}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-bold text-red-600">
                            {formatCurrency(reportData.outstandingBills.reduce((sum, b) => sum + b.balanceAmount, 0))}
                          </td>
                          <td colSpan="3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <DollarSign className="h-12 w-12 mb-2 text-gray-400" />
                    <p>No outstanding bills found</p>
                    <p className="text-sm mt-1">All invoices are fully paid</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Insights Tab */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <Eye className="h-6 w-6 text-blue-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">AI Business Insights</h3>
                </div>
                <p className="text-gray-600 mb-6">
                  AI-powered recommendations to optimize your business performance
                </p>

                {reportData.aiSuggestions && reportData.aiSuggestions.length > 0 ? (
                  <div className="space-y-4">
                    {reportData.aiSuggestions.map((suggestion, index) => (
                      <div key={index} className={`p-4 rounded-lg border-l-4 ${suggestion.priority === 'high' ? 'bg-red-50 border-red-400' :
                          suggestion.priority === 'medium' ? 'bg-yellow-50 border-yellow-400' :
                            'bg-green-50 border-green-400'
                        }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{suggestion.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{suggestion.description}</p>
                          </div>
                          <button className="ml-4 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
                            {suggestion.action}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12 text-gray-500">
                    No AI suggestions available at this time
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReportsPage
