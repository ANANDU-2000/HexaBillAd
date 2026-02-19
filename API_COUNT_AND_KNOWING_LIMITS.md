# API Count & How to Know When You're Hitting Plan Limits

## Real Numbers (Exact Counts)

### Backend API endpoints (total: **302**)

| Method   | Count | Description                          |
|----------|-------|--------------------------------------|
| **GET**  | **146** | Read: list, detail, search, export, reports |
| **POST** | **99**  | Create: login, signup, create records, actions |
| **PUT**  | **34**  | Update: edit tenant, user, settings, etc. |
| **PATCH**| **2**   | Partial update: resolve error, user ping |
| **DELETE** | **21** | Delete: tenant, user, backup, etc. |
| **TOTAL** | **302** | Unique API route endpoints |

### Frontend pages (total: **38** accessible; 5 removed)

**Removed from app (no route or nav):** Subscriptions (Owner + Super Admin), Import data, Import/sales-ledger, Updates.

| Group | Count | Pages (accessible) |
|-------|-------|--------|
| **Company (Owner/Staff)** | 25 | Dashboard, Products, PriceList, Purchases, POS, Ledger, Expenses, SalesLedger, Reports, Branches, BranchDetail, Routes, RouteDetail, Customers, CustomerDetail, Users, Settings, Backup, Profile, BillingHistory, Payments, Help, Feedback, OnboardingWizard |
| **Super Admin** | 10 | SuperAdminDashboard, Tenants, TenantDetail, DemoRequests, Health, ErrorLogs, AuditLogs, Settings, GlobalSearch, SqlConsole |
| **Auth / shared** | 4 | Login, Signup, ErrorPage, (Admin26 = super-admin login) |

So: **302 API endpoints** and **38 accessible pages** (Subscription, Subscriptions, Import, SalesLedgerImport, Updates removed). Each page load typically triggers **2–15+** API calls.

---

## Total API Endpoints (Backend) — by area

The HexaBill backend exposes **302 API endpoints** (GET, POST, PUT, PATCH, DELETE) across:

| Area | Approx. endpoints | Examples |
|------|-------------------|----------|
| **Super Admin** | ~50 | tenant list/crud, platform-health, backup, restore, limits, activity, impersonate |
| **Reports** | ~30 | summary, sales, products, aging, export PDF/Excel, sales-ledger |
| **Billing (Sales, Payments, Returns, Invoices)** | ~45 | sales CRUD, payments, returns, invoice templates, PDF, email |
| **Auth** | ~15 | login, signup, profile, validate, forgot, photo |
| **Products, Inventory** | ~25 | products CRUD, categories, stock adjustments, low-stock, import |
| **Customers** | ~15 | CRUD, search, ledger, statement, outstanding |
| **Branches & Routes** | ~25 | branches, routes, visits, route expenses |
| **Expenses** | ~15 | CRUD, categories, attachments, approve/reject |
| **Users** | ~10 | list, create, reset-password, assigned-routes |
| **Purchases & Suppliers** | ~15 | purchases CRUD, suppliers, analytics |
| **Subscription** | ~15 | plans, checkout, webhook, limits, metrics |
| **Others** | ~10 | alerts, validation, seed, import, diagnostics |

With many pages and concurrent users, each page load can trigger **several GET/POST** calls (often 2–15+ per page). So total **requests per minute** can grow quickly—that’s why the Starter plan (0.5 CPU, 512 MB) can hit limits under load.

---

## How to Know When You're Hitting Limits

### 1. **Super Admin Dashboard (in the app)**

- Open **Super Admin → Dashboard**.
- In the **Platform & connection** card you now have a **Resource usage (backend)** section that shows:
  - **Memory:** used MB and % (OK / Warning / Critical).
  - **DB connections:** active / max and pool %.
- **Interpretation:**
  - **OK** — No action.
  - **Warning (>75%)** — Plan for upgrade if this is frequent.
  - **Critical (>90%)** — Upgrade soon; you may see 500s or timeouts.

Below that section, a short note says: *“If memory or connections are often >75%, consider upgrading the Render plan. For live CPU/RAM, check Render dashboard → your service → Metrics.”*

### 2. **Render Dashboard (live metrics)**

- Go to [dashboard.render.com](https://dashboard.render.com) → your **backend service** (e.g. hexabill-api).
- Open **Metrics**.
- Check:
  - **Memory** — If often near 512 MB (Starter), you’re hitting RAM limits.
  - **CPU** — Sustained high usage can cause slow responses or timeouts.
- For the **PostgreSQL** service → **Metrics**: connections and storage.

### 3. **Errors that suggest limits**

- **Random 500** (especially under load) — Often memory or DB connections.
- **504 Gateway Timeout** — Request took too long (CPU or slow DB).
- **Slow** dashboard, reports, or tenant list when 2–3 users are active — Likely resource-related.

### 4. **What’s already in the UI**

- **Storage:** Dashboard shows **Total DB Storage Used** (real size from PostgreSQL when available) or **Estimated DB Storage** (row-based estimate). So you see real storage when the backend uses `pg_database_size`.
- **Per-tenant usage:** In **Tenant detail → Overview** you see **API requests (last 60 min)** and **Storage (estimate)**. In **Limits** tab you see and edit **max requests/min**, **max storage MB**, etc.

---

## Summary

| Question | Answer |
|----------|--------|
| **How many APIs?** | 200+ endpoints (GET, POST, PUT, PATCH, DELETE). |
| **How do I know if I’m hitting limits?** | 1) Super Admin Dashboard → Resource usage (memory + DB connections). 2) Render Dashboard → Service + DB Metrics. 3) Watch for random 500s, timeouts, slowness under load. |
| **Where is real storage shown?** | Platform overview card “Total DB Storage Used” when backend uses real DB size; tenant detail Overview + Usage tab. |
| **Where are limits shown?** | Tenant detail → Client controls block (limits summary) and **Limits** tab (edit max requests/min, storage, etc.). |

After deploying the latest backend, the **platform-health** API returns `resourceUsage` and the Super Admin Dashboard shows it so you can see at a glance when to consider upgrading the plan.

---

## Live check via Render (MCP or dashboard)

- **Backend service:** [HexaBill](https://hexabill.onrender.com) — Render service ID `srv-d68jpdvpm1nc7393q4d0`, **Starter** plan (0.5 CPU, 512 MB RAM).
- **Database:** **hexabill** — ID `dpg-d68jhpk9c44c73ft047g-a`, **basic_256mb**, 1 GB disk, Singapore.
- **Recent metrics (from Render):** Memory ~175–208 MB used (under 512 MB). CPU low. Some **500** and **404** responses in the last hour—500s from the tenant list (fixed with `Setting.value` → `value` after deploy); 404s from logo requests (ephemeral disk).
- To check anytime: use **Render dashboard** → HexaBill service → **Metrics** (memory, CPU, HTTP by status), or **Logs** for errors.

**Backend URL (production):** `https://hexabill.onrender.com` — use this for API and ledgers; frontend uses it via `apiConfig.js` (VITE_API_BASE_URL or default when hostname is not localhost).

**Fix applied (Feb 2026):** Render logs showed `42703: column s.Value does not exist` on production. A **backward-compatible migration** `EnsureSettingsValueColumnPascalCase` was added: if the Settings table has lowercase column `value`, it is renamed to `"Value"` so EF Core works. After deploy, run pending migrations so tenant list, login, and ledgers stop returning 500. **Slow load** can also be due to Render cold start (Starter plan sleeps after ~15 min); the app pings `/health` every 9 min when a user is logged in.

---

## Benefits of Removing Unwanted / Unused Pages

If you remove pages that nobody uses (or that you don’t need in production), you get:

| Benefit | Why it helps |
|--------|----------------|
| **Fewer API requests** | Each removed page = no more GET/POST when users would have opened it. Fewer requests per user session → less load on the backend and DB, lower chance of hitting rate limits (e.g. 429) or plan limits (512 MB, 0.5 CPU). |
| **Smaller frontend bundle** | Less JS/CSS shipped → faster load, especially on mobile. Fewer routes and components = smaller build. |
| **Less code to maintain** | Fewer pages and related API calls = fewer bugs, simpler upgrades, and less testing. |
| **Clearer navigation** | Fewer menu items and tabs = easier for users to find what they need; less “noise” for Staff/Owner. |
| **Lower “surface” for errors** | Fewer pages and endpoints = fewer places that can 500 or timeout under load. |

### How to decide what to remove

1. **Check usage** — If you have analytics or logs, see which routes/pages are rarely or never opened (e.g. Updates, Feedback, some report tabs, SQL Console if only you use it).
2. **Optional vs core** — Core for billing: Dashboard, POS, Ledger, Sales Ledger, Reports (summary/sales/outstanding), Products, Customers, Settings, Backup. Often optional or niche: PriceList, BillingHistory, DataImport, SalesLedgerImport, Updates, Help, Feedback, some report tabs (AI, cheque, staff), Super Admin SQL Console, Demo Requests.
3. **Don’t delete backend APIs yet** — You can hide or remove **frontend routes** first; keep the API in case you need it later or use it from another tool. Removing backend endpoints is a bigger change and can break mobile or integrations.

### Example (rough impact)

- If you **hide or remove 5 low-traffic pages** (e.g. Updates, Feedback, Help, PriceList, one report tab) and each would have triggered ~3 API calls per visit:
  - You avoid **~15 API calls per user** who would have opened those pages.
  - Over 100 sessions/day that would have hit those pages → **~1,500 fewer requests per day** on the backend.

So: **real numbers are 302 APIs and 38 accessible pages** (after removing Subscriptions, Import, Updates). Removing these pages reduces total requests, bundle size, and maintenance.

**After removing Subscriptions (Owner + Super Admin), Import, and Updates:** Fewer requests per session, smaller frontend bundle. **On the Starter plan (0.5 CPU, 512 MB), will everything work smooth?** **Yes**, for light-to-moderate usage (few companies, a few concurrent users). If you add many tenants or heavy report usage, monitor the Super Admin Dashboard “Resource usage” and consider Standard when memory or connections are often >75%.
