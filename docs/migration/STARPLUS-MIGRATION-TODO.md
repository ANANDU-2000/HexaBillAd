# Starplus to FrozenHub 1 migration — TODO

**State:** `IN_PROGRESS` — read-only live baseline captured; implementation remains gated. No production data has been written.

## P0 gate

- [x] Reconfirm current production health, deployed revision, tenant inventory, and unresolved P0 observations from current read-only evidence; backup/restore status remains unverified.
- [ ] Reconcile prior tracker blockers before proceeding to feature work. The existing tracker records `FH-P0-07` owner action and production backup/approval as blocked; this is historical tracker evidence, not a fresh live check.
- [ ] Review Render's `0.0.0.0/0` source and target database IP allow lists under an owner-approved security decision.

## Migration work

- [x] Locate extracted archive under `frozhen/`; identify JSON, CSV, migration report, and PostgreSQL directory archive.
- [x] Confirm duplicate JSON copies have matching SHA-256 and record structure.
- [x] Add a Git exclusion for local private migration inputs.
- [x] Add and run a deterministic, read-only JSON archive validator against the local archive and invoice reconciliation CSV.
- [x] Confirm Render workspace and inspect both PostgreSQL databases read-only.
- [x] Restore the source dump locally and compare row counts plus deterministic all-table SHA-256 fingerprints to the live source.
- [x] Reconcile the one post-archive receipt and its 12 links; verify all pre-archive receipt rows/links hash-match.
- [ ] Align implementation checkout to deployed SHA `1e260f3f624a9e0ecbf42fc9cef45571076c79d8`; the existing migration tooling branch is based on a stale Oct 25 snapshot and is not current rehearsal evidence.
- [ ] Capture a final post-cutover source snapshot and repeat per-record/source-file checksums.
- [ ] Inspect target/source schema and compare it to the current EF Core model.
- [ ] Validate all source relationships, dates, statuses, decimal values, IDs, and checksums using a deterministic local validator.
- [ ] Review source cutover, customer/product matches, financial exceptions, and historical document policy with authorized owner/accountant.
- [ ] Design the isolated read-only legacy history and approved opening receivables around current HexaBill boundaries.
- [ ] Implement migration-specific import and read-only history access; do not reuse the generic ledger importer.
- [ ] Run isolated PostgreSQL rehearsal, second-run idempotency, crash recovery, rollback, tenant isolation, VAT, stock, and sequence checks.
- [ ] Complete browser acceptance when an authorized session is available.
- [ ] Complete production release checklist and obtain explicit approval before any production write.
- [ ] If approved, execute and verify a controlled production migration; otherwise leave production untouched and report blockers.

