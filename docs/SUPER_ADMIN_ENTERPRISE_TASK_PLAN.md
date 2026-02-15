# Super Admin – Enterprise Task Plan (Structured)

Single reference: **current state**, **gaps**, and **discrete tasks** by phase. No repetition. Each task is one concrete deliverable.

---

## 1. Current state (from codebase)

| Area | What exists |
|------|-------------|
| **Nav** | Platform Dashboard, Companies, Demo Requests, Platform Health, Error Logs, Audit Logs, Help & Support, Feedback (8 items). |
| **Dashboard** | Total Companies, Operational (active+trial), Platform Revenue, Total Invoices; secondary: Total Users, Total Customers, Total Products; lifecycle bar (Active/Trial/Suspended/Expired); top tenants; infra cost/margin (estimated from row counts). |
| **Companies** | List (search, status filter), create (status default Trial, trialDays), suspend/activate/delete, detail page with users/subscription/usage. No “Login as Owner” or “Export Company DB” or “Force Logout All”. |
| **Subscription** | Backend: SubscriptionMiddleware blocks expired; Trial/Active/Suspended/Expired in Tenant.Status; Subscriptions table + SubscriptionService. Frontend: subscription in company detail; no dedicated Subscriptions page in Super Admin. |
| **Audit** | GET /api/superadmin/audit-logs (paged). AuditLogs table. No filters (tenant, user, action, date) in UI/API. |
| **Terminology** | Mix: “Tenant” in API/DB, “Companies” in nav and some UI, “Operational”, “Trial”, “Active”. Create-company form default status “Trial”. |
| **Demo Requests** | Full page + APIs. In main nav. |
| **Feedback** | Full page (submit). In main nav. |
| **Infrastructure** | Platform Health: DB, migrations, company count, Run migrations. Dashboard shows EstimatedStorageUsedMb, InfraCostEstimate (formula-based, not real billing). No “Infrastructure” nav item. |
| **Feature flags** | Not implemented. No per-company toggles (Route, Branch, WhatsApp, etc.). |
| **Company actions** | Suspend, Activate, Clear data, Delete. No: Impersonate, Reset password, Extend subscription, Export DB, Force logout all. |

---

## 2. Gaps vs enterprise target

- **Naming:** Tenant/Company/Business/Trial/Active/Operational mixed; subscription lifecycle not clearly mapped in UI.
- **Nav:** Too many items; Demo Requests and Feedback should not be priority; need Subscriptions, Infrastructure, Settings.
- **Dashboard:** Too many decorative cards and colors; should show only 6 metrics (Total Companies, Active, Suspended, Monthly Revenue, Total Active Users, Total DB Storage) with calm hierarchy.
- **Company management:** Missing impersonate, reset password, extend subscription, export DB, force logout; status/plan/revenue/users/DB size/last login/last activity need to be explicit.
- **Audit:** No filters (tenant, user, action, date); need enterprise-level “who did what”.
- **Subscription engine:** Lifecycle (Trial → Paid Monthly/Yearly → Suspended/Expired) and auto-block exist in backend; UI and naming not aligned.
- **Infrastructure panel:** Cost/storage are estimates; if not real, remove or label “Estimated” until real.
- **Feature flags:** Missing; required for Route/Branch/WhatsApp etc. per company.
- **UI/UX:** Too many colors, weak hierarchy, generic look; need one color system, clear typography (e.g. Inter/Geist), flat minimal cards, 8px spacing, reduced sidebar.

---

## 3. Tasks by phase (each line = one task)

### Phase 1 – Stabilize (subscription, tenant isolation, import/restore, audit)

| # | Task | Notes |
|---|------|--------|
| 1.1 | **Document subscription lifecycle** | One doc: Trial → Paid Monthly/Yearly → Suspended/Expired; when system auto-blocks; where status is set (signup, Super Admin, job). |
| 1.2 | **Align UI terminology with lifecycle** | Replace “Operational” with “Active” where it means paid; use “Trial” only for trial; “Suspended”/“Expired” consistent. No “Operational” in dashboard. |
| 1.3 | **Audit log filters (backend)** | Add optional query params: tenantId, userId, action, fromDate, toDate; return filtered paged results. |
| 1.4 | **Audit log filters (frontend)** | Filters UI for tenant, user, action, date range; call updated API. |
| 1.5 | **Audit coverage** | Ensure login, delete invoice, edit product price, export report, VAT change (and other critical actions) write to AuditLogs with correct action/entity. |
| 1.6 | **Import/restore validation** | Validate tenant isolation and row limits before insert; reject or truncate if over limit; log in audit. |
| 1.7 | **TenantId index review** | Confirm all tenant-scoped tables have index on TenantId (or equivalent); fix missing indexes. |
| 1.8 | **Invoice numbering isolation** | Confirm invoice numbers are per-tenant (no cross-tenant reuse); document or fix. |

### Phase 2 – Super Admin structure and nav

| # | Task | Notes |
|---|------|--------|
| 2.1 | **Reduce sidebar to 6 items** | Dashboard, Companies, Subscriptions, Audit Logs, Infrastructure, Settings. Remove Demo Requests and Feedback from main nav. |
| 2.2 | **Subscriptions page (Super Admin)** | List or view of subscriptions by company (plan, status, end date, MRR); link from Companies; read-only or extend from here. |
| 2.3 | **Infrastructure nav item** | Point to Platform Health (DB, migrations, Run migrations); optionally rename “Platform Health” → “Infrastructure” in nav. |
| 2.4 | **Settings page (Super Admin)** | Single place: Help link, Feedback link, default trial days, country defaults (optional); no new backend until needed. |
| 2.5 | **Hide Demo Requests** | Remove from nav; keep route and page for later marketing use (or remove route if product decision is to delete). |
| 2.6 | **Hide Feedback from main nav** | Move link to Settings or footer; keep route and page. |

### Phase 3 – Company management and dashboard

| # | Task | Notes |
|---|------|--------|
| 3.1 | **Dashboard: 6 metrics only** | One section: Total Companies, Active Companies, Suspended Companies, Monthly Revenue, Total Active Users, Total DB Storage Used. Remove decorative cards and extra stats from main view. |
| 3.2 | **Dashboard: calm UI** | Single color system (e.g. primary blue, neutral surface); flat cards; no gradient overload; clear typography hierarchy. |
| 3.3 | **Company list columns** | Ensure columns: Status, Plan Type, Monthly Revenue, Total Users, DB Size, Last Login, Last Activity; add if missing (backend + frontend). |
| 3.4 | **Company detail: actions** | Add actions: Login as Owner (impersonate), Reset Company Data (existing clear-data), Suspend, Extend Subscription, Reset Password, Export Company DB, Force Logout All Users. Implement in order of priority. |
| 3.5 | **Infrastructure cost clarity** | If cost/storage are estimated: label “Estimated” in UI and doc; or remove until real billing/storage metrics exist. |

### Phase 4 – Feature flags and polish

| # | Task | Notes |
|---|------|--------|
| 4.1 | **Feature flags (backend)** | Model: per-tenant or per-plan flags (e.g. RouteModule, BranchModule, WhatsAppModule, AdvancedReports, InventoryExpiryAlerts). Table + API to get/set. |
| 4.2 | **Feature flags (Super Admin UI)** | Toggles per company (or plan) to enable/disable each feature; enforce in app (e.g. hide Route menu if disabled). |
| 4.3 | **Feature flags (client app)** | Respect flags: hide Route/Branch/WhatsApp/Reports when disabled; no API calls for disabled features. |
| 4.4 | **Global typography and spacing** | Apply one font (Inter or Geist), 3 heading sizes, 8px spacing scale across Super Admin. |
| 4.5 | **Color system** | Define and apply: primary (e.g. deep blue), background white, surface #F8FAFC, success/danger single tones; remove random colors. |
| 4.6 | **Route & Branch P&L** | Route P&L, Branch P&L, route expense tracking, staff per route (already partially built; complete and expose). |

---

## 4. Risk and data isolation (verify, do not guess)

| # | Task | Notes |
|---|------|--------|
| R1 | **TenantId on every query** | Audit all read/write paths for tenant-scoped data; ensure TenantId filter (or equivalent) applied. |
| R2 | **RLS (if used)** | If RLS is enabled, document policy and test; if not, rely on app-level TenantId filtering and document. |
| R3 | **Import validation** | Max rows per tenant, file type/size limits, and tenant isolation checks before insert. |

---

## 5. Implementation order (recommended)

1. **Phase 2.1, 2.5, 2.6** – Sidebar cleanup (quick, no backend).
2. **Phase 3.1, 3.2** – Dashboard simplify and calm UI.
3. **Phase 1.2** – Terminology pass (Company, Active, Trial, Suspended, Expired).
4. **Phase 1.3–1.5** – Audit filters and coverage.
5. **Phase 1.1** – Subscription lifecycle doc.
6. **Phase 2.2, 2.3, 2.4** – Subscriptions page, Infrastructure label, Settings page.
7. **Phase 3.3, 3.4** – Company columns and actions (in priority order).
8. **Phase 4** – Feature flags and global polish.

---

## 6. What not to do (from review)

- Do not add new Super Admin pages before core (subscription, audit, company actions) is stable.
- Do not build Feedback/Demo flows before audit and tenant control are solid.
- Do not show unlabeled “cost” or “storage” as if real until they are real or clearly estimated.
- Do not mix terminology (Tenant vs Company, Operational vs Active) in user-facing UI.

---

*Reference: Enterprise SaaS Super Admin review (terminology, UX, structure, phases).*

**Related:** For Branch/Route hierarchy, POS auto-binding, ledger NaN, subscription status sync, confirm→modal, and report layers see **[BRANCH_ROUTE_ENTERPRISE_PLAN.md](./BRANCH_ROUTE_ENTERPRISE_PLAN.md)**. For terminology (Company vs Tenant), report filters, expenses by branch, duplicates, and Owner features see **[CONSOLIDATION_AND_OWNER_PLAN.md](./CONSOLIDATION_AND_OWNER_PLAN.md)**.

---

## 7. Done (implemented)

| Task | Done |
|------|------|
| 2.1 Reduce sidebar to 6 items | ✅ Dashboard, Companies, Subscriptions, Audit Logs, Infrastructure, Settings |
| 2.5 Hide Demo Requests from nav | ✅ Removed from nav (route /superadmin/demo-requests still exists) |
| 2.6 Hide Feedback from main nav | ✅ Moved to Settings page (route /feedback still exists) |
| 2.3 Infrastructure nav | ✅ Renamed “Platform Health” → “Infrastructure”, same route /superadmin/health |
| 2.2 Subscriptions placeholder | ✅ /superadmin/subscriptions placeholder with link to Companies |
| 2.4 Settings page | ✅ /superadmin/settings with Help and Feedback links |
| 3.1 Dashboard: 6 metrics only | ✅ Total Companies, Active Companies, Suspended Companies, Monthly Revenue, Total Active Users, Total DB Storage Used |
| 3.2 Dashboard: calm UI | ✅ bg #F8FAFC, flat white cards, neutral hierarchy |
| 1.1 Subscription lifecycle doc | ✅ docs/SUBSCRIPTION_LIFECYCLE.md (statuses, when blocked, where set, UI wording) |
| 1.2 Terminology: audit table | ✅ Audit logs table column label "TenantId" → "Company" (value still tenantId) |
| 1.3 Audit log filters (backend) | ✅ GetPlatformAuditLogs: optional tenantId, userId, action, fromDate, toDate query params |
| 1.4 Audit log filters (frontend) | ✅ SuperAdminAuditLogsPage: filter form (Company ID, User ID, Action, From/To date), Apply/Clear |
| 3.3 Company list columns | ✅ Backend: TenantDto LastActivity (latest Sale), PlanName (latest Subscription plan). Frontend: Plan and Last Activity columns in Companies table |
