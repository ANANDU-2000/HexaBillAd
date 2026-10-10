# VAT Implementation Tracker

Baseline: commit `b507606`, branch `vat-mgmt-report`. Plan: `~/.claude/plans/linear-skipping-journal.md`. Resume from "Next action".
Rules: no deploy, no push to main, no destructive migrations, no production data.

## Session split
| # | Work | Status |
|---|------|--------|
| 1 | M1: verify, state machine, fingerprint (tax-period config deferred to 2) | PARTIALLY VERIFIED |
| 2 | M1: period guards, Form 201 states, accounting tests | TODO |
| 3 | M1: tenant isolation (API/DB/cache/jobs/exports/audit), export parity | TODO |
| 4 | M2: VAT UI + Playwright VAT workflows | TODO |
| 5 | M3: ERP responsive pass + ERP interaction tests | TODO |

## Verified findings (against current source)
| ID | Claimed gap | Verdict | Evidence |
|----|-------------|---------|----------|
| V-01 | No Reviewed transition | CONFIRMED | No `/review` route in `ReportsController`; `Lock` accepts any non-frozen status (even Draft) |
| V-02 | Lock needs a row to exist | NOT AN ISSUE | `VatReturnWriteGuard` takes `pg_advisory_xact_lock(VATM, tenantId)` per tenant, not per period row, so it works with no period row and covers cross-period writes (single key, no ordering deadlock). Trade-off: coarser serialization. Keep. |
| V-03 | Update/backdate checks both periods | PARTIAL | Expense, purchase and sale-edit check original and requested dates via `_vatValidation.IsTransactionDateInLockedPeriodAsync` (b507606). Not yet verified inside the write transaction (TOCTOU), nor for DELETE/IMPORT/BULK/PAYMENT ADJUSTMENT |
| V-04 | Stale calculation after financial change | CONFIRMED | No fingerprint/version; recalculation overwrites Box columns but Calculated→Locked does not compare to live data |
| V-05 | Tax-period config | CONFIRMED | No tenant setting; periods hard-coded to FTA stagger Feb-Apr etc. (`IsSupportedVatPeriod`, `quarterToRangeFta`) |
| V-06 | Form 201 boxes with state | OPEN | Session 2 |

## Tasks (Session 1)
- [x] Additive columns on `VatReturnPeriod` + migration `20261010120000_AddVatCalculationVersioning` (Up/Down; not rehearsed on a migration-built DB)
- [x] Transition table (`VatReturnWorkflow`) + `POST vat-return/periods/{id}/review`
- [x] Lock requires Reviewed + same CalculationVersion + live fingerprint match; stale -> 409 and review cleared
- [x] Calculate/Amend bump version, rebuild fingerprint, clear review
- [x] Tests (new `billing/VatReturnWorkflowTests.cs`, 10 cases); 4 existing lifecycle tests now review before lock
- [x] UI interim: freeze handler calls review then lock (explicit Review button is M2)
- [ ] Tenant tax-period config -> moved to Session 2

## Design notes
- Fingerprint = SHA-256 of the full calculated report minus volatile fields and company/TRN metadata (TRN edits do not stale a review).
- Review/lock use the same tenant-local day bounds as Calculate (`CalculationBounds`). Pre-existing: lock previously recomputed with raw UTC date keys.
- Locking is per-tenant advisory lock (V-02), so no period row is needed.

## Files changed
`Models/VatReturnPeriod.cs`, `Migrations/20261010120000_AddVatCalculationVersioning.cs`, `Modules/Reports/VatReturnWorkflow.cs` (new), `Modules/Reports/ReportsController.cs`, `tests/.../VatReturnWorkflowTests.cs` (new), 3 existing VAT test files (review before lock), `frontend/.../services/index.js`, `features/reports/VatReturnPage.jsx`, this tracker.

## Session 1 verification status
| Item | Status |
|------|--------|
| State machine implementation | PASS |
| Targeted VAT tests | PASS 51/51 |
| Frontend tests | PASS 136/136 |
| PostgreSQL tests (advisory lock, concurrency) | BLOCKED: 52 skipped, not run |
| Migration validation (`20261010120000_AddVatCalculationVersioning`) | PENDING: not applied to any real PostgreSQL DB |
| Overall Session 1 | PARTIALLY VERIFIED |

## Tests executed
- Targeted VAT: 51/51 pass.
- Full backend: 696 pass, 0 fail, **52 skipped** (PostgreSQL tests; PG not enabled this run — baseline had PG on). Frontend: 136/136.

## Unresolved risks
- Accountant decisions open: Form 201 mapping, emirate split, reverse charge, entertainment cap, rounding, returned COGS.
- Legacy Zayogya DB copy unavailable; historical migration chain untested (REL-004/011).

## Next action
Session 2 FIRST tasks: (a) run the PG tests with 0 skips and apply/rollback the migration on a disposable local PostgreSQL; (b) in M2 replace the interim Freeze=Review+Lock handler with separate Review and Lock buttons. Then: enable PG env and rerun full suite (0 skips); tax-period config; guard matrix for DELETE/IMPORT/BULK/PAYMENT ADJUSTMENT inside write transactions; Form 201 box states.

## Infrastructure findings (read-only, 2026-10-10)
- Render service `HexaBill` runs `bdcc429` (auto-deploy off, manual API deploys). DB `hexabill` (PG 18.6, 21 MB, only DB = production). `/health` 200.
- Production skips EF migrations at startup (Program.cs). **Both** `20261010090000` and `20261010120000` are unapplied (12 columns missing on `VatReturnPeriods`, 10 rows). New code on old schema fails (42703): migrate BEFORE deploy.
- Backup: NOT VERIFIED (app alert "No backup found in last 24 hours"). Vercel: BLOCKED (403, needs re-auth).
- Prepared script: `docs/plan/migration-scripts/vat-20261010-prod.sql` (idempotent, additive). NOT APPLIED. `ProductVersion` literal `9.0.0` should be matched to existing history rows before running.
- Order: backup -> rehearse locally (needs local PG credentials) -> apply script -> merge/push main -> manual Render deploy -> Vercel last.

## Session 2 progress (write-guard matrix)
| Path | Verdict | Evidence |
|------|---------|----------|
| Sale/Purchase/Expense create, update (both dates), delete | already guarded | `_vatValidation.IsTransactionDateInLockedPeriodAsync` |
| Expense bulk VAT / bulk delete / bulk claimable | already guarded | ExpenseService 794/882/942 |
| Sales ledger IMPORT (backdated rows) | **GAP FIXED**: rows in Locked/Submitted periods skipped + reported; guard runs inside the import transaction (takes advisory lock) | `VatPeriodWriteGuardGapTests` red -> green |
| Purchase BULK set-claimable | **GAP FIXED**: locked-period purchases left unchanged | same tests |
| Returns / credit notes | already guarded (`EnsurePeriodOpenAsync`) | ReturnService |
| PAYMENT adjustment | not applicable to current VAT bases (invoice-dated); re-check if a cash basis is ever added | accountant to confirm |
Open: tenant tax-period config, Form 201 box states, PG concurrency tests (still need local PG credentials), production migration (see infrastructure section).
