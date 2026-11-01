# Starplus source archive reconciliation

**Status:** `IN_PROGRESS` — all-table source hashes match except for the confirmed post-archive receipt delta; final cutover snapshot remains open.

## Local archive inventory

| Record type | Snapshot count | Local evidence |
|---|---:|---|
| Customers | 81 | JSON top-level collection and customer reconciliation CSV |
| Products | 283 | JSON top-level collection and product mapping CSV |
| Invoices | 5,109 | JSON linked plus customerless invoices; CSV has 5,109 unique source invoice IDs |
| Invoice items | 10,627 | JSON nested item rows and snapshot summary |
| Payments | 5,330 | JSON nested payment rows and snapshot summary |

Four local JSON copies have the same SHA-256: `3177ec87d661c75c71e0da9d550c3492e1fcefb1840ed21f2acd2fdf445f4475`.

The read-only validator confirms 5,109 distinct source invoice IDs and exact ID parity with all 5,109 rows in `Starplus_Invoice_Reconciliation.csv`; there are no repeated IDs or missing IDs between those local artifacts. It found no invalid dates, decimal values, or product references in the archive.

## Exceptions visible in supplied evidence

- 11 invoice rows are unattributed to a customer and must remain explicitly classified.
- Archive metadata reports 19 invoices without items, including 17 active invoices.
- Archive metadata reports 2,072 invoice line/grand-total differences.
- The validator's explicit rule (`sum(item.line_total)` vs `grand_total`, absolute difference greater than AED 0.01) flags 2,156 invoices. This differs from the archive's 2,072 count; the source report's calculation method must be identified before reconciling this result.
- Payment status validation must retain five `PENDING` records as unsettled; local status counts show 5,322 `CLEARED` and 5 `PENDING`.
- Customer mappings (81) and product mappings (283) are review candidates; all approvals are pending.
- The supplied deep-dive report separately identifies residual balances, overpayments, cached customer balance mismatches, and source cutover confirmation as open review items.

These are snapshot findings only. The detailed validator report was not written in this checkpoint. Do not post, round away, or automatically resolve any financial difference.

## Live Render comparison — 2026-10-31 18:18 UTC

- Source: Render PostgreSQL `starplus_billing_2025`, version 17.9. Destination: `hexabill`, version 18.6.
- Live source counts and payment-status distribution match the local snapshot exactly: 81 customers, 283 products, 5,109 sales (4,916 active / 193 deleted), 10,627 sale items, 5,330 payments (5,325 cleared / 5 pending). Live invoice versions (1,592) and inventory transactions (23,237) also match the local audit JSON.
- **Source snapshot delta:** A local restore of the supplied PostgreSQL dump contains 40 `PaymentReceipts` and 172 `PaymentReceiptPayments`; live source contains 41 and 184. Deterministic SHA-256 hashes over primary-key-ordered `to_jsonb(row)::text` values match for 23/25 source tables. The pre-archive receipt subset (40 rows / 172 links) also matches live hashes exactly. The only difference is one receipt and 12 links generated at 15:24 UTC after the 13:45 UTC archive. Private per-table evidence is saved at `data/starplus_private/STARPLUS-live-fingerprint-comparison-2026-10-31.json`. Capture a final source snapshot after cutover and account for the receipt explicitly.
- Source sales dates are `timestamp without time zone` although the database timezone is UTC. Destination sales dates are `timestamp with time zone`. The DB timezone alone does not prove the intended interpretation of source historical local timestamps; timezone policy remains unresolved.
- The live destination contains five active tenants (IDs 6, 8, 20, 22, 23); IDs 20 (`frozenhub`), 22 (`gulfharvest`), and 23 (`frozenhub2`) were confirmed. The extra active tenant inventory must be reconciled with the earlier four-tenant expectation before production release.
- Target tenant 20 has 6 customers, 15 products, 26 sales including 10 soft-deleted rows, 23 payments (16 CLEARED / 7 VOID), 41 sale items, and 99 inventory transactions. The target has 13 issued numbers in the 7000–7012 range and a separate high numeric smoke invoice. No `starplus:%` Sales external-reference marker currently exists.
- The live target schema includes migration history entries for `20261025190000_AddTenantInvoiceNoIssuedUniqueIndex` and `20261025200000_ExemptStarplusImportsFromReceiptPurchaseUniqueness`, but matching migration files are absent from the active checkout. Live `Sales.RoundOff` is `numeric(10,4)` while current local EF configuration says `decimal(18,2)`. Resolve the deployed-code/schema divergence before adding EF migrations or archive endpoints.
- Render metadata showed `0.0.0.0/0` in both PostgreSQL IP allow lists. This requires a security review and an owner-approved network policy; no allow-list changes were made during this read-only stage.
- The row-hash comparison establishes parity only with the source as queried on 2026-10-31; it does not establish source freeze or final cutover evidence. The local restored dump runs on PostgreSQL 18.1 while live source is 17.9; matching table hashes were observed for all pre-archive records.

## Source snapshot difference report

**PARTIAL / NOT FINAL:** Counts and selected timestamps were compared read-only. A receipt delta is confirmed. Full record-level checksums and the final post-cutover snapshot are still required; the source is not confirmed frozen.

