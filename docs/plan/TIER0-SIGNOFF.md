# Tier 0 sign-off table (Master Loop)

**As of:** 2026-10-04  
**Code SHA:** `8b5c2b0+` on `master-loop-2` (local; **ahead of origin**; push pending GitHub git auth)  
**Baseline main:** `7edb29b`  
**Render live:** `39ffafb` (`autoDeploy=no`) · **Vercel prod SHA:** UNVERIFIED (API 403)

| Gate | Status | Evidence |
|---|---|---|
| Shared-TRN admin warning | **PASS** | `SharedVatTenantCount` UI + settings PUT warning |
| Header parity A4/A5/80/58/receipt/mono/AR/logo | **PASS** | `Desktop/HexaBill_Backups/master-loop-2-headers-20261004-104308` + VERDICT |
| Browser print live | **NOT RUN** | needs tenant-host Vite session |
| Provisioning + legacy redirect | **PASS** (local) | `tier0-local-bootstrap` 4 tenants |
| Legacy settings TenantId | **PASS** | SettingsService TenantId-over-OwnerId |
| Isolation audit | **PARTIAL** | `docs/plan/ISOLATION-AUDIT.md` |
| PostgreSQL 44 | **FAIL/BLOCKED** | missing `HEXABILL_TEST_POSTGRES` / postgres password (Docker CLI absent; PG services up on 5432) |
| Seven journeys (section 9) API ×4 | **PASS** | `master-loop-2-journeys-20261004-105936/api-journey-results.json` |
| Shell routes ×4 | **PASS** | `shell-route-results.json` 33/33 |
| Viewport screenshots / HAR | **PARTIAL** | login on 127.0.0.1; tenant host screenshots blocked |
| Backup restore on copy | **PASS** (SQLite copy) | `sqlite-restore-copy.db` |
| Migration rollback on PG COPY | **NOT RUN** | no PG test DB |
| Sample/missing TRN print rules | **PROPOSED** | DECISIONS pending approval; code on branch |
| D5 profit×5% not VAT | **PASS** | prior slice |
| Zayogya tax/print unchanged | **PASS** | ZayogyaRegressionSnapshotTests (3) this slice |
| Production deploy | **BLOCKED** | needs separate Anandu auth |

## Commands used

```bash
node scripts/tier0-local-bootstrap.mjs
node scripts/tier0-local-journey-verify.mjs
node scripts/tier0-browser-shell-check.mjs
```
