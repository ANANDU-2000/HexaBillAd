import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import RouteContent from './RouteContent'
import { useAuth } from '../hooks/useAuth'
import {
  Settings,
  LogOut,
  User,
  ChevronDown,
  Printer,
  ChevronLeft,
  ChevronRight,
  Menu,
  HelpCircle,
  MoreHorizontal
} from 'lucide-react'
import BottomNav from './BottomNav'
import MoreMenuSheet from './mobile/MoreMenuSheet'
import Logo from './Logo'
import AlertNotifications from './AlertNotifications'
import CloudHostingCostReminder from './CloudHostingCostReminder'
import { SubscriptionGraceBanner } from './SubscriptionGraceBanner'
import { connectionManager } from '../services/connectionManager'
import { isAdminOrOwner } from '../utils/roles'
import { isSystemAdmin } from '../utils/superAdmin'  // Super Admin checking
import { useBranding } from '../tenant/TenantBrandingContext'
import { visibleSidebar, isItemActive } from '../navigation/moreMenuConfig'

const Layout = () => {
  const { user, logout, impersonatedTenantId, stopImpersonation } = useAuth()
  const { companyName } = useBranding()
  const location = useLocation()
  const navigate = useNavigate()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true' }
    catch { return false }
  })
  const [groupOpen, setGroupOpen] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('sidebar_groups') || '{}')
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
    } catch {
      return {}
    }
  })
  const [isDesktopNav, setIsDesktopNav] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  )
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [navTip, setNavTip] = useState(null)
  const closeMore = useCallback(() => setMoreOpen(false), [])
  const [backendUnavailable, setBackendUnavailable] = useState(() => !connectionManager.isConnected)

  useEffect(() => {
    const unsub = connectionManager.onStatusChange((connected) => setBackendUnavailable(!connected))
    setBackendUnavailable(!connectionManager.isConnected)
    return () => { if (unsub) unsub() }
  }, [])

  // Phase 6: Ping to update LastActiveAt for staff online indicator (when app is in foreground)
  useEffect(() => {
    if (!user?.id) return
    const ping = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        import('../services').then(({ usersAPI }) => usersAPI.pingMe().catch(() => {}))
      }
    }
    ping()
    const interval = setInterval(ping, 180000) // Increased from 90s to 180s (3 minutes) to reduce API requests
    return () => clearInterval(interval)
  }, [user?.id])

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const newState = !prev
      try { localStorage.setItem('sidebar_collapsed', String(newState)) } catch { /* Keep the preference in memory. */ }
      return newState
    })
  }, [])

  useEffect(() => {
    closeMore()
  }, [location.pathname, closeMore])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsDesktopNav(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== '\\') return
      const tag = e.target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return
      e.preventDefault()
      toggleSidebar()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [toggleSidebar])
  const profileDropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Global keyboard shortcuts (work on any tenant page; skip when typing in inputs)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName?.toUpperCase()
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!e.target?.isContentEditable
      if (inInput) return

      if (e.ctrlKey || e.metaKey || e.altKey) return

      switch (e.key) {
        case 'F3':
          e.preventDefault()
          navigate('/pos')
          break
        case 'F4':
          e.preventDefault()
          if (isAdminOrOwner(user)) navigate('/purchases')
          break
        case 'F7':
          e.preventDefault()
          if (isAdminOrOwner(user)) navigate('/reports?tab=sales')
          break
        case 'F8':
          e.preventDefault()
          if (isAdminOrOwner(user)) navigate('/reports?tab=profit-loss')
          break
        case 'F9':
          e.preventDefault()
          if (isAdminOrOwner(user)) navigate('/reports?tab=outstanding')
          break
        case 'F10':
          e.preventDefault()
          navigate('/ledger')
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [user, navigate])

  // CRITICAL: SystemAdmin should ONLY see tenant navigation if they are impersonating
  const userIsSystemAdmin = isSystemAdmin(user)
  const selectedTenantId = impersonatedTenantId
  let selectedTenantName = null
  try { selectedTenantName = localStorage.getItem('selected_tenant_name') } catch { /* Optional display label. */ }

  // If SystemAdmin but NOT impersonating, redirect to SuperAdmin dashboard
  if (userIsSystemAdmin && !selectedTenantId) {
    return null // SystemAdmin should use SuperAdminLayout, not this Layout
  }

  const handleExitImpersonation = async () => {
    const tenantId = selectedTenantId
    const tenantName = selectedTenantName
    try {
      const { superAdminAPI } = await import('../services')
      await superAdminAPI.impersonateExit(tenantId || undefined, tenantName || undefined)
    } catch (_) { /* Audit logging failure should not block */ }
    stopImpersonation()
    try { localStorage.removeItem('selected_tenant_name') } catch { /* Exit must remain usable. */ }
    navigate('/superadmin/dashboard')
  }

  const navGroups = visibleSidebar(user, { isImpersonating: !!selectedTenantId })
  const labelsVisible = isDesktopNav && !isSidebarCollapsed

  const groupIsOpen = (group) => {
    if (!labelsVisible) return true
    const hasActive = group.items.some((item) => isItemActive(location.pathname, item))
    if (hasActive) return true
    if (group.defaultOpen) return groupOpen[group.id] !== false
    return groupOpen[group.id] === true
  }

  const toggleGroup = (group) => {
    setGroupOpen((prev) => {
      const openNow = group.defaultOpen ? prev[group.id] !== false : prev[group.id] === true
      const next = { ...prev, [group.id]: !openNow }
      try { localStorage.setItem('sidebar_groups', JSON.stringify(next)) } catch { /* Keep navigation usable without storage. */ }
      return next
    })
  }

  // Route title shown in the compact mobile header
  const PAGE_TITLES = {
    '/dashboard': 'Dashboard',
    '/products': 'Products',
    '/stock-adjustments': 'Stock Adjustments',
    '/pricelist': 'Price List',
    '/purchases': 'Purchases',
    '/suppliers': 'Suppliers',
    '/pos': 'New Bill',
    '/ledger': 'Customer Ledger',
    '/expenses': 'Expenses',
    '/sales-ledger': 'Sales Ledger',
    '/billing-history': 'Billing History',
    '/quotations': 'Quotations',
    '/agreements': 'Agreements',
    '/salary-certificates': 'Salary Certificates',
    '/delivery-notes': 'Delivery Notes',
    '/reports': 'Reports',
    '/daily-close': 'Daily close',
    '/vat-return': 'VAT Return',
    '/worksheet': 'Worksheet',
    '/branches': 'Branches & Routes',
    '/routes': 'Branches & Routes',
    '/customers': 'Customers',
    '/more': 'More',
    '/users': 'Users',
    '/settings': 'Settings',
    '/audit': 'Activity Log',
    '/backup': 'Backup & Restore',
    '/profile': 'Profile',
    '/help': 'Help & Support',
    '/feedback': 'Feedback',
    '/returns/create': 'Returns',
  }
  const getPageTitle = (pathname) => {
    if (pathname.startsWith('/products/')) return 'Product'
    if (pathname.startsWith('/suppliers/')) return 'Supplier'
    if (pathname.startsWith('/branches/')) return 'Branch'
    if (pathname.startsWith('/routes/')) return 'Route'
    if (pathname.startsWith('/customers/')) return 'Customer'
    if (pathname.startsWith('/quotations')) return 'Quotation'
    if (pathname.startsWith('/agreements')) return 'Agreement'
    if (pathname.startsWith('/salary-certificates')) return 'Salary Certificate'
    if (pathname.startsWith('/delivery-notes')) return 'Delivery Note'
    if (pathname.startsWith('/billing-history/')) return 'Invoice'
    return PAGE_TITLES[pathname] || ''
  }
  const mobilePageTitle = getPageTitle(location.pathname)

  const isSalesLedger = location.pathname === '/sales-ledger'
  const isExpensesLedger = location.pathname === '/expenses'
  const isPosRoute = location.pathname === '/pos'
  // Data-heavy pages: fill viewport height, internal scroll (no airy document scroll)
  const isViewportShellRoute =
    isSalesLedger ||
    isExpensesLedger ||
    isPosRoute ||
    location.pathname === '/billing-history' ||
    location.pathname === '/products' ||
    location.pathname.startsWith('/products/') ||
    location.pathname === '/ledger' ||
    location.pathname.startsWith('/ledger/') ||
    location.pathname === '/worksheet' ||
    location.pathname === '/customers' ||
    location.pathname.startsWith('/customers/') ||
    location.pathname === '/purchases' ||
    location.pathname === '/branches' ||
    location.pathname.startsWith('/branches/') ||
    location.pathname === '/routes' ||
    location.pathname.startsWith('/routes/') ||
    location.pathname === '/users' ||
    location.pathname === '/reports' ||
    location.pathname === '/suppliers' ||
    location.pathname.startsWith('/suppliers/') ||
    location.pathname.startsWith('/quotations') ||
    location.pathname.startsWith('/agreements') ||
    location.pathname.startsWith('/salary-certificates') ||
    location.pathname.startsWith('/delivery-notes')

  const showNavTip = (event, label) => {
    if (labelsVisible) return
    const rect = event.currentTarget.getBoundingClientRect()
    setNavTip({ label, top: rect.top + rect.height / 2, left: rect.right + 8 })
  }

  return (
    <div className="min-h-screen bg-neutral-50 overflow-x-hidden">
      {/* Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:text-primary-600"
      >
        Skip to main content
      </a>
      {/* Impersonation banner: ONLY for System Admin actively impersonating a tenant. Never show to normal tenant users (Owner/Admin/Staff). */}
      {userIsSystemAdmin && selectedTenantId && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-orange-500 text-white px-4 py-2 flex items-center justify-between text-sm font-medium">
          <span>IMPERSONATING: {selectedTenantName || 'Tenant'} — All actions affect their data.</span>
          <button
            type="button"
            onClick={handleExitImpersonation}
            className="bg-white text-orange-600 px-3 py-1.5 rounded font-semibold hover:bg-orange-50 transition-colors"
          >
            EXIT — Return to SuperAdmin
          </button>
        </div>
      )}

      {/* Mobile Header — hidden on /pos for full-viewport cashier mode (use BottomNav) */}
      {!isPosRoute && (
      <div className={`md:hidden fixed left-0 right-0 bg-primary-900 text-white border-b border-primary-800 z-50 safe-area-top ${userIsSystemAdmin && selectedTenantId ? 'top-10' : 'top-0'}`}>
        <div className="flex items-center justify-between px-2 py-2">
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="p-2 rounded-lg hover:bg-primary-800 active:bg-primary-700 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Menu"
            aria-expanded={moreOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 flex justify-center min-w-0 px-2">
            <span className="text-sm font-semibold truncate">{mobilePageTitle || companyName}</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              navigate('/profile')
            }}
            className="p-2 rounded-lg hover:bg-primary-800 active:bg-primary-700 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Profile"
          >
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>
      )}

      {/* Sidebar: icon rail from 768px, 240px labels from 1024px unless collapsed */}
      <div className={`hidden md:fixed md:flex md:flex-col md:min-h-0 md:w-20 transition-all duration-150 motion-reduce:transition-none ${userIsSystemAdmin && selectedTenantId ? 'md:top-10 md:bottom-0' : 'md:inset-y-0'} ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-60'}`}>
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-primary-800 bg-primary-900 text-white">
          <div className={`flex h-16 shrink-0 items-center border-b border-primary-800 px-2 ${labelsVisible ? 'justify-between gap-2' : 'justify-center'}`}>
            {labelsVisible ? (
              <span className="truncate pl-2 text-sm font-semibold text-white" title={companyName}>
                {companyName}
              </span>
            ) : (
              <Logo size="small" showText={false} className="!space-x-0" />
            )}
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden min-h-9 min-w-9 items-center justify-center rounded-md text-primary-200 transition-colors duration-150 hover:bg-primary-800 hover:text-white motion-reduce:transition-none lg:flex"
              title={isSidebarCollapsed ? 'Expand sidebar (Ctrl+\\)' : 'Collapse sidebar (Ctrl+\\)'}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-2" aria-label="Main">
            {navGroups.map((group, groupIndex) => {
              const open = groupIsOpen(group)
              return (
                <div key={group.id} className="space-y-0.5">
                  {labelsVisible ? (
                    <button
                      type="button"
                      onClick={() => toggleGroup(group)}
                      className="flex min-h-8 w-full items-center justify-between rounded-md px-2 text-left text-[11px] font-semibold uppercase tracking-wide text-primary-300 hover:text-white"
                      aria-expanded={open}
                    >
                      <span className="truncate">{group.label}</span>
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none ${open ? '' : '-rotate-90'}`} aria-hidden />
                    </button>
                  ) : groupIndex > 0 ? (
                    <div className="mx-2 border-t border-primary-800" aria-hidden />
                  ) : null}
                  {open && group.items.map((item) => {
                    const Icon = item.icon
                    const active = isItemActive(location.pathname, item)
                    return (
                      <Link
                        key={item.id}
                        to={item.href}
                        className={`group/nav relative flex min-h-9 items-center rounded-md text-sm font-medium transition-colors duration-150 motion-reduce:transition-none ${labelsVisible ? 'px-2' : 'justify-center px-2'} ${
                          active ? 'bg-primary-600 text-white' : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                        }`}
                        aria-label={item.label}
                        aria-current={active ? 'page' : undefined}
                        onMouseEnter={(event) => showNavTip(event, item.label)}
                        onMouseLeave={() => setNavTip(null)}
                        onFocus={(event) => showNavTip(event, item.label)}
                        onBlur={() => setNavTip(null)}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${labelsVisible ? 'mr-2' : ''}`} aria-hidden />
                        {labelsVisible && <span className="truncate">{item.label}</span>}
                      </Link>
                    )
                  })}
                </div>
              )
            })}
            <Link
              to="/more"
              className={`group/nav relative flex min-h-9 items-center rounded-md text-sm font-medium transition-colors duration-150 motion-reduce:transition-none ${labelsVisible ? 'px-2' : 'justify-center px-2'} ${
                location.pathname === '/more' ? 'bg-primary-600 text-white' : 'text-primary-200 hover:bg-primary-800 hover:text-white'
              }`}
              aria-label="More"
              aria-current={location.pathname === '/more' ? 'page' : undefined}
              onMouseEnter={(event) => showNavTip(event, 'More')}
              onMouseLeave={() => setNavTip(null)}
              onFocus={(event) => showNavTip(event, 'More')}
              onBlur={() => setNavTip(null)}
            >
              <MoreHorizontal className={`h-4 w-4 shrink-0 ${labelsVisible ? 'mr-2' : ''}`} aria-hidden />
              {labelsVisible && <span className="truncate">More</span>}
            </Link>
          </nav>
          <div className="shrink-0 space-y-1 border-t border-primary-800 p-2">
            <Link
              to="/profile"
              className={`group/nav relative flex min-h-11 items-center rounded-md text-sm text-primary-200 transition-colors duration-150 hover:bg-primary-800 hover:text-white min-h-[44px] ${labelsVisible ? 'px-2' : 'justify-center px-2'} ${location.pathname === '/profile' ? 'bg-primary-800 text-white' : ''}`}
              aria-label="My profile"
              aria-current={location.pathname === '/profile' ? 'page' : undefined}
              onMouseEnter={(event) => showNavTip(event, user?.name || 'Profile')}
              onMouseLeave={() => setNavTip(null)}
              onFocus={(event) => showNavTip(event, user?.name || 'Profile')}
              onBlur={() => setNavTip(null)}
            >
              <User className={`h-4 w-4 shrink-0 ${labelsVisible ? 'mr-2' : ''}`} aria-hidden />
              {labelsVisible && <span className="truncate">{user?.name || 'Profile'}</span>}
            </Link>
            <Link
              to="/help"
              className={`group/nav relative flex min-h-11 items-center rounded-md text-sm text-primary-200 transition-colors duration-150 hover:bg-primary-800 hover:text-white min-h-[44px] ${labelsVisible ? 'px-2' : 'justify-center px-2'}`}
              aria-label="Help"
              onMouseEnter={(event) => showNavTip(event, 'Help')}
              onMouseLeave={() => setNavTip(null)}
              onFocus={(event) => showNavTip(event, 'Help')}
              onBlur={() => setNavTip(null)}
            >
              <HelpCircle className={`h-4 w-4 shrink-0 ${labelsVisible ? 'mr-2' : ''}`} aria-hidden />
              {labelsVisible && <span className="truncate">Help</span>}
            </Link>
            <button
              type="button"
              onClick={logout}
              className={`group/nav relative flex min-h-11 w-full items-center rounded-md text-sm text-red-200 transition-colors duration-150 hover:bg-red-950/40 hover:text-white min-h-[44px] ${labelsVisible ? 'px-2' : 'justify-center px-2'}`}
              aria-label="Log out"
              onMouseEnter={(event) => showNavTip(event, 'Log out')}
              onMouseLeave={() => setNavTip(null)}
              onFocus={(event) => showNavTip(event, 'Log out')}
              onBlur={() => setNavTip(null)}
            >
              <LogOut className={`h-4 w-4 shrink-0 ${labelsVisible ? 'mr-2' : ''}`} aria-hidden />
              {labelsVisible && <span>Log out</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Main content - Full viewport after sidebar; pt-10 when impersonation banner visible so content not covered */}
      <div className={`flex min-h-screen w-full min-w-0 flex-col transition-all duration-150 motion-reduce:transition-none md:pl-20 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-60'} ${userIsSystemAdmin && selectedTenantId ? 'pt-10' : ''}`}>
        {backendUnavailable && (
          <div className="px-4 py-2 bg-amber-100 border-b border-amber-200 text-amber-900 text-sm">
            Service temporarily unavailable. Try again in a moment, or contact your company administrator.
          </div>
        )}
        <SubscriptionGraceBanner />
        <CloudHostingCostReminder />
        {/* Top Header Bar — fully hidden on /pos for full-viewport cashier mode */}
        {!isPosRoute && (
        <div className={`fixed right-0 z-30 hidden h-16 border-b border-primary-800 bg-primary-900 text-white transition-all duration-150 motion-reduce:transition-none md:block md:left-20 ${isSidebarCollapsed ? 'lg:left-20' : 'lg:left-60'} ${userIsSystemAdmin && selectedTenantId ? 'top-10' : 'top-0'}`}>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <Logo size="default" showText={false} className="flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-white">{companyName}</p>
                {mobilePageTitle && (
                  <p className="text-xs text-primary-200 truncate">{mobilePageTitle}</p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-1.5 flex-shrink-0">
              {isAdminOrOwner(user) && <AlertNotifications />}
              <button
                type="button"
                onClick={() => window.print()}
                className="p-2 hover:bg-primary-800 rounded-md transition flex items-center justify-center min-h-[44px] min-w-[44px]"
                title="Print this page"
                aria-label="Print current page"
              >
                <Printer className="h-5 w-5" />
              </button>
              <div className="relative ml-2" ref={profileDropdownRef}>
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center space-x-2 px-3 py-1.5 hover:bg-primary-800 rounded-lg transition min-h-[44px]"
                  aria-label="User profile menu"
                  aria-expanded={showProfileDropdown}
                >
                  <div className="hidden md:block text-right">
                    <p className="text-xs font-medium text-white">{user?.name || 'User'}</p>
                    <p className="text-xs text-primary-200">{user?.role || 'Staff'}</p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-neutral-700 flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </button>
                {showProfileDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-md border border-primary-200 py-1 z-50">
                    <div className="px-4 py-3 border-b border-primary-200">
                      <p className="text-sm font-medium text-primary-800">{user?.name}</p>
                      <p className="text-xs text-primary-600">{user?.role}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigate('/profile')
                        setShowProfileDropdown(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-primary-700 hover:bg-primary-50 flex items-center"
                    >
                      <User className="h-4 w-4 mr-2" />
                      My Profile
                    </button>
                    {isAdminOrOwner(user) && (
                      <button
                        onClick={() => {
                          navigate('/settings')
                          setShowProfileDropdown(false)
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-primary-700 hover:bg-primary-50 flex items-center"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </button>
                    )}
                    <div className="border-t border-primary-200 my-1" />
                    <button
                      onClick={() => {
                        logout()
                        setShowProfileDropdown(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-error hover:bg-error/10 flex items-center"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        )}
        {/* Page content — POS has no top header padding for full viewport */}
        <main id="main-content" className={`flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[#F8FAFC] pb-[4.75rem] md:pb-6 ${userIsSystemAdmin && selectedTenantId
          ? (isPosRoute ? 'pt-10' : 'pt-24 md:pt-[6.5rem]')
          : (isPosRoute ? 'pt-0' : 'pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] md:pt-16')
          }`}>
          <div className={`flex-1 min-h-0 ${isViewportShellRoute ? 'overflow-hidden flex flex-col' : 'overflow-auto'}`}>
            <div className={`w-full max-w-full mx-auto px-3 sm:px-4 ${isViewportShellRoute ? 'py-2 lg:py-3 min-h-0 flex-1 flex flex-col' : 'min-h-full py-2 lg:py-3'}`}>
              <RouteContent />
            </div>
          </div>
        </main>
        {/* Mobile Bottom Navigation */}
        <div className="md:hidden">
          <BottomNav moreOpen={moreOpen} onOpenMore={() => setMoreOpen(true)} onCloseMore={closeMore} />
          <MoreMenuSheet open={moreOpen} onClose={closeMore} />
        </div>
      </div>
      {navTip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[70] -translate-y-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white shadow-lg"
          style={{ top: navTip.top, left: navTip.left }}
        >
          {navTip.label}
        </div>
      )}
    </div>
  )
}

export default Layout
