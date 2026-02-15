# Consolidation, Terminology, Reports, Expenses & Owner – Plan

Single reference for: **Company vs Tenant wording**, **report filters (Branch/Route)**, **expenses by branch**, **where logic is wrong**, **duplicate code**, **Company Owner role & features**, and **build order**.

---

## 1. Terminology: Company vs Tenant

**Rule:** Use **"Company"** everywhere the **user** sees text (UI labels, table headers, buttons, messages). Use **"Tenant"** only in **code**, **API**, and **database** (entity name, variables, DB columns).

| Where | Use | Example |
|-------|-----|--------|
| **UI labels / tables** | Company | "Companies", "Company", "Company ID" (not "Tenants", "TenantId") |
| **Super Admin** | Company | Nav: "Companies"; table header "Company"; modals "Add Company" |
| **Audit / Error logs** | Company | Column "Company" (value = tenantId is OK internally) |
| **Code / API / DB** | Tenant | `tenantId`, `Tenant`, `getTenants`, table `Tenants` |

**What to do:**
- **Already done:** Audit logs table column "Company"; Super Admin nav "Companies"; Companies page title.
- **Check and fix:** Any remaining user-facing "Tenant" or "TenantId":
  - Super Admin Error Logs: table header "TenantId" → **"Company"** (keep value as ID).
  - Super Admin Demo Requests: "Create Tenant" button → **"Create Company"**; "Tenant #id" → **"Company #id"**.
  - Super Admin Tenant Detail: "Edit Tenant" → **"Edit Company"**; modal titles "Suspend Tenant" → **"Suspend Company"** (or keep "Company" in message: "suspend this company").
- **Leave as-is:** Variable names in code (`tenant`, `tenantId`), API paths (`/tenants`), DB table `Tenants`, `TenantBrandingContext` (internal). No need to rename these.

---

## 2. Reports Page: Branch & Route Filters + Totals

**Current state:**
- **Backend:** Summary, Sales, Sales Ledger (and possibly others) already accept `branchId` and `routeId` query params and filter correctly. Staff role is route-scoped.
- **Frontend:** Reports page has **no Branch or Route filters**. It has date range and tab-specific filters (product, customer, category, status). So backend branch/route capability is **unused**.

**Target:**
- Add **Branch** and **Route** as **side (or top) filters** on Reports page.
  - Branch: dropdown (All Branches + list from `branchesAPI.getBranches()`).
  - Route: dropdown **filtered by selected Branch** (All Routes when no branch, else routes of that branch via `routesAPI.getRoutes(branchId)`).
- Pass `branchId` and `routeId` in **every** report API call that supports them (summary, sales, sales-ledger, etc.).
- **Totals:** Where a report shows totals (e.g. Summary, Sales, Expenses), keep showing **one total for current filter** (so when Branch/Route selected, total is for that branch/route). No need for "total of all" when filtered unless you add a separate "Company total" line.
- **Reduce clutter:** Group filters into:
  - **Date** (from / to)
  - **Branch & Route** (one row: Branch dropdown, then Route dropdown)
  - **Other** (product, customer, category, status) only on tabs that need them. Avoid too many filter rows; use one compact row for Branch + Route.

**Bad logic today:** Backend is correct; **UI does not send branch/route**, so all reports are effectively company-wide only. Fix = add Branch/Route dropdowns and pass to API.

---

## 3. Expenses by Branch (Extract Each Branch’s Expenses)

**Current state:**
- **Expense** table: company-level only (TenantId, CategoryId, Amount, Date, Note). **No BranchId.**
- **RouteExpense** table: per-route expenses (Fuel, Staff, Delivery, Misc). Already exists.

**Target:**
- **Option A (recommended):** Add **BranchId (nullable)** to **Expense**. Null = company-level expense; set = expense assigned to that branch. Migration + backfill null for existing rows.
- **Option B:** New table **BranchExpense** (BranchId, Amount, Date, Category/Note, etc.). More tables, more reports to merge.
- **Report:** "Expenses by branch":
  - Backend: expense list/summary API filter by `branchId`; aggregate by branch when no branch filter (e.g. total per branch).
  - Frontend: On Expenses tab (or separate "Expenses by branch" view): Branch filter; totals per branch; optionally "Company total" and "Branch breakdown" in same report.

**Bad logic today:** You cannot attribute company-level **Expense** to a branch. Route expenses are already per-route (and route belongs to branch). So only **company-level** vs **branch-level** is missing; adding Expense.BranchId fixes it.

---

## 4. Where Logic Is Wrong vs Better Flow

| Area | Bad / Missing | Better flow |
|------|----------------|------------|
| **Reports** | Branch/Route not in UI; all reports company-wide in practice | Add Branch + Route filters; pass to API; totals reflect selection. |
| **Expenses** | No branch; cannot report "each branch expenses" | Add Expense.BranchId; report "Expenses by branch" and per-branch totals. |
| **Customer** | No BranchId/RouteId on Customer; only RouteCustomer M:M | Add BranchId + RouteId on Customer for primary assignment; create customer with Branch → Route (route filtered by branch). See BRANCH_ROUTE_ENTERPRISE_PLAN. |
| **POS** | Staff can pick any branch/route | Staff locked to assigned route; auto-set BranchId/RouteId. Owner can override. |
| **Ledger** | No branch/route filter; possible NaN in pending | Add Branch/Route filters; fix NaN with Number/fallback (see BRANCH_ROUTE_ENTERPRISE_PLAN). |
| **Subscription / Tenant status** | "Paid but showing Trial" | Single source of truth: Subscription.Status; sync Tenant.Status; fix TrialExpiryCheckJob and any API that returns tenant status. |

---

## 5. Duplicates: Why They Exist & Consolidate

### 5.1 Confirm / delete dialogs

- **Duplicate pattern:** Some pages use **DeleteConfirmModal** (type "DELETE"); many others use **window.confirm()** (browser default). Same function (confirm destructive action), two implementations.
- **Where:** window.confirm in: SettingsPage (delete/restore file), RouteDetailPage (delete expense), PurchasesPage, PosPage (success message), ExpensesPage, CustomersPage, CustomerLedgerPage, BillingHistoryPage, BackupPage, SuperAdminTenantDetailPage (delete user).
- **Consolidate:** Use **one** danger confirmation component everywhere:
  - Either extend **DeleteConfirmModal** to support optional "type DELETE" (for high-risk) and simple confirm/cancel (for lower risk), or create **ConfirmDangerModal** (title, message, Confirm/Cancel, optional requireTypedText).
  - Replace every **window.confirm** for delete/destructive action with this component. Same UX, one place to style and audit.

### 5.2 Same function: Admin vs Owner

- **Current:** `isAdminOrOwner(user)` and `canAccessAdminFeatures(user)` (alias) both mean "Admin or Owner or SystemAdmin". So **Owner** and **Admin** get the **same** access in the app (Branches, Routes, Users, Settings, Backup, Reports, etc.). No duplicate logic; just one permission layer.
- **Owner vs Admin:** In many products, **Owner** = company owner (billing, subscription, one per company); **Admin** = can be multiple, full access but maybe not billing. Right now we do not distinguish in code. If you want Owner-only features (e.g. subscription, billing, "Company owner" label), use **isOwner(user)** in those places and keep **isAdminOrOwner** for "can manage branches/routes/settings".

### 5.3 Other duplicates

- **Loading / fetch patterns:** Many pages have similar loading state + fetch + error handling. Optional: one small **useReportData** or **useFetch** hook for reports to reduce copy-paste; not critical.
- **TenantBrandingContext:** Used in many pages for `companyName`; that’s correct (single source of branding). No duplicate.

---

## 6. Company Owner: Who Is It & What to Add

**Who:** **Owner** = company owner. Typically the user who created the company (signup). One primary owner per company (role = Owner). **Admin** = can be multiple; same access as Owner in app today.

**What we have:** Owner and Admin both get full access (products, POS, ledger, branches, routes, users, settings, backup, reports) via **isAdminOrOwner**. No separate "Owner" UI or features.

**What would help owners (suggested):**
- **Label in UI:** In Users page and profile/sidebar: show "Owner" vs "Admin" so it’s clear who is the company owner.
- **Owner-only (optional):** Subscription/billing (only Owner can change plan or payment); "Company settings" that affect billing (e.g. company name for invoice) could be Owner-only. Today subscription page is available to any Admin.
- **Dashboard for owner:** Branch comparison (revenue/expense per branch), route profitability, top routes, outstanding by branch – so Owner sees business health at a glance. (Part of report layers in BRANCH_ROUTE_ENTERPRISE_PLAN.)
- **Audit:** Optionally log "Owner viewed X" for sensitive reports; not required for MVP.

**Conclusion:** Keep **isAdminOrOwner** for most features. Add **isOwner** only where you want Owner-only (e.g. subscription, billing). Add **Owner** label in Users and optionally in header/dropdown. Add **branch comparison and route profitability** to dashboard/reports to help owners; that’s the main "feature for owners" alongside clear naming.

---

## 7. Build Plan (Strict Order)

Do in this order so later steps don’t rework earlier ones.

| Phase | Task | Notes |
|-------|------|--------|
| **1. Terminology** | Replace remaining user-facing "Tenant" with "Company" | Error Logs header "TenantId" → "Company"; Demo "Create Tenant" → "Create Company"; Tenant Detail modals "Tenant" → "Company" in titles/messages. |
| **2. Reports: Branch/Route filters** | Add Branch + Route dropdowns to Reports page; pass branchId/routeId to all report APIs that support it | Fetch branches and routes (route by branch); one row Branch + Route; include in params for summary, sales, sales-ledger, etc. |
| **3. Expenses by branch** | Add Expense.BranchId (migration); API filter by branchId; "Expenses by branch" view/totals | Backend: migration, Expense update, list/summary by branch. Frontend: Expenses tab (or report) with Branch filter and per-branch totals. |
| **4. Replace confirm() with modal** | One ConfirmDangerModal (or extend DeleteConfirmModal); replace all window.confirm for delete/destructive actions | SettingsPage, RouteDetailPage, PurchasesPage, ExpensesPage, CustomersPage, CustomerLedgerPage, BillingHistoryPage, BackupPage, SuperAdminTenantDetailPage. |
| **5. Owner label + optional Owner-only** | Show "Owner" vs "Admin" in Users and optionally in header; optionally restrict subscription/billing to Owner | Use getRoleDisplayName or role; isOwner() for subscription page if desired. |
| **6. Dashboard/reports for owner** | Branch comparison, route profitability (from BRANCH_ROUTE_ENTERPRISE_PLAN) | Summary by branch, route profitability report, optional dashboard widgets. |
| **7. Data model & POS (from BRANCH_ROUTE_ENTERPRISE_PLAN)** | Customer BranchId/RouteId; POS lock for staff; ledger NaN fix; subscription status sync | Follow Phase A–C in BRANCH_ROUTE_ENTERPRISE_PLAN. |

**Dependencies:** 1 and 2 can be done in parallel. 3 needs backend migration. 4 is frontend-only. 5 and 6 are frontend + optional backend. 7 is the larger Branch/Route refactor.

---

## 8. Summary Checklist

- [ ] **Terminology:** All user-visible "Tenant" → "Company" (Error Logs, Demo, Tenant Detail modals).
- [ ] **Reports:** Branch + Route filters; pass branchId/routeId to report APIs; totals reflect selection.
- [ ] **Expenses by branch:** Expense.BranchId; API filter/aggregate by branch; UI branch filter + per-branch totals.
- [ ] **Confirm modal:** One danger modal; replace all confirm() for destructive actions.
- [ ] **Owner:** Label in UI; optional Owner-only subscription; dashboard/reports (branch comparison, route profitability).
- [ ] **No duplicate confirm UX:** Single component for all confirmations.
- [ ] **Bad logic fixed:** Reports use branch/route; expenses attributable to branch; Owner clarity; then full Branch/Route flow (BRANCH_ROUTE_ENTERPRISE_PLAN).

This doc is the **single reference** for consolidation, terminology, report filters, expenses by branch, duplicates, and Owner. For full Branch/Route hierarchy and POS/ledger/subscription, use **BRANCH_ROUTE_ENTERPRISE_PLAN.md**.

---

## 9. Done (implemented)

| Task | Done |
|------|------|
| **Production build** | Frontend `npm run build` and backend `dotnet build -c Release` both succeed with **0 errors**. Backend has 12 warnings (nullability, async, EF); none block deploy. |
| **Terminology: Tenant → Company (Super Admin UI)** | Error Logs table header "TenantId" → "Company". Demo Requests: "Create Tenant" → "Create Company", "Tenant #id" → "Company #id". Tenant Detail: "Edit Tenant" → "Edit Company"; modal comments "Edit Company Modal", "Suspend Company Modal". (Modal titles were already "Edit Company Details", "Suspend Company Access".) |
| **Reports: Branch + Route filters** | Reports page: Branch and Route dropdowns (Route filtered by Branch). Summary and Sales report APIs receive branchId/routeId. Expenses report receives branchId. Totals reflect selected branch/route. |
| **ConfirmDangerModal** | New component `ConfirmDangerModal.jsx` (optional requireTypedText). BillingHistoryPage: delete invoice uses modal with "DELETE". BackupPage: delete backup and restore use modal (no type required). |
| **Expenses by branch** | Backend: Expense.BranchId (nullable); migration AddBranchIdToExpense; ExpenseDto/CreateExpenseRequest BranchId; GetExpenses(branchId), GetExpensesByCategory(branchId). Frontend: Reports expenses tab passes branchId; Expenses API supports branchId. |
| **Owner label** | Users page: role badge uses getRoleDisplayName; "Company owner" subtitle shown under Owner role. |
