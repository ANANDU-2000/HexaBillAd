# T5 concurrency tests (local synthetic stack only)

Never run against production or real tenants. `lib.mjs` refuses anything but a 127.0.0.1 API and PG port 55481 / `hexabill_codex_browser_*` DB.

Prereq: `dotnet build tools/HexaBill.SyntheticSeed` and `tools/HexaBill.SyntheticBrowserHost`; PG on 55481 with an empty DB `hexabill_codex_browser_loopc_20261108`.

```
# first time only (seeds 4 synthetic tenants)
cmd //c "powershell -NoProfile -File tests\concurrency\run.ps1 -FirstSeed -Entry tests/concurrency/probe.mjs > out.txt 2>&1"
# scenarios (starts API on 5186, resets passwords on this DB, runs node, stops API)
cmd //c "powershell -NoProfile -File tests\concurrency\run.ps1 -Scenarios c1,c2,c3,c6 -Runs 3 > out.txt 2>&1"
cmd //c "powershell -NoProfile -File tests\concurrency\run.ps1 -Scenarios c5,c7,c8,c9 -Runs 3 > out.txt 2>&1"
node tests/concurrency/report.mjs     # tables from docs/uiux/evidence/concurrency/raw-*.json
```
`c2-diag.mjs` (run with `-Entry`) narrows BUG-20. Fixtures: `setup.mjs` inserts a local unlimited plan, 15 Staff + 15 Admin users per tenant, a branch and route. No Vite is started.
