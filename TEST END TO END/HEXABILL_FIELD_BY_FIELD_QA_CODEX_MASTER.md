# HEXABILL — STRICT CODEX COMPUTER/CHROME ERP QA + AUTONOMOUS FIX GOAL

## Mission and authority
You are the **lead senior ASP.NET Core/React/PostgreSQL ERP engineer**, coordinated with a browser QA specialist, financial-integrity reviewer, accessibility/UX reviewer, and tenant-security reviewer. Your job is to make the current HexaBill ERP reliably usable for real small-business owners and staff, **starting at the Gulf Harvest subdomain and focusing first on Products**. This is an implementation-and-verification assignment, not another plan-only pass.

**Production reference:** `https://gulfharvest.hexabill.company/login`.

**Execution order (mandatory):** 0. source/deployment identity and safe access; 1. Products end-to-end; 2. Customers end-to-end; 3. location/shop pin; 4. Expenses; 5. Purchases and suppliers; 6. Daily Close; 7. Payments, sales/POS, reports and dependent logic; 8. all-tenant and responsive regression. Finish each module's complete state machine and data flow before calling it PASS.

Use a persistent tracker and keep moving through **approved, safe local/staging work** without asking for confirmation after each minor task. You cannot promise indefinite background execution. At context/usage limits save exact progress, open failures, and next step. Do not claim COMPLETE while P0/P1 bugs or required verification gaps remain.

## Non-negotiable production boundary
The Gulf Harvest URL and Render PostgreSQL are **real customer production**. You may inspect production pages, inspect authorized existing records read-only, and inspect health/logs/migration history/read-only database metadata with existing legitimate credentials. **Do not create, edit, deactivate, bulk-delete, void or post dummy products, customers, expenses, purchases, payments, stock or daily closes in the live Gulf Harvest tenant without an additional, precise approval for those operations.** The user asking for “live tests” is not a license to corrupt customer books. Never run destructive/chaos tests on production. Do not copy production PII into development.

All **complete field-fill → save → refresh → edit → deactivate/delete** testing should run against the same application version on a disposable PostgreSQL environment or dedicated staging tenant with seeded synthetic data. If the user later authorizes a limited live canary, require the exact target tenant/test identity, allowed records and actions, backup/recovery approach, cleanup/archival expectations, and a final approval. A financial transaction may remain in audit history after cancellation; don't promise deletion fully erases it. No unauthorized pushing, deploying, migration or paid API use.

Never print/store passwords, session cookies, JWTs, API keys, DB URLs or private customer records in code, screenshots, chat, test artifacts or commits. Obtain missing access through appropriate secret channels. Do not bypass login or user permissions in production. Stop and ask only if access or an approval gate is genuinely essential; keep progressing on independent offline/staging tasks.

## 0. Ground in CURRENT code (do not trust only screenshots or an old ZIP)
1. Run `git status`, `git branch --show-current`, `git log -8 --oneline`, record dirty/untracked work and last local commits. Do **not** reset/clean a dirty worktree. Compare repository, Render deployed backend commit, Vercel deployed frontend commit and applied EF migration history. Record evidence and mismatches.
2. Read `CLAUDE.md`, `AGENTS.md`, current QA/UI trackers and architecture. Inspect actual source; never invent API routes. Inspect the current source before changing it. Reuse existing tests. Snapshot reference paths to verify (paths can move):
   - `frontend/hexabill-ui/src/components/ProductForm.jsx`
   - `frontend/hexabill-ui/src/features/products/ProductsPage.jsx`
   - `frontend/hexabill-ui/src/features/customers/CustomersPage.jsx`
   - `frontend/hexabill-ui/src/features/expenses/ExpensesPage.jsx`
   - `frontend/hexabill-ui/src/features/dailyClose/DailyClosePage.jsx`
   - `frontend/hexabill-ui/src/components/StopLocationMap.jsx`
   - `backend/HexaBill.Api/Modules/Products/{ProductsController,ProductService}.cs`
   - `backend/HexaBill.Api/Modules/Customers/{CustomersController,CustomerService}.cs`
   - `backend/HexaBill.Api/Modules/Expenses/{ExpensesController,ExpenseService}.cs`
   - `backend/HexaBill.Api/Modules/Purchases/{PurchasesController,PurchaseService}.cs`
   - `backend/HexaBill.Api/Modules/DailyClose/{DailyCloseController,DailyCloseService}.cs`
   - `frontend/hexabill-ui/e2e/{products-crud,customers-crud,expenses-crud,purchases-crud}.spec.js`, `e2e/session.js` and `playwright.config.js`
3. Important **code-based hypotheses to verify** from an uploaded snapshot, not production conclusions:
   - Product fields include required SKU, English name and unit, with cost/sell price and unit conversion; products are **soft-deactivated**, not normally physically deleted. In a snapshot, SKU max length = 50 and English product name max length = 200.
   - Customer model already has `Location`, `MainLatitude`, `MainLongitude` and location audit metadata; there is an existing Leaflet `StopLocationMap`, `captureDeviceGps()` and stop-location feature flag. **Check existing behavior before adding location columns/services.**
   - The customer `onSubmit` success branch calls `await fetchCustomers()` inside the save `try` block. **Hypothesis:** if refresh fails after a successful POST, the outer catch may display “Failed to save customer” even though the record was committed. Verify using network fault injection and DB evidence; don't declare root cause on code alone.
   - The product create handler has a network-error message saying nothing was saved. **That claim is unsafe if the POST may have committed before the response was lost.** Verify outcome-unknown cases and reconcile using an idempotency/operation-status strategy.
   - Daily Close has existing page/service, guarded by a tenant feature check. Verify entitlement and permissions; do not create a duplicate implementation or silently enable it in production.
   - Existing product browser tests cover create → persist → edit → deactivate. Extend, don't replace.
4. Use official existing schema/migration/DTO contracts as the source of truth. Collect only relevant source excerpts. Record precisely what is code-verified, browser-verified, and production-verified.

## 1. Environment, Chrome and observability
1. Discover the actual available CodeX Computer Use/Chrome/browser tools. Use a real authenticated Chrome session for permitted read-only production diagnosis. If interactive browser tooling is unavailable, use the existing Playwright/Chromium setup. Do not claim clicks, screenshots or live log access that did not happen.
2. Check `https://gulfharvest.hexabill.company/login`, actual login status, maintenance/outage behavior, tenant-specific branding and route availability. For successful login use only credentials legitimately supplied via a protected method. A login blocker is a P0/P1 issue and must be reported with HTTP/console evidence. Capture failing requests (method, endpoint, status, correlation ID, sanitized body, timing) and console errors.
3. Inspect Render service health, error logs, deployed commit, PostgreSQL connection/readiness and EF migration history **read-only**. Inspect Vercel project deployment, commit, runtime/build logs, frontend environment/backend origin and CORS. If Render/Vercel tooling is not connected or authenticated, mark BLOCKED and give an exact minimal access request. Do not claim backend proof from the frontend screenshot alone.
4. Start a matched local/staging stack: frontend + backend + disposable PostgreSQL, migrate with existing migration tool, seed independent synthetic tenants and test owner/staff users, and record source/migration versions. Keep test data isolated; no copied customer production secrets.
5. For each browser workflow gather before/after screenshots (desktop 1440, tablet 768/1024, mobile 360/390), DOM assertions, network traces, server test logs and safe DB assertions. Redact sensitive content.

## 2. Field-level product flow — FIRST AND HIGHEST PRIORITY
**No other CRUD module may be marked complete before this full flow is verified.** Discover the exact current UI fields and server validation. Make forms teach small-business users what to enter without requiring technical knowledge.

### Product form intelligence and examples
- Required fields must have clear visible labels and short inline helper text; optional fields labelled as such. Example values must be illustrative, tenant-neutral and **never silently saved as real values**.
- Example placeholders/helper content after validation with actual schema:
  - Product name (English): `Beef slices 18 kg carton` — “Use the name shown on your invoice.”
  - SKU: `BEEF-18KG-001` — “Unique product code; not a barcode.” Offer **Generate SKU** only if it is collision-safe and allowed by backend rules.
  - Barcode: “Scan or enter an existing barcode (optional).” Never fabricate EAN/UPC validity.
  - Unit: `Carton (CRTN)` / `KG` / `Piece` based on existing allowed units. Explain conversion only when a secondary/base unit is actually relevant; default or collapse technical options safely.
  - Purchase cost / Selling price: `120.00` / `145.00` as **example format** only, with AED displayed as a prefix/suffix; preserve decimal precision and tax-exclusive/inclusive labels.
  - Reorder level/expiry/category: contextual help, not mandatory unless actual business rules require.
- If a required field is missing, show one specific inline message, focus it and retain all other values. Server validation errors must map to field labels; no raw stack traces, false success or blanket “failed”. Indicate valid ranges/unique SKU before submit when possible, while keeping the server authoritative.
- On smaller screens: fit search/select inputs, no clipped date/calendar icon, 16px inputs where appropriate, correctly aligned units and currency, reachable Save even with keyboard open, no bottom-nav overlap, no excessive spacing/cards.

### Product transaction tests — test EVERY actual field
A. Open add-product form. List all fields and validation. Test field-by-field: empty required, invalid SKU/duplicate SKU, max/too-long name, missing unit, negative/zero price as permitted, decimal precision, conversion values, Unicode/Arabic, category choices, barcode scanner permissions, image upload failure, long descriptions, keyboard-only and mobile touch.
B. Fill complete **synthetic** product via the browser, click Save **once**, capture POST and response, verify **exactly one** DB product with correct tenant ID/fields, verify UI record appears and survives hard refresh/relogin.
C. Open the saved product, edit product name, unit, costs, sell price, category, expiry and other supported editable fields **one at a time and combined**. Verify persisted values and downstream product catalog/POS search. Verify editing descriptive metadata does **not zero stock** or rewrite historical invoice prices.
D. Test authorized stock adjustment as a separate inventory transaction: opening balance, plus/minus adjustments, sales/purchase movements, zero stock, decimal quantity, insufficient stock and concurrent edits. Verify immutable stock movement history and report reconciliation.
E. Test deactivate/reactivate with correct permission and typed confirmation, and confirm historical invoices continue to reference the original product. Do not hard-delete referenced products.
F. Test single-row and bulk selection, Select page vs Select all matching results (clearly different), permission checks, confirmation dialog displaying count, progress, partial failures, server-side tenant filtering, atomic/partial semantics as actually designed, no accidental mass deletion. If bulk deactivate isn't supported, implement it carefully using an approved, audit-safe API and proper tests. Never quietly add a dangerous unbounded hard-delete feature.
G. Test double click, slow backend, 201 response lost, 5xx after commit, refresh failure, invalid token, simultaneous edits and retry. The frontend must present the actual **confirmed** outcome or “status uncertain—check existing record”, never “nothing saved” without proof. Idempotency must prevent duplicates.
H. Evaluate complexity/time, show 1–2 sentence helpful success confirmation and optional “Add another”, “View product”, “Print barcode”, not multiple noisy toasts.

Product PASS gate: every actual field accounted for; verified save/edit/deactivate/stock/bulk operations; zero duplicate records in controlled retries; browser + API + DB evidence; no P0/P1 open issues.

## 3. Customers — second completed module
Discover all current customer inputs, DTOs and validation. Keep names, type (Cash/Credit), branch, route, contact, address, TRN, credit limit, payment terms, optional shop location and credit accounting consistent. Explain fields in plain language, e.g. `Customer name: Example Grocery LLC`, `Phone: +971 5X XXX XXXX`, `Credit limit (AED): 2000.00` (illustrative only), `Payment terms: Net 7` as supported. Address is not the same as GPS coordinates.

Test every field with valid, blank, malformed, long, duplicate, Arabic and permissions states. Positive credit limit must have appropriate payment terms when required by current rules. Optional blank email should not become invalid `""`. Branch/route must belong to tenant. Customer list search, filter and pagination must find saved record; a successful POST followed by failed list-refresh must **not** show “Customer creation failed”. Use separate try/catch domains for mutation and refresh as appropriate. Verify create exactly once, reopen, edit, archive/delete rules, ledger/outstanding, sale/POS selection, payment links, and tenant ownership.

If “Select all / Delete selected customers” is requested: first distinguish archive/deactivate from hard delete. Prevent deletion of customers with invoices, payments, VAT or ledger history except documented legal correction paths. Show selected count, clear destructive confirmation, backend authorization, audit and no cross-tenant bulk operations.

## 4. Customer shop location — reuse existing geolocation feature
The uploaded code snapshot already contains customer `MainLatitude`, `MainLongitude`, `Location`, `StopLocationMap` and a stop-location feature flag. Verify runtime flag, API, map and storage before any migration. **Don't show raw latitude/longitude in the everyday customer form** unless under an optional “Advanced coordinates” expander. Design one clear **Shop location** section:
- “Use my current location” button: browser permission request **on user action only**, display accuracy and preview; explain it uses the current phone/device location, which may NOT be the customer's shop.
- “Pick on map”: map pin/drop/drag/confirm location; optionally show searchable address only if a legitimate geocoder is configured. No fake autocomplete or misleading map API claims.
- “Enter address manually”: works without GPS or maps; no blocking required geolocation.
- Preview selected pin and a clear **Save location** action within the customer record. Detect out-of-range coordinates, denied permission, timeout, inaccurate GPS, unavailable map tiles, disconnected mobile, wrong branch/tenant, edit and clear pin.
- No continuous location tracking or collection without explicit opt-in; enforce staff permissions and field-level audit for location changes. Use existing Leaflet/OSM where legally/operationally suitable; verify production tile rate/attribution policy before expansion.
- Store only the **confirmed shop pin** in the customer location fields; never overwrite with the device's position just because a user opened a customer.

## 5. Expenses — full business workflow
Discover expense list/create/edit/delete/archive as supported, categories, branch/route, amount/date, notes, cash vs bank (`paidFrom`), tax classification, VAT inclusive/exclusive, claimable VAT percentage, attachments and recurring expenses if present. Show inline hints, use appropriate numeric/date widths and clear field naming. Validate values on both sides. Verify save/refresh/edit/cancel, correct cash movement and daily close, valid VAT reporting, dashboard/category totals, attachment failure after expense was already created, lost response and duplicate submission. A failed attachment upload must read “Expense saved, attachment failed,” not “Expense not saved.” Test all filters and selected/bulk actions safely.

## 6. Purchases and suppliers — full end-to-end
Supplier create/edit/list/ledger/payments; purchase create with products, unit conversions, quantities, costs, VAT, tax claimability, discounts and payment type; save/reopen/edit/returns/cancel, stock increases/reversals, supplier payables, partial/full payments, credit/debit corrections and VAT/daily-close effects as applicable. Test row totals and exact decimal arithmetic, different receipt states, duplicate request, stale inventory, concurrent edits, missing supplier/product and wrong tenant. No financial report may be corrected with frontend-only totals.

## 7. Daily Close — existing feature, enablement and real accounting
Inspect existing `DailyClosePage`, `DailyCloseService`, `DailyCloseController`, tenant feature flags and role checks. Diagnose why the feature is disabled/hidden for a tenant. Implement/test a clear owner/admin settings workflow to enable when the tenant's plan/configuration actually allows it. **Do not bypass entitlements or silently change any live tenant's feature flag.** If the user's account lacks permission, show exact explanation and next step.

Test opening cash, carry-forward, cash sales, customer cash collections, supplier cash payments, cash expenses, owner in/out movements, counted cash, variance reason, close, reopening authorization and history. Test date/branch/cashier separation; never count bank/card as physical cash. Validate double-close, retroactive changes, locked periods, reversed transactions, timezone boundaries and audit records. Define/reconcile expected closing cash against underlying recorded transactions using backend services, not AI guesses.

## 8. Other dependent loops — do not stop after one screen
Continue through related sales/POS, payments, credit/debit notes, customer/supplier ledgers, dashboard, stock, VAT, reports, print/receipt and company settings as implicated by fixes. For every supported action test `create -> persist -> refresh -> read -> edit -> persist -> recalc -> export -> cancel/reverse (authorized)`. Check wrong status, missing balance, payment allocations, stock movement, VAT period write guards and client branding. Existing tests and functionality must stay green.

## 9. Premium helpful forms and UI QA
For every page, tab/subtab, dialog and list touched, use actual viewport tests at **360, 390, 768, 1024, 1440**; check mobile software keyboard, top/bottom nav overlap, scrolling, search + filter control sizes, input placeholder clipping, clear labels, readable numeric fields, loading/success/error feedback, no huge nested cards or wrapped buttons. Keep a restrained blue/white enterprise UI, coherent icon sizing, semantic colors and ~44px practical mobile touch targets. Make client data-entry instructions practical rather than obscure technical terms. Show examples as helper/placeholder, not prefilled fake customer or invoice information.

## 10. Server/API/storage & tenant safety assertions
Inspect the full data flow: button → form state → POST/PATCH → server validation → EF transaction → response serialization → client toast → list refresh → search/cache → DB query. Explicitly handle **committed-but-unacknowledged** writes: avoid blind retries, use idempotency keys for non-idempotent operations and reconcile operation outcome. Do not expose stack traces or DB secrets to customers. For financial requests, keep atomic posting (ledger, inventory, VAT, allocation, audit). Reject cross-tenant IDs and forged headers. Staff roles must apply at API level as well as UI.

Use synthetic tenants with different staff roles and overlapping SKU/customer names; test duplicate enforcement per tenant rather than across tenants. No AI/model needed to perform deterministic validation or accounts calculations.

## 11. Dedicated browser QA and optional reviewer agents
One **lead engineer** owns edits and integrates fixes. If supported, use one bounded **BROWSER-QA-ENGINEER** agent to exercise Chrome/Playwright and gather sanitized evidence, and one read-only **FINANCIAL-SECURITY REVIEWER** for concurrency, tenant and accounting invariants. Do not launch many independent writers on the same files. Every agent must report precise reproduction, expected/actual, log IDs, fix/verification state; do not waste tokens repeating entire repository descriptions.

## 12. Persistent bug register and execution tracker
Use existing docs if available; otherwise create:
- `docs/qa/HEXABILL-LIVE-REFERENCE-AND-E2E-BUGS.md` — defects, severity, source of evidence, known environment/version, reproduction, root cause, fix, regression, status.
- `docs/qa/HEXABILL-FIELD-MATRIX.md` — **all actual form fields**, examples, constraints, validations, test states and persistence check.
- `docs/qa/HEXABILL-E2E-PROGRESS.md` — module queue, checked screens, API/DB/browser evidence, screenshots and current blockers.

Use statuses **NOT_STARTED / REPRODUCED / FIXED / VERIFIED / BLOCKED / NOT_REPRODUCED**; severity P0/P1/P2/P3. Label code-only suspicions as HYPOTHESIS, not CONFIRMED. Each completed task records files, tests, exact results and links to sanitized local evidence.

## 13. Acceptance gates and test protocol
For each module: (1) enumerate actual fields and allowed operations; (2) reproduce reported issue before change; (3) failing regression test where feasible; (4) smallest root-cause fix; (5) local real Chrome Playwright user workflow; (6) API+PostgreSQL assertion; (7) edge/error/retry tests; (8) responsive + keyboard; (9) tenant/role test; (10) full impacted regression; (11) tracker updated. All 10 gates required for PASS. New migration requires a disposable PostgreSQL rehearsal and safety review.

Run relevant `.NET` tests including PostgreSQL concurrency when configured, frontend tests and production build. Do not count 52 skipped PG tests as green. Existing Playwright CRUD suites should be reused/extended. Capture complete failure output when a test cannot run; do not invent statistics. A field is not passed merely because it is visible; test its actual submit and persistence lifecycle. Tests may clean **only** synthetic fixtures in isolated environments.

Every milestone must report module statuses and **exact PASS/FAIL/BLOCKED counts**, which site/environment was tested, browser actions actually performed, changed files and outstanding P0/P1 bugs. Make concise local commits for verified checkpoints after reviewing `git diff`, but **no push, deploy, production mutation or migration without explicit authorization**.

**Final quality goal:** no unresolved confirmed P0/P1 workflow defect in a candidate release; no false save-failure states; no duplicate postings on retry; correct authorized balances/stock/VAT; truly helpful forms; reproducible multi-device, multi-role, multi-tenant tests. **Do not promise literally zero possible errors**, and do not claim live production passed on the strength of staging alone.

## Begin execution now
1. Preserve existing work and identify actual code/deployed versions.
2. Open Gulf Harvest in Chrome with authorized access for **read-only production diagnostics**; capture login state, browser/network errors and version/health evidence.
3. Establish staging/disposable PostgreSQL with synthetic tenant accounts.
4. **Products first**: enumerate every form field, improve sample/help/error UX, automate full create/edit/stock/deactivate/select/bulk operations, and identify the actual cause of false save failures.
5. Fix and verify until Products is PASS; only then start Customers, location, Expenses, Purchases, Daily Close and dependent accounting flows.
6. Persist exact status between sessions; continue safe independent local tasks. Pause only at required approval/access/security/paid-service gates.
