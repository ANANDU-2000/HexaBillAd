# Branch vs Route – Enterprise Architecture & Task Plan

Single reference for **correct hierarchy**, **data model**, **data flow**, **reporting layers**, and **strict implementation order**. No overlap with Branch/Route logic; UX and staff permissions included.

---

## 1. Correct Enterprise Hierarchy (Lock This)

```
Tenant (Company)
 ├── Branch (physical location: warehouse / office)
 │     ├── Route (sales distribution path under branch)
 │     │     ├── Customers (assigned to route)
 │     │     │     ├── Sales (Invoices)
 │     │     │     ├── Payments
 │     │     │     └── Ledger
 │     │     └── Route Expenses (fuel, driver, delivery, misc)
 │     └── Branch Expenses (branch-level overhead)
 └── Global Reports (company-level + branch comparison + route comparison)
```

**Branch** = Physical location (e.g. Dubai Branch, Sharjah Branch). Owns: products stock, staff, routes, branch-level expenses.

**Route** = Sales distribution path under one branch (e.g. Route A – Deira restaurants, Route B – Abu Dhabi hotels). Owns: assigned staff (salesman/driver), assigned customers, route expenses, route-specific sales.

---

## 2. Current State vs Target

| Area | Current | Target |
|------|--------|--------|
| **Customer** | No BranchId/RouteId; route link only via RouteCustomer (M:M) | Customer has BranchId + RouteId (required on create); Route dropdown filtered by Branch |
| **POS** | Staff can manually pick Branch + Route | Staff: lock POS to assigned route only; auto-set route on invoice. Owner can override |
| **Ledger** | Customer Ledger not filterable by route/branch; Sales Ledger has no route filter | Ledger route-aware filters; no NaN in pending balance |
| **Expenses** | RouteExpense exists; Expense (global) has no BranchId | Branch-level expenses (BranchExpense or Expense.BranchId); route expenses already exist |
| **Branch table** | Name, Address, TenantId | Add: Location, ManagerUserId, IsActive |
| **Route table** | Name, BranchId, AssignedStaffId, TenantId | Add: IsActive; keep RouteStaff for multiple staff |
| **Reporting** | Mixed; no clear 4 layers | Route → Branch → Company → Super Admin (see §5) |
| **Subscription/Tenant status** | Tenant.Status vs Subscription.Status can drift; “paid but showing Trial” | Single source of truth; sync Tenant.Status from Subscription; clear enum usage |
| **Deletes/confirmations** | `window.confirm()` in many places | Replace with custom danger modal + optional audit |
| **Demo Requests** | Page exists; nav hidden | Remove or clearly “marketing only” to avoid confusion |

---

## 3. Data Model (Target)

### Branch table (add fields)

| Field | Type | Notes |
|-------|------|--------|
| Id | int | PK |
| TenantId | int | FK |
| Name | string | |
| Address | string? | existing |
| **Location** | string? | **Add** – e.g. city/area |
| **ManagerUserId** | int? | **Add** – optional branch manager |
| **IsActive** | bool | **Add** – default true |
| CreatedAt, UpdatedAt | datetime | |

### Route table (add field)

| Field | Type | Notes |
|-------|------|--------|
| Id | int | PK |
| TenantId | int | FK |
| BranchId | int | FK (existing) |
| Name | string | |
| AssignedStaffId | int? | primary staff (existing) |
| **IsActive** | bool | **Add** – default true |
| CreatedAt, UpdatedAt | datetime | |

### Customer table (add fields)

| Field | Type | Notes |
|-------|------|--------|
| … existing … | | |
| **BranchId** | int? | **Add** – required for new customers in branch/route flow |
| **RouteId** | int? | **Add** – required for new customers; filter by Branch |
| CreditLimit, PaymentTerms | existing | |

*Keep RouteCustomer M:M for “assigned to route” list; BranchId/RouteId on Customer for primary assignment and reporting.*

### Expense (company-level) – branch link

| Option A | Add **BranchId** (nullable) to Expense. Null = company-level; set = branch-level. |
| Option B | New **BranchExpense** table (BranchId, Amount, Date, Category, Note). |

Recommendation: **Option A** (single Expense table with BranchId?) to reuse categories and reporting.

---

## 4. Data Flow (Correct Logic)

### 4.1 Create Branch (Owner/Admin)

- Branch Name, Location (optional), Address, Manager (optional), IsActive.
- No route created here.

### 4.2 Create Route (Owner/Admin)

- Route Name, **Select Branch (mandatory)**, Assign Salesman (optional), Vehicle (optional), IsActive.
- Route belongs to one Branch.

### 4.3 Create Customer

- **Required in branch/route flow:** Branch (dropdown) → Route (dropdown **filtered by selected Branch**).
- Credit limit, payment terms, etc.
- If customer is created from Route detail page → **auto-fill Route + Branch** (no manual pick).
- Prevents wrong Branch/Route mapping.

### 4.4 POS (critical)

- **Staff user:** On login, resolve assigned route (from RouteStaff or Route.AssignedStaffId). **Lock** POS to that route: auto-set BranchId + RouteId on every new invoice; **hide** Branch/Route dropdown or show read-only.
- **Owner/Admin:** Can override (dropdown visible) or use default.
- No “manual only” – staff must not choose route; system binds it.

### 4.5 Ledger

- Customer Ledger: filter by Branch and/or Route (dropdowns; route filtered by branch).
- Sales Ledger: filter by Branch, Route (and existing date/type).
- All balance calculations: guard against undefined/null so **no NaN** (use `Number(x) || 0` and validate backend).

---

## 5. Reporting Layers (4 Levels)

| Level | Contents |
|-------|----------|
| **1. Route** | Route total sales, route expenses, route net profit, route customer balances, route stock movement (if applicable) |
| **2. Branch** | Branch revenue, branch expense (branch + sum of route expenses), branch net, route comparison within branch |
| **3. Company** | Total sales, purchases, expenses, net margin, **branch comparison** |
| **4. Super Admin** | Tenant revenue, growth, health, storage, active vs inactive (existing + align with this plan) |

---

## 6. Staff Permissions & Expenses

- **Staff:** Access only to their **assigned route(s)** (and branch by implication): POS locked to route; ledger/reports filtered to their route (or read-only branch view if needed). No access to other routes’ data unless role allows.
- **Branch manager (optional):** Access to branch and all its routes (reports, expenses, ledger filtered by branch).
- **Owner/Admin:** Full access; can assign staff to routes (RouteStaff, AssignedStaffId); can create/edit Branch, Route, Customer (BranchId/RouteId); can override POS route.
- **Expenses:**
  - **Route expenses:** Already exist (RouteExpense: Fuel, Staff, Delivery, Misc per route).
  - **Branch expenses:** Add (BranchExpense table or Expense.BranchId). Branch-level costs not tied to a route.
  - **Company expenses:** Existing Expense with no BranchId (or keep current global expense).

---

## 7. Major Logic Fixes (Strict Order)

| # | Issue | Action |
|---|--------|--------|
| 1 | **NaN in ledger** (e.g. “NaN AED”) | Backend: ensure all balance/pending APIs return numbers (no null in sum). Frontend: guard all balance display: `const pending = Number(totalSales) - Number(totalPayments); return isNaN(pending) ? 0 : Math.max(0, pending)`; same for Customer Ledger summary. |
| 2 | **Browser `confirm()`** | Replace every `window.confirm()` / `confirm()` with a **custom danger modal**: title, body text, “Cancel” / “Confirm” (danger style). Optional: require typing “DELETE” or “RESTORE” for destructive actions; log to audit where applicable. |
| 3 | **Demo Requests** | Either remove Demo Requests page and API from tenant/super-admin flow, or keep route but label clearly “Marketing / Lead capture only” and do not use for real onboarding. |
| 4 | **Subscription / Tenant status** | Use one source of truth: **Subscription.Status** (Trial, Active, Suspended, Expired, Cancelled, PastDue). On any subscription change, **sync Tenant.Status** and TrialEndDate. Never show “Trial” in UI when subscription is Active. Fix TrialExpiryCheckJob and any API that returns tenant status to use subscription. |
| 5 | **Audit logs** | Ensure critical actions write to AuditLogs: login, invoice create/delete, payment edit, stock edit, customer edit, VAT/settings change. Super Admin already has audit filters; extend coverage. |

---

## 8. Implementation Order (Strict)

Do in this order to avoid rework.

### Phase A – Data model & safety

1. **Data model**
   - Add to **Branch:** Location (optional), ManagerUserId (optional), IsActive (default true). Migration.
   - Add to **Route:** IsActive (default true). Migration.
   - Add to **Customer:** BranchId (nullable), RouteId (nullable). Migration. Backfill from RouteCustomer where possible.
   - **Expense:** Add BranchId (nullable) and migration, or add BranchExpense table (decide per §3).

2. **Ledger NaN**
   - Backend: review sales-ledger and customer-ledger APIs; ensure all numeric fields returned as numbers; validate sums.
   - Frontend: CustomerLedgerPage and SalesLedgerPage – coerce totals and pending balance (Number, fallback 0); never render raw value that could be NaN.

3. **Subscription / Tenant status**
   - Document SubscriptionStatus enum (Trial, Active, Suspended, Expired, Cancelled, PastDue); ensure Tenant.Status is updated on every subscription state change; fix “paid but shows Trial” by reading from Subscription first; fix TrialExpiryCheckJob and Super Admin tenant list to use subscription status.

### Phase B – UX & confirmations

4. **Replace `confirm()` with danger modal**
   - Create reusable `ConfirmDangerModal` (title, message, confirmLabel, onConfirm, onCancel, optional “type DELETE”).
   - Replace in: SettingsPage (delete/restore backup), SalesLedgerPage (if any), RouteDetailPage (delete expense), PurchasesPage, ExpensesPage, CustomersPage, CustomerLedgerPage (delete payment/invoice), BillingHistoryPage, BackupPage, SuperAdminTenantDetailPage (delete user). Audit where confirmation should write to audit log.

5. **Demo Requests**
   - Remove from nav (already done). Either remove page/route or add banner “Marketing only – not used for onboarding”.

### Phase C – Branch / Route hierarchy

6. **Customer create/edit**
   - Add Branch dropdown and Route dropdown (Route filtered by Branch). Required when “branch/route mode” is on. If creating from Route page, auto-set BranchId + RouteId.

7. **POS auto-binding**
   - Resolve current user’s assigned route (RouteStaff + AssignedStaffId). If Staff and single route: set BranchId/RouteId on invoice automatically; hide or disable Branch/Route selector. Owner/Admin: keep selector, default to user’s route if any.

8. **Ledger route-aware**
   - Customer Ledger: filters Branch, Route (route filtered by branch). Sales Ledger: same. Backend: add optional branchId/routeId query params to ledger APIs and filter.

9. **Branch expenses**
   - Implement Branch-level expenses (Expense.BranchId or BranchExpense). UI: expense entry can select Branch (optional); reports by branch.

### Phase D – Reporting & advanced

10. **Report layers**
    - Route: route profitability (sales, expenses, net) – extend existing route summary. Branch: branch revenue, expense, net, route comparison. Company: existing + branch comparison. Super Admin: existing.

11. **Route profitability report**
    - Dedicated report: by route, sales vs route expenses, net; optional staff performance, customer aging, credit risk (from ledger data).

12. **Staff permissions**
    - Enforce route-scoped access for Staff: POS locked; ledger and reports filtered by assigned route(s). Branch manager (if implemented): scope by branch.

### Phase E – Super Admin & audit

13. **Super Admin actions**
    - Force logout tenant, Suspend, Reset data, Reset password, Impersonate (view-only), Storage limit, Max users, Feature toggle per tenant, Version/force update. Implement in priority order (see SUPER_ADMIN_ENTERPRISE_TASK_PLAN).

14. **Audit log coverage**
    - Login, invoice create/delete, payment edit, stock edit, customer edit, VAT/settings change. Backend writes to AuditLogs; Super Admin already has filters.

---

## 9. UX Principles (Very Important)

- **Consistency:** One design system (e.g. primary blue, danger red, neutral grays); 8px spacing; clear typography (Inter/Geist).
- **Hierarchy:** Branch → Route in every relevant screen (create customer, POS, ledger, reports). Never show Route without Branch context.
- **No raw browser dialogs:** All confirmations via custom modal; danger actions use danger style and optional type-to-confirm.
- **No NaN or “undefined” in UI:** All numbers validated and fallback to 0 or “—”.
- **Accessibility:** Labels, focus order, keyboard support for modals and forms.
- **Mobile:** Touch targets ≥ 44px; bottom nav and filters usable on small screens.

---

## 10. Summary Checklist

- [ ] Branch: add Location, ManagerUserId, IsActive.
- [ ] Route: add IsActive.
- [ ] Customer: add BranchId, RouteId; create/edit with Branch → Route dropdowns; auto-fill on Route page.
- [ ] Expense: add BranchId (or BranchExpense); branch-level expenses.
- [ ] POS: Staff locked to assigned route; auto-set BranchId/RouteId; Owner can override.
- [ ] Ledger: no NaN; route/branch filters; backend filter support.
- [ ] Subscription/Tenant status: single source of truth; fix “Trial” when paid.
- [ ] Replace all confirm() with ConfirmDangerModal.
- [ ] Demo Requests: remove or “marketing only”.
- [ ] Audit: login, invoice, payment, stock, customer, settings.
- [ ] Reports: Route → Branch → Company → Super Admin layers.
- [ ] Staff permissions: route-scoped access; branch manager optional.
- [ ] Super Admin: force logout, suspend, reset, impersonate, limits, feature toggle, audit.

This document is the **single reference** for Branch/Route architecture and implementation order. Link from SUPER_ADMIN_ENTERPRISE_TASK_PLAN for Super Admin–specific items.

**Related:** For terminology (Company vs Tenant), report Branch/Route filters, expenses by branch, duplicate confirm modals, and Company Owner role/features see **[CONSOLIDATION_AND_OWNER_PLAN.md](./CONSOLIDATION_AND_OWNER_PLAN.md)**.
