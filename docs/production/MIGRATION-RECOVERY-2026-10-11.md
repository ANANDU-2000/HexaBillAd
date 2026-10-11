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

**BLOCKED:** automatic approval review rejected the full production database dump because the user's migration authorization did not explicitly authorize exporting sensitive customer and financial data to the local backup destination. A specific authorization question is pending for the restricted, gitignored `backend/HexaBill.Api/App_Data/migration-recovery-20261011-468fbb03` directory and isolated restore. Production has not been modified.

**PASS:** read-only target/deployed-version reconciliation, live 503 reproduction, production history query, exact pending-list/source comparison.

**PASS:** PostgreSQL 18 disposable cluster bound only to `127.0.0.1:55483`, using a generated password in the restricted recovery directory. The EF-generated forward SQL was rehearsed with two synthetic tenants and a locked VAT row. A forced division-by-zero failure rolled back all 12 columns and both history inserts; the successful transaction then verified the two new history entries, all defaults and unchanged old tenant IDs, VAT amounts and lock timestamp. Existing-column SELECTs continued to work after the additive schema changes. No production Down migration was attempted.

**PASS:** `dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --configuration Release --no-build --no-restore --verbosity quiet --logger 'trx;LogFileName=synthetic-postgres.trx' --results-directory <private-recovery-directory>`, with `HEXABILL_TEST_POSTGRES` targeting only the fresh loopback `recovery_tests` database — exit 0, **781 passed, 0 failed, 0 skipped**, duration 54 seconds. All previously skipped PostgreSQL cases ran; the existing tests create synthetic data. TRX is retained privately, not committed.

EF SQL generation: `dotnet ef migrations script 20261003190000_AddPaymentParentPaymentId 20261010120000_AddVatCalculationVersioning --project backend/HexaBill.Api/HexaBill.Api.csproj --configuration Release --no-build --no-transactions --output <private-recovery-directory>/pending-migrations.sql` — exit 0, explicitly configured with a loopback PostgreSQL design-time connection. Script SHA256: `954C3A33AEB42836603372F9497E5F804A1EC4632A05DD3FB7620FB3808CD070`.

Local rehearsal command: `& ./backend/HexaBill.Api/App_Data/migration-recovery-20261011-468fbb03/rehearse.ps1` — exit 0. Native network access required sandbox escalation even for loopback. The first sandboxed cluster ended with its process sandbox; the owned cluster was restarted outside that sandbox. Initial `initdb` argument formatting was corrected before successful initialization. These setup failures did not touch production.

**NOT TESTED:** full production backup/restore verification, actual production migration execution, previous deployed application boot on the expanded schema, and post-restart live recovery. The synthetic rehearsal verifies additive SQL compatibility; it is not a live backup restore or production smoke test.

## Resume checkpoint

- Branch: `main`; source/checkpoint parent: `704f802a8204676205a71be61a22e321e15464d0`. Current task: P0-02 live schema recovery.
- Next failing acceptance: live `/health` and `/api/maintenance-check` return 503 instead of healthy readiness.
- Essential blocker: explicit approval for the full sensitive production backup and isolated local restore destination described above. The full dump command was rejected before execution; no live database writes or Render restarts occurred.
- Next action after approval: restart only the owned local cluster, re-query production history/column guards, create the full PostgreSQL 18 backup in the protected directory, restore to `recovery_restore` and compare all public table row counts. Then use the unchanged reviewed two-migration script atomically with expected-history/column guards and bounded lock/statement timeouts. Re-query if a connection result is ambiguous; never blindly replay.
- After schema verification: restart Render service `srv-d68jpdvpm1nc7393q4d0` with its currently deployed commit, verify HTTP 200 readiness and migration history. Do not deploy a different Git commit or remove old additive columns as part of this recovery.
- Owned local PostgreSQL is stopped at handoff; cluster/evidence files are retained. Existing unrelated `docs/uiux/PENDING-TODO.md` appeared during this session and is preserved without inclusion in this checkpoint.

Rollback reference: previous Render deployment `dep-db38ea7lk1mc739pbhjg`, commit `bdcc4291319761ab280db5a26c86ef6b5e7ccc4e`. Its rollback compatibility must be verified before use. Render restart retains the current commit and configuration: <https://render.com/docs/deploys> and <https://api-docs.render.com/reference/restart-service> (checked 2026-10-11).
