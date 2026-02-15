import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { isSystemAdmin } from './utils/superAdmin'
import Login from './pages/Login'
import Dashboard from './pages/company/DashboardTally'
import ProductsPage from './pages/company/ProductsPage'
import PriceList from './pages/company/PriceList'
import PurchasesPage from './pages/company/PurchasesPage'
import PosPage from './pages/company/PosPage'
import CustomerLedgerPage from './pages/company/CustomerLedgerPage'
import ExpensesPage from './pages/company/ExpensesPage'
import ReportsPage from './pages/company/ReportsPage'
import SalesLedgerPage from './pages/company/SalesLedgerPage'
import SettingsPage from './pages/company/SettingsPage'
import UsersPage from './pages/company/UsersPage'
import BackupPage from './pages/company/BackupPage'
import DataImportPage from './pages/company/DataImportPage'
import SalesLedgerImportPage from './pages/company/SalesLedgerImportPage'
import ProfilePage from './pages/company/ProfilePage'
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard'
import SuperAdminTenantsPage from './pages/superadmin/SuperAdminTenantsPage'
import SuperAdminTenantDetailPage from './pages/superadmin/SuperAdminTenantDetailPage'
import SuperAdminDemoRequestsPage from './pages/superadmin/SuperAdminDemoRequestsPage'
import SuperAdminHealthPage from './pages/superadmin/SuperAdminHealthPage'
import SuperAdminErrorLogsPage from './pages/superadmin/SuperAdminErrorLogsPage'
import SuperAdminAuditLogsPage from './pages/superadmin/SuperAdminAuditLogsPage'
import SuperAdminSubscriptionsPage from './pages/superadmin/SuperAdminSubscriptionsPage'
import SuperAdminSettingsPage from './pages/superadmin/SuperAdminSettingsPage'
import SubscriptionPlansPage from './pages/company/SubscriptionPlansPage'
import BranchesPage from './pages/company/BranchesPage'
import BranchDetailPage from './pages/company/BranchDetailPage'
import RoutesPage from './pages/company/RoutesPage'
import RouteDetailPage from './pages/company/RouteDetailPage'
import SignupPage from './pages/SignupPage'
import OnboardingWizard from './pages/OnboardingWizard'
import ErrorPage from './pages/ErrorPage'
import HelpPage from './pages/HelpPage'
import FeedbackPage from './pages/FeedbackPage'
import UpdatesPage from './pages/company/UpdatesPage'
import Layout from './components/Layout'
import SuperAdminLayout from './components/SuperAdminLayout'
import ConnectionStatus from './components/ConnectionStatus'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  const { user, loading } = useAuth()
  const location = useLocation()

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

  // Show signup/login pages for public routes
  if (isPublicRoute) {
    return (
      <ErrorBoundary>
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

  // CRITICAL: Redirect root based on role
  const getRootPath = () => {
    if (userIsSystemAdmin) return '/superadmin/dashboard'
    return '/dashboard'
  }

  return (
    <ErrorBoundary>
      <ConnectionStatus />
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
            <Route path="/superadmin/subscriptions" element={<SuperAdminSubscriptionsPage />} />
            <Route path="/superadmin/settings" element={<SuperAdminSettingsPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
          </Route>
        )}

        {/* Tenant routes - Accessible to standard users OR impersonating SystemAdmin */}
        {(!userIsSystemAdmin || !!localStorage.getItem('selected_tenant_id')) && (
          <>
            {/* Dashboard has its own layout */}
            <Route path="/dashboard" element={<Dashboard />} />
            {/* All other pages use Layout with sidebar */}
            <Route element={<Layout />}>
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/pricelist" element={<PriceList />} />
              <Route path="/purchases" element={<PurchasesPage />} />
              <Route path="/pos" element={<PosPage />} />
              <Route path="/ledger" element={<CustomerLedgerPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/sales-ledger" element={<SalesLedgerPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reports/outstanding" element={<ReportsPage />} />
              <Route path="/branches" element={<BranchesPage />} />
              <Route path="/branches/:id" element={<BranchDetailPage />} />
              <Route path="/routes" element={<RoutesPage />} />
              <Route path="/routes/:id" element={<RouteDetailPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/backup" element={<BackupPage />} />
              <Route path="/import" element={<DataImportPage />} />
              <Route path="/import/sales-ledger" element={<SalesLedgerImportPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/subscription" element={<SubscriptionPlansPage />} />
              <Route path="/updates" element={<UpdatesPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/feedback" element={<FeedbackPage />} />
            </Route>
          </>
        )}

        {/* Redirect SystemAdmin trying to access tenant routes WITHOUT impersonation */}
        {userIsSystemAdmin && !localStorage.getItem('selected_tenant_id') && (
          <>
            <Route path="/dashboard" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/products" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/pos" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/ledger" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/expenses" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/purchases" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/reports" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/branches" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/routes" element={<Navigate to="/superadmin/dashboard" replace />} />
          </>
        )}

        <Route path="*" element={<ErrorPage />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
