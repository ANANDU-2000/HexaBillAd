# T4 bug hunt 2 (2026-11-08)

Database: hexabill_codex_browser_loopb_20261108 (synthetic). Specs: frontend/hexabill-ui/e2e/bughunt/ (driver-route, suppliers-expenses-stock, ui-hunt2, admin-sweep).
Format: BUG-n | feature | severity | repro | failing test | suspected file:line
Numbering starts at BUG-30 (hunt 1 used BUG-8/9).

## Bugs (14, all reproduced by a failing test)

- BUG-30 | Suppliers | S2 | POST /api/suppliers with a 500-char name returns 500 (database length error), not 4xx | suppliers-expenses-stock.spec.js "BUG-30" | Modules/Purchases/SuppliersController.cs:134 (CreateSupplier validates only empty name and credit limit; no length check)
- BUG-31 | Suppliers | S1 money | POST /api/suppliers/{name}/payments accepts AED 1,000,000,000,000 against a supplier with zero balance (200) | "BUG-31" | SuppliersController.cs:316 (RecordPayment checks only Amount > 0, no cap, no balance check)
- BUG-32 | Expenses | S1 money | POST /api/expenses accepts amount 0 and -5 (201); negative expenses reduce reported spend | "BUG-32" | Modules/Expenses/ExpenseService.cs:440-475; CreateExpenseRequest Amount has [Required] only (Models/DTOs.cs:715)
- BUG-33 | Expenses | S1 money | POST /api/expenses accepts amount 1e12 (201) | "BUG-33" | Models/DTOs.cs:715 (no [Range])
- BUG-34 | Expenses | S2 | POST /api/expenses with a 5000-char note returns 500 instead of 4xx | "BUG-34" | Models/DTOs.cs:~718 (Note has no [MaxLength]); Expense.Note column length
- BUG-35 | Expenses | S1 money | Two POST /api/expenses with the same Idempotency-Key both return 201 and create two expenses (the header is not honoured for expenses) | "BUG-35" | Modules/Expenses/ExpensesController.cs:321-346 (no idempotency handling, unlike PaymentsController.CreatePayment)
- BUG-36 | Stock adjustments | S2 | POST /api/stockadjustments newStock 1e12 accepted (200) | "BUG-36" | Modules/Inventory/StockAdjustmentService.cs:159 (CreateStockAdjustmentRequest has no bound)
- BUG-37 | Stock adjustments | S3 | Setting stock to the value it already has (10 -> 10) writes an adjustment row with old == new (phantom movement in the log) | "BUG-37" | StockAdjustmentService.cs (CreateAdjustmentAsync, no no-op guard)
- BUG-38 | Driver / Customers | S1 isolation | Driver assigned to route A reads customer of route B via GET /api/customers/{id} (200). Customer detail is tenant-scoped only (CustomersController.cs:129-164, ResolveCustomerTenantAsync). Verify intended Staff scope before fixing; visits and stops of route B are correctly refused | "BUG-38" | Modules/Customers/CustomersController.cs:134 (ResolveCustomerTenantAsync)
- BUG-39 | Dashboard / Driver | S2 | Driver's /api/reports/summary shows tenant-wide pendingBills (20) although the driver has no sales on route A. ReportService.cs:430-455 ignores route and staff scope | "BUG-39" | Modules/Reports/ReportService.cs:441-455
- BUG-40 | Driver visits | S2 | POST /api/routes/{id}/visits accepts latitude 999 and longitude -500 (200); would place stops on the route map at impossible coordinates | "BUG-40" | Modules/Branches/CustomerVisitsController.cs:26; UpdateVisitStatusRequest (Models/DTOs.cs:1148) has no range check
- BUG-41 | Driver visits | S1 money | POST visit with status PaymentCollected and paymentCollected -50 or 1e12 is accepted (200); collected cash is recorded | "BUG-41" | Models/DTOs.cs:1154 (PaymentCollected no range); RouteService.UpdateCustomerVisitAsync
- BUG-42 | Products (two tabs) | S1 data | Tab 1 saves sellPrice 30; tab 2, still holding the stale form with price 15, saves its own PUT (200) and the price goes back to 15. No conflict or version check. The same class is likely for every edit form | "BUG-42" | ProductsController.cs:342 (PUT has no RowVersion/UpdatedAt check); frontend ProductsPage edit form. Screenshot: docs/uiux/evidence/2026-11-08/hunt2/bughunt-ui-hunt2-BUG-42-*.png
- BUG-43 | Products form | S3 | Refreshing the page with typed data in the Add Product form gives no beforeunload warning; the typed data is lost silently. Only QuotationEditorPage and AgreementEditorPage register beforeunload | "BUG-43" | frontend src/features/products/ (form), compare src/features/documents/QuotationEditorPage.jsx:214. Screenshot in hunt2/.
- BUG-44 | POS (slow network) | S3 perf | On a 400 kbps / 400 ms latency profile /pos takes 56.9 s to reach network idle (limit set 45 s); /payments and /products pass. Needs bundle/request review (possibly polling) before fixing | "BUG-44" | frontend (POS route bundle); measure with the test annotation slow3g. Screenshot in hunt2/.

## Checked and passing (regression tests)
- Driver: route list shows only the assigned route; cannot log a visit for another route's customer; arrival and repeat arrival OK; Failed/Skipped without note refused; 5000-char visit note refused; driver cannot move the saved shop pin or reorder stops; no users/settings/reports-admin leak beyond BUG-39.
- Admin sweep (21 pages x 4 widths, role Admin): no page errors, no 4xx/5xx, no sideways scroll, no control past the edge, no junk text on dashboard, billing history, sales ledger, customer ledger, VAT return, reports, expenses, suppliers, stock adjustments, delivery notes, quotations, agreements, salary certificates, branches, users, settings, backup, audit, pricelist. Redirects /worksheet (owner-only) and /routes (alias of /branches) are by design.
- Suppliers: names with / # ? % emoji Arabic and dots create, read, edit, statement and delete; case-insensitive duplicate refused; zero and negative payment refused; negative credit limit refused.
- Expenses: unknown category refused; 3-decimal amount stored at 2dp.
- Stock adjustments: unknown product refused.
- Two tabs (customer) and related: removed after the first run, see harness note.
- Back during in-flight product save: no page errors and no duplicate product (test asserts only no duplicate and no blank page; whether the in-flight save completed is inconclusive because a full-document back navigation cancels the POST).
- Command palette: Ctrl+K opens, filters, Enter navigates, Escape closes, works from inside a search field.
- Lazy page chunk failure (aborted route) shows a recovery message.

## Not covered / blocked
- Customer two-tab conflict: the test harness could not reliably open the customer row menu in tab 2 (search box race). Re-try once the customer list has a stable selector; not reported as a bug.
- Billing History, Sales Ledger, Customer Ledger, VAT return, Reports, Delivery notes, Quotations, Branches/Routes, Users/roles, Settings/print, Backup: UI sweep only (admin-sweep.spec.js) for layout and errors; no edge-input API tests in hunt 2.
- Render logs: blocked in hunt 1 (owner API key needed); no change.

## Harness notes
- The synthetic seed refuses password rotation when extra users or a non-empty FeaturesJson exist. Specs that create users or set flags clean up in afterAll.
- The earlier "BUG-44/45/46" labels were removed: they were test-design problems (an early-paint check that a SPA cannot meet on 400 kbps, and a failing browser-back assertion that cannot tell cancelled from unsaved). Only real findings keep a BUG number.
- A local unlimited plan row exists in my database only (SubscriptionPlans + Subscriptions for tenant 1).
