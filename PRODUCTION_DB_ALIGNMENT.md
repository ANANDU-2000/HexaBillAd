# Production PostgreSQL DB Alignment

## Migration to run on production

- **EnsureSettingsValueColumnPascalCase** (`20260219100000_EnsureSettingsValueColumnPascalCase.cs`): Ensures the `Settings` table has column `"Value"` (PascalCase). If production has lowercase `value`, it is renamed to `"Value"`. Backward-compatible; no data loss. **Action:** Run pending migrations on production (e.g. `dotnet ef database update` or your deployment pipeline) so this migration is applied.

## Entity / column mapping

- **Setting**: The only explicit `HasColumnName` in the codebase is `Setting.Value` → `"Value"` in [AppDbContext.cs](backend/HexaBill.Api/Data/AppDbContext.cs). This aligns with Npgsql/EF Core quoted identifiers in PostgreSQL.
- **All other entities**: Use default EF Core property names (PascalCase). Npgsql maps these to quoted column names (e.g. `"Key"`, `"OwnerId"`) in PostgreSQL. Migrations generated from the model define the schema; production should match after all migrations are applied.

## Destructive actions and transactions

- Backend destructive operations (tenant delete, reset, sales/purchases/returns, payments, stock adjustments, etc.) use `BeginTransactionAsync` and commit/rollback as per ENTERPRISE_SAAS_PRODUCTION_RULES (rule 6).

## NpgsqlRetryingExecutionStrategy and user-initiated transactions

- With PostgreSQL, `EnableRetryOnFailure` configures `NpgsqlRetryingExecutionStrategy`, which **does not support user-initiated transactions** (`BeginTransactionAsync`) unless the transaction is run inside the strategy. Any code that calls `_context.Database.BeginTransactionAsync()` must wrap the entire transaction block in `_context.Database.CreateExecutionStrategy().ExecuteAsync(async () => { ... })`. Otherwise you get: "The configured execution strategy 'NpgsqlRetryingExecutionStrategy' does not support user-initiated transactions."
- **Already wrapped:** PurchaseService (Create/Update/Delete), ProductService.AdjustStockAsync, StockAdjustmentService.CreateAdjustmentAsync, SaleService (Create, CreateWithOverride, Update, Delete, RestoreInvoiceVersion), ReturnService (CreateSaleReturn, CreatePurchaseReturn). Other services that use transactions (CustomerService, PaymentService, SignupService, etc.) should use the same pattern when using PostgreSQL with retry enabled.

## Known non-app console errors

- **"A listener indicated an asynchronous response by returning true, but the message channel closed"**: Comes from browser extensions (e.g. password managers, ad blockers), not from the app. No code change required.
