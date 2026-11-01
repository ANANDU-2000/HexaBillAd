# Starplus source snapshot difference report

**Status:** `PARTIAL` — full table fingerprints compared read-only at 2026-10-31 18:26 UTC. The source is not confirmed frozen; this is not final cutover evidence.

## Compared sources

- Local archive: directory dump named `2026-10-31T13_45Z.dir.tar.gz` and local JSON/audit extracts.
- Live source: Render PostgreSQL `starplus_billing_2025`, version 17.9.
- Live destination: Render PostgreSQL `hexabill`, version 18.6.
- Read-only Render resource listing confirmed source `starplus-billing-db` and destination `hexabill`; no connection strings or credentials were accessed.

## Counts and statuses

The restored PostgreSQL dump matches the live source by deterministic table fingerprint and record count:

| Record type | Local archive | Live source | Difference |
|---|---:|---:|---:|
| Customers | 81 | 81 | 0 |
| Products | 283 | 283 | 0 |
| Sales | 5,109 | 5,109 | 0 |
| Active / deleted sales | 4,916 / 193 | 4,916 / 193 | 0 / 0 |
| Sale items | 10,627 | 10,627 | 0 |
| Payments | 5,330 | 5,330 | 0 |
| CLEARED / PENDING payments | 5,325 / 5 | 5,325 / 5 | 0 / 0 |
| Invoice versions | 1,592 | 1,592 | 0 |
| Inventory transactions | 23,237 | 23,237 | 0 |

## Confirmed archive difference

| Record type | Local audit JSON | Live source | Difference |
|---|---:|---:|---:|
| Payment receipts | 40 | 41 | +1 |
| Receipt/payment links | 172 | 184 | +12 |

The additional receipt and its twelve payment links were generated at 2026-10-31 15:24 UTC, after the local archive timestamp of 13:45 UTC. All 23 other table hashes match. The 40 pre-archive receipt rows and 172 pre-archive links also match by hash, proving the delta is additive within those tables. Preserve the new receipt and links in a fresh snapshot after cutover.

## Destination scope and data protection

- Live destination lists five active tenants: IDs 6, 8, 20 (`frozenhub`), 22 (`gulfharvest`), and 23 (`frozenhub2`). The prior four-tenant expectation needs reconciliation.
- Tenant 20 currently has 6 customers, 15 products, 26 sales (10 soft-deleted), 23 payments, 41 sale items, and 99 inventory transactions. There are no `starplus:%` rows in its Sales table.
- Tenant 20 has thirteen invoice numbers in the 7000–7012 range and a high numeric smoke invoice. Historical records must stay out of the operational Sales sequence.
- Current target has no `PaymentReceiptPayments` table; its receipt model is tenant-scoped `PaymentReceipts` with `SnapshotJson`. Source receipt relationship history must be retained in an isolated legacy structure.
- Source timestamps are stored without timezone; target uses timezone-aware timestamps. The source database timezone is UTC, but that alone does not establish the intended meaning of legacy timestamps.

## Production P0 observation

The HexaBill Render service reports maintenance mode disabled. `https://hexabill.onrender.com/health/ready` returned HTTP 200 (`Ready`, `Connected`, `Current`) on deploy SHA `1e260f3f624a9e0ecbf42fc9cef45571076c79d8`. No HTTP 503 request logs were returned for the seven-day query window. Authenticated login and customer/print journeys were not tested in a browser.

Render metadata also lists `0.0.0.0/0` in the IP allow lists for both PostgreSQL databases. This is a security review item; the migration inspection did not change any access policy.

## Open verification

- Capture a final post-cutover snapshot and repeat all-table counts and hashes; the source is not confirmed frozen.
- Obtain final source cutover confirmation and recapture the source after all final receipts/transactions are posted.
- Reconcile five tenants against the previous expected inventory.
- Reconcile the active checkout with the deployed SHA and target migration history before schema implementation.
- Confirm source timestamp interpretation and resolve line-total calculation differences.
- A disposable local PostgreSQL 18.1 cluster was created under `%LOCALAPPDATA%\Codex\starplus-pg-rehearsal-20261031`, listening only on `127.0.0.1:55439`. The source dump was restored there, and the local target received only a migration metadata schema plus 26 minimized exception rows. No operational/business rows or production data were written.
