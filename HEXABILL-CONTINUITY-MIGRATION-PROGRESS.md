# HexaBill ERP — Continuity Migration Progress Tracker

## Current Checkpoint
- **Active Release**: Release A (Security & API Hotfix)
- **Active Phase**: P0 Security & Schema Rectification

## Detailed Task Records

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
