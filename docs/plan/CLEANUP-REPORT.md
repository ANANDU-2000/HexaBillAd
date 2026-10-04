# Cleanup dry-run — 2026-10-04

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

No source files, migrations, feature-flagged code, build outputs, or local evidence were removed. Next cleanup step is to inspect the named candidates and build an import/route/DI proof before proposing any deletion or extraction.
