import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { buildCustomerLedgerHref } from '../../utils/customerLedgerUrl'
import {
    ShoppingCart, Truck, FileText, Wallet, BarChart3,
    ChevronRight, RefreshCw, CheckCircle, X,
    Banknote, DollarSign, TrendingUp
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency } from '../../utils/currency'
import { reportsAPI } from '../../services/index'
import { canAccessPage, isAdminOrOwner, isOwner } from '../../utils/roles'
import { useBranchesRoutes } from '../../contexts/BranchesRoutesContext'
import { mobilePageShellClass } from '../../components/tallyFormClasses'
import Button from '../../components/ui/Button'
import { localDateString } from '../../utils/dateFormat'

const GET_STARTED_DISMISSED_KEY = 'hexabill_get_started_dismissed'

const formatDisplayDate = (value) => {
    if (!value) return ''
    const iso = String(value).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return String(value)
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
}

const num = (value) => {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n : 0
}

const surfaceClass = 'rounded-lg border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]'
const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'

const MetricCard = ({ label, value, helper, icon: Icon, valueClass = '', onClick, loading, emphasis = false }) => {
    const body = (
        <>
            <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-[var(--text-secondary)]">{label}</p>
                <Icon className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
            </div>
            {loading ? (
                <div className="mt-2 h-7 w-28 animate-pulse rounded bg-[var(--bg-elevated)]" aria-hidden />
            ) : (
                <p className={`mt-1 font-semibold tabular-nums leading-none ${emphasis ? 'text-[28px]' : 'text-[22px]'} ${valueClass}`}>{formatCurrency(value)}</p>
            )}
            {helper ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{helper}</p> : null}
        </>
    )
    if (!onClick) {
        return <div className={`${surfaceClass} p-3 lg:p-4`}>{body}</div>
    }
    return (
        <button
            type="button"
            onClick={onClick}
            className={`${surfaceClass} p-3 text-left transition-colors duration-150 hover:bg-[var(--bg-raised)] motion-reduce:transition-none lg:p-4 ${focusClass}`}
        >
            {body}
        </button>
    )
}

const AttentionRow = ({ label, count, unit, amount, action, tone = 'warning', onClick }) => {
    const accent = tone === 'danger' ? 'var(--error)' : tone === 'info' ? 'var(--info)' : 'var(--warning)'
    const labelClass = tone === 'danger' ? 'text-[var(--error)]' : tone === 'info' ? 'text-[var(--text-primary)]' : 'text-[var(--warning)]'
    const className = `flex min-h-11 w-full items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-3 text-left ${onClick ? `transition-colors duration-150 hover:bg-[var(--bg-raised)] motion-reduce:transition-none ${focusClass}` : ''}`
    const inner = (
        <>
            <span className="min-w-0">
                <span className={`block text-sm font-semibold ${labelClass}`}>{label}</span>
                {count != null ? (
                    <span className="mt-1 block text-[28px] font-semibold leading-none tabular-nums text-[var(--text-primary)]">{count}</span>
                ) : null}
                {unit ? <span className="mt-1 block text-xs text-[var(--text-secondary)]">{unit}</span> : null}
                {amount ? <span className="mt-1 block text-sm font-semibold tabular-nums text-[var(--text-primary)]">{amount}</span> : null}
                {action ? (
                    <span className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-primary-700">
                        {action}
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </span>
                ) : null}
            </span>
        </>
    )
    if (!onClick) {
        return <div className={className} style={{ borderLeftWidth: 2, borderLeftColor: accent }}>{inner}</div>
    }
    return (
        <button type="button" onClick={onClick} className={className} style={{ borderLeftWidth: 2, borderLeftColor: accent }}>
            {inner}
        </button>
    )
}

const DashboardTally = () => {
    const { user } = useAuth()
    const { branches } = useBranchesRoutes()
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const [refreshing, setRefreshing] = useState(true)
    const [hasFigures, setHasFigures] = useState(false)
    const [summaryError, setSummaryError] = useState(false)
    const periodKey = user?.id ? `hb_dash_period_${user.id}` : null
    const allowedPeriod = ['today', 'week', 'month', 'custom']
    const urlPeriod = searchParams.get('period')
    const readStoredPeriod = () => {
        if (!periodKey || typeof sessionStorage === 'undefined') return null
        try {
            const stored = JSON.parse(sessionStorage.getItem(periodKey) || 'null')
            if (!stored || !allowedPeriod.includes(stored.period)) return null
            return stored
        } catch {
            return null
        }
    }
    const storedPeriod = allowedPeriod.includes(urlPeriod) ? null : readStoredPeriod()
    const dateRange = allowedPeriod.includes(urlPeriod) ? urlPeriod : (storedPeriod?.period || 'today')
    const customFromDate = dateRange === 'custom' ? (searchParams.get('from') || storedPeriod?.from || '') : ''
    const customToDate = dateRange === 'custom' ? (searchParams.get('to') || storedPeriod?.to || '') : ''
    const [selectedBranchId, setSelectedBranchId] = useState(null)
    const availableBranches = branches || []
    const [setupStatus, setSetupStatus] = useState(null)
    const [getStartedDismissed, setGetStartedDismissed] = useState(() => typeof localStorage !== 'undefined' && localStorage.getItem(GET_STARTED_DISMISSED_KEY) === 'true')
    const [stats, setStats] = useState({
        salesToday: 0,
        returnsToday: 0,
        netSalesToday: 0,
        damageLossToday: 0,
        returnsCountToday: 0,
        expensesToday: 0,
        profitToday: 0,
        pendingBills: 0,
        pendingBillsAmount: 0,
        purchasesToday: 0,
        lowStockCount: 0,
        cashCollectionsTotal: 0,
        creditInvoicedTotal: 0,
        overdueCustomersCount: 0,
        overdueAmountTotal: 0,
        netVatPayablePeriod: 0
    })
    const [branchBreakdown, setBranchBreakdown] = useState([])
    const [dailySalesTrend, setDailySalesTrend] = useState([])
    const [topCustomers, setTopCustomers] = useState([])
    const [topProducts, setTopProducts] = useState([])

    const lastFetchTimeRef = useRef(0)
    const isFetchingRef = useRef(false)
    const fetchTimeoutRef = useRef(null)
    const DASHBOARD_THROTTLE_MS = 60000

    const canShow = (itemId) => {
        if (isOwner(user)) return true
        if (!user?.dashboardPermissions || user.dashboardPermissions.trim() === '') return true
        return user.dashboardPermissions.split(',').map(p => p.trim()).includes(itemId)
    }

    const getDateRange = () => {
        const today = new Date()
        const todayStr = localDateString(today)
        switch (dateRange) {
            case 'today': return { from: todayStr, to: todayStr }
            case 'week': {
                const weekStart = new Date(today)
                weekStart.setDate(today.getDate() - today.getDay())
                return { from: localDateString(weekStart), to: todayStr }
            }
            case 'month': {
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
                return { from: localDateString(monthStart), to: todayStr }
            }
            case 'custom': {
                if (customFromDate && customToDate) return { from: customFromDate, to: customToDate }
                const weekAgo = new Date(today)
                weekAgo.setDate(today.getDate() - 6)
                return { from: localDateString(weekAgo), to: todayStr }
            }
            default: return { from: todayStr, to: todayStr }
        }
    }

    const fetchStats = async (skipCache = false) => {
        try {
            setRefreshing(true)
            const { from, to } = getDateRange()
            if (!from || !to) return

            const params = { fromDate: from, toDate: to }
            if (selectedBranchId && !isAdminOrOwner(user)) params.branchId = selectedBranchId
            if (skipCache) params.refresh = true

            const response = await reportsAPI.getSummaryReport(params)

            if (response?.success && response?.data) {
                const data = response.data
                const netRaw = data.netSalesToday ?? data.NetSalesToday
                setStats({
                    salesToday: num(data.salesToday ?? data.SalesToday),
                    returnsToday: num(data.returnsToday ?? data.ReturnsToday),
                    netSalesToday: netRaw == null ? 0 : num(netRaw),
                    damageLossToday: num(data.damageLossToday ?? data.DamageLossToday),
                    returnsCountToday: parseInt(data.returnsCountToday ?? data.ReturnsCountToday, 10) || 0,
                    expensesToday: num(data.expensesToday ?? data.ExpensesToday),
                    profitToday: num(data.profitToday ?? data.ProfitToday),
                    estimatedCostLineCount: num(data.estimatedCostLineCount ?? data.EstimatedCostLineCount),
                    pendingBills: parseInt(data.pendingBills ?? data.PendingBills, 10) || 0,
                    pendingBillsAmount: num(data.pendingBillsAmount ?? data.PendingBillsAmount),
                    purchasesToday: num(data.purchasesToday ?? data.PurchasesToday),
                    lowStockCount: Array.isArray(data.lowStockProducts || data.LowStockProducts) ? (data.lowStockProducts || data.LowStockProducts).length : 0,
                    cashCollectionsTotal: num(data.cashCollectionsTotal ?? data.CashCollectionsTotal),
                    creditInvoicedTotal: num(data.creditInvoicedTotal ?? data.CreditInvoicedTotal),
                    overdueCustomersCount: parseInt(data.overdueCustomersCount ?? data.OverdueCustomersCount, 10) || 0,
                    overdueAmountTotal: num(data.overdueAmountTotal ?? data.OverdueAmountTotal),
                    netVatPayablePeriod: num(data.netVatPayablePeriod ?? data.NetVatPayablePeriod)
                })
                setBranchBreakdown(Array.isArray(data.branchBreakdown) ? data.branchBreakdown : [])
                setDailySalesTrend(Array.isArray(data.dailySalesTrend) ? data.dailySalesTrend : [])
                setTopCustomers(Array.isArray(data.topCustomersToday) ? data.topCustomersToday : [])
                setTopProducts(Array.isArray(data.topProductsToday) ? data.topProductsToday : [])
                setHasFigures(true)
                setSummaryError(false)
            } else {
                setHasFigures(false)
                setBranchBreakdown([])
                setSummaryError(true)
            }
        } catch {
            console.error('Failed to fetch dashboard stats')
            setHasFigures(false)
            setBranchBreakdown([])
            setSummaryError(true)
        } finally {
            setRefreshing(false)
        }
    }

    const handleRefresh = async () => {
        if (isFetchingRef.current) return
        lastFetchTimeRef.current = 0
        isFetchingRef.current = true
        try {
            await fetchStats(true)
        } finally {
            isFetchingRef.current = false
        }
    }

    useEffect(() => {
        lastFetchTimeRef.current = 0
        const runImmediate = async () => {
            if (isFetchingRef.current) {
                if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current)
                fetchTimeoutRef.current = setTimeout(() => {
                    lastFetchTimeRef.current = 0
                    if (!isFetchingRef.current) {
                        isFetchingRef.current = true
                        fetchStats(true).finally(() => { isFetchingRef.current = false })
                    }
                }, 120)
                return
            }
            isFetchingRef.current = true
            lastFetchTimeRef.current = Date.now()
            try {
                await fetchStats(true)
            } finally {
                isFetchingRef.current = false
            }
        }
        runImmediate()

        const fetchStatsThrottled = async () => {
            const now = Date.now()
            const timeSinceLastFetch = now - lastFetchTimeRef.current
            if (isFetchingRef.current) return
            if (timeSinceLastFetch < DASHBOARD_THROTTLE_MS) {
                if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current)
                fetchTimeoutRef.current = setTimeout(fetchStatsThrottled, DASHBOARD_THROTTLE_MS - timeSinceLastFetch)
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
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible' && !isFetchingRef.current) fetchStatsThrottled()
        }, 120000)
        let debounceTimer = null
        const handleDataUpdate = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(async () => {
                if (isFetchingRef.current) return
                try {
                    const { clearCache } = await import('../../services/api')
                    clearCache('/reports/summary')
                } catch (_) { /* ignore */ }
                lastFetchTimeRef.current = 0
                isFetchingRef.current = true
                try {
                    await fetchStats(true)
                } finally {
                    isFetchingRef.current = false
                }
            }, 400)
        }
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !isFetchingRef.current) fetchStatsThrottled()
        }
        window.addEventListener('dataUpdated', handleDataUpdate)
        window.addEventListener('paymentCreated', handleDataUpdate)
        window.addEventListener('customerCreated', handleDataUpdate)
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            clearInterval(interval)
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current)
            if (debounceTimer) clearTimeout(debounceTimer)
            window.removeEventListener('dataUpdated', handleDataUpdate)
            window.removeEventListener('paymentCreated', handleDataUpdate)
            window.removeEventListener('customerCreated', handleDataUpdate)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [user, dateRange, customFromDate, customToDate, selectedBranchId])

    useEffect(() => {
        if (!user || isAdminOrOwner(user)) return
        if (availableBranches.length === 1) {
            setSelectedBranchId(availableBranches[0].id)
        } else if (availableBranches.length > 1 && !selectedBranchId) {
            setSelectedBranchId(availableBranches[0].id)
        }
    }, [user, availableBranches])

    useEffect(() => {
        if (!user || !isAdminOrOwner(user)) return
        reportsAPI.getSetupStatus()
            .then((res) => {
                if (res?.success && res?.data) setSetupStatus(res.data)
            })
            .catch(() => undefined)
    }, [user])

    const setupComplete = setupStatus && setupStatus.hasBranch && setupStatus.hasRoute && setupStatus.hasStaff &&
        setupStatus.productCount > 0 && setupStatus.customerCount > 0 && setupStatus.hasInvoice
    const showGetStarted = isAdminOrOwner(user) && setupStatus && !getStartedDismissed && !setupComplete

    const handleDismissGetStarted = () => {
        setGetStartedDismissed(true)
        try { localStorage.setItem(GET_STARTED_DISMISSED_KEY, 'true') } catch { /* storage unavailable */ }
    }

    const applyPeriod = (period, from = '', to = '') => {
        const next = new URLSearchParams(searchParams)
        if (!period || period === 'today') {
            next.delete('period')
            next.delete('from')
            next.delete('to')
        } else {
            next.set('period', period)
            if (period === 'custom') {
                if (from) next.set('from', from)
                else next.delete('from')
                if (to) next.set('to', to)
                else next.delete('to')
            } else {
                next.delete('from')
                next.delete('to')
            }
        }
        if (periodKey) {
            try {
                sessionStorage.setItem(periodKey, JSON.stringify({
                    period: period || 'today',
                    from: period === 'custom' ? from : '',
                    to: period === 'custom' ? to : ''
                }))
            } catch { /* storage unavailable */ }
        }
        setSearchParams(next, { replace: true })
    }

    useLayoutEffect(() => {
        if (!periodKey || searchParams.get('period')) return
        const stored = readStoredPeriod()
        if (!stored || stored.period === 'today') return
        applyPeriod(stored.period, stored.from || '', stored.to || '')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periodKey])

    const selectCustom = () => {
        if (dateRange === 'custom') return
        const today = new Date()
        const weekAgo = new Date(today)
        weekAgo.setDate(today.getDate() - 6)
        applyPeriod('custom', localDateString(weekAgo), localDateString(today))
    }

    const periodChip = (active) =>
        `min-h-[44px] rounded-md px-3 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none ${focusClass} ${
            active
                ? 'bg-primary-600 text-white'
                : 'border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] hover:bg-[var(--bg-raised)]'
        }`

    const showProfit = isAdminOrOwner(user) && canShow('profitToday')
    const showExpenses = (isAdminOrOwner(user) || selectedBranchId) && canShow('expensesToday')
    const canOpenReports = canAccessPage(user, 'reports')
    const canOpenPos = canAccessPage(user, 'pos')
    const canOpenProducts = canAccessPage(user, 'products')
    const showSkeleton = !hasFigures && refreshing
    const trendSales = dailySalesTrend.reduce((sum, point) => sum + num(point.sales), 0)
    const trendHasSales = trendSales > 0
    const periodName = dateRange === 'today' ? 'Today' : dateRange === 'week' ? 'This week' : dateRange === 'month' ? 'This month' : 'Period'
    const rangeLabel = dateRange === 'custom' && customFromDate && customToDate
        ? `${formatDisplayDate(customFromDate)} – ${formatDisplayDate(customToDate)}`
        : periodName

    const attention = []
    if (canShow('overdueAccounts') !== false && (stats.overdueCustomersCount > 0 || stats.overdueAmountTotal > 0)) {
        attention.push({
            key: 'overdue',
            label: 'Overdue',
            count: stats.overdueCustomersCount,
            unit: 'customers',
            amount: formatCurrency(stats.overdueAmountTotal),
            action: canOpenReports ? 'View outstanding' : undefined,
            tone: 'danger',
            onClick: canOpenReports ? () => navigate('/reports?tab=outstanding') : undefined
        })
    }
    if (canShow('pendingAmount') !== false && (stats.pendingBills > 0 || stats.pendingBillsAmount > 0)) {
        attention.push({
            key: 'unpaid',
            label: 'Unpaid bills',
            count: stats.pendingBills,
            unit: 'bills',
            amount: formatCurrency(stats.pendingBillsAmount),
            action: canOpenReports ? 'Review unpaid' : undefined,
            tone: 'warning',
            onClick: canOpenReports ? () => navigate('/reports?tab=outstanding') : undefined
        })
    }
    if (canShow('lowStockAlert') && stats.lowStockCount > 0) {
        attention.push({
            key: 'stock',
            label: 'Low stock',
            count: stats.lowStockCount,
            unit: 'items',
            action: canOpenProducts ? 'View products' : undefined,
            tone: 'warning',
            onClick: canOpenProducts ? () => navigate('/products?tab=lowStock') : undefined
        })
    }
    if (canShow('damageLossToday') !== false && stats.damageLossToday > 0) {
        attention.push({
            key: 'damage',
            label: 'Damage',
            count: formatCurrency(stats.damageLossToday),
            unit: 'lost this period',
            tone: 'danger'
        })
    }
    if (isOwner(user) && stats.netVatPayablePeriod !== 0) {
        attention.push({
            key: 'vat',
            label: 'VAT estimate',
            count: formatCurrency(stats.netVatPayablePeriod),
            unit: 'Estimate. File on VAT Return.',
            action: 'Open VAT return',
            tone: 'info',
            onClick: () => navigate('/vat-return')
        })
    }

    const profitClass = stats.profitToday > 0 ? 'text-[var(--success)]' : stats.profitToday < 0 ? 'text-[var(--error)]' : ''
    const profitHelper = [
        canShow('purchasesToday') !== false ? `Purchases ${formatCurrency(stats.purchasesToday)}` : null,
        showExpenses ? `Expenses ${formatCurrency(stats.expensesToday)}` : null
    ].filter(Boolean).join(' · ')

    const setupSteps = [
        { done: setupStatus?.hasBranch, label: 'Add branch', path: '/branches' },
        { done: setupStatus?.hasRoute, label: 'Add route', path: '/routes' },
        { done: setupStatus?.hasStaff, label: 'Add staff', path: '/users' },
        { done: setupStatus?.productCount > 0, label: 'Add products', path: '/products' },
        { done: setupStatus?.hasPurchase, label: 'Add purchase', path: '/purchases' },
        { done: setupStatus?.customerCount > 0, label: 'Add customers', path: '/customers' },
        { done: setupStatus?.hasInvoice, label: 'Create first invoice', path: '/pos' }
    ]

    return (
        <div className={`${mobilePageShellClass} max-w-[1600px] space-y-4`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h1 className="sr-only">Dashboard</h1>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                        <button type="button" onClick={() => applyPeriod('today')} className={periodChip(dateRange === 'today')} aria-pressed={dateRange === 'today'}>Today</button>
                        <button type="button" onClick={() => applyPeriod('week')} className={periodChip(dateRange === 'week')} aria-pressed={dateRange === 'week'}>Week</button>
                        <button type="button" onClick={() => applyPeriod('month')} className={periodChip(dateRange === 'month')} aria-pressed={dateRange === 'month'}>Month</button>
                        <button type="button" onClick={selectCustom} className={periodChip(dateRange === 'custom')} aria-pressed={dateRange === 'custom'}>Custom</button>
                    </div>
                    {!isAdminOrOwner(user) && availableBranches.length > 1 && (
                        <select
                            value={selectedBranchId || ''}
                            onChange={(e) => setSelectedBranchId(e.target.value ? parseInt(e.target.value, 10) : null)}
                            className={`min-h-[44px] rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-primary)] ${focusClass}`}
                            aria-label="Branch"
                        >
                            <option value="">All branches</option>
                            {availableBranches.map((branch) => (
                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                        </select>
                    )}
                    <Button
                        variant="secondary"
                        className="!h-11 !w-11 !min-h-[44px] !min-w-[44px] !p-0"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        aria-label="Refresh"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'motion-safe:animate-spin' : ''}`} aria-hidden />
                    </Button>
                </div>
            </div>
            {dateRange === 'custom' && (
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={customFromDate}
                        onChange={(e) => applyPeriod('custom', e.target.value, customToDate)}
                        aria-label="From"
                        className={`min-h-[44px] min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-2 text-base text-[var(--text-primary)] md:max-w-[11rem] md:flex-none md:text-sm ${focusClass}`}
                    />
                    <span className="text-sm text-[var(--text-tertiary)]" aria-hidden>–</span>
                    <input
                        type="date"
                        value={customToDate}
                        onChange={(e) => applyPeriod('custom', customFromDate, e.target.value)}
                        aria-label="To"
                        className={`min-h-[44px] min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-2 text-base text-[var(--text-primary)] md:max-w-[11rem] md:flex-none md:text-sm ${focusClass}`}
                    />
                </div>
            )}

            {showGetStarted && (
                <div className={`${surfaceClass} relative p-4`}>
                    <button
                        type="button"
                        onClick={handleDismissGetStarted}
                        className={`absolute right-2 top-2 rounded-md p-2 text-[var(--text-tertiary)] hover:bg-[var(--bg-raised)] ${focusClass}`}
                        aria-label="Dismiss"
                    >
                        <X className="h-4 w-4" aria-hidden />
                    </button>
                    <h2 className="pr-8 text-sm font-semibold text-[var(--text-primary)]">Get started</h2>
                    <p className="mb-3 mt-1 text-xs text-[var(--text-secondary)]">
                        Complete these steps, or open{' '}
                        <button type="button" className="underline" onClick={() => navigate('/help')}>Help</button>
                        {' '}for the full workflow.
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                        {setupSteps.map((step) => (
                            <button
                                key={step.label}
                                type="button"
                                onClick={() => navigate(step.path)}
                                className={`inline-flex min-h-[44px] items-center gap-1.5 text-[var(--text-primary)] hover:underline ${focusClass}`}
                            >
                                {step.done
                                    ? <CheckCircle className="h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden />
                                    : <span className="h-4 w-4 shrink-0 rounded-full border-2 border-[var(--border)]" aria-hidden />}
                                {step.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {summaryError && (
                <div className={`${surfaceClass} flex flex-wrap items-center justify-between gap-3 p-4`} role="alert">
                    <p className="text-sm text-[var(--text-primary)]">Unable to load this period.</p>
                    <Button variant="secondary" onClick={handleRefresh} disabled={refreshing}>Retry</Button>
                </div>
            )}

            {hasFigures && showProfit && stats.estimatedCostLineCount > 0 && (
                <div className={`${surfaceClass} border-warning-border bg-warning-bg p-3 text-sm text-amber-900`} role="status">
                    Profit includes current-cost estimates for {stats.estimatedCostLineCount} invoice lines without saved historical costs. Product cost changes can change these estimates.
                </div>
            )}

            {(hasFigures || showSkeleton) && (
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Period summary">
                {canShow('netSalesToday') && (
                    <MetricCard
                        label="Net sales"
                        value={stats.netSalesToday}
                        helper={`Gross ${formatCurrency(stats.salesToday)} · Returns ${formatCurrency(stats.returnsToday)} (${stats.returnsCountToday})`}
                        icon={DollarSign}
                        emphasis
                        loading={showSkeleton}
                    />
                )}
                {canShow('cashCollections') !== false && (
                    <MetricCard
                        label="Collections"
                        value={stats.cashCollectionsTotal}
                        helper={canShow('creditInvoiced') !== false ? `On account ${formatCurrency(stats.creditInvoicedTotal)}` : undefined}
                        icon={Banknote}
                        loading={showSkeleton}
                    />
                )}
                {showProfit && (
                    <MetricCard
                        label="Profit"
                        value={stats.profitToday}
                        helper={profitHelper || undefined}
                        icon={TrendingUp}
                        valueClass={profitClass}
                        loading={showSkeleton}
                    />
                )}
                {canShow('pendingAmount') !== false && (
                    <MetricCard
                        label="Receivables"
                        value={stats.pendingBillsAmount}
                        icon={Wallet}
                        emphasis
                        valueClass={stats.pendingBillsAmount > 0 ? 'text-[var(--warning)]' : ''}
                        loading={showSkeleton}
                        onClick={canOpenReports ? () => navigate('/reports?tab=outstanding') : undefined}
                    />
                )}
            </section>
            )}

            {hasFigures && (
            <section className="space-y-2">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Needs attention</h2>
                {attention.length === 0 ? (
                    <p className="text-sm text-[var(--text-secondary)]">All clear. Nothing needs attention in this period.</p>
                ) : (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {attention.map((row) => (
                            <AttentionRow
                                key={row.key}
                                label={row.label}
                                count={row.count}
                                unit={row.unit}
                                amount={row.amount}
                                action={row.action}
                                tone={row.tone}
                                onClick={row.onClick}
                            />
                        ))}
                    </div>
                )}
            </section>
            )}

            {canShow('quickActions') && (
                <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:flex lg:flex-row">
                    {canOpenPos && (
                        <Button className="!min-h-[44px] w-full lg:w-auto" onClick={() => navigate('/pos')} aria-keyshortcuts="F3">
                            <ShoppingCart className="h-4 w-4" aria-hidden />
                            New invoice
                            <span className="hidden text-xs font-normal text-white/80 lg:inline">F3</span>
                        </Button>
                    )}
                    {isAdminOrOwner(user) && (
                        <Button variant="secondary" className="!min-h-[44px] w-full lg:w-auto" onClick={() => navigate('/purchases?action=create')} aria-keyshortcuts="F4">
                            <Truck className="h-4 w-4" aria-hidden />
                            New purchase
                            <span className="hidden text-xs font-normal text-[var(--text-tertiary)] lg:inline">F4</span>
                        </Button>
                    )}
                    {canAccessPage(user, 'invoices') && (
                        <Button variant="secondary" className="!min-h-[44px] w-full lg:w-auto" onClick={() => navigate('/ledger')} aria-keyshortcuts="F10">
                            <FileText className="h-4 w-4" aria-hidden />
                            Customer ledger
                            <span className="hidden text-xs font-normal text-[var(--text-tertiary)] lg:inline">F10</span>
                        </Button>
                    )}
                    {canAccessPage(user, 'expenses') && (
                        <Button variant="secondary" className="!min-h-[44px] w-full lg:w-auto" onClick={() => navigate('/expenses')}>
                            <Wallet className="h-4 w-4" aria-hidden />
                            {isAdminOrOwner(user) ? 'Expenses' : 'Add expense'}
                        </Button>
                    )}
                </div>
            )}

            {(hasFigures || showSkeleton) && (
            <section className={`${surfaceClass} p-4`}>
                <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Sales trend</h2>
                {showSkeleton ? (
                    <div className="h-[140px] animate-pulse rounded bg-[var(--bg-elevated)] md:h-[160px]" aria-hidden />
                ) : trendHasSales ? (
                    <div className="h-[140px] md:h-[160px]" role="img" aria-label={`Sales trend, ${rangeLabel}, ${formatCurrency(trendSales)}`}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailySalesTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(d) => formatDisplayDate(d).slice(0, 5)}
                                    stroke="var(--text-tertiary)"
                                    fontSize={12}
                                />
                                <YAxis
                                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                                    stroke="var(--text-tertiary)"
                                    fontSize={12}
                                />
                                <Tooltip
                                    formatter={(value) => formatCurrency(value)}
                                    labelFormatter={(label) => formatDisplayDate(label)}
                                    contentStyle={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }}
                                />
                                <Bar dataKey="sales" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-3 py-2">
                        <BarChart3 className="h-5 w-5 text-[var(--text-tertiary)]" aria-hidden />
                        <p className="text-sm text-[var(--text-secondary)]">No sales in this period.</p>
                        {canOpenPos && (
                            <Button variant="ghost" className="text-primary-700" onClick={() => navigate('/pos')}>Create invoice</Button>
                        )}
                    </div>
                )}
            </section>
            )}

            {(topCustomers.length > 0 || topProducts.length > 0) && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {topCustomers.length > 0 && (
                        <section className={`${surfaceClass} p-4`}>
                            <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Top customers</h2>
                            <div className="space-y-1">
                                {topCustomers.map((customer, idx) => (
                                    <button
                                        key={customer.customerId}
                                        type="button"
                                        onClick={() => navigate(buildCustomerLedgerHref({ customerId: customer.customerId }), { state: { returnTo: location.pathname + location.search } })}
                                        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2 text-left text-sm hover:bg-[var(--bg-raised)] ${focusClass}`}
                                    >
                                        <span className="min-w-0 truncate">
                                            <span className="text-[var(--text-tertiary)]">#{idx + 1} </span>
                                            {customer.customerName}
                                        </span>
                                        <span className="shrink-0 tabular-nums text-[var(--text-secondary)]">
                                            {formatCurrency(customer.totalSales)}
                                            <span className="ml-2 text-xs">({customer.invoiceCount})</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}
                    {topProducts.length > 0 && (
                        <section className={`${surfaceClass} p-4`}>
                            <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Top products</h2>
                            <div className="space-y-1">
                                {topProducts.map((product, idx) => (
                                    <button
                                        key={product.productId}
                                        type="button"
                                        onClick={() => navigate(`/products?productId=${product.productId}`)}
                                        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2 text-left text-sm hover:bg-[var(--bg-raised)] ${focusClass}`}
                                    >
                                        <span className="min-w-0 truncate">
                                            <span className="text-[var(--text-tertiary)]">#{idx + 1} </span>
                                            {product.productName}
                                        </span>
                                        <span className="shrink-0 tabular-nums text-[var(--text-secondary)]">
                                            {formatCurrency(product.totalSales)}
                                            <span className="ml-2 text-xs">({product.totalQty} {product.unitType})</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {isAdminOrOwner(user) && branchBreakdown.length > 0 && (
                <section className={`${surfaceClass} p-4`}>
                    <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Branches</h2>
                    <div className="space-y-2">
                        {branchBreakdown.map((branch) => (
                            <button
                                key={branch.branchId}
                                type="button"
                                onClick={() => navigate(`/branches/${branch.branchId}`)}
                                className={`w-full rounded-md border border-[var(--border)] p-3 text-left hover:bg-[var(--bg-raised)] ${focusClass}`}
                            >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <span className="min-w-0 truncate text-sm font-medium">{branch.branchName}</span>
                                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${branch.profit >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                                        {formatCurrency(branch.profit)}
                                    </span>
                                </div>
                                <span className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                                    <span><span className="block text-[var(--text-tertiary)]">Sales</span><span className="tabular-nums">{formatCurrency(branch.sales)}</span></span>
                                    <span><span className="block text-[var(--text-tertiary)]">Paid</span><span className="tabular-nums">{formatCurrency(branch.paidAmount ?? 0)}</span></span>
                                    <span><span className="block text-[var(--text-tertiary)]">Unpaid</span><span className="tabular-nums">{formatCurrency(branch.unpaidAmount ?? 0)}</span></span>
                                    <span><span className="block text-[var(--text-tertiary)]">Expenses</span><span className="tabular-nums">{formatCurrency(branch.expenses)}</span></span>
                                </span>
                                <span className="mt-1 block text-xs text-[var(--text-tertiary)]">{branch.invoiceCount} invoices</span>
                            </button>
                        ))}
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">Branch expenses only. Total expenses include company-level expenses that are not assigned to a branch.</p>
                </section>
            )}
        </div>
    )
}

export default DashboardTally
