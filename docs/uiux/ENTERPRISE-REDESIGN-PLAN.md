# Enterprise UX redesign plan (tablet-first)

> **Scope change (owner, 2026-11-07): the app stays English-only. No Arabic translation, no RTL work, no bilingual printing in this programme. Only UI/UX fixes on the current ERP. Every Arabic/RTL item below is CANCELLED and kept only as history.**

Status: PLAN ONLY. No screen has been redesigned under this plan yet. Written 2026-11-07 from the checked-out code, not from chat history.

Authority and scope rules
- Design-system authority stays [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md). This plan extends it; it does not add a second palette, a second component set, or a new tracker. Work items are tracked in [PREMIUM-UX-TRACKER.md](PREMIUM-UX-TRACKER.md) and [COVERAGE-MATRIX.md](COVERAGE-MATRIX.md).
- Visual and layout changes only. Do not touch financial calculations, API contracts, tenant scoping, VAT, ledger, stock or payment logic. Every PR is reviewed with `git diff` to prove no `.js`/service/calculation file changed except presentation helpers.
- One screen (or one small group) per change. Each is verified in a real browser at the five viewports before the next starts.
- No push or deploy without separate approval (CLAUDE.md rule 10).

## 1. What exists today (verified in code)

- Stack: React 18 + Vite 5 + Tailwind 3, `lucide-react`, `react-hook-form`, `recharts`, `leaflet`. No UI kit dependency.
- Tokens: `src/styles/tokens.css` and `tailwind.config.js` (type scale 28/24/20/16/14/12, 8-pt spacing, z-index scale, one blue primary, status trios).
- Shared components (`src/components/ui`, 27 files): Button, Input, Card, StatCard, Badge, Alert, ModernTable, TableSkeleton, CardSkeleton, EmptyState, ErrorState, DisabledState, SuccessFeedback, PageHeader, TabNavigation, FilterPanel, OverflowMenu, SearchableSelect, DateField, DateRangeFilter, ReportSwitcher, ViewToggle, ProgressBar, AppToaster, BackLink.
- Dev showcase `/__design` with `e2e/design-system.spec.js` (LTR + RTL, five viewports).
- Playwright projects: m360, m390, t768, d1024, d1440 (`playwright.config.js`, Edge channel).
- Existing UX programme: DESIGN-SYSTEM, UI-AUDIT, PREMIUM-UX-TRACKER, UIUX-ISSUE-REGISTER, RESPONSIVE-TESTS, COVERAGE-MATRIX, PAGE-INVENTORY.
- Shell: top bar + bottom nav below 768 px; 80 px icon rail at 768-1023 px; 240 px sidebar from 1024 px (`Layout.jsx`).

So the problem is not a missing design system. The problem is adoption (below).

## 2. Measured drift (regex scan of 75 page files over 60 lines, 2026-11-07)

These are counts of source patterns, a proxy for inconsistency, not a visual verdict.

| Signal | Count | Reading |
|---|---|---|
| Raw `<button>` vs shared `<Button>` | 934 vs 25 | The shared Button is almost unused. Hover/focus/disabled/loading states are re-implemented per page. |
| Raw `<table>` vs `<ModernTable>` | 88 vs 4 | Tables are hand-built. Biggest: ReportsPage 15, VatReturnPage 7, Branch/Route detail 5 each, CustomerLedger 5. |
| Raw input/select/textarea vs shared inputs | 460 vs 163 | Mixed form look and validation display. |
| Hard-coded hex colours | 242 | BackupPage 77, PosEnterprise 39, ReportsPage 33, PosLegacy 30, Login 23. Bypasses tokens and dark/brand changes. |
| Arbitrary pixel utilities (`w-[..px]`, `text-[..px]`) | 429 | CustomerLedger 42, Purchases 29, Assistant 28, Payments 26. Breaks the type/spacing scale. |
| Physical direction classes (`ml-`, `pr-`, `text-left`, `left-`...) vs logical (`ms-`, `pe-`, `text-start`...) | 580 vs 10 | **RTL is the largest structural gap.** `dir` is set globally in `main.jsx` and the shared components are RTL-tested, but page bodies are almost entirely physical-direction, so Arabic layouts will mirror incorrectly (padding, icons, table alignment, sticky columns). Settings 53, Reports 48, CustomerLedger 39, Users 35. |
| Gradients / heavy shadows / `animate-*` | 21 / 61 / 67 | Candidates to remove under "no decoration". Needs a per-site look; some are legitimate (skeleton, sheet open). |
| Money alignment (`tabular-nums`/mono) | 217 uses | Partly applied; see MONEY-COLOUR-ROLLOUT.md for the agreed rule. |
| Pages over 300 lines with no `EmptyState`/`ErrorState` component | 44 of 75 | Many have inline empty text instead. Not necessarily missing, but inconsistent wording and layout. Verify per page. |

Largest files (the highest redesign risk): CustomerLedger 5.8k lines, PosEnterprise 4.3k, PosLegacy 4.0k, Reports 3.9k, Expenses 2.5k, SuperAdminTenantDetail 2.5k, Settings 2.1k, SalesLedger 2.0k.

Already fixed in the performance pass (do not redo): skeletons on 7 list/detail pages, self-hosted fonts, lazy images, parallel fetches.

## 3. Design direction (decisions)

1. **Keep one identity.** Blue primary, neutral surfaces, ERP density, border-not-shadow cards. This matches the design-system lock and the brief's "no gradients, no oversized cards".
2. **Use the Anthropic `frontend-design` skill as a critique checklist, not a re-brand.** It is installed at `.claude/skills/frontend-design` (copied from github.com/anthropics/skills at commit 2c5958e, with `webapp-testing`). Its anti-template guidance is applied as: no identical rounded-card grids for data, no decorative gradient washes, no all-caps eyebrow labels on every heading, no motion that is not an answer to a user action, structure (borders/dividers/numbering) only where it encodes information. Its instruction to take "aesthetic risk" and invent a new palette conflicts with the locked ERP identity and is deliberately NOT followed.
3. **Information hierarchy for operations:** page title + one primary action; filters collapsed behind one toggle; the record list or form is the first thing under the header; totals and status are visible without scrolling.
4. **Tablet-first.** Design the 768x1024 and 1024x768 layouts first (touch + dense data), then scale down to phone cards and up to desktop. Touch targets 44 px on touch, 32-36 px compact on desktop (existing rule). Landscape tablet (1024x768) is the primary working surface for POS, ledger and reports.
5. **Reference products (general knowledge, not fresh research):** SAP Fiori (list report + object page, responsive table pop-in), Odoo (list/kanban/form view switch, breadcrumb control panel), Zoho Books / QuickBooks (invoice-first workflows, status chips, right-aligned tabular money), Microsoft Dynamics 365 / Fluent (command bar, side drawers), Xero (reconcile-style dense tables with clear running totals). Patterns taken: command bar + filter drawer, status chips, sticky totals, row-density toggle, object page with tabs.

## 4. Design-system additions (small, reusable, built once)

Add only what pages repeatedly hand-build. Each gets a `/__design` showcase entry and an RTL + 5-viewport test before any page adopts it.

| Component | Replaces | Notes |
|---|---|---|
| `PageToolbar` (title, one primary action, overflow, filter toggle) | per-page headers | wraps existing `PageHeader` + `FilterPanel`; single tablet behaviour |
| `DataTable` (extend `ModernTable`): sticky header, sticky first/last column in logical sides, right-aligned money, density toggle, row-select, empty/error/loading slots, card mode < 768 | 88 raw tables | RTL-safe via `ps/pe/text-start/end` |
| `MoneyCell` / `Amount` | ad-hoc `toFixed` + colour classes | display only; takes an already-computed number, never calculates |
| `StatusBadge` map (Paid/Partial/Unpaid/Overdue/Draft/Void) | per-page colour logic | one colour map, text + icon not colour alone |
| `FormSection` + `FieldRow` | per-page form grids | 2-col from 768, 1-col below; error under field |
| `StickyTotalsBar` | per-page footers | for invoices, ledger, VAT |
| `DocumentSheet` (print/preview frame) | per-document wrappers | invoices, quotations, certificates; A4 preview + print rules |
| `ConfirmDialog` | ad-hoc modals | one destructive-action pattern |
| ESLint rule (warn) | n/a | warn on raw `<button>`, hex colours, `ml-/mr-/pl-/pr-` in `src/features` to stop drift |

State coverage required for every adopted component: loading (skeleton matching layout), empty (reason + next action), error (reason + retry), success (toast/inline), disabled (reason shown). Already present: EmptyState, ErrorState, DisabledState, SuccessFeedback.

## 5. RTL (Arabic) programme: CANCELLED (English only)

1. Codemod (reviewed, not blind) physical -> logical utilities: `ml/mr` -> `ms/me`, `pl/pr` -> `ps/pe`, `text-left/right` -> `text-start/end`, `left-/right-` -> `start-/end-`, `border-l/r`, `rounded-l/r`. Tailwind 3.3+ supports these. 580 sites; do per page, screenshot LTR before/after to prove LTR is unchanged.
2. Icons that imply direction (chevrons, arrows, back links) flip in RTL (`rtl:rotate-180` or mirrored icon).
3. Numbers and dates stay LTR inside RTL text (`dir="ltr"` on money cells, phone numbers, invoice numbers); tabular figures.
4. Bilingual fields (name/nameAr) render with correct `dir` per field (already done on a few detail pages).
5. Test: extend `e2e/design-system.spec.js` pattern to a route-level RTL sweep (set `lang=ar`, no horizontal overflow, sticky columns on the correct side).

Dependency to confirm first: how a tenant/user selects Arabic today (`main.jsx` reads a language value). Only Login, Signup and App use translation; most pages have English-only strings, so "RTL" for pages means layout mirroring plus Arabic data, not full UI translation. That is a separate i18n decision for the owner.

## 6. Page inventory and order

Source of truth for routes: `src/app/App.jsx` (89 `<Route>` entries, 62 unique paths; the rest are aliases/duplicates for role variants). Order is by daily use x tablet exposure x risk. "Pilot" screens prove the system before volume work.

| Wave | Screens | Why first |
|---|---|---|
| 0 Foundation | tokens audit, `DataTable`/`PageToolbar`/`StatusBadge`/`MoneyCell`/`FormSection`/`ConfirmDialog`, lint warnings, `/__design` + tests | nothing else starts until these pass 5 viewports + RTL |
| 1 Pilot | Customers list, Payments list (both already server-paged, skeletons done, ~1.6k lines) | small, high-traffic, safe to verify |
| 2 Money lists | Sales Ledger, Billing History, Expenses, Purchases, Suppliers, Pending Bills | all share the DataTable + filter pattern |
| 3 Detail/object pages | Customer detail, Supplier detail, Product detail, Branch/Route detail | object-page pattern with tabs |
| 4 Ledger | Customer Ledger (5.8k lines): split into tab components first, then restyle | highest value, highest risk; refactor and redesign in separate PRs |
| 5 Reports/VAT | Reports (15 raw tables), VAT Return, Worksheet, Outstanding, Daily Close | readable financial tables; print rules must not change |
| 6 Forms/documents | Quotation/Agreement/Salary-certificate editors, Returns, Product form, Settings | FormSection + DocumentSheet |
| 7 POS | PosEnterprise (+ retire PosLegacy if unused) | touch-first; last because it is the most business-critical |
| 8 Admin | Users, Audit, Backup (77 hex colours), Profile, Subscription, Help/Feedback, More | consistency sweep |
| 9 Platform | SuperAdmin pages (10) | lowest priority; same tokens |
| 10 Public | Login, Signup, Onboarding | already reasonably clean |

Per-screen deliverable: before/after screenshots at m390, t768, d1024, d1440 (+ RTL at t768), a diff showing only presentation files changed, test run output, tracker row updated.

## 7. Verification protocol (evidence, not assumption)

Environment that already works (see `hexabill-local-qa-harness` notes): local PostgreSQL cluster on port 55481, synthetic tenants (`gulfharvest-test`, `frozenhub1-test`, ...), runner `scripts/run-customer-save-qa.ps1`, Edge channel. Set `HEXABILL_E2E_SLUG` and the matching `HEXABILL_E2E_EMAIL_<SLUG_UPPER>` (underscores) or logins fail with 400 then lock out for 15 minutes.

Per screen:
1. `npm test` (unit) and `vite build`.
2. Route smoke at five viewports: no console/page errors, no horizontal overflow, no stuck skeleton (`e2e/perf-pages-smoke.spec.js` is the base; extend to m360, d1024).
3. Screen-specific interaction spec (existing where present, e.g. customers-ledger, billing-history, expenses-states).
4. RTL pass at t768.
5. Money check: a before/after DOM text comparison of every amount on the screen proves no calculation or formatting regression.
6. Screenshot review by a human (owner) for taste; automated checks cannot judge design quality.

Known gaps in evidence so far: tests run on a small synthetic dataset (no hundreds-of-rows lists), no real phone keyboard or touch gestures, Arabic only on the shared components.

## 8. Risks

- Giant single-file pages: restyling without splitting invites regressions. Split first (separate PR), restyle second.
- `PosPageLegacy.jsx` duplicates `PosEnterprisePage.jsx`: confirm which is routed before touching either.
- Print/PDF CSS (`@media print`) is global; any change to shared classes must be re-checked on invoice, VAT and statement prints.
- Owner-supplied reference screenshots in `HEXABILL IMAGES UI/` are old; findings from them stay TODO until re-verified.
- Regex metrics overcount (e.g. a hex colour in a print template string is legitimate); verify each site before replacing.

## 9. Open decisions for the owner

1. Is full Arabic UI translation in scope, or layout mirroring plus bilingual data only?
2. Confirm primary tablet target: 768x1024 portrait, 1024x768 landscape, or both equal.
3. Which pilot screens to start with (suggested: Customers + Payments lists).
4. Is `PosPageLegacy` still reachable in production?
