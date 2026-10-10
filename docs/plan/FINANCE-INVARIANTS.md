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

## VAT management report invariants — 10 October 2026

- The VAT Management Report is an internal draft and must say “Management report. Not an FTA filing.” Its internal totals are standard output VAT, recoverable input VAT, and net VAT payable. Do not map those amounts to statutory boxes without an accountant-approved, versioned FTA projection.
- The server report/snapshot is authoritative for displayed and exported totals. Missing detail must produce a warning; do not synthesize lines or replace zeros from browser ledger totals.
- A VAT amount inferred from gross is derived evidence, carries provenance, and blocks freezing until a trusted resolution exists. Preserve signed management adjustments; do not clamp negative values to zero.
- Only tax-effective approved returns are counted. When source sale-line evidence exists, a return follows that sale’s VAT scenario and tax evidence. Purchase-return recovery cannot reverse more than the originally claimed input tax.
- Locked/Submitted output and validation read the hash-checked persisted snapshot. Serialize every VAT-effective write against freeze. Keep this invariant in force for imports and indirect payment/return actions as those paths are brought under the guard.
- Tenant queries use strict authenticated TenantId. Never infer tenant ownership from numeric TenantId/OwnerId equality. Legacy NULL-tenant data remains unresolved until a safe tenant-specific review exists.
- A syntactically valid TRN does not establish registration, so reports show “TRN not verified.” Per user direction, Lock and local mark-filed accept only a valid-format non-sample 15-digit TRN; samples are allowed only with explicit Testing opt-in and are rejected in Production.
- Calculation totals use decimal. The final posted-line source, line-level rounding authority, timestamp convention, returned COGS/stock treatment, entertainment recovery, and filing deadline overrides remain OPEN for finance/accountant confirmation.

Implementation/evidence: `docs/plan/VAT-RETURN-EVIDENCE.md`. Latest automated verification: backend 737/737 with PostgreSQL and zero skips; frontend 135/135; Vite build succeeded. The amendment-history change is covered by the current test build. This is not an accounting sign-off or release approval.
