/**
 * Single navigation catalog for the tenant shell.
 * Sidebar, desktop /more, and the mobile More sheet all read this list.
 * Routes match App.jsx. Staff gates match canAccessPage.
 */
import {
  Home,
  ShoppingCart,
  History,
  BookOpen,
  Truck,
  Receipt,
  Users,
  Package,
  Building2,
  LayoutGrid,
  MapPinned,
  Navigation,
  FolderOpen,
  List,
  RotateCcw,
  BadgeDollarSign,
  BarChart3,
  Shield,
  Settings,
  ClipboardList,
  Archive,
  User,
  HelpCircle,
  MessageSquare,
  LogOut,
  LayoutDashboard,
  Search,
  AlertTriangle,
  Activity,
  Inbox,
  Wallet,
  FileSpreadsheet,
  Quote,
  FileSignature,
  Percent,
  Calculator,
  PackageCheck,
  CalendarCheck,
  ScrollText,
  Boxes,
} from 'lucide-react'
import { canAccessPage, canManagePayments, isAdminOrOwner, isOwner } from '../utils/roles'
import { isSystemAdmin } from '../utils/superAdmin'

/**
 * Item schema:
 *  - label, href, icon
 *  - pageId            staff restriction via canAccessPage
 *  - adminOnly         Admin or Owner (purchases, suppliers, branches, VAT, system)
 *  - managePaymentsOnly payment-management roles from the existing role policy
 *  - ownerOnly         Owner (worksheet)
 *  - systemAdminOnly   impersonating SystemAdmin
 *  - sidebar           shown in the desktop/tablet sidebar
 *  - bottomNav         already a mobile tab — hidden from the More sheet
 *  - shell             profile, help, sign out — already in the chrome
 *  - action            { type: 'signOut' }
 */
export const MORE_MENU_GROUPS = [
  {
    id: 'MAIN',
    label: 'Main',
    sidebar: true,
    defaultOpen: true,
    items: [
      { id: 'dashboard', description: 'Sales and key numbers at a glance', label: 'Dashboard', href: '/dashboard', icon: Home, sidebar: true, bottomNav: true },
    ],
  },
  {
    id: 'TRANSACTIONS',
    label: 'Transactions',
    sidebar: true,
    defaultOpen: true,
    items: [
      { id: 'pos', description: 'Create invoices and take payments', label: 'POS', href: '/pos', icon: ShoppingCart, pageId: 'pos', sidebar: true, bottomNav: true },
      // Not a BottomNav tab — keep in mobile More (bottomNav would hide it incorrectly).
      { id: 'billing-history', description: 'Find and reprint past invoices', label: 'Billing History', href: '/billing-history', icon: History, pageId: 'pos', sidebar: true },
      { id: 'sales-ledger', description: 'Day-by-day sales register', label: 'Sales Ledger', href: '/sales-ledger', icon: FileSpreadsheet, pageId: 'reports', sidebar: true },
      { id: 'ledger', description: 'Customer balances and statements', label: 'Customer Ledger', href: '/ledger', icon: BookOpen, pageId: 'invoices', sidebar: true, bottomNav: true },
      { id: 'payments', description: 'Record and track customer payments', label: 'Payments', href: '/payments', icon: Wallet, managePaymentsOnly: true, sidebar: true },
      { id: 'purchases', description: 'Supplier bills and stock in', label: 'Purchases', href: '/purchases', icon: Truck, adminOnly: true, sidebar: true },
      { id: 'expenses', description: 'Track business spending', label: 'Expenses', href: '/expenses', icon: Receipt, pageId: 'expenses', sidebar: true },
    ],
  },
  {
    id: 'MASTERS',
    label: 'Masters',
    sidebar: true,
    defaultOpen: true,
    items: [
      { id: 'customers', description: 'Customer list and contacts', label: 'Customers', href: '/customers', icon: Users, pageId: 'customers', sidebar: true },
      { id: 'products', description: 'Items, prices and stock levels', label: 'Products', href: '/products', icon: Package, pageId: 'products', sidebar: true },
      { id: 'suppliers', description: 'Vendors you buy from', label: 'Suppliers', href: '/suppliers', icon: Building2, adminOnly: true, sidebar: true },
      { id: 'branches', description: 'Branches and delivery routes', label: 'Branches & Routes', href: '/branches', icon: LayoutGrid, adminOnly: true, sidebar: true },
      { id: 'pricelist', description: 'Browse and share your product prices', label: 'Price List', href: '/pricelist', icon: List, pageId: 'products' },
    ],
  },
  {
    id: 'OPERATIONS',
    label: 'Operations',
    sidebar: true,
    items: [
      { id: 'documents', label: 'Documents', href: '/documents', icon: FolderOpen, sidebar: true },
      { id: 'my-routes', description: 'Your delivery routes and stops for today', label: 'My routes', href: '/my-routes', icon: Navigation, sidebar: true },
      { id: 'route-map', description: 'Customers, balances and the route on a map', label: 'Route map', href: '/route-map', icon: MapPinned, sidebar: true },
      { id: 'stock-adjustments', description: 'Correct stock counts', label: 'Stock Adjustments', href: '/stock-adjustments', icon: Boxes, pageId: 'products', sidebar: true },
      { id: 'quotations', description: 'Send price quotes to customers', label: 'Quotations', href: '/quotations', icon: Quote, sidebar: true },
      { id: 'delivery-notes', description: 'Record goods delivered', label: 'Delivery Notes', href: '/delivery-notes', icon: PackageCheck, sidebar: true },
      { id: 'returns-create', description: 'Credit notes and returned goods', label: 'Returns', href: '/returns/create', icon: RotateCcw, sidebar: true },
      { id: 'agreements', description: 'Create and manage customer agreements', label: 'Agreements', href: '/agreements', icon: FileSignature },
      { id: 'salary-certificates', description: 'Issue salary certificates for staff', label: 'Salary Certificates', href: '/salary-certificates', icon: BadgeDollarSign },
    ],
  },
  {
    id: 'REPORTING',
    label: 'Reporting',
    sidebar: true,
    items: [
      { id: 'reports', description: 'Sales, profit and stock reports', label: 'Reports', href: '/reports', icon: BarChart3, pageId: 'reports', sidebar: true },
      { id: 'daily-close', description: 'Close the day and reconcile cash', label: 'Daily close', href: '/daily-close', icon: CalendarCheck, adminOnly: true, sidebar: true },
      { id: 'vat-return', description: 'Prepare your VAT filing', label: 'VAT Return', href: '/vat-return', icon: Percent, adminOnly: true, sidebar: true },
      { id: 'worksheet', description: 'Owner profit worksheet', label: 'Worksheet', href: '/worksheet', icon: Calculator, ownerOnly: true, sidebar: true },
    ],
  },
  {
    id: 'SYSTEM',
    label: 'System',
    sidebar: true,
    items: [
      { id: 'users', description: 'Staff accounts and roles', label: 'Users', href: '/users', icon: Shield, pageId: 'users', adminOnly: true, sidebar: true },
      { id: 'settings', description: 'Company, invoice and VAT settings', label: 'Settings', href: '/settings', icon: Settings, pageId: 'settings', adminOnly: true, sidebar: true },
      { id: 'audit', description: 'Who changed what, and when', label: 'Activity Log', href: '/audit', icon: ScrollText, adminOnly: true, sidebar: true },
      { id: 'backup', description: 'Download or restore your data', label: 'Backup & Restore', href: '/backup', icon: Archive, pageId: 'backup', adminOnly: true, sidebar: true },
    ],
  },
  {
    id: 'ACCOUNT',
    label: 'Account',
    items: [
      { id: 'profile', description: 'Your name, email and password', label: 'My Profile', href: '/profile', icon: User, shell: true },
      { id: 'help', description: 'Guides and contact support', label: 'Help & Support', href: '/help', icon: HelpCircle, shell: true },
      { id: 'feedback', description: 'Report a problem or suggest an improvement', label: 'Feedback', href: '/feedback', icon: MessageSquare },
      { id: 'signout', label: 'Sign out', icon: LogOut, shell: true, action: { type: 'signOut' } },
    ],
  },
  {
    id: 'SUPERADMIN',
    label: 'SuperAdmin',
    systemAdminOnly: true,
    items: [
      { id: 'sa-dashboard', label: 'SuperAdmin Dashboard', href: '/superadmin/dashboard', icon: LayoutDashboard, systemAdminOnly: true },
      { id: 'sa-tenants', label: 'Tenants', href: '/superadmin/tenants', icon: Building2, systemAdminOnly: true },
      { id: 'sa-search', label: 'Global Search', href: '/superadmin/search', icon: Search, systemAdminOnly: true },
      { id: 'sa-audit', label: 'Audit Logs', href: '/superadmin/audit-logs', icon: ClipboardList, systemAdminOnly: true },
      { id: 'sa-error-logs', label: 'Error Logs', href: '/superadmin/error-logs', icon: AlertTriangle, systemAdminOnly: true },
      { id: 'sa-health', label: 'Infrastructure', href: '/superadmin/health', icon: Activity, systemAdminOnly: true },
      { id: 'sa-settings', label: 'Settings', href: '/superadmin/settings', icon: Shield, systemAdminOnly: true },
      { id: 'sa-demo-requests', label: 'Demo Requests', href: '/superadmin/demo-requests', icon: Inbox, systemAdminOnly: true },
    ],
  },
]

const canSeeItem = (user, item, isImpersonating) => {
  if (item.managePaymentsOnly) return canManagePayments(user)
  if (item.systemAdminOnly) return isSystemAdmin(user) && !!isImpersonating
  if (item.action) return true
  if (item.ownerOnly) return isOwner(user)
  if (!item.adminOnly && item.pageId) return canAccessPage(user, item.pageId)
  if (item.adminOnly) return isAdminOrOwner(user)
  return true
}

const filterGroups = (user, { isImpersonating, hideBottomNav, hideSidebar, hideShell, sidebarOnly }) =>
  MORE_MENU_GROUPS.map((group) => {
    if (sidebarOnly && !group.sidebar) return null
    if (group.systemAdminOnly && !isImpersonating) return null
    const items = group.items.filter((item) => {
      if (sidebarOnly && !item.sidebar) return false
      if (!canSeeItem(user, item, isImpersonating)) return false
      if (hideBottomNav && item.bottomNav) return false
      if (hideSidebar && item.sidebar) return false
      if (hideShell && (item.shell || item.action)) return false
      return true
    })
    return items.length ? { ...group, items } : null
  }).filter(Boolean)

/** Desktop and tablet sidebar. Daily groups stay open; other groups collapse. */
export const visibleSidebar = (user, { isImpersonating = true } = {}) =>
  filterGroups(user, { isImpersonating, sidebarOnly: true })

/**
 * More surfaces. Mobile sheet hides the five bottom tabs.
 * Desktop /more hides anything already in the sidebar or the shell.
 */
export const visibleMoreMenu = (user, {
  isImpersonating = true,
  hideBottomNav = false,
  hideSidebar = false,
  hideShell = false,
} = {}) => filterGroups(user, { isImpersonating, hideBottomNav, hideSidebar, hideShell })

export const isItemActive = (pathname, item) => {
  if (!item?.href) return false
  if (item.href === '/branches') {
    return ['/branches', '/routes'].some((route) => pathname === route || pathname.startsWith(`${route}/`))
  }
  if (item.href === '/dashboard') return pathname === '/dashboard' || pathname === '/'
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export const isMoreMenuActive = (pathname, groups) =>
  (groups || []).some((group) => (group.items || []).some((item) => isItemActive(pathname, item)))
