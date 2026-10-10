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

## Checks in `e2e/route-sweep.spec.js`

Each test runs for every tenant (gulfharvest, frozenhub1, frozenhub2), every route and every viewport:

- The session stays signed in (no redirect to `/login`).
- There is no page-level horizontal overflow (`scrollWidth − clientWidth ≤ 0`).
- At most one visible `<header>`.
- There are no uncaught page errors.

## Results

| Date | Build | Scope | Pass | Fail | Blocked | Notes |
|---|---|---|---|---|---|---|
| 2026-10-10 | uiux-premium | /login (public) at 390 and 1440 | 2 | 0 | 0 | No overflow, no console errors, tenant brand shown |
| 2026-10-10 | uiux-premium | route sweep | – | – | 540 | Waiting for the owner test password |

Workflow specs still to write: create customer, supplier, product, POS sale, purchase and expense; record payment; open VAT, reports and print preview; cross-tenant API denial. Each create step is verified through the API response and a re-fetch, not by screenshot alone.
