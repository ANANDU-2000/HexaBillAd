import { useEffect, useCallback, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, History, Plus, BookOpen, MoreHorizontal } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { canAccessPage } from '../utils/roles'
import MoreMenuSheet from './mobile/MoreMenuSheet'

/**
 * Mobile primary IA: Home · History · POS · Ledger · More.
 * The four direct tabs map to real routes; "More" opens the grouped menu
 * bottom sheet (MoreMenuSheet). Home and More are permanent anchors — every
 * other tab is filtered by the staff page-access check.
 */
const NAV_ITEMS = [
  { id: 'home', name: 'Home', href: '/dashboard', icon: Home, pageId: null },
  { id: 'history', name: 'History', href: '/billing-history', icon: History, pageId: 'pos' },
  { id: 'pos', name: 'POS', href: '/pos', icon: Plus, center: true, pageId: 'pos' },
  { id: 'ledger', name: 'Ledger', href: '/ledger', icon: BookOpen, pageId: 'invoices' },
  { id: 'more', name: 'More', icon: MoreHorizontal, isMore: true },
]

// Routes owned by a real tab — everything else counts as "More" territory.
const TAB_ROUTES = ['/dashboard', '/pos', '/ledger', '/billing-history']

const isNavActive = (pathname, href) => {
  if (href === '/dashboard') {
    return pathname === '/dashboard' || pathname === '/'
  }
  if (href === '/reports') {
    return pathname === '/reports' || pathname.startsWith('/reports/')
  }
  if (href === '/billing-history') {
    return pathname === '/billing-history' || pathname.startsWith('/billing-history/')
  }
  if (href === '/ledger') {
    return pathname === '/ledger' || pathname.startsWith('/ledger/')
  }
  if (href === '/pos') {
    return pathname === '/pos'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

const BottomNav = () => {
  const location = useLocation()
  const { user } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const closeMore = useCallback(() => setMoreOpen(false), [])

  const pathname = location.pathname

  // Close the More sheet on any route change (nav taps, keyboard shortcuts)
  useEffect(() => {
    closeMore()
  }, [pathname, closeMore])

  const navItems = NAV_ITEMS.filter((item) => {
    if (item.isMore) return true // More is a permanent anchor
    if (!item.pageId) return true
    return canAccessPage(user, item.pageId)
  })

  if (navItems.length === 0) return null

  const onDirectTab = TAB_ROUTES.some((href) => isNavActive(pathname, href))
  const moreActive = moreOpen || !onDirectTab

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-[#E5E7EB] safe-area-bottom shadow-[0_-1px_6px_rgba(15,23,42,0.06)]"
        aria-label="Main navigation"
      >
        <div className="relative max-w-screen-sm mx-auto px-1 pt-2 pb-1">
          <div
            className="grid items-end min-h-[52px]"
            style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
          >
            {navItems.map((item) => {
              const Icon = item.icon
              const containerClass = 'flex flex-col items-center justify-end min-w-0 min-h-[44px] px-0.5 pb-1'
              const linkClass = `relative ${containerClass} transition-colors duration-150 active:opacity-90`

              // More → button opening the sheet
              if (item.isMore) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    className={`${linkClass} ${moreActive ? 'text-primary-600' : 'text-[#475569]'}`}
                    aria-label="More options"
                    aria-expanded={moreOpen}
                    aria-current={moreActive ? 'page' : undefined}
                  >
                    <Icon
                      className={`w-[22px] h-[22px] shrink-0 ${moreActive ? 'text-primary-600' : 'text-[#64748B]'}`}
                      strokeWidth={moreActive ? 2.25 : 2}
                      aria-hidden
                    />
                    <span
                      className={`text-[10px] leading-tight text-center truncate max-w-full ${
                        moreActive ? 'font-semibold text-primary-700' : 'font-medium'
                      }`}
                    >
                      {item.name}
                    </span>
                    {moreActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-7 h-0.5 bg-primary-600 rounded-full" aria-hidden />
                    )}
                  </button>
                )
              }

              // Raised POS FAB
              if (item.center) {
                return (
                  <Link
                    key={item.id}
                    to={item.href}
                    onClick={closeMore}
                    className="flex flex-col items-center justify-end min-w-0 min-h-[44px] pb-0.5"
                    aria-current={isNavActive(pathname, item.href) ? 'page' : undefined}
                    aria-label="POS"
                  >
                    <span
                      className={`flex items-center justify-center w-12 h-12 -mt-5 rounded-full shadow-md transition-colors duration-150 ${
                        isNavActive(pathname, item.href)
                          ? 'bg-primary-700 text-white ring-2 ring-primary-200'
                          : 'bg-primary-600 text-white active:bg-primary-700'
                      }`}
                    >
                      <Icon className="w-6 h-6 shrink-0" strokeWidth={2.5} aria-hidden />
                    </span>
                    <span
                      className={`mt-1 text-[10px] leading-tight font-medium truncate max-w-full px-0.5 ${
                        isNavActive(pathname, item.href) ? 'text-primary-700 font-semibold' : 'text-[#475569]'
                      }`}
                    >
                      {item.name}
                    </span>
                  </Link>
                )
              }

              const active = isNavActive(pathname, item.href)
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  onClick={closeMore}
                  className={`${linkClass} active:text-primary-600 ${active ? 'text-primary-600' : 'text-[#475569]'}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon
                    className={`w-[22px] h-[22px] shrink-0 ${active ? 'text-primary-600' : 'text-[#64748B]'}`}
                    strokeWidth={active ? 2.25 : 2}
                    aria-hidden
                  />
                  <span
                    className={`text-[10px] leading-tight text-center truncate max-w-full ${
                      active ? 'font-semibold text-primary-700' : 'font-medium'
                    }`}
                  >
                    {item.name}
                  </span>
                  {active && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-7 h-0.5 bg-primary-600 rounded-full" aria-hidden />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
      <MoreMenuSheet open={moreOpen} onClose={closeMore} />
    </>
  )
}

export default BottomNav