import React, { useEffect, Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { isSystemAdmin } from './utils/superAdmin'
import { canAccessPage, isOwner } from './utils/roles'
import { getApiBaseUrlNoSuffix } from './services/apiConfig'
import { getTenantHost } from './utils/tenantHost'
import Login from './pages/Login'
import SignupPage from './pages/SignupPage'
import Layout from './components/Layout'
import { BranchesRoutesProvider } from './contexts/BranchesRoutesContext'
import SuperAdminLayout from './components/SuperAdminLayout'
import ConnectionStatus from './components/ConnectionStatus'
import ErrorBoundary from './components/ErrorBoundary'
import { MaintenanceOverlay } from './components/MaintenanceOverlay'

// Route-level code splitting. The initial bundle stays lean; each route chunk
// loads on first visit. Login/Signup stay eager so the landing screen paints fast.
const Dashboard = lazy(() => import('./pages/company/DashboardTally'))
const ProductsPage = lazy(() => import('./pages/company/ProductsPage'))
const ProductDetailPage = lazy(() => import('./pages/company/ProductDetailPage'))
const PriceList = lazy(() => import('./pages/company/PriceList'))
const PurchasesPage = lazy(() => import('./pages/company/PurchasesPage'))
const SuppliersPage = lazy(() => import('./pages/company/SuppliersPage'))
const SupplierDetailPage = lazy(() => import('./pages/company/SupplierDetailPage'))
const PosPage = lazy(() => import('./pages/company/PosPage'))
const CustomerLedgerPage = lazy(() => import('./pages/company/CustomerLedgerPage'))
const ExpensesPage = lazy(() => import('./pages/company/ExpensesPage'))
const ReportsPage = lazy(() => import('./pages/company/ReportsPage'))
const VatReturnPage = lazy(() => import('./pages/company/VatReturnPage'))
const WorksheetPage = lazy(() => import('./pages/company/WorksheetPage'))
const SalesLedgerPage = lazy(() => import('./pages/company/SalesLedgerPage'))
const BillingHistoryPage = lazy(() => import('./pages/company/BillingHistoryPage'))
const SettingsPage = lazy(() => import('./pages/company/SettingsPage'))
const AuditLogPage = lazy(() => import('./pages/company/AuditLogPage'))
const UsersPage = lazy(() => import('./pages/company/UsersPage'))
const BackupPage = lazy(() => import('./pages/company/BackupPage'))
const ProfilePage = lazy(() => import('./pages/company/ProfilePage'))
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperAdminDashboard'))
const SuperAdminTenantsPage = lazy(() => import('./pages/superadmin/SuperAdminTenantsPage'))
const SuperAdminTenantDetailPage = lazy(() => import('./pages/superadmin/SuperAdminTenantDetailPage'))
const SuperAdminDemoRequestsPage = lazy(() => import('./pages/superadmin/SuperAdminDemoRequestsPage'))
const SuperAdminHealthPage = lazy(() => import('./pages/superadmin/SuperAdminHealthPage'))
const SuperAdminErrorLogsPage = lazy(() => import('./pages/superadmin/SuperAdminErrorLogsPage'))
const SuperAdminAuditLogsPage = lazy(() => import('./pages/superadmin/SuperAdminAuditLogsPage'))
const SuperAdminSettingsPage = lazy(() => import('./pages/superadmin/SuperAdminSettingsPage'))
const SuperAdminGlobalSearchPage = lazy(() => import('./pages/superadmin/SuperAdminGlobalSearchPage'))
const SuperAdminSqlConsolePage = lazy(() => import('./pages/superadmin/SuperAdminSqlConsolePage'))
const BranchesPage = lazy(() => import('./pages/company/BranchesPage'))
const BranchDetailPage = lazy(() => import('./pages/company/BranchDetailPage'))
const RoutesPage = lazy(() => import('./pages/company/RoutesPage'))
const RouteDetailPage = lazy(() => import('./pages/company/RouteDetailPage'))
const ReturnCreatePage = lazy(() => import('./pages/company/ReturnCreatePage'))
const CustomersPage = lazy(() => import('./pages/company/CustomersPage'))
const CustomerDetailPage = lazy(() => import('./pages/company/CustomerDetailPage'))
const MorePage = lazy(() => import('./pages/company/MorePage'))
const QuotationsPage = lazy(() => import('./pages/company/QuotationsPage'))
const QuotationEditorPage = lazy(() => import('./pages/company/QuotationEditorPage'))
const AgreementsPage = lazy(() => import('./pages/company/AgreementsPage'))
const AgreementEditorPage = lazy(() => import('./pages/company/AgreementEditorPage'))
const SalaryCertificatesPage = lazy(() => import('./pages/company/SalaryCertificatesPage'))
const SalaryCertificateEditorPage = lazy(() => import('./pages/company/SalaryCertificateEditorPage'))
const DeliveryNotesPage = lazy(() => import('./pages/company/DeliveryNotesPage'))
const DeliveryNoteViewPage = lazy(() => import('./pages/company/DeliveryNoteViewPage'))
const StockAdjustmentsHistoryPage = lazy(() => import('./pages/company/StockAdjustmentsHistoryPage'))
const OnboardingWizard = lazy(() => import('./pages/OnboardingWizard'))
const ErrorPage = lazy(() => import('./pages/ErrorPage'))
const HelpPage = lazy(() => import('./pages/HelpPage'))
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'))

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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
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
