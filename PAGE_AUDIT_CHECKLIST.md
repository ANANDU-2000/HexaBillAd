# Page and API Audit Checklist

Used to track the production DB alignment and enterprise SaaS rules audit (forms, filters, buttons, APIs, role/tenant, try/catch).

## Super Admin (10 pages)

| Page | APIs | Role/tenant | Try/catch backend | Forms/filters | Buttons | Notes |
|------|------|-------------|-------------------|---------------|---------|-------|
| SuperAdminDashboard | platform health, stats | SystemAdmin | Yes | N/A | Refresh | OK |
| SuperAdminTenantsPage | getTenants, create, update, delete, bulk | SystemAdmin | Yes | Create form, search, status filter | Create, Edit, Delete, Bulk extend/announce | Clipboard .catch() added |
| SuperAdminTenantDetailPage | tenant by id, limits, metrics | SystemAdmin | Yes | Tabs, filters | Actions | OK |
| SuperAdminDemoRequestsPage | demo requests | SystemAdmin | Yes | Status filter | Approve/Reject | OK |
| SuperAdminHealthPage | health, metrics | SystemAdmin | Yes | N/A | Refresh | OK |
| SuperAdminErrorLogsPage | error logs | SystemAdmin | Yes | Filters | Resolve | OK |
| SuperAdminAuditLogsPage | audit logs | SystemAdmin | Yes | Filters | Export | OK |
| SuperAdminSettingsPage | platform settings | SystemAdmin | Yes | Form fields | Save | OK |
| SuperAdminGlobalSearchPage | global search | SystemAdmin | Yes | Search | N/A | OK |
| SuperAdminSqlConsolePage | run SQL (read-only) | SystemAdmin | Yes | Query input | Run | OK |

## Company – Owner/Staff (25 pages)

| Page | APIs | Tenant isolation | Role (Owner vs Staff) | Forms/filters | Notes |
|------|------|------------------|------------------------|---------------|-------|
| Dashboard (DashboardTally) | reports summary | Yes | canShow, isAdminOrOwner | Date, branch | TDZ fix: helpers moved above; logout before useEffect in useAuth |
| ProductsPage | products CRUD, categories, image | Yes | Staff: no Import/Reset/Edit delete | Search, tab, form | handleUpdateProduct passes imageFile |
| ExpensesPage | expenses CRUD | Yes | Staff scoped to assignments | Date, branch/route, form | Eye imported; handleDownloadAttachment(expense) |
| ReportsPage | reports APIs | Yes | Admin-only tabs | Date, branch, route, tabs | OK |
| CustomerLedgerPage | ledger, customers, payments | Yes | Staff: assigned branches/routes | Date, branch, route, staff | OK |
| SalesLedgerPage | sales ledger | Yes | Staff scoped | Date, branch, route, staff | OK |
| PosPage | sales, products, customers | Yes | Staff: assignments | Branch, route | OK |
| CustomersPage | customers CRUD | Yes | Backend scopes | Search, tab, form | OK |
| UsersPage | users CRUD | Yes | Owner/Admin | Form, filters | OK |
| BranchesPage, BranchDetailPage | branches CRUD | Yes | Staff redirect | Forms | OK |
| RoutesPage, RouteDetailPage | routes CRUD | Yes | Staff redirect | Forms | OK |
| SettingsPage | settings | Yes | Admin/Owner | Form | Settings.Value migration |
| BackupPage | backup/restore | Yes | Admin/Owner | Actions | OK |
| Others (Profile, Payments, Help, Feedback, Onboarding, etc.) | various | Yes | Per endpoint | Per page | OK |

## Backend

- **Settings**: `Setting.Value` mapped to column `"Value"`; migration `EnsureSettingsValueColumnPascalCase` renames `value` → `"Value"` if present on production.
- **Super Admin controllers**: Role check (IsSystemAdmin / Policy), try/catch, logging in place.
- **Tenant isolation**: TenantScopedController / CurrentTenantId / OwnerId used on tenant-scoped endpoints.

## Known non-app errors

- **"message channel closed"** in console: from browser extensions; no app fix (see PRODUCTION_DB_ALIGNMENT.md).
