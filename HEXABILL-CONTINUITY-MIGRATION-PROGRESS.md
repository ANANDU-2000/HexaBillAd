# HexaBill ERP — Continuity Migration Progress Tracker

## Current Checkpoint
- **Active Release**: Release A & Operating Sequence Alignment
- **Active Phase**: P0 Continuous Workflow & Invoice Resequencing (6997–7012)
- **Last Status**: PASS (16/16 invoices verified live on production Render API and Vercel UI)

## Detailed Task Records

### [NUM-01] Invoice Numbering Sequence Alignment (Starplus 6996 -> FrozenHub 6997–7012)
- **Module**: Sales / Database / Sequence Management
- **Requirement**: Align all 16 active FrozenHub 1 invoices chronologically starting immediately after Starplus invoice #6996 (ended 31 Oct 2026), eliminating timestamp numbers (1791254852-1791254859) and filling the missing 7004 slot without losing any bills, items, or customer balances.
- **Root Cause**: FrozenHub POS originally issued timestamp IDs and started a duplicate series starting at 7000 while 7004 was held by a soft-deleted record (ID 1645).
- **Actions Taken**:
  1. Relabeled soft-deleted record ID 1645 from `7004` to `7004-VOID` to prevent duplicate key collisions.
  2. In an atomic PostgreSQL transaction, resequenced all 8 shifted operating invoices in descending order:
     - ID 1644: `7003` -> `7004`
     - ID 1643: `7002` -> `7003`
     - ID 1642: `7001` -> `7002`
     - ID 1641: `7000` -> `7001`
     - ID 1639: `1791254859` -> `7000`
     - ID 1638: `1791254858` -> `6999`
     - ID 1632: `1791254853` -> `6998`
     - ID 1631: `1791254852` -> `6997`
  3. Kept items 7005..7012 intact.
  4. Updated `InventoryTransactions.Reason` for each adjusted invoice.
  5. Recorded audit trail in `public.AuditLogs` (`InvoiceNumberChanged`).
  6. Configured `INVOICE_SERIES_START = 6997` in `public.Settings` for Tenant 20.
  7. Verified next invoice number via live API `/api/sales/next-invoice-number` returns `7013`.
  8. Verified live browser UI via Playwright on `https://frozenhub.hexabill.company/billing-history?tab=operating`.
- **Database Impact**: 8 sales updated, 1 void sale relabeled, audit logs inserted, zero loss of bills/items/payments.
- **Status**: PASS

### [SEC-01] Remove Hardcoded Fallbacks & Standalone Starplus Card
- **Module**: Frontend / Dashboard
- **Requirement**: Remove all static fallback numbers and standalone Starplus card in `DashboardTally.jsx`.
- **Root Cause**: `legacyMetrics?.activeGrandTotal || 3817356.88` evaluated on other tenants when API failed.
- **Changed Files**: `frontend/hexabill-ui/src/features/dashboard/DashboardTally.jsx`
- **Database Impact**: None
- **Status**: IN PROGRESS

### [SEC-02] Remove Hardcoded Fallbacks in Reports
- **Module**: Frontend / Reports
- **Requirement**: Remove static fallback values in `ReportsPage.jsx`.
- **Root Cause**: Hardcoded fallback values in comparative/legacy report views.
- **Changed Files**: `frontend/hexabill-ui/src/features/reports/ReportsPage.jsx`
- **Database Impact**: None
- **Status**: IN PROGRESS

### [API-01] Resolve Legacy Schema Mismatch
- **Module**: Backend / EF Core / PostgreSQL
- **Requirement**: Reconcile `LegacyEntities.cs` with `public.LegacyInvoices` schema (`DueDateSource`, `Notes`, `ItemsCount`, `SourceExternalReference`).
- **Root Cause**: `public.LegacyInvoices` lacked `DueDateSource` and `Notes`; had `ItemsCount` and `SourceExternalReference` whereas C# model mapped to `ItemCount` and `ExternalReference`.
- **Changed Files**:
  - `backend/HexaBill.Api/Models/Legacy/LegacyEntities.cs`
  - `tools/StarplusMigrationRunner/SchemaBuilder.cs`
- **Database Impact**: Additive `ALTER TABLE "LegacyInvoices"` for missing columns; zero data loss.
- **Status**: IN PROGRESS
