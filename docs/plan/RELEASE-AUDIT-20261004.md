# Release audit — 4 October 2026

Stage A is **FAIL / IN PROGRESS**. This is a code and local test audit, not browser sign-off or production certification.

Baseline inspected: `39ffafb`; starting HEAD: `315c1c5fa9228a997557fd13ad3c9cc2a42cbfd1`; clean tree at entry; 303 changed files (+27,206 / -1,903). Work continues on local `release-1`. No push, merge, deploy, production SQL, or client writes occurred.

The owner's supplied E2E and production release documents are now saved beside this report. The newer production authorization supersedes historical push-to-main claims in DECISIONS.md: branch push/merge, production migrations, deploy, and production smoke-tenant creation remain unchecked. Zayogya remains read-only. Local synthetic work can continue.

## Fresh verification

| Check | Actual result this session | Limits |
|---|---|---|
| Backend `dotnet test --no-restore` | 569 passed, 44 skipped, 0 failed, 613 total | Includes Debug compilation with warnings; not a clean Release build |
| PostgreSQL filtered suite | 55 passed, 0 skipped, 0 failed, 15s | Fresh disposable `hexabill_codex_audit_20261004`, loopback port 5433; tests use EnsureCreated |
| Frontend tests | 82 passed, 0 failed/skipped | Node tests; not a real browser |
| Frontend lint | 0 errors, 237 warnings | Hook dependencies and unused symbols remain |
| Frontend build | PASS, 36.14s | Main and chart chunks exceed 500KB |
| `npm audit` | 28 affected packages: 22 high, 4 moderate, 2 low | Advisory counts are not proof of runtime exploitability; major-upgrade suggestions require separate review |
| Fresh PostgreSQL EF migration-to-head | **FAIL**, SQLSTATE 42P07, Customers already exists | Disposable `hexabill_codex_migrations_20261004`; InitialPostgreSQL followed by AddBranchAndRoute recreates Customers |

No current browser, production version, backup, rollback, or all-page acceptance claim is made. Historical evidence remains historical. `npm ci` and clean Release build still need the release gate run.

## Urgent findings

| ID | Severity | Evidence | Risk and required correction |
|---|---|---|---|
| REL-001 | S1 | PaymentsController.cs:547-577 | Cleanup groups solely by amount, keeping one and hard-deleting others. Two legitimate 50 payments are treated as duplicates. It also counts pending cheques in PaidAmount. Disable this heuristic mutation; intentional corrections must preserve posted history. |
| REL-002 | S1 | PaymentService.cs:766-888 | DELETE removes payments, paired adjustments, and idempotency rows. Posted history and retry identity disappear. Implement audited void/reversal with retained source rows, receipt invalidation, exact parent links, lock/concurrency guards. |
| REL-003 | S1 | CustomersController.cs:239-262; CustomerService.cs:799-920 | forceDelete removes posted sales/payments/returns; stock restoration uses today's conversion and includes soft-deleted sales. Refuse destructive removal of financial history; deactivate customers and reverse records individually. |
| REL-004 | S1 release blocker | EF rehearsal above; Migrations/20260214173227_AddBranchAndRoute.cs:17; PostgresTestSchema.cs:13 | Migration chain is not PostgreSQL safe. Passing EnsureCreated tests cannot certify migration deployment. Design a reviewed baseline/reconciliation path preserving old migration history, then rehearse fresh and existing-copy upgrades and rollback. A later additive migration cannot bypass an earlier failed migration. |
| REL-005 | S1 | ReportService.cs versus VatReturnReportService.cs | **Fixed locally:** dashboard now consumes the same VAT-return report calculation and calendar period; VAT report purchase/expense filters use the supplied calendar bounds. Regression proved the prior -5 dashboard / +5 VAT-return mismatch; browser proof pending. Filing safety remains separately blocked by REL-015/016. |
| REL-006 | S2 | ReportService.cs:183-187,282-286,307-311,1268-1276,1348-1365 | Query failures become successful zero or empty responses. Make financial totals unavailable/error, with actionable retry/reference, rather than silently misleading. |
| REL-007 | S2 release evidence | ZayogyaRegressionSnapshotTests.cs:28-93 | Test generates a PDF, checks length, changes header and checks bytes differ; assertions pin the input DTO. There is no checked-in prior-render golden comparison proving original layout/text/numbers unchanged. Capture approved masked baselines and compare extracted text/render output. |
| REL-008 | S2 release gate | npm audit live output | Direct axios/react-router-dom and toolchain have advisories. Triage browser vs Node/SSR/dev-only exposure, update compatible versions, retest. No automatic force/major upgrades. |
| REL-009 | S2 evidence/process | STATE/PHASE-TODO/PHASE-MATRIX/ISOLATION-AUDIT | Contradictory PASS/PARTIAL, old PG blockers, proposed sample rules versus implemented code, 74 versus 82 tests, claimed missing verify script. Reconcile latest evidence; do not count shell screenshots as interactive page completion. |
| REL-015 | S1 legal/financial | VatReturnReportService.cs:245-260,365-446; VatReturnPage.jsx:469-471 | Reverse-charge output VAT is not included in output tax due/net payable; current guide requires output VAT due in Box 3 and separates eligible recovery in Box 10. |
| REL-016 | S1 filing schema | VatReturnReportService.cs:245-260,365-446; DTOs.cs:1753-1795; VatReturnPeriod.cs; VatReturnValidationService.cs:205-263; VatReturnPage.jsx:395-471,1158-1185 | Local return DTO, stored boxes, validation and UI numbering do not match the current FTA guide. Current guide: Box 3 reverse charge (net and VAT), Box 4 zero-rated, Box 5 exempt, Box 10 eligible reverse-charge recovery, Box 12 output tax due, Box 13 recoverable input tax, Box 14 net. Local code assigns different meanings and calculates net from Box 1b only. |
| REL-017 | S1 reset data safety | ResetController.cs:47-55,139-187; ResetService.cs:216-293 | Owner reset had no production refusal, included global alerts, omitted TenantId on the audit entry and lacked a transaction. Add production guard, tenant-only alert predicate, tenant-scoped audit and transaction. Regression tests cover production refusal and two-tenant/global alert isolation. |

VAT report SYS001 already carries a Blocking issue and the UI displays it; this audit does not claim the report itself silently fails without warning. The dashboard and other report paths have separate silent fallbacks.

## Tenant review conclusions

Fresh local PostgreSQL tests passed. AppDbContext has fail-closed tenant filters and validates tenant writes. Customer IgnoreQueryFilters uses explicit tenant predicates in the reviewed paths. AlertCheckBackgroundService creates a new scope and sets tenant context per tenant; BackgroundJobScopingTests cover this. Previous ISOLATION-AUDIT's blanket unresolved alert-loop warning is stale.

This is not exhaustive file/job/cache/search/export certification. Enumerate every bypass/raw SQL and every hosted service, validate asset ownership and revocation, and run both-direction HTTP/browser denial for IDs, downloads, exports, drafts, jobs and caches. No cross-tenant leak was confirmed in the paths reviewed here.

## Duplicate and cleanup inventory

Method: SHA256 over all nonempty tracked `.cs/.jsx/.js/.mjs/.json/.md/.ps1`; normalized 20 significant-line windows for runtime `.cs/.jsx/.js`, excluding migration/designer/test code. 757 tracked files; **0 byte-identical groups**, **10 file-set groups with copied windows**. This detects literal copied blocks, not every semantic clone. Hashes and locations are in CLEANUP-REPORT.md's release-audit appendix.

High-risk shared responsibilities: proxy host/secret forwarding (root and frontend middleware); upload validation (local and R2); signup and tenant provisioning; user validation; POS pricing/discount state. Lower-risk repeated page/dialog patterns: document list/editor pages and controller tenant-user boilerplate. Consolidate after behavior evidence; do not delete provider variants or rollback POS.

Static search candidates without runtime import/DI hits: SimplePdfService, utils/dataCache.js, DataImportPage, SalesLedgerImportPage, SubscriptionPlansPage, SuperAdminSubscriptionsPage, UpdatesPage, RecurringInvoicesPage. Full dynamic/config/script/test proof remains needed. `/recurring-invoices` is in the manifest but its page is not imported in App.jsx: inspect redirect/placeholder intent before deleting anything.

PosPageLegacy is **active** through PosPage's feature-flag rollback; PdfService is **active** through IPdfService DI and multiple controllers. Neither is unused.

Largest sources: CustomerLedgerPage 5,260 lines; enterprise POS 4,129; legacy POS 3,941; ReportsPage 3,736; PdfService 3,308; SaleService 3,055; ReportService 2,908; CustomerService 2,817; Program 2,714. Size is maintenance risk, not deletion proof.

## Phase truth and execution order

| Phase | Current release assessment | Next exit evidence | Effort |
|---|---|---|---|
| State / Tier 0 | PARTIAL; release gate FAIL | Close S1/S2, fresh versions and all required evidence | High |
| 1 Build / versions | PARTIAL | npm ci, clean Release build, current deployed versions | High initially |
| 2 Tenant isolation / provisioning | PARTIAL | 55 PG pass; complete bypass/file/job/cache inventory and denial matrix | High |
| 3 Money / receipts | PARTIAL, S1 open | Remove heuristic deletion; preserve posted history; browser posting/retry/receipt proof | High |
| 4 Cost snapshots / adjustments | PARTIAL | Existing unit coverage; flag-OFF and pilot fixtures, return/unit/concurrency proof | High |
| 5 Daily Close | PARTIAL, flag gated | Local counted-cash/late-entry/reopen audit; no real client close writes | High for money, medium for UI |
| 6 VAT | Standard incomplete; Margin deferred | One canonical standard calculation; accountant fixtures before margin enablement | High |
| 7 UI / forms | PARTIAL | Per-page 5 viewport interactions, states, navigation, roles; screenshots inspected | Medium |
| 8 Other routes / platform | PARTIAL | Full route/dialog/role interactions; truthful metrics and error states | Medium |
| 9 AI | NOT STARTED for release | Keep OFF; only after core release gates | Deferred |
| 10 Voice / driver / maps | NOT STARTED for release | Keep OFF; only after core release gates | Deferred |
| 11 Release / pilot | BLOCKED by technical gates | Stage B backup/copy/baseline, then explicit unchecked authorizations | High |

Execution: fix REL-001/003 safe rejection first; REL-002 reversal and retry preservation; REL-005/006 canonical totals and truthful failures; REL-004 migration strategy; Zayogya baselines and secrets; dependency triage; GulfHarvest browser page groups then FrozenHub1/FrozenHub2; cleanup only after Tier 0 sign-off. Use one cohesive commit per verified slice. No phase is DONE based solely on the tests above.

## Not run

All 61 routes × required viewports/roles/states/interactions this session; seven full real-browser journeys; inspected before/after screenshots; current PDF golden parity; secret/client-document audit; complete bypass inventory; production APIs/version lookup; production backup/copy and restore/rollback; production read/write passes; deployment and soak. Fixes below will be reported separately; static findings are not marked browser-FIXED.

## Stage A iteration: money safety

Implemented safe refusal of amount-only duplicate cleanup; blocked customer deletion when any scoped financial history exists (including soft-deleted sales); replaced payment hard delete with audited VOID retaining original amounts, references, receipt history and idempotency identity. DELETE and status VOID use the same linked-adjustment flow. VOID cannot be edited or reactivated. The active ledger labels voided history and disables its receipt/edit/void controls.

Two concurrent PostgreSQL void requests initially wrote two audits. Transaction row locks now serialize source sale/customer/payment access; regression verifies one audit, retained row, same retry ID/status and foreign-tenant 404. The payment-edit regression exposed aggregates running before edited rows were stored; payment save now precedes the balance query within the transaction. Fixture setup normalizes the seeded ledger baseline so this assertion measures the edit rather than fixture drift.

Final gates for this slice: backend **617 passed, zero failed/skipped with PostgreSQL enabled**; frontend **82 passed**, lint **0 errors/237 warnings**, build **PASS**. This is not clean-install or release-build evidence. Schema fixtures use EnsureCreated, not a repaired migration chain.

Chrome synthetic GulfHarvest on isolated API 5010/Vite 5174 verified the void flow (balance 5 → 55, two original equal receipts retained), receipt disabled, cleanup 409, customer force-delete 400, VOID edit/reactivation 400 and cross-tenant payment 404. Before/after dialog and five after layouts inspected. The later isolated browser run also verified the payment mode filter: CHEQUE showed only its tagged pending payment with receipt disabled; CASH retained the two independent equal receipts, including VOID history. Ledger and login remain PARTIAL, no route DONE. Mobile header density and tablet horizontal table access remain open. Minimal deterministic seed has four synthetic tenants with one sale/customer/product and two receipts each; it is explicitly **not** the required 30/60/200 release data matrix.

Additional blockers: fresh PostgreSQL migration history collides at `Customers`, and the local migration path still logs failures and continues startup (REL-011); `/health/ready` returns 503 on a false connectivity result, but dedicated HTTP regression coverage remains pending (REL-012); money mutations lack a shared Daily Close lock (REL-010). Latest npm audit still reports 28 vulnerable dependency entries. Browser session and data are synthetic only. No production migration, deploy, merge, push or real-client write.

## Stage A iteration: migration truth and VAT review

Removed the catch-path that fabricated history rows for **all** pending PostgreSQL migrations after one duplicate schema object. A clean Release build of the API succeeds with 0 errors (43 pre-existing compiler warnings). A full PostgreSQL-enabled backend run passed 617 / 0 failed / 0 skipped after the API change. `/health/ready` now maps `CanConnectAsync=false` to HTTP 503; an isolated failure-path HTTP check remains needed. The user's already-running Release API owns the normal Release output, so verification built to the isolated audit artifact directory; it was left running.

The fresh migration rehearsal remains failed: `InitialPostgreSQL` creates `Customers`; the following `AddBranchAndRoute` migration attempts to create it again (42P07). Source comparison counted 27 `CreateTable` operations in `InitialPostgreSQL`; all 27 names are also recreated by `AddBranchAndRoute`, which contains 32 table creations total (the other five are branch/route additions). Removed both the catch-path blanket history stamping and the separate PostgreSQL shortcut that marked that migration applied from a code comment. On a newly created rehearsal DB, failed migration application left zero applied migration rows; no application tables or rows were present, so retry still reproduces the failure without a deceptive success marker. I have not edited old migration files. A safe path must match the existing production history/schema and the explicit “additive EF migrations only” release rule. A new migration cannot run before this historical collision; under the current rule, the release is blocked pending an owner-approved historical migration repair/baseline strategy.

Also fixed two financial reports that caught DB failures and returned a success-shaped empty result. They now throw a safe retry message handled by existing HTTP error responses. A failure-propagation regression passed. The active customer ledger mode control is now a real mode selector; filter browser proof is pending. Frontend remains 82/82, 0 lint errors / 237 warnings, successful build.

FTA's current VAT Return user guide says reverse-charge supplies require net value and VAT due as output tax, while eligible recovery is reported separately ([FTA VAT Returns User Guide, Boxes 3 and 10](https://tax.gov.ae/-/media/Files/EN/PDF/Guides/VAT-Returns-User-Guide.pdf)). The current guide also numbers Box 12 as total output tax due, Box 13 as recoverable input tax, and Box 14 as net payable/refundable. Local DTO, persisted model, validator and UI use a different legacy/custom box mapping; in particular, local Box 3 means exempt sales, Box 4 means reverse-charge net, Box 10 means reverse-charge VAT, Box 12 means recoverable VAT, and Box 13a/b means net. The service omits reverse-charge output VAT from net payable. These are S1 findings REL-015/016. No VAT behavior was changed: remapping filing boxes is a legal/financial change and needs accountant-approved mapping and fixtures before implementation. Treat current VAT amounts as not safe for filing.

## Stage A iteration: VAT filing schema reconciliation

Compared the VAT return service, DTO, persisted period model, validator, exports, dashboard and UI against the current FTA guide. This found the reverse-charge undercount plus a wider filing-box numbering/meaning mismatch, beyond the original finding. The official guide states Box 3 reports reverse-charge net value and output VAT due; Box 10 separately reports eligible recovery; Box 12 is total output tax due, Box 13 is recoverable input tax and Box 14 is net payable/refundable. The app uses materially different meanings and persists those legacy values. Changing only the payable formula would still leave misleading labels and stored returns, so the money behavior is not patched without approved fixtures. REL-015/016 remain S1 and VAT reporting is not safe for filing. Need owner/accountant-approved field mapping and examples (standard sales, fully/partially/nonclaimable reverse charge, zero-rated/exempt supplies, returns, period boundaries, net payable/refund) before implementing and validating an additive schema transition.

## Stage A iteration: daily-close write-path review

Reviewed the daily-close service and ordinary sale, payment, purchase, and expense service entry points. A closed date was enforced for cash-drawer movements, but ordinary writers did not share the close lock. Added `DailyClosePostingGuard`, reused its tenant/date/branch advisory key during close submission, and wired the guard into expense create/update/delete/bulk-delete/approve/reject transactions. The new synthetic regression failed before the change; it now rejects a cash expense whose UTC timestamp maps to the closed GST business date and allows the entry after audited reopen. Targeted: 3 `DailyClosePetrolJourneyTests` passed; full DailyClose filter passed 38, failed 0, skipped 4 PostgreSQL-only cases. Sale, payment, purchase, supplier-payment write paths and PostgreSQL close-vs-post serialization remain open, so REL-010 is PARTIAL, not closed.

After this expense guard, the full backend suite passed 577, failed 0, and skipped 45 PostgreSQL-only tests because `HEXABILL_TEST_POSTGRES` was not configured. The earlier 618/0/0 PostgreSQL-enabled baseline predates this code change and is not treated as proof of its advisory-lock behavior.

## Stage A iteration: daily-close money-path expansion

Extended `DailyClosePostingGuard` into sale create/update/delete and generated receipt paths, invoice payment create/status/edit/delete/allocation, purchase create/update, supplier payment create/update/delete, and sale-return create/approve/refund-reversal. Cash-drawer movement create/delete now hold the same advisory lock through their database write, closing the previous check-then-write race. Branch postings acquire the tenant-wide advisory key before their branch key and check both close records, so a tenant-wide close cannot be bypassed through a branch transaction. Added focused scope regressions: a tenant-wide or matching-branch close blocks the branch, while another branch's close does not. The focused close/payment/purchase/return run passed 59, failed 0, with 4 PostgreSQL-only skips. The full backend run passed 582, failed 0, and skipped 45 PostgreSQL-only tests because `HEXABILL_TEST_POSTGRES` was not configured.

Continued into the less common credit-note flows. `ApplyCreditNoteAsync` and `RefundCreditNoteAsync` now execute within the configured retry strategy's transaction, lock the credit-note row (and the target sale for application) on PostgreSQL, acquire the matching day/branch guard before saving, and reuse one timestamp for both the guard and payment record. Two synthetic regressions prove both operations reject atomically when the GST date is closed. Added a PostgreSQL race regression proving a tenant-wide close waits for an in-flight branch posting and includes its committed movement. Latest full backend run passed 585 with 45 PostgreSQL-only skips. The PostgreSQL test run could not authenticate because `HEXABILL_TEST_POSTGRES` is unset and the backend requires a password; the Stage A PostgreSQL gate remains FAIL.

REL-010 remains PARTIAL: some return reversal/deletion paths still need review, sale-wide branch/date scenarios need direct regressions, and the PostgreSQL close-vs-post race is not proven. This slice is local only; no production write, feature enablement, push, merge or deploy occurred.

## Stage A iteration: owner-reset tenant/data safety

Static review found `ResetController.owner-reset` allowed any tenant owner to request a hard reset in production even though system reset was disabled there. `ResetOwnerDataAsync` also deleted global (`TenantId=0`) alerts from one tenant's request, emitted an audit row without TenantId (which the request-tenant write guard rejects), and did not wrap the destructive batch in a transaction. Added a production refusal using `IHostEnvironment`, restricted access to the Owner role, restricted alert deletion to the requested tenant, attached tenant/owner identity to the reset audit, and wrapped the deletion/reset/audit operations in one DB transaction. Synthetic tests verify production refusal occurs before service invocation, Admin access is refused, and SQLite reset preserves platform + other-tenant alerts while removing only the target tenant's alert. Targeted tests: 3 passed, 0 failed, 0 skipped. REL-017 implemented locally; no production write/deploy occurred.

After REL-017, the full local non-PostgreSQL backend suite completed with 576 passed, 0 failed, 45 PostgreSQL-only skips because `HEXABILL_TEST_POSTGRES` was not configured for this invocation. The separate previously recorded PG-enabled 618/0/0 run predates REL-017 and is not treated as validation of this change. Release PostgreSQL gate remains open.

Next high-effort order: truthful migration history and fresh/copy rehearsal; canonical VAT calculation with fixture reconciliation and preserved Zayogya baseline; close-day/concurrent posting checks and remaining isolation paths. Medium effort: full synthetic seed matrix, GulfHarvest page groups and five viewport interactions, then FrozenHub1/2, dependency remediation and proven dead-code cleanup. Release gate remains FAIL / IN PROGRESS.

## Stage A iteration: return deletion and tenant isolation

Static review found `DeleteSaleReturnAsync` hard-deleted every payment and credit note matching a return ID without tenant predicates. A synthetic platform-scope regression reproduced the S1: deleting tenant 10's pending return removed a tenant 11 payment linked to the same return ID. The fix rejects deleting any pending/rejected return that has linked payments or credit notes; callers must use an audited reversal, and financial children are no longer removed from this delete path. The regression asserts both cross-tenant financial rows and the return remain intact. `ReturnStockTests`: 13 passed; full non-PostgreSQL backend suite: 586 passed, 45 PostgreSQL-only skips, 0 failed. This does not close REL-010: other return mutation paths and the actual PostgreSQL close-vs-post race still need verification. No production access/write, push or deploy occurred.

The first disposable PostgreSQL cluster defaulted to WIN1252 and correctly rejected the app's ₹ audit text; this was a test-cluster setup error, not counted as an app failure. Recreated a new isolated PostgreSQL 17 cluster with UTF-8 encoding and trust auth on loopback, then ran the complete backend suite: **631 passed / 0 skipped / 0 failed**, including all 45 PostgreSQL tests. This verifies the close-vs-post race regression and PostgreSQL integration tests locally. The same run also reproduces the migration chain collision at `Customers`; the migration gate remains open. Both disposable servers are stopped; their generated data directories remain under the system temp directory because recursive cleanup was rejected by the environment. No configured service or database was changed. No production access/write, push or deploy occurred.

## Stage A iteration: VAT dashboard consistency and calendar boundary

Added a synthetic regression with one standard sale, an unclaimable purchase carrying VAT, and an approved petroleum expense with a claimable-VAT amount. Before the fix, the dashboard reported -5 while the VAT Return reported +5. The summary service now consumes the same `IVatReturnReportService` result (`Box13a - Box13b`) instead of maintaining independent tax sums. The VAT report had accepted calendar-inclusive bounds but ignored them for purchase/expense filtering and period labels; it now uses those explicit inclusive dates. The regression also proves both rows appear in the selected GST day when the UTC interval crosses midnight, while excluded VAT is not deducted. Full backend results: **587 passed / 45 PostgreSQL skips / 0 failed**; the complete run against disposable PostgreSQL 17 UTF-8 passed **632 / 0 / 0**. REL-005 is implemented locally; browser verification is pending. This resolves no legal filing-box issue: REL-015/016 still require accountant-approved mapping and remain S1 blockers.

## Stage A iteration: return reversal and closed-day write-off

Code review of the guarded return paths found that reversing an approved return changed generated approved write-off expenses to Rejected, but checked only refund-payment dates (or the current date when there were no refunds). Added a synthetic regression with a closed historical GST business day and an approved generated write-off expense. The regression failed before the fix because reversal succeeded. The service now gathers affected expense and refund dates and asks `DailyClosePostingGuard` before mutating either status; failure leaves the return, expense, stock and inventory ledger unchanged. Focused return/Daily Close tests passed **19/19**. Full backend suite against a fresh disposable PostgreSQL 17 UTF-8 loopback cluster passed **633/633**, zero skipped; API build passed with zero warnings/errors. The test server is stopped; its temporary data directory remains under `%TEMP%`. REL-010 remains open pending broader return-path review and browser journeys. No push, merge, migration, deployment, or production operation occurred.
