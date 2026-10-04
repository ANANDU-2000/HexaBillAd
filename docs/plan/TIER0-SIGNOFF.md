# Tier 0 sign-off table (Master Loop)

**As of:** 2026-10-04  
**Code SHA:** `6dc8d9c` on `main`

| Gate | Status | Evidence |
|---|---|---|
| Shared-TRN admin warning | **PASS** | `SharedVatTenantCount` UI + settings PUT warning |
| Header parity A4/A5/80/58/receipt/mono/AR | **PASS** (unit + PDFs) | `Desktop/HexaBill_Backups/master-loop-header-20261004-102752/` |
| Browser print live | **NOT RUN** | needs Vite session |
| Provisioning + legacy redirect | **PASS** (local prior + unit) | Tier0ProvisioningTests; prior local browser |
| Legacy settings TenantId | **PASS** | SettingsService TenantId-over-OwnerId |
| Isolation audit | **PARTIAL** | `docs/plan/ISOLATION-AUDIT.md` |
| PostgreSQL 44 | **NOT RUN** | no `HEXABILL_TEST_POSTGRES` / docker |
| Seven journeys (section 9) | **PASS** (prior local) / re-run **NOT RUN** this session | `tier0-local-browser-20261004-091255` |
| Backup restore on copy | **NOT RUN** | no staging DB copy |
| Sample TRN never blocks (FH/GH) | **PASS** | SampleVatTrn + Settings auto-fill; Zayogya excluded |
| D5 profit×5% not VAT | **PASS** | VatReturnReportService + VatReturnPage + FIN12/FIN13 |
| Zayogya tax/print unchanged | **PASS** | ZayogyaRegressionSnapshotTests |
| Production deploy | **BLOCKED** | needs separate Anandu auth |

## Journey re-run checklist (when API+Vite up)

1. Sale → credit/partial → PDF → ledger → payment → receipt → Back  
2. Purchase → stock → supplier ledger  
3. Petrol expense → daily close  
4. Product cost change → historic profit unchanged  
5. Owner A ↛ Owner B  
6. Header change → reprint header only  
7. Empty VAT: Zayogya still blocked for Tax Invoice; FH/GH auto-sample  

```bash
node scripts/tier0-local-bootstrap.mjs
node scripts/tier0-local-journey-verify.mjs
node scripts/tier0-browser-shell-check.mjs
```
