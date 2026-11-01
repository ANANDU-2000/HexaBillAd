# HexaBill ERP — Continuity Migration Security Audit & Isolation Record

## Incident Summary (P0)
- **Incident Description**: FrozenHub 2 (Tenant 23) displayed Starplus historical totals belonging to FrozenHub 1 (Tenant 20).
- **Confirmed Root Cause**:
  1. `frontend/hexabill-ui/src/features/dashboard/DashboardTally.jsx` contained hardcoded JavaScript fallback values:
     `legacyMetrics?.activeGrandTotal || 3817356.88`
     `legacyMetrics?.activePaidTotal || 3747182.98`
     `legacyMetrics?.positiveOutstandingSum || 70178.09`
     `legacyMetrics?.customerOpeningReceivablesTotal || 70077.29`
  2. The standalone Starplus card was rendered based on `isAdminOrOwner(user)` without verifying tenant authorization for Starplus data.
  3. When `/api/legacy/reconciliation` failed with 500, the `||` operator evaluated the static fallback numbers for any admin/owner on any tenant.
  4. Similar static fallback values existed in `ReportsPage.jsx`.

## Security Controls Implemented
1. **Removal of Hardcoded Financial Fallbacks**:
   - Stripped all static numbers (`3817356.88`, `3747182.98`, `70178.09`, `70077.29`, `4916`, `5325`, `93`).
   - Removed standalone Starplus card from `DashboardTally.jsx` to maintain a unified operational dashboard.
2. **Backend Tenant Authorization Enforcement**:
   - Every `/api/legacy/*` endpoint validates `TenantId == 20` (FrozenHub 1).
   - Any other tenant (e.g., Tenant 23 FrozenHub 2, Tenant 22 Gulf Harvest) querying `/api/legacy/*` receives empty results or `403 Forbidden`.
3. **Frontend Cache Isolation**:
   - Cache keys explicitly bound to `tenantId` and `userId`.
   - Complete cache purge on tenant switch or logout.

## Multi-Tenant Negative Verification Status
- Tenant 20 (FrozenHub 1): Authorized access to integrated history.
- Tenant 23 (FrozenHub 2): ZERO Starplus records returned, ZERO fallback widgets displayed.
- Tenant 22 (Gulf Harvest): ZERO Starplus records returned.
