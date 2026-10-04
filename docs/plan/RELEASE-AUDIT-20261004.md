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
| REL-005 | S1 | ReportService.cs:263-311,868 versus VatReturnReportService.cs:232-329 | Dashboard independently sums VAT without the VAT return's purchase/expense claimability exclusions. Example: a nonclaimable purchase VAT of 5 is subtracted on dashboard but excluded in return. Use the same server VAT calculation and period policy; preserve Zayogya baseline. |
| REL-006 | S2 | ReportService.cs:183-187,282-286,307-311,1268-1276,1348-1365 | Query failures become successful zero or empty responses. Make financial totals unavailable/error, with actionable retry/reference, rather than silently misleading. |
| REL-007 | S2 release evidence | ZayogyaRegressionSnapshotTests.cs:28-93 | Test generates a PDF, checks length, changes header and checks bytes differ; assertions pin the input DTO. There is no checked-in prior-render golden comparison proving original layout/text/numbers unchanged. Capture approved masked baselines and compare extracted text/render output. |
| REL-008 | S2 release gate | npm audit live output | Direct axios/react-router-dom and toolchain have advisories. Triage browser vs Node/SSR/dev-only exposure, update compatible versions, retest. No automatic force/major upgrades. |
| REL-009 | S2 evidence/process | STATE/PHASE-TODO/PHASE-MATRIX/ISOLATION-AUDIT | Contradictory PASS/PARTIAL, old PG blockers, proposed sample rules versus implemented code, 74 versus 82 tests, claimed missing verify script. Reconcile latest evidence; do not count shell screenshots as interactive page completion. |

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

Chrome synthetic GulfHarvest on isolated API 5010/Vite 5174 verified the void flow (balance 5 → 55, two original equal receipts retained), receipt disabled, cleanup 409, customer force-delete 400, VOID edit/reactivation 400 and cross-tenant payment 404. Before/after dialog and five after layouts inspected. Ledger and login remain PARTIAL, no route DONE. Mobile header density, tablet horizontal table access and dead payment mode filter require page work. Minimal deterministic seed has four synthetic tenants with one sale/customer/product and two receipts each; it is explicitly **not** the required 30/60/200 release data matrix.

Additional blockers: startup code can mark all pending migrations applied after one existing-column exception (REL-011); readiness discards CanConnectAsync false (REL-012); money mutations lack a shared Daily Close lock (REL-010). Latest npm audit still reports 28 vulnerable dependency entries. Browser session and data are synthetic only. No production migration, deploy, merge, push or real-client write.

## Stage A iteration: migration truth and VAT review

Removed the catch-path that fabricated history rows for **all** pending PostgreSQL migrations after one duplicate schema object. A clean Release build of the API succeeds with 0 errors (43 pre-existing compiler warnings). A full PostgreSQL-enabled backend run passed 617 / 0 failed / 0 skipped after the API change. `/health/ready` now maps `CanConnectAsync=false` to HTTP 503; an isolated failure-path HTTP check remains needed. The user's already-running Release API owns the normal Release output, so verification built to the isolated audit artifact directory; it was left running.

The fresh migration rehearsal remains failed: `InitialPostgreSQL` creates `Customers`; the following `AddBranchAndRoute` migration attempts to create it again (42P07). Removed both the catch-path blanket history stamping and the separate PostgreSQL shortcut that marked that migration applied from a code comment. On a newly created rehearsal DB, failed migration application left zero applied migration rows; no application tables or rows were present, so retry still reproduces the failure without a deceptive success marker. I have not edited old migration files. A safe path must match the existing production history/schema and the explicit “additive EF migrations only” release rule.

Also fixed two financial reports that caught DB failures and returned a success-shaped empty result. They now throw a safe retry message handled by existing HTTP error responses. A failure-propagation regression passed. The active customer ledger mode control is now a real mode selector; filter browser proof is pending. Frontend remains 82/82, 0 lint errors / 237 warnings, successful build.

FTA's current VAT Return user guide says reverse-charge supplies require the net value and VAT due as output tax, while any recoverable part belongs separately in the input tax return ([FTA VAT Returns User Guide, PDF](https://tax.gov.ae/-/media/Files/EN/PDF/Guides/VAT-Returns-User-Guide.pdf), Box 3 and Box 10). The present return aggregates reverse-charge VAT into the recoverable input only and computes payable tax from standard-sale output VAT alone. This is an additional S1, REL-015. No VAT behavior was changed in this iteration; the return DTO/UI lacks a distinct reverse-charge output tax display and needs a tested accounting-path change before filing reliance.

Next high-effort order: truthful migration history and fresh/copy rehearsal; canonical VAT calculation with fixture reconciliation and preserved Zayogya baseline; close-day/concurrent posting checks and remaining isolation paths. Medium effort: full synthetic seed matrix, GulfHarvest page groups and five viewport interactions, then FrozenHub1/2, dependency remediation and proven dead-code cleanup. Release gate remains FAIL / IN PROGRESS.
