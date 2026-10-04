# Tier 0 + Master Loop execution board

**Branch:** `main` @ `6dc8d9c`  
**Plan:** `docs/plan/MASTER-LOOP.md`  
**State:** `docs/plan/STATE.md`  
**Sign-off:** `docs/plan/TIER0-SIGNOFF.md`

Statuses: **TODO** | **IMPLEMENTED** | **PASS** | **FAIL** | **BLOCKED** | **NOT RUN**

## Clean build (2026-10-04 Master Loop)

| Gate | Status | Evidence |
|---|---|---|
| Backend Release + tests | **PASS** | 564 passed / 44 PG skipped / 0 failed |
| Frontend lint/test/build | **PASS** | 0 lint errors; 74 tests; Vite build OK |
| Zayogya regression | **PASS** | `ZayogyaRegressionSnapshotTests` |
| PostgreSQL suite | **NOT RUN** | no HEXABILL_TEST_POSTGRES / docker |
| Production deploy | **BLOCKED** | needs separate auth |

## Tier 0 remaining gates

| ID | Item | Status | Notes |
|---|---|---|---|
| T0-S1 | Shared-TRN warning | **PASS** | SuperAdmin list + settings PUT |
| T0-S2 | Header parity evidence | **PASS** | master-loop-header-20261004-102752 |
| T0-S3 | Provisioning + redirect | **PASS** | unit + prior local |
| T0-S4 | Legacy settings TenantId | **PASS** | SettingsService |
| T0-S5 | Isolation audit | **PARTIAL** | ISOLATION-AUDIT.md; PG NOT RUN |
| T0-S6 | Seven journeys re-run | **NOT RUN** | prior local PASS; API down this session |
| T0-S7 | Backup restore copy | **NOT RUN** | no staging copy |
| T0-S8 | Sample TRN never blocks | **PASS** | prod samples allowed; Zayogya excluded |
| T0-S9 | D5 profit VAT | **PASS** | Standard VAT + Estimate not for filing |
| T0-13 | Push main | **PASS** | `6dc8d9c` on origin/main |

## Phases 1–11

| Phase | Status | Commit / blocker |
|---|---|---|
| 1 Clean build / versions | **PASS** | `6dc8d9c`; deploy SHAs UNVERIFIED |
| 2 Isolation hardening | **PARTIAL** | SQLite PASS; PG NOT RUN |
| 3 Payments/receipts | **PARTIAL** | code+unit; live re-verify NOT RUN |
| 4 Cost snapshots / D9 | **PARTIAL** | flags OFF; unit PASS |
| 5 Daily Close | **PARTIAL** | flag OFF; unit PASS |
| 6 Margin VAT | **BLOCKED** | accountant fixtures; D5 stop-gap done |
| 7 Shell UX | **PARTIAL** | BottomNav; matrix open |
| 8 Remaining routes | **PARTIAL** | PHASE-MATRIX.md opened |
| 9 AI | **TODO** | |
| 10 Voice/driver/maps | **TODO** | |
| 11 Staging/pilot | **BLOCKED** | production auth |

## Confirmed decisions (see DECISIONS.md)

- Executor = main repo; push main authorized for Master Loop
- Sample VAT TRN allowed in Production for FH1/FH2/GH; Zayogya unchanged
- Client documents local-only (gitignored)
