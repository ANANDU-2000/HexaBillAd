# HexaBill production reliability audit — 2026-11-03

Owner authorization: Anandu, 2026-11-03 (production DB writes, push to `main`, deploy).
Release: `514f468f` (4 commits on top of `80acbea1`). Render deploy `dep-dbl1kn0ae00c73874b80` live 17:32 UTC;
`/api/health` on `api.hexabill.company` reports `deployVersion 514f468f`, database connected.
Vercel production build of the same push: Ready (43 s). All four tenant hosts serve `assets/index-Bmslbimq.js` (frontend source unchanged).

## 1. Profit (PROFIT-1/2) — fixed and deployed

Root cause: every profit figure used `GrandTotal` (VAT included) as revenue. `ProfitService.cs` documented it as the
"single definition". Output VAT was therefore reported as profit.

Live reconstruction, FrozenHub 1, 2026-11-03, before invoice 7043 (the dashboard screenshot):

| | AED |
|---|---|
| Sales incl. VAT (15 bills) | 16,598.00 |
| Output VAT | 790.55 |
| COGS | 15,035.80 |
| Old dashboard (GrandTotal − COGS) | **1,562.20** (exact match to the screenshot) |
| New rule (GrandTotal − VAT − COGS) | **771.65** |

Full day, after the cost backfill (SQL on live data, same rule as the deployed code):

| Tenant | Sales incl. VAT | VAT | COGS (saved cost) | Gross profit |
|---|---|---|---|---|
| FrozenHub 1 (20) | 17,119.00 | 815.35 | 15,475.80 | 827.85 |
| Gulf Harvest (22) | 5,622.95 | 267.75 | 5,019.00 | 336.20 |
| FrozenHub 2 (23) | 1,281.00 | 61.00 | 1,139.00 | 81.00 |

No returns or expenses were recorded on 2026-11-03 in these tenants.

- Zero-cost lines: none in November revenue. Unit mismatch (CRTN/KG): none; every product has conversion 1.
- Zero-margin lines are real sales at cost to GULF HARVEST (7030, 7041, 7042), FROZEN MAGIC (7031), CASH BILL LATHEEF (7029).
- The client's "~1,200" is not supported by the purchase costs in the system. The owner should check the day's purchase unit costs.
- Code: `Modules/Reports/ProfitMath.cs` (one rule), used by the dashboard summary, P&L, daily, product, branch and route profit.
- Test: `ProfitExcludesOutputVatTests` 3/3. On the old code it fails with `Actual 1562.20` (control).

## 2. Cost at time of sale (PROFIT-3) — production data

- `Tenants.FeaturesJson` for 20, 22, 23 = `["sale_cost_snapshots","purchase_cost_snapshots"]` (was empty). New sales store
  the cost at the moment of sale; a later purchase price no longer rewrites past profit.
- Backfill: 120 November sale lines (tenant 20: 86/86, 22: 17/18, 23: 17/17) received the cost of the latest purchase on
  or before the sale day (excl. VAT, per base unit). The one uncaptured Gulf Harvest line has no cost evidence (0.00 revenue)
  and stays an estimate.

## 3. A4 invoice (PDF-1/2/3) — fixed and deployed

Root cause: commit `7383780d` (2026-11-03 morning) set FrozenHub A4 item text to 7pt and put Bank Details as a column
inside the signature row. Invoice 7028 (09:00) printed before it went live; 7043 (18:28) after.

- Item description 10.5pt, numbers 10pt, 5pt vertical padding; text never shrinks with item count; the empty frame filler
  shrinks to 0 at 10 items.
- Bank Details: one block below the whole signature row, above the customer balance footer.
- Regular weight (as 7028 printed). The bundled Noto Sans Arabic has no SemiBold, so SemiBold printed digits in Bold
  beside SemiBold letters ("LEG **18**KG"); seen on the first render and removed.
- Tests: print suites 49/49 including `A4_FooterOrder_SignaturesThenBankThenCustomerBalance` (5/10/20 items) and
  `A4_TenItems_FitOnOnePage_WithTheWholeFooter_AtFullSize`.
- Rendered PNGs (live line data of 7028 and 7043, test-fixture IBAN): `evidence/2026-11-03-fh1-7028-A4.png`,
  `evidence/2026-11-03-fh1-7043-A4.png`, `evidence/2026-11-03-fh1-A4-10-items.png`. 10 items fit on one page; 20 items
  put the signature/bank/balance group whole on page 2.

## 4. Payments (PAY-1..4)

- Since 2026-11-01: 0 duplicate payments; every live sale's `PaidAmount` equals its cleared payments; statuses consistent.
- Create already returns its response before commit, with idempotency and lost-response reconciliation (live since `bce5c926`).
- Fixed: payment edit re-read the payment after COMMIT; a failing read turned a saved edit into an error. It now returns the saved values.
- Fixed: the cached customer balance subtracted payments on Starplus invoices from live sales. STICK MAGIC showed
  −617.00 while owing 585.00 live. Code excludes historical-invoice payments; test
  `HistoricalInvoicePayment_DoesNotReduceLiveCustomerBalance`.
- Production data: 6 fully paid Starplus invoices (6715, 6955, 6960, 6974, 6989, 6991) set to `Paid`; balances of the
  5 affected customers recomputed (137 → 1,078.00, 139 → 3,506.00, 140 → 585.00, 143 → 1,087.00, 147 → 487.00).

## 5. Catalog and suppliers (CAT-1/2)

- Purchases now link to the supplier record (created on first use). Production: 26/26 purchases linked (20: 18, 22: 2, 23: 6).
- FrozenHub 2: 5 products copied from FrozenHub 1 with stock, cost and price 0 (ids 1038–1042). Not copied: 748 CHICKEN LEG
  BONELESS (same SKU as FH2 402) and 759 SHEEF FEET JUNE GOLD (FH2 769 is the same item).

## 6. Gates

- Backend full suite (SQLite/in-memory): 2,208 passed, 0 failed, 115 skipped (PostgreSQL-only).
- Backend full suite on fresh PostgreSQL 18: 2,321 passed, 2 failed, 1 skipped.
  - `ReturnBalancePostgreSqlTests.Ledger_NetsApprovedReturns…(Approved, 15.75, 0, -5)` also fails on unmodified `80acbea1` (pre-existing).
  - `FrozenHubHeaderReproTests…(720x279, 1 item, A5)` passes 128/128 when its class is run alone twice (load-related flake).
- Frontend: source unchanged; Vercel production build of `514f468f` Ready.
- Render logs since the deploy: 0 error-level entries, 0 5xx, 0 `fail:` lines. The only exceptions are the rejected verification tokens below.

## 7. Not verified / open

- Authenticated live API calls (dashboard JSON, live PDF download, ledger, payment edit) were NOT made: the JWT secret
  pasted in chat does not match the one on Render (86 vs 88 characters, different hash), so a verification token was
  rejected (IDX10517). The live numbers above come from SQL on the live database using the deployed rule. Owner check:
  open FrozenHub 1 dashboard for 03-11-2026 → PROFIT TODAY should read 827.85; reprint 7043 → 10.5pt rows, bank below signatures.
- No live test payment was placed (no test transactions in live tenants).
- Cached balances not recomputed: Zayoga (28 customers) and FrozenHub 1 customers 136, 138, 142, 145–150, 154 hold
  imported/cut-over balances that are not in the Sales table; recomputing would erase them. The ledger page already uses the
  server's canonical outstanding. Needs an owner decision on what "Balance" should mean for migrated customers.
- Purchase edit keeps the original line cost for the same product/unit (`PurchaseCostBasis.Capture` with previous lines), so
  correcting a wrong purchase price through Edit Purchase is ignored. Existing behaviour; needs an owner decision.
- Creating a brand-new product from the purchase form is not supported (purchases need an existing product). Not built.
- UI tablet/mobile pass for all 8 tabs: not run in this release.
- Secrets in chat: DB password, Groq key, R2 keys, edge proxy secret and the Render API key were pasted into the
  conversation. Rotation recommended (owner action).

## 8. Follow-up: "payments not working" (client voice note 2026-11-03 evening) — release `2f98ec36`

Live evidence (Render logs + DB, user 34 = Vahid, owner of FrozenHub 1):
- 2026-11-02 13:37–13:54 UTC: 14 attempts to record Khan Darbar's historical payments (1,485 and 1,465) were all refused
  (`POST /api/payments` 400). Cause: the historical-invoice payment check (fixed in `980fe851`, live 2026-11-03 morning).
  The same payments saved on 2026-11-03 (#1509, #1517). This is the "two days of delayed payments".
- 2026-11-03: all 25 payments sent were saved (201 and present in the DB). Edit #1520 saved (200); edit of #1525 was refused
  because #1525 had already been voided. No delete calls. 0 server errors on payment endpoints.
- Frontend defects that made saves look failed, for every customer:
  1. Every GET was cached 30 s and writes never cleared it: right after a save/edit/void the ledger, invoice status and
     balance reloaded as the pre-payment values.
  2. Pending entries for payments saved hours earlier (#1523 at 07:31 UTC, #1511 at 03:32 UTC) stayed in a tablet tab and
     were re-sent at 14:19 and 14:33 (the server correctly replayed the old payment, no duplicate). While such an entry
     exists, a different payment for that customer was refused ("Retry the previous payment before recording a different payment").
- Fix (`2f98ec36`): successful writes clear the client cache; payment/customer/sales/historical/purchase/ledger reads are
  never cached; a different payment first settles the pending one with the server (saved → cleared, not saved → released,
  unclear → wait). Tests `paymentFreshness` 7/7; `npm test` 393/393; `vite build` OK.
- Owner action: on each tablet/phone, close and reopen the HexaBill tab (or pull to refresh) once, so the new code loads.
