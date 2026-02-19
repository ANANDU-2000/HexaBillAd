import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard,
  Building2,
  LogOut,
  User,
  ChevronDown,
  Menu,
  X,
  Shield,
  Activity,
  ClipboardList,
  AlertCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Database,
  Bell
} from 'lucide-react'
import Logo from './Logo'
import { connectionManager } from '../services/connectionManager'

const SuperAdminLayout = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [showAlertDropdown, setShowAlertDropdown] = useState(false)
  const [alertSummary, setAlertSummary] = useState(null)
  const [backendUnavailable, setBackendUnavailable] = useState(() => !connectionManager.isConnected)
  const profileDropdownRef = useRef(null)
  const alertDropdownRef = useRef(null)

  useEffect(() => {
    const unsub = connectionManager.onStatusChange((connected) => setBackendUnavailable(!connected))
    setBackendUnavailable(!connectionManager.isConnected)
    return () => { if (unsub) unsub() }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false)
      }
      if (alertDropdownRef.current && !alertDropdownRef.current.contains(event.target)) {
        setShowAlertDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch alert summary for bell (critical events). #49
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const { superAdminAPI } = await import('../services')
        const res = await superAdminAPI.getAlertSummary()
        if (res?.success && res != null) setAlertSummary(res?.data ?? res)
      } catch {
        setAlertSummary(null)
      }
    }
    fetchSummary()
    const interval = setInterval(fetchSummary, 60000)
    return () => clearInterval(interval)
  }, [])

  // Super Admin navigation – enterprise structure (Dashboard, Companies, Subscriptions, Audit Logs, Infrastructure, Settings)
  const navigation = [
    { name: 'Dashboard', href: '/superadmin/dashboard', icon: LayoutDashboard },
    { name: 'Companies', href: '/superadmin/tenants', icon: Building2 },
    { name: 'Global Search', href: '/superadmin/search', icon: Search },
    { name: 'Audit Logs', href: '/superadmin/audit-logs', icon: ClipboardList },
    { name: 'Error Logs', href: '/superadmin/error-logs', icon: AlertCircle },
    { name: 'Infrastructure', href: '/superadmin/health', icon: Activity },
    { name: 'SQL Console', href: '/superadmin/sql-console', icon: Database },
    { name: 'Settings', href: '/superadmin/settings', icon: Shield },
  ]

  const isActive = (href) => location.pathname === href

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header - Premium Design */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-gradient-to-r from-indigo-900 to-indigo-800 text-white shadow-xl z-50 border-b border-indigo-700">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setSidebarOpen(true)
            }}
            className="p-2.5 rounded-xl hover:bg-indigo-700 active:bg-indigo-600 transition-all duration-200 touch-manipulation shadow-md"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 flex items-center justify-center gap-2">
            <Logo size="default" showText={false} className="h-6 w-6" />
            <span className="text-base font-bold">HexaBill Platform</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              navigate('/superadmin/error-logs')
            }}
            className="relative p-2.5 rounded-xl hover:bg-indigo-700 active:bg-indigo-600 transition-all duration-200 touch-manipulation shadow-md"
            aria-label="Alerts"
          >
            <Bell className="h-5 w-5" />
            {(alertSummary?.unresolvedCount ?? 0) > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
                {alertSummary.unresolvedCount > 99 ? '99+' : alertSummary.unresolvedCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              navigate('/profile')
            }}
            className="p-2.5 rounded-xl hover:bg-indigo-700 active:bg-indigo-600 transition-all duration-200 touch-manipulation shadow-md"
            aria-label="Profile"
          >
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[60] lg:hidden"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => setSidebarOpen(false)}
            onTouchEnd={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-80 max-w-[85vw] flex flex-col bg-gradient-to-b from-indigo-900 via-indigo-800 to-indigo-900 text-white shadow-lg transform transition-transform duration-300 ease-in-out border-r border-indigo-700">
            <div className="flex h-16 items-center justify-between px-6 border-b border-indigo-700 bg-indigo-900/50">
              <div className="flex items-center gap-3">
                <Logo size="default" showText={false} />
                <span className="text-lg font-bold">Platform Menu</span>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-xl hover:bg-indigo-700 active:bg-indigo-600 touch-manipulation transition-all duration-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center px-4 py-3.5 text-base font-semibold rounded-xl touch-manipulation transition-all duration-200 ${isActive(item.href)
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/50'
                      : 'text-indigo-100 hover:bg-indigo-700/50 active:bg-indigo-600'
                      }`}
                  >
                    <Icon className={`mr-4 h-5 w-5 ${isActive(item.href) ? 'text-white' : 'text-indigo-300'}`} />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
            <div className="border-t border-indigo-700 p-4 space-y-2 bg-indigo-900/30">
              <Link
                to="/profile"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center px-4 py-3 text-base font-semibold rounded-xl text-indigo-100 hover:bg-indigo-700 active:bg-indigo-600 touch-manipulation transition-all duration-200"
              >
                <User className="mr-4 h-5 w-5" />
                My Profile
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false)
                  logout()
                }}
                className="flex items-center w-full px-4 py-3 text-base font-semibold text-red-300 hover:text-white hover:bg-red-600/20 rounded-xl touch-manipulation transition-all duration-200"
              >
                <LogOut className="mr-4 h-5 w-5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar - Premium Blue Theme (collapsible) */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'}`}>
        <div className="flex flex-col flex-grow bg-gradient-to-b from-indigo-900 via-indigo-800 to-indigo-900 text-white shadow-lg border-r border-indigo-700">
          {/* Logo Section + Toggle */}
          <div className={`flex items-center border-b border-indigo-700 py-5 ${sidebarCollapsed ? 'flex-col gap-3 px-2' : 'justify-between px-4'}`}>
            <div className={`flex items-center overflow-hidden ${sidebarCollapsed ? 'justify-center' : 'flex-1 min-w-0'}`}>
              <Logo size="default" showText={false} className="flex-shrink-0" />
              {!sidebarCollapsed && (
                <div className="ml-3 min-w-0">
                  <h2 className="text-lg font-bold truncate">HexaBill</h2>
                  <p className="text-xs text-indigo-300 truncate">Platform Admin</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-indigo-700 text-indigo-200 hover:text-white transition-all flex-shrink-0"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  title={sidebarCollapsed ? item.name : undefined}
                  className={`group flex items-center rounded-xl transition-all duration-200 ${sidebarCollapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3'
                    } ${isActive(item.href)
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/50'
                      : 'text-indigo-100 hover:bg-indigo-700/50 hover:text-white'
                    }`}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 ${isActive(item.href) ? 'text-white' : 'text-indigo-300 group-hover:text-white'}`} />
                  {!sidebarCollapsed && <span className="ml-3 text-sm font-semibold">{item.name}</span>}
                </Link>
              )
            })}
          </nav>

          {/* Logout Section */}
          <div className="border-t border-indigo-700 p-2">
            <button
              onClick={logout}
              title={sidebarCollapsed ? 'Sign Out' : undefined}
              className={`flex items-center w-full text-sm font-semibold text-red-200 hover:text-white hover:bg-red-600/20 rounded-xl transition-all duration-200 ${sidebarCollapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3'
                }`}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span className="ml-3">Sign Out</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Main content - full width, dynamic padding for sidebar */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'}`}>
        {backendUnavailable && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-100 border-b border-amber-200 text-amber-900 text-sm text-left">
            <span className="font-medium">Service temporarily unavailable.</span>
            <span>Service is temporarily unavailable. Please try again in a moment or contact your administrator.</span>
          </div>
        )}
        {/* Top Header Bar - Premium Design */}
        <div className={`hidden lg:block fixed top-0 right-0 bg-white border-b border-gray-200 shadow-sm z-30 transition-all duration-300 ${sidebarCollapsed ? 'left-20' : 'left-72'}`}>
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-gray-900">Platform Administration</h1>
                <p className="text-sm text-gray-500">Manage tenants, subscriptions, and platform metrics</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 flex-shrink-0">
              {/* Error alert bell #49 */}
              <div className="relative" ref={alertDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowAlertDropdown(!showAlertDropdown)}
                  className="relative p-2.5 hover:bg-gray-100 rounded-xl transition-all"
                  aria-label="Critical alerts"
                >
                  <Bell className="h-5 w-5 text-gray-600" />
                  {(alertSummary?.unresolvedCount ?? 0) > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full">
                      {alertSummary.unresolvedCount > 99 ? '99+' : alertSummary.unresolvedCount}
                    </span>
                  )}
                </button>
                {showAlertDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">Critical events</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {alertSummary?.unresolvedCount ?? 0} unresolved · {(alertSummary?.last24hCount ?? 0)} in last 24h
                        {(alertSummary?.last1hCount ?? 0) > 0 && ` · ${alertSummary.last1hCount} in last 1h`}
                      </p>
                    </div>
                    {(alertSummary?.recent?.length ?? 0) > 0 && (
                      <div className="max-h-48 overflow-y-auto px-4 py-2 space-y-2">
                        {alertSummary.recent.map((r) => (
                          <div key={r.id} className="text-xs text-gray-700 border-l-2 border-red-200 pl-2 py-1">
                            <p className="truncate font-medium">{r.message || 'Error'}</p>
                            <p className="text-gray-500">{r.tenantName ? `${r.tenantName}` : 'Platform'} · {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <Link
                      to="/superadmin/error-logs"
                      onClick={() => setShowAlertDropdown(false)}
                      className="block px-4 py-3 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                    >
                      View Error Logs →
                    </Link>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg shadow-md">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-semibold">System Admin</span>
              </div>

              {/* Profile Dropdown */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center space-x-3 px-4 py-2 hover:bg-gray-100 rounded-xl transition-all duration-200"
                >
                  <div className="hidden md:block text-right">
                    <p className="text-sm font-semibold text-gray-900">{user?.name || 'Admin'}</p>
                    <p className="text-xs text-gray-500">Super Admin</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-600 transition-transform duration-200 ${showProfileDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showProfileDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-indigo-100">
                      <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                      <p className="text-xs text-indigo-600">Super Admin</p>
                    </div>
                    <button
                      onClick={() => {
                        navigate('/profile')
                        setShowProfileDropdown(false)
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center transition-colors"
                    >
                      <User className="h-4 w-4 mr-3 text-gray-500" />
                      My Profile
                    </button>
                    <div className="border-t border-gray-200 my-1"></div>
                    <button
                      onClick={() => {
                        logout()
                        setShowProfileDropdown(false)
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center transition-colors"
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Page content - use full available width */}
        <main className="flex-1 pb-6 pt-14 lg:pt-24 min-w-0">
          <div className="py-1 sm:py-2 lg:py-6">
            <div className="w-full px-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default SuperAdminLayout
