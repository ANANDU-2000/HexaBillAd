# EVIDENCE.md

One row per verified check. Newest first. Status: `planned | implemented | tested | blocked`.

| Date | Slice | Env | Commit | Tenant | Role | Viewport | Action | Expected | Actual | Artifact | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-04 | Push main + master-loop-2 | github | 3d0ddad | n/a | n/a | n/a | push CTA commits to both tips | remote tip = local | both at `3d0ddad` | https://github.com/ANANDU-2000/HexaBillAd | tested |
| 2026-10-04 | Zayogya regression | local | WIP | ZY | n/a | n/a | ZayogyaRegressionSnapshotTests | PASS | 8 passed | dotnet filter ~Zayogya | tested |
| 2026-10-04 | §10 cust/prod/pay CTA ≥44px | local | WIP | n/a | n/a | n/a | CustomerDetail + Products toolbar + Payments CTA | no md:min-h-9 / sm:min-h-0 on those CTAs | code fixed | CustomerDetailPage / ProductsPage / PaymentsPage | implemented |
| 2026-10-04 | §10 purch/exp CTA ≥44px | local | WIP | FH1 | owner | 360+1440 | purchases + expenses | primaryMin44 | ok=4 fail=0 warn=0 | Desktop/HexaBill_Backups/field-edge-purch-exp-cta44-20261004 | tested |
| 2026-10-04 | §10 docs editor CTA ≥44px | local | WIP | FH1 | owner | 360 | quotation/agreement/salary new | primaryMin44 | ok=3 fail=0 warn=0 | Desktop/HexaBill_Backups/field-edge-docs-cta44-20261004 | tested |
| 2026-10-04 | §10 CTA ≥44px fix | local | WIP | FH1 | owner | 360 | users/profile/branches/routes | primaryMin44 | ok=4 fail=0 warn=0 | Desktop/HexaBill_Backups/field-edge-cta44-20261004 | tested |
| 2026-10-04 | §10 static-36 rest 5VP | local | WIP | FH2/GH/ZY | owner | 5 VPs | 36 static ×3×5 | non-blank shells | ok=540 fail=0 warn=171 | Desktop/HexaBill_Backups/field-edge-static36-rest-5vp-20261004 | tested |
| 2026-10-04 | Push main + master-loop-2 | github | 3a44391 | n/a | n/a | n/a | `git push` branch then FF main | remote tip = local | both at `3a44391` | https://github.com/ANANDU-2000/HexaBillAd | tested |
| 2026-10-04 | §10 static-36 FH1 5VP | local | WIP | FH1 | owner | 5 VPs | 36 static routes ×5 | non-blank shells | ok=180 fail=0 warn=57 | Desktop/HexaBill_Backups/field-edge-static36-fh1-5vp-20261004 | tested |
| 2026-10-04 | §10 static-36 owner×4 | local | WIP | FH1/FH2/GH/ZY | owner | 360 | 36 static routes field-edge | non-blank shells | ok=144 fail=0 warn=36 | Desktop/HexaBill_Backups/field-edge-static36-owner-4t-20261004 | tested |
| 2026-10-04 | §10 static-36 staff×4 | local | WIP | FH1/FH2/GH/ZY | staff | 360 | 36 static routes field-edge | non-blank shells | ok=144 fail=0 warn=36 | Desktop/HexaBill_Backups/field-edge-static36-4t-20261004 | tested |
| 2026-10-04 | Browser print live | local Vite+API | WIP | FH1 | owner | 1366 | Billing History → Preview → Print Options + API A4 PDF | modal + PDF bytes | sale 17; API PDF 119298; Print Options A4 selected | Desktop/HexaBill_Backups/browser-print-20261004 | tested |
| 2026-10-04 | PG dump/restore COPY | local PG :5433 | WIP | n/a | n/a | n/a | pg_dump Fc → restore_copy → isolation retest | 67 tables + tests green | src=dst 67; isolation **8/8**; EF migrate-to-head **FAIL** (Customers 42P07) | Desktop/HexaBill_Backups/pg-rollback-20261004 | tested |
| 2026-10-04 | PG isolation suite | local PG :5433 | WIP | A/B | — | — | `dotnet test --filter ~PostgreSql\|~Postgres` + `HEXABILL_TEST_POSTGRES` | 55 green | **Passed 55 / Failed 0** (~12s) on `hexabill_master_loop_test` | disposable DB only (not committed) | tested |
| 2026-10-04 | Clean verify non-PG | local | WIP | n/a | n/a | n/a | FE 82 + BE !~PostgreSql | green | FE 82; BE 558 passed / 0 failed; D8 empty-VAT Invoice PDF test aligned | SettingsHttpIsolationTests | tested |
| 2026-10-04 | Pending-pages inventory | local | 19a581b | n/a | n/a | n/a | ROUTE-MANIFEST vs §10 completeness | list gaps | 60 routes shell/smoke-only; full §10 open | Desktop/HexaBill_Backups/pending-pages-61-20261004.json | implemented |
| 2026-10-04 | §10 field-edge owner ext | local | WIP | FH1/FH2/GH/ZY | owner | 360 | 12 pages ×4 | non-blank shells | ok=48 fail=0 warn=4 | Desktop/HexaBill_Backups/field-edge-owner-ext-final-20261004 | tested |
| 2026-10-04 | §10 field-edge staff | local | WIP | FH1/FH2/GH/ZY | staff | 360 | 12 pages ×4 | non-blank shells | ok=48 fail=0 warn=16 | Desktop/HexaBill_Backups/field-edge-staff-final-20261004 | tested |
| 2026-10-04 | §10 field-edge ×4 | local | WIP | FH1/FH2/GH/ZY | owner | 360 | 7 Phase-7 pages ×4 | non-blank shells | ok=28 fail=0 warn=4 | Desktop/HexaBill_Backups/field-edge-4tenants-20261004 | tested |
| 2026-10-04 | SQLite restore copy | local | WIP | n/a | n/a | n/a | copy→backup→restore hash | identical SHA256 | pass (live db locked by API) | Desktop/HexaBill_Backups/sqlite-restore-rehearsal-* | tested |
| 2026-10-04 | Render live SHA | prod | 39ffafb | n/a | n/a | n/a | read-only list_deploys | autoDeploy=no + SHA | live `39ffafb` | Render HexaBill srv-d68jpdvpm1nc7393q4d0 | tested |
| 2026-10-04 | Vercel production SHA | prod | — | n/a | n/a | n/a | list_deployments hexabill-ui | production SHA | 403 forbidden | prj_GRooh8ebxo33R0uy5EspPoe5HmAo | blocked |
| 2026-10-04 | Phase8 params 5VP | local | WIP | FH1 | owner | 5 VPs | 9 detail routes ×5 | shell loads | ok=45 fail=0 | Desktop/HexaBill_Backups/phase8-params-5vp-20261004 | tested |
| 2026-10-04 | Phase8 params 5VP rest | local | WIP | FH2/GH/ZY | owner | 5 VPs | 9 detail routes ×3×5 | shell loads | ok=135 fail=0 | Desktop/HexaBill_Backups/phase8-params-5vp-20261004-rest | tested |
| 2026-10-04 | Ledger CTA ≥44px | local | WIP | FH1 | owner | 360 | field-edge after touch-target bump | primaryMin44 | true (ok=7) | Desktop/HexaBill_Backups/field-edge-ledger-44 | tested |
| 2026-10-04 | Popup-denied PDF fallback | local | WIP | n/a | n/a | n/a | receipt + PrintOptions unit | blocked print → message/download | 8 passed (6 receipt + 2 print) | receiptPreview + printOptionsPopupFallback tests | tested |
| 2026-10-04 | §10 field/edge smoke | local | WIP | FH1 | owner | 360 | 7 Phase-7 pages | non-blank + search/CTA checks | ok=4 fail=3 (then script hardened); under-44 CTA warns | Desktop/HexaBill_Backups/field-edge-20261004 | tested |
| 2026-10-04 | Ledger 5VP + receipt HAR | local | 1cf2bdd | FH1 | owner | 5 VPs | `/ledger`+`/sales-ledger`; reprint click×2 | shells + ≤1 receipt POST | ledgerOk=10; receiptPosts=0; reprintSafe | Desktop/HexaBill_Backups/ledger-receipt-20261004 | tested |
| 2026-10-04 | Zayogya regression | local | 68510fe | ZY | n/a | n/a | ZayogyaRegressionSnapshotTests | PASS | 3 passed | dotnet filter ~ZayogyaRegression | tested |
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
| 2026-10-04 | PG isolation 44→55 | PG | — | A/B | — | — | Cross-tenant HTTP + concurrency | deny / single-winner | superseded by 55/55 PASS row above | hexabill_master_loop_test@:5433 | tested |
| — | Page §10 field/edge | local | — | 4 | multi | 360..1440 | interactive acceptance | all cells | NOT RUN | — | planned |
| — | Phases 9–11 | — | — | — | — | — | AI/voice/driver/staging | flags OFF then staging | NOT STARTED (gated) | — | planned |

Client document contents: **not recorded** (gitignored; field names only if needed).

