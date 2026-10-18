# Production schema recovery — 18 October 2026

## Scope and authorization

The owner explicitly requested direct read/write recovery of Render PostgreSQL, pending migrations, schema documentation and publication of the current code to `main`. This supersedes earlier read-only/no-push notes for this task. The target was verified directly as database `hexabill`, role `hexabill_user`, PostgreSQL 18.6. Source at entry: `main`, `41394f78217903cde43fefc0d1d29f33f26e179d`, 47 commits ahead of fetched `origin/main`, plus existing unfinished tenant-document files. Reference screenshots are preserved locally, not automatically published.

## PASS — backup, restore, rehearsal and production transaction

- A fresh consistent-snapshot custom-format backup was created with PostgreSQL 18 `pg_dump`, with ownership/ACL restoration disabled. Size **866,704 bytes**; SHA-256 **`3f40e639f284ec572b4184b57e3ea3721cd9e4c102f29447fccc0bc15e7c8d1f`**.
- A new password-protected PostgreSQL 18 cluster listening only on `127.0.0.1:55497` restored the full backup. **All 67 table row counts and full-row hashes matched** the exported snapshot, covering **21,223 rows**. Fingerprints use UTC consistently. Raw records were never added to source control.
- The EF-generated forward script was rehearsed against that restore. An injected division-by-zero after the migration operations proved that table creation, history inserts and customer updates roll back together. Successful rehearsal then verified all intended changes and preservation assertions.
- The same script was executed against the verified production target in one explicit repeatable-read transaction, with a 5-second lock timeout and 60-second per-statement timeout. Customers/history were locked; expected history, absent new tables and exactly 52 affected customers were checked before changes. No ambiguous automatic retry, `Down`, dropped table, or deleted customer record was used.
- Script SHA-256: **`537e32c9b91ffe2c60212746c1968a3637cd85d1b8442ca4dadcd6fc128222c0`**. The protected recovery controller and exact generated SQL remain with the private evidence.

| Migration | Verified result |
|---|---|
| `20261017120000_DeclareProductBarcodeUniqueIndex` | Records the existing tenant/barcode unique partial index; omitted by the earlier status note |
| `20261018090000_AddAssistantDrafts` | Creates the draft table and its indexes |
| `20261018120000_AddTenantDocuments` | Creates document/version tables and indexes |
| `20261018130000_BackfillCustomerOwnerId` | Corrects 52 unset legacy ownership fields to each row's existing verified tenant; preserves existing nonzero values |

Migration history increased **55 → 59**; public tables **67 → 70**; columns **871 → 909**. The transaction verified that every customer field except the intended `OwnerId` changes was unchanged, customer count remained 96, all other pre-existing table hashes were unchanged, and the three new tables were empty. Existing financial rows, tenant IDs, audit rows, prices and stock were preserved.

Live EF `migrations list` completed with no `(Pending)` entries. Existing historical history entries were preserved rather than fabricated or removed. Post-transaction `/health/ready` returned HTTP 200, `Ready / Connected / Current`, still serving **`84c9e1ff83ef768c9206c891e890b5387c71ba46`**. This verifies compatibility with the running application; a restart/rollback boot was not performed.

## Private credentials and recovery artifacts

The owner's requested production connection settings are stored in an access-restricted local environment file:

`%LOCALAPPDATA%\HexaBill\production-recovery-20261018\.env.production.local`

The directory inherits no broad filesystem permissions and grants access to the current Windows account. It is outside Git and OneDrive. It also contains the full backup, schema dump, pre-change customer ID/owner mapping, restore evidence, migration evidence and private test results. Passwords, connection URLs with passwords, actual customer records and raw error messages are excluded from Markdown/Git. Rotate the password exposed in chat through a coordinated Render connection update; no uncoordinated password reset was attempted.

Rollback: retain the additive tables/indexes/history when rolling back application code. If customer metadata must be reverted, use the exact protected pre-state mapping with guards against subsequent changes; never set all owners to zero. Do not restore an old full backup over newer production writes. A full restore was tested into an isolated database only.

## Save-path findings

- Existing unpublished code includes the product barcode transaction/execution-strategy fix, barcode conflict handling, customer ownership assignment and UTC JSON date handling. Those changes need backend deployment before their behavior can be claimed live.
- This checkpoint fixes an additional expense recovery bug: when a POST commits but its successful response lacks the row ID, reconciliation reassigned a `const`, throwing `TypeError: Assignment to constant variable`. The response binding is now mutable. A real synthetic browser test failed on the old binding and verifies one POST, one persisted expense, no client save exception and survival after reload on the fix.
- The seven-day bounded live error scan returned **33 rows**: **32 logo-storage errors** and **one historical product barcode auto-fill error**. No missing-table/column signature appeared in those rows. This limited log scan does not certify every feature.
- Comparing the current synthetic model schema with production found **zero missing model tables or columns**. Five live-only business columns and six nullability differences remain; their detailed catalog definitions are in the schema reference/private comparison evidence. Two supplier payments have NULL `SupplierName` and NULL `Mode`; no supplier/payment has NULL `TenantId`. Their missing business values were not invented. Historical migration-chain problems were preserved; no unrelated cleanup was attempted.

## Verification commands and status

| Check | Result |
|---|---|
| `dotnet build tests/HexaBill.Tests/HexaBill.Tests.csproj --configuration Release --no-restore --nologo --verbosity quiet` | PASS; 0 errors, 45 warnings |
| Targeted PostgreSQL/customer/document tests | PASS; 31 passed, 0 failed, 0 skipped |
| Full backend with `HEXABILL_TEST_POSTGRES` on the new synthetic-only database | PASS for executed cases: 985 passed, 0 failed, 1 skipped |
| Skipped backend case | NOT TESTED: opt-in fresh migration-history rehearsal; known historical chain cannot build an empty DB. Actual pending migrations were separately rehearsed on the verified full restore, including rollback. Fresh-database baseline tests ran in the full suite. |
| `npm test` | PASS; 220 passed, 0 failed, 0 skipped |
| Backfill preservation and missing-tenant refusal tests (final targeted run) | PASS; 2 passed, 0 failed, 0 skipped; missing-tenant batch aborts without partial changes |
| `npm run build` / `npm run lint -- --quiet` after expense correction | PASS; both exit 0. Browser-data age, chunk-size and mixed-import warnings remain. |
| Browser customer + expense create/recovery/refetch at 360/390/768/1024/1440 | PASS; 40 passed, 0 failed, 0 skipped; synthetic API + PostgreSQL, never production data |
| Browser product create/refetch/reload/edit/deactivate at the same five widths | PASS; 5 passed, 0 failed, 0 skipped |
| Production authenticated create/edit/save/refetch | NOT TESTED; database permission is not an application login |
| Backend deployment | BLOCKED on an authenticated Render connection; Render was not installed and computer-use inventory had no available browsers. Database credentials cannot deploy a web service. Installation/authentication requested while independent verification continued. |
| Push to `main` | IN_PROGRESS; remote SHA will be verified after publication |

No paid provider requests, AI data sharing, microphone/location tracking or tenant-permission changes were performed. AI enablement remains unchanged.

Exact browser commands (with runtime-only synthetic credentials, loopback PostgreSQL port 55497):

```powershell
./scripts/run-customer-save-qa.ps1 -Database hexabill_codex_browser_20261018 -PostgresPort 55497 -ResumeFixtures -Spec @('e2e/customer-save-contract.spec.js','e2e/expense-autofix.spec.js') -Projects m360,m390,t768,d1024,d1440
./scripts/run-customer-save-qa.ps1 -Database hexabill_codex_browser_20261018 -PostgresPort 55497 -ResumeFixtures -Spec e2e/products-crud.spec.js -Projects m360,m390,t768,d1024,d1440
```

The new missing-ID browser case failed on the old code with `TypeError: Assignment to constant variable`, then passed on the fix. The guarded runner now accepts separate spec arguments, avoiding shell-pipe interpretation of a combined regex. Initial local recovery-controller setup required correcting child-process log handling, loopback SSL settings and autocommit use; restoration verification required consistent UTC fingerprints. Those setup failures touched only disposable local infrastructure. No production change was attempted before the restore and rehearsal gates passed.

## Refreshing the schema reference

Run the reusable read-only exporter (requires `psycopg2`):

```powershell
python scripts/export-postgres-schema.py --env-file "$env:LOCALAPPDATA/HexaBill/production-recovery-20261018/.env.production.local" --output docs/database/LIVE-SCHEMA-2026-10-18.md
```

The reference records every public table and column, type, nullability, default, primary/foreign key, index, sequence definition, trigger and migration ID. It excludes live record IDs/values. Full records and their IDs remain recoverable from the protected backup. Schema documentation: [LIVE-SCHEMA-2026-10-18.md](LIVE-SCHEMA-2026-10-18.md).

## Resume

Current task: P0 production save/schema recovery. Source at entry: `41394f7`; final checkpoint is the commit containing this report. Synthetic verification is complete; publish reviewed code, then deploy it once Render is authenticated. Recheck live version and authenticated product/customer save/refetch; inspect the unresolved logo object/storage error separately. Do not infer deployment from a successful Git push. The password-protected local cluster is stopped after verification and its files are retained privately for resumption.
