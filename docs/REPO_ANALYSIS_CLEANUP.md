# Repository Analysis and Cleanup Checklist

Generated from enterprise plan analysis. Use with `ENTERPRISE_ARCHITECTURE_PLAN.md` and `IMPLEMENTATION_PLAN.md`.

---

## Completed (cleanup run)

- **Removed root:** PLAN.txt, clean_migration.ps1, clean_migration.py, clean_snapshot.py, HEXABILL_100_TASKS.md, HEXABILL_TASK_BUILD_PLAN.md, HEXABILL_MASTER_PRODUCT_CONTROL_PROMPT.md, PLAN_BUILD.md, MUSTDO.MD, BACKEND_BUILD_STATUS.md, INSTALLATION_STATUS.md, RUNNING_STATUS.md, PAGES_AND_DB_VERIFICATION.md, RUN_MIGRATION_AND_FIX.md, IMPORT_OUTSIDE_APP_PLAN.md, HEXABILL_SAAS_ARCHITECTURE.md, QA_TEST_SIGN_OFF.md.
- **Removed docs:** CLEANUP_SUMMARY.md, DATABASE_AND_IMPORT_MASTER_PROMPT.md, DATABASE_AND_IMPORT_TASKS.md, UI_UX_TASKS_BY_PAGE.md, UI_UX_DESIGN_LOCK.md, MOBILE_UX_TASK_PLAN.md, HEXABILL_UX_UI_MASTER_PROMPT.md, HEXABILL_GOAL_AND_PROMPT.md, FOLDER_STRUCTURE.md, SQLITE_VS_POSTGRESQL_AND_MIGRATION_LIST.md, POSTGRESQL_MIGRATION_STATUS.md, RUN_BACKEND_FRONTEND_AND_POSTGRESQL.md.
- **.gitignore:** Added migration_log.txt, log_copy.txt, init_output.txt, backend-output.log, server.log, curl-output.txt, ps_output.txt, push_log.txt, git_remote_output.txt.
- **Import fix (Phase C):** SalesLedgerImportService.ApplyImportAsync now runs in a single transaction; rollback on any error (no partial import).

---

## Backend structure (current)

- **HexaBill.Api:** Single API project (not yet Core/Application/Infrastructure/API).
- **Modules:** Auth, Billing, Customers, Expenses, Import, Inventory, Notifications, Purchases, Payments, Reports, Seed, SuperAdmin, Subscription, Users.
- **Shared:** Middleware, Extensions, Services, Validation.
- **Data:** AppDbContext, DesignTimeDbContextFactory.
- **Models:** In `Models/`. No Branch, Route, RouteCustomer, RouteStaff, RouteExpense.

To generate full tree (exclude bin/obj/node_modules):  
`tree /F /A backend\HexaBill.Api` (then manually exclude bin, obj) or use PowerShell `Get-ChildItem -Recurse` with filters.

---

## Remove or consolidate

| Category | Item | Action |
|----------|------|--------|
| **OwnerId** | Used in 15+ backend files (services, middleware, SuperAdmin, Seed, Billing, etc.) | Complete TenantId migration; then remove OwnerId from code and use (TenantId, InvoiceNo) index |
| **Dual tenant helpers** | OwnerIdExtensions + TenantIdExtensions | Keep TenantIdExtensions as canonical; deprecate OwnerId in application code |
| **SQLite** | Program.cs, DesignTimeDbContextFactory, DatabaseFixer, BackupService, ComprehensiveBackupService | If PostgreSQL-only: remove SQLite path and SQLite-specific fixers/backup logic |
| **Archive scripts** | Scripts/archive/RunAllMigrations.sql, MigrateOwnerIdToTenantId.sql, fix-index.sql | Keep for reference; do not run repeatedly. Update fix-index to TenantId when migration done |
| **Root-level scripts** | clean_migration.ps1, clean_migration.py, clean_snapshot.py | **Done:** Removed. |
| **Log/copy files** | migration_log.txt, log_copy.txt, init_output.txt, backend-output.log, etc. | Add to .gitignore; do not commit; delete from repo if committed |
| **Duplicate validation** | Multiple places checking tenant/role | Centralize in middleware or base controller |

---

## Dead or unused (verify before delete)

- Controllers not registered in Program.cs or not referenced by frontend.
- Services in Shared or Modules not injected anywhere.
- Old migrations (other than InitialPostgreSQL) if not applied.
- Unused SQL files outside Scripts/archive and Scripts/01_COMPLETE_DATABASE_SETUP.sql.

**Rule:** If file not referenced in solution or by running app → delete or archive.

---

## Security — tenant filter audit

- **DashboardController:** Filters by TenantId when not SuperAdmin. Good.
- **All GET/PUT/DELETE by id:** Must verify `resource.TenantId == CurrentTenantId` (or SuperAdmin). Full audit recommended in Phase 1 (see IMPLEMENTATION_PLAN.md).
- **SalesLedgerImportService:** Uses tenantId parameter; ensure caller passes only current tenant.

---

## Import / backup — critical gaps

| Area | Finding | Fix |
|------|---------|-----|
| **SalesLedgerImportService.ApplyImportAsync** | No transaction; SaveChangesAsync per row | **Done:** Wrapped in single transaction; rollback on any error. |
| **CSV/Import** | Column mapping flexible; no strict required fields or duplicate invoice check | Add schema validation, required columns, numeric/date validation, duplicate invoice rejection per tenant |
| **ComprehensiveBackupService restore** | Uses transaction (good) | Add file version and schema validation before applying |
| **Backup export** | No Branches/Routes yet | After Phase 2, add Branch/Route data to backup payload |

---

## Branch + Route — implemented

- **Done:** Branch, Route, RouteCustomer, RouteStaff, RouteExpense entities; Sale has BranchId, RouteId.
- **Done:** Branches API (CRUD, branch summary), Routes API (CRUD, assign customers/staff, route summary), Route expenses API (Fuel, Staff, Delivery, Misc).
- **Pending:** Reports/customer ledger filter by branch/route; staff-only see their route (role-based).

---

## SuperAdmin — gaps

- Missing: usage metrics (DB size, API calls, storage per tenant), feature flags per tenant, tenant suspend/activate in UI, reset tenant data with double confirmation.
- Missing: SuperAdmin dashboard with revenue, cloud cost, top tenants, error logs summary, latest logins.
- ResetService.ResetOwnerDataAsync exists; ensure SuperAdmin UI calls it with confirmation only.

---

## Execution order (recap)

1. **E** — Security and role permissions (tenant audit, TenantId-only, RLS/middleware).
2. **A** — Branch + Route architecture (entities, Sale/Expense, APIs, reports).
3. **C** — Import/backup fix (transaction, validation, schema).
4. **B** — SuperAdmin enterprise (dashboard, tenant controls, usage, flags).
5. **D** — Mobile POS UI.

See **IMPLEMENTATION_PLAN.md** for phase tasks and deliverables.
