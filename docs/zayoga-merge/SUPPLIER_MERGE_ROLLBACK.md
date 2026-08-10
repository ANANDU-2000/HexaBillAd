# Supplier merge rollback note (soft-delete only)

## Preference
Never hard-delete supplier rows. Soft-delete + audit JSON is the recovery reference.

## After a bad merge
1. Read `AuditLogs` where `Action = 'SupplierMerge'` for the tenant — details JSON has `loserIds`, `nameVariants`, `variantBalancesBefore`, `balanceAfter`.
2. Reactivate losers: set `IsActive = true`, restore original `Name` / `NormalizedName` from audit (strip ` (#id merged into #survivor)` suffix).
3. Re-point purchases / payments / credits / vendor discounts using audit name variants (manual SQL; high risk — prefer restore from DB backup taken before `--execute`).
4. Soft-deleted survivor can stay if it was the wrong survivor; do not delete.

## Phase 0 snapshot (Jaapi / Tenant 6)
- Survivor: **7** `JAAPI ICE CREAM MANUFACTURING LLC`
- Losers: **1**, **5**
- Expected combined net: **89863.17**
