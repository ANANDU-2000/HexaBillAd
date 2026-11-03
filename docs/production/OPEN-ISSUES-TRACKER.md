# Open issues tracker — HexaBill production (updated 2026-11-03)

Status key: DONE (live, verified) · PENDING-OWNER (needs owner action or decision) · OPEN (code work not started) · WATCH (known risk)

## Approved actions
| # | Action | Status | Notes |
|---|---|---|---|
| A1 | Record 92.00 cash for Crystal Freeze (ID 153), invoice 7032 | PENDING-OWNER | Needs a logged-in owner session. Not done by Claude: no owner credential, and signing tokens with the production secret to act as the owner is not an acceptable route. Owner records it in Customer Ledger → Receive Payment, then confirms the ledger shows 0 for invoice 7032. |
| A2 | Save approved changes (data repairs, code fixes) | DONE | Ledger balance fix `7c967bc7`; historical status repairs (6 + 33 invoices), backups in `~/.hexabill-ro/ralph/backup/`. |

## Done and verified
- Profit excluded output VAT (`514f468f`); FrozenHub 1 3-Nov gross 827.85.
- Starplus payments no longer reduce live balance; payment edit returns saved values (`514f468f`).
- Screen refresh after writes; stale pending payment settled with the server (`2f98ec36`).
- Purchases linked to supplier records (`514f468f`); cost snapshots ON for tenants 20/22/23 (backfill 120 lines).
- Ledger shows customer credit from approved returns (`7c967bc7`).
- Full PostgreSQL suite 2,325 pass / 1 load flake (print matrix, passes alone 608/608); frontend 397/397; build OK.

## Open — needs owner decision
| # | Issue | Evidence | Decision needed |
|---|---|---|---|
| D1 | 9 historical customers' cached balances not supported by live data (e.g. 136: 8,954.00; 138: 5,301.75; 142: 2,950.71) | SQL check E | Keep as cut-over balances, or recalculate |
| D2 | Zayoga INV0001 (sale 536): paid 1,340.09 vs receipts 1,227.03 (gap 113.06) | SQL check A | Find the missing receipt or record an adjustment |
| D3 | Negative stock: FrozenHub 1 Mutton 6 Way Cut −15.50 KG (product 1037); Test tenant 8 "1200 T15" −800; Zayoga 27 products | SQL check D | Physical count, then stock adjustment |
| D4 | Purchase edit ignores a corrected unit cost for the same product/unit | code: PurchaseCostBasis.Capture | Allow line-level cost correction? |
| D5 | Vouchers 2/11 and 3/11 do not match system (Tikka 500 vs 457; Frozen Magic 1523 vs 1670; Crystal 92 vs 355; Gulf Harvest 5281 not entered; Stick Magic 575, Abayan 199/190 missing) | handwritten vouchers | Owner confirms each line; then corrections |

## Open — code work (in priority order)
| # | Issue | Risk | Planned fix |
|---|---|---|---|
| C1 | Unconfirmed payments kept only in the browser tab; closing the tab can lose the record, risking double entry | High | Server-side lookup by customer/amount/date before re-entry |
| C2 | Status words differ by page (Pending / Unpaid / Partial) | Medium | One shared status map |
| C3 | Pending-bills table (backend `GET /api/customers/pending-summary`, component `CustomerPendingBillsTable`) not mounted on any page; live route not yet confirmed after deploy | Medium | Mount on Customers page; verify route on live backend |
| C4 | Tablet/phone check of all 8 tabs not done (768/1024/360/1440 px) | Medium | Playwright matrix |
| C5 | Payment confirmation: 30 s client timeout; reconcile window about 4.5 s | Medium | Longer server-side reconcile; clearer "saving…" state |

## Watch
- Render cold starts after idle add latency; dashboard 0.4–0.8 s, payments 0.03–1.5 s in logs.
- Print matrix test flakes under full-suite load.
- Tablets/phones must reload once to receive the newest frontend build.
