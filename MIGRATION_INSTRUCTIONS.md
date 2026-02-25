# Data Isolation Fixes - Migration Instructions

## Summary of Changes

Four fixes have been implemented:

1. **InvoiceTemplate tenant scope** - Added TenantId, backfill in migration, all reads filter by tenant
2. **ExpenseCategory tenant scope** - Added TenantId, (TenantId, Name) unique, Return write-off per tenant
3. **Console.WriteLine removed** - Replaced with ILogger in PdfService, ExpenseService, ExpensesController, SettingsController, ValidationService
4. **OwnerId → TenantId** - New code uses TenantId; ensure data migration has run

## Database Migrations to Run

### 1. EF Core Migrations (InvoiceTemplate, ExpenseCategory)

```bash
cd backend/HexaBill.Api
dotnet ef database update
```

This applies:
- `20260225120000_AddInvoiceTemplateTenantId` - Adds TenantId to InvoiceTemplates, backfills from CreatedBy user
- `20260225130000_AddExpenseCategoryTenantId` - Adds TenantId to ExpenseCategories, backfills from Expenses, new unique index (TenantId, Name)

### 2. OwnerId → TenantId Data Migration (if not already run)

If your database still has NULL TenantId where OwnerId is populated, run:

```bash
psql -d your_database -f backend/HexaBill.Api/Scripts/archive/MigrateOwnerIdToTenantId.sql
```

This copies OwnerId → TenantId for Users, Sales, Customers, Products, etc.

### 3. Verify

- Login as different tenants; each sees only their invoice templates and expense categories
- PDF generation uses the correct tenant's template
- Return write-off category is created per tenant when needed
