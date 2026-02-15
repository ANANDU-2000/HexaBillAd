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

## Principles

✅ **PostgreSQL in production** – schema changes via **EF Core migrations only** (`dotnet ef database update`).  
✅ **One main SQL file** (`01_COMPLETE_DATABASE_SETUP.sql`) for enterprise tables (ErrorLogs, DemoRequests, etc.).  
✅ **No duplicate or ad-hoc SQL** for core schema (e.g. Product SKU index is in migration `ProductSkuUniquePerTenant`).  
✅ **Archive old scripts** (don't delete, keep for reference).
