# Super Admin – Full Build Plan & Prompt

This document is the **single source of truth** for making HexaBill Super Admin a **real, successful SaaS** control plane: advanced client/user/database management, real-time behaviour, table views per client with logo/profile, all DB features and queries working for future builds, and no missing pages or bad logic.

---

## Built (done – not just plan)

| Item | Status |
|------|--------|
| **Platform Health** | `SuperAdminHealthPage.jsx`, route `/superadmin/health`, nav, "Check again", **"Run migrations"** (when pending) + confirm modal, `getPlatformHealth()`, `applyMigrations()` |
| **Error Logs** | `SuperAdminErrorLogsPage.jsx`, route `/superadmin/error-logs`, nav, table + "Refresh", `getErrorLogs(limit)` |
| **Audit Logs** | `SuperAdminAuditLogsPage.jsx`, route `/superadmin/audit-logs`, nav, table + pagination, `getAuditLogs(page, pageSize)`; backend `GET /api/superadmin/audit-logs` (SystemAdmin) |
| **Companies table** | Company column with logo + name (LogoPath from API); backend list returns `LogoPath` |
| **Frontend build** | `npm run build` passes with no errors |

---

## 1. Goals

- **Super Admin** = advanced **client (company) / user / database** management and “manage system” for the whole platform.
- **Real-time** where it matters: dashboard metrics, alerts, logs.
- **Table format** per client: each row = one company with **logo**, **profile** (name, status, key metrics), and all DB-backed fields.
- **All database features** must have correct **queries** and **APIs** so current and **future builds** don’t break.
- **No missing pages/files**: every planned screen and action (diagnostics, logs, buttons, checks) must exist and work.
- **Clear logic**: fix any “bad” or inconsistent logic so the product behaves like a proper SaaS.

---

## 2. What Exists Today

### Backend (APIs)

| Feature | Endpoint / area | Notes |
|--------|------------------|--------|
| Platform dashboard | `GET /api/superadmin/tenant/dashboard` | Totals, lifecycle |
| Companies list (paged) | `GET /api/superadmin/tenant` | Supports search, status filter; DTO has `LogoPath` |
| Company by ID | `GET /api/superadmin/tenant/{id}` | Detail + users, subscription, usage |
| Create/Update/Delete company | POST/PUT/DELETE on tenant | |
| Suspend / Activate | PUT suspend, PUT activate | |
| Clear data / Duplicate data | POST clear-data, POST duplicate-data | |
| Subscription update | PUT tenant/{id}/subscription | |
| Tenant users CRUD + reset password | Under tenant/{id}/users | |
| Demo requests | Demo request APIs | Approve/Reject |
| **Platform health** | `GET /api/superadmin/platform-health` | DB, last migration, pending, company count (SystemAdmin) |
| **Error logs** | `GET /api/error-logs?limit=100` | Last N server errors (Admin, Owner, SystemAdmin) |
| Health (anonymous) | `GET /api/health` | Simple alive check |
| Status (diagnostics) | `GET /api/status` | DB, migrations, tables (SQLite-oriented) |
| Migrate | `POST /api/migrate` | Apply pending migrations |
| Fonts check | `GET /api/fonts` | Font files for PDF/invoices |

### Frontend (Super Admin)

| Page | Route | Status |
|------|--------|--------|
| Platform Dashboard | `/superadmin/dashboard` | Exists |
| Companies | `/superadmin/tenants` | **Done** – table has Company column (logo + name); API returns LogoPath in list |
| Company detail | `/superadmin/tenants/:id` | Exists |
| Demo requests | `/superadmin/demo-requests` | Exists |
| Help | `/help` | Exists |
| Feedback | `/feedback` | Exists |
| **Platform Health (Diagnostics)** | `/superadmin/health` | **Done** – SuperAdminHealthPage, nav, “Check again” |
| **Error Logs** | `/superadmin/error-logs` | **Done** – SuperAdminErrorLogsPage, nav, “Refresh” |
| **Audit Logs** | `/superadmin/audit-logs` | **Done** – SuperAdminAuditLogsPage, nav, pagination; backend `GET /api/superadmin/audit-logs` |
| Audit log viewer (platform-wide) | – | **Done** (see Audit Logs above) |
| Billing / usage per company (dedicated UI) | – | Partial (usage in tenant detail) |
| Global search (companies/users) | – | **Missing** |
| Feature flags per company | – | **Missing** |
| Country/region defaults | – | **Missing** |

---

## 3. Missing or Incomplete Items

### 3.1 Pages / Files to Build

1. **Platform Health (Diagnostics)**
   - **Route:** `/superadmin/health`
   - **File:** `SuperAdminHealthPage.jsx`
   - **Behaviour:** Call `GET /api/superadmin/platform-health`. Show: DB connected (yes/no), last applied migration, pending migrations list, company count. “Check again” button to refetch. Optional: link to “Run migrations” if pending (call `POST /api/migrate` from Super Admin only with confirmation).
   - **Nav:** Add “Platform Health” or “Diagnostics” in Super Admin sidebar.

2. **Error Logs**
   - **Route:** `/superadmin/error-logs`
   - **File:** `SuperAdminErrorLogsPage.jsx`
   - **Behaviour:** Call `GET /api/error-logs?limit=100` (or 500). Table: TraceId, ErrorCode, Message, Path, Method, TenantId, UserId, CreatedAt. “Refresh” button. Optional: filter by tenant, date, error code.
   - **Nav:** Add “Error Logs” in Super Admin sidebar.

3. **Companies table – logo and profile**
   - **Where:** `SuperAdminTenantsPage.jsx`
   - **Change:** Add a “Company” column (first column): show company **logo** (from `tenant.logoPath` or API equivalent) + **name** (profile-wise). Use same API base URL as elsewhere for logo `src`. If no logo, show placeholder/initials.

4. **Audit log viewer (platform-wide)**
   - **Route:** e.g. `/superadmin/audit-logs`
   - **Backend:** Ensure audit events (company create/suspend, user add, etc.) are stored and a **platform-wide** endpoint exists for SystemAdmin (e.g. `GET /api/superadmin/audit-logs` with filters).
   - **Frontend:** Table with filters (company, user, action, date range). **Not yet built** – add to build order.

### 3.2 Logic / Data Fixes

- **Tenant list and logo:** Backend already returns `LogoPath` in tenant DTO; frontend must use it in the Companies table (see 3.1.3).
- **All list/detail APIs:** Ensure every Super Admin screen uses the correct API and maps response to UI (success/error, loading). No “stub” responses that hide missing backend.
- **Error handling:** Every Super Admin API call should show a toast or inline error on failure; “Check” / “Refresh” buttons should clearly show loading and then success/failure.
- **Queries for future builds:** Any new feature that adds DB columns or tables must have migrations and APIs that return those fields so future builds (e.g. new Super Admin tabs) can rely on them without redoing queries.

### 3.3 Real-time (Later)

- **Dashboard:** Optional polling or SignalR for “live” totals (e.g. company count, new signups).
- **Error Logs:** Optional auto-refresh every N seconds or “New errors” badge.
- **Alerts:** Notify Super Admin on critical events (e.g. payment failure, abuse). Requires backend events + frontend channel (e.g. SignalR, or polling a “recent alerts” endpoint).

Implement after core Super Admin pages and diagnostics are solid.

### 3.4 Buttons and Checks

- **Platform Health:** “Check again” button → refetch `platform-health`.
- **Error Logs:** “Refresh” button → refetch error logs.
- **Companies:** “Refresh” already exists; keep it.
- **Company detail:** Ensure “Suspend”, “Activate”, “Clear data”, “Delete” have confirmations and success/error toasts.
- **Diagnostics:** If you add “Run migrations”, use a confirmation modal and then `POST /api/migrate`; show result (success or error list).

---

## 4. Database and Queries

- **ErrorLogs:** Already used by `GET /api/error-logs`; ensure middleware/logging writes 500s and important errors to this table so Super Admin sees real data.
- **Tenants:** List and detail APIs must return all fields needed for table and profile (name, status, country, currency, logo path, created, etc.). Add new fields via migrations and DTOs so future builds don’t need to change queries.
- **AuditLogs (platform):** If not present, add a table and write key Super Admin actions (company created/suspended, user added, etc.); then add `GET /api/superadmin/audit-logs` and build the viewer (see 3.1.4).
- **DemoRequests:** Already used; ensure list and approve/reject flows are wired and robust.

---

## 5. UX Checklist (Super Admin)

- [ ] Every Super Admin page has a clear title and short description.
- [ ] All tables have at least: sort (if needed), loading state, empty state, error state.
- [ ] Destructive actions (delete, suspend, clear data) use a confirmation modal.
- [ ] Success and error toasts for every mutation.
- [ ] “Check” / “Refresh” buttons show loading and then result.
- [ ] Companies table shows logo + name (profile) per row.
- [ ] Navigation highlights current page; all planned items (Health, Error Logs, etc.) are in the sidebar.

---

## 6. Build Order (Suggested)

1. **Platform Health page** – `SuperAdminHealthPage.jsx`, route, nav, “Check again” button, call `GET /api/superadmin/platform-health`.
2. **Error Logs page** – `SuperAdminErrorLogsPage.jsx`, route, nav, table, “Refresh” button, call `GET /api/error-logs`.
3. **Companies table logo/profile** – Add Company column with logo + name in `SuperAdminTenantsPage.jsx` using `tenant.logoPath` and API base URL.
4. **Frontend API helpers** – Add `getPlatformHealth()` and `getErrorLogs(limit)` to `services/index.js` (e.g. under `superAdminAPI` or `diagnosticsAPI`).
5. **Audit log backend** – Table + write on key actions; `GET /api/superadmin/audit-logs` (filters: company, user, action, date).
6. **Audit log frontend** – Page, route, nav, table, filters.
7. **Real-time (optional)** – Polling or SignalR for dashboard/alerts after 1–6 are stable.

---

## 7. Build Prompt (for any remaining work)

**Already built (no need to re-implement):** Platform Health page, Error Logs page, Audit Logs page (backend `GET /api/superadmin/audit-logs` + SuperAdminAuditLogsPage), Companies table logo column, getPlatformHealth/getErrorLogs/getAuditLogs in services, all routes and nav. Frontend build passes.

**Optional next steps (copy-paste for next implementation):**

```
HexaBill Super Admin – optional next steps:

1. Real-time: Add polling (e.g. every 30s) or SignalR for dashboard totals / error log count so Super Admin sees live updates without refreshing.

2. Audit log filters: Add filters (tenant, user, action, date range) to GET /api/superadmin/audit-logs and SuperAdminAuditLogsPage.

3. Confirm all destructive actions (suspend, delete, clear data) have confirmation modals and toasts (already in place; verify in SuperAdminTenantsPage and SuperAdminTenantDetailPage).

Reference: docs/SUPER_ADMIN_BUILD_PLAN.md and docs/PRODUCTION_AND_SUPER_ADMIN_PLAN.md.
```

---

## 8. Why Some Pages Were Not Built Yet

- **Platform Health and Error Logs:** Backend endpoints existed; the UI pages and nav items were not added. Building them now (see above) closes this gap.
- **Audit log viewer:** Requires backend audit storage and a new endpoint; planned in build order after diagnostics and logs.
- **Billing/usage:** Partially in company detail; a dedicated “Billing” or “Usage” page can be added once usage/billing data model is final.
- **Feature flags / country defaults:** Product decisions; implement when prioritised.

Following this plan and the build prompt will make Super Admin a complete, database-backed, real-time-ready control plane with no missing critical pages or bad logic for a successful SaaS.
