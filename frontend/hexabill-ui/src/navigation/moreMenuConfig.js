/**
 * moreMenuConfig — single source of truth for the "More" navigation.
 *
 * Powers BOTH the mobile More bottom sheet (components/mobile/MoreMenuSheet.jsx)
 * and the desktop /more page (pages/company/MorePage.jsx), so the two never
 * drift apart.
 *
 * Every entry maps to a REAL route that exists in App.jsx, and its permission
 * flags mirror the authoritative gates already used by the desktop sidebar
 * (Layout.jsx `navigation`) plus the route-level staff checks (`canAccessPage`).
 * Nothing here is invented.
 */
import {
  FileText, // Sales Ledger / Quotations / Agreements / VAT Return / Worksheet
  Users,
  Package,
  List,
  History,
  Building2,
  Truck,
  BadgeDollarSign,
  Receipt,
  LayoutGrid,
  RotateCcw,
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
} from 'lucide-react'
import { canAccessPage, isAdminOrOwner, isOwner } from '../utils/roles'
import { isSystemAdmin } from '../utils/superAdmin'

/**
 * Item schema:
 *  - label, href, icon  (href omitted for action-only items like Sign out)
 *  - pageId            — staff restriction checked via `canAccessPage`
 *  - adminOnly         — requires `isAdminOrOwner`
 *  - ownerOnly         — requires `isOwner` (Worksheet)
 *  - systemAdminOnly   — requires `isSystemAdmin` (SuperAdmin console group)
 *  - action            — { type: 'signOut' } non-route action (mobile sheet only)
 */
export const MORE_MENU_GROUPS = [
  {
    id: 'MAIN',
    label: 'Main',
    items: [
      { id: 'sales-ledger', label: 'Sales Ledger', href: '/sales-ledger', icon: FileText, pageId: 'reports' },
      { id: 'customers', label: 'Customers', href: '/customers', icon: Users, pageId: 'customers' },
    ],
  },
  {
    id: 'BUSINESS',
    label: 'Business',
    items: [
      { id: 'products', label: 'Products', href: '/products', icon: Package, pageId: 'products' },
      { id: 'pricelist', label: 'Price List', href: '/pricelist', icon: List, pageId: 'products' },
      { id: 'stock-adjustments', label: 'Stock Adjustments', href: '/stock-adjustments', icon: History, pageId: 'products' },
      { id: 'suppliers', label: 'Suppliers', href: '/suppliers', icon: Building2, pageId: 'purchases', adminOnly: true },
      { id: 'purchases', label: 'Purchases', href: '/purchases', icon: Truck, pageId: 'purchases', adminOnly: true },
      { id: 'quotations', label: 'Quotations', href: '/quotations', icon: FileText },
      { id: 'agreements', label: 'Agreements', href: '/agreements', icon: FileText },
      { id: 'salary-certificates', label: 'Salary Certificates', href: '/salary-certificates', icon: BadgeDollarSign },
      { id: 'delivery-notes', label: 'Delivery Notes', href: '/delivery-notes', icon: Package },
    ],
  },
  {
    id: 'OPERATIONS',
    label: 'Operations',
    items: [
      { id: 'expenses', label: 'Expenses', href: '/expenses', icon: Receipt, pageId: 'expenses' },
      { id: 'branches', label: 'Branches & Routes', href: '/branches', icon: LayoutGrid, adminOnly: true },
      { id: 'returns-create', label: 'Create Return', href: '/returns/create', icon: RotateCcw },
    ],
  },
  {
    id: 'INSIGHTS',
    label: 'Insights',
    items: [
      // Reports is gated by the real staff permission ('reports') — the old
      // mobile bottom tab used the same check, so staff granted 'reports'
      // keep access.
      { id: 'reports', label: 'Reports', href: '/reports', icon: BarChart3, pageId: 'reports' },
      { id: 'vat-return', label: 'VAT Return', href: '/vat-return', icon: FileText, adminOnly: true },
      { id: 'worksheet', label: 'Worksheet', href: '/worksheet', icon: FileText, ownerOnly: true },
    ],
  },
  {
    id: 'SYSTEM',
    label: 'System',
    items: [
      { id: 'users', label: 'Users', href: '/users', icon: Shield, pageId: 'users', adminOnly: true },
      { id: 'settings', label: 'Settings', href: '/settings', icon: Settings, pageId: 'settings', adminOnly: true },
      { id: 'audit', label: 'Activity Log', href: '/audit', icon: ClipboardList, adminOnly: true },
      { id: 'backup', label: 'Backup & Restore', href: '/backup', icon: Archive, pageId: 'backup', adminOnly: true },
    ],
  },
  {
    id: 'ACCOUNT',
    label: 'Account',
    items: [
      { id: 'profile', label: 'My Profile', href: '/profile', icon: User },
      { id: 'help', label: 'Help & Support', href: '/help', icon: HelpCircle },
      { id: 'feedback', label: 'Feedback', href: '/feedback', icon: MessageSquare },
      { id: 'signout', label: 'Sign out', icon: LogOut, action: { type: 'signOut' } },
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

/** True when the user may see a single menu item, under the same rules the sidebar + route guards use. */
const canSeeItem = (user, item, isImpersonating) => {
  if (item.systemAdminOnly) return isSystemAdmin(user) && !!isImpersonating
  if (item.action) return true // Sign out: always available
  if (item.ownerOnly) return isOwner(user)
  if (!item.adminOnly && item.pageId) return canAccessPage(user, item.pageId)
  // adminOnly (and everything else admin sees) — staff never bypass admin gates
  if (item.adminOnly) return isAdminOrOwner(user)
  return true
}

/**
 * Returns the groups this user can see. Filters items by role + staff page
 * access, and drops groups that become empty. The SUPERADMIN group is only
 * surfaced while a SystemAdmin is impersonating a tenant (tenant Layout never
 * mounts otherwise).
 */
export const visibleMoreMenu = (user, { isImpersonating = true } = {}) =>
  MORE_MENU_GROUPS.map((group) => {
    if (group.systemAdminOnly && !isImpersonating) return null
    const items = group.items.filter((item) => canSeeItem(user, item, isImpersonating))
    return items.length ? { ...group, items } : null
  }).filter(Boolean)

/**
 * Active-route matching for a single item — mirrors Layout.jsx `isActive`,
 * including keeping Branches/Routes active on their detail pages.
 */
export const isItemActive = (pathname, item) => {
  if (!item?.href) return false
  if (item.href === '/branches') {
    return ['/branches', '/routes'].some((r) => pathname === r || pathname.startsWith(`${r}/`))
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

/** True when any item across the given groups matches the current pathname. */
export const isMoreMenuActive = (pathname, groups) =>
  (groups || []).some((group) => (group.items || []).some((item) => isItemActive(pathname, item)))