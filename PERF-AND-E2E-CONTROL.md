# Performance, hang control, and end-to-end control

Save as `docs/uiux/PERF-AND-E2E-CONTROL.md`. It adds Phase P (performance) and the E2E gates to the UI/UX loop. The loop picks P-00 first, so a baseline exists before any UI change.

---

## 1. What makes HexaBill feel slow, stuck, or hung (found in the code)

| # | Cause | Where | Effect the user sees |
|---|---|---|---|
| S1 | POS reloads **all** product pages and customers every 60 s | `PosEnterprisePage.jsx` ~L530 (`loadAllProductPages`) | Stutter or freeze mid-billing on slow networks, battery drain on tablets |
| S2 | Customer Ledger pulls `pageSize:1000` customers, and the cash ledger pulls 1,000 sales + 1,000 payments, then merges them in the browser | `CustomerLedgerPage.jsx` ~L868, ~L1164 | Long spinner, janky tab switches, phone hangs |
| S3 | Giant single components (CustomerLedger 5,835 lines / 64 `useState`, POS 4,279 / 59, Reports 3,887) re-render everything on every keystroke | same files | Typing lag in search and qty fields |
| S4 | Almost no virtualization (2 uses) while lists show 20–350 rows with 6 icons each | tables everywhere | Slow scroll, slow first paint |
| S5 | Few cancelled requests (15 AbortController uses). Fast filter changes stack requests, and old responses can overwrite new ones | lists and filters | Wrong rows flash, spinner never ends |
| S6 | 30 s axios timeout with no visible "still loading / cancel" step | `services/api.js` | Looks hung for up to 30 s |
| S7 | Many pollers run at once (alerts 60 s, presence 180 s, health, dashboard 120 s, POS 60 s, products 60 s, routes) | Layout + pages | Background traffic, battery drain, request contention |
| S8 | Decorative `animate-*` (101 uses) and heavy shadows | slop sweep | Extra paint cost on low-end tablets |
| S9 | Old lucide (0.294) and recharts on routes that don't need charts (to verify with the bundle analyzer) | build | Larger JS per route |

---

## 2. Performance budgets (pass/fail for every P task and every UI task that touches a page)

Measured with Playwright: **desktop 1440** normal, and **phone 360 with 4× CPU slowdown + Fast 4G**.

| Metric | Desktop | Phone throttled |
|---|---|---|
| Route JS (gzip, excluding vendor shared) | ≤ 120 kB | same |
| Time to first data row on list/ledger pages | ≤ 1.0 s | ≤ 2.5 s |
| POS ready to search | ≤ 1.2 s | ≤ 3.0 s |
| POS keystroke → result list | ≤ 100 ms local filter / ≤ 400 ms server | ≤ 250 / ≤ 800 ms |
| Add item → total updated | ≤ 50 ms | ≤ 150 ms |
| Long tasks > 200 ms during interaction | 0 | ≤ 2 |
| Requests while idle 5 min on POS | ≤ 6 | ≤ 6 |
| Memory growth after 30 min POS soak (100 invoices) | ≤ 30 MB | ≤ 30 MB |
| Any request without a visible state after 3 s | 0 (must show "Still loading… Cancel") | 0 |

---

## 3. Phase P tasks (add to the loop; run P-00 first)

### [ ] P-00 · Baseline + perf harness · P0
- **Files:** new `e2e/perf/*.spec.js`, `scripts/perf-report.mjs`, `vite.config.js` (add `rollup-plugin-visualizer` behind `ANALYZE=1`, dev-only).
- **Do:** measure every row of §2 on `/pos`, `/ledger?customerId=<seed>`, `/sales-ledger`, `/billing-history`, `/reports`, `/dashboard`. Use `PerformanceObserver('longtask')`, `page.route` request counting, and the bundle visualizer. Write the numbers into LOOP-STATE §2.
- **Done when:** `npm run perf` prints a table and fails if any budget regresses by more than 10 % against LOOP-STATE.

### [ ] P-01 · Request control layer · P0
- **Files:** `services/api.js`, new `hooks/useQuery.js` (small. Don't add react-query unless the owner approves).
- **Do:**
  - Each list fetch gets an `AbortController`. A new filter or page cancels the previous request, and a response is applied only if it is the latest (sequence id).
  - De-duplicate identical in-flight GETs.
  - After 3 s, the component shows "Still loading… [Cancel]". After 15 s (not 30), show a timeout error with Retry. Money POSTs keep 30 s and **never auto-retry**.
- **Done when:** fast filter-clicking on Sales Ledger shows only the last result (test), and a slow mocked endpoint shows the 3 s state.

### [ ] P-02 · Pollers: one scheduler · P1
- **Files:** new `services/scheduler.js`; Layout, AlertNotifications, DashboardTally, ProductsPage, POS, RouteMapPage, RouteDetailPage, BackupPage.
- **Do:**
  - One scheduler with named jobs. It pauses when the tab is hidden, the device is offline, a modal or form is dirty, or the user typed within the last 10 s.
  - Add jitter. Use exponential backoff on errors (max 5 min).
  - Driver live location keeps its own timer (F02).
- **Done when:** idle POS for 5 min makes ≤ 6 requests (budget §2).

### [ ] P-03 · POS data: stop reloading the world · P0
- **Files:** `PosEnterprisePage.jsx` ~L520–535, `managers/*`, `ProductDrawer.jsx`.
- **Do:**
  - Load the catalog once per session into memory (plus IndexedDB cache keyed by **tenantId**).
  - Refresh in the background only when the POS is idle (no cart edit for 30 s), using `updatedSince` if the API has it (NEEDS-BACKEND P-05). Otherwise refresh every 10 min, not 60 s.
  - Search filters the local catalog (pre-normalized lowercase index) in ≤ 100 ms.
  - Customers: search server-side with a debounce of 250 ms, limit 20.
- **Business guard:** price and stock shown at add-time must be re-validated by the server on save (existing behaviour). Don't change it.
- **Done when:** the POS budget rows pass, and a 30 min soak shows no freeze.

### [ ] P-04 · Customer Ledger: server paging, no 1,000-row merges · P0 · NEEDS-BACKEND (cash ledger)
- **Files:** `CustomerLedgerPage.jsx` (~L868 customers, ~L1164 cash ledger).
- **Do:**
  - The customer switcher uses a server search (limit 20), not 1,000 rows.
  - Bills, Payments and Ledger tabs load page by page (50) with server totals in the sticky footer.
  - Cash-customer ledger uses the paged endpoint when it exists. Until then, keep the current behaviour, wrapped in P-01 cancellation.
  - Split the page into tab components (`LedgerBillsTab`, `LedgerPaymentsTab`, `LedgerStatementTab`, `LedgerStatsTab`, `LedgerHeader`) **with no logic change**. Move code only, and prove it with the H03 money snapshot.
- **Done when:** the ledger first row is ≤ 1.0 s desktop and ≤ 2.5 s phone, and totals are identical.

### [ ] P-05 · Virtualize long tables · P1
- **Blocked by:** B01.
- **Do:** DataTable auto-virtualizes above 100 rows with `@tanstack/react-virtual` (already installed). Keep the sticky header and footer. Pagination stays the default (20/50/100). Virtualization is for "All" and ledger statements.
- **Done when:** a 2,000-row ledger statement scrolls at 60 fps with no long task over 200 ms on desktop.

### [ ] P-06 · Re-render control in big pages · P1
- **Do:**
  - Search inputs keep their own local state with a 300 ms debounce.
  - Rows are `React.memo` with stable keys, handlers use `useCallback`, and derived totals use `useMemo` (no new math, only memoize the existing math).
  - Use the React Profiler to find the top 5 offenders on POS and Ledger.
- **Done when:** typing in POS search causes no cart re-render (Profiler screenshot).

### [ ] P-07 · Route-level code splitting check · P2
- **Do:** confirm every page in `App.jsx` is `lazy()` (there are already ~60). Move recharts, leaflet, zbar-wasm and livekit to only the routes that use them. Prefetch the POS and Ledger chunks after login when idle.
- **Done when:** each route's JS is within budget (§2), with visualizer evidence.

### [ ] P-08 · lucide upgrade + icon map · P2
- **Do:** upgrade `lucide-react` (pin the exact version) and create `components/ui/icons.js` (DESIGN-SYSTEM §6). Pages import from the map. Make sure tree-shaking keeps the icon cost under 15 kB gz.

### [ ] P-09 · Remove decorative animation and shadow cost · P2
Covered by B02. Here only measure the paint-time difference on the tablet profile.

### [ ] P-10 · Hang and crash guards · P0
- **Do:**
  - An `ErrorBoundary` per route (exists globally; add per page with Retry plus a "Copy error id" link).
  - A global `unhandledrejection` → toast + log.
  - A watchdog: if the main thread is blocked for more than 2 s (measured by the rAF gap), log `ui.freeze` with the route to the existing logging, so a freeze is never invisible.
  - The PWA service worker never serves a stale `index.html` after a deploy (show an "Update available → Reload" banner).
- **Done when:** a forced throw in the Ledger shows the page-level error, not a white screen, and the freeze log appears in the console test.

---

## 4. End-to-end control (E2E gates)

The loop may only declare a phase finished when its gate passes. Gates run on a local disposable DB with synthetic tenants: `seed-dev-synthetic.mjs`, at least 2 tenants.

### 4.1 Critical journeys (Playwright, each at desktop 1440 + phone 360; tablet 752 for marked ones)

| ID | Journey | Must assert |
|---|---|---|
| J1 | Login → Dashboard (tablet too) | KPIs load, Needs attention shows, no console errors |
| J2 | POS: customer → 3 items (one by barcode) → discount → Cash save → print A4 | Total = server total; invoice number increments by 1; ledger balance updated (tablet too) |
| J3 | POS credit sale → Customer Ledger → Receive payment (partial) → Pending shows the rest | Dr balance math equals the server; idempotency: double-click Save makes 1 payment |
| J4 | Unconfirmed payment simulation (network drop after POST) → banner → Check result | No duplicate payment; banner clears |
| J5 | Purchase with 5 lines → supplier ledger → Pay supplier | Stock increases; supplier outstanding updated |
| J6 | Expense with VAT → VAT Return period shows the input VAT | VAT box values match the server |
| J7 | Return from invoice → credit note → customer balance reduced | Stock back; ledger shows the return |
| J8 | Daily close: expected → counted → difference reason → submit | Close saved; dashboard card says Closed |
| J9 | Driver: start route (mock GPS) → auto-arrive → Delivered → Problem (preset) → end (phone too) | Statuses sent; proposed pin flow; reorder + Undo |
| J10 | AI agent: summary question → real text reply; expense via ActionCard → confirm | Reply ≠ canned fallback; exactly one expense created |
| J11 | Tenant isolation: tenant A data never visible in tenant B search, palette, agent, or cache after switching | 0 leaks |
| J12 | Offline: go offline in POS → banner; money writes disabled; back online → resumes | No lost cart (draft restore) |

### 4.2 Gates

| Gate | When | Must pass |
|---|---|---|
| **E2E-G1** | After phases A + P-00..P-04 | J1, J2, J3, J4, J11 + perf budgets for POS and Ledger + H03 money snapshot |
| **E2E-G2** | After phases B, C, D, G | J1–J8, J11, J12 at 360 / 752 / 1440 + H01 screenshot sweep + H02 slop lint |
| **E2E-G3** | After phases E, F (and when backend items land) | J9, J10 + full suite + 30 min POS soak (100 invoices, memory ≤ +30 MB, no long task > 500 ms) |

### 4.3 Control rules

- A failing gate stops new feature tasks. The loop only fixes failures, until the gate is green or the failure is recorded as BLOCKED with a reason.
- Flaky test rule: rerun once. If it passes on the second run, mark it `FLAKY` in LOOP-STATE and open a task to fix it. Never delete or skip the test.
- Every gate run saves: the Playwright HTML report, traces for failures, perf table, money snapshot diff, and screenshot folder. Paths go in LOOP-STATE §6.
- `npm run gate:g1|g2|g3` scripts bundle the commands so any session runs the same thing.

---

## 5. How the pieces connect

```
AGENTS.md (+ AGENTS-UIUX-LOOP.md)  → rules, anti-stuck, definition of done
DESIGN-SYSTEM.md (v2)              → what "clean ERP" means: tokens, sizes, icons, patterns
UIUX-RALPH-LOOP-2026-11-07.md      → the task list (A–H) + goal prompt
PERF-AND-E2E-CONTROL.md            → Phase P tasks, budgets, journeys, gates
LOOP-STATE.md                      → memory: now, baselines, decisions, facts, board, history, stuck log
```

Updated order: **P-00 → A01–A06 → P-01 → P-03 → P-04 → E2E-G1 → B → C → D → P-02, P-05–P-10 → G → E2E-G2 → E → F → E2E-G3.**
