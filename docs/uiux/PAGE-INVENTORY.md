# Page Inventory

Source of truth is `frontend/hexabill-ui/src/app/App.jsx`. Counts below were taken from the code on 2026-10-10 (branch `uiux-premium`).
The per-page responsive spec lives in [../plan/PAGE-SPECIFICATION.md](../plan/PAGE-SPECIFICATION.md). Per-route evidence history is in [../plan/UX-ROUTE-MATRIX.md](../plan/UX-ROUTE-MATRIX.md).

## Counts

| Item | Count | How it was counted |
|---|---|---|
| Unique route paths | 62 | `path=` entries in App.jsx, including `*` |
| Rendered tenant routes | 45 | 46 tenant paths minus the `/recurring-invoices` redirect |
| SuperAdmin routes | 10 (+ `/help` and `/feedback`, which are shared) | `/superadmin/*` |
| Public routes | 3 | `/signup`, `/login`, `/Admin26` |
| Main pages (top-level list or dashboard screens) | 32 | Routes with no `:param`, `/new` or sub-path |
| Subpages (detail, editor, sub-report) | 13 | `:id`, `:name`, `:saleId`, `/new`, `/reports/outstanding` |
| Files containing tables | 43 | `grep -l "<table"` in `src` |
| Form files (submit handlers) | 25 | `onSubmit` / `handleSubmit` |
| Files with modals or dialogs | 39 | 10 `*Modal` components, 2 drawers, 3 sheets, 21 hand-rolled `fixed inset-0` overlays |
| Print views with real print logic | 10 | `window.print`, print iframe, or `@media print` |

## Shell and shared dependencies

| Area | Component |
|---|---|
| Tenant shell | `components/Layout.jsx` (sidebar, top bar, mobile bar), `BottomNav.jsx`, `mobile/MoreMenuSheet.jsx` |
| Navigation catalog | `navigation/moreMenuConfig.js` (sidebar, `/more` and the More sheet all read it) |
| Platform shell | `components/SuperAdminLayout.jsx` |
| Global search | `components/CommandPalette.jsx` (Ctrl/Cmd+K) |
| Branding | `tenant/TenantBrandingContext.jsx`, `tenant/tenantHost.js`, `components/Logo.jsx` |
| Primitives | `components/Modal.jsx`, `components/Form.jsx`, `components/ConfirmDangerModal.jsx`, `components/ui/*` |

## Tenant routes

Roles: **All** means any tenant user who has page access. **A/O** means Admin or Owner. **O** means Owner only. **Pay** means `canManagePayments`.

| Route | Component | Roles | Module |
|---|---|---|---|
| /dashboard | features/dashboard/DashboardTally | All | A |
| /pos | features/sales/PosPage → PosEnterprisePage / PosPageLegacy | pos | B |
| /billing-history | features/sales/BillingHistoryPage | pos | B |
| /sales-ledger | features/sales/SalesLedgerPage | reports | B |
| /returns/create | features/returns/ReturnCreatePage | All | B |
| /delivery-notes, /delivery-notes/:saleId | features/sales/DeliveryNotes*, DeliveryNoteViewPage | All | B |
| /ledger | features/customers/CustomerLedgerPage | invoices | C |
| /customers, /customers/:id | features/customers/CustomersPage, CustomerDetailPage | customers | C |
| /payments | features/payments/PaymentsPage | Pay | C |
| /products, /products/:id | features/products/ProductsPage, ProductDetailPage | products | D |
| /stock-adjustments | features/inventory/StockAdjustmentsHistoryPage | products | D |
| /pricelist | features/products/PriceList | products | D |
| /purchases | features/purchases/PurchasesPage | A/O | E |
| /suppliers, /suppliers/:name | features/purchases/SuppliersPage, SupplierDetailPage | A/O | E |
| /expenses | features/expenses/ExpensesPage | expenses | E |
| /reports, /reports/outstanding | features/reports/ReportsPage | reports | F |
| /daily-close | features/dailyClose/DailyClosePage | A/O | F |
| /vat-return | features/reports/VatReturnPage | A/O | F |
| /worksheet | features/reports/WorksheetPage | O | F |
| /quotations (+ /new, /:id) | features/documents/Quotation* | All | G |
| /agreements (+ /new, /:id) | features/documents/Agreement* | All | G |
| /salary-certificates (+ /new, /:id) | features/documents/SalaryCertificate* | All | G |
| /branches, /branches/:id, /routes, /routes/:id | features/branches/* | not Staff | G |
| /users | pages/company/UsersPage | A/O | H |
| /settings | features/settings/SettingsPage | A/O | H |
| /audit | pages/company/AuditLogPage | A/O | H |
| /backup | pages/company/BackupPage | A/O | H |
| /profile, /help, /feedback, /more | pages/company/*, pages/* | All | H |
| /onboarding | pages/OnboardingWizard | new Owner | H |

The module letters match the groups in [UI-TASK-TRACKER.md](UI-TASK-TRACKER.md). Test coverage for these routes is tracked in [RESPONSIVE-TESTS.md](RESPONSIVE-TESTS.md).
