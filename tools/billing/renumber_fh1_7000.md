# One-time: renumber FrozenHub 1 (tenant 20) into the 7000 series (P0-NUM-004)

Approved by the Engineering Lead at the owner's (Anandu's) request. **Do not run this until** the Starplus import has been
committed and reconciled, and the build that contains `PUT /api/sales/{id}/invoice-number` is live.
Every write goes through the app API (audited). No direct database writes.

| Order | Current no. | New no. | Date | Customer |
|---|---|---|---|---|
| 1 | 1791254852 | 7000 | 20 Oct | DILKUSH |
| 2 | 1791254853 | 7001 | 21 Oct | DILKUSH |
| 3 | 1791254858 | 7002 | 24 Oct 12:01 IST | GOLDEN PLATE |
| 4 | 1791254859 | 7003 | 24 Oct 12:04 IST | ISHAKALI |

Afterwards, the next new invoice must be **7004**.

## 0. Prerequisites
- Signed in as the FrozenHub 1 **Owner or Admin** (the tenant comes from the token; Staff gets 403).
- `INVOICE_SERIES_START` for tenant 20 is `7000` (Settings > "New invoice numbers start at"). Leave it at 7000: the
  next-number rule takes the highest issued number in the series, so 7000-7003 move it to 7004 on their own.
- Keep `$API` (the API base) and `$TOKEN` in your shell only. Never paste a token or connection string into chat.

## 1. Fresh backup
Take a fresh production backup (the normal pre-change backup) and record its file name and time (IST). Do not continue without it.

## 2. Read-only pre-check
Find each sale's id (the API needs the id, not the number):
```
for n in 1791254852 1791254853 1791254858 1791254859; do
  curl -s -H "Authorization: Bearer $TOKEN" "$API/api/sales?search=$n&pageSize=5"
done
```
For each one confirm: exactly one match, `invoiceNo` equals the current number, the sale is not deleted, and the
date/customer/total match the table (720.00, 281.00, 299.00, 806.00). Also confirm 7000-7003 are not used by any invoice
(the dry run in step 3 refuses them if they are, including deleted ones). Write the 4 ids down as ID1..ID4. Then:
```
curl -s -H "Authorization: Bearer $TOKEN" "$API/api/sales/next-invoice-number"   # expect 7000 before the change
```

## 3. Dry run (writes nothing)
```
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"newInvoiceNumber":"7000","reason":"Owner-approved move to 7000 series"}' \
  "$API/api/sales/ID1/invoice-number?dryRun=true"
```
Repeat for ID2/7001, ID3/7002, ID4/7003. Each must return 200 with `dryRun: true`, `oldInvoiceNo` = the current number
and `newInvoiceNo` = the target. Any 400 stops the run. Report the message and do not continue.

## 4. Apply (in this order, one at a time)
Run the same 4 calls **without** `?dryRun=true`, strictly in the order 7000, 7001, 7002, 7003. Each must return 200 with
`changed: true`. If one fails, stop. The ones already done are complete and audited, so re-run the dry run before retrying.
A 409 means the number was just taken or the invoice changed; re-check before retrying.

## 5. Verify
- `GET /api/sales/next-invoice-number` returns **7004**.
- `GET /api/sales/ID1..ID4` show 7000-7003; totals, VAT, paid amount and payment status are unchanged from step 2.
- Audit log has 4 rows with Action `InvoiceNumberChanged` (EntityType `Sale`, EntityId = ID1..ID4). OldValues and NewValues
  hold the old and new numbers. This is where the old numbers stay findable.
- QA checks the preview and the 4 invoice PDFs (they show only the new number).

## 6. After
Anandu reprints or re-sends the 4 invoices to DILKUSH, GOLDEN PLATE and ISHAKALI, because copies they already hold show the old numbers.
Receipts already issued keep their original snapshot (by design).
