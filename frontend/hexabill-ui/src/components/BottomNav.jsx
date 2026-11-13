import { Link, useLocation } from 'react-router-dom'
import { Home, Plus, BookOpen, MoreHorizontal, ShoppingCart } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { canAccessPage } from '../utils/roles'

/**
 * Mobile primary IA: Home · Sale · New · Ledger · More.
 * Direct tabs map to real routes; "New" opens the role-filtered quick-create sheet;
 * "More" opens the grouped menu sheet (MoreMenuSheet). Home, New and More are permanent
 * anchors — every other tab is filtered by the staff page-access check.
 * Shown only on browsing screens; Layout hides it on POS, create/edit screens, open dialogs
 * and while the on-screen keyboard is up (navigation/quickCreate.shouldShowBottomNav).
 */
const NAV_ITEMS = [
  { id: 'home', name: 'Home', href: '/dashboard', icon: Home, pageId: null },
  { id: 'pos', name: 'Sale', href: '/pos', icon: ShoppingCart, pageId: 'pos' },
  { id: 'new', name: 'New', icon: Plus, center: true, isCreate: true },
  { id: 'ledger', name: 'Ledger', href: '/ledger', icon: BookOpen, pageId: 'invoices' },
  { id: 'more', name: 'More', icon: MoreHorizontal, isMore: true },
]

// Routes owned by a real tab — everything else counts as "More" territory.
const TAB_ROUTES = ['/dashboard', '/pos', '/ledger']

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

const BottomNav = ({ moreOpen, onOpenMore, onCloseMore, onOpenCreate }) => {
  const location = useLocation()
  const { user } = useAuth()

  const pathname = location.pathname

  const navItems = NAV_ITEMS.filter((item) => {
    if (item.isMore || item.isCreate) return true // permanent anchors
    if (!item.pageId) return true
    return canAccessPage(user, item.pageId)
  })

  if (navItems.length === 0) return null

  const onDirectTab = TAB_ROUTES.some((href) => isNavActive(pathname, href))
  const moreActive = moreOpen || !onDirectTab

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 xl:hidden bg-white border-t border-[#E5E7EB] safe-area-bottom shadow-[0_-1px_6px_rgba(15,23,42,0.06)]"
        aria-label="Main navigation"
      >
        <div className="relative max-w-screen-sm mx-auto px-1 pt-2.5 pb-1.5">
          <div
            className="grid items-end min-h-[56px]"
            style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
          >
            {navItems.map((item) => {
              const Icon = item.icon
              const containerClass = 'relative flex flex-col items-center justify-end min-w-0 min-h-[56px] px-0.5 pb-1 gap-0.5'
              const linkClass = `${containerClass} transition-colors duration-150 active:opacity-90`

              // More → button opening the sheet
              if (item.isMore) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={onOpenMore}
                    className={`${linkClass} ${moreActive ? 'text-primary-600' : 'text-[#475569]'}`}
                    aria-label="More options"
                    aria-expanded={moreOpen}
                    aria-current={moreActive ? 'page' : undefined}
                  >
                    <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${moreActive ? 'bg-primary-50' : ''}`}>
                      <Icon
                        className={`h-6 w-6 shrink-0 ${moreActive ? 'text-primary-600' : 'text-[#64748B]'}`}
                        strokeWidth={moreActive ? 2.2 : 1.9}
                        aria-hidden
                      />
                    </span>
                    <span
                      className={`text-xs leading-tight text-center truncate max-w-full ${
 moreActive ? 'font-semibold text-primary-700' : 'font-medium text-[#475569]'
 }`}
                    >
                      {item.name}
                    </span>
                  </button>
                )
              }

              // Centre "New": filled circle flush with the bar; opens the quick-create sheet.
              if (item.center) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { onCloseMore?.(); onOpenCreate?.() }}
                    className="flex min-h-[56px] min-w-0 flex-col items-center justify-end gap-0.5 pb-1"
                    aria-label="Create new"
                    aria-haspopup="dialog"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm transition-colors duration-150 active:bg-primary-700">
                      <Icon className="h-6 w-6 shrink-0" strokeWidth={2.4} aria-hidden />
                    </span>
                    <span className="max-w-full truncate px-0.5 text-xs font-medium leading-tight text-[#475569]">
                      {item.name}
                    </span>
                  </button>
                )
              }

              const active = isNavActive(pathname, item.href)
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  onClick={onCloseMore}
                  className={`${linkClass} active:text-primary-600 ${active ? 'text-primary-600' : 'text-[#475569]'}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? 'bg-primary-50' : ''}`}>
                    <Icon
                      className={`h-6 w-6 shrink-0 ${active ? 'text-primary-600' : 'text-[#64748B]'}`}
                      strokeWidth={active ? 2.2 : 1.9}
                      aria-hidden
                    />
                  </span>
                  <span
                    className={`text-xs leading-tight text-center truncate max-w-full ${
 active ? 'font-semibold text-primary-700' : 'font-medium text-[#475569]'
 }`}
                  >
                    {item.name}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
}

export default BottomNav
