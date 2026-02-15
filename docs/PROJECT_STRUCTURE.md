# HexaBill – Enterprise SaaS Project Structure

One place to see **what is client (tenant) vs Super Admin**, **where to edit**, and **how to merge without confusion**.

---

## 1. Repo layout (top level)

```
HexaBill-New/
├── backend/
│   └── HexaBill.Api/          # .NET API (Render/Docker)
├── frontend/
│   └── hexabill-ui/           # React/Vite app (Vercel)
├── docs/                      # All project docs (you are here)
├── .github/                   # CI workflows
├── render.yaml                # Render deploy config
└── README, .gitignore, etc.
```

- **Backend** = one API for both tenant (client) and Super Admin; role decides what you see.
- **Frontend** = one app; route and role decide: **Client app** (company workspace) vs **Super Admin** (platform control).

---

## 2. Who sees what (simple)

| User type | After login | What they see |
|-----------|-------------|---------------|
| **Client (company user)** | `/dashboard` and below | Products, POS, Ledger, Reports, Settings, Users, etc. — **one company only**. |
| **Super Admin** | `/superadmin/dashboard` and below | Platform Dashboard, Companies, Demo Requests, Health, Error Logs, Audit Logs, Help, Feedback. |

Same codebase; **routes and role** switch the experience.

---

## 3. Frontend: client vs Super Admin (where to edit)

### Path: `frontend/hexabill-ui/src/`

**Folder structure (actual layout):**

```
src/
├── App.jsx                    # Routes + Super Admin vs client redirect
├── pages/
│   ├── superadmin/            # ← Platform admin (Super Admin only)
│   │   ├── SuperAdminDashboard.jsx
│   │   ├── SuperAdminTenantsPage.jsx
│   │   ├── SuperAdminTenantDetailPage.jsx
│   │   ├── SuperAdminDemoRequestsPage.jsx
│   │   ├── SuperAdminHealthPage.jsx
│   │   ├── SuperAdminErrorLogsPage.jsx
│   │   └── SuperAdminAuditLogsPage.jsx
│   ├── company/               # ← Company app (client / tenant workspace)
│   │   ├── DashboardTally.jsx
│   │   ├── ProductsPage.jsx, PriceList.jsx, PosPage.jsx
│   │   ├── CustomerLedgerPage.jsx, SalesLedgerPage.jsx, ReportsPage.jsx
│   │   ├── PurchasesPage.jsx, ExpensesPage.jsx
│   │   ├── BranchesPage.jsx, BranchDetailPage.jsx, RoutesPage.jsx, RouteDetailPage.jsx
│   │   ├── UsersPage.jsx, SettingsPage.jsx, ProfilePage.jsx
│   │   ├── BackupPage.jsx, DataImportPage.jsx, SalesLedgerImportPage.jsx
│   │   ├── SubscriptionPlansPage.jsx, UpdatesPage.jsx
│   │   └── CustomersPage.jsx, BillingHistoryPage.jsx, PaymentsPage.jsx, Dashboard.jsx
│   ├── Login.jsx, SignupPage.jsx   # Auth (shared)
│   ├── HelpPage.jsx, FeedbackPage.jsx, ErrorPage.jsx, OnboardingWizard.jsx  # Shared
│   └── (nothing else – all app pages are in superadmin/ or company/)
├── components/
│   ├── SuperAdminLayout.jsx   # Super Admin sidebar + shell
│   ├── Layout.jsx             # Client app sidebar + shell
│   └── ...
├── services/, hooks/, utils/
└── ...
```

| Area | Folder / files | Who uses it | Edit when |
|------|-----------------|-------------|-----------|
| **Super Admin only** | `pages/superadmin/*.jsx` | SystemAdmin only | Adding/changing platform admin screens. |
| **Super Admin layout** | `components/SuperAdminLayout.jsx` | Wraps all Super Admin pages | Changing Super Admin sidebar/nav. |
| **Client (company) app** | `pages/company/*.jsx` | Company users (one company per login) | Adding/changing company features (products, POS, ledger, etc.). |
| **Shared pages** | `pages/Login.jsx`, `SignupPage.jsx`, `HelpPage.jsx`, `FeedbackPage.jsx`, `ErrorPage.jsx`, `OnboardingWizard.jsx` | Everyone or both roles | Auth and shared screens. |
| **Shared layout** | `components/Layout.jsx` | Wraps client app pages | Changing main app sidebar/nav. |
| **Routing / role** | `App.jsx` | Everyone | Adding routes; Super Admin vs client redirects. |
| **Login** | `pages/Login.jsx` | Everyone | Login form; redirects Super Admin to `/superadmin/dashboard`. |
| **Shared** | `components/Modal.jsx`, `Loading.jsx`, `components/ui/*`, `services/`, `hooks/` | Both | Shared UI and API layer. |

### Super Admin pages (all in one folder – do not mix with client)

| File | Path | Route | Purpose |
|------|------|--------|---------|
| SuperAdminDashboard.jsx | `pages/superadmin/` | `/superadmin/dashboard` | Platform metrics |
| SuperAdminTenantsPage.jsx | `pages/superadmin/` | `/superadmin/tenants` | Companies list |
| SuperAdminTenantDetailPage.jsx | `pages/superadmin/` | `/superadmin/tenants/:id` | One company detail |
| SuperAdminDemoRequestsPage.jsx | `pages/superadmin/` | `/superadmin/demo-requests` | Demo requests |
| SuperAdminHealthPage.jsx | `pages/superadmin/` | `/superadmin/health` | Platform health + Run migrations |
| SuperAdminErrorLogsPage.jsx | `pages/superadmin/` | `/superadmin/error-logs` | Error logs |
| SuperAdminAuditLogsPage.jsx | `pages/superadmin/` | `/superadmin/audit-logs` | Audit logs |

### Client pages (company workspace – one company per user)

**All in `pages/company/`:** DashboardTally, ProductsPage, PriceList, PosPage, CustomerLedgerPage, SalesLedgerPage, ReportsPage, PurchasesPage, ExpensesPage, BranchesPage, BranchDetailPage, RoutesPage, RouteDetailPage, UsersPage, SettingsPage, ProfilePage, BackupPage, DataImportPage, SalesLedgerImportPage, SubscriptionPlansPage, UpdatesPage, CustomersPage, BillingHistoryPage, PaymentsPage, Dashboard.  
Routes under `Layout.jsx` that are **not** `/superadmin/*` use these company pages.

---

## 4. Backend: client vs Super Admin (where to edit)

### Path: `backend/HexaBill.Api/`

| Area | Folder / files | Who calls it | Edit when |
|------|-----------------|--------------|-----------|
| **Super Admin APIs** | `Modules/SuperAdmin/` | Only when user is SystemAdmin (or specific roles per endpoint) | Platform-level: tenants, dashboard, demo requests, diagnostics. |
| **Client (tenant) APIs** | `Modules/` **except** `SuperAdmin/` (e.g. Billing, Branches, Customers, Auth, etc.) | Company users (scoped by TenantId) | Company features: products, sales, ledger, users, settings, etc. |
| **Shared** | `Models/`, `Data/`, `Shared/`, `Migrations/` | Both | DB, auth, middleware, DTOs. |

### Super Admin backend (do not mix with tenant logic)

| File | Purpose |
|------|--------|
| `SuperAdminTenantController.cs` | Tenant CRUD, dashboard, suspend, activate, users, etc. |
| `SuperAdminTenantService.cs` | Business logic + DTOs (e.g. TenantDto, TenantDetailDto) |
| `DiagnosticsController.cs` | Health, error-logs, audit-logs, migrate (route prefix `api`) |
| `DemoRequestController.cs` | Demo requests |
| `DashboardController.cs` | Platform dashboard |

Tenant-scoped controllers live in other `Modules/*` and use `TenantId` from context.

---

## 5. Super Admin ID logic (how we know who is Super Admin)

**Backend**

- **Database:** Super Admin user has **`TenantId = null`** (no company). Role is still `Owner`; the “Super Admin” behaviour comes from having no tenant.
- **JWT:** Login puts **`tenant_id` = "0"** in the token when `User.TenantId` is null, and adds **role claim `"SystemAdmin"`** so `[Authorize(Roles = "SystemAdmin")]` works.
- **Check:** Controllers use **`IsSystemAdmin`** (from `TenantIdExtensions`): true when **`tenant_id`** claim is **0** (or missing and treated as 0). So “Super Admin” = **tenant_id 0** in the token.

**Frontend**

- **Check:** `isSystemAdmin(user)` in `utils/superAdmin.js`:
  1. If `user.tenantId === 0` or `user.tenantId === null` → true.
  2. Else decode JWT from localStorage; if **`tenant_id`** is **0** or null → true.
  3. Else if `user.role === 'SystemAdmin'` or `user.isSystemAdmin === true` → true.
- **Login:**  
  - **Admin portal** (`/Admin26`): only users who pass `isSystemAdmin` can stay logged in; others get an error and are logged out.  
  - **Normal login** (`/login`): if `isSystemAdmin`, user is logged out and told to use the Admin Portal.

**Summary**

| Layer   | How Super Admin is identified                          |
|--------|---------------------------------------------------------|
| DB     | `User.TenantId IS NULL`                                 |
| JWT    | `tenant_id` = "0" and role "SystemAdmin"               |
| Backend| `IsSystemAdmin` = (tenant_id claim == 0)                |
| Frontend | `isSystemAdmin(user)` = (tenantId 0/null or role SystemAdmin) |

---

## 6. Default passwords (for setup and new companies)

| Context | Default password | Where it is used |
|---------|------------------|-------------------|
| **New company (tenant) owner** | `Owner123!` | When Super Admin creates a company, the first owner gets this password. Shown in API response and in Create Company flow. **Tell the client to change it after first login.** |
| **Super Admin / system user** | Set in DB or env (e.g. seed script / init). | Not hardcoded in repo; configure per environment. |

To change the **new-tenant default password**: update both  
`SuperAdminTenantService.cs` (hash when creating user) and  
`SuperAdminTenantController.cs` (value in `ClientCredentials` response).  
Keep them in sync.

---

## 7. GitHub merge – who edits what (avoid conflicts)

| Person / task | Prefer editing | Avoid editing same file as someone else |
|---------------|----------------|----------------------------------------|
| **Super Admin features** | `frontend/.../pages/superadmin/*.jsx`, `SuperAdminLayout.jsx`, `Modules/SuperAdmin/*`, `DiagnosticsController.cs` | Coordinate if both touch `App.jsx` or `services/index.js`. |
| **Client (company) features** | `pages/company/*.jsx`, `Layout.jsx`, other `Modules/*` | Same: coordinate on `App.jsx`, `api.js`, shared components. |
| **Auth / routing** | `App.jsx`, `Login.jsx`, `useAuth`, backend Auth | One person at a time or small, focused PRs. |
| **Shared UI / API** | `components/ui/*`, `services/index.js` | Prefer one PR per shared change; others pull before branching. |

**Best practice:**  
- Pull `main` before starting work.  
- One feature per branch/PR when possible.  
- If two people need the same file, split work (e.g. one does Super Admin nav, one does client nav) or merge `main` into your branch often.

---

## 8. Quick reference

- **Client (tenant)**: company workspace — products, POS, ledger, reports, settings, users, branches, routes.  
  **Frontend:** `pages/company/*.jsx`; **Backend:** `Modules/*` except `SuperAdmin/`.
- **Super Admin**: platform control — companies, health, logs, demo requests.  
  **Frontend:** `pages/superadmin/*.jsx` + `SuperAdminLayout.jsx`; **Backend:** `Modules/SuperAdmin/` + `DiagnosticsController.cs`.
- **Default new-company password:** `Owner123!` (change in both TenantService and TenantController if you change it).
- **Merge:** Work in your area; pull often; one feature per PR when possible.

Use this doc so everyone knows **which files are client vs Super Admin** and **how to merge without confusion**.
