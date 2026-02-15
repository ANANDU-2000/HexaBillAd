import { Link, useLocation } from 'react-router-dom'
import { Home, Package, ShoppingCart, BookOpen, User } from 'lucide-react'

const BottomNav = () => {
  const location = useLocation()

  const navItems = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Products', href: '/products', icon: Package },
    { name: 'POS', href: '/pos', icon: ShoppingCart, center: true },
    { name: 'Ledger', href: '/ledger', icon: BookOpen },
    { name: 'Profile', href: '/profile', icon: User },
  ]

  const isActive = (href) => location.pathname === href

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] z-50 lg:hidden safe-area-bottom"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch h-14 max-w-screen-sm mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          const isCenter = item.center
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-all duration-[150ms] active:opacity-90 min-h-[44px] ${
                isCenter && active
                  ? 'text-white bg-primary-600'
                  : isCenter
                    ? 'text-primary-600'
                    : active
                      ? 'text-primary-600 bg-primary-50/80'
                      : 'text-[#475569]'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                className={`flex-shrink-0 transition-transform duration-[150ms] ${isCenter ? 'w-6 h-6' : 'w-5 h-5'} ${active && !isCenter ? 'scale-105' : ''}`}
                aria-hidden
              />
              <span className={`text-[10px] sm:text-xs font-medium truncate max-w-full ${active && !isCenter ? 'font-semibold' : ''}`}>
                {item.name}
              </span>
              {active && !isCenter && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-600 rounded-full" aria-hidden />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
