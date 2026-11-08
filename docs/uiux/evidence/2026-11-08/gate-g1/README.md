# E2E-G1 gate (`npm run gate:g1`)

Owner: team T6 (GATES), branch `loop/t6/gates`. Synthetic local tenants only (`gulfharvest-test`, `frozenhub1-test`).
Local disposable PostgreSQL only (127.0.0.1:55481, database `hexabill_codex_browser_loope_20261108`).

## Run

From the worktree (`frontend/hexabill-ui`):

```
npm run gate:g1
```

That runs `scripts/gate-g1.ps1`, which in order:

1. `npm run lint`, `npm test`, `npm run build`.
2. Journeys through the loop wrapper. The wrapper starts the synthetic API (port 5188) and the Vite dev server (port 5189), runs the spec, then stops both:

   | Step | Spec | Projects |
   |---|---|---|
   | J1 login -> dashboard | `e2e/gate/j1-login-dashboard.spec.js` | d1440, m360, t752 |
   | J2 POS cash sale | `e2e/gate/j2-pos-cash.spec.js` | d1440, m360, t752 |
   | J3 credit sale + ledger receipt | `e2e/gate/j3-credit-ledger.spec.js` | d1440, m360 |
   | J4 unconfirmed payment | `e2e/gate/j4-unconfirmed.spec.js` | d1440, m360 |
   | J11 tenant isolation | `e2e/gate/j11-tenant-isolation.spec.js` | d1440, m360 |
   | H03 money snapshot compare | `e2e/gate/h03-money-snapshot.spec.js` (`H03_LABEL=after H03_COMPARE=before`) | d1440 |

   Each wrapper call is equivalent to:

   ```
   powershell -NoProfile -File C:\Users\anand\.claude-worktrees\_loop-tools\run-spec.ps1 -Root <worktree> -Spec e2e/gate/<file>.spec.js -Projects d1440,m360 -ApiPort 5188 -FePort 5189 -Database hexabill_codex_browser_loope_20261108 [-FirstSeed]
   ```

   `-FirstSeed` is needed only on an empty database.

3. Perf: `npm run perf:bundle`, the POS/ledger/reports perf specs under `HEXABILL_FE_MODE=preview` (d1440, m360), then `npm run perf -- --compare baseline.json` against `docs/uiux/evidence/2026-11-07/perf/baseline.json`.

Output: a PASS/FAIL table and `OVERALL`. Full logs go to `%TEMP%\hexabill-gate-g1\`. Exit code = number of failed steps.

Flags: `-SkipPerf`, `-FirstSeed`, `-ApiPort`, `-FePort`, `-Database`, `-ToolsDir`.

## H03 money snapshot

```
node scripts/money-snapshot.mjs --label before                  # first snapshot (done 2026-11-08)
node scripts/money-snapshot.mjs --label after --compare before  # later sessions; exits 1 on any difference
```

Needs the API running (the gate runs it inside the wrapper), or the wrapper env: `HEXABILL_API`, `HEXABILL_EDGE_PROXY_SECRET`, `HEXABILL_OWNER_PASSWORD`.

- Period: `2026-10-01` to `2026-10-31` (Sales Ledger, Customer Ledger x3, Worksheet). VAT Return: `2026-08-01` to `2026-10-31` (the endpoint only accepts full quarters).
- Fixtures are created once through the API with fixed amounts and invoice dates inside the period (`H03 snapshot customer A/B/C`, item `H03-SNAP-ITEM`). Later runs reuse them.
- Canonical form: keys sorted, `id`/`*Id`/timestamp/row-version fields removed, money rounded to 2 dp, arrays ordered by content.
- Output: `money-snapshot/<label>.json` (canonical sections) and `money-snapshot/<label>.sha256` (overall and per-section SHA-256).

`before` overall SHA-256: `34580a8295eb9c0737d62a6c9bcc400188fe5a438dd725d563d33b3d09416334`
(`after` run on the same DB reproduced it: SAME on all six sections.)

## Known limits

- J11 does not exercise the assistant (mock). The assistant has no tenant-scoped mock hook in this build, so that part of the journey is NOT covered.
- J3 applies the receipt to a chosen invoice. A receipt left on "No Invoice (General Payment)" changes the customer balance but not any invoice's balance (see `BUG` notes in the gate report).
- Phone (m360) J3 creates the credit sale through the API. The phone POS checkout sheet is covered by `e2e/pos-checkout.spec.js`.
