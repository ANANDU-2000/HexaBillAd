# Supplier Jaapi merge — apply log

**Date:** 2026-08-10  
**Tenant:** 6 (ZAYOGA GENERAL TRADING)

## Dry-run
- Survivor `#7` `JAAPI ICE CREAM MANUFACTURING LLC`
- Losers `#1`, `#5`
- Predicted net: **89863.17** (matched Phase 0 `--expected-net`)

## Execute
```
dotnet run --project backend/HexaBill.Api/Scripts/MergeSuppliers -- --tenant 6 --survivor 7 --losers 1,5 --execute --confirm MERGE --expected-net 89863.17
```
- Success=True, After=**89863.17** (cent-exact)
- Soft-deleted losers with unique rename `(#id merged into #7)`
- Reactivated survivor
- `AuditLogs.Action = SupplierMerge` (1 row)

## Post-verify
| Id | Name | IsActive |
|----|------|----------|
| 7 | JAAPI ICE CREAM MANUFACTURING LLC | true |
| 1 | JAPI… (#1 merged into #7) | false |
| 5 | JAPI… (#5 merged into #7) | false |
