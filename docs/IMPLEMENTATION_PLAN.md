# HexaBill Implementation Plan — Ordered by Risk and Dependency

This document is the **task and build** plan derived from the Enterprise Architecture Plan. It includes repository analysis findings and a clear **which first** recommendation.

---

## Which to Do First (A–E)

**Recommended order:**

| Order | Item | Why first |
|-------|------|-----------|
| **1** | **E) Lock security + role permissions** | Prevents data leak and tenant crossover before adding more features. Foundation for everything else. |
| **2** | **A) Implement Branch + Route architecture** | Core business feature; Sales and reports depend on it. No Branch/Route entities exist today. |
| **3** | **C) Fix import / backup system** | CSV has no transaction/rollback; restore has transaction but schema validation weak. Data integrity risk. |
| **4** | **B) Fix SuperAdmin to enterprise level** | Needs tenant controls, usage metrics, feature flags, reset data with confirmation. Depends on stable security and data. |
| **5** | **D) Fix mobile POS UI** | UX polish after backend and data are stable. |

**Do not do all at once.** Complete E → A → C in that order, then B, then D.

---

## Repository Analysis Summary

### Backend structure (current)

- **HexaBill.Api** is the main API project (not yet split into Core/Application/Infrastructure/API).
- **Modules:** Auth, Billing (Sales, Returns, Pdf, Invoice), Customers, Expenses, Import, Inventory, Notifications, Purchases, Payments, Reports, Seed, SuperAdmin, Subscription, Users.
- **Shared:** Middleware (Jwt, TenantContext, DataValidation, GlobalException, RateLimiting, Subscription, PostgreSqlErrorMonitoring), Extensions (TenantId, OwnerId, DatabaseFixer, etc.), Services (Audit, ErrorLog, TenantContext), Validation (TimeZone, Currency, ValidationService).
- **Data:** AppDbContext, DesignTimeDbContextFactory.
- **Models:** In `Models/` (Tenant, User, Sale, Customer, Product, etc.). **No Branch, Route, RouteCustomer, RouteStaff, RouteExpense entities.**

### Findings

#### 1. OwnerId vs TenantId

- **OwnerId** still used in: AuditService, JwtMiddleware, DataValidationMiddleware, TenantIdExtensions, OwnerIdExtensions, SuperAdmin (SuperAdminController, SettingsService), Seed, PurchaseService, PaymentService, StockAdjustmentService, ProductService, SalesLedgerImportService, ExpenseService, CustomerService, SaleService.
- **Docs:** TENANT_MODEL.md, CLEANUP_SUMMARY.md, ARCHITECTURE_LOCK.md describe migration OwnerId → TenantId; migration scripts exist in `Scripts/archive/`.
- **Action:** Finish TenantId migration; remove OwnerId from code and queries once migration is verified. Keep one path (TenantId) for all tenant scoping.

#### 2. SQLite vs PostgreSQL

- **Dual database:** Program.cs and DesignTimeDbContextFactory choose Npgsql vs SQLite by connection string. Default in appsettings is SQLite.
- **SQLite-specific:** DatabaseFixer (SQLite only), BackupService/ComprehensiveBackupService (SQLite path for file backup), ReportService/CustomerService/AuthService have SQLite comments or fallbacks.
- **Action:** If production is PostgreSQL-only: remove SQLite fallback from Program, require PostgreSQL, and make backup/restore and fixers PostgreSQL-aware only where needed.

#### 3. Duplicate / legacy

- **Two tenant-scoping helpers:** OwnerIdExtensions (GetOwnerIdFromToken, CurrentOwnerId) and TenantIdExtensions (CurrentTenantId, etc.). One should be canonical (TenantId).
- **Archive scripts:** RunAllMigrations.sql, MigrateOwnerIdToTenantId.sql, fix-index.sql in `Scripts/archive/` — keep for reference; do not run repeatedly. fix-index.ps1 references OwnerId index; when moving to TenantId-only, use (TenantId, InvoiceNo) unique index.

#### 4. Security and tenant isolation

- **DashboardController** and many services filter by `TenantId` when `!isSystemAdmin`. Good.
- **Risk:** Any endpoint that loads by Id only (e.g. GET by sale id) must enforce `sale.TenantId == CurrentTenantId`. Full controller-by-controller audit recommended (see Phase 1 tasks).
- **ResetService:** ResetOwnerDataAsync(tenantId) exists for tenant-scoped reset. SuperAdmin must call it with confirmation only.

#### 5. Import / backup

- **SalesLedgerImportService.ApplyImportAsync:** No `BeginTransactionAsync`. Saves per row (SaveChangesAsync in loop). **Failure leaves partial data; no rollback.** Critical fix: wrap full apply in a single transaction and rollback on any error.
- **ComprehensiveBackupService restore:** Uses transaction (BeginTransactionAsync, RollbackAsync, CommitAsync). Good. Add strict schema/version validation and required-column checks before applying.
- **CSV/import:** Add strict column mapping, required fields, numeric/date validation, and duplicate invoice check (per tenant) before insert.

#### 6. Branch + Route

- **No Branch or Route entities in AppDbContext.** No RouteCustomers, RouteStaff, RouteExpenses.
- **Sales** model has no BranchId, RouteId. Reports and filters cannot be by branch/route yet.
- **Action:** Add entities and migration; add BranchId/RouteId to Sale and Expense; implement route-based filtering and calculations as in ENTERPRISE_ARCHITECTURE_PLAN.md.

#### 7. SuperAdmin

- **DashboardController:** Tenant-scoped dashboard (sales, purchases, expenses, profit). Not the SuperAdmin platform dashboard.
- **SuperAdmin module:** Tenant CRUD, backup, reset, diagnostics, demo requests, settings. Missing: usage metrics (DB size, API calls, storage per tenant), feature flags per tenant, tenant suspend/activate, reset-tenant-data with double confirmation in UI, error logs viewer, revenue/cost dashboard.

---

## Phase 1 — Security and tenant isolation (E)

**Goal:** No data leak; every query and endpoint tenant-safe.

1. Audit all API controllers: ensure every GET/PUT/DELETE by id checks `TenantId == CurrentTenantId` (or SuperAdmin).
2. Canonical tenant scope: use TenantId only; remove or wrap OwnerId usage so that only one path (TenantId) is used in application code.
3. Middleware: validate tenant active (subscription/status) and JWT and role where needed.
4. Document strict role model: SuperAdmin, Owner, Manager, Staff; what each can see (e.g. Staff no global profit).
5. Add RLS or equivalent guarantee: all queries filtered by TenantId for non–SuperAdmin.

**Deliverable:** Security audit report + fixes; no endpoint that returns or mutates another tenant’s data.

---

## Phase 2 — Branch + Route architecture (A)

**Goal:** Branches and routes exist; sales and expenses can be assigned; reports filter by branch/route.

1. Add entities: Branch, Route, RouteCustomer, RouteStaff, RouteExpense (see ENTERPRISE_ARCHITECTURE_PLAN.md).
2. Add BranchId, RouteId to Sale and Expense (and any other needed tables). Migration.
3. Indexes: TenantId, BranchId, RouteId on Sales, Expenses, and mapping tables.
4. APIs: CRUD for Branches and Routes; assign staff/customers to routes; route expense CRUD.
5. Report and dashboard logic: filter by branch, route, staff; route profit = route sales − route expenses; branch profit = sum of route profits; company = sum of branches.
6. Owner: can assign staff to routes; staff see only their route data (enforce in queries by role).

**Deliverable:** Branch/route data model, APIs, and report filters working; no UI redesign yet.

---

## Phase 3 — Import and backup fix (C)

**Goal:** Reliable CSV import and backup restore; no partial state.

1. **CSV import (SalesLedgerImportService):**
   - Wrap ApplyImportAsync in a single database transaction; rollback on any error.
   - Strict column mapping and required fields; validate numeric and date formats; check invoice uniqueness per tenant before insert; reject duplicates.
2. **Backup/restore:**
   - Validate backup file version and schema before restore; validate required columns; keep transaction and rollback on failure.
   - Export format: include Branches, Routes (and related) in backup payload when Phase 2 is done.
3. **Tests:** Import with bad data must rollback; restore with wrong schema must abort.

**Deliverable:** Transactional import; validated restore; no partial imports.

---

## Phase 4 — SuperAdmin enterprise (B)

**Goal:** SuperAdmin dashboard and controls at enterprise level.

1. **Dashboard:** Total/active/suspended tenants, monthly revenue, cloud cost estimate, DB storage per tenant, error log summary, daily API calls, top 5 usage tenants, latest login attempts.
2. **Tenant controls:** View profile, reset password, suspend/activate, delete, reset tenant data (with double confirmation), force logout, force upgrade.
3. **Usage:** DB size, sales/invoice count, storage, API usage, daily active users per tenant.
4. **Feature flags:** Per-tenant toggles for Routes, Branches, AI, Advanced Reports, WhatsApp (stored in DB; no UI redesign yet if not needed).
5. **Audit:** Who changed price, deleted invoice, reset data, changed role (use existing AuditLog; ensure SuperAdmin can query by tenant and action).

**Deliverable:** SuperAdmin dashboard and tenant management meeting the enterprise plan.

---

## Phase 5 — Mobile POS UI fix (D)

**Goal:** Mobile POS usable; no double scroll; consistent layout.

1. Apply UI/UX rules from ENTERPRISE_ARCHITECTURE_PLAN.md (no emojis, primary #1E3A8A, 8px scale, max width 1280px, no duplicate buttons, no double scroll on mobile).
2. Fix mobile-specific issues (e.g. bottom nav, single scroll, touch targets).

**Deliverable:** POS and key flows verified on mobile.

---

## Phase 6 — Scale and polish (later)

- Query optimization and indexing for 1000 tenants.
- Pagination and projection everywhere; no full-table load.
- Load testing.
- Clean folder structure (Core/Application/Infrastructure/API) if desired; can be done incrementally after Phase 2.

---

## Task checklist (high level)

- [ ] **E** Security: controller audit, TenantId-only path, middleware, role model, RLS/guarantees.
- [x] **A** Branch/Route: entities, migration, Sale links (BranchId, RouteId), APIs (Branches, Routes, RouteExpenses), branch/route summaries; report filters and role-based visibility pending.
- [x] **C** Import: transaction (done); validation + duplicate check (partial); Restore: schema/version validation (pending).
- [ ] **B** SuperAdmin: dashboard metrics, tenant controls, usage, feature flags, audit.
- [ ] **D** Mobile POS UI fixes per enterprise UI rules.

Use **ENTERPRISE_ARCHITECTURE_PLAN.md** for detailed structure and rules. Use this document for execution order and tasks.

---

## Completed (cleanup and Phase C partial)

- **Repo cleanup:** Removed 17+ obsolete root/docs MD files, root scripts (clean_migration.ps1/.py, clean_snapshot.py), PLAN.txt. Updated .gitignore for log/copy files.
- **Phase C (import):** SalesLedgerImportService.ApplyImportAsync now uses a single database transaction; on any row error the transaction is rolled back and no partial data is persisted.
