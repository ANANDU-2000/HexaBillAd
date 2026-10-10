# Responsive Tests

## How to run

1. Start the API with `cd backend/HexaBill.Api && dotnet run`.
2. Start the frontend with `cd frontend/hexabill-ui && npm run dev`.
3. Make sure the tenants exist (`scripts/tier0-local-bootstrap.mjs`).
4. Put `HEXABILL_OWNER_PASSWORD=...` in `frontend/hexabill-ui/e2e/.env.local`. That file is gitignored, and the password must be a local test password only.
5. Run `npm run test:e2e`. To run a single viewport, add `-- --project=m390`.

Outputs:
- Screenshots: `e2e/.shots/` (gitignored)
- HTML report: `e2e/.report/`

## Viewports (Playwright projects)

| Project | Size |
|---|---|
| m360 | 360×800 |
| m390 | 390×844 |
| t768 | 768×1024 |
| d1024 | 1024×768 |
| d1440 | 1440×900 |

## Shared components: `e2e/design-system.spec.js`

Needs only Vite on :5173; no API and no login. Run `npx playwright test e2e/design-system.spec.js`. It loads the dev-only `/__design` page and checks, at every viewport:

- **Layout:** no page-level horizontal overflow in LTR or RTL, and no page errors. Full-page screenshots go to `e2e/.shots/design-system[-rtl]-<vp>.png`.
- **Touch targets:** buttons, inputs, selects and tabs are at least 44px on phones and at least 32px from 768px up. Controls explicitly marked `sm` are exempt.
- **KPI figures:** never clipped.
- **Table:** cards below 768px and a table from 768px up; sort sets `aria-sort`; tabs stay on one row inside the viewport.
- **Dialog:** a bottom sheet on phones and centred from md up; focus moves inside; Esc closes it and returns focus to the trigger.
- **Filter sheet:** focus moves in and stays in a field while typing; Esc closes it and restores focus.
- **Keyboard focus:** the focus ring is visible.

## Stage 3 checks: `e2e/workflows.spec.js`

- **UX-1:** create a customer through the UI. Fields left empty must explain themselves. The record is then confirmed through the API and the new row must be visible.
- **UX-4:** Ctrl+K palette, `?` help, Esc, Ctrl+\ sidebar.
- **UX-6:** each tenant shows its own name, title and `--tenant-brand`, with no other tenant's slug on the page. A token from one tenant is refused on another tenant's host.

Run (local tenants only):

```
npx playwright test e2e/workflows.spec.js --project=m390 --project=d1440 --workers=1
```

## Checks in `e2e/route-sweep.spec.js`

Each test runs for every tenant (gulfharvest, frozenhub1, frozenhub2), every route and every viewport:

- The session stays signed in (no redirect to `/login`).
- There is no page-level horizontal overflow (`scrollWidth − clientWidth ≤ 0`).
- At most one visible `<header>`.
- There are no uncaught page errors.
- There are no API 5xx responses. The presence heartbeat is recorded instead, because local SQLite can lock under parallel tests.
- If the API rate limit (300 requests/min/IP) returns 429, the test waits and reloads, so pages are checked with real data.
- Metrics go to the JSON-lines file named by `HEXABILL_SWEEP_REPORT`: undersized phone targets, visible `<h1>` count, nested scroll areas.

## Results

| Date | Build | Scope | Pass | Fail | Blocked | Notes |
|---|---|---|---|---|---|---|
| 2026-10-10 | uiux-premium | /login (public) at 390 and 1440 | 2 | 0 | 0 | No overflow, no console errors, tenant brand shown |
| 2026-10-10 | uiux-premium | route sweep | – | – | 540 | Waiting for the owner test password |
| 2026-10-10 | uiux-premium (Stage 2) | route sweep, gulfharvest, 36 routes × m360/m390/t768/d1024/d1440 | 180 | 0 | 0 | Baseline before Stage 2: 175/180 (/products sideways scroll at 768 and 1024). 15.4 min with 1 worker and 429 back-off |
| 2026-10-10 | uiux-premium (Stage 2) | re-check of routes changed after the sweep (customers, ledger, reports, expenses, billing-history, products) at m360/m390/t768 | 18 | 0 | 0 | 0 undersized touch targets on all 18 |
| 2026-10-10 | uiux-premium (Stage 3) | `workflows.spec.js` at m390 and d1440, plus UX-1 at all 5 widths | 15 | 0 | 1 skipped | Keyboard test runs only at 1024 and above |
| 2026-10-10 | uiux-premium (Stage 2) | `design-system.spec.js` (8 checks × 5 widths, now including OverflowMenu) | 40 | 0 | 0 | |
| 2026-10-10 | uiux-premium (Stage 1) | design-system spec, 7 checks × m360/m390/t768/d1024/d1440 | 35 | 0 | 0 | The first run failed 5 times and caught real defects: sort headers 14px tall, form fields 42px on phones, StatCard truncating amounts at 360. All fixed and re-run |

Workflow specs still to write: create customer, supplier, product, POS sale, purchase and expense; record payment; open VAT, reports and print preview; cross-tenant API denial. Each create step is verified through the API response and a re-fetch, not by screenshot alone.
