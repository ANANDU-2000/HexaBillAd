# PostgreSQL Production Database Audit

Checklist for tables, columns, SQL, and migration risks before production deploy.

---

## Do you need to update EVERYTHING? NO.

**Most of the app does NOT need changes:**
- **Entity Framework / LINQ** – EF Core + Npgsql translates C# queries to PostgreSQL SQL automatically. No raw SQL.
- **99% of code** – Uses `_context.Sales.Where(...)`, `_context.Users.ToListAsync()` etc. – database-agnostic.
- **AppDbContextModelSnapshot** – Uses INTEGER/TEXT as EF’s internal model; migrations define the real schema. Don’t change.

**Only these need PostgreSQL-specific handling:**
1. Raw SQL (`ExecuteSqlRaw`, `ExecuteSqlInterpolated`) – must work on PostgreSQL
2. DB-detection paths (`sqlite_master` vs `information_schema`) – must branch by DB type
3. Migrations – type casts (e.g. integer→boolean) must use PostgreSQL syntax

---

## 1. Migration Fixes (Done)

| Migration | Issue | Fix |
|-----------|-------|-----|
| FixBooleanColumnsType | PostgreSQL 42804: integer→boolean cast | Raw SQL with `USING (CASE WHEN ...)` |
| AddUserSessionVersion | Wrong AlterColumn (boolean→INTEGER) | Removed; only adds SessionVersion, PaymentTerms |

---

## 2. Raw SQL / ExecuteSqlRaw Audit

| File | Risk | Status |
|------|------|--------|
| TenantContextMiddleware | `set_config('app.tenant_id', {0}, true)` | ✅ Parameterized ({0}) |
| DiagnosticsController table list | sqlite_master | ✅ Fixed: use information_schema for PostgreSQL |
| InvoiceNumberService | `pg_advisory_lock({lockId})` | ✅ Fixed: ExecuteSqlInterpolatedAsync |
| DiagnosticsController fix-columns | SQLite syntax | ✅ Skip for Npgsql (migrations handle schema) |
| PostgresBranchesRoutesSchema | Static DDL, PostgreSQL-specific | ✅ Safe |
| DatabaseFixer | SQLite only (`IsNpgsql() return`) | ✅ Never runs on PostgreSQL |
| Program.cs migrations | Parameterized INSERT | ✅ Safe |
| AddPerformanceIndexes.sql | Unquoted identifiers | ✅ Fixed: quoted "Sales", "NameEn" etc. |

---

## 3. Table / Column Checklist (PostgreSQL)

Key tables from migrations:

| Table | Key Columns | Notes |
|-------|-------------|-------|
| Users | SessionVersion (added), IsActive | SessionVersion added by AddUserSessionVersion |
| Customers | PaymentTerms (added), BranchId, RouteId | PaymentTerms added by AddUserSessionVersion |
| Branches | IsActive (boolean), Location, ManagerId | IsActive fixed by FixBooleanColumnsType |
| Routes | IsActive (boolean) | Same fix |
| Sales | BranchId, RouteId, TotalAmount, PaidAmount | From migrations |
| Payments | Reference, CreatedBy | From migrations |
| Products | CostPrice, SellPrice | numeric |
| InvoiceTemplates | IsActive | boolean |
| ExpenseCategories | IsActive | boolean |
| SubscriptionPlans | IsActive | boolean |

---

## 4. Known Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| fix-columns endpoint on PostgreSQL | Skip when `IsNpgsql()` – migrations handle schema |
| AddPerformanceIndexes unquoted | ✅ Fixed: quoted identifiers in SQL file |
| pg_advisory_lock interpolation | ✅ Fixed: ExecuteSqlInterpolatedAsync |

---

## 5. Manual Script

If migrations fail: `backend/HexaBill.Api/Scripts/FIX_PRODUCTION_MIGRATIONS.sql`

Run with: `psql $DATABASE_URL_EXTERNAL -f Scripts/FIX_PRODUCTION_MIGRATIONS.sql`
