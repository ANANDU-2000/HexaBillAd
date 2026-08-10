# Phase 0 — Jaapi supplier duplicate evidence (read-only)

**Tenant:** Id `6` — `ZAYOGA GENERAL TRADING`  
**Postgres:** `dpg-d68jhpk9c44c73ft047g-a` (Render MCP `query_render_postgres`)  
**Date:** 2026-08-10  
**Writes:** none

## Supplier directory rows (Jaapi / Japi)

| Id | Name | IsActive | Notes |
|----|------|----------|-------|
| **7** | **JAAPI ICE CREAM MANUFACTURING LLC** | false | Correct spelling; **proposed survivor** (reactivate) |
| 1 | JAPI ICE CREAM MANUFACTURING LLC | true | Typo / short spelling; proposed loser |
| 5 | JAPI ICE CREAM MANUFACTURING LLC | true | Same display name as #1; has VendorDiscounts; proposed loser |

Exact-normalized duplicate cluster (same `LOWER(TRIM(NormalizedName))`): only **1 + 5** (`japi ice cream manufacturing llc`).  
Near-duplicate cluster for merge: **1 + 5 + 7** (JAPI vs JAAPI — note `%japi%` does **not** match `jaapi` as a substring).

## Purchases (name-keyed balances)

| SupplierName | Rows | Sum TotalAmount |
|--------------|------|-----------------|
| JAAPI ICE CREAM MANUFACTURING LLC | 4 | 54,038.25 |
| JAPI ICE CREAM MANUFACTURING LLC | 23 | 114,023.17 |

By `SupplierId`:

| SupplierId | SupplierName | Rows | Sum |
|------------|--------------|------|-----|
| null | JAPI… | 22 | 106,683.67 |
| 1 | JAPI… | 1 | 7,339.50 |
| null | JAAPI… | 4 | 54,038.25 |

(Ids 5 and 7 have no purchases linked by `SupplierId`.)

## SupplierPayments / LedgerCredits / Returns / VendorDiscounts

| Source | Name / Id | Rows | Amount |
|--------|-----------|------|--------|
| SupplierPayments | JAPI… | 9 | 74,051.50 |
| SupplierPayments | JAAPI… | 0 | 0 |
| SupplierLedgerCredits | JAPI… | 16 | 4,146.75 |
| SupplierLedgerCredits | JAAPI… | 0 | 0 |
| PurchaseReturns (via purchase name) | either | 0 | 0 |
| PurchaseReturns.`SupplierId` ∈ {1,5,7} | — | 0 | — |
| VendorDiscounts | SupplierId **5** | 13 | — |

## Per-variant net payable (same formula as `GetSupplierBalanceAsync`)

`Net = Σ Purchases − Σ PurchaseReturns − Σ Payments − Σ LedgerCredits`

| Variant | Purchases | Returns | Payments | Credits | **Net** |
|---------|-----------|---------|----------|---------|---------|
| JAAPI… | 54,038.25 | 0 | 0 | 0 | **54,038.25** |
| JAPI… | 114,023.17 | 0 | 74,051.50 | 4,146.75 | **35,824.92** |
| **Merged (would-be)** | 168,061.42 | 0 | 74,051.50 | 4,146.75 | **89,863.17** |

Cent check: `54038.25 + 35824.92 = 89863.17`.

## Proposed merge (awaiting Phase 1 dry-run / apply)

- **Survivor:** `7` — `JAAPI ICE CREAM MANUFACTURING LLC` (reactivate `IsActive=true`)
- **Losers:** `1`, `5` — soft-delete + rename `… (merged into #7)`
- **Name rewrite targets:** all `JAPI ICE CREAM MANUFACTURING LLC` (and case/spacing variants) → exact survivor name
- **Must move before deactivate:** `VendorDiscounts` SupplierId `5` → `7`; Purchases `SupplierId=1` → `7`

## Picker root cause (documented)

`SearchSupplierNamesAsync` unions distinct `Purchases.SupplierName` with `Suppliers.Name` and **does not filter `IsActive`**. That reintroduces merged/typo strings and duplicate JAAPI/JAPI labels in the Purchases autocomplete.

## Rollback note

Prefer soft-delete only. Hard recovery from audit JSON (`SupplierMerge` action) + rename of payment/credit name strings; do not hard-delete supplier rows.
