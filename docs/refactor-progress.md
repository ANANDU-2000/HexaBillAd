# Refactor implementation progress

Updated: 3 October 2026. Baseline: `39ffafb897cb905c617135721ae0afacd038571d`.

The user authorized implementation of the full plan. Checked boxes mean verified completion only; implemented code and runtime evidence are tracked separately. No production deployment, migration, tenant creation or tax activation has been performed.

## Scope and decisions

- Every-page acceptance matrix: **this file** (`#hexabill-verification-tracker`, 60 page IDs A01–P10 + tabs/features below)
- [Copyable agent prompt](plan/IMPLEMENTATION-PROMPT.txt)
- [Every-page specification](plan/PAGE-SPECIFICATION.md) — routes, tabs, dialogs, viewport acceptance
- [Phase to-do](plan/PHASE-TODO.md) — ordered work queue (do not skip phases)
- [Route manifest](plan/ROUTE-MANIFEST.json) — verified against `frontend/hexabill-ui/src/app/App.jsx` (60 paths); guarded by `frontend/hexabill-ui/tests/routeManifest.test.js`
- Historical Codex plan PDFs/Markdown on the planning machine are not in git; do not treat missing files as completed work

FrozenHub, GulfHub and Zayogya remain distinct clients. Proposed FrozenHub2 is a fourth operational workspace: same verified legal identity, separate owner and private operational data. Existing FrozenHub address is preserved. Opening imports are undecided until setup; copy no operational data by default. User confirmed UAE and accountant-approved margin treatment; actual eligibility/effective-date/calculation fixtures remain required. Zayogya tax behavior stays unchanged.

## Dependency-ordered implementation

- [ ] Phase 1: restore frontend build; record backend build/tests and deployed version gaps.
- [ ] Phase 2: tenant isolation, scoped drafts/cache/storage/jobs; reviewable second-owner setup and tests.
- [ ] Phase 3: payments, receipts and invoices; historical data, PDF/print, retries and idempotency.
- [ ] Phase 4: immutable cost/profit foundation; explicit authorized settlement adjustment and reversal.
- [ ] Phase 5: counted cash, daily close/history, capital reconciliation, alerts and close locking.
- [ ] Phase 6: approved margin-tax fixtures, history/effective dates, presentation and Zayogya regression.
- [ ] Phase 7: shared shell plus POS, ledger, purchases, suppliers, expenses and products on all viewports.
- [ ] Phase 8: every remaining route/tab/dialog; truthful platform infrastructure/errors/usage/flags.
- [ ] Phase 9: isolated AI text, invoice/PDF drafts, deterministic reports and provider usage/budgets.
- [ ] Phase 10: English/Arabic/Malayalam voice; driver assignments, saved pins, routes and live trips.
- [ ] Phase 11: staging journeys, PostgreSQL isolation, restore/rollback rehearsal, pilot and separately authorized rollout.

## Current work and verification log

- 3 Oct 2026 (`afa0` uncommitted): FE **72/72** + **build OK**, ESLint **0 errors** (235 warnings); BE **508** pass / **44** PG skip; billing-return workflow slice **68** pass; `DailyClosePetrolJourneyTests` (petrol→close); Render `GET /health` **200** + DB Connected (no deploy SHA in body, sample `2026-10-03T17:47:16Z`). `PaymentSettlementReceiptFlowTests` (1330+1 pay → receipt → petrol −75 → submit close counted **1255**, zero variance); snapshot + daily close fixtures `PurchaseCashPaymentTests` (cash/partial/credit at create); EF snapshot includes daily close + purchase paid-from/cost columns; purchase cash creates `SupplierPayment`; Render `/health` ok (deploy SHA unverified).
- Phase 1 local baseline restored: supported Lucide icons on Backup; dependency installation and frontend production build pass. ESLint has zero errors and 243 existing warnings. Deployed version parity remains unverified.
- Phase 2 implemented slice: owner/user-scoped POS drafts and product ranking history, stale callback and read-only guards, and validated session metadata preservation. Unowned legacy ranking data is ignored.
- Request caches now include host, API base and an opaque login-session generation; tokens never appear in cache keys. Login/support entry/logout clear caches and advance the generation. Old responses and errors are cancelled, delayed retries cannot acquire the new owner's credentials, and queued client errors stay within their original session. Pending expired-login redirects cannot interrupt a replacement login. The wrapper clones caller configuration and normalizes the API base consistently on cache lookup/store.
- Thirty-five frontend tests pass. Eight exercise the actual Axios wrapper/interceptors with in-memory adapters, mocked UI notifications and timers, including cached promise delivery and scheduled retry races. Four exercise the receipt modal with mocked services, including blocked print, failed download, repeated parent renders and successful download/object URL cleanup. Ordinary settings/branding cache invalidation preserves current-session requests; authentication transitions use a separate session reset. Other tests cover session key boundaries, draft/ranking cross-user/tenant isolation, malformed data and blocked storage. No HTTP server or production data is used by these tests. Jobs, private files and PostgreSQL isolation still require work and verification.
- Shared legal owner setup reuses the existing platform provisioning endpoint. It requires an explicitly enabled source feature, legal identity review fingerprint and confirmation. Legal fields come from the source; the new owner supplies separate contact/login details. Operational records start empty. No schema migration or real FrozenHub2 creation has occurred.
- Sixty-four targeted backend provisioning, tenant isolation, security and host-routing tests pass. These use the existing test environment; they do not establish PostgreSQL or production isolation.
- Phase 3 receipt eligibility slice implemented: reject pending/returned/void payments, refunds, credit entries and nonpositive amounts before persistence. Validate linked invoice/customer ownership and consistency, reject deleted/missing invoices and mixed-customer batches, deduplicate selected IDs, and enforce an explicit 500-payment batch limit. Voiding a payment blocks a later preview as received funds.
- Receipts read the workspace's persisted legal settings with its tenant identity as fallback, avoiding the shared hardcoded company/TRN/contact defaults. Missing company identity fails before receipt creation. Current customer balances no longer populate historical previous/remaining balance fields; those remain absent until immutable snapshots can prove them.
- Thirty-five receipt/payment-selection tests pass; the combined receipt/provisioning/isolation/security/host suite passes 99 tests. The full backend suite passed 197 tests before the invoice-restore guard below was added. Existing-number reuse, immutable details after company/customer/invoice/payment edits, legacy provenance, flag rollback, corrupt snapshot rejection and application overwrite prevention are covered. PDF controller tests exercise reviewed export, stale preview conflict, preview-first enforcement and cross-tenant rejection; controller invocation does not prove the HTTP authorization middleware. Five new relational SQLite checks cover batch rollback, fresh payment-state reads, legacy capture rollback, automatic execution-strategy retry and applying the additive snapshot migration to legacy rows. Other financial service tests use EF InMemory with transactions ignored. PostgreSQL migration SQL is generated without connecting; PostgreSQL concurrency and staging execution remain unverified.
- Snapshot capture is behind `receipt_snapshots`, off by default, with a platform Features switch. Already saved snapshots remain readable if the flag is disabled. Legacy rows are explicitly reconstructed and marked, never described as original historical evidence. Combined previews clone saved details without changing them and reject incompatible saved identities. Changed payment fields produce a warning while retaining saved receipt values. Receipt amounts now use the saved currency, and combined receipts expose a payment date range; visual QA is pending.
- Migration `20261003090000_AddPaymentReceiptSnapshot` adds a nullable text column and a unique filtered tenant/payment index for captured rows. PostgreSQL receipt allocation uses a transaction advisory lock per workspace and holds a share lock on selected payment rows until commit. Each execution-strategy attempt reads fresh payment/legal data inside its transaction. Rollback detaches only receipt rows changed by that attempt, preventing rolled-back tracked snapshots from contaminating automatic retries. Duplicate legal-setting keys resolve deterministically. Apply and verify this migration in isolated staging before the new application version: EF reads the column even while capture is off. Only an isolated in-memory SQLite migration fixture has run; no staging or production database migration has run. Application rollback retains saved details; database downgrade is deliberately refused rather than deleting financial evidence or marking a retained column unapplied. Flag removal is considered only after pilot verification, all new receipts capture correctly, and legacy provenance is retained.
- The shared EF model now declares the PostgreSQL invoice-number sequence only for Npgsql. This fixes SQLite schema creation without changing PostgreSQL sequence behavior; the full backend suite passed after this change.
- Remaining receipt gates: actual PostgreSQL migration/concurrent creation/rollback and commit-ambiguity checks, payment-state races under concurrent PostgreSQL writers, historical balance evidence, complete UI payment selection, PDF/print/retry UI and browser → API → data staging journeys. Full Phase 3 remains incomplete.
- Invoice version restoration was a destructive placeholder: it restored stock and deleted current lines but never recreated the requested version. The service now fails before database access with a controlled message, leaving invoices and stock intact. A regression test confirms unchanged lines, totals, version, stock and history with no tracked writes; nine relevant billing tests pass. The complete restoration feature remains pending. No frontend restore control was found by source search.
- Initial Phase 4 inspection found historical profit calculations using mutable product costs/conversion factors across profit, dashboard, branch/route and VAT reports, with no saved sale-line cost basis. The required final state captures a server-authoritative cost and conversion at posting, preserves it through legitimate invoice edits/version history and returns, labels legacy estimates, and switches all report consumers consistently. VAT eligibility and net revenue treatment remain separate accounting gates.
- Phase 4 cost foundation now adds nullable `UnitCostAtSale`, `ConversionAtSale` and `CostCapturedAt` to sale lines through migration `20261003110000_AddSaleItemCostBasis`. Capture in normal/override invoice posting is behind `sale_cost_snapshots`, off by default. The flag is not yet exposed for platform activation; complete consumer and staging gates first. Matching product/unit edits preserve the old basis even after flag rollback; legacy edits keep their unknown provenance. Ambiguous duplicate lines with different costs require a line-specific correction instead of silently choosing a cost. Invoice edit history now stores the cost evidence, and edit/delete stock reversal uses the saved conversion when available. Context guards reject overwriting saved cost evidence.
- ProfitService period/daily/product/branch results use saved costs when present and expose `EstimatedCostLineCount` for legacy estimates. Product profit now includes conversion to base units. The P&L screen and PDF include a legacy-cost disclosure. This does not yet establish accounting correctness of revenue/VAT/returns: existing revenue formulas remain, and dashboard, branch/route detail, VAT, product-sales and return consumers still require alignment before activation. No claim of a fully verified profit or statutory tax report is made.
- Thirteen new cost tests pass, covering real ProfitService results after product cost/conversion edits, legacy provenance without backfill, ordinary-edit and flag-rollback preservation, cross-workspace/ambiguous-line rejection, zero cost, partial-snapshot rejection, immutable fields, duplicate lines with matching costs, an actual isolated SQLite additive migration preserving old rows/writes, and PostgreSQL nullable numeric/UTC timestamp SQL generation without connecting. The relevant combined cost/restore/receipt/idempotency/VAT-basis selection passes 51 tests. Frontend production build passes; ReportsPage lint has zero errors and eight existing warnings. P&L browser and PDF visual QA, real invoice-posting/edit/delete journeys, PostgreSQL migration and concurrency remain NOT RUN. Apply both additive migrations in isolated staging before running this application version; EF reads new columns even with capture flags disabled. Application rollback retains evidence; schema downgrade refuses deletion. Consider removing the capture flag only after all consumers, imports/returns/history and production pilot gates pass; never backfill legacy evidence from current product costs.
- Latest full backend suite passes 211 tests, zero failures/skips, after the cost model and P&L disclosure changes. Full page/journey and production gates remain unchanged. Next cost work includes remaining report consumers, return valuation/conversion, tenant-filtered stock validation and duplicate-line stock checks, operational posting/edit/deletion fixtures and visual disclosure verification; Phase 4 remains incomplete.
- Cost consumer follow-up: summary/dashboard, branch/route detail, unassigned branch comparison, enhanced product-sales and the existing profit-basis VAT view now consume saved invoice costs/conversion. Branch totals include invoices with no route; unassigned comparison no longer reports all sales as profit before deducting costs. Legacy-cost counts are exposed in these result DTOs; the dashboard now displays a disclosure to owners. Product-sales aggregation remains in SQL and rejects partial/invalid snapshots before calculating. This changes cost provenance only; it does not certify the current VAT formula, revenue/return treatment, expense allocation or unassigned collections. Those remain accounting gates.
- Cost-query errors now propagate from summary, branch and route calculations instead of pretending costs are zero. The summary controller returns a logged generic error without successful invented figures or internal details. Dashboard failure hides previous figures and branch totals while keeping Retry available. Some existing non-cost query fallbacks and the branch/route missing-schema fallbacks still return incomplete/zero data; truthful availability across all report fields remains pending.
- Twenty cost tests now pass. New direct-service fixtures verify dashboard, branch, route and product-sales costs after mutable product edits, legacy estimates, branch invoices without routes, unassigned comparison costs, corrupted evidence rejection and unchanged cost in the existing profit-basis VAT view. A controller fixture verifies summary failures return HTTP 500 without figures or internal error details; it does not establish HTTP middleware behavior. The full backend suite passed 217 tests before the additional unassigned comparison test; that final targeted cost suite passes 20 tests. Frontend build passes and DashboardTally lint has zero errors/two existing warnings. Browser/PDF visual verification, PostgreSQL report-query execution, return cost reversal, inventory validation and source-to-posting journeys remain NOT RUN. Capture is still off and no production state changed.
- Return-stock follow-up: sales-return creation, approval and deletion now use the original sale line's saved conversion when present; damage inventory updates on creation/deletion use that basis too. Partial or invalid saved conversion evidence is rejected. Pending/rejected return deletion no longer reverses stock that was never posted. Creation rejects empty/oversized/duplicate-line requests before database access, rejects deleted source invoices, and rejected returns no longer reserve returnable quantity. Sale edit/deletion checks return history before mutating referenced lines or restoring stock, preserving the original cost evidence and return links. A proper audited linked-correction workflow remains pending; these checks are safety gates, not its completed replacement.
- Nine return/stock tests pass, including actual isolated SQLite service approval, pending/rejected/approved deletion, ordinary invoice edit/delete rejection with return references, and repeated sequential approval without another movement. Helper/input tests cover incomplete conversion and duplicate/empty requests. The combined return/cost/invoice-version suite passes 30 tests. No PostgreSQL, browser or production return journey has been run.
- Next return gates: durable conversion evidence for legacy returns; purchase-return conversion. Deferred approval now runs shared damage-inventory + write-off helpers on `ApproveSaleReturnAsync`. Capture stays off pending staging gates. Phase 4 and the full goal remain incomplete.
- Approved sale returns can no longer be physically deleted; `DeleteSaleReturnAsync` fails before stock, refund or credit-note removal and directs operators to audited reversal. Pending/rejected deletes unchanged.
- **Returns (Phase 4):** audited reversal, deferred-approval damage/write-off, approve refund/credit via `RefundStatus`. **Purchase returns:** `ConversionAtPurchase` migration `20261003120000`, `PurchaseStockBasis`, capture on purchase post/edit. **Backend suite:** **260/260** pass (local). `purchase_cost_snapshots` flag, `PurchaseCostBasis`, `CostCapturedAt` migration; purchase edit stock reverse uses frozen conversion. **FE:** `npm test` **40/40**. Staging migration apply + page QA still NOT RUN.
- Return approve/reject/delete/create now take a PostgreSQL workspace advisory lock and row-level `FOR UPDATE` on the sale or return inside the execution-strategy transaction; failed attempts detach tracked return/inventory rows before retry. SQLite fixtures still rely on status re-checks. One new reject-after-approve fixture passes with existing return stock tests.
- Invoice stock validation slice verified end to end: grouped `ValidateSaleStockLinesAsync` / `ValidateSaleEditAsync`, `BaseQuantity` on create/edit/delete/override, plus eight SQLite fixtures covering validation rules and `CreateSaleAsync` / `UpdateSaleAsync` duplicate-line reject/accept paths. PostgreSQL concurrency and browser journeys remain NOT RUN.
- Shared shell preparation: tenant and platform layouts now use a shared `RouteContent` with a contained Suspense/loading state and contained page error boundary. A lazy page no longer suspends the whole layout; page errors leave navigation mounted. Boundary recovery resets only after an error and a navigation-key change, so ordinary query changes do not remount healthy page content. Loading includes visible status text; chunk/offline/general errors have distinct recovery messages, an explicit 44px reload action and no raw technical details. The outer application boundary remains for shell/auth failures.
- Mobile primary navigation now matches the planned Home/Sale/Ledger/More layout. Billing history remains in the grouped More menu, verified by source references. Staff page-access filtering is retained. Sidebar preference reads/writes and the optional support display label tolerate blocked storage; malformed null/array group preferences fall back safely instead of crashing navigation. These preference fixes have lint/build evidence, not a dedicated storage/browser journey.
- Four actual React Router/component fixtures verify suspended-page navigation/state retention, contained error recovery on navigation, healthy-page state preservation across query changes, and explicit chunk reload without an automatic reload loop or technical-detail leakage. They use a fixture shell around the production RouteContent, not the full authenticated tenant/platform layouts. The frontend suite passes 39 tests. Changed shell files and the new test lint cleanly with zero warnings/errors. Full desktop/tablet/phone loading/error/navigation screenshots, touch focus, keyboard/safe-area/orientation, accessibility and real owner/support sessions remain NOT RUN. Shared shell work is partial; Phase 7, all-page acceptance and the full goal remain incomplete.
- Receipt PDF implementation now reuses `IPdfService`/QuestPDF and saved details only. The authenticated tenant endpoint checks a fingerprint of the reviewed preview, refuses unseen/unsaved receipts and returns `no-store` PDF bytes. The modal exposes PDF for saved receipts, reports inline download errors, ignores export completion after selection/close changes, and releases object URLs. Print reports blocked windows and waits for document/font readiness. A preview Retry action is available, and identical selected IDs no longer retrigger loading on every parent render.
- Generated [receipt fixture PDF](C:/Users/anand/.codex/visualizations/2026/10/03/01a0ffb1-43f9-7a91-a74e-bf9966b8c7ae/hexabill-plan/receipt-fixture.pdf) was extracted with pypdf and rendered with Poppler. One page contains the expected saved company/customer/receipt identifiers and separate 1331 invoice / 1330 applied / 1330 received amounts; visual inspection confirms legible Arabic company name, aligned rows and no clipping. It uses local Arial test fonts; production bundled fonts, lengthy/multipage receipts, browser downloads and native print dialogs still require verification. Latest frontend build and targeted lint pass with no errors; existing build/lint warnings remain.
- Local browser fixtures checked the owner setup dialog at desktop 1262×768, tablet 768×1024 and phone 390×844. No horizontal overflow or page errors were observed. Missing confirmation prevented submission; a duplicate-subdomain response preserved inputs and displayed a focused inline error. Shared form labels, required fields and error associations were repaired.
- Browser requests were mocked; backend creation tests were separate. Full browser → API → PostgreSQL provisioning, owner login and private-data journeys remain NOT RUN.
- Evidence: [desktop](C:/Users/anand/.codex/visualizations/2026/10/03/01a0ffb1-43f9-7a91-a74e-bf9966b8c7ae/hexabill-plan/owner-setup-desktop-final.png), [tablet](C:/Users/anand/.codex/visualizations/2026/10/03/01a0ffb1-43f9-7a91-a74e-bf9966b8c7ae/hexabill-plan/owner-setup-tablet.png), [phone](C:/Users/anand/.codex/visualizations/2026/10/03/01a0ffb1-43f9-7a91-a74e-bf9966b8c7ae/hexabill-plan/owner-setup-phone-error.png), [captured fixture request](C:/Users/anand/.codex/visualizations/2026/10/03/01a0ffb1-43f9-7a91-a74e-bf9966b8c7ae/hexabill-plan/owner-setup-browser-evidence.json). Evidence is from the uncommitted worktree based on the baseline above, not a deployed release.
- Final whitespace check passes. Changes remain uncommitted and have not been deployed.
- Production evidence from planning is historical only. Backend SHA/private database state and signed-in UI remain unverified.
- Local browser fixtures logged proxy connection refusals for background endpoints because no local backend was running; the UI-only checks above do not establish API health.
- Dependency installation reports 28 npm audit findings (2 low, 4 moderate, 22 high). These have not been triaged or remediated; avoid broad automatic major-version changes during this accounting refactor.

The exhaustive page/tab/feature and correctness checklist below is retained from planning. Partial checks are recorded separately from complete journey verification; do not infer page verification from compilation.

---
# HexaBill verification tracker

**Prepared 3 October 2026; implementation evidence added above. Complete staging journeys remain NOT RUN unless explicitly recorded.** Source findings and historical public infrastructure observations are in [the main plan](C:/Users/anand/.codex/visualizations/2026/10/03/01a0ffb1-43f9-7a91-a74e-bf9966b8c7ae/hexabill-plan/HexaBill-Refactor-Plan.md) and [evidence JSON](C:/Users/anand/.codex/visualizations/2026/10/03/01a0ffb1-43f9-7a91-a74e-bf9966b8c7ae/hexabill-plan/Audit-Evidence.json).

Use one evidence record per role + tenant + viewport. Required fields: environment, source commit, API version, test data reference, action, expected/actual, screenshot/trace, tester, date, blocker and next action. Do not replace NOT RUN with PASS based on source inspection.

## Pages and entry states

| ID | Page / route | Plan | Desktop | Tablet | Phone | Evidence / blocker |
|---|---|---|---|---|---|---|
| A01 | Tenant login — `/login` | Specified | PARTIAL | NOT RUN | NOT RUN | Local desktop load has content, no overlay/overflow/page error; authenticated staging journey required |
| A02 | Platform login — `/Admin26` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| A03 | Signup — `/signup` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| A04 | Invitation acceptance — `/login?invite=` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| A05 | Onboarding — `/onboarding` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| C01 | App shell and navigation — `tenant pages; /` | Specified | NOT RUN | NOT RUN | NOT RUN | Contained loading/error boundary and four mobile tabs implemented; React Router fixtures pass; full signed-in viewport/browser QA required |
| C02 | Home dashboard — `/dashboard` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| C03 | POS / new or edit invoice — `/pos` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| C04 | Billing history / invoices — `/billing-history` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| C05 | Sales ledger — `/sales-ledger` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| C06 | Customer ledger workspace — `/ledger` | Specified | NOT RUN | NOT RUN | NOT RUN | `recordPayment` deep link waits for loaded customer data, opens Payments tab; receipt offer + `returnTo`; browser journey NOT RUN |
| C07 | Customer list — `/customers` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| C08 | Customer details — `/customers/:id` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| C09 | Purchases — `/purchases` | Specified | NOT RUN | NOT RUN | NOT RUN | URL filter sync + supplier pay/ledger links with `returnTo`; HTTP purchase→stock→supplier payment journey passes; browser NOT RUN |
| C10 | Suppliers — `/suppliers` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| C11 | Supplier details and ledger — `/suppliers/:name` | Specified | NOT RUN | NOT RUN | NOT RUN | `returnTo` back + post-payment prompt from purchases; `recordPayment` query opens pay form; browser NOT RUN |
| C12 | Expenses — `/expenses` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| C13 | Products and inventory — `/products` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| C14 | Product details — `/products/:id` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| C15 | Price list — `/pricelist` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| C16 | Stock adjustment history — `/stock-adjustments` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| C17 | Sales return — `/returns/create` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| C18 | Delivery note list — `/delivery-notes` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| C19 | Delivery note view — `/delivery-notes/:saleId` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| C20 | Daily close — `/daily-close` | Specified | NOT RUN | NOT RUN | NOT RUN | UI + API wired; `daily_close` flag off by default; HTTP/unit petrol→close pass; signed-in staging NOT RUN |
| D01 | Quotations — `/quotations` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| D02 | Quotation editor — `/quotations/new; /quotations/:id` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| D03 | Agreements — `/agreements` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| D04 | Agreement editor — `/agreements/new; /agreements/:id` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| D05 | Salary certificates — `/salary-certificates` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| D06 | Salary certificate editor — `/salary-certificates/new; /salary-certificates/:id` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| O01 | Branches and routes list — `/branches; /routes` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| O02 | Branch details — `/branches/:id` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| O03 | Route details — `/routes/:id` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| R01 | Reports and outstanding shortcut — `/reports; /reports/outstanding` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| R02 | VAT workspace — `/vat-return` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| R03 | Owner worksheet — `/worksheet` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| S01 | Company settings — `/settings` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| S02 | Users and staff — `/users` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| S03 | Profile — `/profile` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| S04 | Activity log — `/audit` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| S05 | Backup and restore — `/backup` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| S06 | More — `/more` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| S07 | Help and support — `/help` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| S08 | Feedback — `/feedback` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| S09 | Not found, access and connection states — `*` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| S10 | Disabled recurring-invoice route — `/recurring-invoices` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| P01 | Platform overview — `/superadmin/dashboard` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| P02 | Companies / tenants — `/superadmin/tenants` | Specified | PARTIAL | PARTIAL | PARTIAL | Local owner setup fixtures pass; full page and real provisioning journey pending |
| P03 | Company detail — `/superadmin/tenants/:id` | Specified | NOT RUN | NOT RUN | NOT RUN | Shared legal setup flag added, default off; full page QA pending |
| P04 | Demo requests — `/superadmin/demo-requests` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| P05 | Infrastructure — `/superadmin/health` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| P06 | Error logs — `/superadmin/error-logs` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| P07 | Platform audit logs — `/superadmin/audit-logs` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| P08 | Platform settings — `/superadmin/settings` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| P09 | Global search — `/superadmin/search` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |
| P10 | SQL console — `/superadmin/sql-console` | Specified | NOT RUN | NOT RUN | NOT RUN | Signed-in staging QA required |

## New features

| ID | Feature | Plan | Implementation | Runtime evidence |
|---|---|---|---|---|
| N01 | Daily close / close history | Specified | Not started | NOT RUN |
| N02 | Owner assistant | Specified | Not started | NOT RUN |
| N03 | Driver Today / stop detail | Specified | Not started | NOT RUN |
| N04 | Dispatch and live trip | Specified | Not started | NOT RUN |
| N05 | Platform AI usage | Specified | Not started | NOT RUN |
| N06 | Shared legal identity / second owner setup | Specified | Implemented slice | Backend tests and local browser fixtures pass; PostgreSQL, production setup and import decision pending |

## Tab coverage

| Group | Tabs to test independently | Plan | Runtime |
|---|---|---|---|
| Customer ledger | Ledger; Invoices; Payments; Reports | Specified | NOT RUN |
| Products | All; Low stock; Missing barcode; Inactive; Stock movement | Specified | NOT RUN |
| Customers | All; Active; Outstanding; Overdue; Inactive | Specified | NOT RUN |
| Supplier | Summary; Ledger; Bills; Payments | Specified | NOT RUN |
| Expenses | Ledger; By category; category settings; add/edit | Specified | NOT RUN |
| VAT margin | Summary; Margin calculation; Exceptions; Filed history | Specified | NOT RUN |
| VAT standard | Overview; Transactions; Sales; Purchases; Expenses; Credit Notes; Validation | Specified | NOT RUN |
| Branch | Overview; Routes; Staff; Customers; Expenses; Performance; Report | Specified | NOT RUN |
| Route | Overview; Customers; Sales; Expenses; Staff; Performance; Stops map | Specified | NOT RUN |
| Settings | Company; Billing; Email; Notifications; Backup | Specified | NOT RUN |
| Platform company | Overview; Users; Invoices; Payments; Subscription; Usage; Limits; Features; Reports | Specified | NOT RUN |
| Platform settings | Defaults; Features; Communication; Announcement; Security; Links; proposed Provider policy | Specified | NOT RUN |

| Report tab | Runtime | Evidence |
|---|---|---|
| summary | NOT RUN | — |
| sales | NOT RUN | — |
| products | NOT RUN | — |
| net-sales | NOT RUN | — |
| returns | NOT RUN | — |
| customers | NOT RUN | — |
| overdue | NOT RUN | — |
| aging | NOT RUN | — |
| outstanding | NOT RUN | — |
| collections | NOT RUN | — |
| credit-notes | NOT RUN | — |
| expenses | NOT RUN | — |
| ap-aging | NOT RUN | — |
| branch | NOT RUN | — |
| route | NOT RUN | — |
| branch-profit | NOT RUN | — |
| damage | NOT RUN | — |
| staff | NOT RUN | — |
| cheque | NOT RUN | — |
| profit-loss | NOT RUN | — |
| ai | NOT RUN | — |

## Critical correctness and production gates

| ID | Area | Test | Status | Evidence / next action |
|---|---|---|---|---|
| FIN01 | Receivables | 1,331 invoice; 1,330 cash; authorized 1 adjustment; AR zero, cash 1,330 | NOT RUN | Implement/reproduce in isolated staging |
| FIN02 | Receivables | Same underpayment with Leave due; AR remains 1 | NOT RUN | Implement/reproduce in isolated staging |
| FIN03 | Receivables | Partial/split tender and overpayment advance; no cash inflation | NOT RUN | Implement/reproduce in isolated staging |
| FIN04 | Payments | Duplicate click, timeout retry and concurrent allocation post once | NOT RUN | Implement/reproduce in isolated staging |
| FIN05 | Payments | Pending cheque -> cleared -> bounced; balances and cash agree | NOT RUN | Implement/reproduce in isolated staging |
| FIN06 | Receipts | Historical reprint after another payment preserves as-of meaning | NOT RUN | Implement/reproduce in isolated staging |
| FIN07 | Documents | Invoice saved, PDF fails; retry PDF without creating sale | NOT RUN | Implement/reproduce in isolated staging |
| FIN08 | Daily close | Expected/actual cash, capital, bank, expenses, transfers and variance | NOT RUN | Implement/reproduce in isolated staging |
| FIN09 | Daily close | Concurrent/late entry, reopen, locked period and audited correction | NOT RUN | Implement/reproduce in isolated staging |
| FIN10 | Inventory | Credit purchase/paid purchase; converted units; return/damage/adjustment | NOT RUN | Implement/reproduce in isolated staging |
| FIN11 | Profit | Current product cost edited; historic cost/margin unchanged | **AUTOMATED** | `SaleCostBasisTests` display name `FIN11_*`; staging sign-off still pending |
| FIN12 | Tax | Approved positive/zero/loss/mixed-eligibility fixtures and statutory mapping | NOT RUN | Implement/reproduce in isolated staging |
| FIN13 | Tax | Effective date change, locked history, both owner workspaces; Zayogya unchanged | NOT RUN | Implement/reproduce in isolated staging |
| TEN01 | Identity | A token on B host denied; unknown host/token and spoofed proxy denied | NOT RUN | Implement/reproduce in isolated staging |
| TEN02 | Entities | Foreign list/detail IDs, child IDs and mixed batches denied atomically | NOT RUN | Implement/reproduce in isolated staging |
| TEN03 | Storage | Foreign PDF/R2/signed link/backup/restore denied | NOT RUN | Implement/reproduce in isolated staging |
| TEN04 | Async data | Cache/draft/late response/job/notification/map-channel tenant-user scope | NOT RUN | Implement/reproduce in isolated staging |
| TEN05 | Roles | Owner/staff/driver/platform/support direct-API permission parity | NOT RUN | Implement/reproduce in isolated staging |
| TEN06 | Provisioning | Shared legal identity, distinct phone/series/private data, opening import chosen | NOT RUN | Implement/reproduce in isolated staging |
| UX01 | Phone | 360x800, 390x844, 320px fallback, keyboard, safe area, orientation | NOT RUN | Implement/reproduce in isolated staging |
| UX02 | Tablet | 768x1024, 1024x768, touch and hardware keyboard | NOT RUN | Implement/reproduce in isolated staging |
| UX03 | Desktop | 1366x768, 1440x900, dense/comfortable rows, command shortcuts | NOT RUN | Implement/reproduce in isolated staging |
| UX04 | Accessibility | 200% zoom, focus/labels/status, contrast, reduced motion | NOT RUN | Implement/reproduce in isolated staging |
| UX05 | Language | Arabic RTL, Malayalam glyphs, long legal/contact names | NOT RUN | Implement/reproduce in isolated staging |
| UX06 | State | Query/tab/record/page/scroll restored by Back; no stale customer swap | NOT RUN | Implement/reproduce in isolated staging |
| UX07 | Network | Offline/slow/chunk/401/403/429/5xx/timeout with actionable recovery | NOT RUN | Implement/reproduce in isolated staging |
| DOC01 | Browser print | Desktop Chrome/Edge, Android Chrome, iOS Safari; popup denied/cancelled | NOT RUN | Implement/reproduce in isolated staging |
| DOC02 | PDF | 1/50/200 lines, A4/thermal, fonts, page breaks, matching screen totals | NOT RUN | Implement/reproduce in isolated staging |
| AI01 | Isolation | Wrong-owner prompt/ID/upload/conversation/export cannot cross scope | NOT RUN | Implement/reproduce in isolated staging |
| AI02 | Untrusted upload | Malicious PDF instructions, invalid file, size limit, low confidence draft | NOT RUN | Implement/reproduce in isolated staging |
| AI03 | Accuracy | Deterministic accounting tools and source citations, no invented balances | NOT RUN | Implement/reproduce in isolated staging |
| AI04 | Provider | Quota exhaustion, unknown usage, timeout, approved fallback, budget hard cap | NOT RUN | Implement/reproduce in isolated staging |
| AI05 | Voice | Malayalam/Arabic/English amounts/names; transcript correction; cancel/text fallback | NOT RUN | Implement/reproduce in isolated staging |
| MAP01 | Location | Missing pin, accuracy, denied permission, stale/offline, trip ended | NOT RUN | Implement/reproduce in isolated staging |
| MAP02 | Assignment | Reassigned driver sees only authorized active stops | NOT RUN | Implement/reproduce in isolated staging |
| MAP03 | Collection | Delivered status distinct from posted payment; offline replay idempotent | NOT RUN | Implement/reproduce in isolated staging |
| OPS01 | Release | Locked frontend build + target backend tests; serving/API SHA verified | NOT RUN | Implement/reproduce in isolated staging |
| OPS02 | Telemetry | Measured source/unit/as-of; unknown state; heap/process/container separate | NOT RUN | Implement/reproduce in isolated staging |
| OPS03 | Recovery | Staging backup restore, compatibility migration, flag/code rollback | NOT RUN | Implement/reproduce in isolated staging |

## Observations already obtained

| Check | Status | Evidence |
|---|---|---|
| Source route coverage | PASS | 60 distinct App.jsx patterns all represented in page specification |
| ZIP comparison | PASS | 582 files; no substantive differences after line-ending normalization |
| Current dependency icon compatibility | PASS (local tree) | `BackupPage.jsx` uses `AlertCircle` / `CheckCircle` (Lucide 0.294); Vercel at baseline commit still unverified |
| Latest listed Vercel deployment | FAIL (historical baseline) | Commit `39ffafb` build failed per planning audit; current uncommitted tree builds locally — redeploy SHA unverified |
| Previous serving Vercel deployment | READY observed | Production aliases on preceding successful commit; recheck before release |
| Render public health | Responding observed | 200; application reported DB connected; single sample |
| Private Render/DB diagnostics | NOT VERIFIED | Computer Use safety stop; read-only access still needed |
| Signed-in phone/tablet/desktop screenshots | NOT VERIFIED | Not obtained in this planning task |
| Application source mutation | NONE | Git status stayed clean during document creation |

### Payment selection follow-up

- Billing history now requests the full eligible payment-ID set for its invoice from the tenant-scoped server, rather than silently using page 1 / 100 rows. The lookup makes no receipt writes, excludes uncleared/refund/credit/nonpositive entries and rejects invoices with more than 500 eligible payments explicitly. Generation revalidates the selected payments, so the lookup is not authorization.
- The payment list now applies the requested customer filter before pagination, supports the cash customer scope with `customerId=0`, includes refund identity in DTOs and orders equal payment dates by ID. Invalid pagination receives a controlled validation response; unexpected list failures are logged without returning exception details. The ledger still loads at most 1000 matching payments and filters dates locally; full pagination/date-query redesign is pending.
- Desktop/mobile ledger receipt controls disable ineligible payments. Selection is limited to currently eligible rows, resets by customer/workspace, and is disabled for roles outside the existing server receipt roles and read-only support. Mobile rows now have receipt checkboxes; the selection toolbar stays within the page instead of covering global navigation. Cash payments can combine for the same known invoice; unrelated unknown cash customers cannot combine.
- New tests cover 121 eligible invoice payments, the 501-payment limit, customer filtering before pagination/refund identity, same-invoice cash grouping, eligibility and stale selection pruning. Latest targeted frontend lint has no errors; existing warnings remain. Browser QA for these changed ledger/billing controls remains NOT RUN.
