import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Package, ShoppingCart, Users, Truck, FileText,
    Settings, Database, BarChart3, DollarSign, TrendingUp,
    AlertTriangle, ChevronRight, BookOpen, Wallet,
    Building2, MapPin
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
        <div className="h-full">
            <div className="flex flex-col lg:flex-row h-full gap-4">
                {/* Central Content */}
                <div className="flex-1 space-y-4">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                        <div className="bg-white rounded-lg shadow-md p-4 lg:p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

                    {/* Invoice Counts & Alerts */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {canShow('salesLedger') && (
                            <div
                                onClick={() => navigate('/sales-ledger')}
                                className="cursor-pointer bg-indigo-50 rounded-lg shadow-md border-2 border-indigo-300 p-4 lg:p-6 text-center hover:shadow-lg hover:border-indigo-400 transition-all"
                            >
                                <BookOpen className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
                                <p className="text-sm font-semibold text-gray-700 mb-1">Sales Ledger</p>
                                <p className="text-xl font-bold text-indigo-700">View</p>
                                <p className="text-xs text-indigo-600 mt-1">Click to open →</p>
                            </div>
                        )}
                        {isAdminOrOwner(user) && canShow('expenses') && (
                            <div
                                onClick={() => navigate('/expenses')}
                                className="cursor-pointer bg-purple-50 rounded-lg shadow-md border-2 border-purple-300 p-4 lg:p-6 text-center hover:shadow-lg hover:border-purple-400 transition-all"
                            >
                                <Wallet className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                                <p className="text-sm font-semibold text-gray-700 mb-1">Expenses</p>
                                <p className="text-xl font-bold text-purple-700">Manage</p>
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

                {/* Right: Gateway Column */}
                <div className="hidden lg:block lg:w-72 bg-white shadow-lg border-l border-blue-200 rounded-lg overflow-hidden h-fit sticky top-4">
                    <div className="p-4">
                        <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-lg p-3 mb-4 shadow-lg">
                            <h2 className="text-base font-bold text-center">{companyName} Dashboard</h2>
                            <p className="text-xs text-center text-blue-200 mt-0.5">Foodstuff Trading</p>
                        </div>

                        <div className="space-y-3">
                            {gatewayMenu.map((group, idx) => (
                                <GatewayGroup key={idx} group={group} user={user} navigate={navigate} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}



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



export default DashboardTally


