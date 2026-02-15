import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Package, ShoppingCart, Users, Truck, CreditCard, FileText,
    Settings, Database, BarChart3, DollarSign, TrendingUp,
    AlertTriangle, RefreshCw, LogOut, Menu, X, ChevronRight,
    Bell, HardDrive, TrendingDown, BookOpen, Wallet, User,
    Building2, MapPin, Printer
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency } from '../../utils/currency'
import toast from 'react-hot-toast'
import { reportsAPI, alertsAPI } from '../../services'
import { isAdminOrOwner, isOwner } from '../../utils/roles'
import { useBranding } from '../../contexts/TenantBrandingContext'

const DashboardTally = () => {
    const { user, logout } = useAuth()
    const { companyName } = useBranding()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        salesToday: 0,
        expensesToday: 0,
        profitToday: 0,
        pendingBills: 0,
        lowStockCount: 0,
        invoicesToday: 0,
        invoicesWeekly: 0,
        invoicesMonthly: 0
    })
    const [sidebarExpanded, setSidebarExpanded] = useState(true)
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
    const [unreadAlertsCount, setUnreadAlertsCount] = useState(0)
    const [showAlertsModal, setShowAlertsModal] = useState(false)
    const [alerts, setAlerts] = useState([])
    const [showPrintModal, setShowPrintModal] = useState(false)

    // Request throttling for dashboard
    const lastFetchTimeRef = useRef(0)
    const isFetchingRef = useRef(false)
    const fetchTimeoutRef = useRef(null)
    const DASHBOARD_THROTTLE_MS = 10000 // 10 seconds minimum between dashboard requests

    // Dashboard Item Permissions Logic
    const canShow = (itemId) => {
        // Only Owners and SystemAdmins bypass all permission checks
        if (isOwner(user)) return true

        // If permissions array doesn't exist (legacy), show everything
        if (user?.dashboardPermissions === null || user?.dashboardPermissions === undefined) return true

        // Otherwise, check if the specific item ID is in the allowed list
        return user.dashboardPermissions.split(',').includes(itemId)
    }

    useEffect(() => {
        const fetchStatsThrottled = async () => {
            const now = Date.now()
            const timeSinceLastFetch = now - lastFetchTimeRef.current

            if (isFetchingRef.current) {
                return // Already fetching
            }

            if (timeSinceLastFetch < DASHBOARD_THROTTLE_MS) {
                // Schedule for later
                if (fetchTimeoutRef.current) {
                    clearTimeout(fetchTimeoutRef.current)
                }
                fetchTimeoutRef.current = setTimeout(() => {
                    fetchStatsThrottled()
                }, DASHBOARD_THROTTLE_MS - timeSinceLastFetch)
                return
            }

            isFetchingRef.current = true
            lastFetchTimeRef.current = now

            try {
                await fetchStats()
            } finally {
                isFetchingRef.current = false
            }
        }

        // Initial load
        fetchStatsThrottled()

        // Declare intervals at the top level
        let interval = null
        let alertsInterval = null

        // Fetch alerts count (admin only)
        if (user?.role?.toLowerCase() === 'admin') {
            fetchAlertsCount()
            // Refresh alerts count every 30 seconds
            alertsInterval = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    fetchAlertsCount()
                }
            }, 30000)
        }

        // Auto-refresh every 2 minutes (increased from 30 seconds)
        interval = setInterval(() => {
            if (document.visibilityState === 'visible' && !isFetchingRef.current) {
                fetchStatsThrottled()
            }
        }, 120000) // 2 minutes

        // Listen for global data update events (with debouncing)
        let debounceTimer = null
        const handleDataUpdate = () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer)
            }
            debounceTimer = setTimeout(() => {
                if (!isFetchingRef.current) {
                    fetchStatsThrottled()
                }
            }, 5000) // 5 second debounce
        }

        window.addEventListener('dataUpdated', handleDataUpdate)
        window.addEventListener('paymentCreated', handleDataUpdate)
        window.addEventListener('customerCreated', handleDataUpdate)

        return () => {
            if (interval) {
                clearInterval(interval)
            }
            if (alertsInterval) {
                clearInterval(alertsInterval)
            }
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current)
            }
            if (debounceTimer) {
                clearTimeout(debounceTimer)
            }
            window.removeEventListener('dataUpdated', handleDataUpdate)
            window.removeEventListener('paymentCreated', handleDataUpdate)
            window.removeEventListener('customerCreated', handleDataUpdate)
        }
    }, [user])

    const fetchStats = async () => {
        try {
            setLoading(true)
            // CRITICAL: Fetch real data for today with explicit date range
            const today = new Date()
            const todayStr = today.toISOString().split('T')[0]

            const response = await reportsAPI.getSummaryReport({
                fromDate: todayStr,
                toDate: todayStr
            })

            if (response?.success && response?.data) {
                const data = response.data
                console.log('Dashboard Data Received:', {
                    salesToday: data.salesToday,
                    expensesToday: data.expensesToday,
                    profitToday: data.profitToday,
                    pendingBills: data.pendingBills,
                    invoicesToday: data.invoicesToday,
                    invoicesWeekly: data.invoicesWeekly,
                    invoicesMonthly: data.invoicesMonthly
                })

                setStats({
                    salesToday: parseFloat(data.salesToday || data.SalesToday) || 0,
                    expensesToday: parseFloat(data.expensesToday || data.ExpensesToday) || 0,
                    profitToday: parseFloat(data.profitToday || data.ProfitToday) || 0,
                    pendingBills: parseInt(data.pendingBills || data.PendingBills) || 0,
                    lowStockCount: Array.isArray(data.lowStockProducts || data.LowStockProducts) ? (data.lowStockProducts || data.LowStockProducts || []).length : 0,
                    invoicesToday: parseInt(data.invoicesToday || data.InvoicesToday) || 0,
                    invoicesWeekly: parseInt(data.invoicesWeekly || data.InvoicesWeekly) || 0,
                    invoicesMonthly: parseInt(data.invoicesMonthly || data.InvoicesMonthly) || 0
                })
            } else {
                console.error('Dashboard API response invalid:', response)
                toast.error('Failed to load dashboard data: Invalid response')
            }
        } catch (error) {
            console.error('Failed to fetch dashboard stats:', error)
            toast.error(`Failed to load dashboard data: ${error.message || 'Unknown error'}`)
        } finally {
            setLoading(false)
        }
    }

    const fetchAlerts = async () => {
        try {
            const response = await alertsAPI.getAlerts()
            if (response.success) {
                setAlerts(response.data || [])
            }
        } catch (error) {
            console.error('Failed to fetch alerts:', error)
        }
    }

    const fetchAlertsCount = async () => {
        try {
            const response = await alertsAPI.getUnreadCount()
            if (response.success) {
                setUnreadAlertsCount(response.data || 0)
            }
        } catch (error) {
            console.error('Failed to fetch alerts count:', error)
        }
    }

    const gatewayMenu = [
        {
            title: 'MASTERS',
            items: [
                { icon: Package, label: 'Products', path: '/products', shortcut: 'F1' },
                ...(isAdminOrOwner(user) ? [
                    { icon: Building2, label: 'Branches', path: '/branches', shortcut: '', adminOnly: true },
                    { icon: MapPin, label: 'Routes', path: '/routes', shortcut: '', adminOnly: true }
                ] : [])
            ]
        },
        {
            title: 'TRANSACTIONS',
            items: [
                { id: 'pos', icon: ShoppingCart, label: 'POS Billing', path: '/pos', shortcut: 'F3', primary: true },
                ...(isAdminOrOwner(user) ? [
                    { id: 'purchases', icon: Truck, label: 'Purchases', path: '/purchases', shortcut: 'F4' },
                    { id: 'expenses', icon: Wallet, label: 'Expenses', path: '/expenses', shortcut: 'F5' }
                ] : []),
                { id: 'customerLedger', icon: FileText, label: 'Customer Ledger', path: '/ledger', shortcut: 'F10' },
                { id: 'salesLedger', icon: BookOpen, label: 'Sales Ledger', path: '/sales-ledger', shortcut: 'F10' }
            ]
        },
        {
            title: 'REPORTS',
            items: [
                ...(isAdminOrOwner(user) ? [
                    { id: 'salesTrend', icon: BarChart3, label: 'Sales Report', path: '/reports?tab=sales', shortcut: 'F7' },
                    { id: 'profitToday', icon: TrendingUp, label: 'Profit & Loss', path: '/reports?tab=profit-loss', shortcut: 'F8' },
                    { id: 'pendingBills', icon: DollarSign, label: 'Outstanding Bills', path: '/reports?tab=outstanding', shortcut: 'F9' },
                    { id: 'routesSummary', icon: MapPin, label: 'Routes summary & ledger', path: '/routes', shortcut: '', adminOnly: true }
                ] : [])
            ]
        },
        {
            title: 'UTILITIES',
            items: [
                { icon: Settings, label: 'Settings', path: '/settings', shortcut: 'Ctrl+S', adminOnly: true },
                { icon: Database, label: 'Backup & Restore', path: '/backup', shortcut: 'Ctrl+B', adminOnly: true },
                { icon: Users, label: 'Users', path: '/users', shortcut: 'Ctrl+U', adminOnly: true }
            ]
        }
    ]

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50">
            {/* Top Header Bar - Mobile Responsive */}
            <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white shadow-lg">
                <div className="flex items-center justify-between px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 lg:py-3">
                    <div className="flex items-center space-x-1.5 sm:space-x-2 flex-1 min-w-0">
                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setMobileSidebarOpen(true)}
                            className="lg:hidden p-2 hover:bg-blue-700 rounded-lg transition cursor-pointer touch-manipulation"
                            aria-label="Open menu"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        {/* Desktop Sidebar Toggle - Hidden for Staff */}
                        {user?.role?.toLowerCase() !== 'staff' && (
                            <button
                                onClick={() => setSidebarExpanded(!sidebarExpanded)}
                                className="hidden lg:flex p-1 sm:p-1.5 hover:bg-blue-700 rounded-lg transition flex-shrink-0 cursor-pointer"
                            >
                                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
                            </button>
                        )}
                        <div className="min-w-0 flex-1">
                            <h1 className="text-xs sm:text-sm lg:text-base xl:text-lg font-bold truncate">{companyName}</h1>
                        </div>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0">
                        {/* Top Bar Icons - Admin/Owner Only */}
                        {isAdminOrOwner(user) && (
                            <>
                                <button
                                    onClick={() => navigate('/backup')}
                                    className="hidden sm:flex p-2 sm:p-2.5 lg:p-3 hover:bg-blue-700 rounded-lg transition items-center justify-center"
                                    title="Backup & Restore"
                                >
                                    <HardDrive className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
                                </button>
                                <button
                                    onClick={() => navigate('/settings')}
                                    className="hidden sm:flex p-2 sm:p-2.5 lg:p-3 hover:bg-blue-700 rounded-lg transition items-center justify-center"
                                    title="Settings"
                                >
                                    <Settings className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
                                </button>
                                <button
                                    onClick={() => navigate('/reports?tab=profit-loss')}
                                    className="hidden sm:flex p-2 sm:p-2.5 lg:p-3 hover:bg-blue-700 rounded-lg transition items-center justify-center"
                                    title="Profit & Loss"
                                >
                                    <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
                                </button>
                                <button
                                    onClick={() => navigate('/users')}
                                    className="hidden sm:flex p-2 sm:p-2.5 lg:p-3 hover:bg-blue-700 rounded-lg transition items-center justify-center"
                                    title="Users"
                                >
                                    <Users className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
                                </button>
                            </>
                        )}
                        {/* Alerts Notification Icon */}
                        {isAdminOrOwner(user) && (
                            <button
                                onClick={async () => {
                                    await fetchAlerts()
                                    setShowAlertsModal(true)
                                }}
                                className="relative p-2 sm:p-2.5 lg:p-3 hover:bg-blue-700 rounded-lg transition flex items-center justify-center"
                                title="Alerts & Notifications"
                            >
                                <Bell className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
                                {unreadAlertsCount > 0 && (
                                    <span className="absolute -top-1 -right-1 h-5 w-5 sm:h-6 sm:w-6 bg-red-500 rounded-full border-2 border-blue-900 flex items-center justify-center">
                                        <span className="text-xs sm:text-xs font-bold text-white">{unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}</span>
                                    </span>
                                )}
                            </button>
                        )}
                        {/* Printer / Print setup */}
                        <button
                            onClick={() => setShowPrintModal(true)}
                            className="p-2 sm:p-2.5 lg:p-3 hover:bg-blue-700 rounded-lg transition flex items-center justify-center"
                            title="Print & printer setup"
                        >
                            <Printer className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
                        </button>
                        {/* Profile Button - Always visible */}
                        <button
                            onClick={() => navigate('/profile')}
                            className="p-2 sm:p-2.5 hover:bg-blue-700 rounded-lg transition flex items-center justify-center"
                            title="My Profile"
                        >
                            <User className="h-5 w-5 sm:h-6 sm:w-6" />
                        </button>
                        <div className="text-right hidden md:block">
                            <p className="text-xs sm:text-xs font-medium">{new Date().toLocaleDateString('en-GB', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            })}</p>
                            <p className="text-xs text-amber-200">{user?.name || 'User'}</p>
                        </div>
                        <button
                            onClick={logout}
                            className="px-1.5 sm:px-2 lg:px-3 py-1 sm:py-1.5 bg-red-600 hover:bg-red-700 rounded-lg transition flex items-center space-x-1 text-xs sm:text-xs cursor-pointer"
                        >
                            <LogOut className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {mobileSidebarOpen && (
                <div className="fixed inset-0 z-[60] lg:hidden">
                    <div
                        className="fixed inset-0 bg-black/50"
                        onClick={() => setMobileSidebarOpen(false)}
                    />
                    <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-blue-800 text-white shadow-lg">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-blue-700">
                            <span className="text-lg font-bold">Menu</span>
                            <button
                                onClick={() => setMobileSidebarOpen(false)}
                                className="p-2 hover:bg-blue-700 rounded-lg touch-manipulation"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                            <MobileNavItem icon={BarChart3} label="Dashboard" onClick={() => { setMobileSidebarOpen(false); navigate('/dashboard'); }} active />
                            <MobileNavItem icon={Package} label="Products" onClick={() => { setMobileSidebarOpen(false); navigate('/products'); }} />
                            <MobileNavItem icon={Truck} label="Purchases" onClick={() => { setMobileSidebarOpen(false); navigate('/purchases'); }} />
                            <MobileNavItem icon={ShoppingCart} label="POS Billing" onClick={() => { setMobileSidebarOpen(false); navigate('/pos'); }} />
                            <MobileNavItem icon={FileText} label="Customer Ledger" onClick={() => { setMobileSidebarOpen(false); navigate('/ledger'); }} />
                            <MobileNavItem icon={FileText} label="Expenses" onClick={() => { setMobileSidebarOpen(false); navigate('/expenses'); }} />
                            <MobileNavItem icon={BarChart3} label="Reports" onClick={() => { setMobileSidebarOpen(false); navigate('/reports'); }} />
                            {isAdminOrOwner(user) && (
                                <>
                                    <MobileNavItem icon={Building2} label="Branches" onClick={() => { setMobileSidebarOpen(false); navigate('/branches'); }} />
                                    <MobileNavItem icon={MapPin} label="Routes" onClick={() => { setMobileSidebarOpen(false); navigate('/routes'); }} />
                                    <MobileNavItem icon={Users} label="Users" onClick={() => { setMobileSidebarOpen(false); navigate('/users'); }} />
                                    <MobileNavItem icon={Settings} label="Settings" onClick={() => { setMobileSidebarOpen(false); navigate('/settings'); }} />
                                    <MobileNavItem icon={Database} label="Backup" onClick={() => { setMobileSidebarOpen(false); navigate('/backup'); }} />
                                </>
                            )}
                        </nav>
                        <div className="border-t border-blue-700 p-4 space-y-2">
                            <button
                                onClick={() => { setMobileSidebarOpen(false); navigate('/profile'); }}
                                className="flex items-center w-full px-4 py-3 text-base font-medium rounded-lg text-blue-100 hover:bg-blue-700 touch-manipulation"
                            >
                                <User className="mr-4 h-6 w-6" />
                                My Profile
                            </button>
                            <button
                                onClick={() => { setMobileSidebarOpen(false); logout(); }}
                                className="flex items-center w-full px-4 py-3 text-base text-red-300 hover:text-white hover:bg-red-600 rounded-lg touch-manipulation"
                            >
                                <LogOut className="mr-4 h-6 w-6" />
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Layout: Sidebar + Gateway - Mobile Responsive */}
            <div className="flex flex-col lg:flex-row">
                {/* Left sidebar - wider for better visibility, scrollable */}
                {sidebarExpanded && user?.role?.toLowerCase() !== 'staff' && (
                    <div className="hidden lg:block w-20 xl:w-24 flex-shrink-0 bg-blue-800 text-white shadow-lg">
                        <div className="flex flex-col h-[calc(100vh-80px)] lg:h-[calc(100vh-96px)] min-h-0">
                            <nav className="flex-1 p-2 space-y-1 overflow-y-auto min-h-0 scrollbar-hide">
                                <NavIcon icon={BarChart3} label="Dashboard" active onClick={() => navigate('/dashboard')} />
                                <NavIcon icon={Package} label="Products" onClick={() => navigate('/products')} />
                                <NavIcon icon={Truck} label="Purchases" onClick={() => navigate('/purchases')} />
                                <NavIcon icon={ShoppingCart} label="POS" onClick={() => navigate('/pos')} />
                                <NavIcon icon={FileText} label="Customer Ledger" onClick={() => navigate('/ledger')} />
                                {canShow('expenses') && <NavIcon icon={Wallet} label="Expenses" onClick={() => navigate('/expenses')} />}
                                {canShow('salesLedger') && <NavIcon icon={BookOpen} label="Sales Ledger" onClick={() => navigate('/sales-ledger')} />}
                                <NavIcon icon={BarChart3} label="Reports" onClick={() => navigate('/reports')} />
                                {isAdminOrOwner(user) && (
                                    <>
                                        <NavIcon icon={Building2} label="Branches" onClick={() => navigate('/branches')} />
                                        <NavIcon icon={MapPin} label="Routes" onClick={() => navigate('/routes')} />
                                    </>
                                )}
                                <NavIcon icon={Settings} label="Settings" onClick={() => navigate('/settings')} />
                            </nav>
                            <div className="mt-auto p-2 border-t border-blue-700 flex-shrink-0">
                                <div className="flex flex-col items-center justify-center">
                                    <div className="h-8 w-8 bg-blue-700 rounded-full flex items-center justify-center mb-1">
                                        <span className="text-sm font-bold">{user?.name?.[0] || 'U'}</span>
                                    </div>
                                    <p className="text-[10px] xl:text-xs text-center text-blue-200 leading-tight max-w-full truncate" title={user?.name || 'User'}>{user?.name || 'User'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Central Content + Right Gateway Column */}
                <div className="flex-1 flex flex-col lg:flex-row">
                    {/* Left: Stats & Quick Actions */}
                    <div className="flex-1 p-2 sm:p-3 lg:p-4 space-y-2 sm:space-y-3 lg:space-y-4">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2 lg:gap-3">
                            {canShow('salesToday') && (
                                <StatCard
                                    title="Sales Today"
                                    value={stats.salesToday}
                                    icon={DollarSign}
                                    color="green"
                                    loading={loading}
                                />
                            )}
                            {isAdminOrOwner(user) && canShow('expensesToday') && (
                                <StatCard
                                    title="Expenses Today"
                                    value={stats.expensesToday}
                                    icon={TrendingUp}
                                    color="red"
                                    loading={loading}
                                />
                            )}
                            {isAdminOrOwner(user) && canShow('profitToday') && (
                                <StatCard
                                    title="Profit Today"
                                    value={stats.profitToday}
                                    icon={TrendingUp}
                                    color="blue"
                                    loading={loading}
                                    adminOnly
                                />
                            )}
                        </div>

                        {/* Quick Actions Bar */}
                        {canShow('quickActions') && (
                            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6">
                                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Quick Actions</h2>
                                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                                    <QuickActionButton
                                        icon={ShoppingCart}
                                        label="New Invoice"
                                        onClick={() => navigate('/pos')}
                                        color="blue"
                                        shortcut="F3"
                                    />
                                    {isAdminOrOwner(user) && (
                                        <QuickActionButton
                                            icon={Truck}
                                            label="New Purchase"
                                            onClick={() => navigate('/purchases?action=create')}
                                            color="green"
                                            shortcut="F4"
                                        />
                                    )}
                                    <QuickActionButton
                                        icon={FileText}
                                        label="Customer Ledger"
                                        onClick={() => navigate('/ledger')}
                                        color="purple"
                                        shortcut="F6"
                                    />
                                    {isAdminOrOwner(user) && (
                                        <QuickActionButton
                                            icon={Database}
                                            label="Backup Now"
                                            onClick={() => navigate('/backup')}
                                            color="orange"
                                            shortcut="Ctrl+B"
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Invoice Counts & Alerts - UPDATED: Removed invoice cards, added Sales Ledger & Expenses */}
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                            {canShow('salesLedger') && (
                                <div
                                    onClick={() => navigate('/sales-ledger')}
                                    className="cursor-pointer bg-indigo-50 rounded-lg shadow-md border-2 border-indigo-300 p-4 sm:p-5 lg:p-6 text-center hover:shadow-lg hover:border-indigo-400 transition-all"
                                >
                                    <BookOpen className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 mx-auto mb-2 text-indigo-600" />
                                    <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">Sales Ledger</p>
                                    <p className="text-base sm:text-lg lg:text-xl font-bold text-indigo-700">View</p>
                                    <p className="text-xs text-indigo-600 mt-1">Click to open →</p>
                                </div>
                            )}
                            {isAdminOrOwner(user) && canShow('expenses') && (
                                <div
                                    onClick={() => navigate('/expenses')}
                                    className="cursor-pointer bg-purple-50 rounded-lg shadow-md border-2 border-purple-300 p-4 sm:p-5 lg:p-6 text-center hover:shadow-lg hover:border-purple-400 transition-all"
                                >
                                    <Wallet className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 mx-auto mb-2 text-purple-600" />
                                    <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">Expenses</p>
                                    <p className="text-base sm:text-lg lg:text-xl font-bold text-purple-700">Manage</p>
                                    <p className="text-xs text-purple-600 mt-1">Click to open →</p>
                                </div>
                            )}
                            {isAdminOrOwner(user) && canShow('pendingBills') && (
                                <AlertCard
                                    title="Unpaid Bills"
                                    count={stats.pendingBills}
                                    icon={AlertTriangle}
                                    color="yellow"
                                    onClick={() => navigate('/reports?tab=outstanding')}
                                />
                            )}
                            {canShow('lowStockAlert') && (
                                <AlertCard
                                    title="Low Stock"
                                    count={stats.lowStockCount}
                                    icon={Package}
                                    color="red"
                                    onClick={() => navigate('/products?filter=lowstock')}
                                />
                            )}
                        </div>
                    </div>

                    {/* Right: Gateway Column - Hidden on mobile, shown on tablet+ */}
                    <div className="hidden lg:block lg:w-64 xl:w-72 bg-white shadow-lg border-l border-blue-200">
                        <div className="sticky top-0 p-2 sm:p-3 lg:p-4 max-h-screen overflow-y-auto">
                            <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-lg p-2 sm:p-3 mb-3 sm:mb-4 shadow-lg">
                                <h2 className="text-sm sm:text-base font-bold text-center">{companyName} Dashboard</h2>
                                <p className="text-xs text-center text-blue-200 mt-0.5">Foodstuff Trading</p>
                            </div>

                            <div className="space-y-2 sm:space-y-3">
                                {gatewayMenu.map((group, idx) => (
                                    <GatewayGroup key={idx} group={group} user={user} navigate={navigate} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Alerts Modal - Improved UI */}
            {showAlertsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm" onClick={() => setShowAlertsModal(false)}>
                    <div className="bg-white rounded-xl shadow-lg max-w-3xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                            <div className="flex items-center space-x-3">
                                <Bell className="h-6 w-6" />
                                <h2 className="text-xl font-bold">Alerts & Notifications</h2>
                                {unreadAlertsCount > 0 && (
                                    <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                        {unreadAlertsCount} New
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setShowAlertsModal(false)}
                                className="p-2 hover:bg-blue-800 rounded-lg transition"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-5 bg-gray-50">
                            {alerts.length === 0 ? (
                                <div className="text-center py-12">
                                    <Bell className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                                    <p className="text-lg text-gray-500 font-medium">No alerts</p>
                                    <p className="text-sm text-gray-500 mt-2">You're all caught up!</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {alerts.map((alert) => (
                                        <div
                                            key={alert.id}
                                            className={`p-4 rounded-lg border-2 shadow-sm transition-all hover:shadow-md ${alert.isRead
                                                ? 'bg-white border-gray-200'
                                                : 'bg-blue-50 border-blue-300 shadow-md'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {!alert.isRead && (
                                                            <span className="h-2 w-2 bg-blue-600 rounded-full flex-shrink-0"></span>
                                                        )}
                                                        <h3 className={`font-bold ${alert.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                                                            {alert.title}
                                                        </h3>
                                                    </div>
                                                    {alert.message && (
                                                        <p className={`text-sm mt-1 ${alert.isRead ? 'text-gray-600' : 'text-gray-700'}`}>
                                                            {alert.message}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-gray-500 mt-3">
                                                        {new Date(alert.createdAt).toLocaleString('en-GB', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col gap-2 flex-shrink-0">
                                                    {!alert.isRead && (
                                                        <button
                                                            onClick={async () => {
                                                                await alertsAPI.markAsRead(alert.id)
                                                                await fetchAlerts()
                                                                await fetchAlertsCount()
                                                            }}
                                                            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium whitespace-nowrap"
                                                        >
                                                            Mark Read
                                                        </button>
                                                    )}
                                                    {!alert.isResolved && (
                                                        <button
                                                            onClick={async () => {
                                                                await alertsAPI.markAsResolved(alert.id)
                                                                await fetchAlerts()
                                                                await fetchAlertsCount()
                                                            }}
                                                            className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium whitespace-nowrap"
                                                        >
                                                            Resolve
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-gray-100 border-t border-gray-200 flex justify-end">
                            <button
                                onClick={() => setShowAlertsModal(false)}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print & printer setup modal - real printer (network/USB/Bluetooth), easier config */}
            {showPrintModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowPrintModal(false)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 bg-blue-900 text-white flex items-center justify-between shrink-0">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Printer className="h-5 w-5" />
                                Print & printer setup
                            </h2>
                            <button onClick={() => setShowPrintModal(false)} className="p-1 hover:bg-blue-700 rounded">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4 overflow-y-auto">
                            <div>
                                <p className="text-sm font-medium text-gray-700 mb-2">Print current dashboard page</p>
                                <button
                                    onClick={() => { window.print(); setShowPrintModal(false); }}
                                    className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
                                >
                                    <Printer className="h-4 w-4" />
                                    Open print dialog (real printer)
                                </button>
                                <p className="text-xs text-gray-500 mt-1.5">
                                    Opens the system print dialog. All connected printers (network, USB, WiFi, Bluetooth) appear there.
                                </p>
                            </div>
                            <div className="border-t border-gray-200 pt-4">
                                <p className="text-sm font-medium text-gray-700 mb-1.5">Printer connection &amp; configuration</p>
                                <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                                    <li><strong>Network printer:</strong> Add via Windows Settings → Bluetooth &amp; devices → Printers &amp; scanners → Add device, or your network admin can install the driver.</li>
                                    <li><strong>WiFi / Bluetooth:</strong> Install the printer driver on this computer; the printer will show in the print dialog once connected.</li>
                                    <li><strong>USB:</strong> Plug in the printer and install drivers if prompted; it will appear in the print dialog.</li>
                                </ul>
                                <p className="text-xs text-gray-500 mt-2">
                                    For production or receipt printers, use your computer’s default printer in the dialog or set a default in System Settings. Real-time printing uses the same system printers.
                                </p>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end shrink-0">
                            <button onClick={() => setShowPrintModal(false)} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}

const NavIcon = ({ icon: Icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full p-2 rounded-lg transition-all hover:bg-blue-700 group relative flex flex-col items-center gap-0.5 ${active ? 'bg-blue-700' : ''}`}
        title={label}
    >
        <Icon className="h-5 w-5 flex-shrink-0" />
        <span className="text-[10px] xl:text-xs text-center leading-tight truncate w-full max-w-full">{label}</span>
        <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-50 whitespace-nowrap">
            {label}
        </span>
    </button>
)

const StatCard = ({ title, value, icon: Icon, color, loading, adminOnly }) => {
    const iconBgClasses = {
        green: 'bg-green-500/10 text-green-600',
        red: 'bg-red-500/10 text-red-600',
        blue: 'bg-blue-500/10 text-blue-600'
    }

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-neutral-600 mb-0.5 truncate">{title}</p>
                    {loading ? (
                        <p className="text-sm sm:text-base lg:text-lg font-bold text-neutral-900">...</p>
                    ) : (
                        <p className="text-sm sm:text-base lg:text-lg font-bold text-neutral-900 truncate">{formatCurrency(value)}</p>
                    )}
                </div>
                <div className={`p-2 rounded-lg flex-shrink-0 ${iconBgClasses[color] || iconBgClasses.blue}`}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    )
}

const QuickActionButton = ({ icon: Icon, label, onClick, color, shortcut }) => {
    const colorClasses = {
        blue: 'bg-blue-100 hover:bg-blue-200 text-blue-900',
        green: 'bg-green-100 hover:bg-green-200 text-green-900',
        purple: 'bg-purple-100 hover:bg-purple-200 text-purple-900',
        orange: 'bg-orange-100 hover:bg-orange-200 text-orange-900'
    }

    return (
        <button
            onClick={onClick}
            className={`${colorClasses[color]} rounded-lg shadow-md border-2 p-4 sm:p-5 lg:p-6 flex flex-col items-center justify-center space-y-3 hover:shadow-lg transition-all group cursor-pointer min-h-[120px]`}
        >
            <div className={`p-2 sm:p-3 bg-white rounded-lg ${colorClasses[color]} shadow-sm`}>
                <Icon className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8" />
            </div>
            <span className="text-sm sm:text-base font-bold text-center">{label}</span>
            <span className="text-xs opacity-70 group-hover:opacity-100 hidden sm:inline">{shortcut}</span>
        </button>
    )
}

const AlertCard = ({ title, count, icon: Icon, color, onClick }) => {
    const colorClasses = {
        yellow: 'bg-yellow-50 border-yellow-300 text-yellow-900',
        red: 'bg-red-50 border-red-300 text-red-900'
    }

    return (
        <button
            onClick={onClick}
            className={`${colorClasses[color]} rounded-lg shadow-md border-2 p-4 sm:p-5 lg:p-6 w-full text-left hover:shadow-lg transition-all group cursor-pointer`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                    <div className={`p-2 sm:p-3 bg-white rounded-lg ${colorClasses[color]} shadow-sm flex-shrink-0`}>
                        <Icon className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm sm:text-base font-bold truncate">{title}</p>
                        <p className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-2">{count}</p>
                    </div>
                </div>
                <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
        </button>
    )
}

const GatewayGroup = ({ group, user, navigate }) => {
    const [expanded, setExpanded] = useState(true)
    const isAdmin = user?.role?.toLowerCase() === 'admin'
    const isOwnerUser = user?.role?.toLowerCase() === 'owner' || user?.role?.toLowerCase() === 'systemadmin'

    const canShowItem = (itemId) => {
        if (isOwnerUser) return true
        if (user?.dashboardPermissions === null || user?.dashboardPermissions === undefined) return true
        return user.dashboardPermissions.split(',').includes(itemId)
    }

    const visibleItems = group.items.filter(item => {
        if (item.adminOnly && !isAdmin && !isOwnerUser) return false
        if (item.id && !canShowItem(item.id)) return false
        return true
    })

    return (
        <div className="border-2 border-blue-200 rounded-lg shadow-md overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full bg-blue-50 hover:bg-blue-100 px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between transition-colors cursor-pointer"
            >
                <h3 className="text-xs sm:text-sm font-bold text-blue-900">{group.title}</h3>
                <ChevronRight className={`h-3 w-3 sm:h-4 sm:w-4 text-blue-700 transform transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
            {expanded && (
                <div className="bg-white divide-y divide-blue-100">
                    {visibleItems.map((item, idx) => {
                        const Icon = item.icon
                        return (
                            <button
                                key={idx}
                                onClick={() => navigate(item.path)}
                                className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between hover:bg-blue-50 transition-colors group cursor-pointer ${item.primary ? 'bg-emerald-50 hover:bg-emerald-100' : ''
                                    }`}
                            >
                                <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0 flex-1">
                                    <div className={`p-1 sm:p-1.5 rounded-lg flex-shrink-0 ${item.primary ? 'bg-emerald-200' : 'bg-blue-100'
                                        } group-hover:shadow-md transition-shadow`}>
                                        <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </div>
                                    <div className="text-left min-w-0 flex-1">
                                        <p className="text-xs sm:text-xs font-medium text-gray-900 truncate">{item.label}</p>
                                        <p className="text-xs text-gray-500 hidden sm:block">{item.shortcut}</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

const MobileNavItem = ({ icon: Icon, label, onClick, active }) => {
    return (
        <button
            onClick={onClick}
            className={`flex items-center w-full px-4 py-3 text-base font-medium rounded-lg touch-manipulation ${active
                ? 'bg-blue-600 text-white'
                : 'text-blue-100 hover:bg-blue-700 active:bg-blue-600'
                }`}
        >
            <Icon className="mr-4 h-6 w-6" />
            {label}
        </button>
    )
}

export default DashboardTally


