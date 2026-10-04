# Tier 0 + Master Loop execution board

**Branch:** `main` @ `6dc8d9c`  
**Plan:** `docs/plan/MASTER-LOOP.md`  
**State:** `docs/plan/STATE.md`  
**Sign-off:** `docs/plan/TIER0-SIGNOFF.md`

Statuses: **TODO** | **IMPLEMENTED** | **PASS** | **FAIL** | **BLOCKED** | **NOT RUN**

## Clean build (2026-10-04 Master Loop)

| Gate | Status | Evidence |
|---|---|---|
| Backend Release + tests | **PASS** | Non-PG 558; with PG env **55/55 PostgreSql PASS** |
| Frontend lint/test/build | **PASS** | 0 lint errors; 82 tests (latest verify); Vite build OK |
| Zayogya regression | **PASS** | `ZayogyaRegressionSnapshotTests` (8) |
| PostgreSQL suite | **PASS** | disposable `hexabill_master_loop_test` @ `:5433` → 55/55 |
| Production deploy | **BLOCKED** | needs separate auth; Render live `39ffafb` autoDeploy=no |

## Tier 0 remaining gates

| ID | Item | Status | Notes |
|---|---|---|---|
| T0-S1 | Shared-TRN warning | **PASS** | SuperAdmin list + settings PUT |
| T0-S2 | Header parity evidence | **PASS** | master-loop-header-20261004-102752 |
| T0-S3 | Provisioning + redirect | **PASS** | unit + prior local |
| T0-S4 | Legacy settings TenantId | **PASS** | SettingsService |
| T0-S5 | Isolation audit | **PASS** | ISOLATION-AUDIT.md + PG 55/55 on disposable DB |
| T0-S6 | Seven journeys re-run | **PASS** | master-loop-2-journeys-20261004-105936 |
| T0-S7 | Backup restore copy | **PARTIAL** | SQLite + PG dump/restore PASS; EF migrate-rollback FAIL (chain); R2/agent zip NOT RUN |
| T0-S8 | Sample TRN never blocks | **PASS** | prod samples allowed; Zayogya excluded |
| T0-S9 | D5 profit VAT | **PASS** | Standard VAT + Estimate not for filing |
| T0-13 | Push main | **PASS** | `a1161e7` on origin/main (= master-loop-2) |

## Phases 1–11

| Phase | Status | Commit / blocker |
|---|---|---|
| 1 Clean build / versions | **PASS** | `6dc8d9c`; deploy SHAs UNVERIFIED |
| 2 Isolation hardening | **PASS** | SQLite + PG 55/55 |
| 3 Payments/receipts | **PARTIAL** | code+unit; live re-verify **PASS** (ledgerOk=10; receiptPosts=0 reprintSafe) 2026-10-04 |
| 4 Cost snapshots / D9 | **PARTIAL** | flags OFF live×4 + unit PASS; cost snapshot UX still flag-gated |
| 5 Daily Close | **PARTIAL** | flag OFF live×4 + unit PASS; UI gated |
| 6 Margin VAT | **BLOCKED** | **missing input:** accountant written fixtures (eligible txns, effective date, invoice/return rules, expected figures); D5 stop-gap done |
| 7 Shell UX | **PARTIAL** | shells 4×6×5 + §10 static-36×4@360 + owner static-36×4×5VP (720); CTA shrink classes cleared in src jsx; full field matrix open |
| 8 Remaining routes | **PARTIAL** | static/param shells + §10 static-36 smoke@5VP; branch/route link CTAs 44px; full field matrix open |
| 9 AI | **TODO** | |
| 10 Voice/driver/maps | **TODO** | |
| 11 Staging/pilot | **BLOCKED** | production auth |

## Confirmed decisions (see DECISIONS.md)

- Executor = main repo; push main authorized for Master Loop
- Sample VAT TRN allowed in Production for FH1/FH2/GH; Zayogya unchanged
- Client documents local-only (gitignored)
