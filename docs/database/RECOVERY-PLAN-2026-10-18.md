# Production recovery plan — 18 October 2026

Status: PLAN PREPARED; implementation and live acceptance remain incomplete. This checkpoint follows the owner's request to plan first. Inspection was read-only against production; no migration, deployment, production record write or Git push was performed in this checkpoint.

## Verified current state

| Check | Result | Evidence and limits |
|---|---|---|
| Active checkout | PASS | `main`, source `4b85b226c5cda4445b0ea89e4b892ec7897089d5`; tracked files initially clean; reference image folder untracked and preserved |
| Published source | PASS | `git ls-remote origin refs/heads/main` returned the same SHA; the earlier code publication is already complete |
| Render target | PASS | Owner selected `My Workspace`, `tea-ctr63al2ng1s73ersr5g`; service `srv-d68jpdvpm1nc7393q4d0`, repository `ANANDU-2000/HexaBillAd`, branch `main`, Singapore; auto-deploy off |
| Live backend | PASS for availability; deployment behind source | Latest live deploy `dep-db9iamvavr4c73e6gpvg`, SHA `84c9e1ff83ef768c9206c891e890b5387c71ba46`. `/health/ready` HTTP 200, Ready / Connected / Current at 2026-10-18T03:56:36Z |
| Vercel target | PASS through CLI | Project `prj_GRooh8ebxo33R0uy5EspPoe5HmAo`, team `team_U8qgfcFQABNoNtJrAy5QyaZf`; repository HexaBillAd, production branch main |
| Live frontend | PASS for deployment metadata | Production `dpl_6CaSyxSuR7Br8nCV2ZCtuJoxLjbR`, READY, source `4b85b22`; wildcard `*.hexabill.company` retained. Gulf Harvest login HTTP 200, asset `/assets/index-C7xkt4XT.js` |
| Maintenance | PASS for current public check | Gulf Harvest `/api/maintenance-check` HTTP 200, `maintenanceMode:false`. This does not test authenticated saves |
| Database identity | PASS | Render database `dpg-d68jhpk9c44c73ft047g-a`, database `hexabill`, role `hexabill_user`, PostgreSQL 18.6, available |
| Schema inventory | PASS | Fresh direct TLS read-only export: 70 public tables, 909 columns; fields/types/defaults, primary/foreign keys, indexes, sequences, triggers and migration IDs in [LIVE-SCHEMA-2026-10-18-RECHECK.md](LIVE-SCHEMA-2026-10-18-RECHECK.md) |
| Pending known migrations | PASS | All 45 migration IDs declared in current source exist among 59 live history IDs; zero missing. Offline compiled EF list contains the same current migration set. Fourteen additional historical live IDs are preserved, not deleted or fabricated |
| Customer metadata | PASS for bounded count | 96 customers; zero `OwnerId=0`. The earlier four-migration recovery is already applied; DO NOT rerun its transaction |
| Supplier data quality | OPEN | Zero suppliers/payments without TenantId; two supplier payments lack SupplierName and two lack Mode. No values inferred or written |
| Error-log triage | OPEN | Last seven days: 32 logo-path errors, one product-path error, all unresolved. Latest logo error 2026-10-17T10:25:18Z; latest product error 2026-10-13T17:58:24Z. No matching missing-table/column signature in these 33 rows; this bounded scan is not proof of no errors |
| Recovery artifacts | PASS for presence/integrity only | Existing full dump SHA256 `3f40e639f284ec572b4184b57e3ea3721cd9e4c102f29447fccc0bc15e7c8d1f` rechecked. Previous restore/rehearsal evidence is recorded in [PRODUCTION-RECOVERY-2026-10-18.md](PRODUCTION-RECOVERY-2026-10-18.md); no restore was rerun here |
| Credentials requested by owner | PASS for existing private storage | Both libpq environment settings and internal/external URLs already exist in the protected local recovery directory. Parent ACL inheritance disabled, current Windows account only; files inherit that ACL. Values never printed or copied into Markdown/Git |
| Authenticated production CRUD | NOT TESTED | No application sign-in or create/edit/save/reload operation in this checkpoint |
| Test suites | NOT TESTED in this checkpoint | Prior test results remain dated evidence, not new passes |

The first attempted Gulf Harvest URL used `.com` and failed; repository deployment evidence established the correct `.company` domain, which succeeded. Render rejects multiple SQL commands in one prepared query; the initial combined count query failed and was corrected to a single read-only SELECT. Neither attempt changed data. The Vercel connector detailed project request returned 403; the documented CLI fallback succeeded for the same exact team/project. These integration failures are not application save failures.

## Tenant reconciliation

Live inventory contains exactly five Active tenants: 6 / zayoga, 8 / tenant-8, 20 / frozenhub, 22 / gulfharvest, 23 / frozenhub2. The business identity and intended client status of `tenant-8` are unconfirmed. Do not rename, merge, delete or create tenants to match historical four/seven-company statements. Gulf Harvest pilot URL: `https://gulfharvest.hexabill.company/login`.

## Collect existing work before release

| Location | Finding | Required next action |
|---|---|---|
| Active main | Published and matches Vercel, ahead of Render | Treat this source as the release candidate; retain all existing commits |
| `codex/products-field-qa` | One commit outside main's ancestry, but `git cherry main` marks it patch-equivalent | No automatic cherry-pick; avoid duplicating an already applied product fix |
| `codex/return-balance-reconciliation`, `codex/return-branch-route-parity`, `codex/main-publication-source-20261017` | Same older six-commit tip `2ec0691`; four financial code commits plus two documentation commits outside main's ancestry | Compare behavior, not just commit ancestry. `InvoiceReceivables.cs` and return-balance E2E are identical between the return branch and main; main contains 128 additional lines in PostgreSQL return tests. ReportService/SalesLedger still differ. Reproduce any missing behavior on main before adapting a narrow patch; merging the old branch wholesale would remove newer work |
| Codex worktree `C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp` | HEAD `846ee95`, 33 modified tracked files and five untracked files. Payments, returns, daily close, printing, tenant/settings code and tests | Preserve an exact private patch plus untracked files before reconciliation; review one concern at a time against main. Nothing in this worktree was edited or staged here |
| Cursor worktrees ending `yey`, `xna`, `yqc` | Each `git status` fails because its `.git` pointer references an old checkout path | Preserve files before repairing Git metadata. Compare bounded diffs against current main and their recorded commit IDs; do not prune/delete the worktrees or blindly copy them over main |
| `refactor-handoff-20261004`, `vat-tracking`, `main-AnanduPC`, `DEV` committed tips | `git cherry main` shows zero remaining commits | Their committed tips add no unpublished patch; uncommitted work remains a separate concern |
| `hexabill_al_uiuimages/` | Untracked reference screenshots | Retain locally; audit register identifies a credential-bearing screenshot. Do not add the directory to a public push |

## Ordered execution

1. **SOURCE-RECONCILE — preserve and compare work.** Archive the dirty Codex worktree changes privately, preserve broken Cursor worktree contents, and map each real missing fix to the existing tracker. Reproduce the return/receivables contract on main before changing financial code. Exit: a concrete commit/file disposition; no unexplained financial patch omitted, duplicated or overwritten. Keep financial writes, tenant isolation and migration history unchanged during source reconciliation.
2. **SAVE-01 release validation.** On disposable PostgreSQL with synthetic tenants, verify product/customer create, duplicate barcode/email, branch/route requirements, UTC dates, double submit, lost response and successful-save/failed-refresh behavior. Also run return reconciliation and existing tenant-isolation cases, including forged tenant and foreign invoice IDs. Reuse the guarded QA runner. Run required backend/frontend checks for any changed code; report skips explicitly. Prior 985 backend passes / one opt-in fresh-history skip, 220 frontend passes and 45 browser passes are historical evidence to reuse as context, not a new certification.
3. **OPS-01 migration decision.** Present condition is zero pending current-code migrations: make no production schema change. Preserve all 59 history rows. If reconciliation introduces an actual migration, generate/review exact forward SQL, make a fresh protected backup, verify an isolated restore, rehearse migration and forced rollback, check old/new application compatibility, then apply only the reviewed transaction with timeouts and preservation guards. Never use a broad repair script, Down migration or invented supplier-payment metadata.
4. **Release the verified commit.** Commit/push only reconciled, tested source without secrets, screenshots, backups or customer exports; verify remote SHA. For Render, trigger the exact approved commit on `srv-d68jpdvpm1nc7393q4d0`; retain existing environment and deployment settings. Record previous deploy/SHA and rollback path. Wait for live status, readiness and exact deployVersion. Vercel already serves the entry commit, so redeploy only if the verified release changes the frontend or inspection proves a release fault. Verify READY, exact commit, wildcard domains and proxy behavior rather than redeploying blindly.
5. **Gulf Harvest live acceptance.** After deployment, use the owner's Chrome session; owner enters application credentials. Verify create product/customer, one submitted request, actual saved ID, list/search visibility and reload/refetch on the real tenant. Use explicitly marked master-data test records under the owner's live-test authorization; no sale/payment/stock adjustment or ledger posting is needed. Record IDs privately and deactivate a test product through the authorized normal flow when appropriate; no permanent deletion. Check desktop/tablet/phone layouts at 360/390/768/1024/1440. Chrome's ordinary window is discoverable through native Computer Use; browser-tab connector inventory currently exposes only the in-app browser, so do not assume a connected Chrome tab API. No authenticated UI result has been obtained yet.
6. **Fix each remaining demonstrated issue sequentially.** Capture failed request/status/correlation and actual persisted result. Prioritize remaining save uncertainty, wrong-tenant printing, account access, product/customer behavior, then logo retrieval/storage. Fix locally with a regression, validate on PostgreSQL/browser, update the tracker, release the narrow checkpoint and repeat the affected pilot flow. Handle supplier payment metadata through verified source records and a reviewed business decision. Do not label all issues fixed from readiness/build success.
7. **Expand acceptance and features only after P0 gate.** Test the remaining verified client subdomains and existing route/page matrix. Reconcile audit items with current code before implementation: activity route/error states, purchase picker, VAT refresh, tablet navigation, Daily Close, storage privacy, admin counts and resource metrics already have dated work in the tracker. Continue open items only. Documents/AI/voice/maps/forecasting require their existing permission, privacy, provider-budget and deterministic-finance gates; no blanket feature enablement or paid provider use.

The user's request authorizes the named production recovery/push/deploy scope; routine confirmation is not needed again. The explicit request to **plan first** is why this checkpoint stops at the reviewable plan. A future operation introducing paid usage, destructive data changes, a different production target or changed security/data-sharing policy remains outside this authorization.

## Audit-kit reconciliation

All eight Markdown files are indexed here; their historical archive findings are not current live PASS claims. The 309-row register was processed for issue references; screenshots were not visually re-audited in this checkpoint.

| File | Lines | Use in this plan |
|---|---:|---|
| `README.md` | 22 | Scope and evidence vocabulary; original audit was not a deployment |
| `01_Audit_and_Roadmap.md` | 216 | P0 save/account/storage triage before UX/AI; current counts/deployments override screenshot claims |
| `02_AI_and_Tenant_Architecture.md` | 195 | Existing ERP services remain authoritative; private tenant documents and reviewed drafts; later milestone |
| `03_Codex_Execution_Goal.md` | 51 | One bounded task at a time, real save/refetch evidence, preserve existing work |
| `04_Screenshot_Register.md` | 330 | 309 historical images. Issue references: UX-06 107, UX-03 44, UX-02 16, REL-03 14, UX-05 11, UX-04 8, VAT-01 8, DATA-01 6, SAFE-01 6, SAVE-01 6, REL-02 2, UX-01 2, AI-01 2, SEC-01 1, REL-01 1, OPS-02 1; 74 without issue ID |
| `05_Folder_Cleanup.md` | 72 | No cleanup/deletion until references and behavior checked; preserve assets, migration history and worktrees |
| `06_Verification_Record.md` | 48 | Original audit lacked full runtime/production testing; its failures and NOT TESTED labels remain historical |
| `08_Tablet_UX_Spec.md` | 80 | Save/refetch, readable money, predictable scroll, reachable actions, responsive and keyboard acceptance |

## Commands and evidence from this checkpoint

Successful commands: `git status --short`; `git branch --show-current`; `git rev-parse HEAD`; `git ls-remote origin refs/heads/main`; `git branch -avv`; `git worktree list --porcelain`; bounded `git cherry`/diff checks; Vercel project inspect and filtered project API via CLI for the exact team/project; read-only Render inventory/deploy/catalog/aggregate queries; direct schema exporter below. Targeted source-migration-ID comparison: 45 current / 59 applied / zero missing / 14 historical-only.

```powershell
python scripts/export-postgres-schema.py --env-file "$env:LOCALAPPDATA/HexaBill/production-recovery-20261018/.env.production.local" --output docs/database/LIVE-SCHEMA-2026-10-18-RECHECK.md
dotnet ef migrations list --project backend/HexaBill.Api/HexaBill.Api.csproj --no-build --no-connect
vercel --scope team_U8qgfcFQABNoNtJrAy5QyaZf project inspect hexabill-ui
```

These commands exited 0. The offline EF command explicitly cannot determine pending status; the separate current-source/live-history comparison provides that evidence. It is not a fresh-empty-database migration rehearsal. Private artifacts remain in `%LOCALAPPDATA%/HexaBill/production-recovery-20261018`, outside Git/OneDrive. Schema and operational IDs are documented; individual customer/staff/financial rows and their IDs remain in protected recovery artifacts rather than a public Markdown export.

## Resume

Branch: `main`. Source entry commit: `4b85b22`. Current task: SOURCE-RECONCILE. Next acceptance: whether any financial behavior is missing from main compared with the older return branches and dirty worktree. Exact next action: preserve the dirty Codex worktree as a private patch plus untracked-file archive, then compare ReportService/SalesLedger behavior and run the main return-balance tests on disposable PostgreSQL. Next production action after source/test gates: deploy the verified exact backend commit; do not rerun already applied migrations. Authenticated live saves, feature completeness, new deployment and new restore drill remain NOT TESTED.
