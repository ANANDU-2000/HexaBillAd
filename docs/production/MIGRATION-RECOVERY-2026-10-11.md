# Production migration incident — 2026-10-11

## Verified target and incident

- Local `main`: `704f802a8204676205a71be61a22e321e15464d0`; working tree initially clean.
- Render service: `HexaBill`, `srv-d68jpdvpm1nc7393q4d0`, repository `ANANDU-2000/HexaBillAd`, branch `main`, auto-deploy disabled.
- Live deployment: `dep-db51iaqd0e5s73dsajvg`, commit `92a5059f9d113c13c5410717055426bc186e7263`.
- `/health`: HTTP 503, `Unhealthy`, schema `InitializationFailed`; `/api/maintenance-check`: HTTP 503, `Unavailable`, schema `InitializationFailed`.
- Render log at `2026-10-10T10:55:05.438263343Z`: `Production database has 2 pending EF migrations; readiness will remain closed.`
- Read-only PostgreSQL query verified database `hexabill`, PostgreSQL 18.6, and 50 applied history entries, ending at `20261003190000_AddPaymentParentPaymentId`. Credentials were loaded privately from existing local configuration and never printed.

## All pending migrations

| Migration | Additive change | Initial status |
|---|---|---|
| `20261010090000_AddVatManagementSnapshot` | `VatReturnPeriods`: SnapshotJson, SnapshotHash, SnapshotHistoryJson, SnapshotVersion (default 0), SnapshotAt | PENDING |
| `20261010120000_AddVatCalculationVersioning` | `VatReturnPeriods`: CalculationVersion (default 0), SourceFingerprint, ReviewedAt, ReviewedByUserId, ReviewedCalculationVersion, ReviewInvalidatedAt, ReviewInvalidatedReason | PENDING |

Both migration sources are identical in the live commit and local `main` (`git diff 92a5059..HEAD -- backend/HexaBill.Api/Migrations`, exit 0, no differences). No historic migration files, customer assets, ledger amounts, or tenant ownership rules are changed.

## Required recovery sequence

1. Obtain destination-specific authorization for a protected full production backup and isolated local restore verification.
2. Backup using PostgreSQL 18 tools; record checksum and verify a complete isolated restore with table row counts. Never publish the backup or customer records.
3. Rehearse the two EF-generated migrations on disposable PostgreSQL with synthetic tenant data; verify defaults, preserved rows, history, compatibility and atomic rollback on a forced failure.
4. Apply the reviewed script atomically to the verified production target with lock/statement timeouts and expected-history guards. No automatic ambiguous retries; no production Down migration.
5. Restart the same deployed Render commit to reset the startup initialization state, then verify live health, maintenance check, migration history and unchanged existing records. Application rollback retains the additive schema.

## Current gate

**PASS (2026-10-11 follow-up):** the user explicitly approved the pending recovery and requested migrations plus backend/frontend redeployments. The previously blocked destination-specific backup/restore operation was approved and completed. Both production migrations are applied; application readiness has recovered. Authenticated four-client verification remains pending, documented separately in `LIVE-CLIENT-VERIFICATION-2026-10-11.md`.

**PASS:** read-only target/deployed-version reconciliation, live 503 reproduction, production history query, exact pending-list/source comparison.

**PASS:** PostgreSQL 18 disposable cluster bound only to `127.0.0.1:55483`, using a generated password in the restricted recovery directory. The EF-generated forward SQL was rehearsed with two synthetic tenants and a locked VAT row. A forced division-by-zero failure rolled back all 12 columns and both history inserts; the successful transaction then verified the two new history entries, all defaults and unchanged old tenant IDs, VAT amounts and lock timestamp. Existing-column SELECTs continued to work after the additive schema changes. No production Down migration was attempted.

**PASS:** `dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --configuration Release --no-build --no-restore --verbosity quiet --logger 'trx;LogFileName=synthetic-postgres.trx' --results-directory <private-recovery-directory>`, with `HEXABILL_TEST_POSTGRES` targeting only the fresh loopback `recovery_tests` database — exit 0, **781 passed, 0 failed, 0 skipped**, duration 54 seconds. All previously skipped PostgreSQL cases ran; the existing tests create synthetic data. TRX is retained privately, not committed.

EF SQL generation: `dotnet ef migrations script 20261003190000_AddPaymentParentPaymentId 20261010120000_AddVatCalculationVersioning --project backend/HexaBill.Api/HexaBill.Api.csproj --configuration Release --no-build --no-transactions --output <private-recovery-directory>/pending-migrations.sql` — exit 0, explicitly configured with a loopback PostgreSQL design-time connection. Script SHA256: `954C3A33AEB42836603372F9497E5F804A1EC4632A05DD3FB7620FB3808CD070`.

Local rehearsal command: `& ./backend/HexaBill.Api/App_Data/migration-recovery-20261011-468fbb03/rehearse.ps1` — exit 0. Native network access required sandbox escalation even for loopback. The first sandboxed cluster ended with its process sandbox; the owned cluster was restarted outside that sandbox. Initial `initdb` argument formatting was corrected before successful initialization. These setup failures did not touch production.

**PASS (follow-up):** full protected production backup, isolated restore, actual migration execution, previous deployed application boot after restart, new backend/frontend deployments and public live recovery. Authenticated financial/customer workflows are not covered by these public checks.

## Resume checkpoint

- Branch: `main`; source/checkpoint parent: `704f802a8204676205a71be61a22e321e15464d0`. Current task: P0-02 live schema recovery.
- Previous failing acceptance is resolved: `/health/ready` returns Ready/Current at `704f802`, and all four trusted client `/api/maintenance-check` endpoints return 200 with maintenance off. Next unrun acceptance is actual production owner login and authenticated page verification.
- The initial backup approval blocker was resolved by the user's explicit follow-up approval. No rejected action was bypassed before that approval.
- Completed: PostgreSQL 18 backup and isolated restore; guarded atomic application of both pending migrations; old-commit restart and user-approved new source deployment. No automatic ambiguous retry or production Down migration ran.
- Current next action: obtain existing production owner/SuperAdmin sign-ins and verify the complete client page/form/feature matrix. Preserve tenant isolation, accountant-controlled VAT basis and existing staff permissions.
- Owned local PostgreSQL is stopped at handoff; cluster/evidence files are retained. Existing unrelated `docs/uiux/PENDING-TODO.md` appeared during this session and is preserved without inclusion in this checkpoint.

Rollback reference: previous Render deployment `dep-db38ea7lk1mc739pbhjg`, commit `bdcc4291319761ab280db5a26c86ef6b5e7ccc4e`. Its rollback compatibility must be verified before use. Render restart retains the current commit and configuration: <https://render.com/docs/deploys> and <https://api-docs.render.com/reference/restart-service> (checked 2026-10-11).

## Completed production recovery and deployments

- Verified service configuration uses internal host `dpg-d68jhpk9c44c73ft047g-a`, database `hexabill`, matching the external target previously verified. No connection credentials were printed.
- Protected full backup: 928,216 bytes; SHA256 `BA0B0AC7C273CC00BE5AF8B7DE5644430ED14E6F7652DA14928A608331A82658`. Backup and all private logs remain in the authorized access-restricted, gitignored recovery directory.
- `pg_dump --format=custom --no-owner --no-acl` and schema-only dump: exit 0. `pg_restore --no-owner --no-acl --exit-on-error --dbname recovery_restore <private-backup>`: exit 0. All **67 public table row counts** and **50 history entries** matched production.
- Exact guarded forward transaction was tested against the restored copy: exit 0; existing VAT rows, every old field, default values and all table counts verified. Guarded script SHA256 `8078E090104BEF2A20DFDD655931DD746755F395B2E5B42B6ABB5B5DA0C248AC`. Guards lock VAT/history tables, require the expected 50-entry pre-state and absent new columns, set 5-second lock/60-second statement timeouts, and compare each existing VAT JSON row after excluding the 12 added columns.
- Production `psql -X -w -v ON_ERROR_STOP=1 --single-transaction -f <private-guarded-script>`: exit 0. Both migrations committed together. History grew from **50 to 52** entries; all other **67 table counts** remained unchanged at migration verification. No original VAT values, tenant IDs, locking fields, invoice/payment rows or prices were modified by the script.
- Render restart of the existing deployed commit succeeded. It initially continued serving the old unhealthy instance, then `/health` recovered to HTTP 200 with commit `92a5059` before the new deployment completed. Direct Render `/api/maintenance-check` returned `403 UPSTREAM_API_FORBIDDEN` after recovery because API requests require the trusted tenant proxy; the four actual Vercel subdomains returned 200 instead.
- User-approved new backend deployment: `dep-db5iuhflot8c73f4mit0`, **live**, exact commit `704f802a8204676205a71be61a22e321e15464d0`, finished `2026-10-11T06:41:48.334979Z` (12:11:48 IST). Existing service settings and auto-deploy policy were not changed.
- Vercel MCP found the linked project but detailed reads returned team-scope 403. Its documented CLI fallback authenticated successfully to exact team `team_U8qgfcFQABNoNtJrAy5QyaZf`, project `prj_GRooh8ebxo33R0uy5EspPoe5HmAo` (`hexabill-ui`). Existing production deployment already used `704f802`; the authorized rebuild was performed with `vercel redeploy dpl_74FFnyqFz8o4ChcMig4mbnLWHPGM --target production --scope team_U8qgfcFQABNoNtJrAy5QyaZf --non-interactive --no-wait` — exit 0.
- New frontend deployment: `dpl_EudWcr84trNpUCKnKNLPnGDvLgoh`, **READY**, exact commit `704f802`, URL `https://hexabill-eo0wfr8gm-anandukrishnapa2000-gmailcoms-projects.vercel.app`, assigned existing `*.hexabill.company` and production aliases. No local untracked files, backups, credentials or new project settings were uploaded.
- Live `/health`: HTTP 200, connected database, deployVersion `704f802`. Authoritative `/health/ready`: HTTP 200, `status=Ready`, `schema=Current`, deployVersion `704f802`, proving the deployed EF registry has **zero pending migrations**. History re-read confirms both new IDs. A source-attribute count is not used as compiled-registry evidence.
- Render error-log query from the new deployment's finished timestamp through the verification call returned **0 entries**, `hasMore=false`; this bounded scan is not proof that every authenticated feature is error-free.
- Source comparison `git diff 704f802..HEAD -- backend frontend middleware.js vercel.json`: exit 0, no runtime changes. Later local documentation commits do not change the deployed application source.
- No paid inference calls, provider data sharing, staff permission changes, password resets or cross-tenant consolidation were performed. No app rollback was required; original `bdcc429` application rollback boot remains NOT TESTED. The previously live `92a5059` booted with the additive schema before the `704f802` rollout.
