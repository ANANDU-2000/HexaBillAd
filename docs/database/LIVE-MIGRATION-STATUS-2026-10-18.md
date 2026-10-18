# Live database migration status (read-only check, 2026-10-18)

**SUPERSEDED by the owner-authorized write recovery on 2026-10-18:** four migrations applied in one guarded production transaction; 59 history rows, 70 tables, 909 columns, zero pending compiled migrations. All 52 customer ownership fields corrected with other customer fields and existing table data preserved. Fresh full backup and isolated restore verified first. See [PRODUCTION-RECOVERY-2026-10-18.md](PRODUCTION-RECOVERY-2026-10-18.md). The remaining text is historical evidence, not current migration status.

Method: Render read-only SQL connector on `hexabill` (`dpg-d68jhpk9c44c73ft047g-a`). Nothing was written. A direct `psql`/`pg_dump` connection with the pasted password was blocked by the Claude Code permission classifier, so **no migration has been applied by this session**.

## Facts read from live
| Item | Value |
| --- | --- |
| Applied migration rows | 55 |
| Latest applied | `20261017110000_ScopePurchaseReturnNumberToTenant` |
| Public tables / columns | 67 / 871 (unchanged from `LIVE-SCHEMA-2026-10-17.md`) |
| `AssistantDrafts` table | absent |
| `TenantDocuments` / `TenantDocumentVersions` tables | absent |
| Customers with `OwnerId = 0` | 52 of 96 |
| Suppliers / supplier payments with NULL `TenantId` | 0 / 0 |
| Supplier payments with NULL `SupplierName` | 2 (needs a decision before aligning to the model) |
| `BackupFailed` alerts | 21 (no verified backup) |

## Pending (in code, not applied live)
1. `20261018090000_AddAssistantDrafts` (idempotent SQL).
2. `20261018120000_AddTenantDocuments` (idempotent SQL).
3. Data fix: `UPDATE "Customers" SET "OwnerId" = "TenantId" WHERE "OwnerId" = 0` (52 rows; keep a copy of them first). Prepared in `docs/production/RUNBOOK-2026-10-18-assistant-table-and-owner-backfill.sql`.

## Order to apply (needs a database role that can write; run as the application role or hand table ownership to it)
1. `pg_dump -Fc` backup and a test restore into a scratch database.
2. Run the runbook SQL, then the `AddTenantDocuments` SQL.
3. Verify: both tables exist, history has 57 rows, `OwnerId = 0` count is 0.
4. Only then push to main and deploy the backend from Render (auto-deploy is off).

Credentials are not stored in this repository. Rotate the database password that was pasted into chat.
