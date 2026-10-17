# HEXABILL — PRODUCTION SAVE-FAILURE ROOT-CAUSE AND DATA-INTEGRITY RECOVERY

## Mission and environment
You are Codex, lead incident engineer for the existing HexaBill multi-tenant React + ASP.NET Core + EF Core + PostgreSQL system. This is **code-changing engineering and verification**, not another planning exercise. Prioritize the live report: **"Failed to create product/customer" even though the row appears in PostgreSQL**, plus purchase/payment false failures, stale UI lists, and inconsistent customer balances.

Primary authorized read-only web target: `https://gulfharvest.hexabill.company/`. Production backend: Render; production frontend: Vercel; database: Render PostgreSQL. Determine resource IDs, environment, deployments, commit SHAs, hostname mapping and tenant ID **from authenticated tools**, never assumptions. The uploaded `HexaBillAd-main.zip` is a historical source snapshot; current Git and deployed commits must be compared before edits. Preserve the active feature branch, dirty working tree, and all uncommitted changes.

Do **not** infer Render schema or real HTTP responses from screenshots. The Network screenshot exposes a customer **request payload**, not the success/error **response**. The screenshot showing a product error toast also does not establish whether that POST committed. Verify using response status + body + request ID + backend logs + tenant-scoped DB evidence.

## Grounded source leads (verify against current checkout)
- `frontend/hexabill-ui/src/features/products/ProductsPage.jsx`: `handleCreateProduct` around old lines 255–335 branches on `response?.success`; keep image-upload outcomes separate from product persistence.
- `frontend/hexabill-ui/src/features/customers/CustomersPage.jsx`: submit handler around old lines 316–343 branches on `response.success` and awaits `fetchCustomers()` in the success path. An exception in refresh can surface as a misleading save failure.
- `frontend/hexabill-ui/src/features/purchases/PurchasesPage.jsx`: around old lines 573–662 checks `response.success`; inspect request `paymentType` and post-commit recompute path.
- `frontend/hexabill-ui/src/features/payments/PaymentsPage.jsx`: inspect mutation response handling, ambiguous payment confirmation, cache and list visibility.
- `frontend/hexabill-ui/src/services/api.js`: response interceptor and `transformResponseKeys` (around old 655–694); inspect interceptors, envelope normalization, throw paths, retry policy, stale-session handling and cache invalidation.
- `backend/HexaBill.Api/Modules/{Products/ProductsController.cs,Customers/CustomersController.cs,Purchases/PurchasesController.cs,Payments/PaymentsController.cs}`: compare `CreatedAtAction` and `ApiResponse<T>` shape with actual production responses.
- `backend/HexaBill.Api/Data/AppDbContext.cs`: verify current EF mappings, transaction boundaries and tenant filters.
- Reported live QA dated 14 October includes an invoice 15.75, a payment 5.00 and a full return 15.75. Expected **customer credit AED 5.00 and outstanding AED 0.00**; other live pages reportedly showed AED 10.75 unpaid. Treat this as **P0 candidate** until reconciled with current state; do not 'fix' via manual balance update.
These line numbers apply only to the uploaded snapshot and must not be treated as verified current line numbers.

## NON-NEGOTIABLE SAFETY
1. **PRODUCTION READ-ONLY until a separate explicit approved change window.** No test invoices, new products/customers, deletes, payments, financial reversals, day close, VAT lock/file, data cleanup, direct SQL UPDATE/DELETE, migrations, production redeploy or secret rotation as part of reconnaissance. Existing QA Live 14 Oct records are customer financial history; do not modify or delete them.
2. Use an isolated local/staging clone with disposable PostgreSQL and **synthetic** records for browser write tests and migration rehearsal; do not copy unmasked customer/employee private data.
3. To prepare an approved production release: identify precise target tenant/db/service, verify tested backup and recovery, rehearse migration (if needed), compatibility and rollback, agree on maintenance/availability and get **explicit final authorization** to change production. Authorization to inspect is not authorization to deploy or mutate finance data.
4. Avoid leaking tenant emails, phone numbers, TRNs, access tokens, passwords or connection strings in transcripts, fixtures, logs, Linear issues or screenshots. Use least privilege and redact identifiers. Do not print environment secrets.
5. Never allow an AI tool/agent to bypass tenant/role authorization or directly alter ledger/VAT figures. Do not switch off guards to make tests green.

## Phase 0 — System discovery & evidence, not another broad audit
- Identify Git working tree and deployed backend/frontend commits, feature flags and active tenant mapping. Verify whether the current deployed source actually matches the ZIP.
- Discover **available MCP tools** for Render and Vercel, plus authenticated CLI/API fallbacks. Do not claim a Render MCP is installed without verifying it. If inaccessible, report BLOCKED for that data source and continue safe local work.
- Read-only inspect Render deployment status, /health and /health/ready, relevant exception/request logs, pending migrations, DB readiness and Vercel environment/API base URL and deployment logs. Correlate browser timestamp and request ID to backend event.
- Use browser DevTools/CDP/Playwright with owner's legitimate login, redacted capture; inspect **GET responses** and past existing QA records. Do not submit new production writes. Inspect existing user-provided screenshots and QA findings.
- Build a concise P0/P1 defect register under `docs/qa/HEXABILL-PRODUCTION-SAVE-INCIDENT.md`. Use existing trackers where present; do not create more overlapping master plans.

## Phase 1 — Render PostgreSQL read-only schema / actual data shape
Connect only with an authorized restricted read-only connection. Verify host, database, schema, tenant and environment prior to any SQL. Start each diagnostic session with transaction read-only and short timeouts. Inventory (not dump) these EF entities and dependent tables discovered from current `AppDbContext`: Products, Customers, Suppliers, Purchases, Sales/Invoices, Payments, PaymentAllocations, Returns/CreditNotes, StockMovements, Branches, Routes, Users, VatReturnPeriod, AuditLogs, and migration metadata.

For each relevant table identify: table/schema, column, PostgreSQL `data_type` and `udt_name`, nullability, default, max length, precision/scale, identity, primary key, unique constraints, check constraints, foreign keys, indexes, triggers, deleted/active flags, timestamps, row versions/concurrency, tenant ID scope. Compare with EF entities, DTOs, request validation, current migration snapshot and actual frontend payload.

Safe example metadata-only SQL (adjust schema as discovered):
```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT table_schema,table_name,column_name,data_type,udt_name,
       is_nullable,column_default,character_maximum_length,
       numeric_precision,numeric_scale
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog','information_schema')
  AND table_name IN ('Products','Customers','Purchases','Payments')
ORDER BY table_schema,table_name,ordinal_position;
ROLLBACK;
```
Inspect `__EFMigrationsHistory` only if present, verify current migration status. The quoted sample names may differ in live PostgreSQL; discover exact names first. Query **only a minimal preidentified synthetic/QA record set scoped to authenticated tenant** to check persisted state; never run unbounded `SELECT *` or copy whole live tables. Collect redacted aggregate counts and row IDs/amounts only as needed.

## Phase 2 — Reproduce the exact failure on disposable PostgreSQL
Use existing API tests and Playwright/Chrome, no mock success responses for final E2E. Seed tenant A/B, owner/staff, branch/route, one product and customer, proper QA-only invoice/payment/return fixture. Cover separate product creation via Products and customer creation via Customers **and Customer Ledger**; test source page differences.

For each action record this immutable timeline:
1. Form values, field validation and button state (redacted).
2. Browser request count, method, URL, unique operation ID, payload keys (redacted).
3. Raw response HTTP status, body/envelope, `Location` header and request/correlation ID.
4. Response **after `api.js` interceptors**, including `success`, `data.id`, errors and exceptions.
5. Controller/service transaction commit timestamp, error logs, FK/unique/validation errors.
6. Tenant-scoped DB row count and created ID before/after.
7. UI toast, modal state, list cache invalidation, record visibility after refresh.
8. Immediate second click/retry: verify no duplicate or ambiguous posting.

Reproduce under normal network, throttled Fast 4G, slow response, dropped response **after server commit**, stale session and post-save refetch failure. Confirm whether the request is 201 with data and false toast, a 500 after commit, a 400 validation rejection, a 409 duplicate, or an uncertain timeout; do not conflate them. Screenshots alone are not source of truth.

## Phase 3 — Fix root cause, not symptom
- Correct shared API envelope normalization (`Success` vs `success`, nested `data` vs HTTP response, interceptors, return shape) **only after proving discrepancy**. Keep one authoritative contract and regression tests. Do NOT simply treat every 201 as successful: validate the expected persisted record/ID and define success based on documented API contract.
- Separate primary mutation result from post-save image upload, cache refresh, analytics refresh, navigation and optional side effects. A succeeded save must never become a 'Save failed' toast because of later refetch failure; show a specific refresh/image warning and safe refresh instead. A rejected save must not show success.
- On an ambiguous timeout: show 'Save status unknown; checking…', reconcile using a client operation ID / idempotency key and an authorized backend lookup. Never advise blind retry or infer that a same SKU necessarily came from this attempt.
- Implement server-backed idempotency for financially consequential POSTs, atomic DB transactions, stable request identifiers, and unique constraints according to legitimate business rules. Do not create duplicate data to test retries in production.
- Fix route/branch conditional validation, field examples and inline errors, not by making truly required business fields optional globally. A branch with no valid route needs a useful 'create or assign route' path or authorized config fix.
- Keep product stock, customer balances and payment allocation calculations authoritative on the backend. No 'Recompute stock' requirement as a normal UX workaround. Keep response, front end and DB consistent.
- When save finishes, close/reset modal only on verified success, refresh visible list/cache, preserve form on failure, direct-link/view created record, and show appropriate success/recovery messages.
- For client errors containing only `Ref: ...`, map correlation ID to structured server logs, show user-friendly message plus optional support reference. Never show raw SQL/internal stack to staff.

## Phase 4 — Financial integrity blocker
Use deterministic fixture invoice 15.75, payment 5.00, full return 15.75; expected open receivable 0, customer credit 5.00. Verify source ledger entries, status semantics, refund/customer credit policies and reversal handling; **do not assume that all returns are cash refunds**. Reconcile customer ledger, sales ledger, aging, outstanding, dashboard, branch/route, VAT, reports and exports for same tenant/date window. Other positive cash and expense movements must remain correct. Add regression for partially paid vs fully returned invoice and duplicate payment submission. If any figure differs, treat as release blocker. Snapshot before/after synthetic DB state.

## Phase 5 — Coverage, UX, and browser QA
For Products, Customers/Customer Ledger, Purchases, Expenses, Payments, Sales/POS, Returns and Daily Close inspect every actual create/edit/update/cancel/activate/deactivate/bulk field. Validate required and optional fields, null and empty values, precision, malformed dates, units, barcode/SKU, TRN and duplicate rules, branch/route consistency, long text, Arabic, type conversion, and browser focus/error messages.

Run same business loop: **fill each field → submit → inspect raw response → verify DB → list instantly updated → refresh → edit → recheck DB → authorized deactivate/cancel in test DB → verify stock/payment/ledger/VAT/report dependencies**. Tests at 360/390/768/1024/1440 including click/touch, keyboard, loading and errors. Bulk deactivation must respect foreign-key/accounting retention and employee roles. Tests must be repeatable and isolated by tenant.

For the supplied screenshots specifically check: product Add New Product modal and false error; customer Ledger Add New Customer modal and Ref-only error; customer request payload in Network tab (inspect Response and Headers too); customer count/list stale after Save; dashboard receivables AED 10.75 despite full return scenario; tablet nested scrollbar/layout. Record each screenshot finding as UNCONFIRMED or CONFIRMED, with real network/DB evidence.

## Phase 6 — Implementation, staging deployment and controlled live verification
For each confirmed issue: create one failing unit/integration/E2E test, make smallest correct change, rerun targeted tests, run PostgreSQL integration/concurrency tests (zero unexplained skips), run full .NET and frontend tests/build, run browser tests, perform independent financial/tenant security review, update tracker, commit locally. Verify staging build/commit with target deployment config and migration rehearsal. No automatic production release.

Only after separate authorization: follow documented backup + migration + backend/frontend compatibility + rollback runbook and staged rollout. Run approved **non-destructive live smoke checks** first (login, GET products/customers, report metrics, authorized existing QA record lookup, health/readiness). Any planned live write must be separately scoped and authorized with defined tenant/account/transaction and reversal method. After rollout, correlate Vercel/Render logs, check 4xx/5xx and no duplicate postings.

## Strict autonomous execution
Run **READ TRACKER → REPRODUCE → ROOT CAUSE → FAILING TEST → FIX → VERIFY API/DB/UI → RECONCILE REPORTS → UPDATE → NEXT** continuously for approved independent local/staging tasks. Use at most one read-only financial reviewer and one browser QA reviewer when helpful; lead integrator owns edits. Do not stop after generating a plan or a visual screenshot. Preserve existing work, don't run `git clean/reset --hard`, don't publish credentials. Pause only at explicit production/paid-service/destructive approval gates or genuine access blockers. Never claim you can run indefinitely after tool/session limits.

## Required tracker/test evidence
Update `docs/qa/HEXABILL-PRODUCTION-SAVE-INCIDENT.md` with: ID, date/time, environment, tenant pseudonym, user role, screen/route, repro steps, raw request/response metadata, correlation ID, DB row evidence, source location, root cause, regression test, severity P0/P1/P2/P3, PASS/FAIL/BLOCKED/NOT TESTED, screenshots (redacted), commit, and next action. Keep live customer identifiers out of committed artifacts.

## Final acceptance
- Products, Customers and customer creation from Ledger: **one correct record, true status message, immediate visibility, correct edit behavior**.
- Purchases, expenses, payments, sales and returns: **exactly-once durable writes or explicit rejection/uncertain outcome; no double-post, and downstream figures match**.
- Case invoice 15.75 / payment 5 / full return 15.75: **customer credit 5 and receivable 0 across all authorized screens/reports**.
- Real PostgreSQL integration and race tests run; no unexplained skips; test logs and screenshots linked.
- No cross-tenant access, data leaks, bogus success toasts, false 503 maintenance states, stale lists or blocker workflow errors.
- Every critical subpage and significant input verified at representative viewports.
- Production health and deployed version independently confirmed; actual production resolution marked VERIFIED **only when approved production observation proves it**; otherwise STAGING PASS / PRODUCTION UNVERIFIED.

Report per checkpoint concisely: BUG ID, STATUS, CAUSE, CHANGES, TESTS, API/DB EVIDENCE, UI EVIDENCE, FINANCIAL PARITY, RISKS, NEXT. Do not substitute 'all green' for specific evidence.

### First concrete action
Start with **P0: stale receivables after full return**, and **P1: false saved-but-failed product/customer**, in that order if P0 remains reproduced. Inspect Render/Vercel live deployments read-only; reproduce both with synthetic PostgreSQL; trace frontend API envelope to `CreatedAtAction` and `fetchCustomers`/list refresh. Implement, test and commit local fixes. Continue to Purchase and Payment false-acknowledgement bugs. Do not touch production without a second explicit authorization.
