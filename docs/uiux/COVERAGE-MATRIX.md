# UX coverage matrix (route level)

Generated 2026-10-10 from `frontend/hexabill-ui/src/app/App.jsx` (62 unique `path=` values, including `*` and `/`). Counts are source counts. Status is per route and means what was verified, not what was attempted.

**Status legend**
- `VERIFIED-LOCAL`: a Playwright or unit test in this repo exercises the route's main interaction on synthetic data.
- `SWEEP-ONLY`: only the presence and overflow sweep in `e2e/route-sweep.spec.js` covers it.
- `NOT-VERIFIED`: nothing covers it yet.

Nested tabs, subtabs, forms, modals, drawers and sheets per route are **not yet inventoried** (see the open task list at the end). Totals for those are therefore not reported.

## Route totals

| Group | Routes | Status |
|---|---|---|
| Public (`/login`, `/signup`, `/Admin26`, `/onboarding`, `*`) | 5 | see table |
| Tenant app | 43 | see table |
| SuperAdmin | 10 | see table |
| Shared (`/help`, `/feedback`, `/profile`, `/more`) | 4 | see table |
| Redirect-only (`/`, `/recurring-invoices`) | 2 | n/a |

## Route matrix

| Route | Component (file) | Module | Status | Evidence / gap |
|---|---|---|---|---|
| `/login` | `auth/Login.jsx` | Auth | VERIFIED-LOCAL | `service-availability.spec.js` (login 503 path); `workflows.spec.js` tenant branding |
| `/signup` | `pages/SignupPage` | Auth | NOT-VERIFIED | |
| `/Admin26` | `auth/Login` (SuperAdmin mode) | Auth | NOT-VERIFIED | |
| `/onboarding` | `pages/OnboardingWizard.jsx` | Auth | NOT-VERIFIED | |
| `/dashboard` | `features/dashboard/DashboardTally.jsx` | Dashboard | SWEEP-ONLY | route-sweep only |
| `/pos` | `features/sales/pos/PosEnterprisePage.jsx` | Sales/POS | SWEEP-ONLY | `ux-audit` measures layout; no save test |
| `/billing-history` | `features/sales/BillingHistoryPage.jsx` | Sales | VERIFIED-LOCAL | `billing-history.spec.js` (rows, search, pagination, date range) |
| `/sales-ledger` | `features/sales/SalesLedgerPage.jsx` | Sales | SWEEP-ONLY | |
| `/returns/create` | `features/returns/ReturnCreatePage.jsx` | Sales | NOT-VERIFIED | |
| `/delivery-notes` | `features/sales/DeliveryNotesPage.jsx` | Sales | SWEEP-ONLY | |
| `/delivery-notes/:saleId` | `features/sales/DeliveryNoteViewPage.jsx` | Sales | NOT-VERIFIED | |
| `/customers` | `features/customers/CustomersPage.jsx` | Customers | VERIFIED-LOCAL | `workflows.spec.js` UX-1 (create); `ux-audit` layout |
| `/customers/:id` | `features/customers/CustomerDetailPage.jsx` | Customers | NOT-VERIFIED | |
| `/ledger` | `features/customers/CustomerLedgerPage.jsx` | Customers | VERIFIED-LOCAL | `customers-ledger.spec.js` (picker, Pay all, menu, payment dialog) |
| `/suppliers` | `features/purchases/SuppliersPage.jsx` | Purchases | SWEEP-ONLY | |
| `/suppliers/:name` | `features/purchases/SupplierDetailPage.jsx` | Purchases | NOT-VERIFIED | |
| `/purchases` | `features/purchases/PurchasesPage.jsx` | Purchases | SWEEP-ONLY | |
| `/expenses` | `features/expenses/ExpensesPage.jsx` | Expenses | VERIFIED-LOCAL | `expenses-crud.spec.js` (create, refresh, edit, delete via API) |
| `/payments` | `features/payments/PaymentsPage.jsx` | Payments | SWEEP-ONLY | staff-gated (`canManagePayments`) |
| `/daily-close` | `features/dailyClose/DailyClosePage.jsx` | Daily close | SWEEP-ONLY | |
| `/products` | `features/products/ProductsPage.jsx` | Inventory | SWEEP-ONLY | |
| `/products/:id` | `features/products/ProductDetailPage.jsx` | Inventory | NOT-VERIFIED | |
| `/pricelist` | `features/products/PriceList.jsx` | Inventory | NOT-VERIFIED | |
| `/stock-adjustments` | `features/inventory/StockAdjustmentsHistoryPage.jsx` | Inventory | NOT-VERIFIED | |
| `/routes` | `features/branches/RoutesPage` | Routes | NOT-VERIFIED | owner/admin only |
| `/routes/:id` | `features/branches/RouteDetailPage.jsx` | Routes | NOT-VERIFIED | |
| `/branches` | `features/branches/BranchesPage.jsx` | Settings | NOT-VERIFIED | owner/admin only |
| `/branches/:id` | `features/branches/BranchDetailPage.jsx` | Settings | NOT-VERIFIED | |
| `/reports` | `features/reports/ReportsPage.jsx` | Reports | SWEEP-ONLY | |
| `/reports/outstanding` | `features/reports/ReportsPage.jsx` | Reports | NOT-VERIFIED | |
| `/vat-return` | `features/reports/VatReturnPage.jsx` | VAT | NOT-VERIFIED | accountant-review items stay as-is |
| `/worksheet` | `features/reports/WorksheetPage.jsx` | Reports | NOT-VERIFIED | |
| `/quotations` | `features/documents/QuotationsPage` | Documents | NOT-VERIFIED | |
| `/quotations/new` | `features/documents/QuotationEditorPage.jsx` | Documents | NOT-VERIFIED | |
| `/quotations/:id` | `features/documents/QuotationEditorPage.jsx` | Documents | NOT-VERIFIED | |
| `/agreements` | `features/documents/AgreementsPage` | Documents | NOT-VERIFIED | |
| `/agreements/new` | `features/documents/AgreementEditorPage.jsx` | Documents | NOT-VERIFIED | |
| `/agreements/:id` | `features/documents/AgreementEditorPage.jsx` | Documents | NOT-VERIFIED | |
| `/salary-certificates` | `features/documents/SalaryCertificatesPage` | Documents | NOT-VERIFIED | |
| `/salary-certificates/new` | `features/documents/SalaryCertificateEditorPage.jsx` | Documents | NOT-VERIFIED | |
| `/salary-certificates/:id` | `features/documents/SalaryCertificateEditorPage.jsx` | Documents | NOT-VERIFIED | |
| `/users` | `pages/company/UsersPage.jsx` | Staff | NOT-VERIFIED | |
| `/settings` | `features/settings/SettingsPage.jsx` | Settings | NOT-VERIFIED | |
| `/audit` | `pages/company/AuditLogPage.jsx` | Settings | NOT-VERIFIED | |
| `/backup` | `pages/company/BackupPage.jsx` | Settings | NOT-VERIFIED | |
| `/profile` | `pages/company/ProfilePage.jsx` | Account | NOT-VERIFIED | |
| `/help` | `pages/HelpPage` | Shared | NOT-VERIFIED | |
| `/feedback` | `pages/FeedbackPage` | Shared | NOT-VERIFIED | |
| `/more` | `pages/MorePage` | Navigation | NOT-VERIFIED | |
| `/superadmin/dashboard` | `platform/SuperAdminDashboard.jsx` | SuperAdmin | NOT-VERIFIED | |
| `/superadmin/tenants` | `platform/SuperAdminTenantsPage.jsx` | SuperAdmin | NOT-VERIFIED | |
| `/superadmin/tenants/:id` | `platform/SuperAdminTenantDetailPage.jsx` | SuperAdmin | NOT-VERIFIED | |
| `/superadmin/demo-requests` | `platform/SuperAdminDemoRequestsPage.jsx` | SuperAdmin | NOT-VERIFIED | |
| `/superadmin/health` | `platform/SuperAdminHealthPage.jsx` | SuperAdmin | NOT-VERIFIED | |
| `/superadmin/error-logs` | `platform/SuperAdminErrorLogsPage.jsx` | SuperAdmin | NOT-VERIFIED | |
| `/superadmin/audit-logs` | `platform/SuperAdminAuditLogsPage.jsx` | SuperAdmin | NOT-VERIFIED | |
| `/superadmin/settings` | `platform/SuperAdminSettingsPage.jsx` | SuperAdmin | NOT-VERIFIED | |
| `/superadmin/search` | `platform/SuperAdminGlobalSearchPage.jsx` | SuperAdmin | NOT-VERIFIED | |
| `/superadmin/sql-console` | `platform/SuperAdminSqlConsolePage.jsx` | SuperAdmin | NOT-VERIFIED | high-risk; keep out of UX scope unless approved |
| `/` | redirect to `getRootPath()` | n/a | n/a | role-based landing |
| `*` | `components/ErrorPage` | Shared | NOT-VERIFIED | |
| `/recurring-invoices` | redirect | n/a | n/a | |

## Totals (route level, this revision)

| Status | Count |
|---|---|
| VERIFIED-LOCAL | 5 |
| SWEEP-ONLY | 10 |
| NOT-VERIFIED | 45 |
| Redirect / n/a (`/`, `/recurring-invoices`) | 2 |
| **Total unique paths** | **62** |

Redirect-only and role-gated redirects (`/branches`, `/routes`, `/payments`, and SuperAdmin-impersonation redirects for tenant routes) are counted once in the table above.

## Open work, in order

1. Inventory nested tabs, subtabs, forms, modals, drawers and sheets for the 5 VERIFIED-LOCAL routes and the Expenses, Customers and Billing History pages. Record them in this file.
2. Expenses UX-E01 (first record at 51% @360, target 35%).
3. Purchases (`/purchases`, `/suppliers`, `/suppliers/:name`): create, edit, delete, VAT, payment, filters, mobile.
4. POS (`/pos`): product search, quantity, price, discount, payment, save, print. Requires a save test against the synthetic database.
5. Payments, Daily close, Inventory and Products, Routes, VAT, Reports, Documents, Settings and Staff, in the order of the master plan M5–M8.
6. SuperAdmin (M9) and AI/PWA (M10). Record the features that have no backend as BLOCKED or planned, not as working.
7. Multi-tenant and role runs (owner, staff, disabled account, wrong password, cross-tenant rejection) across the synthetic tenants.
8. Full regression across the required widths (M11).
