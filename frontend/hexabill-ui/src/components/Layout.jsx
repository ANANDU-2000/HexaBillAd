import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import RouteContent from './RouteContent'
import { useAuth } from '../hooks/useAuth'
import {
  Settings,
  LogOut,
  User,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  HelpCircle,
  Keyboard,
  MoreHorizontal,
  Search
} from 'lucide-react'
import BottomNav from './BottomNav'
import MoreMenuSheet from './mobile/MoreMenuSheet'
import Logo from './Logo'
import CommandPalette from './CommandPalette'
import ShortcutHelp from './ShortcutHelp'
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
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
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
      const tag = e.target?.tagName?.toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || !!e.target?.isContentEditable
      const mod = e.ctrlKey || e.metaKey
      if (e.key === 'Escape') setShowProfileDropdown(false)
      // Ctrl/Cmd+K works from inside fields too: it is the app's search, not text editing.
      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((open) => !open)
        return
      }
      if (typing || e.altKey) return
      if (mod && e.key === '\\') {
        e.preventDefault()
        toggleSidebar()
        return
      }
      if (mod) return
      if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen(true)
      } else if (e.key === '/') {
        const main = document.getElementById('main-content')
        const field = main?.querySelector('input[type="search"], input[placeholder*="Search" i], input[placeholder*="search" i]')
        if (field && field.offsetParent !== null) {
          e.preventDefault()
          field.focus()
          field.select?.()
        }
      }
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
    '/payments': 'Payments',
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
    // Exact list routes first, so /quotations reads "Quotations", not the detail-page "Quotation".
    if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
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
  // On list pages the mobile top bar already names the page, so in-page <h1>s are visually hidden
  // below md (index.css). Detail pages keep theirs: the h1 carries the record name.
  const shellOwnsTitle = Boolean(PAGE_TITLES[location.pathname])

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
        className="no-print sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:text-primary-600"
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

      {/* Mobile top bar — one title per screen; hidden on /pos for full-viewport cashier mode (use BottomNav) */}
      {!isPosRoute && (
      <header className={`md:hidden fixed left-0 right-0 z-50 border-b border-surface-border bg-white text-text-primary safe-area-top ${userIsSystemAdmin && selectedTenantId ? 'top-10' : 'top-0'}`}>
        <div className="flex h-14 items-center gap-1 px-1">
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 active:bg-neutral-200 touch-manipulation"
            aria-label="Open menu"
            aria-expanded={moreOpen}
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <p className="min-w-0 flex-1 truncate px-1 text-base font-semibold">{mobilePageTitle || companyName}</p>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 active:bg-neutral-200 touch-manipulation"
            aria-label="Search"
          >
            <Search className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
      </header>
      )}

      {/* Sidebar: icon rail from 768px, 240px labels from 1024px unless collapsed */}
      <div className={`no-print hidden md:fixed md:flex md:flex-col md:min-h-0 md:w-20 transition-all duration-150 motion-reduce:transition-none ${userIsSystemAdmin && selectedTenantId ? 'md:top-10 md:bottom-0' : 'md:inset-y-0'} ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-60'}`}>
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-primary-800 bg-primary-900 text-white">
          <div className={`flex h-16 shrink-0 items-center border-b border-primary-800 px-2 ${labelsVisible ? 'justify-between gap-2' : 'justify-center'}`}>
            <Link to="/dashboard" className={`flex min-w-0 items-center gap-2 rounded-md ${labelsVisible ? 'pl-1' : ''}`} title={companyName} aria-label={`${companyName} — dashboard`}>
              <Logo size="small" showText={false} className="!space-x-0" />
              {labelsVisible && (
                <span className="truncate text-sm font-semibold leading-tight text-white">{companyName}</span>
              )}
            </Link>
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
          <nav className="sidebar-scroll min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-2 py-2" aria-label="Main">
            {navGroups.map((group, groupIndex) => {
              const open = groupIsOpen(group)
              return (
                <div key={group.id} className="space-y-0.5">
                  {labelsVisible ? (
                    <button
                      type="button"
                      onClick={() => toggleGroup(group)}
                      className="flex min-h-8 w-full items-center justify-between rounded-md px-2 text-left text-micro font-semibold uppercase tracking-wide text-primary-300 hover:text-white"
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
                        className={`group/nav relative flex items-center rounded-md text-sm font-medium transition-colors duration-150 motion-reduce:transition-none ${labelsVisible ? 'min-h-9 px-2' : 'min-h-11 justify-center px-2'} ${
                          active ? 'bg-primary-600 text-white' : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                        }`}
                        aria-label={item.label}
                        aria-current={active ? 'page' : undefined}
                        onMouseEnter={(event) => showNavTip(event, item.label)}
                        onMouseLeave={() => setNavTip(null)}
                        onFocus={(event) => showNavTip(event, item.label)}
                        onBlur={() => setNavTip(null)}
                      >
                        <Icon className={`shrink-0 ${labelsVisible ? 'mr-2.5 h-[18px] w-[18px]' : 'h-5 w-5'}`} strokeWidth={1.75} aria-hidden />
                        {labelsVisible && <span className="truncate">{item.label}</span>}
                      </Link>
                    )
                  })}
                </div>
              )
            })}
            <Link
              to="/more"
              className={`group/nav relative flex items-center rounded-md text-sm font-medium transition-colors duration-150 motion-reduce:transition-none ${labelsVisible ? 'min-h-9 px-2' : 'min-h-11 justify-center px-2'} ${
                location.pathname === '/more' ? 'bg-primary-600 text-white' : 'text-primary-200 hover:bg-primary-800 hover:text-white'
              }`}
              aria-label="More"
              aria-current={location.pathname === '/more' ? 'page' : undefined}
              onMouseEnter={(event) => showNavTip(event, 'More')}
              onMouseLeave={() => setNavTip(null)}
              onFocus={(event) => showNavTip(event, 'More')}
              onBlur={() => setNavTip(null)}
            >
              <MoreHorizontal className={`shrink-0 ${labelsVisible ? 'mr-2.5 h-[18px] w-[18px]' : 'h-5 w-5'}`} strokeWidth={1.75} aria-hidden />
              {labelsVisible && <span className="truncate">More</span>}
            </Link>
          </nav>
        </div>
      </div>

      {/* Main content - Full viewport after sidebar; pt-10 when impersonation banner visible so content not covered */}
      <div className={`flex min-h-screen w-full min-w-0 flex-col transition-all duration-150 motion-reduce:transition-none md:pl-20 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-60'} ${userIsSystemAdmin && selectedTenantId ? 'pt-10' : ''}`}>
        {backendUnavailable && (
          <div className="px-4 py-2 bg-amber-100 border-b border-warning-border text-amber-900 text-sm">
            Service temporarily unavailable. Try again in a moment, or contact your company administrator.
          </div>
        )}
        <SubscriptionGraceBanner />
        <CloudHostingCostReminder />
        {/* Desktop/tablet top bar — search, alerts, one account menu. Pages own their heading; tenant identity lives in the sidebar only. */}
        {!isPosRoute && (
        <header className={`fixed right-0 z-30 hidden h-16 border-b border-surface-border bg-white text-text-primary transition-all duration-150 motion-reduce:transition-none md:block md:left-20 ${isSidebarCollapsed ? 'lg:left-20' : 'lg:left-60'} ${userIsSystemAdmin && selectedTenantId ? 'top-10' : 'top-0'}`}>
          <div className="flex h-full items-center gap-3 px-4 lg:px-6">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex min-h-[40px] w-full max-w-md items-center gap-2 rounded-md border border-surface-border bg-neutral-50 px-3 text-sm text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-white"
              aria-label="Search (Ctrl+K)"
            >
              <Search className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="flex-1 truncate text-left">Search pages, customers, products…</span>
              <kbd className="hidden rounded border border-surface-border bg-white px-1.5 font-sans text-micro text-neutral-500 lg:block">Ctrl K</kbd>
            </button>
            <div className="ml-auto flex shrink-0 items-center gap-1 text-neutral-600">
              {isAdminOrOwner(user) && <AlertNotifications />}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex min-h-[44px] items-center gap-2 rounded-md px-2 transition-colors hover:bg-neutral-100"
                  aria-label="Account menu"
                  aria-haspopup="menu"
                  aria-expanded={showProfileDropdown}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700" aria-hidden>
                    {(user?.name || 'U').charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden text-left leading-tight xl:block">
                    <span className="block max-w-[10rem] truncate text-sm font-medium text-text-primary">{user?.name || 'User'}</span>
                    <span className="block text-xs text-neutral-500">{user?.role || 'Staff'}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden />
                </button>
                {showProfileDropdown && (
                  <div role="menu" className="absolute right-0 z-50 mt-2 w-60 rounded-lg border border-surface-border bg-white py-1 shadow-lg">
                    <div className="border-b border-surface-border px-4 py-3">
                      <p className="truncate text-sm font-medium text-text-primary">{user?.name}</p>
                      <p className="text-xs text-neutral-500">{user?.role}</p>
                    </div>
                    {[
                      { label: 'My profile', icon: User, onClick: () => navigate('/profile') },
                      ...(isAdminOrOwner(user) ? [{ label: 'Settings', icon: Settings, onClick: () => navigate('/settings') }] : []),
                      { label: 'Help & support', icon: HelpCircle, onClick: () => navigate('/help') },
                      { label: 'Keyboard shortcuts', icon: Keyboard, onClick: () => setShortcutsOpen(true), hint: '?' },
                    ].map(({ label, icon: ItemIcon, onClick, hint }) => (
                      <button
                        key={label}
                        type="button"
                        role="menuitem"
                        onClick={() => { setShowProfileDropdown(false); onClick() }}
                        className="flex min-h-[40px] w-full items-center gap-2.5 px-4 text-left text-sm text-text-primary hover:bg-neutral-50"
                      >
                        <ItemIcon className="h-4 w-4 text-neutral-500" strokeWidth={1.75} aria-hidden />
                        <span className="flex-1">{label}</span>
                        {hint && <kbd className="rounded border border-surface-border px-1 font-sans text-micro text-neutral-500">{hint}</kbd>}
                      </button>
                    ))}
                    <div className="my-1 border-t border-surface-border" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setShowProfileDropdown(false); logout() }}
                      className="flex min-h-[40px] w-full items-center gap-2.5 px-4 text-left text-sm text-error hover:bg-error-bg"
                    >
                      <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        )}
        {/* Page content — POS has no top header padding for full viewport */}
        <main id="main-content" data-shell-title={shellOwnsTitle ? 'page' : undefined} className={`flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[#F8FAFC] pb-[4.75rem] md:pb-6 ${userIsSystemAdmin && selectedTenantId
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
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
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
