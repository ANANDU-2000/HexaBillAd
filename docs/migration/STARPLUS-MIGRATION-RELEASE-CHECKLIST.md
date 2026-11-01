# Starplus to FrozenHub 1 — production release checklist

**Status:** `BLOCKED` — read-only baseline and staging gates are incomplete. No production write has been run.

## Identity and cutover

- [ ] Review the source and destination PostgreSQL `0.0.0.0/0` IP allow-list entries and apply an owner-approved least-privilege policy.
- [ ] Reconfirm source and target database IDs and hosts from the selected Render workspace.
- [ ] Reconfirm target tenant ID 20 and slug `frozenhub`; prove tenant 23/22 and other tenants are outside the migration scope.
- [ ] Reconcile five active tenants against the prior four-tenant expectation and include all tenants in isolation tests.
- [ ] Align the active checkout with the deployed source revision and live Oct 25 migration history/schema before adding database code.
- [ ] Account for the post-archive payment receipt and its 12 links in the final source snapshot.
- [ ] Resolve how source `timestamp without time zone` values represent original business time before mapping to target `timestamptz`.
- [ ] Obtain confirmed source cutover/freeze time and account for every later invoice/payment.
- [ ] Capture a final source snapshot and reconcile counts, keys, statuses, and checksums.

## Mapping and accounting

- [ ] Approve every customer mapping; existing FrozenHub customers remain unchanged.
- [ ] Verify and approve product mappings; no historical stock movement is generated.
- [ ] Resolve or formally approve unattributed invoices, missing invoice items, invoice amount differences, pending payments, residual balances, overpayments, returns/credits, and cached-balance mismatches.
- [ ] Approve legacy VAT/reporting treatment and the opening-receivable method; avoid duplicate revenue, cash, or receivables.
- [ ] Preserve original issuer, TRN, invoice number, date/time, amounts, line snapshots, payment status, deletion status, and document provenance.

## Engineering and recovery

- [ ] Continue from a clean checkout pinned to the live deployed SHA, or otherwise prove exact deployed-code/schema parity before implementation.
- [ ] Implement migration-specific isolated legacy archive; do not use the generic operational sales-ledger importer.
- [ ] Validate current schemas, constraints, EF model, date conventions, decimals, IDs, and sequences.
- [ ] Complete full isolated PostgreSQL rehearsal with representative existing tenant data.
- [ ] Prove repeat-run idempotency, safe crash recovery, migration-owned rollback, tenant isolation, and unchanged stock/VAT/number sequence.
- [ ] Complete backend, frontend, database, and authorized browser checks; skipped checks remain `NOT TESTED`.
- [ ] Complete production backup and tested restoration.
- [ ] Prepare exact run ID, batch plan, manifest, hashes, rollback plan, and owner/accountant sign-off.

## Authorization and execution

- [ ] Obtain explicit approval for the exact production write scope and cutover.
- [ ] Only then run a controlled, audited import into tenant 20.
- [ ] Read back and reconcile every migrated/archived/matched/approved-exception source record.
- [ ] Verify existing FrozenHub rows, numbering, stock, VAT, and every other tenant are unchanged.
- [ ] Verify authorized owner access, read-only legacy display, and post-import evidence.

