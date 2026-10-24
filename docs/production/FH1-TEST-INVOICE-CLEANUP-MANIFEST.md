# FrozenHub 1 test-invoice clean-up: execution manifest (2026-10-24)

Owner-approved goal: only genuine customer invoices stay in active billing. Test invoices leave active billing,
balances and reports through the app's audited delete (void) path. Nothing is physically deleted.

Tenant verified read-only on 2026-10-24 ~09:15 UTC: **TenantId 20 = "FrozenHub Foodstuff Trading L.L.C - S.P.C"**,
owner user 34 (Vahid), staff user 35. FrozenHub 2 is tenant 23 (owner user 40) and is not touched.

## 1. Allowlist (explicit IDs; no name or customer rule)

| SaleId | Invoice | Customer | Total | State now | Linked payment(s) now | Action |
|---|---|---|---|---|---|---|
| 1618 | FH-SMK-1791254849 | 115 FrozenHub Onboard Customer | 10.50 | Paid | 1462 AED 10.50 `Completed` | Delete in app |
| 1629 | 1791254850 | 115 | 10.50 | Paid | 1478 AED 10.50 `CLEARED` | Delete in app |
| 1630 | 1791254851 | 115 | 10.50 | Paid | 1479 AED 10.50 `CLEARED` | Delete in app |
| 1633 | 1791254854 | 115 | 10.50 | Paid | 1481 AED 10.50 `CLEARED` | Delete in app |
| 1634 | 1791254855 | 115 | 10.50 | Pending (PaidAmount 0) | 1482 AED 10.50 `VOID` | Delete in app |

Already deleted, leave as is: 1606 (`0001`, customer 115), 1635 (`1791254856`, customer 115), 1637 (`1791254857`, ISHAKALI, 2 invoice versions kept).

**Special case 1791254855:** PaidAmount 0 with a linked AED 10.50 payment is consistent: payment 1482 is `VOID`
(two "Payment Voided" audit rows on 2026-10-21 12:29 UTC by user 34). No correction needed beyond the delete.

Evidence these are test records: customer 115 is named "FrozenHub Onboard Customer"; every line is product 90
"FrozenHub Onboard Item" (SKU `FH-ONBOARD-1`, 1 PCS each) and no genuine customer invoice uses product 90;
`FH-SMK-…` is the smoke-invoice number that seeded the 10-digit sequence.

## 2. Protected genuine invoices (must not change)

| SaleId | Invoice | Customer | Total | Paid | Status | Payment | Items |
|---|---|---|---|---|---|---|---|
| 1631 | 1791254852 | 128 DILKUSH CAFETERIA L.L.C-S.P.C | 720.00 | 0.00 | Pending | none | 3 |
| 1632 | 1791254853 | 128 DILKUSH | 281.00 | 281.00 | Paid | 1480 CLEARED 281.00 | 2 |
| 1638 | 1791254858 | 130 GOLDEN PLATE RESTAURANT | 299.00 | 299.00 | Paid | 1486 CLEARED 299.00 | 1 |
| 1639 | 1791254859 | 131 ISHAKALI RESTAURANT | 806.00 | 806.00 | Paid | 1488 CLEARED 806.00, receipt REC-2026-0001 | 3 |

Customer balances now (Balance / Pending / TotalSales / TotalPayments): 128 = 720 / 720 / 1001 / 281; 130 = 0 / 0 / 299 / 299; 131 = 0 / 0 / 806 / 806.
No returns, credit notes or VAT return periods exist for tenant 20.

## 3. Dependencies checked (read-only)

- FKs onto Sales: SaleItems, InvoiceVersions, SaleReturns are `ON DELETE CASCADE`; Payments plain FK; CustomerItemPrices `SET NULL`. A hard delete would destroy items/versions, so only soft delete is used.
- FKs onto Payments: PaymentReceipts and PaymentIdempotencies `ON DELETE CASCADE`. The old app delete removed payments (and so receipts); fixed in `75a176a9` to set `VOID` instead.
- InventoryTransactions: each test invoice has one `Sale` movement of −1 on product 90. Product 90 stock now 45.00.
- CustomerItemPrices: no row references a test sale (only 1631, 1632, 1635, 1638, 1639).
- Receipts: only REC-2026-0001 (payment 1488, genuine). None on test payments.

## 4. Order of execution

1. **Release** `ecdfa514`+ to production (contains the void-safe delete). Verify Render live commit and health.
2. **Backup**: fresh Render backup/export; confirm restorable.
3. **Settings** (independent): `FH1-APPROVED-CORRECTIONS-2026-10-24.sql` (approved header + 7000 series).
4. **Owner deletes in app** (Vahid, or platform admin impersonating): Billing History → each allowlisted invoice → Delete → type `DELETE`. Five invoices, nothing else.
5. **Read-only verification by Claude** (section 5) and browser check of Sales Ledger, Billing History, Customer Ledger, invoice preview/PDF of 1791254852/53/58/59.

Rehearsed on synthetic data (`e2e/fh1-test-invoice-void.spec.js`, m390/t768/d1440) and in PostgreSQL (`SaleDeleteVoidsPaymentsPostgreSqlTests`).

## 5. Expected after-state (verify with read-only SQL)

- Sales 1618, 1629, 1630, 1633, 1634: `IsDeleted = true`, `DeletedBy` = acting user, InvoiceNo unchanged, `PaidAmount = 0`, items unchanged.
- Payments 1462, 1478, 1479, 1481, 1482: all present, `Status = 'VOID'`, amounts unchanged.
- Customer 115: 0.00 / 0.00 / 0.00 / 0.00.
- Customers 128 / 130 / 131 and sales 1631, 1632, 1638, 1639, payments 1480, 1486, 1488, receipt 14: **identical to section 2**.
- Product 90 stock 45.00 → 50.00; five `Adjustment` InventoryTransactions, reason `Sale Deleted/Canceled: <invoice>`.
- AuditLogs: five `Sale Deleted` rows with `EntityId` = the five SaleIds and `Voided payments:` in Details.
- No row of tenant 23 or any other tenant changed (compare row counts and max UpdatedAt before/after).

```sql
select "Id","InvoiceNo","IsDeleted","PaidAmount","PaymentStatus" from "Sales" where "TenantId"=20 order by "Id";
select "Id","SaleId","Amount","Status" from "Payments" where "TenantId"=20 order by "Id";
select "Id","Balance","PendingBalance","TotalSales","TotalPayments" from "Customers" where "TenantId"=20 order by "Id";
select "StockQty" from "Products" where "Id"=90;
select "Action","EntityId","Details","CreatedAt" from "AuditLogs" where "TenantId"=20 and "Action"='Sale Deleted' order by "CreatedAt" desc limit 5;
```

## 6. Rollback

The app shows "cannot be undone from here". If a genuine invoice is deleted by mistake, a DB-level reversal is
possible because nothing is removed: set the sale `IsDeleted=false`, restore its payments from `VOID` to their prior
status (from the audit `Voided payments:` list and this manifest), reverse the stock adjustment, recalculate the
customer, and write an audit row. Do this only with the before-state above and owner approval.
