import React, { useEffect, Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isSystemAdmin } from '../utils/superAdmin'
import { canAccessPage, isOwner } from '../utils/roles'
import { getApiBaseUrlNoSuffix } from '../services/apiConfig'
import { getTenantHost } from '../tenant/tenantHost'
import Login from '../auth/Login'
import SignupPage from '../auth/SignupPage'
import Layout from '../components/Layout'
import { BranchesRoutesProvider } from '../contexts/BranchesRoutesContext'
import SuperAdminLayout from '../components/SuperAdminLayout'
import ConnectionStatus from '../components/ConnectionStatus'
import ErrorBoundary from '../components/ErrorBoundary'
import { MaintenanceOverlay } from '../components/MaintenanceOverlay'

// Route-level code splitting. The initial bundle stays lean; each route chunk
// loads on first visit. Login/Signup stay eager so the landing screen paints fast.
const Dashboard = lazy(() => import('../features/dashboard/DashboardTally'))
const ProductsPage = lazy(() => import('../features/products/ProductsPage'))
const ProductDetailPage = lazy(() => import('../features/products/ProductDetailPage'))
const PriceList = lazy(() => import('../features/products/PriceList'))
const PurchasesPage = lazy(() => import('../features/purchases/PurchasesPage'))
const SuppliersPage = lazy(() => import('../features/purchases/SuppliersPage'))
const SupplierDetailPage = lazy(() => import('../features/purchases/SupplierDetailPage'))
const PosPage = lazy(() => import('../features/sales/PosPage'))
const CustomerLedgerPage = lazy(() => import('../features/customers/CustomerLedgerPage'))
const ExpensesPage = lazy(() => import('../features/expenses/ExpensesPage'))
const ReportsPage = lazy(() => import('../features/reports/ReportsPage'))
const VatReturnPage = lazy(() => import('../features/reports/VatReturnPage'))
const WorksheetPage = lazy(() => import('../features/reports/WorksheetPage'))
const SalesLedgerPage = lazy(() => import('../features/sales/SalesLedgerPage'))
const BillingHistoryPage = lazy(() => import('../features/sales/BillingHistoryPage'))
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'))
const AuditLogPage = lazy(() => import('../pages/company/AuditLogPage'))
const UsersPage = lazy(() => import('../pages/company/UsersPage'))
const BackupPage = lazy(() => import('../pages/company/BackupPage'))
const ProfilePage = lazy(() => import('../pages/company/ProfilePage'))
const SuperAdminDashboard = lazy(() => import('../platform/SuperAdminDashboard'))
const SuperAdminTenantsPage = lazy(() => import('../platform/SuperAdminTenantsPage'))
const SuperAdminTenantDetailPage = lazy(() => import('../platform/SuperAdminTenantDetailPage'))
const SuperAdminDemoRequestsPage = lazy(() => import('../platform/SuperAdminDemoRequestsPage'))
const SuperAdminHealthPage = lazy(() => import('../platform/SuperAdminHealthPage'))
const SuperAdminErrorLogsPage = lazy(() => import('../platform/SuperAdminErrorLogsPage'))
const SuperAdminAuditLogsPage = lazy(() => import('../platform/SuperAdminAuditLogsPage'))
const SuperAdminSettingsPage = lazy(() => import('../platform/SuperAdminSettingsPage'))
const SuperAdminGlobalSearchPage = lazy(() => import('../platform/SuperAdminGlobalSearchPage'))
const SuperAdminSqlConsolePage = lazy(() => import('../platform/SuperAdminSqlConsolePage'))
const BranchesPage = lazy(() => import('../features/branches/BranchesPage'))
const BranchDetailPage = lazy(() => import('../features/branches/BranchDetailPage'))
const RoutesPage = lazy(() => import('../features/branches/RoutesPage'))
const RouteDetailPage = lazy(() => import('../features/branches/RouteDetailPage'))
const ReturnCreatePage = lazy(() => import('../features/returns/ReturnCreatePage'))
const CustomersPage = lazy(() => import('../features/customers/CustomersPage'))
const CustomerDetailPage = lazy(() => import('../features/customers/CustomerDetailPage'))
const MorePage = lazy(() => import('../pages/company/MorePage'))
const QuotationsPage = lazy(() => import('../features/documents/QuotationsPage'))
const QuotationEditorPage = lazy(() => import('../features/documents/QuotationEditorPage'))
const AgreementsPage = lazy(() => import('../features/documents/AgreementsPage'))
const AgreementEditorPage = lazy(() => import('../features/documents/AgreementEditorPage'))
const SalaryCertificatesPage = lazy(() => import('../features/documents/SalaryCertificatesPage'))
const SalaryCertificateEditorPage = lazy(() => import('../features/documents/SalaryCertificateEditorPage'))
const DeliveryNotesPage = lazy(() => import('../features/sales/DeliveryNotesPage'))
const DeliveryNoteViewPage = lazy(() => import('../features/sales/DeliveryNoteViewPage'))
const StockAdjustmentsHistoryPage = lazy(() => import('../features/inventory/StockAdjustmentsHistoryPage'))
const OnboardingWizard = lazy(() => import('../pages/OnboardingWizard'))
const ErrorPage = lazy(() => import('../pages/ErrorPage'))
const HelpPage = lazy(() => import('../pages/HelpPage'))
const FeedbackPage = lazy(() => import('../pages/FeedbackPage'))

/** Suspense fallback shown while a lazy route chunk loads. */
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" role="status" aria-label="Loading" />
  </div>
)

function App() {
  const { user, loading, impersonatedTenantId } = useAuth()
  const location = useLocation()
  const tenantHost = getTenantHost()
  const isLocalHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)

  // BUG #3 FIX: Keep-alive ping every 9 minutes to prevent Render cold starts
  // Render Starter plan sleeps after 15 minutes, so ping at 9 minutes keeps it awake
  useEffect(() => {
    if (!user) return // Only ping when user is logged in

    const pingHealth = async () => {
      try {
        const apiBase = getApiBaseUrlNoSuffix()
        await fetch(`${apiBase}/health`, {
          method: 'GET',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        }).catch(() => {
          // Silently fail - don't show errors for keep-alive pings
        })
      } catch {
        // Silently fail - keep-alive is best-effort
      }
    }

    // Ping immediately, then every 9 minutes (540000ms)
    pingHealth()
    const interval = setInterval(pingHealth, 540000)

    return () => clearInterval(interval)
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" role="status" aria-label="Loading"></div>
      </div>
    )
  }

  // Public routes (no auth required) - Marketing pages moved to separate site
  const publicRoutes = ['/signup', '/login', '/Admin26']
  const isPublicRoute = publicRoutes.includes(location.pathname)

  if (isPublicRoute && !isLocalHost) {
    if (location.pathname === '/Admin26' && tenantHost.mode === 'tenant') {
      return <Navigate to="/login" replace />
    }
    if (location.pathname === '/login' && tenantHost.mode === 'platform') {
      return <Navigate to="/Admin26" replace />
    }
  }

  // Show signup/login pages for public routes
  if (isPublicRoute) {
    return (
      <ErrorBoundary>
        <MaintenanceOverlay />
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/Admin26" element={<Login isSuperAdminLogin={true} />} />
        </Routes>
      </ErrorBoundary>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    if (location.pathname.startsWith('/superadmin') || location.pathname === '/Admin26') {
      return <Navigate to="/Admin26" replace />
    }
    return <Navigate to="/login" replace />
  }

  // CRITICAL: Check if user is SuperAdmin
  const userIsSystemAdmin = isSystemAdmin(user)

  if (!isLocalHost && tenantHost.mode === 'platform' && !userIsSystemAdmin) {
    return <Navigate to="/login" replace />
  }
  if (!isLocalHost && tenantHost.mode === 'tenant' && userIsSystemAdmin) {
    return <Navigate to="/Admin26" replace />
  }

  // CRITICAL: Redirect root based on role
  const getRootPath = () => {
    if (userIsSystemAdmin) return '/superadmin/dashboard'
    return '/dashboard'
  }

  // Staff cannot access Branches or Routes (list or detail) — redirect to dashboard; no deep-link bypass
  const path = (location.pathname || '').replace(/\/+$/, '') || '/'
  const isStaffOnly = user?.role?.toLowerCase() === 'staff' && !userIsSystemAdmin && !impersonatedTenantId
  const isBranchesOrRoutes =
    path === '/branches' || path.startsWith('/branches/') ||
    path === '/routes' || path.startsWith('/routes/')
  if (isStaffOnly && isBranchesOrRoutes) {
    return <Navigate to="/dashboard" replace />
  }

  // Owner-only: Worksheet page — only Owner and SystemAdmin can access
  if (path === '/worksheet' && !isOwner(user)) {
    return <Navigate to="/dashboard" replace />
  }

  // Staff page-level access: redirect if they don't have permission for this page
  const getPageIdForPath = (p) => {
    if (p === '/pos' || p === '/billing-history' || p.startsWith('/billing-history/')) return 'pos'
    if (p === '/ledger') return 'invoices'
    if (p === '/sales-ledger' || p.startsWith('/reports')) return 'reports'
    if (p === '/products' || p.startsWith('/products/') || p === '/pricelist' || p === '/stock-adjustments') return 'products'
    if (p === '/customers' || p.startsWith('/customers/')) return 'customers'
    if (p === '/more') return null
    if (p === '/expenses') return 'expenses'
    if (p === '/users') return 'users'
    if (p === '/settings') return 'settings'
    if (p === '/backup') return 'backup'
    if (p === '/purchases') return 'purchases'
    if (p === '/suppliers' || p.startsWith('/suppliers/')) return 'purchases'
    return null
  }
  const resolvedPageId = getPageIdForPath(path)
  const staffPageDenied = isStaffOnly && resolvedPageId && !canAccessPage(user, resolvedPageId)
  if (staffPageDenied) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <ErrorBoundary>
      <MaintenanceOverlay />
      <ConnectionStatus />
      {user?.supportReadOnly && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-600 text-white text-center text-sm font-medium py-2 shadow-md">
          Read-only Super Admin support session. Changes are disabled and this session expires automatically.
        </div>
      )}
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to={getRootPath()} replace />} />
        {/* Onboarding wizard */}
        <Route path="/onboarding" element={<OnboardingWizard />} />

        {/* Super Admin routes - Only accessible to SystemAdmin with SuperAdminLayout */}
        {userIsSystemAdmin && (
          <Route element={<SuperAdminLayout />}>
            <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
            <Route path="/superadmin/tenants" element={<SuperAdminTenantsPage />} />
            <Route path="/superadmin/tenants/:id" element={<SuperAdminTenantDetailPage />} />
            <Route path="/superadmin/demo-requests" element={<SuperAdminDemoRequestsPage />} />
            <Route path="/superadmin/health" element={<SuperAdminHealthPage />} />
            <Route path="/superadmin/error-logs" element={<SuperAdminErrorLogsPage />} />
            <Route path="/superadmin/audit-logs" element={<SuperAdminAuditLogsPage />} />
            <Route path="/superadmin/settings" element={<SuperAdminSettingsPage />} />
            <Route path="/superadmin/search" element={<SuperAdminGlobalSearchPage />} />
            <Route path="/superadmin/sql-console" element={<SuperAdminSqlConsolePage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
          </Route>
        )}

        {/* Tenant routes - Accessible to standard users OR impersonating SystemAdmin */}
        {(!userIsSystemAdmin || !!impersonatedTenantId) && (
          <>
            {/* All pages including Dashboard use Layout with sidebar - BranchesRoutesProvider caches branches/routes to prevent 429 */}
            <Route element={<BranchesRoutesProvider><Layout /></BranchesRoutesProvider>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/products/:id" element={<ProductDetailPage />} />
              <Route path="/stock-adjustments" element={<StockAdjustmentsHistoryPage />} />
              <Route path="/pricelist" element={<PriceList />} />
              <Route path="/purchases" element={<PurchasesPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/suppliers/:name" element={<SupplierDetailPage />} />
              <Route path="/pos" element={<PosPage />} />
              <Route path="/ledger" element={<CustomerLedgerPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/sales-ledger" element={<SalesLedgerPage />} />
              <Route path="/billing-history" element={<BillingHistoryPage />} />
              <Route path="/recurring-invoices" element={<Navigate to="/dashboard" replace />} />
              <Route path="/returns/create" element={<ReturnCreatePage />} />
              <Route path="/quotations" element={<QuotationsPage />} />
              <Route path="/quotations/new" element={<QuotationEditorPage />} />
              <Route path="/quotations/:id" element={<QuotationEditorPage />} />
              <Route path="/agreements" element={<AgreementsPage />} />
              <Route path="/agreements/new" element={<AgreementEditorPage />} />
              <Route path="/agreements/:id" element={<AgreementEditorPage />} />
              <Route path="/salary-certificates" element={<SalaryCertificatesPage />} />
              <Route path="/salary-certificates/new" element={<SalaryCertificateEditorPage />} />
              <Route path="/salary-certificates/:id" element={<SalaryCertificateEditorPage />} />
              <Route path="/delivery-notes" element={<DeliveryNotesPage />} />
              <Route path="/delivery-notes/:saleId" element={<DeliveryNoteViewPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reports/outstanding" element={<ReportsPage />} />
              <Route path="/vat-return" element={<VatReturnPage />} />
              <Route path="/worksheet" element={<WorksheetPage />} />
              {/* Staff cannot access branches/routes — redirect (defense in depth with early return above) */}
              <Route path="/branches" element={isStaffOnly ? <Navigate to="/dashboard" replace /> : <BranchesPage />} />
              <Route path="/branches/:id" element={isStaffOnly ? <Navigate to="/dashboard" replace /> : <BranchDetailPage />} />
              <Route path="/routes" element={isStaffOnly ? <Navigate to="/dashboard" replace /> : <RoutesPage />} />
              <Route path="/routes/:id" element={isStaffOnly ? <Navigate to="/dashboard" replace /> : <RouteDetailPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:id" element={<CustomerDetailPage />} />
              <Route path="/more" element={<MorePage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/audit" element={<AuditLogPage />} />
              <Route path="/backup" element={<BackupPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/feedback" element={<FeedbackPage />} />
            </Route>
          </>
        )}

        {/* Redirect SystemAdmin trying to access tenant routes WITHOUT impersonation */}
        {userIsSystemAdmin && !impersonatedTenantId && (
          <>
            <Route path="/dashboard" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/products" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/pos" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/ledger" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/expenses" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/purchases" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/suppliers" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/suppliers/:name" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/reports" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/billing-history" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/recurring-invoices" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/audit" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/worksheet" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/branches" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/routes" element={<Navigate to="/superadmin/dashboard" replace />} />
          </>
        )}

        <Route path="*" element={<ErrorPage />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
