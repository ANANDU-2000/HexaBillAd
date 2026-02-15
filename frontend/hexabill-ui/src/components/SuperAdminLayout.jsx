import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { 
  LayoutDashboard,
  Building2,
  DollarSign,
  LogOut,
  User,
  ChevronDown,
  Menu,
  X,
  Shield,
  Activity,
  ClipboardList
} from 'lucide-react'
import Logo from './Logo'

const SuperAdminLayout = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
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

  // Super Admin navigation – enterprise structure (Dashboard, Companies, Subscriptions, Audit Logs, Infrastructure, Settings)
  const navigation = [
    { name: 'Dashboard', href: '/superadmin/dashboard', icon: LayoutDashboard },
    { name: 'Companies', href: '/superadmin/tenants', icon: Building2 },
    { name: 'Subscriptions', href: '/superadmin/subscriptions', icon: DollarSign },
    { name: 'Audit Logs', href: '/superadmin/audit-logs', icon: ClipboardList },
    { name: 'Infrastructure', href: '/superadmin/health', icon: Activity },
    { name: 'Settings', href: '/superadmin/settings', icon: Shield },
  ]

  const isActive = (href) => location.pathname === href

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header - Premium Design */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-gradient-to-r from-blue-900 to-blue-800 text-white shadow-xl z-50 border-b border-blue-700">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setSidebarOpen(true)
            }}
            className="p-2.5 rounded-xl hover:bg-blue-700 active:bg-blue-600 transition-all duration-200 touch-manipulation shadow-md"
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
              navigate('/profile')
            }}
            className="p-2.5 rounded-xl hover:bg-blue-700 active:bg-blue-600 transition-all duration-200 touch-manipulation shadow-md"
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
          <div className="fixed inset-y-0 left-0 w-80 max-w-[85vw] flex flex-col bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900 text-white shadow-lg transform transition-transform duration-300 ease-in-out border-r border-blue-700">
            <div className="flex h-16 items-center justify-between px-6 border-b border-blue-700 bg-blue-900/50">
              <div className="flex items-center gap-3">
                <Logo size="default" showText={false} />
                <span className="text-lg font-bold">Platform Menu</span>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-xl hover:bg-blue-700 active:bg-blue-600 touch-manipulation transition-all duration-200"
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
                    className={`flex items-center px-4 py-3.5 text-base font-semibold rounded-xl touch-manipulation transition-all duration-200 ${
                      isActive(item.href)
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/50'
                        : 'text-blue-100 hover:bg-blue-700/50 active:bg-blue-600'
                    }`}
                  >
                    <Icon className={`mr-4 h-5 w-5 ${isActive(item.href) ? 'text-white' : 'text-blue-300'}`} />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
            <div className="border-t border-blue-700 p-4 space-y-2 bg-blue-900/30">
              <Link
                to="/profile"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center px-4 py-3 text-base font-semibold rounded-xl text-blue-100 hover:bg-blue-700 active:bg-blue-600 touch-manipulation transition-all duration-200"
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

      {/* Desktop sidebar - Premium Blue Theme */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-grow bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900 text-white shadow-lg border-r border-blue-700">
          {/* Logo Section */}
          <div className="flex items-center px-6 py-5 border-b border-blue-700">
            <Logo size="default" showText={false} className="mr-3" />
            <div>
              <h2 className="text-lg font-bold">HexaBill</h2>
              <p className="text-xs text-blue-300">Platform Admin</p>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                    isActive(item.href)
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/50'
                      : 'text-blue-100 hover:bg-blue-700/50 hover:text-white'
                  }`}
                >
                  <Icon className={`h-5 w-5 mr-3 ${isActive(item.href) ? 'text-white' : 'text-blue-300 group-hover:text-white'}`} />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
          
          {/* Logout Section */}
          <div className="border-t border-blue-700 p-4">
            <button
              onClick={logout}
              className="flex items-center w-full px-4 py-3 text-sm font-semibold text-red-200 hover:text-white hover:bg-red-600/20 rounded-xl transition-all duration-200"
            >
              <LogOut className="h-5 w-5 mr-3" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top Header Bar - Premium Design */}
        <div className="hidden lg:block fixed top-0 left-72 right-0 bg-white border-b border-gray-200 shadow-sm z-30">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-gray-900">Platform Administration</h1>
                <p className="text-sm text-gray-500">Manage tenants, subscriptions, and platform metrics</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 flex-shrink-0">
              <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-md">
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
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-600 transition-transform duration-200 ${showProfileDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showProfileDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
                      <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                      <p className="text-xs text-gray-600">Super Admin</p>
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
        {/* Page content */}
        <main className="flex-1 pb-6 pt-14 lg:pt-24">
          <div className="py-1 sm:py-2 lg:py-6">
            <div className="mx-auto max-w-7xl px-1.5 sm:px-2 lg:px-4 xl:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default SuperAdminLayout
