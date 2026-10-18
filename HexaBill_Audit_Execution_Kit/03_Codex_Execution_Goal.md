# HexaBill production improvement goal

Use in the real current Git checkout with the supplied screenshot archive and this audit pack. This is an implementation instruction, not a claim that the work below has been completed.

Improve the existing .NET + React + PostgreSQL HexaBill ERP for five stated client businesses, prioritising tablet users and nontechnical owners. Complete reliable core workflows and readable responsive UI before enabling AI writes, voice or forecasts. Preserve existing accounting behaviour, tenant isolation, branding, migration history and customer data.

## Start from evidence

Read root AGENTS.md/CLAUDE.md, the current tracker and the relevant audit finding. Inspect Git status/branch/HEAD and preserve uncommitted work. Map actual Render/Vercel versions and schema using authorised read-only access if available. The uploaded ZIP has no Git metadata; do not infer current source or production status from filenames, screenshots or previous chat.

Use `docs/plan/AI-ERP-TASK-TRACKER.md` as the working authority, linking specialist VAT/UX evidence. Reconcile stale four/seven-tenant statements with the owner's five-client statement and actual inventory. Do not create, merge or delete tenants merely to match a count.

## Execute in this order

1. Triage the exposed screenshot API key with its owner; never reproduce/use it. Investigate customer/product save failures and the purchase route error. Distinguish failed mutation, committed-but-response-lost, and successful-save/failed-refresh. Make retries safe and preserve form state.
2. Fix the staff activity contract: frontend `services/index.js` calls `/users/{id}/activity`; inspected controller is `AdminController` under `/api/admin/users/{id}/activity`. Verify actual deployed routing before changing; test tenant access and show failed versus empty states correctly.
3. Fix `PurchasesPage.jsx` product picker anchoring/stacking/clipping, touch selection and tablet layout. Reproduce S278/S279. Do not solve only by increasing z-index. Separate entry mode from purchase history/analytics and correct fixed footer/bottom-nav spacing.
4. Reproduce VAT refresh/jump with event and network evidence. The inspected page refetches on focus/visibility/dataUpdated and replaces content with a loading state. No page scroll listener was found. Keep previous content, dedupe/cancel requests, preserve period/tab/scroll, and prevent scrolling from initiating requests. Reconcile quarter helpers with tenant tax schedules.
5. Fix tenant/platform branding requests and repeated logo failures. Verify active R2 configuration, authenticated retrieval and restart persistence. Separate public brand logos from private document responses; generic private assets must not be publicly cacheable.
6. Consolidate tablet shell, back navigation, filters, list cards, money/status styling, error states and action bars using existing tokens/components. Test 360/390/768/820/1024/1180/1440 CSS px, orientations and real software keyboards. Preserve full field values and reachable actions.
7. Add prominent owner quick actions and Daily Close status to DashboardTally. Improve existing DailyClose UX; do not duplicate its backend. Keep cash/card/bank/credit distinctions, reviewed discrepancies, permissions and immutable close rules.
8. Reconcile admin counts/metric definitions; replace heap/working-set ratio as a hosting-limit indicator with actual provider/container metrics. Turn runtime schema repair into explicit tested versioned migrations without deleting history or changing production automatically.
9. Add tenant-document ingestion: private storage, type/size/content checks, versioned metadata, safe extraction, owner review, permission-filtered retrieval, expiry and deletion. Never commit real client documents to Git. Uploading/importing is not automatic posting.
10. Add a right-side assistant with optional full-screen mode; narrow screens use full-screen. Begin with authorised read-only tools for sales, balances, statements, stock and approved documents. Then add customer/expense draft actions with visible field validation and explicit confirmation. Reuse domain services and enforce idempotency on execution.
11. Add Malayalam/English push-to-talk with editable transcript and text fallback; pilot voice-to-voice only after language, permission, latency and budget tests. No consequential write from an unconfirmed transcript. Provider keys stay server-side; no silent paid fallback.
12. Extend existing routes/maps with delivery states before live GPS. Use explicit trip consent, scoped sessions, stale-location labels and retention. Forecasts require clean history, baseline comparison and source-labelled estimates.
13. Apply safe folder cleanup from `05_Folder_Cleanup.md`. Keep active legacy POS, migrations, tenant assets and evidence. Consolidate verified duplicate docs and empty parent lockfile only after usage checks. No bulk rewrite or mass move mixed with financial fixes.

## Engineering loop

Work one bounded task at a time. Reproduce -> locate root cause -> implement the smallest coherent fix -> validate the actual workflow -> record PASS/FAIL/BLOCKED/NOT TESTED and evidence -> continue to the next authorised independent task. Do not stop after merely writing another plan. Keep the requested overall goal until finished or genuinely blocked.

For money-related changes, test real PostgreSQL transaction/locking/idempotency behaviour on disposable synthetic data. Do not count SQLite-only or mocked UI tests as equivalent. For UI changes, test an actual browser with the test API, save/refetch and print/export where applicable. New tests must protect a real risk rather than mirror implementation details.

Commit verified local checkpoints if the active repository instructions permit; do not push or deploy as part of a local checkpoint. No production migration, service change, irreversible data operation, external customer message or paid API use without the existing applicable authorisation. Continue safe independent local work when one external integration is blocked.

## AI security contract

Derive tenant/user/branch/route scope on the server; enforce it before retrieval and tool execution. Documents and speech cannot grant permission. All AI writes use a server-stored draft, field revision/hash, expiry, explicit reviewed confirmation, current authorization and an idempotency key. Never expose arbitrary SQL/HTTP/file tools. Exact balances/tax/stock come from existing services. References include record/document IDs and as-of/version. Failed providers/quota leave manual ERP usable.

Use separate approved controls for public logos, private licences, invoices, receipts, audio and transcripts. Deny cross-tenant object/chunk/cache/conversation/voice-session access. Support revocation, prompt-injection tests and safe source deletion. SuperAdmin keys are secret references, not visible values. Obtain any required provider data-processing/billing decision before transmitting real customer data.

## Release evidence

Require: current source/deployment/schema map; no unresolved P0 data leak/duplicate financial write/save uncertainty; complete tenant-role isolation cases; successful local PostgreSQL migration rehearsal; backup and restore evidence; responsive create/edit/save/refetch flows; printed tenant identity checks; explicit skip/blocker report; AI budget/privacy/language evidence for enabled features; staged pilot and rollback procedure.

Output after each checkpoint: Task ID; changed files; root cause; behaviour now; exact checks and result; remaining risk; last commit; next action. At context handoff persist this in the tracker. Never claim completion from a build alone or label a skipped check PASS.

## First exact task

Reconcile source/deployment and reproduce SAVE-01 on synthetic customer/product records with network response, saved-row and refresh evidence. If no runtime is available, document that blocker and move to safe static/local preparation without claiming the incident is fixed. REL-02 is the next narrowly scoped code-confirmed repair candidate.
