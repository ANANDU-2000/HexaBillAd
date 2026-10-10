# UI Task Tracker

The work runs in three stages:

1. **Stage 1, design system.** Tokens, shared components, docs. Status: PASS for the shared layer (2026-10-10).
2. **Stage 2, apply it to every page.** Module by module.
3. **Stage 3, real UX testing.** Workflows, touch, scrolling, keyboard, loading, tenant branding.

Status values are TODO, IN_PROGRESS, PASS, FAIL and BLOCKED. No row moves to PASS without evidence: a spec name, a screenshot or command output.

References:
- Design rules: [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)
- Audit findings (UI-0xx): [UI-AUDIT.md](UI-AUDIT.md)
- Test runs: [RESPONSIVE-TESTS.md](RESPONSIVE-TESTS.md)

This tracker supersedes T-030 (responsive pass) and T-040 (Playwright) in [../production/TASK-TRACKER.md](../production/TASK-TRACKER.md).

## Foundations already in place (phases 0–2)

| ID | Task | Status | Evidence |
|---|---|---|---|
| P0-1 | Inventory and audit documents (`docs/uiux/*`) | PASS | This folder |
| P0-2 | Playwright runner (`@playwright/test` 1.64, system Edge, 5 viewports) | PASS | `playwright.config.js` |
| P0-3 | Route sweep spec: 36 routes × 5 viewports | PASS | 180/180 for gulfharvest on 2026-10-10 (see RESPONSIVE-TESTS.md). Fixed: `.env.local` path with spaces, 429 retry, login retry |
| P0-4 | Baseline bundle | PASS | Main chunk 601.7 kB (159.3 kB gzip) on 2026-10-10; BarChart 592 kB; PosPage 314 kB |
| P2-1 | Shell: single identity, white top bar, one account menu, 18/20px icons, 44px rail targets | IN_PROGRESS | Code done; visual check waits on P0-3 |
| P2-2 | Ctrl/Cmd+K palette, `/` search, `?` help | IN_PROGRESS | Code done |
| P2-3 | Modal shows as a bottom sheet on phones; unique title ids | PASS | `design-system.spec.js` dialog test, 5/5 viewports |
| P2-4 | Bottom nav: flat Sale pill, 11px labels | IN_PROGRESS | Code done |
| P2-5 | Branding copy: login footer, Help heading, alert title | PASS | login screenshots |
| P2-6 | Distinct sidebar icons | IN_PROGRESS | `moreMenuConfig.js`, tests 138/138 |
| P2-7 | SuperAdminLayout alignment (UI-024) | PASS | Header offset `left-72` → `left-60` to match the 240px sidebar |

## Stage 1: design system

| ID | Task | Status | Evidence |
|---|---|---|---|
| DS-1 | Semantic tokens: surfaces, text, status trios, accounting amounts, chart palette, icon sizes, z-index, motion, control heights. Mirrored in Tailwind (`success-fg`, `z-modal`, `text-micro`, `duration-panel`, `bg-tenant`) | PASS | `tokens.css`, `tailwind.config.js`; `vite build` OK |
| DS-2 | Remove the OS dark-mode auto-switch that made token-driven parts of the dashboard dark inside a light app; define `--info` (used by the dashboard but never defined) | PASS | `tokens.css`; DashboardTally is the only consumer |
| DS-3 | `.btn` / `.input` 40px desktop and 44px phone; `.btn-ghost`, `.btn-sm`, `.label`, `.field-help`, `.field-error`, `.skeleton`, `.kbd` | PASS | `index.css`; touch-target test |
| DS-4 | Form fields (`Form.jsx`, 21 importers): `rounded-xl` and shadow removed, 6px radius, neutral border, 44px on phones, token error colours | PASS | touch-target test 5/5 |
| DS-5 | Voucher classes (`tallyFormClasses.js`, 6 importers): lime 2px borders and blue-tinted sections replaced with neutral fields (UI-020) | PASS | code; visual check in Stage 2 E |
| DS-6 | New primitives: `PageHeader`, `Alert`, `ProgressBar`, `CardHeader` | PASS | `/__design`, specs |
| DS-7 | Reworked primitives: `Badge` (status trio, dot), `EmptyState` (Lucide icon, compact, neutral), `ErrorState`, `StatCard` (neutral, currency prop, never truncates amounts, meaning-based change colour), skeletons (`role=status`), `Card` | PASS | KPI-clipping test 5/5 |
| DS-8 | `ModernTable`: opt-in `mobileCards`, windowed pagination (it rendered every page button), null-safe numeric sort, `aria-sort`, row actions no longer trigger the row click, skeleton and empty states | PASS | table test 5/5 |
| DS-9 | `TabNavigation` stays on one scrollable row on phones with tab semantics; `MobileSheet` moves and restores focus and no longer re-runs its effect on every parent render; `Modal` title is an `<h2>`, close buttons labelled | PASS | sheet, dialog and tab tests 5/5 |
| DS-10 | Shell z-index values (`z-[9999]`, `z-[70]`) moved to the `z-*` scale | TODO | `Layout.jsx` |
| DS-11 | Remove `text-[9px]` / `text-[10px]` / `text-[13px]` | PASS | Token codemod: tiny sizes → `text-micro` (11px), 13px → `text-sm` |
| DS-12 | Enable dark theme once raw palette classes are gone | TODO | Blocked by Stage 2 |
| DS-13 | Tenant accent: `--tenant-brand` set from the validated `primaryColor` setting; app chrome stays HexaBill blue | PASS | `TenantBrandingContext.jsx`; `/__design` brand section |
| DS-14 | Dev-only reference page `/__design` and `e2e/design-system.spec.js` (7 checks × 5 viewports) | PASS | 35/35 passed; excluded from the production bundle |

## Stage 2: apply to every page

### Cross-cutting work (all modules)

| ID | Change | Status | Evidence |
|---|---|---|---|
| S2-1 | Token codemod across 90 page files (the script itself was not added to the repo):<br>• `blue-*` → `primary-*` (identical values)<br>• `gray-*` → `neutral-*`<br>• status shades that equal the token trio → `success`/`warning`/`error` tokens<br>• tiny text → `text-micro`<br>• `rounded-xl`/`2xl`/`3xl` → `rounded-lg`<br>It rewrites class tokens only and preserves line endings. | PASS | `vite build` OK; 180/180 sweep |
| S2-2 | Double-encoded UTF-8 in source (`â€“`, `Ã—`, `â€¦` …), 28 fixes in Dashboard, Expenses, Purchases and Returns (UI-015, UI-016); guard test `tests/sourceEncoding.test.js` | PASS | `npm test` 139/139 |
| S2-3 | Browser print (UI-025):<br>• shell never prints; page content prints on A4<br>• `.print-area` / VAT area prints alone<br>• fixed a specificity bug that would have blanked VAT printing | PASS | Print emulation on /reports, /vat-return, /customers |
| S2-4 | Phone touch-size floor (`index.css`): inputs/selects ≥44px, buttons/tabs ≥40px | PASS | Phone pages with undersized controls: Reports 31 → 0, POS 13 → 2, Ledger 3 → 0 |
| S2-5 | Duplicate page titles on phones: list routes hide their in-page h1 (kept for screen readers); detail pages keep theirs | PASS | Visual check at 390 |
| S2-6 | Tenant currency instead of hardcoded "AED": POS, discount popup, product drawers, Products, Quotations, invoice share text | PASS | Lint 0 errors; UX-6 |
| S2-7 | New `OverflowMenu` primitive (keyboard, Esc, stays on screen) | PASS | design-system spec 40/40 |
| S2-8 | `ModernTable` let absolutely positioned content escape its scroll box, which widened /products by 387px (a Stage 1 regression) | PASS | /products passes at 768 and 1024 |

### Per-module status

| Module | Done in this pass | Still open | Status |
|---|---|---|---|
| A. Dashboard | Mojibake in the date range (UI-016); tokens | Move KPI tiles to `StatCard` with `KpiSkeleton`; chart palette | IN_PROGRESS |
| B. Sales and POS | Billing History phone cards: View + Collect + More (was 5 buttons); tenant currency in POS; tokens; tiny text | POS VAT/Amount columns at 768 (UI-014): needs the line table to fit the 688px tablet width; the card view can't be reused because it opens phone-only sheets | IN_PROGRESS |
| C. Customers, ledger, payments | Customers phone cards rebuilt (UI-012); ledger "+" now labelled "Add customer" (UI-019); ledger filters 44px. **Add-customer form fixes:**<br>• blank credit limit (NaN) and blank email ("") were rejected by the API, so customers could only be added with both filled in<br>• the hidden branch and route rules are now shown with their errors | Ledger desktop action row (UI-019, desktop part) | IN_PROGRESS |
| D. Inventory | Products header: one primary + Import + More (Recompute and Reset stock moved there; Reset marked destructive); zero-stock banner uses `Alert`; /products overflow fixed | Price list at 360 (UI-013) | IN_PROGRESS |
| E. Purchases, suppliers, expenses | Expenses: presets on one row and a Filters toggle on phones; mojibake (UI-015); voucher fields neutral (UI-020 via DS-5) | Expense chart legend (UI-022) | IN_PROGRESS |
| F. VAT and reports | Print fixed (UI-025); report chips 44px on phones; tokens | Reports KPI tiles still pastel and coloured; Sales Trend says "No sales" while Total Sales shows 1,361.50 (a data question, see Decisions) | IN_PROGRESS |
| G. Documents, branches, routes | Tokens, tiny text, tenant currency in quotations | Empty states (UI-021) | IN_PROGRESS |
| H. Settings and company | Tokens | Settings save bar on phones (UI-023): the sweep passed but it was not exercised with interaction | IN_PROGRESS |
| I. SuperAdmin | Header offset (UI-024) | Not swept (needs a platform login) | IN_PROGRESS |
| J. Authentication | Tokens via codemod | Field primitives | IN_PROGRESS |

Checklist for each remaining page:
1. One primary action per view.
2. Use `PageHeader`, `ModernTable mobileCards`, the shared states and Form fields.
3. No raw palette classes left.
4. Run the route sweep at 5 widths.

## Stage 3: real UX testing

Run against local tenants (gulfharvest, frozenhub1, frozenhub2) only. Each create step is verified through the API response plus a re-fetch, not by screenshot alone. No backend financial logic changes.

| ID | Check | How | Status |
|---|---|---|---|
| UX-1 | Workflows end to end | `e2e/workflows.spec.js` | PARTIAL: create customer passes at all 5 widths (API re-fetch plus visible row). It found 3 real defects in the add-customer form, now fixed. Still to do: supplier, product, POS sale, purchase, expense, payment |
| UX-2 | Mobile touch | Route-sweep metrics (`HEXABILL_SWEEP_REPORT`) | PASS for the shared floor (S2-4). Remaining small targets are mostly inline text links (WCAG inline exception) |
| UX-3 | Scrolling | Route sweep: overflow check plus nested-scroll metric | PASS: 180/180 with no sideways scroll and 0 nested scroll traps. Scroll restore on back navigation not yet tested |
| UX-4 | Keyboard | `workflows.spec.js` UX-4; `design-system.spec.js` | PASS: Ctrl+K palette with search and Esc, `?` help, Ctrl+\ collapse, menu arrows and Esc, visible focus. POS keys and F-keys not yet tested |
| UX-5 | Loading: no blank screen on a slow network (throttle to 3G); skeletons match the final layout; data on screen stays visible while it refreshes | Playwright route throttling | TODO |
| UX-6 | Tenant branding and isolation | `workflows.spec.js` UX-6 | PASS: gulfharvest, frozenhub1 and frozenhub2 each show their own name and title and a valid `--tenant-brand`, with no other tenant's slug on the page; a frozenhub1 token is refused on frozenhub2 (401/403). Letterhead check not yet done |
| UX-7 | RTL: Arabic UI has no overflow and mirrored chevrons; Arabic names render inside English screens | `phase7-rtl-shell-smoke.mjs` plus the design-system RTL check | TODO |
| UX-8 | Accessibility: axe has no serious or critical issues per route | `@axe-core/playwright` in the sweep | TODO |

## Phase 4: platform

| Task | Status |
|---|---|
| PWA: PNG icons and a shell-only service worker (UI-026) | TODO |
| Lazy-load recharts and leaflet, then re-measure the bundle | TODO |
| Remove unused components (DeleteConfirmModal, SupplierLedgerModal, QuickActionsPanel, PendingBillsPanel) after a grep confirms no imports | TODO |

## Decisions

**2026-10-10, Stages 2–3:**
- Testing ran against a **copy** of the local `hexabill.db` in `%TEMP%\hexabill-uitest`, with generated test passwords in the gitignored `e2e/.env.local`. The original DB checksum was unchanged afterwards.
- The heartbeat `/api/users/me/ping` 5xx comes from local SQLite "database is locked". The sweep records it but does not fail on it, because production uses PostgreSQL.
- Dev-only backend issue found, not fixed (outside UI scope): the startup seeder can't see existing platform admins and inserts a duplicate `admin@hexabill.com` row on every Development start (11 rows in the local DB).
- Data question for the owner: on /reports, Total Sales shows 1,361.50 AED but the Sales Trend chart says "No sales in this date range" for the same range. Report logic was not changed.

**2026-10-10, Stage 1:**
- App chrome stays HexaBill blue for every tenant. The tenant colour is an identity accent only (contrast and status-meaning safety). See DESIGN-SYSTEM.md §18.
- Product is light-only until DS-12. Dark tokens are kept, but the OS auto-switch was removed.
- `ModernTable` card mode is opt-in (`mobileCards`), so existing pages don't change until their Stage 2 module adopts it.
- The `/__design` route exists only in dev builds and is intentionally left out of `docs/plan/ROUTE-MANIFEST.json`, which lists production routes.

**2026-10-10, earlier:**
- The desktop top bar shows no page title, because pages render their own `<h1>`. On mobile the shell shows the title, and in-page titles are hidden below md (`PageHeader` does this).
- Parallel work is split by module, not by device, so that no two sessions edit the same files.
- Playwright runs on the installed Edge (`channel: msedge`).
