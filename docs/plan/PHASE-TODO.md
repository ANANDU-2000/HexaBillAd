# Tier 0 execution board (authoritative)

**Branch:** `tier0-continuation`  
**Baseline commit:** `846ee95` (+ Tier 0 WIP commits)  
**Backup:** `Desktop/HexaBill_Backups/tier0-20261004-083307`  
**Deadline:** 4 October 2026 12:00 IST — evidence takes precedence over the clock.  
**Rule:** no `main` / production changes without explicit authorization.

Statuses: **TODO** | **IMPLEMENTED** | **PASS** | **FAIL** | **BLOCKED**

## Baseline evidence (2026-10-04)

| Gate | Status | Evidence |
|---|---|---|
| Backend Release build | **PASS** | 0 errors |
| Frontend production build | **PASS** | Vite build OK |
| Frontend lint | **PASS** | 0 errors, 235 warnings |
| Frontend unit tests | **PASS** | 74/74 |
| Backend unit/integration tests | **PASS** | **553 passed**, 0 failed (after Tier 0 work) |
| PostgreSQL HTTP isolation suite | **BLOCKED** | 44 skipped — need `HEXABILL_TEST_POSTGRES` |
| Staging / production deploy | **BLOCKED** | No authorization |
| Backup restore proof | **BLOCKED** | No staging DB access |

Migration inventory: **47** additive migrations (latest `20261003190000_AddPaymentParentPaymentId`).

## Tier 0 checklist

| ID | Item | Status | Notes |
|---|---|---|---|
| T0-01 | Preserve both trees + create `tier0-continuation` from 846ee95 | **PASS** | Backup + Codex WIP + return reversal merged |
| T0-02 | Full builds/tests/lint baseline | **PASS** | 553 BE / 74 FE; 44 PG skipped |
| T0-03 | Docs: PAGE-SPEC, prompt, tracker aligned | **PASS** | IMPLEMENTATION-PROMPT rewritten; PAGE-SPECIFICATION in tree |
| T0-04 | Idempotent frozenhub1/frozenhub2 + GH provisioning | **IMPLEMENTED** | `Tier0TenantProvisioning` + `POST /api/superadmin/tier0/provision`; owner-2 create still needs emails + OpeningDataChoice |
| T0-05 | VAT resolver + corporate_tax_trn + audit + no licence→TRN fallback | **PASS** | Settings aliases; letter identity fixed; shared-TRN warning on PUT |
| T0-06 | Sample VAT TRNs non-prod only; Production rejects samples | **PASS** | `SampleVatTrn` + tests; Crystal Freeze TRN forbidden |
| T0-07 | Document header resolver (A4/thermal/grayscale/Arabic) | **PASS** | DocumentHeaderTests (A4/A5/80mm/58mm + monochrome) |
| T0-08 | Tax Invoice finalize/print requires valid VAT TRN | **PASS** | SaleService + PdfService gates with env |
| T0-09 | Tenant isolation negative tests | **PASS** (SQLite/HTTP) / **BLOCKED** (PG) | Existing suite green; PG skipped |
| T0-10 | F19/F20 + settlement cash rule | **PASS** | Settlement/receipt/daily-close 1330/1331 fixtures |
| T0-11 | Standard 5% VAT prospective (no historic recalc) | **IMPLEMENTED** | Default VAT_PERCENT=5; margin deferred |
| T0-12 | Seven journeys × FrozenHub owners + GH header | **BLOCKED** | Needs local hosts, staging, screenshots, owner-2 emails |
| T0-13 | Commit/push `tier0-continuation` + deploy/rollback commands | **TODO** | See TIER0-RELEASE.md |

## Open inputs (remain BLOCKED — never fabricated)

- Real VAT TRNs for FrozenHub 1/2 and GulfHarvest
- Owner 2 login email / contact + OpeningDataChoice confirmation
- GulfHarvest logo file + email choice (licence vs tenant email)
- PostgreSQL / staging access for the 44 skipped checks
- Production deploy authorization

## Confirmed decisions

- Separate tenants: `frozenhub1` / `frozenhub2`; legacy `frozenhub` → redirect via `LEGACY_SUBDOMAIN`
- **GulfHarvest** name; CT TRN `105543085200001` is not VAT
- Tier 0 = standard **5% VAT**; margin deferred
- Reprints use **current** header settings; financial snapshots immutable

## Post Tier 0 phase order

1 FE/BE deploy parity → 2 Isolation → 3 Payments/receipts → 4 Cost/profit → 5 Daily close → **6 Margin VAT (deferred)** → 7 Shell UX → 8 Remaining routes → 9 AI → 10 Voice/maps → 11 Staging pilot.
