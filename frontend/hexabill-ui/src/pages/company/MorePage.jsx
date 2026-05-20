import { Link } from 'react-router-dom'
import {
  Package,
  Truck,
  BarChart3,
  Settings,
  Wallet,
  FileText,
  AlertTriangle,
  History,
  Users,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { canAccessPage, isAdminOrOwner } from '../../utils/roles'

const moreLinks = [
  { to: '/customers', label: 'Customers', pageId: 'customers', icon: Users },
  { to: '/expenses', label: 'Expenses', pageId: 'expenses', icon: Wallet },
  { to: '/products', label: 'Products', pageId: 'products', icon: Package },
  { to: '/products?tab=lowStock', label: 'Low stock', pageId: 'products', icon: AlertTriangle },
  { to: '/stock-adjustments', label: 'Stock adjustment history', pageId: 'products', icon: History },
  { to: '/purchases', label: 'Purchases', pageId: 'purchases', icon: Truck, adminOnly: true },
  { to: '/sales-ledger', label: 'Sales ledger', pageId: 'reports', icon: FileText },
  { to: '/reports', label: 'Reports', pageId: 'reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', pageId: 'settings', icon: Settings, adminOnly: true },
]

const MorePage = () => {
  const { user } = useAuth()
  const isElevated = isAdminOrOwner(user)

  const visible = moreLinks.filter((item) => {
    if (item.adminOnly && !isElevated) return false
    return canAccessPage(user, item.pageId)
  })

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto w-full">
      <h1 className="text-h2 font-bold text-text-primary mb-1">More</h1>
      <p className="text-sm text-text-secondary mb-6">Expenses, catalog, purchases, reports, and settings.</p>
      <ul className="flex flex-col gap-2">
        {visible.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex items-center gap-3 min-h-11 px-4 py-3 rounded-xl bg-white border border-neutral-200 text-text-primary hover:border-primary-300 hover:bg-primary-50/50 transition-colors"
            >
              <Icon className="w-5 h-5 text-primary-600 shrink-0" aria-hidden />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
      {visible.length === 0 && (
        <p className="text-sm text-text-secondary">No additional sections available for your role.</p>
      )}
    </div>
  )
}

export default MorePage
