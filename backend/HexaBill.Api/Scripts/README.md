# Database Scripts

## ⭐ Main Script (Use This)

**`01_COMPLETE_DATABASE_SETUP.sql`**

Single source of truth for enterprise database setup:
- ErrorLogs table
- DemoRequests table
- Performance indexes
- RLS policies (commented, enable if needed)
- Seed subscription plans

**When to run:** After EF Core migrations, once per environment.

---

## Archived Scripts

Old migration scripts moved to `archive/` folder:
- `RunAllMigrations.sql` → Use EF Core migrations instead
- `MigrateOwnerIdToTenantId.sql` → One-time migration (already done)
- `SeedSubscriptionPlans.sql` → Merged into main script
- `EnableRLS.sql` → Merged into main script
- `fix-index.sql` → One-time fix (already applied)

**Do not use archived scripts** - they are kept for reference only.

---

## Utility Scripts

- `BackfillPurchaseVAT.cs` - C# data migration script
- `SeedDefaultInvoiceTemplate.cs` - C# seed script
- `FixMissingColumns.cs` - C# migration script
- `*.ps1` / `*.bat` - PowerShell/Batch utility scripts

---

## Workflow

1. **EF Core Migrations** (automatic schema)
   ```bash
   dotnet ef migrations add MigrationName
   dotnet ef database update
   ```

2. **Enterprise Tables** (manual SQL)
   ```bash
   psql -d hexabill_db -f Scripts/01_COMPLETE_DATABASE_SETUP.sql
   ```

---

## Production: Branch/Route and ZAYOGA

**`FIX_PRODUCTION_MIGRATIONS.sql`** – Run on production if migrations failed or if `Sales.BranchId`/`Sales.RouteId` are missing.

1. **Run the script** (at least sections **5** and **5b**):
   - Section 5: adds `Sales.BranchId` and `Sales.RouteId` (and indexes/FKs).
   - Section 5b: backfills existing Sales with the tenant’s first branch (and route) so reports and branch/route tabs show real data.
2. **ZAYOGA tenant:** Ensure at least one **Branch** and, if needed, one **Route** exist for the ZAYOGA company (e.g. create via app or insert into `Branches`/`Routes`). Then re-run section 5b or run the script once so backfill assigns them.
3. **Safety:** Do not remove or weaken existing null/column-existence checks in code (BranchService, ReportService, ISalesSchemaService); the app already tolerates missing columns.

Usage (from `backend/HexaBill.Api`):
```bash
# Set PGPASSWORD then:
psql -h <host> -U hexabill_user hexabill -f Scripts/FIX_PRODUCTION_MIGRATIONS.sql
```

---

## Principles

✅ **PostgreSQL in production** – schema changes via **EF Core migrations only** (`dotnet ef database update`).  
✅ **One main SQL file** (`01_COMPLETE_DATABASE_SETUP.sql`) for enterprise tables (ErrorLogs, DemoRequests, etc.).  
✅ **No duplicate or ad-hoc SQL** for core schema (e.g. Product SKU index is in migration `ProductSkuUniquePerTenant`).  
✅ **Archive old scripts** (don't delete, keep for reference).
