# Perf baseline harness (task P-00)

Budgets: `docs/uiux/PERF-AND-E2E-CONTROL.md` section 2. Everything here runs against the local synthetic
PostgreSQL tenant only. Nothing is written to the database. Results are JSON files in this folder.

## Files

| File | What |
|---|---|
| `frontend/hexabill-ui/e2e/perf/perfKit.js` | long-task observer, first-data-row detector, request tracker, CDP throttle, result writer, browser-only list scaling |
| `frontend/hexabill-ui/e2e/perf/pages.spec.js` | `/ledger?customerId=`, `/sales-ledger`, `/billing-history`, `/reports`, `/dashboard`: load + interaction + "visible state after 3 s" probe, plain and scaled |
| `frontend/hexabill-ui/e2e/perf/pos.spec.js` | `/pos`: ready to search, keystroke to list, add item to total, long tasks, plain and scaled catalogue |
| `frontend/hexabill-ui/e2e/perf/pos-idle.spec.js` | `/pos` idle: API requests and heap growth over `PERF_IDLE_MS` |
| `frontend/hexabill-ui/scripts/bundle-size.mjs` | gzip per route chunk + total from `dist/assets` (no analyzer dependency) |
| `frontend/hexabill-ui/scripts/perf-report.mjs` | merges the JSON, prints the table, writes or compares `baseline.json` |
| `scripts/run-customer-save-qa.ps1` | now honours `HEXABILL_FE_MODE=preview` (serves `dist/` with `vite preview`; default stays the dev server) |

## Run (two steps)

Prerequisite for production-build numbers: `cd frontend/hexabill-ui && npm run build`.

1. Playwright specs through the loop wrapper (starts the synthetic API + web server from the worktree, runs, stops). Desktop = project `d1440`, phone = project `m360`:

```
set HEXABILL_FE_MODE=preview
set PERF_TARGET=preview
cmd /c "powershell -NoProfile -File C:\Users\anand\.claude-worktrees\_loop-tools\run-spec.ps1 -Root <worktree> -Spec e2e/perf/pages.spec.js,e2e/perf/pos.spec.js,e2e/perf/pos-idle.spec.js -Projects d1440 -ApiPort 5180 -FePort 5181 > out-d1440.txt 2>&1"
cmd /c "powershell -NoProfile -File ...run-spec.ps1 ... -Projects m360 ... > out-m360.txt 2>&1"
```

   (Git Bash: `export HEXABILL_FE_MODE=preview PERF_TARGET=preview` instead of `set`.) Without `HEXABILL_FE_MODE=preview` the
   Vite dev server is measured, which is much slower on first load because modules are served unbundled. Do not mix targets
   in one baseline; each JSON records its `target`.

   The phone profile (width < 768) applies CDP `Emulation.setCPUThrottlingRate` 4x and `Network.emulateNetworkConditions`
   (170 ms RTT, 9 Mbit/s down). Chromium/Edge only.

2. Bundle sizes, then the report:

```
cd frontend/hexabill-ui
npm run perf:bundle        # node scripts/bundle-size.mjs  -> bundle.json
npm run perf               # prints the table and writes baseline.json
npm run perf -- --compare baseline.json   # no write; exit 1 if any metric regressed > 10 %
npm run perf -- --budgets                 # also exit 1 when a section-2 budget is exceeded
```

Regression rule: current > baseline x 1.10 + tolerance (25 ms for `*Ms`, 0.5 kB for `*Kb`, 2 MB for `*Mb*`, 0 for counts), so
sub-50 ms values do not fail on noise. A `--compare` run should be done against a copy: write the new run with
`npm run perf -- --out run.json` or compare first, then re-baseline deliberately.

## Idle budget run (5 min)

`PERF_IDLE_MS` sets the idle window of `pos-idle.spec.js`. Default 60000 for normal runs; the budget row
"idle 5 min on POS <= 6 requests" is measured with `PERF_IDLE_MS=300000`. This test runs longer than 3 minutes by design.
Metric names carry the window (`idleApiRequests60s`, `idleApiRequests300s`) so different windows are never compared.

## Scaled runs

The seeded tenant is tiny (1 customer, 1 product, 3 sales), which hides list cost. "Scaled" variants
(`ledgerScaled`, `salesLedgerScaled`, `billingHistoryScaled`, `posScaled`) replicate every `GET /api` list response
(`data.items`) in the browser up to its requested `pageSize` (max 1000) with unique ids. Nothing is written to the database.
This measures client render/merge cost only; server time for a large tenant is NOT represented.

## What is not measured

- 30 min POS soak with 100 invoices: NOT TESTED (would create 100 invoices; heap growth over the idle window is a proxy only).
- "Still loading... Cancel" is probed by holding every non-auth GET for 4.5 s and checking the page at 3.6 s.
- Time to first data row is not defined for `/reports` and `/dashboard` (no list rows on landing); they report API settle time instead.
- Timings that start in the page are DOM-update latencies (MutationObserver), not paint.
