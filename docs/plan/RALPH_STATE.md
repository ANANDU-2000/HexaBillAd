# RALPH_STATE — HexaBill autonomous loop

Last updated: 2026-10-24 ~08:20 UTC by Claude Code (iteration 1). Evidence below is from tools run in this iteration; anything not re-checked is labelled.

## CURRENT_REPOSITORY_AND_DEPLOYED_COMMITS

| Item | Value | How verified |
|---|---|---|
| Render API `srv-d68jpdvpm1nc7393q4d0` live deploy | `c8a5b564` (= `origin/main`), finished 2026-10-24 07:02 UTC | Render `list_deploys` |
| `origin/main` | `d8222f02` + `b7e45a90` (header alignment) + `3285cdd1` (invoice PDF/company settings) + `c8a5b564` (docs) | `git log origin/main` after fetch |
| Local `main` (shared checkout) | `56ac9c11`; **228 ahead / 3 behind `origin/main` (diverged)**; uncommitted Codex edits in `docs/migration/MIGRATION-EXCEPTIONS.md`, `docs/plan/AI-ERP-TASK-TRACKER.md` | `git rev-list --left-right --count` |
| Codex hotfix worktree `~/.codex/worktrees/fh1-invoice-header-hotfix` | branch `codex/frozenhub-sales-ledger-pdf-p0` at `0d54856d` (Sales Ledger `Completed` fix, **not deployed**); uncommitted Discount-row edits to `PdfService.cs` + `LetterheadLogoSizeTests.cs` (mtime 12:48–12:50 IST) | `git status`, file mtimes, `codex.exe` running |
| This branch | `claude/invoice-series-7000` in `~/.claude-worktrees/hexabill-invoice-series`, based on `c8a5b564` | — |
| Vercel frontend deployed commit | **UNVERIFIED** — `list_deployments` for `prj_GRooh8ebxo33R0uy5EspPoe5HmAo` returned 403 (team scope not authorized for this connection) | Vercel MCP |

Concurrency rule in force: Codex is the integration writer for the hotfix branch and local `main`. Claude works only in its own worktree and does not touch Codex's dirty files.

## PHASE_AND_ACTIVE_TICKET

- Phase: P0 (A: ledger/PDF, B: numbering).
- Iteration 1 tickets:
  - `RALPH-001` State reconstruction + live-incident re-verification — DONE (evidence below).
  - `RALPH-002` Independent review of Codex Sales Ledger fix `0d54856d` — DONE, finding F2 (balance inconsistency).
  - `RALPH-003` P0-B opt-in tenant invoice series (`INVOICE_SERIES_START`) — CODE + TESTS DONE on this branch; **not deployed, setting not applied**.

## P0_BLOCKERS

- **F1 Sales Ledger still failing in production.** Render app logs show `Cannot convert string value 'Completed' ... 'PaymentStatus' enum` at 07:10:02 and 07:10:03 UTC, i.e. after the 07:02 deploy. The fix exists only on `codex/frozenhub-sales-ledger-pdf-p0` (`0d54856d`).
- **F2 Review of `0d54856d` (read-only, target DB `dpg-d68jhpk9c44c73ft047g-a`).** Exactly one non-standard row: `Payments.Id=1462`, tenant 20, `SaleId=1618` (`FH-SMK-1791254849`, smoke invoice), customer 115 "FrozenHub Onboard Customer", AED 10.50, `Status='Completed'`; sale `PaidAmount=10.50`, `PaymentStatus=Paid`. Status counts: CLEARED 978, Completed 1, PENDING 2, VOID 1. The patch adds an enum member and treats it as cleared in the ledger/report and payment filter only. **69 `PaymentStatus.CLEARED` filters in 16 files** (e.g. `BalanceService.cs:102,233`, `SalePaymentHelpers`, `SaleService`, `CustomerService`, `DailyCloseService`) still exclude it. Effect already visible: customer 115 stored `PendingBalance=21.00`, but live sales minus all settled payments = **10.50** (only `1791254855` is unpaid). After the patch the ledger shows the invoice Paid while the customer balance still owes it. Recommended remedy: keep the enum member for read tolerance and apply the one-row correction A2 below (approval required). Do not widen 69 filters in a hotfix.
- **F3 FrozenHub invoice numbering.** Tenant 20 is issuing 10-digit numbers `1791254850`–`1791254859` (real customer invoices 128/130/131 included, latest two created 2026-10-24 06:31/06:34 UTC). Root cause: `InvoiceNumberService` extracts all digits from every invoice number, so `FH-SMK-1791254849` set max+1. Issued numbers must never be renumbered.
- **F4 Starplus source (`dpg-d4b0c91e2q1c73bamq70-a`) is still live-issuing.** 4,998 sales (baseline 4,980), numbers 2000–6889, 130 invoices in the last 7 days (~18.6/day): **reaches 7000 around 2026-10-30.** Duplicate invoice numbers exist only where ≥1 copy is soft-deleted (live numbers unique; `5451`, `4638` have only deleted copies) — the legacy rule re-issues numbers of deleted invoices. The migration must map deleted duplicates without violating target uniqueness.
- **F5 QuestPDF.** `conflicting size constraints` last logged 06:48:28 UTC (before the 07:02 deploy). No PDF/print/invoice request reached the API since the deploy (request-log query empty, 07:03–07:53 UTC). Fix status in production: **UNVERIFIED**, not PASS.

## DONE_WITH_EVIDENCE

### RALPH-003 — opt-in invoice series start (code ready, not released)

- Requirement: first new FrozenHub 1 invoice = 7000 after approved cutover, then 7001… tenant-scoped, atomic, never reusing issued numbers; legacy behaviour unchanged for every other tenant.
- Initial failure (read-only prod evidence): next number for tenant 20 would be `1791254860` (F3). Pinned by `WithoutSeriesSetting_LegacyMaxPlusOneRuleIsUnchanged`.
- Change: `backend/HexaBill.Api/Modules/Sales/InvoiceNumberService.cs` — tenant setting `INVOICE_SERIES_START`; when valid, the next number is the max of purely numeric invoice numbers in `[start, start+1,000,000)` across **all** of the tenant's sales (including deleted/draft) + 1, floor `start`. Absent/invalid setting = legacy rule byte-for-byte. `IsPostgres()` now returns false for non-relational providers instead of throwing.
- Tests:
  - `InvoiceSeriesStartTests` (InMemory): 9/9 pass — legacy unchanged; smoke digits/10-digit/Starplus 2000–6889 ignored → `7000`; deleted `7001` and draft `7002` not reused → `7003`; migrated `7004` pushes to `7005`; tenant-scoped; invalid values fall back.
  - `InvoiceSeriesStartPostgreSqlTests` on a **disposable loopback PostgreSQL 18 cluster** (scratchpad, port 55901, trust auth, synthetic data only): 8 concurrent transactions under `pg_advisory_xact_lock(1000000+tenant)` got exactly `7002..7009`. 1/1 pass, 0 skipped.
  - Related subset (`InvoiceSeriesStart|InvoiceEditStock|SaleIdempotency|InvoiceNumber`): 15/15 pass.
  - Full backend suite on disposable PostgreSQL: see ITERATION_COUNT_AND_PROGRESS.
- Not done: browser POS flow creating a sale with the setting applied; production setting; deploy.

## FAILED_TESTS_AND_ROOT_CAUSE

- First `InvoiceSeriesStartTests` run: 1 failure in `SeriesStart_IsTenantScoped`. Root cause was a wrong test expectation (the other tenant has no setting, so legacy max+1 correctly returns `7051`); the assertion was corrected. No code defect.

## SAFE_NEXT_ACTION

1. When Codex finishes the hotfix: re-run its targeted tests and render A4/A5 PDFs to PNG for visual review (independent verification only, no edits to its branch).
2. Rebase/cherry-pick `claude/invoice-series-7000` onto whichever line is released next (file is identical on `origin/main` and local `main`).
3. Add a SuperAdmin/owner-visible read-only display of the configured series (no write UI) — optional; only if the owner approves A3.
4. P0-B product/customer duplicate-toast investigation (frontend; check Codex is not editing the same files first).

## PRODUCTION_CHANGE_APPROVALS_NEEDED

- **A1 Deploy the Sales Ledger hotfix** (`0d54856d` line, owned by Codex) — production is still crashing (F1).
- **A2 One-row payment status correction (production financial write).** `UPDATE "Payments" SET "Status"='CLEARED' WHERE "Id"=1462 AND "TenantId"=20 AND "Status"='Completed'` (expect 1 row), then recalculate customer 115 balance through the existing recalc path. Before → after: payment 1462 `Completed → CLEARED`; customer 115 `PendingBalance 21.00 → 10.50`; sale 1618 unchanged (`PaidAmount 10.50`, Paid). Rollback: reverse the status and recalc. Needs owner approval and a fresh backup.
- **A3 Invoice series cutover.** Owner confirms (a) 7000 as the first new FrozenHub 1 number and (b) a cutover date **before Starplus reaches 7000 (~2026-10-30)**, or else picks a different start (e.g. 8000). Then deploy RALPH-003 and set `INVOICE_SERIES_START=7000` for tenant 20 only. Already-issued `1791254850…59` stay as printed.
- **A4 Smoke/test records inside the live FrozenHub 1 tenant** (customer 115, `FH-SMK-1791254849`, test invoices `1791254850/51/54/55`): the owner decides whether to void them through the authorized void path. No deletes.

## NONDESTRUCTIVE_RESTART_COMMAND

```
cd "C:\Users\anand\.claude-worktrees\hexabill-invoice-series"
git status --short; git log --oneline -3
# disposable PG (only if stopped): "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "<scratchpad>\pgdata" -o "-p 55901 -c listen_addresses=127.0.0.1" -w start
set HEXABILL_TEST_POSTGRES=Host=127.0.0.1;Port=55901;Database=hexabill_series_test;Username=hbtest
dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --filter "FullyQualifiedName~InvoiceSeriesStart"
```

## ITERATION_COUNT_AND_PROGRESS

- Iteration 1 of a manual (non-plugin) run: `/ralph-loop` is not installed in this session.
- Completion promise: **not eligible.** P0 ledger fix undeployed, PDF fix unverified in production, numbering awaiting approval, migration/VAT gates open.
- Full backend suite on disposable PostgreSQL (`HEXABILL_TEST_POSTGRES` → loopback `hexabill_full_suite`, synthetic only): `dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj` → **1181 passed / 0 failed / 1 skipped**, exit 0, 1 m 4 s. Skipped = `MigrationRehearsalPostgreSqlTests.FreshMigrationHistory_MatchesTheModel_WithoutRuntimeRepair` (opt-in) → NOT TESTED, not counted as pass. Frontend tests not run (no frontend change).
