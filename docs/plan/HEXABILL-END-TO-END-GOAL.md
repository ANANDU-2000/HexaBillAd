# HEXABILL — END-TO-END ERP RECOVERY, PREMIUM UX, FUNCTIONALITY, AI, PRINT & SAFE RELEASE

> **For Claude Code running inside the CURRENT local HexaBill repository.** Save this file at `docs/plan/HEXABILL-END-TO-END-GOAL.md`. This document is an execution contract, not evidence that a change is implemented. User screenshots and the uploaded `HexaBillAd-main (9).zip` were reviewed on 2026-10-11; the ZIP is only a snapshot. Verify the actual checkout, deployed SHAs, environment, tenants and code before taking action. Do not mistake screenshots for test results.
>
> **Overall outcome:** Deliver a trustworthy, usable, dense, polished multi-tenant ERP in which every authorized control has a correct destination and every core financial/inventory workflow is verified; then prepare a controlled, reversible, explicitly authorized release and validate each real tenant separately. No fake completions, no unapproved writes to live client data.

## 0 — EXECUTION BEHAVIOR: NOT ANOTHER ABANDONED PLAN

You are the principal full-stack product engineer, ERP domain analyst, release engineer, QA lead and accessibility reviewer operating as **one accountable executor**. Work on the existing React/Vite/Tailwind and .NET backend, not a new demo app. Follow existing `AGENTS.md`, `CLAUDE.md`, `docs/uiux/DESIGN-SYSTEM.md`, `docs/uiux/PREMIUM-UX-TRACKER.md`, `docs/plan/AI-ERP-TASK-TRACKER.md`, `docs/production/PRINT-SPECIFICATION.md`, `docs/plan/FINANCE-INVARIANTS.md`, `docs/plan/ROUTE-MANIFEST.json` and the migration/production rules. If instructions conflict, honor financial/security/production safety first; note and reconcile conflicting old checkpoint STOP rules with `AGENTS.md`'s **CONTINUOUS LOCAL EXECUTION POLICY**.

Do NOT stop after planning. Execute locally, one **small verified slice** at a time, automatically proceed to the next independent approved local task, and persist resumable state after EVERY slice. Do not repeatedly ask me to say “continue”. Do not repeat already-verified work without a justified regression or changed baseline. Minimize token waste by searching targeted file sections rather than rereading the whole repo or running expensive full suites after every CSS change. You may make incremental local commits with unambiguous messages; do not push/merge/deploy without the release safety gate and explicit environment-specific approval, even if prior pushes were authorized.

The goal is not “all tests green” by editing tests to pass. It is **true business workflows** that persist, calculate, print, and respect tenant and role boundaries. Do not hide/unhook controls to claim success unless the feature genuinely does not exist and this is an explicitly approved product choice. Report blockers with precise reproduction, cause and next action; immediately continue other independent tasks, not wait idle.

**User product decisions already supplied by this goal (no need to ask again):**
- Cash is the consistent **initial/default POS tender** on a new draft; existing saved tender and authorized tenant configuration override defaults. Never silently convert a saved credit invoice to cash.
- Red is for **overdue/danger/negative inventory/rejected/error**, not every unpaid invoice. Unpaid not overdue is neutral, partial is amber, paid is green. Red overdue must be based on due date, not merely an unpaid flag. Status must have visible text, not color only.
- Keep essential financial summary visible when necessary; don't pursue an arbitrary 35% first-row target at the expense of money visibility. Prefer compact single-line financial summaries and a filter sheet on mobile.
- Historical as-of aging must exclude transactions dated after the as-of date (and apply correct due-date cutoffs, voiding/returns, allocation semantics); lock formulas to backend tests.
- An owner-authorized disabled staff account must lose access on the server, including existing sessions subject to a validated revocation model, while historical transactions retain their immutable original staff attribution. Existing financial history must not be deleted or reassigned.
- All financial API reads and writes are deny-by-default per role unless an approved granular server-side permission expressly authorizes them. The UI hiding an action is NOT access control; staff payment collection must require a specific approved collection permission, with audit and idempotency.
- No undisclosed, unsaved or reconstructed financial receipts presented as authoritative original documents. New receipts should use verified snapshot semantics; preserve legacy print rules, do not silently backfill or enable production flags without a reviewed migration.
- “Export Excel” and other live-looking buttons must either work end-to-end with correct scope/filter/formats or be honestly disabled with an actionable explanation until implemented. Implement Customer Aging export as a prioritized item.
- Local design can be iterated independently; statutory UAE VAT treatment, destructive data policy, live data changes, provider billing, AI privacy and go-live approval are genuine approval gates, never inferred from this document.

### Actual result required

Deliver a coherent **single product**, not disconnected redesigned screens:
1. Premium information architecture, precise design tokens and workflow-oriented responsive desktop/tablet/mobile UX.
2. Functional Create/View/Edit/Save/Delete-or-Reverse, search/filter/date/pagination, accurate totals, validation and keyboard entry in every accessible business module and its sub-tabs, overlays and nested interactions.
3. Contextual quick-create opens the actual task immediately and preserves context. No pointless detour page.
4. Accounting and inventory invariants, multi-tenant and role security, source-grounded reports.
5. Branded preview/PDF/print/export across real document families with correct per-tenant identity, sizes and page counts.
6. AI assistant, voice, routes/maps and automation **as separate genuinely implemented, tested features**; no fake UI for missing backend and no free-tier wishful thinking.
7. Verified PostgreSQL, responsive browser regression, and controlled rollout and read-only production smoke for **each real distinct tenant**.

## 1 — FIRST 30 MINUTES: RECONCILE REALITY

Run read-only initial commands equivalent to:

```
git status --short; git branch --show-current; git rev-parse HEAD; git remote -v
```

Read the current tracker and open issue lists. Compare `HEAD` against the uploaded ZIP snapshot; reconcile local uncommitted and already pushed code, old `8c7e634` claims, PRs, and source that may have changed. Discover installed runtimes, Node/npm, `dotnet`, container/PostgreSQL, environment, active dev servers, Playwright channel and working credentials without printing their values. Confirm `AGENTS.md` rules. Do not trust a completed-status field without linked reproducible proof. Check whether a deployed version is the same SHA; show `UNKNOWN` otherwise.

Create/update **persistent artifacts within the live repository**:
- `docs/plan/HEXABILL-EXECUTION-STATE.md` — branch, HEAD, baseline deploy, current task, active blockers, commands, checkpoints, next task.
- `docs/plan/HEXABILL-UX-DEFECT-REGISTER.md` — row per real defect: ID, severity, screen/route/state/viewport, steps, expected/actual, code owner, root cause, screenshot/trace, test, fix commit, status.
- `docs/plan/HEXABILL-INTERACTION-MATRIX.csv` — **generated from actual routes and UI code**, every page/tab/subtab/button/menu/field/form/modal/API/role; add URL, intent, expected destination, expected persistence, implemented/test status and evidence; update after every slice.
- `docs/plan/HEXABILL-TENANT-RELEASE-MATRIX.md` — distinct verified company ID, trusted host, permissions, feature flags, logo/TRN source, baseline/after comparison, print families and release state. Never store raw credentials, personal records or full TRNs in repo docs.
- `docs/plan/HEXABILL-PRINT-EVIDENCE.md` and test artifact directory under gitignore; automated PDF text/geometry and visually inspected render evidence.

Import unresolved IDs from existing trackers instead of duplicating or declaring them done: ST-01, AG-02/03, RP-04, PY-09, PS-05, RC-04/06, UX-E01/S04, PU-01/10 and the other PARTIAL/NOT TESTED/Open cases. In older documents "pass" can refer to a targeted test only, not production acceptance.

## 2 — SCREENSHOT-DRIVEN DEFECTS THAT MUST BE REPRODUCED

These were observed in user-supplied screenshots of the **Zayogya** tenant. They are visible symptoms or hypotheses, **not a verified live-code test**. The uploaded ZIP contains corroborating code paths listed below. Verify on current build and add each defect to tracker before fixing.

| ID | Evidence / reproducible concern | Likely starting source | Must verify / outcome |
|---|---|---|---|
| SH-01 | Purchases page stacks title/action bar, full filter panel, five summary cards and list header; wastes vertical space; screenshot on different scroll positions | `features/purchases/PurchasesPage.jsx` | Compress into page title + compact segmented status / metric summary + sticky concise filter toolbar, without hiding essential totals; preserve high-density table and all actions. |
| SH-02 | Purchase entry appears INLINE above purchase list, requiring vertical scrolling between supplier, item picker and Save; dropdown overlays the item table | `PurchasesPage.jsx`, `VoucherSection` | Use a dedicated **focused purchase workspace** or responsive panel with one intentional content scroll and persistent totals/actions; popover anchored to input, viewport-aware, keyboard navigable; results not under/behind unrelated table. |
| SH-03 | Purchase status ``Pending`` shows 89989.17 AED, Unpaid=9, Partial=1, Paid=19; app currently uses neutral Unpaid by design. **Confirmed source behavior:** `loadPendingSummary()` calls `getPurchasePendingSummary()` with no period/category/search args while the visible purchase list sends them. | `PurchasesPage.jsx` `loadPendingSummary()` and `PurchaseService.GetPendingSummaryAsync` | Decide and LABEL whether cards are all-time or period-filtered; ideally align cards to the active result scope with backend support. Ensure count/amount have different labels; clicking ANY metric updates query/results and URL; total and balances reconcile; use overdue red, ordinary unpaid neutral. |
| SH-04 | Quick-create "Receive payment" routes to `/ledger`, "Pay supplier" to `/suppliers`, "Add supplier" on Purchases also routes to `/suppliers` | `navigation/quickCreate.js`; `PurchasesPage.jsx`; `components/QuickCreate.jsx` | The clicked item should enter appropriate create workflow **directly**: customer collection picker + receipt form; supplier payment picker + form; Add Supplier opens validated supplier-create. Preserve return location and role permissions. |
| SH-05 | Products: 6–7 colored action buttons per row, very tall records, missing images, negative stocks -3/-22, price 0.00 | `features/products/ProductsPage.jsx` | Compact rows (1–2 primary actions + visible 'More'); safety semantics, text/number alignment, negative-stock warning and valid replenishment path; check quantities/price sources rather than fabricate them. |
| SH-06 | Branch Routes shows two "Main Route" rows with different invoice counts and profit, enormous blank below | `features/branches/BranchDetailPage.jsx`, route service | Verify if separate route IDs share same name or server duplicates; show distinguishable IDs or permitted labels; filter date/profit data, route link/backs, route performance and empty space. No merging financial records by display name. |
| SH-07 | Delivery Notes list shows 30/1055, 4 small actions on every row, limited task context | `features/sales/DeliveryNotesPage.jsx`, `DeliveryNoteViewPage.jsx` | Verify real pagination, search, View/PDF/A4/A5; use row primary View + Print/Download menu. Determine domain policy for creating/editing delivery notes from sale; never create a fake independent document if domain requires invoice source. |
| SH-08 | `/returns/create` with no `saleId` looks like an almost empty broken page | `features/returns/ReturnCreatePage.jsx` | Build useful invoice-first return picker/search OR redirect to correct invoice selection, preserving context and role; once selected, real line quantities/conditions/reason/credit note, persistence, stock/accounting reversal tests. |
| SH-09 | Customers "Overdue 30d+" tab shows a customer with a credit balance and several "No orders" despite owing balances | `features/customers/CustomersPage.jsx`, aging backend | Investigate overdue qualification, sign semantics (Dr/Cr), legacy/imported opening balances and sales history. Never suppress valid credit balances; ensure chips align with result counts and filtering. |
| SH-10 | Supplier lists Purchases=168061.42, Paid=74051.50, Outstanding=89863.17 AED; arithmetic difference implies possible ledger credits/discounts | `SuppliersPage.jsx`, `SupplierDetailPage.jsx`, backend `SupplierService.cs` | Reconcile ledger entries, cash discounts, returns, opening balances. **Do not claim mismatch until explaining adjustments**; prove itemized sum. Validate date range and same totals in statement/PDF. |
| SH-11 | Supplier ledger shows debit/credit with a transient negative running balance; dates and search must be testable | `features/purchases/SupplierDetailPage.jsx` | Demonstrate ledger chronology, discounts, allocations, corrections, date filters, export PDF/CSV parity; click tab, back/forward/refresh retains chosen data. |
| SH-12 | "More" is a narrow centered generic list; modules in sidebar vs More feel inconsistent | `pages/company/MorePage.jsx`, `navigation/moreMenuConfig` | Role-based task hub with compact grouped links and search; avoid duplicate modules and useless journey, do not add cosmetic tabs with no real function. |
| SH-13 | Sidebar collapsed/expanded width & company name state inconsistent across screenshots; top title/header repeatedly consumes space | `components/Layout.jsx`, sidebar and `docs/uiux/DESIGN-SYSTEM.md` | One global header, one primary nav, one screen title. Retain discoverability, preserve role scope and route awareness. Sidebar state remembered appropriately. |
| SH-14 | Purchases product search dropdown appears over unrelated list, truncated and lacks robust dismiss/position behavior | `PurchasesPage.jsx` product search block near item entry | Fix anchor positioning, focus, aria combobox/listbox, Escape/Enter/Arrow keys, outside click, scroll/resize reposition and touch; show useful SKU/unit/stock/cost without covering save/total. |
| SH-15 | Status labels, numbers, border weight and input widths vary; large fields and repeated card outlines look generic | All screens / shared component layer | Consistent premium **quiet** design, not gratuitous gradients or red everywhere. Consistent 34–40 px desktop controls, >=44px touch targets; 8px grid, tabular amounts, clear field labels, no squashed rows or unreadably small 10.5px text. |
| SH-16 | Screens display date filters inconsistently; some query states seem ineffective | Purchases, Reports, Payments, Customer/Supplier ledgers, Branches, VAT | Each date range tests query parameters, actual backend filtering, timezone, inclusive boundaries, export parity, refresh/URL persistence, invalid dates and empty state. No visual-only filter. |
| SH-17 | Daily close workflow difficult to discover, expected/count/manual movement/transfer logic uncertain | `features/dailyClose/DailyClosePage.jsx`, backend `DailyCloseService` | Discoverability from operational flows, manual drawer movement with kind/reason/audit, cash-only reconciliation, save draft, submit, reopen with rights, sticky phone actions; prevent duplicates. |
| SH-18 | Requested AI assistant, voice, map and route agent are not discoverably complete | `docs/plan/AI-ERP-TASK-TRACKER.md` AI-01..04, VOICE-01..03, MAP-01..02 | First audit **existing** map components/feature flags and API capabilities; distinguish current map stop pins from planned route AI/optimized navigation. Build real approved backend, never mock a production feature. |

Do not redesign from a static screenshot without checking same feature at 360/390/768/1024/1440 and real dynamic content. Screenshot 1 and 2 of Purchases show different scroll positions; that alone is not evidence of a rendering regression.

## 3 — INFORMATION ARCHITECTURE AND VISUAL STANDARD (GLOBAL)

Design objective: a **calm, sharp, high-information-density B2B ERP**, not an AI-generated landing page. Treat UI as task completion infrastructure. Build design tokens, component contracts and route layout consistency first, then migrate **high-use** modules incrementally with tests.

**Navigation layout**
- Desktop: left primary module rail/sidebar, compact 56–64px top app bar, one thin contextual page toolbar, optional one row of secondary tabs. A focused full-screen accounting task is allowed to suppress irrelevant app chrome.
- Tablet: collapsed sidebar, compact table/list that preserves row action access. Do not squeeze a 1290px table into a 768px viewport or force users to pan to find Delete.
- Mobile: compact header, search/summary, essential action; filters in a visible control that opens one sheet; data rows/cards optimized for touch. Bottom nav MUST NOT overlay keyboard/form footers.
- No tab-within-tab-within-tab. Primary module = sidebar; secondary dataset/view = top tabs; tertiary detail = side panel or dedicated route. Keep active state addressable in URL when meaningful.
- Prefer **one main vertical scroll**. Long result sets need pagination/virtualization, not an impossible “never scroll” requirement. Sticky filter/title region only where it improves use; do not occupy 40% of screen. Avoid nested scroll traps and double horizontal scrollbar. Table horizontal overflow may be acceptable on tiny screens only as an explicit accessible fallback, never for primary actions.
- Detail flows use master/detail or dedicated routed page, with a visible Back route and retained search/date/tab/page context; no modal on modal and no unrelated list below an expanded financial form.

**Typography and control sizing**
- Use existing design-system authority `docs/uiux/DESIGN-SYSTEM.md`; do not switch palette/font indiscriminately. Native/Inter stack, usually 12/14/16px (11px only optional metadata if legible); 2–3 clear weight tiers; use tabular numerals.
- Desktop input height ~34–40px for compact data work, mobile interactive min 44px, icons accessible with meaningful labels. Do not impose desktop 28px input on touch.
- 8px spacing rhythm: 4/8/12/16/24 increments, card body 12–16px, understated 1px border, no duplicate card-inside-card borders or needless shadows.
- Amounts and counts RIGHT-aligned; names LEFT; dates consistent locale; avoid truncating money, always give full long text via accessible title/detail without letting it widen a grid. No placeholder-as-label.
- Semantic color: primary blue for actions/selection; text neutral; green paid/success; amber partial/attention; red overdue/actual error/negative inventory; blue informational. Text/icon must convey status without color.
- Buttons: one clear primary action per task area; accessible subdued secondary actions; safe explicit menu for infrequent row operations, delete separated and confirmed with entity context. Do not convert all 948 raw buttons in one enormous diff; prioritize repeated broken implementations and migrate by module with regressions.
- Strict empty/loading/error/save/success states; never show "No records" on HTTP failure. Explain errors near relevant control. Avoid uncontrolled toast-only outcomes.
- Keyboard: Ctrl/Cmd+K scoped global search, Enter/Tab/Escape predictable; shortcut hints only when keyboard handler actually works; focus restore after overlay close, screen-reader names/announcements, visible focus outline, reduced-motion support and WCAG-oriented contrast.
- Data tables: user-adjustable columns where justified, sticky header if useful, sortable headers, server pagination for large data, column preferences per user+tenant where supported. Show count `X of Y` truthfully. Virtualize huge lists only when necessary and proven stable.

**Do not hide essential functions for appearance.** Reorient pages around daily tasks, reduce clicks and scrolling through meaningful composition—not by deleting controls or making action menus impossible to find.

## 4 — PRODUCT CAPABILITY / CLICK DESTINATION CONTRACT

For **EVERY visible interactive element** in every authorized page/subtab/modal/dropdown, test:

`CLICK -> correct destination/panel -> real data or writable form -> fill all required fields -> save/submit -> server response & DB/readback -> refreshed UI & report/ledger/stock update -> print/export if applicable -> Back/forward/reload -> role and tenant tests`.

Record exact inputs, outputs and screenshots/trace. If data creation is unsafe for real clients, use disposable PostgreSQL tenants. For Delete distinguish delete-inactive draft, soft deactivation and **authorized reversal** of finalized finance records. Never hard-delete posted transactions merely to satisfy a CRUD checklist.

**Quick-create mapping to implement and verify:**

| Quick action | Intended immediate task | Important context |
|---|---|---|
| New sale | Open POS focused draft | Cash default on fresh sale, preserve prior saved draft selection |
| Receive payment | Customer search/picker -> create receipt payment panel | Pick customer/invoice; prevent double post, show balance |
| Expense | Open expense entry form/sheet focused | Branch, VAT/ITC, amount, date validation |
| Purchase | Open purchase entry workspace focused | Supplier, item chooser, cost, VAT, discounts, payments |
| Pay supplier | Supplier picker -> payment entry focused | Outstanding and allocations, method/cheque rules |
| Customer | Create customer form directly | Tenant-specific fields, duplicate rules |
| Product | Create product form directly | SKU, unit, barcode, quantity/cost/tax rules |
| Add Supplier on Purchases | Supplier create sheet directly | Return to purchase with new supplier selected if requested |
| Delivery Note | Open invoice-based delivery note flow | Explicit view/print/full PDF A4/A5; editable only if supported by domain |
| Create Return | Invoice selector -> return lines -> confirm -> credit note | No empty orphan `/returns/create` dead end |

Do not create an unsafe generic `?new=1` flag that can accidentally save data; treat it only as a UI intent, cleared on completion/cancel, authorization enforced by API. Back returns to prior context. Test direct URL, browser refresh, navigation from sidebar and mobile quick action.

## 5 — ROUTE-BY-ROUTE FUNCTIONAL AUDIT ORDER

Generate the live route list from `frontend/hexabill-ui/src/app/App.jsx` and `docs/plan/ROUTE-MANIFEST.json`. Snapshot lists **62 unique route patterns** including `*` and redirects; this number is not final until rechecked. For EACH route enumerate ALL primary/secondary/tertiary tabs, fields (name, required, type, constraints, default, value source, validation), menu items, hover/keyboard states, row actions, forms/modals/sheets, API endpoints, scope, print and export options, dangerous actions and role. Test with 0, 1, 30, 500+ rows and long strings where relevant. Mark exceptions (redirects, signed-out, restricted routes). Never mark a page verified solely because its shell loads.

**Ordered work streams, P0 financial/security first, then daily-use modules:**

**A — Tenant/Auth/Shell.** Signup, login, lockout/rate limits, recovery, staff roles, Owner/Admin/Manager/Staff, tenant bootstrap/subdomains, switch/redirect/unknown host, token expiry, impersonation rules, SuperAdmin separation, profile and global Ctrl+K search. Check source-of-truth company name, logo, TRN, locale and permissions. Explicit unauthorized API 401/403; two-tenant IDOR. Cross-tenant print/download/token/caches and data index isolation.

**B — Sales/POS.** Sale and draft, customer selection, barcode/SKU search, weighted/carton/PCS unit conversions, last customer-product price, tax, discounts, mixed/split payment, cash/credit, hold/resume, void/return/refund, payment links, invoice print/email/preview, date/branch/route. Real persistence and correct end-of-day cash movement. Test duplicate saves, stale stock, fail/retry, offline, credit due date, approved revisions.

**C — Purchases/Suppliers.** Purchase list/filters/metrics -> supplier create/edit/deactivation -> focused purchase create/edit -> product search/dropdown -> item rows, negative-stock replenishment, qty/unit/cost/VAT/ITC/discount -> cash vs credit -> save -> supplier ledger balance -> pay single or allocate -> refunds/credits/returns -> report -> print/export. On a purchase form at 1440, list should not continue as an unrelated giant panel under Save. Verify all status filters and period/custom start/end. Filter chips/tabs and query strings must correspond to server-filtered rows. Test finance figure reconciliation incl credit adjustments.

**D — Customers / Ledger / Collections.** Add/edit/deactivate/merge only if approved, phone/name/duplicates, credit limit, invoices, aging/outstanding/overdue, payment receipt/allocations, statements/PDF/CSV, ledger running balance, multi-branch/route filters. Ensure a credit (`Cr`) customer is not wrongly classified as overdue merely because of a legacy balance. Distinguish opening balances and invoice history.

**E — Inventory / Products.** Product/price list/category/barcode/import/export, product detail, image absence, view/edit, deactivate/reactivate, stock adjustment, adjustment ledger, negative quantities, lot/expiry if present, unit conversion, barcode print and batch, import validation/duplicate and partial rollback, branch/route stock and purchase/sale/return stock effects. Compact buttons; canonical product data and business rules; no client-side-only stock edits.

**F — Branches/Routes/Maps.** Branch create/edit/disable; route create/edit/delete-if-safe, assignment, transfer customers, per-branch staff, date-scoped KPIs, route performance/profit definitions, duplicate route display names/IDs. Route stops, collection sheets, visit statuses, recorded consented stop location and map pins. Test map permissions/empty/partial geocodes. Do not claim full route optimization or real-time GPS if only `StopLocationMap.jsx` and stored stop data exist. Add operational routing/map intelligence only via verified data and opt-in permissions.

**G — Payments/Receipts/Daily Close.** Cash/online/cheque lifecycle, pending->cleared->void, bulk partial retries, idempotency, allocations across bills, receipt snapshots and batch print, accurate ledger write-back. Daily opening, manual capital/cash transfer/drawer->bank, expense outflow, cash/card/bank splits, saved draft, close/reopen with variance reason, historical snapshot and role guards. Page-entry shortcut present where appropriate; no silent auto-closing or unauthorized audit edits.

**H — Delivery Notes / Quotations / Returns / Credit Notes / Documents.** Invoice-based DN records; view, supported edit/cancel if business allows, search, date, export and print A4/A5. Quotations draft/edit/version/convert, agreements, salary certificates, return invoice search -> partial/full quantities -> stock condition -> VAT/refund/credit note. Document print statuses and all supported toolbars must function; unavailable feature is an explicit state not a fake button.

**I — Expenses / Reporting / VAT.** Expenses create/edit, VAT eligibility, period/branch/category, pending/approved, export/print, account balances. Reports Sales/Outstanding/Aging/PL/stock/returns/tax: date, grouping, sorting, pagination, empty and errors; mismatch reconciliation across screen, API and Excel/PDF. Historical aging excludes future postings. UAE VAT is authoritative backend math with accountant approval where needed; do not conflate custom profit-based management estimates with statutory Form 201 fields. Verify edge cases of credit notes, exempt/zero-rated, ITC, rounding and locked periods.

**J — Settings/Admin/SaaS.** All Settings subtabs (company print identity, tax, roles, numbering, integrations, safety and flags), Users staff edit/reset/disable, audit and backups, PWA install/privacy/offline, usage/performance, SuperAdmin companies/invitations/billing/keys/health/error logs/search. Never let ordinary tenant roles reach SuperAdmin SQL-console or cross-tenant data. Internal tenant role boundaries require backend tests, not client JSX checks.

**K — AI/Voice/Automation (only after P0/P1 gates).** Inventory existing stubs. Implement secure backend tool registry first, role-checked read-only answer with source evidence, clear tenant quota/cost/provider controls. Then opt-in multilingual push-to-talk for Malayalam/English/Hindi/Arabic with transcript confirmation and text fallback. Voice-created draft uses form preview and human approval, idempotent transactional post. Avoid surveillance and customer audio storage without consent. Provider down/429/invalid key/paid usage blocked explicitly. Route intelligence and notifications grounded in real backend. Any item not built remains explicitly NOT IMPLEMENTED rather than a misleading live UI.

## 6 — FINANCIAL & SECURITY FIXES: NON-NEGOTIABLE BEFORE RELEASE

**Accounting tests must include:**
- Purchase amount/tax/discount/paid/outstanding equations with ledger credits and prior adjustments. Never "fix" an apparent $4,146.75 difference by blindly editing finance data; reconcile item by item.
- Dates: all time, today, last week/month/custom, UTC/local timezone, start=end, start>end, future transactions, leap day, DST if relevant; export and summary use same applied range, no stale URL state.
- Aging: as-of cutoff prevents future invoices and future allocations; 0–30, 31–60, 61–90, >90 correctly sorted by overdue vs invoice dates per agreed definition. Text, count, amount and export match.
- VAT: 5% when configured, zero/exempt semantics, returns/credit notes/negative corrections, inclusive/exclusive, integer cents/decimal type (no float arithmetic drift), statutory boxes preserved, approved profit estimate visually separate.
- Discounts, rounding, refund, stock decrement/increment, total-to-ledger reconciliation, partial and overpayment rules, canceled/void documents, cheque pending vs cleared.
- Audit: create/update/deactivate/reverse/migrate retain old/new identities, initiator, tenant, server timestamps and correlation IDs.
- No data-dependent frontend hidden actions used as security. Test GET+POST+PUT+PATCH+DELETE and export/PDF endpoints under Owner, Admin, Manager, Staff and unrelated tenant. 401/403/404 per established convention and consistent error messages.
- Database transaction and idempotency for invoice/payment/purchase/expense/return, safe retries, concurrency, real HTTP readback, not only React state assertion. Screen and ledger update after refresh and at second login.
- Address 300 requests/min shared-IP rate-limit problem by evaluating rate-limit partition per authenticated tenant/user/action without weakening anti-abuse protection; tests shouldn't lock real clients out. Use test identity/quota environments, never suppress checks in production.

For historical ledger and VAT logic that requires accountant choice, isolate behavior behind tested feature/policy and mark release BLOCKED until approved; do not invent tax/compliance rules.

## 7 — PRINT, DOWNLOAD, PDF, EXCEL & BARCODE VALIDATION

Use `docs/production/PRINT-SPECIFICATION.md` as the starting authority. Inventory actual API PDF/document builders, `PrintOptionsModal`, receipt snapshots, letterhead service, tenant configuration and all document types. Build a **document-family × tenant × size × edge-state** matrix, with saved server data -> preview -> print -> browser-to-PDF/download -> parsed PDF assertions -> visual raster checks.

Families: sales/tax invoice, A4, A5, 80/58mm thermal where supported, combined receipts, purchase vouchers, delivery note, customer/supplier statements and ledgers, pending bills, aging/PL/worksheet, VAT management, credit note/returns, quotations, agreements, salary certificate, expense register, daily cash close, stock/barcode labels. Explicitly label unsupported combinations; do not fabricate a working button.

Required print details: tenant-authenticated identity only; long English name/Arabic RTL, centered client BW logo if available, exact configured TRN or omission (never fabricated), actual legal name/contact, proper report date, invoice number, lines/qty/units/VAT/totals/discounts, signatures/terms, repeated column header on new page, page X/Y, 0/1/20/50/100 lines, no clipping, orphan rows, 2-page blank padding, black-and-white ink efficiency, Arabic glyphs, PDF vs screen/Excel sums. Test download vs print letterhead distinctions and popup blocked behavior. Golden diff from existing correct client docs; freeze client-specific differences (FrozenHub requested header-only change) instead of unnecessarily redesigning every invoice.

**Privacy gate:** No wrong-company headers, Starplus leakage, foreign TRNs/logo or staff data across tenants. Print preview must be role/tenant scoped, and historical snapshots should preserve original legally relevant business identity as the product's rules require. Never rewrite past PDF content to hide a defect without an approved historical policy.

## 8 — AI, VOICE, MAPS: ACTUAL, SAFE DELIVERY CRITERIA

The snapshot's `docs/plan/AI-ERP-TASK-TRACKER.md` marks AI-01..04, VOICE-01..03, MAP-01..02 as TODO, even though `components/StopLocationMap.jsx`, routes and provider catalog exist. Audit real handlers and return meaningful implementation status first; do not claim completed merely because a menu or icon exists.

**AI assistant foundation:** authorized backend tool calls such as sales summary, customer balance, low stock, purchases/expenses, route status, VAT summary, with typed inputs, server user/tenant validation, source ID and as-of date. Bounded search, prompt injection refusal/handling, no raw SQL execution, previews for drafts, explicit confirmation to post. Tenant-controlled key and provider model options must obey official policy and privacy terms. Model errors and cost/latency visible to admin. Use deterministic reports if no approved LLM budget; never fake LLM outputs or expose provider keys client-side.

**Voice:** opt-in mic, STT transcript displayed in language, source/uncertainty and corrections, English/Malayalam/Hindi/Arabic numeric/currency/date handling, consent and audio retention, rate limit and costs, provider outage text fallback. Realtime voice only when hosted infrastructure and approved provider support it; no pretend always-on call agent in a Vercel page.

**Maps/Routes:** existing stop location map, saved pins, dates, route assignment and visit capture verified first. Clearly distinguish current static pins from driver GPS tracking (opt-in), and from optimization (not assumed). Confirm map tile usage permissions and offline behavior; don't quietly send customer addresses to unapproved map providers. Route/map buttons tested on mobile and desktop with empty/no permission/no GPS cases.

**Automation:** opt-in overdue drafts, low stock alerts, daily summaries and collection reminders only after data/permission/quiet-hour/tenant and dedupe gates. All outbound communication drafts need permission/approval as product policy specifies; record send IDs and idempotent retries.

## 9 — E2E TEST MATRIX: NOT JUST A SCREENSHOT SWEEP

**Sizes:** mobile 360×800, 390×844; tablet 768×1024 and 1024×768; desktop 1280, 1440×900 and 1920×1080; include 200% zoom, long company/product names, Arabic/RTL where relevant, focus navigation and real touch/keyboard interactions where possible.

**Data:** dedicated throwaway tenant DB on **PostgreSQL**, realistic long lists (0/1/30/500+/1000 where performant), empty state, legacy imported/opening balances, repeated similar customer/supplier/product names, special punctuation, zero price, missing image, duplicate invoice numbers, negative stock, partial payments, credit notes and zero/5% VAT cases. Seed through explicit fixtures; cleanup own test data in disposable DB. Do NOT exhaust real tenant receivables or repeatedly log in with invalid passwords, causing 15-minute lockout.

**Every action:** visible, enabled for role, correctly labeled, keyboard reachable, correct click/route/form, required validation, API call result, DB/readback, no duplicate POST, UI after refresh, back/forward URL query, error/retry, audit log, no console error/5xx. Negative-path tests are mandatory. Don't mutate client production data or use a live user's invoice just to get a green test.

**Full suite release gate:** backend build+unit+integration including PG-only; frontend lint/build+unit; Playwright all 5 core viewports, plus print, auth, permissions and four synthetic tenants. No unexplained skips, no use of `test.skip` for failing critical cases, no cherry-picked passing runs. Test failures due to external blocked calls are marked BLOCKED with network evidence; never reported as PASS.

**Browser work:** use the actual available Chrome/Edge dev browser or Playwright against disposable DB, inspect DOM computed geometry and screenshots, click every element. The user's screenshots are design/audit references, not code tests. For every release-ready route, at least a populated-state and key workflow pass. If tool access/credentials aren't available, record exact block and continue local work.

**Regression checklist on each financial save:** source form -> backend persisted -> account ledger -> stock/report -> receipt or invoice PDF -> tenant isolation -> second-user refresh.

## 10 — TENANT-SPECIFIC ACCEPTANCE: EXACT IDENTITY, NOT GUESSING

User targets four existing real client experiences: **Gulf Harvest, FrozenHub1, FrozenHub2 and Zayogya** as referenced in project history; the actual platform may contain additional tenants, and the fourth target's verified IDs/domains must be discovered from the **trusted tenant registry**. Never equate legal-name/TRN similarity with the same tenant. Zayogya is historically **read-only** for production testing; preserve that constraint unless explicitly changed by the owner. The snapshot also mentions an observed seven-tenant platform and uncertainty around four shown; resolve with facts, not fabricated records.

For **each DISTINCT verified tenant ID / host** record:
- Host, login branding/owner account identity and role checked by authenticated request (store no secrets), authorized navigation/feature flags.
- Pre-deploy **read-only** baseline: sample invoice/document reference (masked), company header/TRN/logo, ledger/stock/VAT totals (masked/safely recorded), and API `/health`/deployed SHA.
- Staging full workflows on **matching synthetic tenant data**; compare differences in invoice styling, price/unit/tax/permissions, stock, cash, receipt and role conditions.
- Production **READ-ONLY** smoke after approved release: real browser login performed by owner securely, route list, visible records, filters, details, preview/export where non-mutating, PDF tenant identity, date range, error/network/console, after vs before totals unchanged, logout/cleared session. No changing client live balances, no fake purchase/payment/sale, no deletion, no unauthorized staff changes.
- If owner later explicitly approves tagged production test writes for a specific tenant, use separate runbook with scope, reference records, financial side effects, idempotency, audit and expected permanent document sequence gaps; otherwise run all writes on isolated staging. Never use Zayogya write testing without its own explicit authorization.

Map each tenant feature to `PASS / FAIL / NOT TESTED / BLOCKED`, with exact URL/test/build SHA and artifact, not a blanket "all four validated".

## 11 — SAFE RELEASE / ROLLBACK GATES

**Stages, in order:**
1. **LOCAL:** code + unit + integration + browser on disposable PostgreSQL tenants, audited data and source. Local commits allowed, no push.
2. **STAGING:** deploy only to approved staging with isolated test data; migration rehearsal, backup restore verification, full route/tenant workflows and PDFs; approvals where required for use of staging credentials/infrastructure.
3. **RELEASE CANDIDATE:** review diff and secrets; no customer assets or migrations silently deleted; track all unresolved P0/P1. Check production branches, actual Vercel/Render linkage, auto-deploy triggers, migration safety, compatibility of backend/frontend and flags. Record current production SHA/deploy/backup and rollback target.
4. **EXPLICIT OWNER APPROVAL REQUIRED** before *each environment-specific consequential production action*: pushing/merging main if it auto-deploys, applying production migrations, deploying backend/frontend, enabling tenant feature flags, production data changes or paid AI providers. Do not infer approval from a historical Git push or this generic goal file. Ask once with concise go/no-go package when all gates pass.
5. **CONTROLLED DEPLOY when approved:** verified backup + restore rehearsal + non-destructive schema migration copy test; feature flags OFF; backend/Render health and deployed SHA, frontend/Vercel deployment and SHA, smoke all trusted hosts, read-only per-tenant invoice/ledger/VAT/print comparison, monitor 4xx/5xx/login/financial issues and be prepared to rollback. Preserve audit logs and compatibility.

If permissions/browser/infrastructure unavailable, state BLOCKED. Do not claim live validation or a production deploy if only a local pass was done. An elapsed agent runtime is not evidence of completion.

## 12 — RESUMABLE, LOW-WASTE EXECUTION LOOP

```
FOREVER until all approved local tasks are terminal:
  READ execution-state (not the full chat)
  CHOOSE highest impact unblocked task: Security/Finance > Broken action > Print > UX > AI
  REPRODUCE with exact source path, test case and real API response
  CONFIRM root cause and scope; add a failing regression test if feasible
  FIX smallest coherent component/service, preserving existing semantics
  RUN focused tests + check no cross-tenant/financial regression
  CHECK responsive and keyboard behavior for touched page
  UPDATE interaction matrix, defect register, tracker, evidence paths
  COMMIT locally once green
  PROCEED to next independent task without asking “continue”
  IF 2 similar failures without progress: investigate cause; don't blindly loop
  IF approaching context/usage limit: flush STATE and next exact command

AT MILESTONE: Run broader FE/BE/PG/E2E suite + report honest totals
AT RELEASE GATE: Stop for owner authorization before prod actions.
```

The user wants **one pass to completion of all safely executable work**. “Don't stop for routine approvals” does not mean infinite re-running tests or bypassing security, paid-services or deployment approval. If blocked on one policy decision, work on other approved independent tasks.

**Use short runtime messages:** `CURRENT ID | FILES | BEFORE/AFTER | TEST/COMMAND | PASS/FAIL/BLOCKED | NEXT`, updated after meaningful milestones; do not emit repetitive progress every minute. Token optimization: targeted inspections and affected specs first; full suite only at gates.

## 13 — DETAILED PRODUCT DECISION HANDLING

| Question | Default approved for LOCAL changes | Must not do without extra approval |
|---|---|---|
| Staff deactivation (ST-01) | Design/test tenant-scoped disable + revoke active sessions while retaining audit attribution | Destroy historical records, change access policy across live tenants |
| Historical aging (AG-02) | Exclude future-dated invoices, void/refund per tested accounting contract; preserve statements | Change statutory period/accounting rules silently |
| Staff sensitive reports/payment create (RP-04/PY-09) | Deny sensitive APIs unless explicit least-privilege server permission; add role matrix | Turn staff into implicit Admin; silently disable legitimate collections without reconciliation |
| POS Cash/Credit (PS-05) | Fresh Cash; clear UI selection for Credit; reset 'New invoice' consistently | Change previously finalized invoices |
| Receipt snapshot (RC-04/06) | Add safe local tests and planning; new receipt snapshot behavior behind tested feature path | Bulk enable flags/rewrite legacy receipts in production |
| Expense top area (UX-E01) | Compact useful summary and filters; first row appears reasonably early | Hide VAT/balance totals only to hit arbitrary 35% |
| Aging Excel (AG-03) | Implement filter-accurate, secure XLSX and verify sum/format | Fake Excel/CSV silently mislabeled |
| Raw buttons (UX-S04) | Migrate high-use module by module | Huge 948-button one-shot refactor that breaks paths |
| Route duplicate names | Display ID/branch context, verify separate records | Merge/delete route identities from name equality |
| Wrong supplier totals | Itemized reconciliation incl ledger credits | Patch total by arbitrary subtraction |
| PWA/AI/Map partially implemented | Clearly mark planned capability, implement realistic milestones | Turn placeholder on in production as if complete |

## 14 — FINAL ACCEPTANCE: NO MORE "DONE" WITHOUT PROOF

Only use **READY FOR RELEASE** when:
- All P0/P1 critical issues closed or accepted by written owner decision with mitigation; financial calculations reconciled.
- Every accessible route and each significant tab/sub-tab/control inventoried; every core action has an E2E path and persisted backend check; incomplete/noncritical features honestly labelled/disabled instead of dummy work.
- High-density design passes responsive, zoom and keyboard audit, no clipped menu/hidden row actions/overlay errors, no generic unsupported widgets.
- Full frontend/backend/PostgreSQL integration/Playwright tests pass with **actual totals and zero unexplained critical skips**; reproducible flaky tests resolved, no production-rate-limit lockout.
- Four verified target tenants covered with separate trusted IDs and staging behavior, correct business-specific print identity, UAE VAT/statements/receipts, and Zayogya production data preserved unchanged.
- Backup/restore, migration copy proof, staged release and rollback ready. Owner receives a concise approval request for any required production action.
- AI, maps, voice only marked DONE when the backend, privacy rules, authentication, provider and real user experience all work; otherwise they are clearly phase-blocked, with no false completion.

**Final report format:**
```
BASELINE & FINAL LOCAL SHAs:
CLIENT IDs/HOSTS VERIFIED (MASKED):
MODULE/ROUTE/SUBTAB TOTALS (DISCOVERED / VERIFIED / BLOCKED):
FUNCTIONAL UX CHANGES WITH BEFORE/AFTER EVIDENCE:
FINANCE/SECURITY INVARIANTS VERIFIED:
PRINT FAMILY × TENANT × SIZE RESULTS:
AI/MAP/VOICE: IMPLEMENTED vs NOT IMPLEMENTED:
BACKEND TESTS (pass/fail/skip):
POSTGRES TESTS (pass/fail/skip):
FRONTEND UNIT/LINT/BUILD:
PLAYWRIGHT VIEWPORTS AND ROUTE/WORKFLOW RESULTS:
UNRESOLVED DEFECTS + SEVERITY + REAL BLOCKER:
GIT STATUS / LOCAL COMMITS / REMOTE PUSH STATUS:
STAGING DEPLOY (if approved):
PROD DEPLOY (if separately approved):
4 REAL TENANT LIVE READ-ONLY CHECKS (only if authorized and accessed):
ROLLBACK REFERENCES:
READY FOR PROD APPROVAL? YES/NO + WHY:
NEXT PRECISE ACTION:
```

**START NOW WITH THE EXISTING LOCAL CHECKOUT. DO NOT STOP AT A PLAN; DO NOT REPEAT COMPLETED WORK; DO NOT CLAIM UNTESTED OR UNDEPLOYED WORK COMPLETE.**
