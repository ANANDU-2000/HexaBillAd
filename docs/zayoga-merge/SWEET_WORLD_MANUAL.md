# SWEET WORLD — manual review (Tenant 6)

Do **not** auto-merge. These are ME9 spacing variants, not `CUSTOMER` suffix clones.

| Id | Name | Balance | Sales | Payments |
|----|------|---------|-------|----------|
| 22 | SWEET WORLD GENERAL TRADING LLC **-ME9** | 0.00 | 1 | 1 |
| **31** | SWEET WORLD GENERAL TRADING LLC | -265.69 | 16 | 11 |
| 44 | SWEET WORLD GENERAL TRADING LLC **- ME9** | 276.29 | 8 | 5 |

## Recommendation

- Treat **Id 31** as the main trading account (most activity).
- Ask client: are 22 and 44 the same physical customer as 31?
  - If **yes**: merge `22,44 → 31` using the same merge tool after backup.
  - If **no** (different branches/accounts): rename clearly (e.g. add branch label) and leave separate.

## Hold

No merge executed for this group in the automated batch.
