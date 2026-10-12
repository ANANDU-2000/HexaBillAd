# HexaBill UX and verification: pending work

Written 2026-10-11 from `docs/uiux/PREMIUM-UX-TRACKER.md` (one row per item, with a status) and `docs/plan/AI-ERP-TASK-TRACKER.md` (session log, "Next task" line per checkpoint). The IDs below are the row IDs in the UX tracker.

Done so far: 102 files changed against `main` (60 commits on branch `uiux-audit-p1`). Backend tests 729 passed, 52 skipped. Frontend unit tests 147 passed.

## 1. Waiting for you (decisions only the owner can make)

| ID | Sev | What is open | Options |
|---|---|---|---|
| ST-01 | P1 | A staff member who has made sales cannot be removed or disabled. There is no "disable" control. | Decide: when an account is disabled, are existing sessions ended at once, or only new sign-ins refused? Who may disable whom? |
| AG-02 | P1 | Historical aging (past as-of date) counts invoices dated after that date, and uses today's payment status. | Minimum fix: skip invoices dated after the as-of date. Bigger fix: rebuild balances from payments up to that date. |
| RP-04 | P1 | A staff login can read company purchases, expenses, supplier balances and AP aging through the API, although the screens hide them. | List which reports and lists staff may read; then the API enforces it. |
| PY-09 | P3 | Any signed-in user can create a payment through the API (edit and delete are Admin/Owner only). | Confirm it is intended (counter collections) or restrict it. |
| PS-05 | P2 | A fresh POS defaults to Cash; after "New invoice" it defaults to Credit. A named customer plus Save Invoice on a fresh POS records a full cash payment. | Pick one default, or default by customer (walk-in = Cash, named customer = Credit). |
| RC-04 | P2 | Tenants without the `receipt_snapshots` flag get no saved receipt PDF (only Print). | Decide whether every tenant gets snapshots. |
| UX-E01 | P1 | On a phone the first expense is at 48% of the screen (target 35%). | Keep the totals card visible (48%), or move it behind Filters (about 35%). |
| AG-03 | P2 | Customer Aging "Export Excel" only shows "coming soon". | Build the export, or hide the button. |
| UX-S04 | P2 | 948 plain buttons in 98 files, only about 100 uses of shared button components. | Migrate module by module when each is next edited (recommended), or one big migration (risky). |

## 2. Blocked by the environment

| ID | What | Needed |
|---|---|---|
| RC-06 | 52 backend tests that need PostgreSQL are skipped (including tenant isolation over HTTP and receipt PDF on PostgreSQL). | A disposable local PostgreSQL. The outstanding-report ordering fix (OUT-01) also was not run on PostgreSQL. |
| Push | Branch `uiux-audit-p1` is not on GitHub `main` yet. | You sign in to GitHub and run the push. |

## 3. Work I can do next (no decision needed)

### 3a. Modules not audited yet
- Routes and Branches (create route, assign customers, deliveries, maps)
- Inventory pages: price list, product categories, barcode print, import, unit conversion
- Dashboard cards against the API
- SuperAdmin pages
- PWA: install, offline behaviour
- AI assistant, voice, provider settings, global search, quick create, customer price memory (the backend for most of this does not exist yet; it must not be faked)

### 3b. Rows marked NOT TESTED
- PS-03: POS discounts, quantity changes, payment split, returns, hold and resume, invoice print, phone credit-sale checkout
- ST-04: edit user, reset password, permissions, branch and route assignment, activity log
- SE-03: other Settings tabs, Arabic company name round trip, logo upload, invoice header style
- BP-05: bulk payments with cheque and online rows, invoice-linked rows, resume after reload
- RC-05: Print receipt window, receipt history on the ledger, receipts without the snapshot flag
- AU-02: expired token (not just invalid), password change, permission change
- AG-04: aging filters and drill-down
- RP-03: Reports branch and route filters, PDF export, and the other tabs (Product Analysis, Net sales, Returns, Overdue, Collections, Credit notes, Expenses, Branch, Route, Branch P&L, Damage, Staff, Cheque, P&L)
- VR-02: VAT figures on Reports pages, Print / PDF button, VAT Tracking
- OUT-02: credit-limit percentage and colours, phone layout, more than 100 outstanding customers
- PR-03: unit conversion, barcode print, categories, import, pagination, price list, Arabic names

### 3c. Rows marked PARTIAL (the label is older than some of the work under it)
- DC-06 Daily close: recent closes details and report links, variance reason saved with a close, closed-day notice on a phone
- PY-06 Payments: allocation across several invoices, receipt print, row density with two or more receipts
- PU-10 Purchases: pay flow end to end
- PU-01 Purchases: confirm the phone filter block is collapsed and tidy
- SU-07 Suppliers: Bills and Paid tabs, credit limit

### 3d. Housekeeping
- CU-02, UX-T04, BP-04: test data piles up on the local tenant (test customers, deactivated test suppliers, balances paid down). Add one shared cleanup.
- RP-02: rename the API fields `salesToday`, `purchasesToday`, `expensesToday`, `profitToday` (they sum the selected range). Naming only.
- Same "decimal ORDER BY" pattern remains in `CustomerService.cs` (balance sort) and `ReportService.cs` (about line 1512). Not checked.

### 3e. Re-checks I still owe
- Re-run the `frozenhub1` route sweep after its 15-minute sign-in lockout ends.
- Run the whole browser suite at 360, 768 and 1024 (only 1440 was run in full).
- Run the "controls past the screen edge" sweep on more pages (Billing History, Dashboard, Reports tabs, Purchases form).
