/**
 * Single navigation catalog for the tenant shell.
 * Sidebar, desktop /more, and the mobile More sheet all read this list.
 * Routes match App.jsx. Staff gates match canAccessPage.
 */
import {
  Home,
  ShoppingCart,
  History,
  FileText,
  BookOpen,
  Truck,
  Receipt,
  Users,
  Package,
  Building2,
  LayoutGrid,
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
  Database,
  Inbox,
  Wallet,
} from 'lucide-react'
import { canAccessPage, isAdminOrOwner, isOwner } from '../utils/roles'
import { isSystemAdmin } from '../utils/superAdmin'

/**
 * Item schema:
 *  - label, href, icon
 *  - pageId            staff restriction via canAccessPage
 *  - adminOnly         Admin or Owner (purchases, suppliers, branches, VAT, system)
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
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: Home, sidebar: true, bottomNav: true },
    ],
  },
  {
    id: 'TRANSACTIONS',
    label: 'Transactions',
    sidebar: true,
    defaultOpen: true,
    items: [
      { id: 'pos', label: 'POS', href: '/pos', icon: ShoppingCart, pageId: 'pos', sidebar: true, bottomNav: true },
      // Not a BottomNav tab — keep in mobile More (bottomNav would hide it incorrectly).
      { id: 'billing-history', label: 'Billing History', href: '/billing-history', icon: History, pageId: 'pos', sidebar: true },
      { id: 'sales-ledger', label: 'Sales Ledger', href: '/sales-ledger', icon: FileText, pageId: 'reports', sidebar: true },
      { id: 'ledger', label: 'Customer Ledger', href: '/ledger', icon: BookOpen, pageId: 'invoices', sidebar: true, bottomNav: true },
      { id: 'purchases', label: 'Purchases', href: '/purchases', icon: Truck, adminOnly: true, sidebar: true },
      { id: 'expenses', label: 'Expenses', href: '/expenses', icon: Receipt, pageId: 'expenses', sidebar: true },
    ],
  },
  {
    id: 'MASTERS',
    label: 'Masters',
    sidebar: true,
    defaultOpen: true,
    items: [
      { id: 'customers', label: 'Customers', href: '/customers', icon: Users, pageId: 'customers', sidebar: true },
      { id: 'products', label: 'Products', href: '/products', icon: Package, pageId: 'products', sidebar: true },
      { id: 'suppliers', label: 'Suppliers', href: '/suppliers', icon: Building2, adminOnly: true, sidebar: true },
      { id: 'branches', label: 'Branches & Routes', href: '/branches', icon: LayoutGrid, adminOnly: true, sidebar: true },
      { id: 'pricelist', label: 'Price List', href: '/pricelist', icon: List, pageId: 'products' },
    ],
  },
  {
    id: 'OPERATIONS',
    label: 'Operations',
    sidebar: true,
    items: [
      { id: 'stock-adjustments', label: 'Stock Adjustments', href: '/stock-adjustments', icon: ClipboardList, pageId: 'products', sidebar: true },
      { id: 'quotations', label: 'Quotations', href: '/quotations', icon: FileText, sidebar: true },
      { id: 'delivery-notes', label: 'Delivery Notes', href: '/delivery-notes', icon: Package, sidebar: true },
      { id: 'returns-create', label: 'Returns', href: '/returns/create', icon: RotateCcw, sidebar: true },
      { id: 'agreements', label: 'Agreements', href: '/agreements', icon: FileText },
      { id: 'salary-certificates', label: 'Salary Certificates', href: '/salary-certificates', icon: BadgeDollarSign },
    ],
  },
  {
    id: 'REPORTING',
    label: 'Reporting',
    sidebar: true,
    items: [
      { id: 'reports', label: 'Reports', href: '/reports', icon: BarChart3, pageId: 'reports', sidebar: true },
      { id: 'daily-close', label: 'Daily close', href: '/daily-close', icon: Wallet, adminOnly: true, sidebar: true },
      { id: 'vat-return', label: 'VAT Return', href: '/vat-return', icon: FileText, adminOnly: true, sidebar: true },
      { id: 'worksheet', label: 'Worksheet', href: '/worksheet', icon: FileText, ownerOnly: true, sidebar: true },
    ],
  },
  {
    id: 'SYSTEM',
    label: 'System',
    sidebar: true,
    items: [
      { id: 'users', label: 'Users', href: '/users', icon: Shield, pageId: 'users', adminOnly: true, sidebar: true },
      { id: 'settings', label: 'Settings', href: '/settings', icon: Settings, pageId: 'settings', adminOnly: true, sidebar: true },
      { id: 'audit', label: 'Activity Log', href: '/audit', icon: ClipboardList, adminOnly: true, sidebar: true },
      { id: 'backup', label: 'Backup & Restore', href: '/backup', icon: Archive, pageId: 'backup', adminOnly: true, sidebar: true },
    ],
  },
  {
    id: 'ACCOUNT',
    label: 'Account',
    items: [
      { id: 'profile', label: 'My Profile', href: '/profile', icon: User, shell: true },
      { id: 'help', label: 'Help & Support', href: '/help', icon: HelpCircle, shell: true },
      { id: 'feedback', label: 'Feedback', href: '/feedback', icon: MessageSquare },
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
      { id: 'sa-sql', label: 'SQL Console', href: '/superadmin/sql-console', icon: Database, systemAdminOnly: true },
      { id: 'sa-settings', label: 'Settings', href: '/superadmin/settings', icon: Shield, systemAdminOnly: true },
      { id: 'sa-demo-requests', label: 'Demo Requests', href: '/superadmin/demo-requests', icon: Inbox, systemAdminOnly: true },
    ],
  },
]

const canSeeItem = (user, item, isImpersonating) => {
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
