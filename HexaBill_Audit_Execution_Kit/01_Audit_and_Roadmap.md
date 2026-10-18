# HexaBill: review and action plan

17 October 2026 | Five-client planning assumption | Tablet use is the priority

## 1. Honest assessment

HexaBill has a substantial working foundation. Keep the existing ASP.NET Core, React and PostgreSQL architecture. The largest problems are inconsistent workflow reliability, overly dense tablet layouts, fragile refresh behaviour, and uneven implementation across modules. Adding a voice chatbot before resolving these issues would let users encounter the same failures through another interface.

The recommendation is to stabilise saves, uploads and tenant access; standardise the tablet shell and key workflows; then introduce a read-only assistant, document retrieval and confirmed drafts. Voice-to-voice and forecasting follow measured pilot results. This review cannot certify production as safe: there is no live authenticated session, current Git checkout, complete dependency installation, .NET runtime or PostgreSQL test environment here.

### What was inspected

- 309 supplied PNG images, each visually catalogued through contact sheets; critical issues were also opened at full size. OCR supported text checking for 308 images. The credential image was excluded from OCR.
- 1,055 source archive files inventoried. Targeted inspection covered purchases, VAT, branding, tenant middleware, database filters, storage, dashboards, reports, users, Daily Close, routes, navigation and cleanup dependencies. This is not a line-by-line audit of all 1,055 files.
- The screenshots include desktop, narrow mobile and tablet-like captures, plus Linear reference images and a tiny arrow crop. Image pixel dimensions are not reliable CSS viewport measurements because some captures are cropped or scaled.
- The archive has no `.git` metadata. Its filename does not prove a branch, HEAD or deployment version. The screenshot showing infrastructure reports a deployment version, but that does not establish that this ZIP matches it.

### Facts that change the plan

| Question | Evidence-based answer |
| --- | --- |
| Are there five clients? | You state five. Screenshot S288 shows seven total/active companies; S300 shows five. Reconcile account definitions, caches, databases and deploy versions before using admin counts. Do not create or delete tenants to match an expected number. |
| Is Daily Close missing? | No. `Modules/DailyClose/` and `features/dailyClose/DailyClosePage.jsx` exist; screenshots S073-S076, S215-S216 and S269 show it. Discoverability, workflow clarity and enabled features need work. |
| Is image storage missing? | No. R2 adapters and tenant storage routes exist. Production configuration is not verified. Repeated logo errors remain visible. |
| Is the AI assistant already implemented? | The inspected insights endpoint uses database queries/rules. It is not evidence of conversational AI, document RAG or a voice agent. No complete implementation of those requested flows was found in the reviewed source paths. |
| Are maps already present? | Yes: route/customer pins and current-location selection. These do not establish continuous live driver tracking. |
| Can files simply be deleted to make it clean? | No. Some exact duplicate documents can be consolidated; the legacy POS is still an active fallback. Migrations, evidence and tenant assets must be preserved. |

## 2. Priority findings

Priorities describe urgency, not a claim that exploitation or data loss occurred. P0 triage means investigate before releasing new features; P1 means fix in the stabilisation release; P2 means add after the core gate.

| ID | Priority and evidence | Finding and required outcome |
| --- | --- | --- |
| SEC-01 | P0; Observed S006 | A Linear reference screenshot exposes a full-access API key. Revoke/rotate it in the owning account. Exclude the screenshot from shared design packs and review key usage. No key value is reproduced here. |
| SAVE-01 | P0 triage; Observed S009-S010, S013 | Customer and product forms show generic save failures. A screenshot cannot show whether the write committed. Trace mutation, response parsing and refresh separately; prevent duplicate retry and preserve entered fields. |
| REL-01 | P1; Observed S037 | Purchases displays the route error boundary. Capture exception/chunk/network details; do not assume the generic message proves a server outage. Preserve draft state on recoverable errors. |
| UX-01 | P1; Observed S278-S279; Code-confirmed | Purchase autocomplete overlaps table headings and rows. Correct anchoring, stacking, clipping and touch/keyboard interaction together. |
| UX-02 | P1; Observed S183-S184, S189, S200, S203, S210 | Horizontal tables hide important identifying columns on phones. Use mobile cards and tablet priority columns; restrict sideways scrolling to genuinely wide comparison reports. |
| VAT-01 | P1; User-reported; code-supported hypothesis | VAT refreshes/jumps while scrolling. Focus/visibility/data events refetch and full loading replaces content. No scroll listener was found in this page, so the actual scroll-triggered loop is not proven. |
| REL-02 | P1; Observed S082, S223; Code-confirmed mismatch | Staff activity calls `/users/{id}/activity`, while the inspected endpoint is `/api/admin/users/{id}/activity`. Failed requests are also converted into an empty activity list. Align the route and distinguish empty from failed. |
| REL-03 | P1; Observed S282-S309; Code-confirmed request pattern | Admin repeatedly displays logo data URI failures. Branding loads on navigation and visibility without an early platform-host exclusion. Fix tenant/platform branding boundaries and deduplicate loads; inspect server error before assigning one final cause. |
| DATA-01 | P1; Observed S288 vs S300 | Company counts differ, seven versus five. Make count definition, source, as-of time and environment consistent; reconcile test/demo/active/paying status explicitly. |
| SEC-02 | P1 before document uploads; Code-confirmed | Generic storage responses set `Cache-Control: public, max-age=86400`. Even with authorization and Vary, this policy is unsuitable for private licences and business files. Separate public branding from private authenticated documents. A leak was not demonstrated. |
| OPS-01 | P1; Code-confirmed | Production startup still executes supplier-table DDL; tenant middleware can attempt `ALTER TABLE` if a column is missing. Remove runtime schema repair only after a versioned migration/recovery path is verified on PostgreSQL. |
| OPS-02 | P1; Code-confirmed | Memory pressure is derived from managed heap divided by process working set, not the Render memory limit. Do not use that percentage as capacity headroom. Read container/provider limits and real RSS. |
| UX-03 | P1; Observed S241-S280 | Tablet-like captures retain a large sidebar, tiny controls and dense rows. Verify CSS width/DPR/zoom, then make touch/tablet layouts intentional. |
| UX-04 | P1; Observed S155-S159, S277-S280; Code-confirmed | Purchase entry is mixed with history/analytics, has nested scroll regions and a fixed mobile footer offset. Separate entry mode from browsing and use one clear scrolling area. |
| UX-05 | P1; Observed S073-S076, S215-S216 | Daily Close reads like a long finance form. Expose Open/Count/Review stages and a dashboard shortcut, preserving existing accounting rules. |
| UX-06 | P1; Observed across modules | Tiny icons, inconsistent row actions, several button colours, long filters and inconsistent back controls slow nontechnical users. Apply shared components and plain action names. |
| SAFE-01 | P1; Observed S230, S237 | Clear-all-data actions appear in ordinary settings/profile areas. Move to a restricted recovery screen with reason, typed confirmation, recent authentication and a restore plan. Verify server permission as well as visibility. |
| INS-01 | P2; Code-confirmed | The inspected "top sellers" query groups products and takes five without ranking by sales quantity/value. Correct ranking before showing it as an insight. Rule-based insights should be labelled accurately. |
| AI-01 | P2; Proposed | Add tenant knowledge, read-only tools, reviewable drafts, approved provider routing and budgets; then test Malayalam speech. |

## 3. Exact source findings and repair approach

Paths below are relative to the supplied `HexaBillAd-main` root. Line numbers are snapshot anchors and will change after editing.

### Purchase dropdown and form

In `frontend/hexabill-ui/src/features/purchases/PurchasesPage.jsx`, the search input's relative wrapper ends around line 1106. The absolute results list is a following sibling around line 1109, with `z-10`. The sticky item table header also has `z-10` around line 1219. The form shell uses `overflow-hidden`, and item layouts switch at `md` although the purchase list switches at `xl`.

This explains the layering conflict visible in S279. An increased z-index alone is incomplete: clipping, positioning and constrained width remain. Use one anchored accessible combobox popover rendered outside clipping parents, with viewport collision handling, or a full-width product picker sheet on touch devices. Keep input, popup and selection state together. Test typing, scrolling, touch selection, Enter, Escape, blur, keyboard appearance and orientation changes. The highlighted option must never be behind a sticky table or save bar.

The local `VoucherSection` accepts only `title` and `children`, while call sites pass section/open/toggle props. Those props currently do not create a staged/collapsible flow. Decide explicitly between a simple continuous form and real sections; remove misleading dead state only after that decision and verification.

### VAT refresh and scrolling

`features/reports/VatReturnPage.jsx` around lines 161-284 implements the fetch. It sets `loading=true`; the render around lines 678-680 substitutes loading content for the report. Event subscriptions around lines 338-360 refetch on `dataUpdated`, window focus and document visibility. Request IDs guard stale results, but do not cancel duplicate work or preserve report geometry while refreshing.

Reproduce with network logging and record the actual trigger: document reload, component remount, focus event, data event or browser pull-to-refresh. Keep the last good report visible; separate first-load from background-refresh state; coalesce identical requests; cancel superseded requests; add freshness checks; preserve tab, period and scroll position. Avoid automatic refresh during a review/confirmation action. Use controlled overscroll behaviour only where needed. Acceptance: repeated vertical/horizontal scrolling causes zero fetches; tab return produces at most one eligible refresh; period changes never display an older response over a newer one.

Also reconcile the frontend's hard-coded quarter helper with the backend tenant schedule. The inspected frontend normalises periods to Feb-Apr/May-Jul/Aug-Oct/Nov-Jan or full years. Do not silently apply one business calendar to all clients. Verify monthly/quarterly tenant configuration, analysis ranges and filing-period locks separately.

### Staff activity endpoint

`services/index.js:1445` calls `/users/${userId}/activity`. `Modules/SuperAdmin/SuperAdminController.cs:894` defines `users/{id:int}/activity` under class `AdminController` and route `api/[controller]`, giving `/api/admin/users/{id}/activity`. The inspected `UsersController` does not provide the former route. `pages/company/UsersPage.jsx` catches errors and sets an empty array, causing a misleading "No activity" message alongside a failure toast.

Choose one canonical contract with tenant+role checks; preserve compatibility if an older client needs it. Test 200 with rows, 200 empty, missing user, forbidden user, wrong-tenant ID and backend failure. An error must display "Could not load activity" with Retry, never "No activity recorded".

### Branding request storm

`tenant/TenantBrandingContext.jsx:59-174` loads logo/settings on initial mount, route changes and visibility. Its guards skip login paths, but do not generally skip the platform host. The logo fallback adds a timestamp to the URL on each load. This can repeat unnecessary requests and errors on unrelated screens. It is consistent with the recurring admin toast, but the failed server response still needs correlation-ID inspection.

Resolve platform versus tenant context before calling tenant endpoints. Use a cache keyed by verified tenant and branding version; invalidate on a successful branding update or tenant switch. Never suppress a real tenant logo error by making all storage public. A missing optional logo can show initials without a repeated toast. Verify browser display and PDF/logo retrieval separately after restart.

### Schema operations and isolation

`Program.cs:409-440` enters a production/Postgres branch which creates `SupplierLedgerCredits` despite the nearby "no DB access at startup" comment. `Core/Tenancy/TenantContextMiddleware.cs:113-145` attempts to add `FeaturesJson` during a request after a missing-column error. These are code facts, not proof they ran in production today.

Move ownership to additive EF migrations plus an explicit operational recovery runbook. Test both empty-database creation and upgrade of an existing synthetic database. Do not delete migration history to make a clean start. The old cleanup report also records migration rehearsal concerns; treat those as historical reports until rerun against this snapshot.

`Data/AppDbContext.cs:27-110, 1205-1233` already establishes request tenant scope, checks writes and applies global filters to entities with TenantId. `Core/Tenancy/TenantChildAccess.cs` checks parent ownership for several child operations. Preserve these controls. No PostgreSQL row-security policy implementation was found in the searched .cs/.sql files; the README's "RLS support" wording is not evidence that deployed database RLS is enabled. Independently test raw SQL, IgnoreQueryFilters, background jobs, child IDs, exports and caches.

### Capacity telemetry

`Core/Platform/PlatformMetrics.cs` derives `heapVsWorkingSetPercent` and still uses it for limitsHint and the compatibility memoryUsagePercent field. `Modules/SuperAdmin/DiagnosticsController.cs` also labels process working set as max memory on one health path. Neither is the actual 512 MB/2 GB container limit. Measure RSS/container limit, CPU, queue length, request percentiles, database connections and slow queries before sizing the service.

## 4. Existing features to improve rather than rebuild

| Capability | Existing source | Work still required |
| --- | --- | --- |
| Daily close | `Modules/DailyClose/`, `features/dailyClose/` | Easy access, understandable stages, cash reconciliation, permission and multi-cashier tests |
| Tenant isolation | `Core/Tenancy/`, `Data/AppDbContext.cs` | Adversarial tests and scope propagation to new AI/document/cache/voice features |
| Persistent assets | `Core/Storage/R2StorageService.cs`, `R2FileUploadService.cs` | Verify real configuration, private file policy, retention, restart test and object restore |
| Branding | `tenant/TenantBrandingContext.jsx`, logo services | Stop platform-context calls and repeated toasts; reliable auth-aware downloads |
| Route/customer map | `components/StopLocationMap.jsx`, `features/branches/`, `Modules/Branches/` | Delivery workflow first; scoped live location later |
| Quick create | `components/BottomNav.jsx`, navigation quick-create helpers | Role-relevant shortcuts; add Daily Close where authorised |
| Insights | `Modules/Reports/ReportService.cs:1431`, `features/reports/ReportsPage.jsx` | Correct deterministic ranking, accurate labelling, source links, data quality gates |
| SuperAdmin | `platform/`, `Modules/SuperAdmin/`, `Modules/Tenants/` | Reliable counts, metrics, backup health, rollout control and AI governance |

## 5. Dashboard and tablet direction

Use a compact owner dashboard that answers: What happened today? What needs attention? What should I do next?

- First view: Today/date, branch, data freshness; Net sales, Collected, Receivable and Cash expected. Profit appears only with an accurate cost-completeness label.
- Six clear shortcuts: New sale, Receive payment, Add expense, New purchase, Customer statement and Daily close. Show only actions the logged-in user can perform.
- A short attention queue: overdue invoices, low stock, unclosed shift, failed saves/sync and licence expiry. Each item opens the exact relevant view with filters already set.
- One sales trend and one 2D collection-status ring can support quick understanding. The ring must state whether it measures invoice count or amount. Pair colours with words and exact totals.
- Keep detailed charts, branch comparisons and advanced finance below the first screen. Collapse long empty chart areas into a concise empty state.

A 3D pie is a poor default for money comparisons: perspective makes segment size harder to judge and costs screen space. Use a clean 2D ring with a total in the centre. Treat forecasts as a separate card labelled "Estimate", with history window, last update, range and explanation. Show "Not enough history" when appropriate; never manufacture a prediction from a few invoices.

For tablets, use a collapsed rail or drawer at constrained widths, readable 14-16 px text, and 44 px touch targets. A 1024 px tablet should not automatically inherit a desktop table simply because it exceeds 768 px. Use available content width and pointer type, and test both orientations. Complete layout rules are in `08_Tablet_UX_Spec.md`.

## 6. Is the current Render setup suitable for five clients?

**It can be a reasonable small deployment, but five tenants alone cannot establish capacity or reliability.** Five owners working occasionally is very different from five companies with many staff, simultaneous PDFs, imports and voice sessions.

Your stated current cost is $7 API + about $7 database, roughly $14/month. The public current flexible pricing lists a $7/month 512 MB web service, $6/month 256 MB PostgreSQL compute and $0.30/GB-month database storage. With 5 GB storage, that example is **$14.50/month** before other charges. Your actual invoice may use a legacy plan or other line items. [R1-R3]

| Configuration | Example monthly base | Decision |
| --- | --- | --- |
| 512 MB API + 256 MB DB compute + 5 GB DB storage | $7 + $6 + $1.50 = $14.50 | Keep for light use if measured gates pass; PDF/import spikes can be a constraint. |
| 2 GB API + same DB compute/storage | $25 + $6 + $1.50 = $32.50 | Candidate if API memory/CPU or concurrent PDF work is the measured bottleneck. |
| 2 GB API + 1 GB DB compute + 5 GB storage | $25 + $19 + $1.50 = $45.50 | Candidate only if database CPU/memory/query latency also justify it. |

These are arithmetic examples from current public service/compute/storage prices, not complete quotes. They exclude model/audio usage, background workers, object operations/storage over allowances, workspace plan, traffic, tax, exchange conversion and other services. Do not buy an upgrade solely because this table shows one.

**5 GB is database disk capacity, not database RAM.** S288 displays 21 MB from a database-size metric at capture time. That is not a current account measurement, available physical disk, a backup metric or proof that query performance is healthy.

Keep business records and indexed document metadata in PostgreSQL. Put product images, licence PDFs, receipt originals and generated document assets in private object storage. The repository already integrates R2. Render's default service filesystem is ephemeral; files written there can disappear on redeploy/restart. A persistent disk has deployment/scaling tradeoffs and is unnecessary if the existing R2 path is working. [R4]

For R2 Standard, the public free allowance includes 10 GB-month, one million Class A operations and ten million Class B operations; paid Standard storage is $0.015/GB-month. These are account allowances and do not guarantee your usage is free. Set per-tenant quotas and monitor total account usage. [R5]

### Proposed capacity gate, not measured results

Use synthetic tenants and realistic catalog/invoice volumes. Run browse/search/save/PDF/report flows with 5, 10 and 20 concurrent active sessions, followed by a sustained run at expected peak. Track p50/p95, request failures, DB locks/pool waits, RSS/container limit and CPU. Test duplicate clicks and a lost response after commit.

Initial engineering targets: no duplicate money writes; zero cross-tenant results; no out-of-memory restarts; API p95 under one second for routine reads and two seconds for normal saves, excluding large exports; predictable PDF completion with a progress state. Alert on sustained memory above 75-80% of the true limit, storage above 70-80%, or pool pressure. These are proposed thresholds to calibrate, not Render guarantees.

Paid Render PostgreSQL supports PITR, with the window dependent on workspace plan. Keep an independent export retention policy and prove restoration into a separate database. Database backups do not automatically restore R2 objects; define both recovery paths and test references after restore. [R6]

## 7. SuperAdmin improvements

The current admin is more than a basic tenant list: it already shows companies, audits, errors, infrastructure, SQL console, subscriptions and settings. Improve those sources before adding more cards.

| Area | Recommended addition or correction |
| --- | --- |
| Overview | Consistent total/active/paying/demo tenant definitions, as-of time, current frontend/backend version and unavailable states |
| Reliability | Error groups by fingerprint, affected tenant count, first/last seen, correlation ID, regression status and actionable links |
| Infrastructure | Real provider/container resource headroom, connection pool waits, DB size, object storage usage, backup age and last restore drill |
| Tenant onboarding | Owner invite, licence/trade details review, logo, locale/currency/timezone, branch/staff setup and first-invoice checklist |
| Support | Existing support-session controls extended with reason, expiry, visible banner and audit; no routine unbounded impersonation |
| Releases | Pilot tenant flags, per-tenant release status, last successful smoke test and rollback instructions |
| AI controls | Tenant enablement, tool permissions, model allowlist, secret references, budgets, voice limits, retention and separate text/voice kill switches |
| Operations | A failed job queue with safe retry policy, delivery/receipt attachment status and tenant export/deletion workflow |

Keep SQL console access restricted and audited. The inspected implementation already uses a read-only PostgreSQL transaction; preserve that. Do not attach the AI assistant to this console.

## 8. Suggested delivery order

Effort ranges are planning estimates for one engineer who knows this stack, not deadlines. They exclude waiting for access, external review and major undiscovered incidents.

| Stage | Scope | Exit gate | Indicative effort |
| --- | --- | --- | --- |
| 0 | Reconcile source/deployment, rotate exposed key, reproduce save/activity/logo/purchase errors | Clear incident causes and a safe synthetic test setup | 2-4 working days |
| 1 | Purchases, VAT refresh, shared navigation/forms, tablet tables, dashboard and Daily Close | Real save/refetch/print flows pass on phone/tablet/desktop | 5-10 days |
| 2 | Private documents, versioning, upload validation, tenant-scoped retrieval | No cross-tenant access; safe extraction/review/expiry/delete | 4-8 days |
| 3 | Read-only AI and confirmed customer/expense drafts | Authorization, idempotency, source grounding and budget gates pass | 5-10 days |
| 4 | Malayalam push-to-talk, then voice-to-voice pilot | Device/accent/amount tests and measured cost/latency | 4-8 days plus pilot |
| 5 | Delivery/live map and forecasting | Consent/location tests; useful forecast backtests | Separate scope after usage evidence |

Some work can overlap, but there is no credible one-day promise for this complete production scope. Make each checkpoint independently reviewable and resumable. Use the existing tracker as the working authority; link this audit rather than creating another contradictory master plan.

## 9. UI references and how to use them

| Reference | Apply to HexaBill | Boundary |
| --- | --- | --- |
| Behance: Inventory Management System - AI / ERP / CRM / SaaS [R7] | Visual hierarchy, spacing and inventory information grouping | Portfolio inspiration, not proof of tested tablet workflows. Do not copy artwork or branding. |
| Behance: ERP Inventory Management Dashboard [R8] | Explore navigation and dashboard arrangement | Inspect at real content density; a beautiful empty mockup is insufficient. |
| Zoho Books mobile app [R9] | Task-focused receivables/payables, capture and owner workflows | Use the workflow lessons; retain HexaBill's specific client requirements. |
| IBM Carbon data tables [R10] | Consistent table toolbar, selection, expansion and pagination | Translate to existing React/Tailwind components rather than replace the whole UI framework. |

Your Linear images also demonstrate the desired right-hand assistant panel and focused editor. Use that interaction pattern while keeping ERP confirmation and source records visible.

## 10. Sources

Public sources checked 17 October 2026. Internal paths and screenshot IDs are supplied-file evidence, not public links.

- [R1] Render pricing: https://render.com/pricing
- [R2] Render compute plans: https://render.com/docs/compute-plans
- [R3] Render PostgreSQL storage: https://render.com/docs/postgresql-creating-connecting
- [R4] Render persistent disks / ephemeral filesystem: https://render.com/docs/disks
- [R5] Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- [R6] Render recovery and backups: https://render.com/docs/postgresql-backups
- [R7] Behance inventory case study: https://www.behance.net/gallery/187975977/Inventory-Management-System-AI-ERP-CRM-SaaS
- [R8] Behance ERP dashboard: https://www.behance.net/gallery/236691173/ERP-Inventory-Management-Dashboard-UIUX-Design
- [R9] Zoho Books mobile: https://www.zoho.com/in/books/accounting-mobile-apps/
- [R10] Carbon table guidance: https://carbondesignsystem.com/components/data-table/usage/
- [R11] Gemini Live overview: https://ai.google.dev/gemini-api/docs/live-api
- [R12] Gemini live transcription language support: https://ai.google.dev/gemini-api/docs/live-api/live-transcribe
- [R13] Gemini TTS: https://ai.google.dev/gemini-api/docs/speech-generation
- [R14] OWASP file uploads: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- [R15] OWASP prompt injection: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html
- [R16] OpenStreetMap tile usage policy: https://operations.osmfoundation.org/policies/tiles/
