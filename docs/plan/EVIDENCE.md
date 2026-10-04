# EVIDENCE.md

One row per verified check. Newest first. Status: `planned | implemented | tested | blocked`.

| Date | Slice | Env | Commit | Tenant | Role | Viewport | Action | Expected | Actual | Artifact | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-04 | Phase7 staff shell | local | 92373e5 | FH1/FH2/GH/ZY | staff | 5 VPs | 6 pages ×4×5 | shell loads | ok=120 | Desktop/HexaBill_Backups/phase7-matrix-20261004-111213 (staff PNGs) | tested |
| 2026-10-04 | Phase7 owner shell | local | 446eb6a+ | FH1/FH2/GH/ZY | owner | 5 VPs | 6 pages ×4×5 | shell loads | ok=120 | same dir (owner PNGs) | tested |
| 2026-10-04 | Phase8 owner static | local | 6a51a20 | FH1/FH2/GH/ZY | owner | 5 VPs | 37 routes ×4×5 | shell loads | 148/tenant-vp batch | phase8-shell-20261004* | tested |
| 2026-10-04 | Phase8 params | local | 385e62a+ | FH1/FH2/GH/ZY | owner | 360 | 9 detail types ×4 | shell loads | ok=36 | phase8-shell-20261004/params | tested |
| 2026-10-04 | Phase8 platform metrics | local | b77d5bb | admin | SystemAdmin | n/a | platform-health source/unit/asOf | metadata present | asOf+6 metrics; PG pool unavailable on SQLite | platform-health.after-restart.json | tested |
| 2026-10-04 | Superadmin shells | local | b77d5bb+ | admin | SystemAdmin | 1366 | 10 routes | shell loads | 10 PNGs | phase8-shell-20261004/superadmin | tested |
| 2026-10-04 | Journeys×4 | local | c54e778 | 4 | owner | shell | J1–J7 | PASS | local PASS | master-loop-2-journeys-20261004-105936 | tested |
| 2026-10-04 | Header PDFs | local | master-loop-2 | FH1/FH2/GH | owner | print | A4/thermal/receipt/gray/AR | SAMPLE/Invoice rules | PASS local | master-loop-2-headers-20261004-104308 | tested |
| 2026-10-04 | Sample TRN + Zayogya | local | master-loop-2 | FH/GH/ZY | n/a | n/a | unit tests | ZY unchanged; SAMPLE invoice | PASS (Zayogya 8) | SampleVatTrn / ZayogyaRegression* | tested |
| 2026-10-04 | Push branch | local | 92373e5 | n/a | n/a | n/a | `git push origin master-loop-2` | remote updated | BLOCKED (no HTTPS credential in agent) | Desktop/.../master-loop-2-ahead13.bundle | blocked |
| 2026-10-04 | PG isolation 44 | PG | — | A/B | — | — | Cross-tenant HTTP | deny | NOT RUN (no disposable PG password/URL) | — | blocked |
| — | Page §10 field/edge | local | — | 4 | multi | 360..1440 | interactive acceptance | all cells | NOT RUN | — | planned |
| — | Phases 9–11 | — | — | — | — | — | AI/voice/driver/staging | flags OFF then staging | NOT STARTED (gated) | — | planned |

Client document contents: **not recorded** (gitignored; field names only if needed).

