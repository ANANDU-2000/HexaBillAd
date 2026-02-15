# Super Admin – Feature Count, Missing Features, Database, and Per-Page Build Prompts

Single reference: **how many features now**, **what’s missing**, **database management + queries**, and **per-page prompts** (backend logic + frontend UX + **modern UI style**). Use this so every page is feature-backed, all queries work, actions are easy, and UI is **modern/professional**, not generic or old.

---

## 1. Feature count: current vs missing

### Current Super Admin features (9 pages, 7 in nav)

| # | Feature | Route | Backend / queries | Status |
|---|--------|--------|--------------------|--------|
| 1 | Platform Dashboard | `/superadmin/dashboard` | `GET /api/superadmin/tenant/dashboard` | ✅ Built |
| 2 | Companies (list + CRUD) | `/superadmin/tenants` | `GET/POST /api/superadmin/tenant`, search, status, LogoPath | ✅ Built |
| 3 | Company detail | `/superadmin/tenants/:id` | `GET/PUT/DELETE` tenant, users, subscription, usage, suspend, activate, clear-data | ✅ Built |
| 4 | Demo requests | `/superadmin/demo-requests` | Demo request list + approve/reject APIs | ✅ Built |
| 5 | Platform Health | `/superadmin/health` | `GET /api/superadmin/platform-health` (DB, migrations, company count) | ✅ Built |
| 6 | Error Logs | `/superadmin/error-logs` | `GET /api/error-logs?limit=` | ✅ Built |
| 7 | Audit Logs | `/superadmin/audit-logs` | `GET /api/superadmin/audit-logs` (paged) | ✅ Built |
| 8 | Help | `/help` | Static/support | ✅ Built |
| 9 | Feedback | `/feedback` | Feedback submit | ✅ Built |

**Total: 9 pages.** All have routes and nav (Help/Feedback shared).

### Missing or incomplete features

| # | Feature | Purpose | Priority |
|---|--------|---------|----------|
| 1 | **Database Management** | One place: DB status, last/pending migrations, **Run migrations** button, optional table list/row counts | **Done:** Platform Health page has “Run migrations” button (with confirm) when pending; `POST /api/migrate` secured SystemAdmin. |
| 2 | **Audit log filters** | Filter by tenant, user, action, date range (backend + frontend) | Medium |
| 3 | **Global search** | Search companies/users by name/email across platform | Medium |
| 4 | **Billing / usage (dedicated)** | Platform-level usage or billing view (usage exists in company detail) | Low |
| 5 | **Feature flags per company** | Enable/disable features per tenant | Low |
| 6 | **Country/region defaults** | Default currency, locale per country for new companies | Low |
| 7 | **Real-time** | Polling or SignalR for dashboard / error count / alerts | Low |

---

## 2. Database management feature + queries that must work

### What “Database Management” includes

- Reuse **Platform Health** data: DB connected, last migration, pending migrations, company count.
- Add **Run migrations** action: button that calls `POST /api/migrate` (with confirmation), show success or error.
- Optional later: **Table list** with row counts (new endpoint `GET /api/superadmin/database/tables` if needed; PostgreSQL: `information_schema.tables` + counts).

### Queries that must work (all used by current features)

| Query / API | Used by | Must return |
|-------------|---------|-------------|
| `GET /api/superadmin/tenant/dashboard` | Dashboard | Totals, lifecycle (companies, trial, active, etc.) |
| `GET /api/superadmin/tenant?page=&pageSize=&search=&status=` | Companies list | Paged items, totalCount, each item: Id, Name, LogoPath, Country, Currency, Status, UserCount, InvoiceCount, TotalRevenue, CreatedAt |
| `GET /api/superadmin/tenant/{id}` | Company detail | Full tenant + users + subscription + usage |
| `POST /api/superadmin/tenant` | Create company | New tenant + client credentials |
| `PUT /api/superadmin/tenant/{id}` | Edit company | Updated tenant |
| `PUT /api/superadmin/tenant/{id}/suspend` | Suspend | Success |
| `PUT /api/superadmin/tenant/{id}/activate` | Activate | Success |
| `POST /api/superadmin/tenant/{id}/clear-data` | Clear data | Success |
| `DELETE /api/superadmin/tenant/{id}` | Delete company | Success |
| `GET /api/superadmin/platform-health` | Health | success, database.connected, migrations.lastApplied, migrations.pending, companyCount, timestamp |
| `GET /api/error-logs?limit=` | Error Logs | success, count, items[] (Id, TraceId, ErrorCode, Message, Path, Method, TenantId, UserId, CreatedAt) |
| `GET /api/superadmin/audit-logs?page=&pageSize=` | Audit Logs | success, data.items, data.totalCount, data.page, data.pageSize, data.totalPages |
| `POST /api/migrate` | Run migrations (Diagnostics) | message, appliedMigrations or error |

All list/detail APIs must be **tenant-scoped where applicable** (platform-level endpoints are SystemAdmin-only and not tenant-scoped). No stub responses; errors must return proper status and message.

---

## 3. Modern UI style (no generic/old look)

Apply this to **every** Super Admin page so the product feels **modern and professional**, not AI-generic or dated.

### Layout and structure

- **Page container:** Consistent padding (e.g. `p-4 sm:p-6 lg:p-8`), min height, subtle background (e.g. `bg-neutral-50` or `bg-slate-50`).
- **Page header:** One clear title (e.g. `text-2xl` or `text-3xl font-bold`), one short subtitle (e.g. `text-neutral-500`). Primary action (e.g. “Add company”, “Refresh”) top-right, same style across pages.
- **Cards/sections:** White cards, `rounded-xl`, light border (`border-neutral-200`), soft shadow (`shadow-sm`). No heavy borders or flat gray boxes.

### Tables

- **Header:** `bg-neutral-50`, `text-xs font-semibold uppercase tracking-wider`, consistent padding.
- **Rows:** Hover state (e.g. `hover:bg-neutral-50`), clear cell padding, no cramped text.
- **Empty state:** Icon + short message (e.g. “No companies yet”), centered, muted color.
- **Loading:** Skeleton or spinner, no blank table.

### Buttons and actions

- **Primary:** One accent color (e.g. primary-600), `rounded-xl`, padding, hover state. Use for one main action per block.
- **Secondary:** Neutral (e.g. gray-100/gray-700), same rounding. Use for “Cancel”, “Refresh” (if not primary).
- **Destructive:** Red (e.g. red-600), only for delete/suspend/clear; always after confirmation.
- **Icons:** Use Lucide consistently; icon + text where it helps (e.g. “Check again”, “Refresh”).

### Typography and spacing

- **Font:** Same sans as app (e.g. Inter). No decorative or “AI” fonts.
- **Hierarchy:** Title > subtitle > body; use weight and color (e.g. `text-neutral-900`, `text-neutral-600`, `text-neutral-500`).
- **Spacing:** Consistent gaps (`gap-4`, `gap-6`), margins between sections (`mb-6`, `mb-8`).

### Avoid

- Generic “card with shadow” only, no structure.
- Dense tables with no hover or empty state.
- Multiple competing primary buttons.
- Inconsistent rounding (mix of `rounded-lg` and `rounded-xl`); pick one (e.g. `rounded-xl`).
- Loud gradients or playful illustrations for B2B admin.

---

## 4. Per-page build prompts (backend + frontend + UI)

Use each block as the **full prompt** for that page: feature, backend, frontend UX, and modern style.

---

### Page 1: Platform Dashboard

**Feature:** Platform-level metrics (company counts, trial/active, lifecycle).

**Backend:**  
- `GET /api/superadmin/tenant/dashboard` returns totals and lifecycle.  
- Queries: count tenants by status, optional recent signups, revenue aggregates.  
- No tenant filter (platform-wide). SystemAdmin only.

**Frontend / UX:**  
- One headline, one subtitle.  
- Stat cards in a grid (e.g. 2x2 or 3x2): Total companies, Active, Trial, Suspended, etc.  
- Each card: icon, value, label; optional small trend or subtitle.  
- Loading: skeleton or spinner. Error: inline message + retry.  
- No table on this page; keep it scannable.

**UI style:**  
- Cards: white, `rounded-xl`, border, `shadow-sm`.  
- Icons in a soft tint (e.g. blue-100 bg, blue-600 icon).  
- Numbers bold, labels muted.  
- Follow “Layout and structure” and “Typography and spacing” above.

---

### Page 2: Companies (list)

**Feature:** List all companies (tenants) with search, status filter, logo, key metrics; create company; open detail; quick actions (enter workspace, view, suspend, delete).

**Backend:**  
- `GET /api/superadmin/tenant?page=&pageSize=&search=&status=`.  
- Return: items[], totalCount, page, pageSize; each item with Id, Name, LogoPath, Country, Currency, Status, UserCount, InvoiceCount, TotalRevenue, CreatedAt.  
- All mutations (create, suspend, activate, delete) have clear success/error responses.

**Frontend / UX:**  
- Header: title “Companies”, subtitle, “Add company” primary button.  
- Filters: search input, status dropdown, “Refresh” secondary.  
- Table: Company (logo + name), Country, Currency, Status, Users, Invoices, Revenue, Created, Actions.  
- Logo: use LogoPath with API base URL; fallback to initial.  
- Row actions: Enter workspace, View, Suspend/Activate, Delete (with confirm modals).  
- Pagination: page size, prev/next, “Page X of Y”.  
- Empty state, loading state, error state.

**UI style:**  
- Table as in “Tables” above.  
- Company column: small avatar (e.g. 10x10) + name, aligned.  
- Status badges: consistent colors (e.g. green active, blue trial, amber suspended, red expired).  
- Follow “Buttons and actions” and “Avoid” above.

---

### Page 3: Company detail

**Feature:** Full company view: overview, users, subscription, usage; edit company; suspend/activate; clear data; delete; manage users (add, edit, reset password, remove).

**Backend:**  
- `GET /api/superadmin/tenant/{id}`: tenant + users + subscription + usage.  
- PUT tenant, PUT suspend/activate, POST clear-data, DELETE tenant.  
- Tenant users: POST/PUT/DELETE users, PUT reset-password.  
- All with validation and clear errors.

**Frontend / UX:**  
- Breadcrumb or back link to Companies list.  
- Tabs or sections: Overview, Users, Subscription, Usage (or single scroll).  
- Overview: name, logo, country, currency, status, created, trial end; Edit button.  
- Users: table (name, email, role); Add user; per-row Edit, Reset password, Remove (with confirm).  
- Subscription: plan, period, status; Update subscription action if supported.  
- Usage: metrics (invoices, revenue, etc.) from API.  
- Danger zone: Suspend, Clear data, Delete — each with confirmation modal and reason if needed.

**UI style:**  
- Same card and spacing rules.  
- Danger actions in a separate card (e.g. red border or “Danger zone” heading).  
- Modals: overlay, white content, rounded-xl, primary/cancel buttons.

---

### Page 4: Demo requests

**Feature:** List demo requests; approve (create company + optional credentials) or reject.

**Backend:**  
- List demo requests (pending, etc.).  
- Approve: create tenant + optionally return credentials.  
- Reject: update status.  
- Queries must filter and sort by date.

**Frontend / UX:**  
- Title “Demo requests”, subtitle.  
- Table: requester name/email, company name, date, status, actions (Approve, Reject).  
- Approve: optional modal or inline; show success with credentials if returned.  
- Reject: confirm; optional reason.  
- Empty and loading states.

**UI style:**  
- Same table and button rules.  
- Status badges for pending/approved/rejected.

---

### Page 5: Platform Health (Diagnostics)

**Feature:** DB status, last migration, pending migrations, company count; “Check again”; optional “Run migrations”.

**Backend:**  
- `GET /api/superadmin/platform-health`: database.connected, migrations.lastApplied, migrations.pending[], companyCount, timestamp.  
- `POST /api/migrate`: apply pending migrations; return message and applied list or error.  
- SystemAdmin only.

**Frontend / UX:**  
- Title “Platform Health”, subtitle.  
- “Check again” primary button.  
- Cards: Database (connected yes/no, error if any), Migrations (last applied, list of pending if any), Company count, Last check time.  
- If pending migrations: “Run migrations” button; confirm modal; on success show message and refresh health; on error show message.  
- Loading and error states.

**UI style:**  
- Cards with icons (e.g. Database, Hash, Building2, Server).  
- Green for OK, red for error, amber for pending.  
- Monospace for migration names.  
- Follow “Layout and structure” and “Buttons and actions”.

---

### Page 6: Error Logs

**Feature:** Last N server errors; columns: Time, TraceId, Code, Message, Path, Method, TenantId, UserId; Refresh.

**Backend:**  
- `GET /api/error-logs?limit=100` (or 500).  
- Return: items[], count; each with Id, TraceId, ErrorCode, Message, Path, Method, TenantId, UserId, CreatedAt.  
- Ensure 500s and critical errors are written to ErrorLogs (middleware/service).

**Frontend / UX:**  
- Title “Error Logs”, subtitle.  
- “Refresh” primary button.  
- Table: Time, TraceId, ErrorCode, Message, Path, Method, TenantId, UserId.  
- Message and path truncate with tooltip or expand.  
- Empty state: “No error logs in this batch”.  
- Loading state.

**UI style:**  
- Same table rules.  
- Error code in small badge (e.g. red-100/red-800).  
- Monospace for TraceId/Path if needed.

---

### Page 7: Audit Logs

**Feature:** Platform-wide activity log; paged; optional filters (tenant, user, action, date).

**Backend:**  
- `GET /api/superadmin/audit-logs?page=&pageSize=` (and later ?tenantId=&userId=&action=&from=&to=).  
- Return: items[], totalCount, page, pageSize, totalPages; each item: Id, TenantId, UserName, Action, EntityType, EntityId, Details, CreatedAt.  
- Queries: index on CreatedAt, TenantId; filter in app or DB.

**Frontend / UX:**  
- Title “Audit Logs”, subtitle.  
- “Refresh” button.  
- Table: Time, TenantId, User, Action, Entity, Details.  
- Pagination: prev/next, “Page X of Y”, total count.  
- Optional: filter bar (tenant, user, action, date range) when backend supports it.  
- Empty and loading states.

**UI style:**  
- Same table and spacing.  
- Time in locale string; entity as “EntityType #Id” if present.

---

### Page 8: Database Management (optional dedicated page)

**Feature:** Same as Platform Health plus explicit “Database” framing; Run migrations; optional table list with row counts.

**Backend:**  
- Reuse `GET /api/superadmin/platform-health` and `POST /api/migrate`.  
- Optional: `GET /api/superadmin/database/tables` returning table names and row counts (e.g. from PostgreSQL `information_schema` + COUNT per table). SystemAdmin only.

**Frontend / UX:**  
- Title “Database”, subtitle “Connection, migrations, and tables”.  
- Same health cards as Health page; “Run migrations” with confirmation.  
- Optional: second section “Tables” with table name + row count.  
- Loading and error states.

**UI style:**  
- Same as Platform Health; tables section in a card with simple two-column table.

---

## 5. Build order and “Run migrations” on Health page

1. **Add “Run migrations” to Platform Health page**  
   - Button visible when `migrations.pending.length > 0`.  
   - Confirm modal: “Apply X pending migrations?”  
   - Call `POST /api/migrate`; on success toast + refetch health; on error toast with message.  
   - Backend: `POST /api/migrate` already in DiagnosticsController; ensure it’s SystemAdmin or secured.

2. **Audit log filters (optional)**  
   - Backend: add query params to `GET /api/superadmin/audit-logs`.  
   - Frontend: filter bar and pass params.

3. **Database Management (optional)**  
   - Either: only add “Run migrations” to Health (no new page).  
   - Or: new route `/superadmin/database` with health + migrate + optional table list and new endpoint.

4. **UI pass on all Super Admin pages**  
   - Apply “Modern UI style” and “Per-page” prompts above: consistent header, cards, tables, buttons, empty/loading/error states.

---

## 6. One-line prompt per page (for quick reference)

- **Dashboard:** Platform metrics; GET dashboard; stat cards; modern cards and spacing.  
- **Companies:** List with logo, search, status, CRUD; GET tenant list + mutations; table + modals; modern table and buttons.  
- **Company detail:** Full tenant + users + subscription + usage; GET tenant by id + user APIs; tabs/sections + danger zone; modern cards and modals.  
- **Demo requests:** List and approve/reject; list + approve/reject APIs; table + actions; modern table.  
- **Platform Health:** DB + migrations + company count + Run migrations; GET platform-health + POST migrate; cards + confirm; modern cards.  
- **Error Logs:** Last N errors; GET error-logs; table + Refresh; modern table.  
- **Audit Logs:** Platform activity; GET audit-logs paged; table + pagination + optional filters; modern table.  
- **Database (optional):** Health + migrate + optional tables; same as Health + optional GET tables; same UI rules.

Use this doc so **every Super Admin feature is counted**, **missing items are listed**, **database and queries are defined**, and **each page has a full build prompt with modern UI** — no generic or old-looking screens.
