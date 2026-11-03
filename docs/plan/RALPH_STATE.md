# RALPH_STATE — live production audit (2026-11-03, ~20:20 Dubai)

Mode: **read-only**. DB via `~/.hexabill-ro/q.sh` (forced `default_transaction_read_only=on`). No code pushed, no data written.

## Live deployment facts
- Backend `https://hexabill.onrender.com/health` → `deployVersion 80acbea1…`, DB connected, 0.46 s, pool 1/100.
- Frontend: Vercel prod deployment created 2026-11-03 13:59:32 IST, 5 s after commit `80acbea1`. All 4 tenant hosts serve `assets/index-Bmslbimq.js`.
- Local `main` has **diverged**: ahead 5 / behind 10 vs `origin/main`. Three local commits are near-duplicates of remote ones (cherry-picks). The only local-only work is `edb6651f` (POS picker filter) and `38367192` (e2e spec). Rebase onto `origin/main` before any new commit.
- Render logs: **BLOCKED**. The Render MCP is signed in to a different account ("ANANDU SBSOL TESTING"), and the HexaBill workspace `tea-ctr63al2ng1s73ersr5g` returns 403. No Render API key is available locally.

## PROFIT-1 — root cause proven (dashboard 1,562.20)
Tenant 20, 2026-11-03, before invoice 7043 (the screenshot moment):

| Item | AED |
|---|---|
| GrandTotal (VAT incl.), 15 bills | 16,598.00 |
| Subtotal (excl. VAT) | 15,810.55 |
| Discount | 3.47 |
| Output VAT | 790.55 |
| COGS (Qty × Product.CostPrice) | 15,035.80 |
| Expenses | 0.00 |
| **Dashboard = GrandTotal − COGS − Expenses** | **1,562.20** (exact match) |
| **True gross profit = Subtotal − Discount − COGS** | **771.28** |

Full day (16 bills, after 7043): the dashboard shows 1,643.20; true gross profit is 827.28.

- Root cause 1 (VAT counted as profit): **CONFIRMED.** `ReportService.cs` sums `salesToday` from `GrandTotal` (returns also use `GrandTotal`), and `ProfitService.cs:3` hard-codes "Profit = GrandTotal(Sales) − COGS − Expenses". Product profit (`ReportService.cs` ~2600, `ProfitService.cs` ~221/249) uses `LineTotal`, which includes VAT. Inflation equals the day's output VAT.
- Root cause 2 (zero cost on sold lines): **NOT PRESENT** in November sales. 0 sale lines with zero product cost on tenants 20 and 23; 1 line on tenant 22 with 0.00 revenue.
- Root cause 3 (CRTN/KG mismatch): **NOT PRESENT.** 0 unit mismatches; every product has `ConversionToBase = 1`.
- Latent: `SaleItems.UnitCostAtSale` is NULL on **every** sale line in every tenant (6,588 + 115 + 18 + 17 + 9). The `sale_cost_snapshots` tenant flag is off, so COGS uses the *current* `Product.CostPrice`. Each new purchase price silently rewrites past days' profit.
- Latent risk: active products with `CostPrice = 0`: tenant 20 = 251/295, tenant 22 = 326/354, tenant 23 = 281/293. Selling any of them before its purchase is entered books a 100 % margin.
- Zero-margin lines are real business: sales at cost to GULF HARVEST (7030, 7041, 7042), FROZEN MAGIC (7031) and CASH BILL LATHEEF (7029).
- The client's "~1,200" is **not supported** by system costs: today's purchase costs are stored excl. VAT (purchase VAT 747.07 is separate). The owner must confirm today's purchase unit costs if they believe 1,200.

## PDF-1/2 — root cause proven
`origin/main` `PdfService.cs` (commit `7383780d` "compact items, 10-row frame, side-by-side bank"):
- `FrozenHubA4ItemFontSize = 7f` (line ~977) is used for both the description and the number columns on bilingual A4. This is the font shrink.
- Lines ~647–662 add `Bank Details` as a **middle column inside the signature row**, between "Receiver's Name/Sign" and "For FROZENHUB…". This is the 7043 complaint.
- 7028 was printed at 09:00 Dubai; 7043 at 18:28 Dubai, after the backend deploy that contains `7383780d`.

## PAY — live data
- Since 2026-11-01: 29 payments (tenant 20: 17, including 7 on Starplus invoices; tenant 22: 7; tenant 23: 5). **0 duplicates** (same customer/amount/target within 5 min, since Oct 1).
- Sales `PaidAmount` = sum of CLEARED payments on every live sale (0 mismatches, 0 status mismatches; the 1 "Paid" with no money is a 0.00 zero-invoice).
- **BUG (data):** 6 Starplus invoices (6955, 6960, 6991, 6989, 6715, 6974) are fully paid (`OutstandingCalculated = 0`) but `Status = 'Pending'`. They were paid at 07:28–07:37 Dubai, before `371b6c8a` ("keep legacy status in step") went live. The code is fixed; the 6 rows need a one-time approved update.
- Idempotency and lost-response reconciliation are already live (`bce5c926`, `414cdf67`).
- 8 VOID payments since Oct 15 (5 are 10.50 AED on customer 115). No evidence of a false failure followed by a retry.

## CAT — live data
- No blank product or supplier names in any tenant.
- Purchases with no supplier master link (`SupplierId` NULL): tenant 20 = 6 names, tenant 22 = 1, tenant 23 = 3.
- 7 active FrozenHub 1 product names are missing from FrozenHub 2.

## CONT — duplicates
- Tenant 20: 0 duplicate `InvoiceNo` between live sales, 0 within Starplus history, and 0 between live sales and Starplus history. (193 of 5,109 Starplus rows are already soft-deleted from earlier dedup.)

## Fix order (next tasks; each needs test-first and owner approval to deploy)
1. [ ] PROFIT-2: one revenue definition, `Subtotal − Discount − (returns excl. VAT)`, across ReportService summary, ProfitService (summary, daily, branch), product profit, Branch/Route. Lock it with a test that uses the 7028–7042 numbers (expect 771.28, not 1,562.20).
2. [ ] PDF-1/2: bilingual A4 item font 10.5 (description) / 10 (numbers); Bank Details as its own block **below** the signature row; text-order test `Receiver's Sign < Bank Details < Customer Balance`.
3. [ ] PROFIT-3: turn on `sale_cost_snapshots` (and `purchase_cost_snapshots`) for tenants 20, 22 and 23. This is a production config write and needs approval.
4. [ ] PAY-4 data: set `Status = 'Paid'` on the 6 Starplus rows above. This is a production data write and needs approval.
5. [ ] Rebase local `main` onto `origin/main` (keep `edb6651f` and `38367192`).
6. [ ] Unblock Render logs: switch the Render MCP to the HexaBill account, or provide a Render API key.
