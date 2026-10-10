// One quick-create list for the whole app (mobile sheet, desktop top-bar menu).
// Each action opens the existing create flow; `?new=1` is read by the target page
// (hooks/useCreateIntent). Visibility follows the same page-access rule as routing.
import { canAccessPage } from '../utils/roles.js'

export const QUICK_CREATE_ACTIONS = [
  { id: 'sale', label: 'New sale', hint: 'POS invoice', href: '/pos', pageId: 'pos', icon: 'ShoppingCart' },
  { id: 'payment', label: 'Receive payment', hint: 'Pick a customer in the ledger', href: '/ledger', pageId: 'invoices', icon: 'Wallet' },
  { id: 'expense', label: 'Expense', hint: 'Record a business expense', href: '/expenses?new=1', pageId: 'expenses', icon: 'Receipt' },
  { id: 'purchase', label: 'Purchase', hint: 'Supplier bill', href: '/purchases?new=1', pageId: 'purchases', icon: 'Truck' },
  { id: 'supplierPayment', label: 'Pay supplier', hint: 'Pick a supplier', href: '/suppliers', pageId: 'purchases', icon: 'Banknote' },
  { id: 'customer', label: 'Customer', hint: 'Add a customer', href: '/customers?new=1', pageId: 'customers', icon: 'UserPlus' },
  { id: 'product', label: 'Product', hint: 'Add a product', href: '/products?new=1', pageId: 'products', icon: 'PackagePlus' },
]

export function getQuickCreateActions (user) {
  if (!user) return []
  return QUICK_CREATE_ACTIONS.filter((a) => canAccessPage(user, a.pageId))
}

// Routes where the phone bottom navigation is hidden: focused transaction workspaces and
// create/edit screens, where the screen belongs to the task and its Save/Cancel actions.
const FOCUSED_EXACT = new Set(['/pos', '/returns/create', '/onboarding'])
const FOCUSED_SUFFIX = ['/new', '/edit', '/create']

export function isFocusedRoute (pathname = '') {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (FOCUSED_EXACT.has(p)) return true
  return FOCUSED_SUFFIX.some((s) => p.endsWith(s))
}

/** Phone bottom nav shows on browsing screens only, never over a dialog or the on-screen keyboard. */
export function shouldShowBottomNav ({ pathname, keyboardOpen = false, overlayOpen = false }) {
  if (keyboardOpen || overlayOpen) return false
  return !isFocusedRoute(pathname)
}
