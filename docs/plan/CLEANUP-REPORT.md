# Cleanup dry-run — 2026-10-04

5 October REL-032 follow-up: replaced the Bills component's ad-hoc totals with one invoiceBillTotals helper used by desktop and mobile summaries. The change fixes a reproduced partial-payment accounting display defect; seven behavior regressions and inspected Chrome payment/void/filtered-list evidence establish its scope. No clone candidates, files or migrations were deleted; broad dead-code proof remains outstanding.

5 October REL-033 follow-up: consolidated ledger create/allocation execution and post-payment refresh instead of retaining two divergent submit flows. The original request/key is now managed by a tested journal helper; Chrome exercised create, allocation, changed-form rejection, reload and timeout. This extraction corrects a proven money duplication defect. No candidate clone files, historical migrations or feature-flagged implementations were deleted. Remaining broad clone/dead-code inventory is unchanged and unproven.

5 October follow-up: REL-031 adds the missing outstanding-invoice customer identity rather than removing the ledger's tenant/customer filter. No duplicate code or files were deleted. Browser host/seed additions are test-only tooling; the broad clone candidates still require behavior/import/route proof. New Bills footer issue is tracked as REL-032; do not treat it as generic cleanup.

No files were deleted. The reports below are candidate evidence only; a clone is not considered removable until its behavior, imports, DI registrations, routes, tests, and configuration have been checked.

## Exact file duplicates

- Scope: all 766 tracked files that exist in the worktree, SHA-256 by complete file content.
- Result: **0 exact duplicate file groups**.

## Repeated source blocks

- Scope: 579 tracked handwritten `.cs`, `.js`, `.jsx`, `.ts`, and `.tsx` files. EF migration folders, migration designers, generated `.g.cs`, and `.generated.*` sources were excluded.
- Method: whitespace-trimmed, exact 12-nonblank-line windows; candidate had to contain at least two database/control-flow tokens and occur in distinct files.
- Result: 330 repeated-window groups (708 total occurrences), many overlapping windows from the same underlying method. This is a coarse clone finder, not 330 independent duplicated features. EF snapshots produced much larger noisy clusters when included, so they are excluded and are never cleanup candidates.

## High-confidence review candidates

| Candidate | Evidence from scan | Disposition |
|---|---|---|
| Document editor payload/persist flows | `frontend/hexabill-ui/src/features/documents/AgreementEditorPage.jsx`, `QuotationEditorPage.jsx`, `SalaryCertificateEditorPage.jsx` have repeated 12-line blocks around their payload and create/update persistence flow. | Review for a shared hook only after comparing field validation, permissions, DTO mapping, and page tests. No extraction yet. |
| Document update controller wrappers | `backend/HexaBill.Api/Modules/Documents/AgreementsController.cs`, `QuotationsController.cs`, and `SalaryCertificatesController.cs` have matching tenant/feature/user/update/result/error-handling blocks. | Similar scaffolding; each endpoint has different request validation and error contracts. No consolidation until API behavior tests prove parity. |
| Controller isolation test helpers | `tests/HexaBill.Tests/tenancy/CustomerLedgerControllerIsolationTests.cs`, `ExpenseControllerIsolationTests.cs`, `ProductControllerIsolationTests.cs`, `PurchaseControllerIsolationTests.cs`, `ReturnsControllerIsolationTests.cs`, and `SalesControllerIsolationTests.cs` repeat controller attachment and tenant-principal builders. | Test-only boilerplate candidate. Shared helper could obscure differences in controller construction; retain until tests are compared and a common test fixture is demonstrated to reduce rather than hide coverage. |
| Daily Close alert/audit stubs | Daily Close controller, expected-cash, and worksheet tests repeat small no-op dependency implementations. | Test-only candidate; defer until test fixture dependencies are checked across the suite. |

These candidates are not proven dead code or safe deletions. A static import/route/DI inventory and runtime coverage pass is still required before marking any file unused. This scan made no assumptions about files behind feature flags.

## Not assessed in this dry-run

- Unused components/pages/services/packages, dynamic imports, route-manifest reachability, DI registrations, reflection/config references, and runtime-loaded assets.
- Stale archives, copied worktrees, logs, screenshots, build output, or evidence outside Git.
- Package duplication or dependency ownership.

## Migration duplication follow-up — 2026-10-04

A separate scan of the 50 handwritten EF migration `.cs` files found 30 table names passed to `CreateTable` in more than one migration. This is a migration-safety defect, not a cleanup/deletion proposal: 27 duplicate targets are in `InitialPostgreSQL` and `AddBranchAndRoute`; the later supplier sequence repeats `SupplierCategories`, `Suppliers`, and `SupplierPayments`. A fresh PostgreSQL rehearsal already fails at the first pair (`Customers`, SQLSTATE 42P07), so the later failures are statically established but not reached in that run. `Program.cs` also carries startup `CREATE TABLE IF NOT EXISTS`/`ALTER TABLE` routines overlapping supplier and branch/route schema, including a helper whose comment says it is for when `AddBranchAndRoute` is skipped. This parallel schema ownership can hide drift and must be reconciled with the owner-approved migration-history strategy. Do not remove or edit historical migrations under the current additive-only rule.

No source files, migrations, feature-flagged code, build outputs, or local evidence were removed. Next cleanup step is to inspect the named candidates and build an import/route/DI proof before proposing any deletion or extraction.

## Payment replay consolidation — 2026-10-04 (REL-030)

The create-payment and allocation methods contained copied idempotency lookup/replay DTO construction. Both active IPaymentService methods now call one ReplayPaymentAsync and RememberPaymentResponse implementation. The shared path supplies explicit tenant ownership, transaction serialization and request/response identity checks, eliminating the duplicated unsafe blocks. Proof: both API controller paths use those service methods; new create/allocation theories exercise both, and existing SQLite/HTTP/PostgreSQL void identity regressions protect the retained financial rows. No file, migration, rollback implementation, or feature-flagged code was deleted. This is a behavioral money correction with a shared implementation; other clone/dead-code candidates remain unproven.
