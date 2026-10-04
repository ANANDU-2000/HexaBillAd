# EVIDENCE.md

One row per verified check. Newest first. Status: `planned | implemented | tested | blocked`.

| Date | Slice | Env | Commit | Tenant | Role | Viewport | Action | Expected | Actual | Artifact | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-04 | Step 0 build | local | a958394+docs | n/a | n/a | n/a | BE+FE clean gate | 0 fail | BE 555p/44sk; FE 74p; lint 0e; build OK | STATE.md §2 | tested |
| 2026-10-04 | Prior Tier0 local | local | 11d1f90..a958394 | FH1/FH2/GH/ZY | owner | shell | Journeys J1–J7 + 25 routes×4 | PASS local | PASS | Desktop/HexaBill_Backups/tier0-local-browser-20261004-091255/VERDICT.md | tested |
| 2026-10-04 | Prior main verify | local | a958394 | n/a | n/a | n/a | Post-merge tests | green | PASS | Desktop/HexaBill_Backups/tier0-main-verify-20261004-095352/VERDICT.md | tested |
| — | Header parity A4/thermal/PDF/AR/gray | local | — | 4 tenants | owner | multi | PDF text extract | header matches settings | NOT RUN this session | — | planned |
| — | PG isolation 44 | PG | — | A/B | — | — | Cross-tenant HTTP | deny | NOT RUN (no HEXABILL_TEST_POSTGRES) | — | blocked |
| — | Backup restore | copy DB | — | — | — | — | restore rehearsal | OK | NOT RUN | — | blocked |
| — | Page matrix 60×5 | local | — | 4 | multi | 360..1440 | field/edge cases | all cells | NOT RUN | — | planned |
| — | Zayogya snapshot | local | — | zayoga | — | — | tax/print pin | identical | NOT RUN (test not yet added) | — | planned |
| — | D5 profit VAT label | local | — | GH/FH | owner | desktop | stop profit×5% as VAT | Standard VAT + Estimate | NOT RUN | — | planned |

Client document contents: **not recorded** (gitignored; field names only if needed).
