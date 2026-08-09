# Zayoga (TenantId=6) — Duplicate customer audit

**DB:** Render `hexabill` (`dpg-d68jhpk9c44c73ft047g-a`)  
**Exported:** 2026-08-09 (read-only MCP query)  
**Total customers:** 104  
**Suffix duplicate groups:** 11  
**Manual review (not auto-merge):** SWEET WORLD ME9 variants

Balance formula (same as `RecalculateCustomerBalanceAsync`):  
`sales − CLEARED payments (non-refund) − approved returns + refund payments`

Many **stored** balances diverge from formula (stale migration). After merge, survivor balance is **recalculated** — we do not preserve bad stored Cr/Dr.

## Suffix groups (CUSTOMER / CUSTOMER NAME)

| Root | Survivor | Losers | Move sales/pays | Predicted bal (AED) |
|------|----------|--------|-----------------|---------------------|
| BAKE OF SWEETS… | **23** | 62, 48 | 1+0 / 0+0 | ~820.66 |
| CALICUT PARADISE | **18** | 63, 49 | 3+0 / 3+0 | ~196.03 |
| FRESH AND TASTY CAFTERIA | **4** | 64, 57 | 1+0 / 1+0 | ~854.59 |
| FRESH SAMOVER | **17** | 65, 52 | 3+0 / 3+0 | ~0.00 |
| GODAVARI RESTURANT LLC | **8** | 66, 37 | 1+0 / 0+0 | ~1194.45 |
| HOUSE BOAT… LLC | **36** | 60, 15 | 3+0 / 3+0 | **~414.77** |
| IDUKKI GOLD RESTURANT BR2 | **13** | 61, 24 | 1+0 / 0+0 | ~2623.97 |
| MALABAR CHAYAKADA | **39** | 67, 56 | 1+0 / 1+0 | ~0.00 |
| PACHA NELLIKKA RESTAURANT | **12** | 68, 46 | 1+0 / 1+0 | ~2894.24 |
| PANOOR RESTAURANT LLC | **20** | 69, 55 | 1+1 / 1+0 | ~1966.67 |
| TALAL RESTAURANT | **7** | 70, 54 | 1+0 / 1+0 | ~904.85 |

### Member detail (HOUSE BOAT pilot)

| Id | Name | Stored | Formula | Sales | Pays |
|----|------|--------|---------|-------|------|
| 36 | HOUSE BOAT… LLC | 414.77 | 414.77 | 39 | 36 |
| 60 | … CUSTOMER | -229.68 (stale) | 0.00 | 3 | 3 |
| 15 | … CUSTOMER NAME | 0 | 0 | 0 | 0 |

FK tables checked: Sales, Payments, SaleReturns, Quotations, CreditNotes, RecurringInvoices, RouteCustomers, CustomerVisits — all zero for route/visit/quote/cn/returns on these groups.

Invoice collisions across different customers in tenant 6: **0**.

## SWEET WORLD (manual only)

| Id | Name | Bal | Sales | Pays |
|----|------|-----|-------|------|
| 22 | … -ME9 | 0 | 1 | 1 |
| 31 | SWEET WORLD GENERAL TRADING LLC | -265.69 | 16 | 11 |
| 44 | … - ME9 | 276.29 | 8 | 5 |

**Recommendation:** keep **31** as primary; do **not** merge 22/44 until client confirms they are the same shop (spacing variants of ME9).

## Empty shell delete candidates (after FK move)

Losers with 0 sales and 0 payments after reassignment are deleted by the merge service.
