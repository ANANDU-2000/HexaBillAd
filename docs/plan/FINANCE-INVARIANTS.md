# Finance invariants

- Durable scoped money/stock identity; retry same payload; reject changes; reconcile unknown outcomes before repost.
- Invoice/customer/supplier balances reconcile to retained posted/voided/reversed ledger rows; cash never inflated by adjustments.
- Same-tenant/customer positive cleared receipt funds only; VOID/refund/adjustment/pending cheque ineligible. Reprint never posts money.
- Immutable financial snapshots, current tenant company header per existing policy.
- Operating profit comparison stays separate from posted VAT, return boxes and payable. Accountant-approved statutory/margin mapping remains OPEN (REL-015/016).
- Expected cash separate from counted cash; audited variance/reason/lock/version/reopen.
- Tenant identity from authenticated context; all roles/search/files/exports isolate.

## Owner-directed 5% comparison, 8 October 2026

Owner requested 5% of profit on VAT Return for other clients except Zayogya. Reused existing tenant VatCalculationBasis=ProfitBased; no client names hardcoded and no production tenant configuration changed. Server adds nullable ProfitVatEstimate = round(max(0, existing rounded ProfitAmount) * .05). Existing profit is sales including VAT minus existing COGS estimate minus expenses. Missing cost snapshots can make this estimate change with current product costs; this is not a statutory margin scheme calculation.

SalesBased responses leave estimate null. Legacy ProfitVat remains zero. All filing boxes, posted sale/payment data and payable calculations unchanged. UI labels comparison not for filing. Invoice wording, scheme eligibility, effective-date and approved filing examples remain unresolved.

Primary FTA guide consulted: https://tax.gov.ae/en/content/profit.margin.scheme.vatgpm1.aspx and its January 2026 PDF. A transaction-specific eligible margin scheme is distinct from this operating-profit comparison.

| Synthetic tenant | Basis after local audited settings API | Profit | 5% estimate | Standard VAT payable |
|---|---|---:|---:|---:|
| gulfharvest-test | ProfitBased | 145.00 | 7.25 | 9.76 |
| frozenhub1-test | ProfitBased | 145.00 | 7.25 | 9.76 |
| frozenhub2-test | ProfitBased | 145.00 | 7.25 | 9.76 |
| zayogya-test | SalesBased unchanged | not returned | null | 9.76 |

Before/after every standard Box1–13 field preserved across all four API reports (Q3 Aug–Oct 2026). SQL final reconciliation: each tenant205 sales /100 invoice paid /100 cleared funds /105 customer pending. Original receipts retained; flags OFF; no production data used.

Focused VAT/Zayogya15/15 and frontend estimate5/5 pass; fresh full backend692/692 (PostgreSQL enabled, zero skips), frontend108/108 pass. Loss produces zero, positive10 profit produces .50, missing estimate shows refresh prompt, SalesBased and tenant switch suppress profit card. Full purchases/expenses/returns/stock/report/DailyClose and persona acceptance remain OPEN.
