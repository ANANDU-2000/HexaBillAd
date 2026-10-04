# Page × viewport matrix tracker (MASTER-LOOP §10)

Statuses: `planned | implemented | tested | blocked | not-run`

Viewports: `360x800 | 390x844 | 768x1024 | 1366x768 | 1440x900`  
Tenants: `frozenhub1 | frozenhub2 | gulfharvest | zayoga`  
Roles: `owner | staff | platform`

## Baseline (2026-10-04)

| Source | Coverage | Status |
|---|---|---|
| `tier0-browser-shell-check.mjs` prior run | 25 core routes × 4 tenants (shell load) | tested (prior) |
| DocumentHeaderTests + PDF evidence | A4/A5/80/58/receipt | tested |
| Full §10 field/edge matrix for 61 routes × 5 viewports | — | **not-run** (tracker opened) |

## Phase exit mapping

| Phase | Matrix requirement | Status |
|---|---|---|
| 1 Clean build | build/lint/tests + SHA | **tested** @ `6dc8d9c` (BE 564p/44sk, FE 74p) |
| 2 Isolation | PG both directions | **blocked** (no PG) |
| 3 Payments/receipts | idempotent payment + reprint | **implemented** / re-browser **not-run** |
| 4 Cost snapshots / D9 | unit PASS | **tested** (unit) |
| 5 Daily close | unit PASS; flag OFF | **implemented** |
| 6 Margin VAT | accountant fixtures | **blocked** (D5 stop-gap shipped) |
| 7 Shell UX | Tally + 4 mobile tabs + 6 pages × 5 VPs | **partial** (owner 4×6×5 = 120 screenshots; staff not-run) |
| 8 Remaining routes | all 61 | **partial** (37 static×4 owners @360; platform metrics metadata; param/superadmin/5VP not-run) |
| 9 AI | — | **not-run** |
| 10 Voice/driver/maps | — | **not-run** |
| 11 Staging/pilot | — | **blocked** |

## Route checklist seed

Populate from `ROUTE-MANIFEST.json`. Each row starts `planned` until a screenshot+role evidence row lands in `EVIDENCE.md`.

Use: `node scripts/tier0-browser-shell-check.mjs` then attach screenshots under `Desktop/HexaBill_Backups/…` (never commit binaries).
