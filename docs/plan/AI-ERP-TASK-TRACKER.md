# HexaBill AI-native ERP — single task tracker

**Status:** IN_PROGRESS — tracker adopted into repo 2026-10-10 on branch `uiux-audit-p1` (base `origin/main` = `c6ba249`).
**Last verified (2026-10-17):** live site still deploy `86eafed` / bundle `index-DdioVnWh.js`. Gulf Harvest product create saved product 136 and left the form open; that row was then set inactive. Dashboard still shows receivables 10.75 because the live API ignores the approved return. Local save handlers now close the form when the saved row is found, and uncertain purchase/expense/payment/sale messages no longer say the row was not saved. `node --test tests/apiError.test.js` 3 passed. SQLite outstanding, sales-status, and `Sqlite_NullReturnRoute_BranchAndRouteUnpaidZero_VatNetsTheReturn` passed. Branch totals now follow the sale when the return has no branch or route. PostgreSQL theory still skipped. Production behavior is NOT this local code.
**Historical production verification (2026-10-11, approved recovery):** backend and frontend were live at runtime source `704f802`. Render deployment `dep-db5iuhflot8c73f4mit0` was live; Vercel `dpl_EudWcr84trNpUCKnKNLPnGDvLgoh` was READY with production aliases. PostgreSQL 18.6 had 52 applied history entries; deployed `/health/ready` was Ready/Current with zero pending migrations. Protected backup/restore and atomic migrations PASS. Disposable PostgreSQL backend suite: 781 passed, 0 failed, 0 skipped. Four real client public/proxy/login layout checks PASS; authenticated pages/forms and feature enablement required existing owner/SuperAdmin sign-ins. See the two dated recovery/verification evidence documents in `docs/production`; these are historical facts, not current deployment evidence.
**Linked trackers (not duplicated here):** `docs/production/TASK-TRACKER.md` + `BUG-REGISTER.md` (T-/B- IDs), `docs/plan/PRODUCTION-ISSUE-REGISTER.md` (PS-), `docs/plan/ERROR-REGISTER.md` (REL-), `docs/plan/VAT-IMPLEMENTATION-TRACKER.md`, `docs/uiux/PREMIUM-UX-TRACKER.md` (UX). `docs/plan/STATE.md` is historical (stale deploy SHA).
**Session order approved by owner 2026-10-10:** Checkpoint 1 = UX Phase 1 audit (read-only) → Checkpoint 2 = P0-02. Read-only production checks authorized for P0-02.
**Current milestone:** P0 — Production stability and evidence.
**Active local execution (2026-10-17):** branch `codex/return-branch-route-parity-2`, HEAD `74280c7`. Return checkpoints RETURN-01..05 and the save-handler fixes are local only and are not the live Render commit. Save-incident evidence: `docs/qa/HEXABILL-PRODUCTION-SAVE-INCIDENT.md`. Next: deploy is not authorized; after an approved frontend+API deploy, recheck product/customer create and sale 1628 dashboard/aging. Product 136 stays inactive.
**Historical execution (2026-10-12):** source `3cd2a208`, QA branch `codex/live-erp-qa-20261012`; live backend readiness then reported this full SHA, while Vercel domain metadata reported frontend `c9dc5e6`. QA-C01 customer duplicate-email confirmation was verified locally on disposable PostgreSQL across all five widths. Production records read only. Historical evidence: `docs/production/ERP-LIVE-QA-2026-10-12.md`.
**Tracker contract:** real tasks only; update `Last verified`, `git SHA`, test command/outcome, exact source reference/evidence. States `TODO / IN_PROGRESS / PASS / FAIL / BLOCKED / NOT TESTED`. Do not count skips as PASS. Existing VAT UI tracker is separate; link relevant entries.

| ID | Priority | Milestone | Task | Status | Evidence / gate |
|---|---|---|---|---|---|
| P0-01 | P0 | 0 | Capture `git status`, source SHA, Render/Vercel deployed versions and source drift | PASS (Vercel NOT TESTED) | 2026-10-10: see header; Render `list_deploys` live `92a5059`; Vercel SHA unverified (prior 403) |
| P0-02 | P0 | 0 | Investigate maintenance UI on frozenhub login (explicit maintenance vs arbitrary 503); recoverability | PASS (code, local and live recovery) | 2026-10-11 user-approved recovery: protected production backup restored with all 67 table counts/history matching; both pending VAT migrations applied atomically with old-row/default guards; 52 applied entries, no pending migrations, backend/frontend live at `704f802`. Deployed `/health/ready` HTTP 200 Ready/Current; all four real tenant proxy maintenance checks HTTP 200/false. Existing local recovery tests remain recorded below. Evidence: `docs/production/MIGRATION-RECOVERY-2026-10-11.md`. Authenticated all-feature/client coverage is separate and NOT TESTED pending credentials. |
| P0-03 | P0 | 0 | Verify PostgreSQL integration skips, migration history and disposable-PG migration rehearsal | PARTIAL | 2026-10-10: full suite with `HEXABILL_TEST_POSTGRES` on fresh disposable DB 778/778, 0 skips. Old disposable DB `hexabill_master_loop_test` lacks today's VAT columns (42703) — reuse of stale test DBs gives false failures. Silent-return PG tests and fresh-history migration collision (REL-004/011) still open |
| P0-04 | P0 | 0 | Fix confirmed wrong-company/TRN/footer in Gulf Harvest/Frozen Hub print | PARTIAL | GH PASS (T-001, T-010a-c, Starplus absent assertions); FrozenHub family T-010d BLOCKED(asset) — FH BW logo present in `SeedLogos/` since `9630420`, re-check |
| P0-05 | P0 | 0 | Reconcile expected four tenants vs shown three; no duplicate creations | PARTIAL | B-004 note: read-only prod check counted 7 tenants; SuperAdmin list pageSize 20, case-sensitive search, stat cards count current page only |
| P0-06 | P0 | 0 | Audit real create/edit/save/delete in POS, purchase, expense, payment, SKU, stock and reports | PARTIAL | T-004a-c PASS (SQLite HTTP harness); returns HTTP round-trip T-004d TODO |
| P0-07 | P0 | 0 | Check idempotency/retry/double-payment and tenant leakage in APIs, caches, logs and exports | PARTIAL (client fixed) | Old client re-sent a failed expense POST (browser test: 2 requests). Now writes auto-retry only with `Idempotency-Key` or POS `externalReference` (`isAutoRetryable`). Server-side dedupe for purchases/expenses/returns still TODO |
| P1-01 | P1 | 1 | Tenant onboarding, owner invitation/reset, subdomains, role permissions | TODO | 4 synthetic tenant E2E |
| P1-02 | P1 | 1 | Staff job title, active vs attendance distinction, owner activity dashboard | TODO | role and activity E2E |
| P1-03 | P1 | 1 | Last finalized customer-product-unit price reuse, returns/void/edit edge cases | TODO | historical price tests |
| P1-04 | P1 | 1 | Daily opening/closing cash UX, tender reconciliation, branch/cashier | TODO | expected vs counted and role tests |
| P1-05 | P1 | 1 | Frozen Hub header only + common print identity/Arabic/monochrome design | TODO | PDFs and image diff |
| P1-06 | P1 | 2 | Inventory routes/screens/modal/form count and premium shared design tokens | IN_PROGRESS (audit PASS; Expenses slice PARTIAL, Checkpoint 3: list states PASS, first-record target 35% not met; other modules TODO) | 2026-10-10 Checkpoint 1: `docs/uiux/PAGE-INVENTORY.md` recount + `docs/uiux/PREMIUM-UX-TRACKER.md` (25 confirmed defects (8 P1, 14 P2, 3 P3) + 1 NOT REPRODUCED + 1 NOT TESTED, baseline metrics at 360/390/768/1440); `e2e/ux-audit.spec.js` 28/28 passed on synthetic local data |
| P1-07 | P1 | 2 | Desktop navigation, tablet, mobile quick create, no duplicate chrome | TODO | Playwright viewport matrix |
| P1-08 | P1 | 2 | Tenant global search + indexed results + shortcuts | TODO | permission and latency tests |
| P1-09 | P1 | 2 | Faster invoice/POS/purchase/expense workflows; explicit save confirmation | TODO | click/time and DB E2E |
| P1-10 | P1 | 2 | PWA install, auth/cache/privacy and offline semantics where feasible | TODO | install/clear session checks |
| AI-01 | P2 | 3 | Backend tool registry with tenant/role scope and source links | TODO | negative cross-tenant tests |
| AI-02 | P2 | 3 | Provider registry + API-key safe vault + model/capability/cost routing | TODO | synthetic provider tests |
| AI-03 | P2 | 3 | SuperAdmin provider/test/keys/models/quotas/usage/email alerts | TODO | auth audit + budget tests |
| AI-04 | P2 | 3 | Read-only assistant for sales, AR, stock, expenses, routes, daily close, staff | TODO | grounded response evidence |
| VOICE-01 | P2 | 4 | Malayalam/English/Hindi/Arabic push-to-talk STT, captions, text fallback | TODO | locale/accent/noise eval |
| VOICE-02 | P3 | 4 | LiveKit real-time voice & Gemini Live/voice pipeline optional | TODO | latency, privacy, caps |
| VOICE-03 | P3 | 4 | Voice-drafted invoice with confirmation & idempotent posting | TODO | injection, ambiguity, denial tests |
| MAP-01 | P2 | 5 | Existing routes/stops/collections map + delivery/visit completion | TODO | geofence/role/e2e |
| MAP-02 | P3 | 5 | Opt-in location tracking, freshness, attribution/licensed tiles | TODO | permission/session/retention |
| AUTO-01 | P2 | 5 | Daily summaries, overdue reminder drafts, stock alerts, owner email alerts | TODO | dedupe/quiet hours/audit |
| ML-01 | P3 | 6 | Data quality check, demand/reorder/payments baseline, time-split evaluation | TODO | baseline accuracy report |
| ML-02 | P3 | 6 | Approved model rollout, feedback, drift and safe scheduled retraining | TODO | offline comparison/pilot |
| FINAL-01 | P0 | ALL | Cross-tenant security/PII, unit integration, PG, E2E, build, PDF, AI failures | TODO | No unexplained skips |
| FINAL-02 | P0 | ALL | Stage rollout plan, backups, feature flags, rollback, support docs | TODO | Written approval for prod |

## Session log
### 2026-10-17 — UX-03 (continued): tablet overflow sweep across 18 main routes (PASS locally in browser; NOT live)
- Extended `e2e/tablet-touch-targets.spec.js` with a sweep of /pos, /payments, /expenses, /ledger, /reports, /vat-return, /daily-close, /suppliers, /quotations, /delivery-notes, /salary-certificates, /pricelist, /users, /settings, /branches, /routes, /sales-ledger, /billing-history at touch 820x1180 (portrait), 1024x768 and 1180x820 (landscape): no horizontal page overflow and a 16px root on every route. **7/7 pass** (the earlier 4 plus 3 sweep cases) on the synthetic tenant.
- Limits: this checks page-level overflow and root size only. It does not prove a route rendered its content (a route that redirects would also pass), does not check inner scroll containers, forms with the software keyboard open, split view, orientation changes mid-form, RTL, or real devices. Back navigation, filter and action-bar consistency (UX-06) are not done.
- Next remaining local work is mostly UX-06 consistency; AI-02, voice, documents, maps and forecasts need owner decisions.

### 2026-10-17 — UX-06 (third slice): remaining swallowed load failures (PASS locally for route/branch; SuperAdmin page NOT TESTED in a browser; NOT live)
- Fixed with the shared `ErrorState` and retry: route branch-level expenses (`RouteDetailPage.jsx`), the branch customer refresh after a transfer (now reuses the Customers tab effect, so it also gets the failure state), and the SuperAdmin tenant payment history (`SuperAdminTenantDetailPage.jsx`; money history is no longer silently blank, and `success: false` counts as a failure).
- Evidence: `e2e/route-expenses-load-failure.spec.js` **3/3 at m360, t768, d1440, red on the previous page**; `e2e/branch-detail-load-failure.spec.js` re-run after the transfer-refresh change **4/4 (m360, d1440)**. Frontend `npm test` 210/210; lint 0 errors; build exit 0.
- NOT TESTED: the SuperAdmin payment history in a browser (needs a platform-host session the synthetic harness does not provide; only build and lint), the branch customer transfer flow end to end.
- The audited "failure shown as empty" list pattern is now cleared on the files named in the earlier slices. Pages not scanned may still have it.

### 2026-10-17 — UX-06 (second slice): branch Customers and Staff failed loads (PASS locally in browser; NOT live)
- `BranchDetailPage.jsx`: the Customers and Staff tabs turned any load failure into an empty list ("No customers in this branch", "No staff assigned"). They now show the shared `ErrorState` with Try again (refetches both tabs); the empty messages appear only after a successful empty load. A `success: false` response counts as a failure too.
- Evidence: `e2e/branch-detail-load-failure.spec.js` **6/6 at m360, t768, d1440** (real branch via API, list responses mocked to fail then succeed). **Both tests red on the previous page, green on the fix.** Frontend `npm test` 210/210; lint 0 errors; build exit 0.
- Still `.catch(() => set...([]))` and not fixed: `SuperAdminTenantDetailPage.jsx` payment history, `RouteDetailPage.jsx` general expenses and stop-location flag, branch customers refresh at line ~456, plus any page not scanned.
- NOT TESTED: widths 390/1024 for this spec, the SuperAdmin page.

### 2026-10-17 — UX-06 (first slice): failed loads are not "empty" on route sales (PASS locally in browser; NOT live)
- Same bug class as the staff activity dialog (REL-02): `RouteDetailPage` turned a failed invoice load into `[]`, so the tab said "No invoices for this route yet." Now a failed load shows the shared `ErrorState` ("Invoices could not be loaded", Try again) and the empty message appears only after a successful empty load. Retry refetches.
- Evidence: `e2e/route-sales-responsive.spec.js` now 10/10 (5 widths, layout test plus failure/retry test; mocked 500 until Try again is pressed). The API client already retries failed GETs on its own, so the mock keeps failing until the user retries. **Failure test red on the previous page, green on the fix.** Frontend `npm test` 210/210, lint 0 errors, build exit 0.
- Same pattern still present, not fixed: `.catch(() => set...([]))` in `BranchDetailPage.jsx`, `SuperAdminTenantDetailPage.jsx`, `RouteDetailPage.jsx` (general expenses, stop-location flag), plus other pages not scanned. A one-by-one pass is the remaining UX-06 work, along with consistent back navigation, filter and action-bar patterns.
- NOT TESTED: other error states in a browser, ErrorState copy review.

### 2026-10-17 — UX-02 (continued): route sales phone cards (PASS locally in browser; NOT live)
- `RouteDetailPage.jsx` sales tab now shows invoice cards below `md` (invoice no, customer, date, total, status, 44px View button); the table is unchanged from `md` up. The other four tables on this page (customers, expenses, summaries, print views) are not changed.
- Evidence: `e2e/route-sales-responsive.spec.js` **5/5 at m360, m390, t768, d1024, d1440**; **red on the previous page** (no card list), green on the fix. The route and branch are real records created through the API on the synthetic tenant; **only the invoice list response is mocked** (three invoices, one with a very long customer name), so this proves layout and rendering, not invoice data. Frontend `npm test` 210/210; lint 0 errors; build exit 0.
- NOT TESTED: route sales with real invoices, route customers/expenses tables on phones, S189 on production, 820/1180 widths.

### 2026-10-17 — AI-01 foundation: read-only assistant tool registry (PASS locally; backend only; NO model, NO UI, NOT live)
- Scope: the provider-free base the assistant will sit on. No LLM, no network call, no write tool, no real customer data sent anywhere. `Modules/Assistant`: `AssistantToolRegistry` (fixed list), `find_customers` (existing `ICustomerService.SearchCustomersAsync`) and `product_stock` (existing `IProductService.SearchProductsAsync`). Endpoints: `GET /api/assistant/tools`, `POST /api/assistant/tools/{name}`.
- Controls: caller (tenant, user, owner/admin flag) is read from the token only; platform administrators get 403; unknown and not-allowed tools both return 404; arguments are typed and any extra field (`tenantId`, `sql`, ...) is rejected with 400; query length and limit are bounded (limit capped at 10); owners/admins see balances and cost price, staff get those fields as null; every answer carries record sources with an as-of time; a run writes an `AssistantToolRun` audit row with the tool name and source count, not the search text.
- Evidence: `AssistantToolsHttpTests` **15/15** (own-tenant results and sources, other tenant sees nothing of tenant A, staff redaction, owner sees cost, 7 invalid-request cases, limit cap, tool list, platform admin denied, audit row without search text). Isolation proved capable of failing: with the tenant scope in `find_customers` temporarily hard-coded to tenant 1, the other-tenant test failed (14/15), then the code was restored. First run was green (no separate red phase). Full backend suite on a fresh disposable PostgreSQL database (`hexabill_full_20261017b`, port 55474): **880 passed / 0 failed / 1 skipped** (the opt-in migration rehearsal; reported as NOT TESTED).
- Test-environment warning: the older shared database `hexabill_return_20261017` has a stale schema (global `IX_SaleReturns_ReturnNo`); the return-parity tests fail there with 23505. Use a fresh database for full runs; this is not a product regression.
- NOT BUILT / NOT TESTED: the right-side or full-screen assistant UI, language-model orchestration and provider routing, sales/statement/approved-document tools, prompt-injection tests (no model to inject into yet), per-user rate limiting, draft actions with server-stored drafts and confirmation (AI-02), provider keys and budget (need owner decisions), Malayalam voice.
- Next: owner decisions needed before AI-02, tenant documents, voice and any provider use; safe local work remaining is UX-06 patterns and the open items listed above.

### 2026-10-17 — INS-01 deterministic insights ranking and labelling (PASS locally; NOT live)
- Root cause (code-confirmed): `ReportService.GetAISuggestionsAsync` built "top sellers" with `GroupBy` then `Take(5)` and no ordering, so it returned any five products sold in the period; it also counted deleted sales. The Reports tab called these fixed rules "AI Business Insights" and "AI-powered recommendations".
- Change: top sellers are ranked by revenue (sum of line totals) descending with a stable tie-break, deleted sales excluded, explicit tenant predicate. The response now carries `TopSellerStats` (revenue, quantity per row), `RankingBasis`, `Method = "rule-based"`, `PeriodDays` and `AsOf` (additive fields). Quantity is reported but not ranked on because units differ between lines. The tab is renamed Insights; text says the suggestions are rule-based and no AI model is used; the top-seller list shows revenue, basis, period and as-of. The tab stays off by default (existing env flag).
- Evidence: new `RuleBasedInsightsPostgreSqlTests` on disposable PostgreSQL 55474 (synthetic tenants, a deleted sale and another tenant's seller): **red on the old code** (got `[56, 57, 58]` including the deleted-sale product, expected `[57, 56]`; an earlier red was a fixture error and was discarded), **green on the fix**. Filtered backend run (`Report|Insight|Product`) with `HEXABILL_TEST_POSTGRES` passed, 0 skipped. Frontend `npm test` 210/210, build exit 0, lint 0 errors.
- NOT TESTED: the Insights tab in a browser (disabled by default; needs the env flag), restock/low-margin/promotion rule thresholds (unchanged and not reviewed for correctness), an `Insights` source link to the underlying report.
- Next: remaining items are the AI assistant, tenant documents, voice, maps, forecasts (need owner decisions on provider, data use and budget before real data) and broader UX-06; production deploy and infra checks stay gated.

### 2026-10-17 — CLEAN-01 documentation index and empty parent lockfile (PARTIAL; cleanup kept minimal)
- Verified in this checkout: the four duplicate groups from the audit are byte-identical (same MD5). Only one tracked file references the old `TEST END TO END/` folder (`docs/qa/ENGINEERING-REGISTER.md`, which records that folder as intentionally preserved), and the two goal documents only name each other. No tool, script or CI file references any of the duplicates.
- Removed: `frontend/package-lock.json` (an empty `packages` map; no `frontend/package.json` exists). Usage check: `vercel.json`, both GitHub workflows and `render.yaml` always target `frontend/hexabill-ui`. `frontend/hexabill-ui` `npm run build` exit 0 afterwards. Git history keeps the file.
- Added: `docs/INDEX.md` (authority order, evidence map, duplicate table, cleanup rules). Nothing moved or deleted otherwise.
- Not done on purpose: duplicate QA files in `TEST END TO END/` (user documents), duplicate goal documents (owner must choose the canonical one), skill copies (both discovery paths intentional), root-document relocation, large-file refactors, bulk moves.
- NOT TESTED: a Vercel build from the actual dashboard configuration (root directory setting not read; the repo's `vercel.json` implies repo root).
- Next: authorized product work; AI, voice, maps and forecast items remain unstarted and mostly need owner decisions (provider, data use, budget).

### 2026-10-17 — OPS-01 runtime schema repair: inventory and fresh-migration finding (FINDING recorded; NOTHING removed; rehearsal NOT TESTED by default)
- Inventory (static): about 217 `ALTER TABLE` occurrences outside `Migrations/` (115 in `Program.cs`, 10 and 6 `CREATE TABLE` in `PostgresBranchesRoutesSchema.cs`, `TenantContextMiddleware` adds `Tenants.FeaturesJson` at request time, plus `SuperAdminTenantService`, `VendorDiscountService`). Production-startup supplier DDL is among them. None changed in this checkpoint: removal needs a verified versioned baseline first (audit condition).
- Finding (executed, disposable PostgreSQL 18, scratch database created and dropped by the test): migrating an empty database from the 42-migration history fails. `20260214173227_AddBranchAndRoute` was scaffolded against SQLite (`INTEGER`/`TEXT`, 32 `CreateTable` calls) and re-creates tables such as `Customers` that `InitialPostgreSQL` already made (42P07). So a fresh PostgreSQL database cannot be built from migrations; production only works because its history rows already exist. This is the same collision recorded earlier as REL-004/011.
- Added `MigrationRehearsalPostgreSqlTests` (opt-in via `HEXABILL_MIGRATION_REHEARSAL=1`, needs `HEXABILL_TEST_POSTGRES` and CREATE DATABASE rights). Default run: **1 skipped** (reported as NOT TESTED, not PASS). Opt-in run: **1 failed** with the exact migration and SQL. Once migrations can build an empty database, the same test also reports every column the model expects but the migrations did not create, which is the list the runtime DDL is covering.
- Not changed and needs an owner decision: how to establish a baseline (for example a generated PostgreSQL baseline migration plus marking older rows applied, versus keeping EnsureCreated for fresh installs), then moving each runtime `ALTER` into a numbered idempotent migration, then deleting the runtime path. Rehearsal against a copy of the real history (backup/restore) is required before any production migration, and none was run.
- Next: UX-06 shared patterns or AI/document work as authorized; production items remain gated.

### 2026-10-17 — UX-03 tablet touch size (PARTIAL: root-size fix PASS in browser; shell/orientation work NOT done; NOT live)
- Root cause (CSS-confirmed): `index.css` dropped the root font to 14px for every viewport >= 769px. Tailwind sizes are rem-based, so on tablets at 820/1024/1180px `min-h-11` rendered 38.5px and other controls shrank, below the 44px touch minimum (this also explains the 38.5px seen in UX-05).
- Change: the compact 14px root now applies only to `(min-width: 769px) and (pointer: fine)`. Touch tablets keep 16px; mouse desktops are unchanged. One rule, no per-component edits.
- Evidence: `e2e/tablet-touch-targets.spec.js` with touch emulation at 820x1180, 1024x768 and 1180x820: root 16px, no horizontal overflow on /dashboard, /purchases, /products, /customers, dashboard primary action >= 43.5px; mouse 1280 keeps 14px. **4/4 pass; the three touch cases fail on the old CSS (got 14px).** Build exit 0.
- Risk and NOT TESTED: this enlarges type and spacing on tablets everywhere (about 14% at these widths); only four pages were overflow-checked. Not tested: real iPad/Android, split view, software keyboard, orientation change with a form open, other routes (reports, POS, ledger), RTL. Hybrid laptops with touchscreens report a fine primary pointer and keep 14px.
- Remaining UX-03/UX-06 scope not started: tablet shell/back navigation consistency, shared filter/list-card/status styling, error-state and action-bar patterns.
- Next: OPS-01 runtime schema repair review.

### 2026-10-17 — OPS-02 memory metric uses the enforced container limit (PARTIAL: code PASS locally; live provider metrics BLOCKED)
- Root cause (code-confirmed): `PlatformMetrics`/`DiagnosticsController` computed memory% as managed heap divided by the process's own working set, and set `limitsHint` critical/warning from it. That ratio says nothing about the Render plan limit (a 95 MB heap in a 100 MB working set read "critical" with no limit known).
- Change: new `ContainerMemory` reads the host-enforced limit (cgroup v2 `memory.max`, then v1 `memory.limit_in_bytes`; "max"/unlimited/invalid is no limit) and reports process working set over that limit. With no limit, `memoryUsagePercent` is null, metrics are marked unavailable and the hint is driven only by the DB pool. The heap ratio stays as an informational metric labelled "not capacity headroom". `/diagnostics` health memory check now reports heap, working set, limit, source and `unknown` status instead of a fake percent. SuperAdmin dashboard shows "X MB / limit" or "Container limit not reported by the host".
- Evidence: `ContainerMemoryTests` plus existing `PlatformMetricsTests` **16/16 passed, 0 skipped**. The heap-ratio-no-longer-critical test was written with the change and was not run against the old code (the old signature does not compile with it); the old behaviour is evident from the removed formula. Frontend build exit 0, lint 0 errors.
- BLOCKED: real Render memory/CPU limits and usage (`get_metrics`) and deployed-commit mapping: the Render connector needs the owner to confirm a workspace; none was selected. NOT TESTED: cgroup reading inside a Linux container (parsing and fallbacks are unit-tested with injected file reads only), dashboard in a browser.
- Next: OPS-01 versioned schema ownership (runtime DDL), then UX-03.

### 2026-10-17 — SAFE-01 clear-all-data server guard (PARTIAL: server guard PASS; relocation to a recovery screen NOT done; NOT live)
- Root cause (code-confirmed): `POST /api/settings/clear-data` accepted any Owner/Admin call with no body; the "type CLEAR" box existed only in the page, so a direct call (or any session) could wipe a company's transactional data.
- Change: the endpoint now requires, on the server, a reason (>=10 chars), the exact word `CLEAR`, a backup acknowledgement, and the caller's own password (BCrypt check, tenant-scoped user lookup; a failed check is 403 and logged as SECURITY). Success writes an `AuditLog` row (`ClearTenantData`, with the reason). The settings modal collects reason, password and a combined understand-and-backup checkbox and keeps its button disabled until all are valid. Clear logic (`ClearTenantDataAsync`) unchanged.
- Evidence: `ClearTenantDataGuardHttpTests` (no body 400; short reason / wrong word / no backup ack 400; wrong password 403; valid 200 with audit row containing the reason), each on its own throwaway tenant: **red 6/6 before, green 6/6 after**. Filtered backend run (`ClearTenantData|Settings|Tenant`) **384 passed / 0 failed / 0 skipped** with `HEXABILL_TEST_POSTGRES` on disposable cluster 55474. Frontend `npm test` 210/210, build exit 0, lint 0 errors.
- Owner decisions still open (not changed, security-sensitive): (1) restrict to Owner only (Admin can still call it, with the new checks); (2) move the control out of ordinary Settings into a restricted recovery screen; (3) recent-authentication window or MFA instead of password re-entry; (4) verify a real recent backup exists server-side instead of an acknowledgement. SystemAdmin's `POST api/superadmin/tenant/{id}/clear-data` is separate and unchanged.
- NOT TESTED: the modal in a browser (a real click would wipe synthetic data; only compile/lint), profile-page clear controls (S237 path not located), rate limiting of repeated password attempts on this endpoint.
- Next: OPS-02 true resource metrics.

### 2026-10-17 — DATA-01 company count definitions (PARTIAL: server counts PASS; UI browser NOT TESTED; no tenant data touched)
- Root cause (code-confirmed): `SuperAdminTenantsPage` showed "Total Businesses" = the filtered `totalCount`, and "Active"/"Trial" = counts over the current page's 20 rows only. Seven vs five in S288/S300 is therefore partly a definition problem. No tenant was created, merged or deleted; the real five-client inventory is NOT reconciled here (needs a read-only look at the live directory and the owner's list, including which rows are test/demo).
- Change: `GET /api/superadmin/tenant` now also returns `statusCounts`, `directoryTotal` and `asOf`, computed over every company regardless of page, search or status filter (additive `PagedResponse` fields). The page uses them and states the definition, as-of time, and that test/demo rows are included until marked.
- Evidence: new `TenantDirectoryCountsHttpTests` red before the change, green after. `Tenant`/`SuperAdmin` filtered backend run **382 passed / 0 failed / 0 skipped** with `HEXABILL_TEST_POSTGRES` on disposable cluster 55474 (346 passed + 36 skipped without it, so the PostgreSQL run is the evidence). Frontend build exit 0, lint 0 errors.
- NOT TESTED: the page in a browser (needs a SuperAdmin session on the platform host), other admin metrics (dashboard `tenant/dashboard`, health), a test/demo flag on tenants (no such column; proposed, needs a migration decision).
- Next: OPS-02 true resource metrics, SAFE-01 destructive controls.

### 2026-10-17 — UX-05 owner dashboard Daily Close status (PARTIAL; NOT live)
- Finding: `DashboardTally` already had quick actions (New invoice F3, New purchase F4, Customer ledger F10, Expenses) and the Daily Close backend/page already exist and are admin-only. Missing: Daily Close status on the dashboard. No backend duplicated.
- Change: `DailyCloseStatusCard` (owner/admin only) reads the existing `GET /api/daily-close/status` for today and shows Not closed yet / Draft saved / Reopened (with reason) / Closed (matching, or variance with or without a recorded reason) / unavailable on a failed load; it never claims Closed unless the server row is Closed. The button opens the existing Daily close page; closing, variance review and reopening rules are untouched. Mapping lives in `dailyCloseStatus.js`.
- Evidence: `tests/dailyCloseStatus.test.js` 6/6; `npm test` all pass; build exit 0; lint 0 errors. Browser `e2e/dashboard-daily-close.spec.js` **5/5 at m360, m390, t768, d1024, d1440** (card text agrees with the API status for today, button >=44px below 1024px, no horizontal overflow, navigates to /daily-close).
- Observation for UX-03: design-system buttons render ~38.5px tall at 1024px and wider even with `min-h-11`; tablet landscape (1024/1180) touch targets are therefore below 44px. Not changed here.
- NOT TESTED: Closed/Draft/Reopened card states in a browser (only the synthetic tenant's real state was asserted), branch-scoped status, staff view (card hidden by role in code, not browser-tested), a "Receive payment" quick action (not added).
- Next: UX-03 tablet shell (touch-target size at 1024/1180, orientation), RouteDetailPage phone layout.

### 2026-10-17 — UX-02 phone card lists for price list and document lists (PARTIAL; NOT live)
- Defect (S183/S184, S200, S203, S210): wide tables inside a sideways scroller hide product/customer identity while actions stay visible. Fixed for four lists: `PriceList.jsx`, `QuotationsPage.jsx`, `DeliveryNotesPage.jsx`, `SalaryCertificatesPage.jsx`. Below `md` each row is a card (identity, date/status, 44px actions with accessible names); from `md` the existing table is unchanged.
- Evidence: `e2e/pricelist-responsive.spec.js` 5/5 (m360, m390, t768, d1024, d1440); `e2e/document-lists-responsive.spec.js` 16/16 (m360, m390, t768, d1440) including a seeded quotation with a very long customer name and all five action buttons within the screen and >=44px. **Quotations red on the previous page, green on the fix.** `npm test` 204/204, build exit 0, lint 0 errors.
- NOT TESTED: delivery-note and salary-certificate card path with real rows (synthetic tenant has none; only the no-overflow check ran), route sales table (S189, `RouteDetailPage.jsx` still has 5 tables and no phone cards), price-list save from the phone card against the API, tablet column priorities, other wide tables (reports).
- Next: RouteDetailPage phone layout, then UX-03/UX-06 tablet shell.

### 2026-10-17 — UX-04 purchase entry mode and fixed footer spacing (PASS locally in browser; NOT live)
- Defects: (a) with the voucher open, filters, status chips, "Purchase List" and the "This period" analytics block still rendered under it; (b) `Layout.jsx` set `--hb-bottom-nav-h` from the route only, so when the bottom nav was hidden (inline voucher, modal, software keyboard) the fixed Save bar floated 4.75rem above the screen bottom.
- Fix: `PurchasesPage.jsx` renders history/analytics only when `!showForm`; Cancel/Save return to history. `Layout.jsx` uses `bottomNavVisible` for the variable (also benefits POS bars that use it).
- Evidence: `e2e/purchases-entry-mode.spec.js` **5/5 at m360, m390, t768, d1024, d1440**; footer check **red without the Layout change (gap 76px, expected <=2), green with it**. Create->persist->edit->delete through the UI re-run (temporary copy, removed) passed at m360, t768, d1440. Lint 0 errors, build exit 0.
- NOT TESTED: real software keyboard, orientation change, 820/1180 widths, other pages using the same variable (POS), print.
- Next: UX-02 responsive tables and identity columns, then UX-03/UX-06 tablet shell.

### 2026-10-17 — REL-03 branding request dedupe and SEC-02 storage cache policy (PASS locally; NOT live)
- Branding root cause (code-confirmed): `BrandingProvider.loadBranding` (two requests: `/settings/logo-data-uri` + `/settings`) ran on mount, on every `location.pathname` change and every tab visibility change, with no in-flight dedupe, no platform-host exclusion, and it flipped `loading` each time.
- Fix: `tenant/brandingLoadGate.js` (platform host without impersonation never loads; passive triggers skip while in flight or under 60s; logo upload, impersonation and manual refresh are forced); `loading` only on first load. Failed loads also wait out the interval.
- SEC-02 root cause: `StorageController` sent `Cache-Control: public, max-age=86400` for any tenant file. Fix: generic `/api/storage/{*key}` is `private, no-store` for non-logo keys, `private, max-age=86400` for logos, `nosniff` on both routes; anonymous host-matched logo route keeps its documented public brand-logo behaviour. Tenant check unchanged (other tenant 403).
- Correction to an earlier note: anonymous logo reads are allowed when the request host resolves to the same tenant; denials (and the SECURITY log lines) come from hosts that do not resolve to it (for example the platform host with no token).
- Evidence: `tests/brandingLoadGate.test.js` 4/4; `npm test` 204/204, 0 skipped; build exit 0; ESLint 0 errors. Backend `StorageCachePolicyHttpTests` (private doc not public/no-store, other tenant 403, logo cacheable) red 1 failed before the fix, then **8/8 with `GetTenantLogo*`, including the PostgreSQL variant, 0 skipped** (`HEXABILL_TEST_POSTGRES` on disposable cluster 55474). Browser `e2e/branding-request-dedupe.spec.js` 2/2 (m360, d1440); **red on previous context (6 requests vs 4), green on fix**.
- NOT TESTED: active R2 configuration, authenticated retrieval and restart persistence on Render (needs read-only infra access to confirm `Storage` provider env), platform-host browser run, tenant PDF identity after a logo change, 5-client logo inventory.
- Next: UX-04 purchase entry vs history split and footer spacing.

### 2026-10-17 — VAT-01 passive refetch and content replacement (PASS locally in browser; production cause NOT proven)
- Code-confirmed: `focus`, `visibilitychange` and `dataUpdated` each called `fetchVatReturn`, which set `loading=true`, and the render swapped the whole report for `LoadingCard`. No scroll listener exists (unchanged finding). A focus/visibility burst (for example touch or devtools) therefore flashed the report and could move the scroll position.
- Fix: passive triggers call `fetchVatReturn(..., { background: true })`, gated by `utils/vatRefreshGate.js` (skip while a request is in flight or the same period loaded under 30s ago). Background failures keep the last figures and show a status note. Foreground loads keep existing content with an "Updating VAT figures for <period>…" line; the loading card shows only when there is nothing to show. Request-id guard for stale responses unchanged.
- Evidence: `tests/vatRefreshGate.test.js` 5/5; `npm test` 200/200, 0 skipped; build exit 0; ESLint 0 errors. Browser spec `e2e/vat-refresh-stability.spec.js` (scroll plus focus/visibility events, request count, DOM node survives, no loading card) **3/3 at m360, t768, d1440** on disposable PG; **red on the previous page (extra request: expected 2, got 3), green on the fix**.
- Observed, not fixed: the initial page load issues 2 VAT GETs (mount effect plus URL-sync). Quarter helpers vs tenant tax schedules not reconciled (still open). NOT TESTED: other widths, real mobile Safari focus behaviour, deployed build, scroll position after a foreground period change.
- Next: UX-04 purchase entry vs history split and footer spacing.

### 2026-10-17 — UX-01 purchase product picker (PASS locally on synthetic PostgreSQL + browser; NOT live)
- Root cause (code-confirmed, reproduced by inspection): the results list was `absolute z-10` but the `relative` wrapper contained only the input, so the list anchored to a distant ancestor and sat under the item-table headers; rows used `onClick`, which a touch blur could swallow.
- Fix: new `features/purchases/ProductPicker.jsx` (ARIA combobox/listbox) keeps input and list in one relative wrapper (`top-full`, `z-40`, `overscroll-contain`, 44px rows), selects on `pointerdown`, closes on outside press/Escape, ArrowUp/Down/Home/End/Enter via `utils/pickerNav.js`. Not solved by z-index alone.
- Evidence: `tests/pickerNav.test.js` 3/3; `npm test` all pass; ESLint 0 errors; build exit 0. Browser (guarded runner, disposable PG 55474, synthetic tenant `gulfharvest-test`) `e2e/purchases-picker.spec.js` (anchor geometry, topmost-element check, keyboard, touch tap) **15/15 at m360, m390, t768, d1024, d1440**. Existing create->edit->delete purchase flow through the new picker passed at m360, t768, d1440 (temporary copy of `purchases-crud.spec.js` pointed at the synthetic slug, with a supplier seeded; copy removed). Its "pay supplier" test fails on a missing unpaid-purchase fixture, unrelated.
- Test-infra notes: `purchases-crud.spec.js` hard-codes slug `gulfharvest`; failed logins there trip the 15-minute lockout (429). New spec reads `HEXABILL_E2E_SLUG`. The runner's `-Projects` needs an array.
- NOT TESTED: real software keyboard, orientation change, S278/S279 original screenshots on production, 820/1180 widths.
- Next: UX-04 separate purchase entry from history/analytics and fix fixed footer/bottom-nav spacing.

### 2026-10-17 — REL-01 purchase route error recovery (PARTIAL: draft safety PASS locally; S037 cause NOT reproduced)
- S037 cause (render exception vs chunk vs network) is unproven; no runtime evidence. Submit path already has 409 duplicate and lost-response lookup (existing code), so no new retry logic added.
- Change: unsaved new purchase is kept in per-tenant `sessionStorage` (`utils/purchaseDraft.js`), restored after a crash/reload, cleared on save or Cancel; storage failure never throws. `ErrorBoundary` (contained routes) gets "Try again without reloading" for non-chunk render errors.
- Evidence: `tests/purchaseDraft.test.js` 4/4; `npm test` 192/192, 0 skipped; build exit 0; ESLint 0 errors. NOT TESTED: browser crash-restore flow, deployed behaviour.
- Next: UX-01 purchase product picker (S278/S279).

### 2026-10-17 — Audit kit: SAVE-01 status and REL-02 staff activity route (PASS locally; NOT live)
- Source: branch `main`, HEAD `b71ec0c` at start; untracked `HexaBill_Audit_Execution_Kit/` and `hexabill_al_uiuimages/` left uncommitted. Deployed Render/Vercel versions NOT re-verified this session.
- SAVE-01: no new live reproduction (needs owner credentials and approval for a marked test write). Local reproduction, root causes and fixes are in the two 2026-10-17 create-path entries below and `docs/qa/HEXABILL-PRODUCTION-SAVE-INCIDENT.md`. Live status: BLOCKED (deploy and live product/customer test not authorized).
- REL-02 root cause (code-confirmed): `adminAPI.getUserActivity` called `/users/{id}/activity`; no such route in `UsersController`. The endpoint is `AdminController` `GET /api/admin/users/{id}/activity` (`AdminOrOwner`, tenant-checked). Any failure was also swallowed into "No activity recorded".
- Fix: `services/index.js` route; new `src/utils/userActivity.js` returns ok vs error; `UsersPage.jsx` shows an error alert for a failed load and the empty text only for a successful empty list.
- Evidence: `node --test tests/userActivity.test.js` 4/4; `npm test` 188/188, 0 skipped; `npm run build` exit 0; ESLint 0 errors. Backend `UserActivityHttpIsolationTests` 3/3 (own tenant 200, other tenant 404, legacy `/api/users/{id}/activity` 404) on the SQLite HTTP factory. NOT TESTED: browser run, deployed routing, PostgreSQL variant.
- Next: REL-01 purchase route error, then UX-01 purchase picker.

### 2026-10-17 — Create-path fixes round 2: auto-fill 500, customer OwnerId, barcode index, customer form limits (PASS locally; NOT live)
- Publication state (verified with `git ls-remote origin refs/heads/main`): `origin/main` = `10c9f52`, which is the first round of this session. The push tool reported a denial, but the remote was updated ("update by push" in the reflog). This round is local commit `543e557`, not pushed. The schema note on the remote holds row counts and row IDs from production; owner to decide whether to keep it on `main`.
- Barcode auto-fill 500 root cause: the method opened a user transaction. Production enables Npgsql `EnableRetryOnFailure`, which rejects that (reproduced with the production policy). Fixed by running the unit of work inside `CreateExecutionStrategy()`. Test: `ProductAutoFillBarcodePostgreSqlTests` (2), red then green.
- Customer create: `OwnerId` was not set (0 on 56 live rows). Fixed for new rows. Test: `CustomerCreateOwnerIdPostgreSqlTests` (1), red without the fix, green with it.
- Barcode index drift: `IX_Products_TenantId_Barcode` declared in `AppDbContext`. Migration `20261017120000_DeclareProductBarcodeUniqueIndex` (idempotent `Up`). Snapshot gets the index line and the `TenantId` index ordering fix. The EF snapshot is SQLite-typed with unrelated drift, so `dotnet ef migrations add` output was discarded.
- Customer form: max-length and credit-limit rules now match the DB and DTO. Files: `CustomersPage.jsx` (add and edit).
- Evidence: full backend 839/839 on local PG 18 (`127.0.0.1:55490`, EnsureCreated), 0 skipped. Frontend `npm test` 184/184; `npm run build` exit 0; ESLint 0 errors.
- Logo `SECURITY` errors: anonymous `GET /api/storage/tenants/{id}/logos/...` is denied by design and logged each time. Making logos public or silencing the log is a security decision for the owner. Not changed.
- Live: no live writes, no migrations applied, no deploy, no backfill. Needs approval: deploy (backend and frontend), applying migration `20261017120000`, backfill of 56 `Customers.OwnerId` rows, live product create test.
- STOP HERE — do not begin next phase automatically.

### 2026-10-17 — Product barcode conflict fix and create field matrix (PASS locally; NOT live; on origin/main as `10c9f52`)
- Root cause: `ProductService.CreateProductAsync` checked barcodes against active rows only. The live unique index `IX_Products_TenantId_Barcode` covers deactivated rows too, so an insert failed with a raw unique violation. `ProductsController` reported that as "SKU already exists". Live has 14 deactivated products with barcodes. The index is in live and in the 2026-10-11 recovery dump, but in no EF migration or model.
- Fix: barcode checks now include deactivated rows, with a message that names the product. The controller names the barcode constraint when it fires. Files: `backend/HexaBill.Api/Modules/Products/ProductService.cs`, `backend/HexaBill.Api/Modules/Products/ProductsController.cs`.
- Evidence: new `tests/HexaBill.Tests/tenancy/ProductBarcodeConflictPostgreSqlTests.cs`. Before the fix, 2 failed with `DbUpdateException` and the active-holder control passed. After the fix, 3/3 passed. Full backend on a disposable local PostgreSQL 18 cluster (`127.0.0.1:55490`, EnsureCreated, not a migration rehearsal): 836 passed, 0 failed, 0 skipped. Frontend `npm test` 184/184.
- Docs: `docs/database/PRODUCT-CUSTOMER-CREATE-FIELDS-2026-10-17.md` (field matrix across DB, DTO, service and client, with the root-cause table). `docs/database/LIVE-SCHEMA-2026-10-17.md` regenerated with no tenant names, a NOT NULL list, and drift items 6–7.
- Live: no live writes, no migrations, no deploy. `autoDeploy` is `no` on the Render service, so the barcode fix needs an approved backend deploy.
- Open: decision on declaring `IX_Products_TenantId_Barcode` in the model; `Customers.OwnerId` = 0 on 56 rows (backfill needs approval); migration rehearsal on a database with live history; live product create test needs approval.
- STOP HERE — do not begin next phase automatically.

### 2026-10-17 — Live save-failure verification and schema snapshot (read-only; live product create NOT TESTED)
- Source: local `main` = `origin/main` = `84c9e1f`. Render live deploy `dep-db9iamvavr4c73e6gpvg` = `84c9e1f` (finished 07:38:04Z). `/health/ready` Ready / Connected / Current. Render `autoDeploy` is `no` on the service; `render.yaml` still says `checksPass`, which does not match the live setting.
- Live DB, read-only: 55 history rows, 54 migration files, none pending. Orphan history row `20260215070856_AddBranchIdToExpense` documented, not edited. Return-number indexes are per tenant; duplicate pairs 0 in `SaleReturns`, `PurchaseReturns`, `Products.Sku`.
- Live frontend bundle `index-C7xkt4XT.js` serves the `(Ref:` toast format. Tests: `node --test tests/apiError.test.js` 3/3; `npm test` 184/184, 0 skipped.
- Post-deploy: customer 126 (tenant 22) created 07:45:57Z; ErrorLogs since deploy 0. No live product write was made. Barcode auto-fill 500 (2026-10-13) unexplained; logo requests without a token logged as SECURITY errors.
- Artifacts: `docs/database/LIVE-SCHEMA-2026-10-17.md` (67 tables, 871 columns, 22,679 rows; no credentials), `docs/qa/HEXABILL-PRODUCTION-SAVE-INCIDENT.md` updated.
- NOT done: no live test writes, no migrations (none pending), no deploy triggered, no password rotation.
- Next: owner approval for one marked product and customer test write in tenant 22, then soft-delete; rotate the database password that was pasted into chat.
- STOP HERE — do not begin next phase automatically.

### 2026-10-17 — P0-FIN-RETURN-05: branch/route parity (PASS locally; committed on branch `codex/return-branch-route-parity-2`; push to main pending owner approval)
- Repo state found mid-task: HEAD `d188fc2` on `main` (committed 11:27 by another writer, parent `adeb0cf`, reimplements return reconciliation). Commit `2ec0691` (tracker note) landed on the return chain during the session. My changes are uncommitted in the working tree; backup patch and new files are in the session scratchpad `route-parity-backup/`. No branch, reset or push was performed after this was noticed; one `git stash` of two of my files was popped and verified.
- Defects reproduced on PostgreSQL through the real `ReturnService.CreateSaleReturnAsync` path (15.75 invoice, 5.00 cash receipt, branch + route): (a) new returns stored `RouteId = null` (hard-coded in `ReturnService`), so route returns were always 0; (b) branch and route return sums included pending, rejected and reversed returns; (c) route payment sums included refund payments (`SaleReturnId`) and VOID payments, branch included VOID; (d) branch route rows hard-coded returns to 0; (e) route sales sum had no explicit tenant predicate (the global tenant filter already protects it; guard test passes).
- Found outside the slice: `SaleReturns.ReturnNo` has a GLOBAL unique index (`InitialPostgreSQL`, `AddBranchAndRoute`) while numbers are per tenant per day (`RET-yyyyMMdd-NNNN`). A second tenant's first return on the same day fails with 23505. Local fix: migration `20261017100000_ScopeSaleReturnNumberToTenant` (drop `IX_SaleReturns_ReturnNo`, unique `(TenantId, ReturnNo)`), with model and snapshot updated. NOT applied to any database; a production migration needs explicit approval. `PurchaseReturns` has the same global index and is NOT changed (open).
- Changed: `ReturnService.cs`, `BranchService.cs`, `RouteService.cs`, `AppDbContext.cs`, `AppDbContextModelSnapshot.cs`, new migration, new test `tests/HexaBill.Tests/billing/BranchRouteReturnParityPostgreSqlTests.cs` (8 tests).
- Evidence: parity class with the summary fixes temporarily reverted -> **6 failed / 2 passed / 0 skipped** (`route-parity-summary-red.trx`). Earlier red before the index fix -> 7 failed, partly from the index collision (`route-parity-red.trx`). Fresh PostgreSQL DB `hexabill_route_parity_20261017` on loopback 55474: parity class **8/8 PASS**; targeted (parity, ReturnBalancePostgreSql, Branches/Routes HTTP isolation, ReturnStock) **58 passed / 0 failed / 0 skipped**; full backend suite **829 passed / 0 failed / 0 skipped** (821 + 8). TRX files are in `%TEMP%\hexabill-return-results-20261017`.
- NOT TESTED: frontend and browser (no UI changed); migration applied to a PostgreSQL database with existing history (tests use EnsureCreated only); P&L/COGS for returned goods (branch and route profit still do not reverse COGS on returns, open); `RouteService.GetRouteByIdAsync` total/profit ignore returns (open); `PurchaseReturns` index (open).
- Publication: NOT pushed by this session. The owner asked for a push to `main`, but the auto-mode classifier denied that step as a production deploy. `render.yaml` sets `autoDeployTrigger: checksPass`, so a push to `main` would auto-deploy the backend to live. Remote `origin/main` is `d188fc2`, pushed by another writer. Production runtime SHA, migration history and logs NOT verified this session.
- Next: owner approval to fast-forward `main` from `codex/return-branch-route-parity-2`, then verify the Render and Vercel deploys that push triggers; decide approval for the composite-index migration; then `PurchaseReturns` index, returned-goods COGS and route detail parity.

### 2026-10-17 — Main publication authorized
- User explicitly requested pushing all latest code to `main`. This supersedes the earlier local-only publication restriction for these completed checkpoints; it does not authorize production database changes or a manual deployment.
- Preflight: clean `codex/return-balance-reconciliation` at `2fc68cec523bf561fb40b575543a5f25452f204b`; fresh `git fetch origin` confirmed `origin/main=adeb0cfbd29de907c116cea47133675c8c9f7ece`, four commits ahead / zero behind. All four RETURN-01..04 checkpoints are included. No unrelated branch history is merged.
- Re-read actual final backend TRX: 821 executed / 821 passed / 0 failed / 0 not-executed. Existing frontend/browser/build evidence remains above; unchanged product code was not retested solely for publication. Diff whitespace check passes; heuristic scan of 398 added lines found zero known secret-format candidates (not a comprehensive secret audit).
- Initial publication sequence fast-forwarded local `main`; CLI push then waited for Git Credential Manager authentication (`gh auth status` is signed out). That owned push was canceled before any remote update. The connected GitHub account `ANANDU-2000` is authenticated, so publication uses that connection: upload the exact committed blobs, verify reconstructed tree SHA equals the tested local tree, create a snapshot commit on the freshly verified remote base, then update main with an expected-head guard and no force. Preserve all local checkpoint commits on the source branch; align local main with the published commit after verification. Final publication result is reported in chat; do not infer deployed runtime or CI success from this note. Finance gate remains IN_PROGRESS; next task remains RETURN-05 branch/route parity.

### 2026-10-17 — P0-FIN-RETURN-04: dashboard/overdue/worksheet (PASS locally; finance gate still IN_PROGRESS)
- Checkpoint parent `03b47dd`; branch `codex/return-balance-reconciliation`. New PostgreSQL summary/worksheet theory reproduces full/partial approved-return stale pending amount: initial compile property typo corrected to actual `PendingBills`, then red execution **2 failed / 3 passed / 0 skipped**, exit 1, `summary-return-red.trx`. Fixture also moves invoice 40 days earlier to exercise overdue amounts/counts, and asserts pending list membership, worksheet pending and actual cash received across approved/pending/rejected/reversed returns.
- Fix: dashboard pending count/amount/list and overdue count/amount deduct the shared approved tenant returns in SQL. Worksheet already delegates pending to summary, so no duplicate worksheet fix. Historical invoice/payment rows, paid amount, paid-bill classification, tax/posting/auth models unchanged. Existing unrelated branch/date-filter semantics have not been certified.
- Targeted command: same RETURN-03 filtered command with `--logger 'trx;LogFileName=summary-return-green.trx'` -> exit 0, **47 passed / 0 failed / 0 skipped**. Real API/browser spec now captures summary baseline; after full return it proves pending count/amount and net sales unchanged, cash collections +5, worksheet pending equals dashboard, plus existing customer -5/pending 0/aging 0/DB/stock/reload/CSV/isolation assertions. Rebuilt current synthetic host (exit 0); guarded runner as RETURN-03 at m360,d1440 -> exit 0, **2 passed / 0 failed / 0 skipped** (35.7s).
- Full final backend: RETURN-03 full command with `--logger 'trx;LogFileName=summary-return-full.trx'` and same loopback disposable PostgreSQL connection -> exit 0, **821 passed / 0 failed / 0 skipped**, duration 1m13s. Frontend runtime unchanged since RETURN-02: 182 unit tests/build/changed-file lint evidence there; only browser regression assertions extended here. Manual changed-query review and `git diff --check` pass. No independent reviewer/agent used.
- NOT TESTED for this scenario: branch/route parity, detailed cash close/tender reports, P&L/COGS, VAT return/export, ledger/worksheet PDF, invoice original credit-method/status display, production runtime SHA/history/logs/authenticated QA. No production writes, migration, deploy, push, live sample cleanup or paid API calls.
- Resume state: branch above; last checkpoint before this entry `03b47dd`; current verified task RETURN-04, checkpoint commit is the commit containing this entry. Next task **P0-FIN-RETURN-05**: inspect BranchService/RouteService receivables/profit queries, reproduce the same synthetic 15.75/5/full-return flow bound to one branch/route, then add a failing PostgreSQL parity test before fixing. Later false-save/idempotency tasks and all later milestones remain gated by P0.
- Local artifacts retained: `%TEMP%\hexabill-return-results-20261017` red/green/full TRX; disposable PG `%TEMP%\hexabill-return-pg-20261017`, loopback 55474, integration DB `hexabill_return_20261017` (user `hexabill_return_qa`) and browser DB `hexabill_codex_browser_return_20261017` (user `hexabill_qa`). Owned test API/Vite stopped by runner; owned PostgreSQL stopped at handoff after tests. To resume, inspect Git/tracker and PG status, start this exact retained cluster on loopback 55474, rebuild synthetic host when backend changes; no delete/reseed of production or historical QA rows.

### 2026-10-17 — P0-FIN-RETURN-03: pending invoices (PASS locally)
- Checkpoint parent `05900f8`; same branch. Added five PostgreSQL pending-report cases using the same 15.75 invoice/5.00 receipt/full-or-partial return fixture, including unapproved/reversed statuses and forged foreign-tenant return. Initial `--filter FullyQualifiedName~PendingBills_NetsApprovedReturnsBeforePagination` -> exit 1, **2 failed / 3 passed / 0 skipped**, `pending-return-red.trx`.
- Fix: `ReportService.GetPendingBillsAsync` uses the shared tenant/approved-return query and deducts returns in SQL before filtering, counting and pagination; projects the net outstanding amount while preserving original invoice and payment amounts. No schema, posting, stock, audit or auth changes.
- Targeted: `dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --filter 'FullyQualifiedName~ReturnBalancePostgreSqlTests|FullyQualifiedName~ReportsHttpIsolationTests|FullyQualifiedName~ReportAvailabilityContractTests|FullyQualifiedName~SaleCostBasisTests' --configuration Release --no-restore --nologo --verbosity quiet -p:WarningLevel=0 --logger 'trx;LogFileName=pending-return-green.trx' --results-directory "$env:TEMP\hexabill-return-results-20261017"` with RETURN-01 loopback connection -> exit 0, **42 passed / 0 failed / 0 skipped**.
- Extended the existing browser scenario with pending-list empty/count 0 and aging 0 API assertions, retaining DB/read-back/UI/CSV/tenant negatives. Built synthetic browser host against current source (exit 0), then same guarded RETURN-02 runner with `-Projects m360,d1440` -> exit 0, **2 passed / 0 failed / 0 skipped**. The earlier all-five-width UI gate remains recorded in RETURN-02; this backend-only delta retested two widths.
- Full current backend suite: `dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --configuration Release --no-build --no-restore --nologo --verbosity quiet --logger 'trx;LogFileName=return-balance-full.trx' --results-directory "$env:TEMP\hexabill-return-results-20261017"` with the same disposable PostgreSQL -> exit 0, **816 passed / 0 failed / 0 skipped**, duration 1m9s. No skips relabeled as passes. TRX retained locally; no production data included.
- Manual diff/whitespace review completed. Remaining finance gate NOT TESTED/unfinished: dashboard pending/overdue amounts, worksheet, branch/route, collections/cash/P&L/VAT/PDF parity for this scenario, invoice payment-method display. No production writes/push/deploy, no paid provider use.
- Resume: branch above; checkpoint parent `05900f8`, task P0-FIN-RETURN-04 = dashboard/worksheet. Exact next action: add summary PendingBillsAmount/Count and worksheet PendingAmount regression using the same PostgreSQL return fixture, then replace the raw `GrandTotal - PaidAmount` summary queries with the approved-return source. P0 gate remains IN_PROGRESS; later milestones remain gated.

### 2026-10-17 — P0-FIN-RETURN-02: ledger credit, return column and real API flow (PASS locally)
- Checkpoint parent `52439b6`; same branch. Real synthetic API round-trip: create credit customer/product, finalize 15.75 sale, post idempotent 5.00 cash payment, approve full 15.75 resellable return with CreditIssued, refetch customer, query PostgreSQL directly. Balance -5, invoice GrandTotal 15.75/PaidAmount 5 unchanged, exactly one return, stock restored to its pre-sale value. Product create ignores initial stock; the initial fixture assertion expected 2 incorrectly and was corrected to compare with the actual created product stock before UI reproduction.
- UI red evidence: d1440 run exit 1, summary showed `Balance 0.00 AED` while DB/API showed -5; Unpaid already 0 after RETURN-01. UI fix preserves signed balance, adds separate Returns column to table/subtotals/totals/CSV, labels mobile returned goods, leaves Paid blank for returns, fixes previous-customer subtotal balance, and names mobile Excel button accessibly. No persisted financial changes.
- Reused guarded `run-customer-save-qa.ps1` with optional synthetic database/test port; loopback and database-prefix safeguards remain. New spec `e2e/return-balance-contract.spec.js` runs real API + PostgreSQL + Edge/Playwright and refetch/reload, CSV amount classification, mobile Returns label, non-member invoice 404 and forged tenant header 403. Negative test initially expected 404 for the forged header; observed established 403 denial, then split checks for both documented behaviors. No authorization rule changed.
- Final command: `& .\scripts\run-customer-save-qa.ps1 -Database hexabill_codex_browser_return_20261017 -PostgresPort 55474 -ResumeFixtures -Spec e2e/return-balance-contract.spec.js -Projects m360,m390,t768,d1024,d1440` -> exit 0, **5 passed / 0 failed / 0 skipped** (37.8s), 360/390/768/1024/1440. Earlier UI-only five-width run also passed; final run adds CSV and tenant negatives. Fixtures retained in disposable PostgreSQL only; runtime synthetic secrets generated and cleared by runner; no test traces.
- `npm.cmd test` -> exit 0, **182 passed / 0 failed / 0 skipped**. `npm.cmd run build` -> exit 0; existing bundle/dynamic-import/browser-data warnings. `npx.cmd eslint src/features/sales/SalesLedgerPage.jsx e2e/return-balance-contract.spec.js` -> exit 0, 0 errors / 7 existing warnings. Reviewed diff manually. Preserve this JSX file's existing committed CRLF with per-command `git -c core.autocrlf=false`; whitespace check uses `core.whitespace=cr-at-eol`, avoiding unrelated file normalization.
- NOT TESTED: PDF ledger return-column parity; pending report/dashboard/worksheet/branch/route/collections/cash/P&L/VAT/export parity for this scenario; full backend suite; production authenticated flows/version/migration/logs. Finance milestone remains IN_PROGRESS; no next milestone started, no production writes/deploy/push, no provider calls or paid services.
- Resume: branch above; last verified backend commit `52439b6`, this UI checkpoint follows it. Next exact task P0-FIN-RETURN-03: add failing PostgreSQL cases for `GetPendingBillsAsync` full/partial/nonapproved returns, fix with shared approved-return calculation, then dashboard/worksheet. Current raw predicate still `GrandTotal - PaidAmount` in those consumers.

### 2026-10-17 — P0-FIN-RETURN-01: approved-return invoice debt (PASS, backend slice only)
- Read attached goal objective and `pasted-text-1.txt`; `CLAUDE.md`, `AGENTS.md`, master goal current P0 section and tracker. `docs/plan/HEXABILL_LINEAR_EXECUTION.md` is absent; no replacement plan invented. Referenced chat read attempted using `read_thread`, but service returned `thread/items/list is not supported yet`; its contents were not relied upon. No authenticated Linear tool is configured; exposed token never read or used.
- Source: clean `main` at `adeb0cf`; created `codex/return-balance-reconciliation`. No push, deployment, production migration or live test transactions. Public read-only Gulf Harvest maintenance 200/false; anonymous auth validation 401. Runtime SHA, migration history and infra logs NOT TESTED (no authenticated infrastructure read in this checkpoint).
- Root cause: aging and sales-ledger pending used invoice total minus paid, omitting returns. Ledger return rows also included unapproved/reversed returns and classified their amount as cash received.
- Fix: shared `InvoiceReceivables` approved/tenant query and nonnegative invoice-debt calculation; aging and sales ledger deduct approved returns without changing persisted GrandTotal/PaidAmount/payment/audit history. Ledger return projections avoid missing legacy branch/route columns, exclude nonapproved returns, and show zero cash received. Customer balance stays signed: invoice 15.75 - cleared 5 - approved return 15.75 = -5 credit, invoice outstanding 0.
- Regression on newly initialized PostgreSQL 18 loopback cluster 55474, dedicated `hexabill_return_20261017`: `ReturnBalancePostgreSqlTests` first **7 failed / 3 passed / 0 skipped**, exit 1. Full/partial returns, pending/rejected/reversed returns and a forged cross-tenant return reference covered; invoice/receipt preservation asserted. Initial test compile used two nonexistent DTO properties; corrected before the red execution.
- Verified command: `dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --filter 'FullyQualifiedName~ReturnBalancePostgreSqlTests|FullyQualifiedName~SalesLedgerReceiptStateTests|FullyQualifiedName~ReturnsHttpIsolationTests|FullyQualifiedName~ReportsHttpIsolationTests' --configuration Release --no-restore --nologo --verbosity quiet -p:WarningLevel=0 --logger 'trx;LogFileName=return-balance-green.trx' --results-directory "$env:TEMP\hexabill-return-results-20261017"`, with `HEXABILL_TEST_POSTGRES=Host=127.0.0.1;Port=55474;Database=hexabill_return_20261017;Username=hexabill_return_qa` -> exit 0, **21 passed / 0 failed / 0 skipped**. Red/green TRX retained at that directory. Test schema uses EnsureCreated: NOT migration rehearsal.
- Review: inspected changed queries and actual SalesLedgerPage consumers; confirmed UI still clamps negative balance and displays returns in Paid, queued next. No independent reviewer used; no added agent cost. Browser/API create-return round-trip, full suite, exports, branch/route/dashboard/worksheet/collections/cash/P&L/VAT parity NOT TESTED for this scenario; overall P0 gate remains incomplete. No paid inference or customer data sharing.
- Resume: branch above, checkpoint parent `adeb0cf`; task P0-FIN-RETURN-02. Next failing acceptance: UI summary currently computes `Math.max(0, sales - returns - payments)` and return row renders amount in Paid. Add regression using synthetic API/PostgreSQL and verify credit/return columns at mobile/desktop before calling this slice PASS.

### 2026-10-13 - forms fix-it-for-them (PASS locally, not pushed)
- Done: customers (409 rules, phone block, decimal credit), ledger add-customer, owner clear-data damage FK, products SKU/price/conversion repair, suppliers, expenses, purchases (invoice clash 409), payments (amount rounding, messages), one status colour rule, money colour rule on Suppliers, all-pages customer loader. Details in `docs/qa/ERP-BUG-REGISTER.md` and `ERP-TEST-EVIDENCE.md`.
- Evidence: backend 795/795 on PostgreSQL, 0 skipped; frontend unit tests 180/180; browser specs pass at 360 and 1440 px (purchases 360 skipped by design).
- Open: purchase invoice number unique per company (owner decision on a per-supplier migration); clear-data leaves supplier payments, daily closes, quotations; searchable customer picker beyond 2,000; live Gulf Harvest read-only check needs credentials; money colours still hand-picked on Reports, VAT Return, Expenses lists (see docs/uiux/MONEY-COLOUR-ROLLOUT.md).
- Next exact action: owner approval to push; then roll the money colour rule to Customer Ledger amounts and Payments list.
### 2026-10-12 - QA-C02..C04 customer credit/duplicate rules (PASS locally)
- Fixes: credit limit min/step; duplicate name/phone/route rules return 409 not 500; page blocks duplicate phone but keeps email confirmation. Details: `docs/qa/ERP-BUG-REGISTER.md`, `docs/qa/ERP-TEST-EVIDENCE.md`.
- Evidence: browser 12/12 on PostgreSQL; backend 793/793 with PostgreSQL, 0 skipped; frontend 154/154. Production untouched, nothing pushed.
- Next exact action: product create lost-response failure injection, then sales/payment idempotency. Live Gulf Harvest read-only inspection needs supplied credentials.
### 2026-10-12 - QA-C01 customer save (PASS locally)
- Baseline: `main` at `3cd2a208bae0472735cbc1e090f12376c8a71434`; four pre-existing untracked documents preserved. Moved work to `codex/live-erp-qa-20261012`. No production push/deploy/migration/write.
- Reproduction: real API bridge 5078, Vite 5175, fresh loopback PostgreSQL 18 cluster 55472, four synthetic tenants. Duplicate email + unique name/phone + blank credit -> HTTP 400. Existing backend separately forbids duplicate phone (500); that rule was not relaxed.
- Fix: CustomersPage.jsx shares buildCustomerPayload between ordinary create/edit and duplicate-confirmation create.
- `& .\scripts\run-customer-save-qa.ps1 -ResumeFixtures -Projects m360,m390,t768,d1024,d1440` -> exit 0, 5 passed / 0 failed / 0 skipped. HTTP 201, one POST, exactly one tenant-bound PostgreSQL row, reload/API parity, Unicode address, zero credit/null coordinates.
- Backend: `dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --filter 'FullyQualifiedName~CustomersHttpIsolationTests|FullyQualifiedName~ProductPersistenceHttpTests|FullyQualifiedName~HttpIsolationPostgreSqlTests|FullyQualifiedName~CustomerTenantIsolationPostgreSqlTests|FullyQualifiedName~ServiceUnavailableContractTests' --artifacts-path "$env:TEMP\hexabill-qa-artifacts-20261012" --nologo --verbosity quiet -p:WarningLevel=0` with separate fresh loopback DB -> exit 0, 65 passed / 0 failed / 0 skipped. Test schema/EnsureCreated is NOT migration proof.
- Frontend `npm.cmd test` -> exit 0, 154 passed / 0 failed / 0 skipped. Changed-file ESLint -> exit 0, 0 errors, 7 existing warnings. QA specialist startup-503 mocked browser regression -> exit 0, 5 passed / 0 skipped; mocks are not live/backend evidence. Specialist token cost modest; no further delegation.
- Next exact action: reproduce zero-credit customer -> positive-credit edit with absent payment-terms control; smallest UI fix and field persistence test if confirmed. Continue live detail/form audit. No next-milestone or release certification.
- Open: duplicate-phone UI/backend mismatch, product lost-response claim of nothing saved, dependency restore ImageSharp advisories, remaining full finance/tenant/staff/print/PG migration gates.

### 2026-10-10 — Checkpoint 1: UX Phase 1 audit (read-only)
- **Source:** branch `uiux-audit-p1` from `c6ba249`. Changes are docs plus one audit spec; no product code. Nothing committed yet, pending owner review.
- **Environment:** local API on 127.0.0.1:5000 over the throwaway SQLite copy `%TEMP%\hexabill-uitest`. Synthetic expenses were added through the local API. No production access was used for this checkpoint.
- **Commands:** `npx playwright test e2e/ux-audit.spec.js --project=m360 --project=m390 --project=t768 --project=d1440 --workers=1` → **28 passed**.
- **Results:**
  - 25 defects confirmed: 8 P1, 14 P2, 3 P3. One suspected defect was not reproduced (UX-E08, expense list scroll). No P0 UX defect.
  - Not tested: large datasets (only 2 invoices), RTL, a real device keyboard.
- **Next task:** Checkpoint 2, P0-02.

### 2026-10-10 — Checkpoint 3: Expenses UX slice (P1-06, PARTIAL)
- **Source:** branch `uiux-audit-p1`; local Vite on 127.0.0.1:5173 over the local API on 127.0.0.1:5000 (SQLite synthetic copy, tenant `gulfharvest`). No production access.
- **Changed:** `frontend/hexabill-ui/src/features/expenses/ExpensesPage.jsx` (filters collapse below 1024px; totals and Ledger/By category tabs share one row; tablet chips scroll; Route and VAT Period hidden below 1280px; desktop empty state gets Add expense; list error gets "Try again" on all widths with one copy). New spec: `frontend/hexabill-ui/e2e/expenses-states.spec.js`. Tracker: `docs/uiux/PREMIUM-UX-TRACKER.md`.
- **Results (before → after):** first record 360px 411→387 px (51%→48%); 768px 752→498 px (73%→49%); 1440px 566→528 px (63%→59%). The 35% target was **not** met.
- **Commands and results:**
  - `npx playwright test e2e/ux-audit.spec.js -g "audit /expenses" --project=m360 --project=m390 --project=t768 --project=d1440` → 8 passed.
  - `npx playwright test e2e/expenses-states.spec.js --project=m360 --project=t768 --project=d1440` → 6 passed.
  - `npx playwright test e2e/expenses-crud.spec.js --project=m360 --project=t768 --project=d1440` → one clean run 3 passed; reruns failed on HTTP 429 (see open risk). Single-viewport d1440 clean rerun → 1 passed.
  - `npm test` (frontend unit) → 147 pass, 0 fail. ESLint on ExpensesPage: 0 errors, 7 warnings, all pre-existing (none on changed lines).
- **Open risk (not fixed):** the API's global rate limiter is 300 requests/min per IP (`backend/HexaBill.Api/Core/Authorization/SecurityConfiguration.cs:254`, skipped for HTTP integration-test hosts). The Playwright suites exceed it, and in 3 of 4 three-viewport runs the list GET returned 429. This is a test-environment limit, but shared-NAT offices could hit the same limit in production. Owner decision needed on the limit or per-user keying.
- **Not tested:** Arabic/RTL, real phone keyboard, large datasets for the Expenses list, print and export of the changed view.
- **Next task:** finish P1-06 Expenses (UX-E01 target 35%), then Purchases, POS and the other modules in the coverage matrix.
- **STOP HERE** — one checkpoint per session; do not begin the next phase automatically.

### 2026-10-10 — Checkpoint 4: Expenses tablet layout (P1-06, UX-E06 PASS)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). No production access.
- **Changed:** `ExpensesPage.jsx` ledger switch moved from `md` to `xl` (table ≥1280px, compact list below). `e2e/expenses-crud.spec.js` row selector threshold 768→1280.
- **Results:** 768px first record 498→392 px (49%→38%). 360px 387 px (48%, unchanged). 1440px 528 px (59%). UX-E01 stays PARTIAL: the 35% target is not met at any width.
- **Commands:** `ux-audit` expenses → 6 passed. `expenses-states` → 6 passed. `npm test` → 147 pass. `expenses-crud` batch (m360, t768, d1440) → 2 passed, 1 failed at d1440 (edit-dialog amount locator timed out). d1440 alone → 1 passed. Failure not isolated, recorded as OPEN.
- **Open risk (carried):** API limit 300 req/min per IP causes 429s in batch runs. See Checkpoint 3.
- **Not tested:** Arabic/RTL, real keyboard, large Expenses datasets, print/export of the changed view.
- **Next task:** UX-E01 phone first-record target (decision needed: keep the period chips for quick switching, or move them into the Filters sheet as the audit proposed), then Purchases.
- **STOP HERE** — one checkpoint per session.

### 2026-10-10 — Checkpoint 5: Purchases list (P1-06, PARTIAL)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). Seeded 12 synthetic purchases and 2 suppliers through the local API (`seed-purchases` script in the local UI-test folder, not committed). No production access.
- **Decision recorded:** UX-E01 phone period chips are kept (recommended option). The 35% target is not reached, and the trade-off is noted in the UX tracker.
- **Changed:** `PurchasesPage.jsx` (filters collapse below 1024px; compact expandable rows below 1280px; status colours; desktop numbers no-wrap and neutral; failed-load error with Try again). New spec: `e2e/purchases-list.spec.js`. `ux-audit.spec.js` now also audits `/purchases` and `/suppliers`.
- **Results (before → after):** 360px first record 823→491 px (103%→61%), row 410→86 px. 768px 593→421 px (58%→41%), row 205→86 px. 1440px row 106→59 px. Target 35% not met on any width.
- **Commands and results:**
  - `npx playwright test e2e/purchases-list.spec.js` at m360, t768 (one batch, 5 passed each), d1440 (3 passed, 2 mobile-only skipped, on a clean run).
  - `npx playwright test e2e/ux-audit.spec.js -g "audit /purchases"` → 3 passed (final).
  - `npm test` → 147 pass, 0 fail. `npx vite build` → exit 0. ESLint on PurchasesPage: 0 errors, 3 warnings (pre-existing).
- **Open risks:** the local per-IP rate limit (300/min) caused 429s on one retry in a batch run (see Checkpoint 3). The desktop purchase rows still have 4 buttons (PU-08). Create, edit, delete, pay and print/export on Purchases are not tested (PU-10). Suppliers only has a baseline measurement.
- **Next task:** PU-08 (desktop row actions) and PU-10 (Purchases create/edit/delete/pay with DB persistence checks), then Suppliers.
- **STOP HERE** — one checkpoint per session.

## Start-of-session template
```
CHECKOUT SHA: <verified>
BRANCH / CLEAN STATUS: <verified>
CURRENT TASK ID: <single task>
WHY P0/P1: <verified symptom>
FILES RELEVANT: <paths>
REPRODUCTION: <command/steps>
SCOPE AND SAFETY: <no live writes>
```

## End-of-session template
```
STATUS: PASS | FAIL | BLOCKED | NOT TESTED
TASK ID:
FILES CHANGED:
ROOT CAUSE:
TEST COMMANDS/RESULTS:
PG/FRONTEND/E2E STATUS:
TENANT SECURITY EVIDENCE:
AI PRIVACY/COST IMPACT:
OPEN RISKS:
GIT STATUS:
NEXT ONE TASK:
STOP HERE — do not begin next phase automatically.
```

### 2026-10-10 — Checkpoint 6: Purchases row actions and desktop workflow (P1-06, PU-08 PASS, PU-10 PARTIAL)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). No production access.
- **Changed:** `PurchasesPage.jsx` (desktop row: Pay supplier when owed + shared `OverflowMenu` for Supplier ledger, Edit purchase, Delete purchase). New spec: `e2e/purchases-crud.spec.js` (desktop 1280px+).
- **Results:** desktop row controls 4→2, row 59→55 px. The CRUD workflow passes at 1440px: create → API total 105.00 → refresh → edit qty 6 → API total 126.00 → refresh → delete via menu and confirm → gone. Pay supplier → supplier payment saved → API net payable reduced by the paid amount.
- **Commands and results:**
  - `npx playwright test e2e/purchases-crud.spec.js --project=d1440` → 2 passed (clean run after cooldown). An earlier run failed on HTTP 429 from the local per-IP limit; the error banner showed correctly.
  - `npx playwright test e2e/purchases-list.spec.js --project=d1440` → 3 passed, 2 mobile-only skipped.
  - `npm test` → 147 pass, 0 fail. `npx vite build` → exit 0. ESLint: 0 errors, 3 warnings (pre-existing).
- **Data changed on the local synthetic DB:** one payment was recorded against the seeded supplier (Al Noor) by the pay test. Balances on the seeded purchases differ from earlier audits.
- **Open:** PU-12 (amount and invoice number in the Pay URL, P2). Mobile create, edit, delete and pay not tested. Print and export not tested. Desktop row text is 10.5 px (UX-S06).
- **Next task:** PU-12 (router state instead of URL), then the mobile purchase form (create, edit, pay), then Suppliers.
- **STOP HERE** — one checkpoint per session.

### 2026-10-10 — Checkpoint 7: Purchases PU-12 (router state) and mobile workflow (PU-10 PARTIAL)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). No production access.
- **Changed:** `PurchasesPage.jsx` (`openPay` passes the amount and reference in router state). `SupplierDetailPage.jsx` (applies router-state payment once, then clears history state; removed the unused `useSearchParams` import). `e2e/purchases-crud.spec.js` is viewport-aware (item form table at 768px+, list table at 1280px+).
- **Results:** PU-12 closed: the Pay URL is `/suppliers/<name>` with no amount or invoice reference. Purchase CRUD and pay pass at 360, 768 and 1440 (2 tests each, 6 total).
- **Commands and results:**
  - `npx playwright test e2e/purchases-crud.spec.js` at m360, t768, d1440, one project per run with cooldowns → 2 passed each.
  - `npx vite build` → exit 0. ESLint on the changed files: 0 errors. The remaining supplier-page warning (a `loadData` hook dependency) was already there before this change.
- **Open:** print and export not tested. VAT toggles, supplier auto-registration and payment allocation to a specific invoice not tested. The mobile form has not been reviewed visually. Desktop row text 10.5 px (UX-S06). The local API limit (300/min) returned 429s in batch runs; the helper polls count against it.
- **Next task:** a visual review of the mobile purchase form and the supplier ledger at 360/768, then Suppliers.
- **STOP HERE** — one checkpoint per session.

### 2026-10-10 — Checkpoint 8: Purchase form review and Suppliers (P1-06; SU-01, SU-02, SU-03, SU-04, PU-13, PU-14 PASS)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). The API was stopped for a backend build and restarted in Development against the same UI-test database. No production access.
- **Changed:**
  - Backend: `SupplierService.cs` and `SuppliersController.cs`. The summary takes an opt-in `includeInactive` flag (default false), and each row reports its real `IsActive`. Test added to `tests/HexaBill.Tests/tenancy/SuppliersHttpIsolationTests.cs`.
  - Frontend: `SuppliersPage.jsx` (full-width search; one "…" menu per card and per desktop row; reload on toggle), `services/index.js`, `PurchasesPage.jsx` and `SupplierDetailPage.jsx` (labels linked; form marked `data-shell-hides-nav`), `useShellChrome.js`.
  - E2E: new `e2e/suppliers-list.spec.js`. `e2e/purchases-list.spec.js` gains a form nav and label test.
- **Found by review:** the inline purchase form ran under the phone bottom nav (PU-13). "Include deactivated" did nothing (SU-01, P1). The toggle helper matched two elements, which exposed the desktop row label duplication (SU-04).
- **Commands and results:**
  - `dotnet test --filter SuppliersHttpIsolationTests` → 7 passed, 0 failed.
  - `npx playwright test e2e/suppliers-list.spec.js` at m360 and d1440 → 2 passed each.
  - `npx playwright test e2e/purchases-list.spec.js` at m360 → 6 passed.
  - `npx playwright test e2e/shell-navigation.spec.js` at m360 → 5 passed.
  - `npx vite build` → exit 0. ESLint on the changed files: 0 errors (pre-existing warnings only).
- **Measured:** Suppliers 360px first record 295 px (37%; target 35% not met, SU-06). Row 136→108 px. 1440px first record 249 px (28%). Row controls 3→2.
- **Not done:** the full backend suite was not run (only the supplier HTTP tests). `dotnet build` could not replace the API binaries while the local API ran (file lock), so the API was stopped for the test run and restarted afterwards. Supplier edit fields, statement export, purchase print and export are still untested.
- **Next task:** SU-05 and SU-06 (Suppliers header and first record), SU-08 (supplier name in the ledger header), then Suppliers edit and statement checks.
- **STOP HERE** — one checkpoint per session.

### 2026-10-11 — Checkpoint 9: Suppliers header, filter row and ledger title (SU-05, SU-06, SU-08 PASS)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). No production access.
- **Changed:** `SuppliersPage.jsx` (helper line placed by breakpoint; phone search row with an icon-only Filters trigger; checkboxes in a panel on phones, inline from md). `SupplierDetailPage.jsx` (ledger title wraps). `e2e/suppliers-list.spec.js` (first-record and search-width checks; the add-and-deactivate test opens Filters on phones).
- **Measured:** 360px first record 295→257 px (37%→32%), controls 5→4, rows 108 px. 1440px first record 249→238 px (28%→26%).
- **Commands and results:**
  - `npx playwright test e2e/suppliers-list.spec.js` at m360 (4 passed), t768 (3 passed, 1 mobile-only skipped), d1440 (3 passed, 1 skipped).
  - `npx playwright test e2e/ux-audit.spec.js -g "audit /suppliers"` at m360 and d1440: measured above.
  - `npx vite build` → exit 0. ESLint on the changed files: 0 errors (pre-existing warnings only).
- **Review:** 360px screenshot checked by eye: one search row with the filter icon, helper line readable, cards with one "…" action, no clipping.
- **Not done:** SU-07 (edit fields, statement export). Ledger tabs (Ledger, Bills, Paid) not exercised.
- **Next task:** Suppliers ledger tabs and supplier edit/statement checks (SU-07), then the next module in the coverage matrix.
- **Continue:** next approved local task, per AGENTS.md CONTINUOUS LOCAL EXECUTION POLICY.

### 2026-10-11 — Checkpoint 10: Daily close phone layout and actions (DC-01, DC-02, DC-03 PASS)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). Local setup: the synthetic tenant's `FeaturesJson` set to `["daily_close"]` in the UI-test DB (see PREMIUM-UX-TRACKER, Daily close). No production access.
- **Changed:** `DailyClosePage.jsx` (page root hides the bottom nav; sticky footer on phones; plain buttons with explicit styles and pending labels). `e2e/daily-close.spec.js` (new). `e2e/ux-audit.spec.js` (adds `/daily-close` to the audit list).
- **Measured:** 360px page height 1,574 px, Submit close at 1,430 px before the change. After: footer in viewport at the bottom of the page with the nav hidden.
- **Commands and results:**
  - `npx playwright test e2e/daily-close.spec.js` → m360 2 passed; t768 1 passed (1 mobile-only skipped); d1440 1 passed (1 skipped).
  - `npx vite build` → exit 0. ESLint on the page: 0 errors.
- **Not done:** Submit close, reopen, Add movement and capital transfers (they would change the synthetic day). Shared `LoadingButton` override problem (DC-04) is open.
- **Next task:** Daily close close-and-reopen fixture (DC-06), then the Payments and Receipts module surface discovery.

### 2026-10-11 — Checkpoint 11: Payments list header and rows (PY-01 to PY-05 PASS; PY-06 NOT TESTED)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). No production access.
- **Changed:** `PaymentsPage.jsx` (one header row on phones; Bulk Payment secondary; row name truncates and amount is nowrap; search card padding on phones; intro 14px on phones; bounded desktop search). `e2e/payments-list.spec.js` (new). `e2e/ux-audit.spec.js` (adds `/payments`).
- **Commands and results:**
  - `npx playwright test e2e/payments-list.spec.js` → m360 2 passed (desktop and tablet skipped by design).
  - `npx vite build` → exit 0. ESLint on the page: 0 errors (pre-existing warnings).
- **Audit limit:** the row measurement needs two or more receipts; the local tenant has one. Row density stays unmeasured until a receipt fixture exists (PY-06).
- **Next task:** Payments create/edit/delete with API read-back and a receipt fixture (PY-06); then the Receipts module surface.

### 2026-10-11 — Checkpoint 12: Payment create, edit and void with API read-back (PY-06 PARTIAL)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). No production access.
- **Changed:** `e2e/payments-crud.spec.js` (new). No application code changed.
- **Results:** create → API persisted (amount, customer) → refresh → edit (amount -10%, reference) → API persisted → refresh → void → API status VOID. Passes at 360, 768 and 1440.
- **Finding:** on-account customer payments are refused by the API unless an outstanding invoice exists. That is the intended rule, and the test selects a customer with a balance.
- **Commands:** `npx playwright test e2e/payments-crud.spec.js` at m360, t768, d1440 → 1 passed each.
- **Not done:** bulk payments, cheques, allocations across invoices, receipts and print, role restriction, row density with two or more receipts.
- **Next task:** Receipts module surface (print and PDF of cleared receipts, batch receipts), then bulk payments.

### 2026-10-11 — Checkpoint 13: Receipts on the Payments page (RC-01, RC-02, RC-03 PASS; RC-04 OPEN decision; RC-06 BLOCKED)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). Local setup: tenant id 5 `FeaturesJson` set to `["daily_close","receipt_snapshots"]` in the UI-test DB. No production access.
- **Changed:**
  - Backend: `PaymentReceiptService.cs` (combined receipt keeps one payment method when all payments share it). `PaymentReceiptTests.cs` (two tests, the first failed before the fix).
  - E2E: `e2e/receipts.spec.js` (new).
- **Commands and results:**
  - `dotnet test --filter PaymentReceiptTests` → 41 passed, 0 failed. Before the fix: 1 failed (the same-method test).
  - `dotnet test --filter Receipt` → 77 passed, 0 failed, 8 skipped (PostgreSQL-only: `HttpIsolationPostgreSqlTests`; BLOCKED, no disposable PostgreSQL).
  - `npx playwright test e2e/receipts.spec.js` → m360 2 passed, t768 2 passed, d1440 2 passed.
- **Open:** RC-04 (tenants without the snapshot flag cannot download a receipt PDF): owner decision. RC-05 not tested (print window, legacy preview, branding, Arabic).
- **Next task:** Bulk payments (Payments page), then the receipt print window and legacy-flag fixture (RC-05).

### 2026-10-11 — Checkpoint 14: Bulk payments (BP-01, BP-02, BP-03 PASS; BP-04 OPEN test data; BP-05 NOT TESTED)
- **Changed:** `PaymentsPage.jsx` (bulk customer check runs before the draft builder). `e2e/bulk-payments.spec.js` (new, three tests).
- **Commands and results:**
  - `npx playwright test e2e/bulk-payments.spec.js` at d1440 (3 passed, earlier amounts), m360 and t768 (6 passed with the small-amount version).
  - `npx vite build` → exit 0.
- **Finding:** the client retries a keyed payment POST once on its own; a pause is visible only if that retry also fails. No duplicates were created.
- **Next task:** reload-during-pause and cheque validation for bulk payments (BP-05), then Daily close close and reopen (DC-06).

### 2026-10-11 — Checkpoint 15: Daily close close and reopen (DC-06 PARTIAL, both paths PASS)
- **Changed:** `e2e/daily-close-close.spec.js` (new, two tests). No application code changed.
- **Commands and results:** `npx playwright test e2e/daily-close-close.spec.js` at m360, t768 (4 passed in total), d1440 (passed).
- **Finding:** a day with cash paid out and no opening cash has negative expected drawer cash (-1,597.50 on 2026-10-10). The close form cannot record a negative count, so the test sets opening cash first. Whether the page should ask for opening cash before showing expected cash is a product question, not changed here.
- **Next task:** Suppliers supplier edit and statement (SU-07), then Receipts print window and legacy flag (RC-05).

### 2026-10-11 — Checkpoint 16: Supplier edit and statement (SU-07 PARTIAL, SU-09 PASS)
- **Changed:** `SuppliersPage.jsx` (edit fields disabled and Save blocked until the saved details load; loading message). `e2e/suppliers-edit-statement.spec.js` (new, three tests).
- **Finding (P1, fixed):** typing in the edit form before its details loaded was lost, because the late load replaced every field (SU-09).
- **Commands and results:** `npx playwright test e2e/suppliers-edit-statement.spec.js` → d1440 3 passed, m360 and t768 6 passed in total. `npx vite build` → exit 0. ESLint on the page: 0 errors.
- **Next task:** Receipt print window and the legacy snapshot case (RC-05), then the Suppliers Bills and Paid tabs and credit limit (rest of SU-07).

### 2026-10-11 — Checkpoint 17: Login form (AU-01 PASS)
- **Changed:** `e2e/auth-login.spec.js` (new). No application code changed.
- **Commands and results:** `npx playwright test e2e/auth-login.spec.js` at d1440 (3 passed), m360 and t768 (6 passed in total).
- **Next task:** Products and Inventory: product create, edit, SKU and stock adjustment with API read-back.

### 2026-10-11 — Checkpoint 18: Products create, edit and deactivate (PR-01, PR-02 PASS; PR-03 NOT TESTED)
- **Changed:** `ProductDetailPage.jsx` (owners and admins: Deactivate and Activate on the detail page, typed confirmation). `e2e/products-crud.spec.js` (new).
- **Commands and results:** `npx playwright test e2e/products-crud.spec.js` at m360, t768, d1440 → 3 passed. `npx vite build` → exit 0. ESLint on the page: 0 errors.
- **Next task:** Product stock adjustment with API read-back and the stock history page (PR-03), then Inventory categories.

### 2026-10-11 — Checkpoint 19: Product stock adjustment and history (SA-01, SA-02 PASS)
- **Changed:** `components/StockAdjustmentModal.jsx` (removed the native `required` on the reason; the app's message shows). `e2e/stock-adjust.spec.js` (new).
- **Commands and results:** `npx playwright test e2e/stock-adjust.spec.js` at d1440 (1 passed), m360 and t768 (2 passed). `npx vite build` → exit 0.
- **Next task:** Product price list and categories (PR-03), then POS checkout with API read-back.

### 2026-10-11 — Checkpoint 20: POS checkout total matches the stored sale (PS-01 PASS; PS-02 NOT TESTED)
- **Changed:** `e2e/pos-checkout.spec.js` (new). No application code changed.
- **Commands and results:** `npx playwright test e2e/pos-checkout.spec.js` at m360, t768 (2 passed), d1440 (1 passed).
- **Next task:** POS stock after sale and duplicate-save protection (PS-02), then credit sale and payment.

### 2026-10-11 — Checkpoint 21: POS stock and double-save protection (PS-02 PASS)
- **Changed:** `e2e/pos-stock-duplicate.spec.js` (new). No application code changed.
- **Commands and results:** `npx playwright test e2e/pos-stock-duplicate.spec.js` at d1440 (2 passed), m360 and t768 (4 passed).
- **Next task:** POS credit sale and payment (PS-03), then Billing History after a POS sale.

### 2026-10-11 — Checkpoint 22: Staff accounts (ST-03 PASS; ST-01 BLOCKED on a security decision)
- **Changed:** `e2e/staff-users.spec.js` (new, two tests). No application code changed.
- **Commands and results:** `npx playwright test e2e/staff-users.spec.js` at m360, t768, d1440 → 6 passed. Failed runs left test staff behind and hit the plan's staff cap; the spec now removes its own leftovers first.
- **Decision needed (BLOCKED):** how a disabled staff account behaves (revoke existing sessions now, or refuse only new logins), and who can disable whom. Blocks ST-01. Not implemented without that decision.
- **Next task:** Settings (company profile and branding) with save and reload checks, then Reports and VAT read checks.

### 2026-10-11 — Checkpoint 23: Settings company profile (SE-01 P1 fixed, SE-02 PASS)
- **Changed:** `SettingsPage.jsx` (header Save Changes connected to the settings form). `e2e/settings-company.spec.js` (new, two tests).
- **Commands and results:** `npx playwright test e2e/settings-company.spec.js` at d1440 (2 passed), m360 and t768 (4 passed). `npx vite build` → exit 0.
- **Next task:** printed invoice header uses the saved company name and TRN (SE-03), then the other settings tabs.

### 2026-10-11 — Checkpoint 24: VAT return draft boxes (VR-01 P1 fixed; VR-02 NOT TESTED)
- **Changed:** `frontend/hexabill-ui/src/services/api.js` (the response key converter keeps keys with a digit followed by a lowercase letter as the API sends them: `box1a`, `box1b`, `box9b`, `box13a`, `box13b`). `frontend/hexabill-ui/e2e/vat-return.spec.js` (new). No backend change.
- **Commands and results:** `npx playwright test e2e/vat-return.spec.js --project=m360 --project=t768 --project=d1440` → 3 passed (before the fix Box 1a showed 0.00 against 2815.67). `npx vite build` → exit 0. `npx eslint src/services/api.js` → 0 errors; the 2 warnings (unused `MAX_CONCURRENT_REQUESTS` and `url`) are on lines this change does not touch.
- **Scope check:** the only API properties with a digit followed by a lowercase letter are the five VAT boxes (`DTOs.cs`, `VatReturnPeriod.cs`). No frontend code reads the old `box1A` or `box13B` spelling.
- **Next task:** Reports read checks (aging and summary figures against the API), then a second VAT period with data.

### 2026-10-11 — Checkpoint 25: Aging cards keep the API bucket keys (AG-01 P1 fixed; AG-02 OPEN, owner decision)
- **Changed:** `frontend/hexabill-ui/src/services/api.js`: the response key converter also keeps keys with an underscore before a digit (`bucket0_30`, `bucket31_60`, `bucket61_90`). `frontend/hexabill-ui/e2e/reports-aging.spec.js` (new, two tests). No backend change.
- **Commands and results:** `npx playwright test e2e/reports-aging.spec.js` at m360, t768, d1440 → 6 passed. Mutation check with the previous rule: "0-30 Days amount on screen: Expected 2283.2, Received 0", so the test catches the defect. `npx playwright test e2e/reports-aging.spec.js e2e/vat-return.spec.js --project=d1440` on the final code → 3 passed. `npx vite build` → exit 0.
- **Scope check:** the only API keys the frontend reads that contain a digit next to a letter or underscore are the aging buckets and the VAT boxes. The backend DTOs with that shape are `Bucket0_30`, `Bucket31_60`, `Bucket61_90` (`DTOs.cs`) and the five VAT boxes.
- **Decision needed (OPEN):** AG-02. Historical aging counts invoices dated after the as-of date (27 invoices in 0-30 for 2026-06-30). It changes a financial formula, so it is not implemented here.
- **Next task:** Reports summary cards and the Sales tab totals against the API, the same check as the VAT return.

### 2026-10-11 — Checkpoint 26: Reports summary cards equal the API (RP-01 PASS)
- **Changed:** `frontend/hexabill-ui/e2e/reports-summary.spec.js` (new, one test). No application code changed.
- **Commands and results:** `npx playwright test e2e/reports-summary.spec.js` at m360, t768, d1440 → 3 passed.
- **Notes:** the API names the summary fields `salesToday` and so on, but they sum the selected range. Naming only (RP-02, P3).
- **Next task:** Reports Sales tab and Product Analysis totals against the API, then the staff view of the summary (RP-03).

### 2026-10-11 — Checkpoint 27: Reports Sales tab truncation found by code reading (SL-01 OPEN, P2)
- **Changed:** `docs/uiux/PREMIUM-UX-TRACKER.md` (Reports: sales section). No application code changed.
- **Evidence:** `ReportsPage.jsx` loads page 1 with `pageSize: 100` and never reads `totalCount`; the API reports 38 invoices for the page's range, so the truncation does not show on this tenant.
- **Decision needed:** how the Sales tab should load a large range (all pages, or paging in the tab). It changes the tab's data flow, so it is not changed here.
- **Next task:** Sales tab rows and charts against the API for the 38 invoices (SL-02).

### 2026-10-11 — Checkpoint 28: Reports Sales table matches the API (SL-02 PASS; SL-01 OPEN, design decision)
- **Changed:** `frontend/hexabill-ui/e2e/reports-sales.spec.js` (new, one test). No application code changed.
- **Commands and results:** `npx playwright test e2e/reports-sales.spec.js` at m360, t768, d1440 → 3 passed. The table has 38 rows, one per API invoice, and each total and paid amount matches.
- **Decision needed (SL-01):** how the Sales tab loads a range with more than 100 invoices (all pages, server-side totals with paging, or a visible "showing 100 of N"). Not implemented without that decision.
- **Next task:** Reports Product Analysis totals against the API, then the staff view of the summary (RP-03).

### 2026-10-11 — Checkpoint 29: Sales tab loads every page (SL-01 PASS)
- **Changed:** `ReportsPage.jsx` (page loop, cap 50 pages, "Showing the first N of M" notice). `e2e/reports-sales.spec.js` (mocked 250-invoice test; row snapshot read).
- **Commands and results:** `npx playwright test e2e/reports-sales.spec.js` at m360, t768, d1440 → 6 passed, twice.
- **Choice made:** option A (loop pages) with a cap, chosen by the agent when the owner asked to finish all items.
- **Next task:** pending UX tracker items in order (UX-S08, UX-S07, UX-S06, PU-09, DC-05, then the NOT TESTED rows).

### 2026-10-11 — Checkpoint 30: Sidebar brand name and POS toolbar colours (UX-S08, UX-S07 PASS)
- **Changed:** `Layout.jsx` (brand name wraps, up to three lines). `PosEnterprisePage.jsx` (Hold and Repeat neutral). `e2e/sidebar-name.spec.js` (new).
- **Commands and results:** `sidebar-name.spec.js` d1024 and d1440 → 2 passed (the first try at two lines failed: the 47-character name needs three). POS specs d1440 and m360 → 6 passed.
- **Next task:** UX-S06 (small text), PU-09, DC-05, then UX-S03/S04.

### 2026-10-11 — Checkpoint 31: Smallest row text is 12px (UX-S06 PASS)
- **Changed:** `tailwind.config.js` (`xs` 12px, `micro` 12px), `src/styles/tokens.css` (`--micro-size` 12px).
- **Commands and results:** `ux-audit.spec.js` m360, t768, d1440 → 33 passed; smallest in-row font 12 everywhere (was 10.5 on desktop). List specs → 21 passed, 1 local 429 (passed alone).
- **Next task:** PU-09 (purchases header wrap), DC-05, then UX-S03/S04 and the NOT TESTED rows.

### 2026-10-11 — Checkpoint 32: Purchases header and Daily close intro (PU-09, DC-05 PASS)
- **Changed:** `PurchasesPage.jsx` (header one row, bulk action in the menu), `DailyClosePage.jsx` (short intro, rule kept beside cash rows). New specs `purchases-header.spec.js`, `daily-close-intro.spec.js`.
- **Commands and results:** both new specs at m360, t768, d1440 pass; existing purchases-list and daily-close specs pass (one batch flake on the Overdue tile, passed twice alone).
- **Next task:** UX-S03 (scroll models), UX-S04 (shared primitives), UX-E01 phone decision, then NOT TESTED rows.

### 2026-10-11 — Checkpoint 33: Scroll model PASS (UX-S03), primitives baseline (UX-S04 PARTIAL), Expenses E01 re-measured
- **Changed:** `e2e/single-scroll.spec.js` (new). Tracker only otherwise.
- **Commands and results:** `single-scroll.spec.js` m360, t768, d1440 → 3 passed. UX-S04 baseline counted by grep (948 raw buttons in 98 files; shared 25/34/13/29). UX-E01 re-measured at 48% at 360px.
- **Decision needed:** UX-E01 summary card placement (48% visible vs about 35% behind Filters). UX-S04 bulk migration is deferred by design.
- **Next task:** NOT TESTED rows in tracker order: DC rest, PY-06 rest, PS-03, AU-02, PR-03, SE-03, then Reports rows.

### 2026-10-11 — Checkpoint 34: Daily close capital and transfer movements (DC-07 PASS; DC-08 OPEN, P3)
- **Changed:** `e2e/daily-close-movements.spec.js` (new). No application code changed.
- **Commands and results:** m360, t768, d1440 → 1 passed each. Expected cash on the server and on the screen moves +25 then -5 and returns after both removals.
- **Found:** Remove stays clickable while a delete runs, so a double click gives a 400 (DC-08).
- **Next task:** DC-08 fix, then PY-06 rest (bulk cheques, allocations), PS-03, AU-02.

### 2026-10-11 — Checkpoint 35: Daily close Remove guard (DC-08 PASS)
- **Changed:** `DailyClosePage.jsx` (Remove disabled while saving). Test added to `daily-close-movements.spec.js`.
- **Commands and results:** m360, t768, d1440 → 2 passed each (6 total). A double click sends one DELETE (200).
- **Next task:** PY-06 rest (bulk cheques, allocations, receipts print, roles), then PS-03, AU-02.

### 2026-10-11 — Checkpoint 36: Payments cheque lifecycle and role rules (PY-07, PY-08 PASS; PY-09 owner question)
- **Changed:** `e2e/payments-cheque.spec.js`, `e2e/payments-roles.spec.js` (new). No application code changed.
- **Commands and results:** cheque spec m360, t768, d1440 → 3 passed (pending keeps the balance, cleared reduces it by the amount, void restores it). Roles spec d1440, m360 → 2 passed (staff redirected; API 403 on edit and delete).
- **Decision needed:** PY-09, whether any signed-in user may create a payment through the API.
- **Next task:** PS-03 (POS credit sale), AU-02, PR-03, SE-03, then Reports rows.

### 2026-10-11 — Checkpoint 37: POS credit sale (PS-04 PASS; PS-05 OPEN, owner decision)
- **Changed:** `e2e/pos-credit-sale.spec.js` (new). No application code changed.
- **Commands and results:** t768 and d1440 → 1 passed each. Stored sale belongs to the customer, is unpaid, paid amount 0, balance up by the invoice total.
- **Found:** a fresh POS defaults to Cash, a POS after New invoice defaults to Credit (PS-05).
- **Next task:** AU-02, PR-03, SE-03, then Reports rows (VR-02, AG-04, RP-03).

### 2026-10-11 — Checkpoint 38: Authentication safety (AU-03, AU-04, AU-05 PASS)
- **Changed:** `e2e/auth-security.spec.js` (new, 3 tests). No application code changed.
- **Commands and results:** d1440 and m360 → 3 passed each. Lockout after 5 wrong passwords (429 even with the right one), cross-tenant sign-in refused, invalid token → `/login`.
- **Next task:** PR-03 (products activate, categories), SE-03, then Reports rows (VR-02, AG-04, RP-03).

### 2026-10-11 — Checkpoint 39: Products activate, Outstanding report fix (OUT-01 PASS), staff data access finding (RP-04 OPEN)
- **Changed:** `ReportService.cs` (ordering cast). New specs `products-activate.spec.js`, `reports-outstanding.spec.js`.
- **Commands and results:** `dotnet test --filter Report|Sale` → 119 passed, 9 skipped. products-activate m360, t768, d1440 → 3 passed. reports-outstanding m360, t768, d1440 (twice each) → all passed. The API was restarted with the UI-test database after the build.
- **Decisions needed:** RP-04, which reports and lists staff may read (the API allows more than the UI shows). Same family as PY-09.
- **Next task:** SE-03, VR-02, AG-04, then Customers CRUD and the Routes / Inventory modules.

### 2026-10-11 — Checkpoint 40: Invoice PDF carries company name and TRN (SE-04 PASS)
- **Changed:** `e2e/invoice-pdf.spec.js` (new, API only). No application code changed.
- **Commands and results:** d1440 → 1 passed. Text extracted with `pdftotext`; company name, 15-digit TRN and invoice number present.
- **Next task:** VR-02 (VAT other period), AG-04, Customers CRUD, Routes and Inventory modules.

### 2026-10-11 — Checkpoint 41: VAT return other periods (VR-03 PASS)
- **Changed:** `e2e/vat-return.spec.js` (refactored; 4 new tests). No application code changed.
- **Commands and results:** m360, t768, d1440 → 5 passed each (15). Empty quarter, full year, snap to quarter, refusal of a window spanning quarters.
- **Next task:** VAT/Reports export files (VR-02, AG-03), Customers CRUD, Routes and Inventory modules, ST-04.

### 2026-10-11 — Checkpoint 42: VAT export files match the API (VR-04 PASS)
- **Changed:** `e2e/vat-exports.spec.js` (new, API only). No application code changed.
- **Commands and results:** d1440 → 2 passed. CSV sums equal Box 1a, 1b, 9b; management CSV lines equal the API; Excel is a zip; PDF text has the company and the period.
- **Next task:** Customers CRUD, ST-04, AG-04, then Routes and Inventory modules.

### 2026-10-11 — Checkpoint 43: Customers CRUD (CU-01 PASS) and tablet row actions (UX-C05 PASS)
- **Changed:** `CustomersPage.jsx` (table from 1280px, list below; list menu label unified). New `e2e/customers-crud.spec.js`.
- **Commands and results:** customers-crud at m360, t768, d1024, d1440 (twice each) → all passed. `ux-audit` + `single-scroll` at t768 and d1024 → 24 passed.
- **Found:** the row actions were off-screen at 768px and cut at 1024px (UX-C05, fixed). Test data accumulates (CU-02).
- **Next task:** the same off-screen check on other tables (Products, Suppliers, Billing History, Staff) at 768 and 1024, then ST-04, AG-04, Routes and Inventory.

### 2026-10-11 — Checkpoint 44: Tablet reach sweep (UX-T01, UX-T02 PASS)
- **Changed:** `PaymentsPage.jsx` (header stacks until lg, table from xl), `SuppliersPage.jsx`, `UsersPage.jsx`, `ProductsPage.jsx` (table from xl; product cards gained a "…" menu), `CustomersPage.jsx` (earlier). New `e2e/offscreen-actions.spec.js`. Specs adjusted: payments-crud, payments-cheque, products-crud, staff-users, suppliers-list.
- **Commands and results:** `offscreen-actions` m360, t768, d1024, d1440 → passed. `ux-audit` + `single-scroll` at t768 and d1024 → 24 passed. Payments, Products, Suppliers, Staff, Customers specs pass at every width.
- **Found:** at 768px the Payments "Add Payment" button was off-screen (UX-T01). Test data accumulates (UX-T04).
- **Next task:** run the sweep on the remaining routes (Billing History, Dashboard, Reports tabs, Purchases form), ST-04, AG-04, Routes and Inventory modules.

### 2026-10-11 — Checkpoint 45: Closing gate and harness hardening (UX-T05, UX-T06)
- **Gate results:** backend `dotnet test` 729 passed, 0 failed, 52 skipped (PostgreSQL-only, no local PostgreSQL). Frontend unit tests 147 passed. `vite build` exit 0. ESLint 0 errors, 4 warnings. Full Playwright suite at d1440: 162 passed, 47 failed, 9 skipped before fixes; the failures were the locked frozenhub1 account (40), test data, and the Users table width. After fixes the previously failing specs pass at d1440 except as noted below.
- **Changed:** `UsersPage.jsx` (wrap name and email), `route-sweep.spec.js` (single sign-in per tenant), cleanup in `stock-adjust`, `products-crud`, `staff-users`, `payments-roles`, `auth-security`.
- **Still to verify:** the frozenhub1 sweep after the 15-minute lockout expires; the full suite at 360, 768, 1024 (only 1440 was run in full).
- **Next task:** Routes and Inventory modules, ST-04, AG-04; owner decisions listed in the tracker (ST-01, RC-04, AG-02, PY-09, PS-05, RP-04, UX-E01).

### 2026-10-11 — Authorized main publication checkpoint
- **Authorization:** user explicitly requested capturing all changes and pushing to main. Active checkout was clean on `uiux-audit-p1` at `8c7e634356e62f569dc2bcfe6adc2942e2e4a3f3`; fetched `origin/main` at `c6ba249c9f2e2a183e48e862472ab6e941e4a43b`, with 60 local commits and no remote-only commits.
- **Changed:** ESLint's Node environment now includes `e2e/**/*.js`, resolving undefined `process`/`Buffer` errors; removed the redundant `process` global declaration and a trailing blank line. No runtime code changed in this checkpoint.
- **PASS:** `npm test` — exit 0, 147 passed, 0 failed, 0 skipped. `npm run lint -- --quiet` — exit 0 (existing warnings remain). `npm run build` — exit 0 (bundle/browser-data warnings remain). `dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --configuration Release --no-restore --verbosity quiet` — exit 0, 729 passed, 0 failed, 52 skipped. `git diff --check origin/main` — exit 0 after whitespace correction.
- **FAIL then corrected:** initial lint run returned exit 1 (10 undefined Node-global errors). Initial Debug `dotnet test --no-restore --verbosity minimal` returned exit 1 because the running local API locked its executable; Release verification succeeded without stopping that API.
- **Security:** heuristic scan of added lines across the 60 commits found zero known secret-format or sensitive-file candidates; this is not a comprehensive secret audit. Existing tenant/security tests ran as part of the backend and frontend suites; no permission or provider/privacy decisions were changed.
- **NOT TESTED:** the 52 PostgreSQL cases (no disposable PostgreSQL target configured), browser-suite rerun, production deployment/migrations, backup/restore and live smoke. Prior browser-suite failures and owner decisions remain recorded above; production release gate remains incomplete.
- **Publication:** preserve existing commit history, commit this verification checkpoint, fast-forward local main, push without force, then verify the remote SHA. AI/provider cost: no provider calls.
- **Next task:** verify the outstanding frozenhub1/browser-suite gate and disposable PostgreSQL cases before production release; continue the recorded UX queue afterwards.

### 2026-10-11 — P0-02 live migration recovery (BLOCKED on backup destination approval)
- User authorized pending production migrations and reported a maintenance-like live error. Read-only checks confirmed Render `92a5059`, HTTP 503 `InitializationFailed`, and the startup log declaring two pending EF migrations. PostgreSQL history has 50 applied entries ending at `20261003190000_AddPaymentParentPaymentId`.
- **All pending:** `20261010090000_AddVatManagementSnapshot` and `20261010120000_AddVatCalculationVersioning`. They add 12 columns to `VatReturnPeriods`; source is identical in the deployed commit and current main. Exact evidence, rollback reference and resume action: `docs/production/MIGRATION-RECOVERY-2026-10-11.md`.
- **PASS:** EF forward-script generation (exit 0); two-tenant synthetic PostgreSQL rehearsal (exit 0), including preserved financial/tenant/lock fields, defaults and forced-failure atomic rollback. Full existing backend suite with fresh disposable PostgreSQL: `dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --configuration Release --no-build --no-restore --verbosity quiet` (TRX options recorded in evidence) — exit 0, **781 passed, 0 failed, 0 skipped**. No skipped PostgreSQL cases in this run.
- **BLOCKED:** automatic approval review rejected the full production dump because sensitive customer/financial data would be exported to a local destination without explicit destination-specific authorization. Specific backup and isolated-restore approval requested; no workaround export attempted. Production schema/service remain unchanged.
- **NOT TESTED:** actual full production backup restore, production migration application and post-restart recovery; previous deployed application boot with expanded schema. Migration SQL checks alone do not satisfy these gates.
- **Resume:** branch `main`, parent/source commit `704f802`, task P0-02. Next failing acceptance is live health 503. After backup approval, follow the guarded backup → isolated restore → atomic two-migration application → same-commit restart → live health/history verification sequence in the evidence document. Owned local PostgreSQL stopped; artifacts retained privately. No provider calls, no push, no new deployment. Preserve unrelated untracked `docs/uiux/PENDING-TODO.md`.

### 2026-10-11 — Approved live recovery, deployments and four-client verification checkpoint
- **Full active goal:** apply all pending live migrations; redeploy backend/frontend; log into the actual four client subdomains; test every existing page/feature/form/save/refetch/realtime flow one by one on desktop/tablet/mobile; make approved client features usable. Scope remains active and is not reduced to the completed public checks.
- **PASS:** user approved the previously requested private sensitive-backup/restore destination and production recovery/deployments. PostgreSQL 18 full backup 928,216 bytes, SHA256 `BA0B0AC7C273CC00BE5AF8B7DE5644430ED14E6F7652DA14928A608331A82658`; isolated full restore exit 0; all 67 table counts and 50 history entries matched. Guarded two-migration script tested on the restored copy then applied live with `psql --single-transaction`, exit 0. Existing VAT fields/tenant IDs preserved; history now 52, all other table counts unchanged at migration verification. No Down migration, password reset or ambiguous automatic retry.
- **PASS:** backend deployment `dep-db5iuhflot8c73f4mit0` live, frontend `dpl_EudWcr84trNpUCKnKNLPnGDvLgoh` READY; both exact runtime SHA `704f802`. Existing settings/aliases retained. Vercel MCP detailed reads returned 403; documented CLI fallback succeeded for the same exact team/project. Deployed `/health/ready` 200 Ready/Current proves zero pending compiled EF migrations. Bounded Render error scan after deploy: 0 entries, hasMore=false.
- **PASS (public only):** actual production tenants 6/zayoga, 20/frozenhub, 22/gulfharvest, 23/frozenhub2 are Active. Four `/login` 200; four trusted `/api/maintenance-check` 200/false; anonymous `/api/auth/validate` 401. Twenty actual-viewport login layout checks at 360/390/768/1024/1440 pass with no horizontal overflow and expected form controls; four empty-submit validation checks pass. Viewport overrides reset. No customer passwords were attempted.
- **Evidence:** `docs/production/MIGRATION-RECOVERY-2026-10-11.md` (exact commands/checksums/rollback), `docs/production/LIVE-CLIENT-VERIFICATION-2026-10-11.md` (full client/page matrix). Existing source was tested with 781 PostgreSQL-enabled backend tests, zero failures/skips; this checkpoint changes documentation only and does not relabel unit tests as live workflow coverage.
- **BLOCKED / NOT TESTED:** authenticated owner/SuperAdmin page/form/feature verification. Offline check of the existing local test credential against the approved private restore matched none of the four owners; no live guesses or resets. Asked for an existing protected production credential-file path or manual sign-ins. Feature arrays are currently empty; optional financial flags remain off. `/recurring-invoices` redirects to dashboard and is not a functioning feature. These findings prevent claiming all features complete.
- **Gate:** P0 maintenance/schema incident recovered live. Full goal remains IN_PROGRESS; all-client authenticated acceptance gate is incomplete, and future permission/financial/provider changes retain existing safeguards.
- **Resume:** `main`, checkpoint parent `37fa46d`, runtime source `704f802`; current task = live four-client authenticated verification / approved feature availability. Next unrun check: actual zayoga owner login, dashboard at all five sizes, then each route/client. Browser 2 retained tabs 1–4 correspond to zayoga/frozenhub/gulfharvest/frozenhub2; inspect actual authentication state before continuing. Existing SuperAdmin sign-in is required for audited feature updates. Owned private local PG stopped at handoff; keep protected backup/evidence. Preserve unrelated `docs/uiux/PENDING-TODO.md`. No paid inference, customer messaging, staff permission changes or accounting-basis changes.
