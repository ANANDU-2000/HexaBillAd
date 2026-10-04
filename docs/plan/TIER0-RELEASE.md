# Tier 0 release handoff

## Versions

| Item | Value |
|---|---|
| Branch | `tier0-continuation` |
| Baseline | `846ee95` |
| Local verification | 2026-10-04 — evidence `Desktop/HexaBill_Backups/tier0-local-browser-20261004-091255/` |
| Backend tests | Tier0Provisioning + SampleVat + prior suite (re-run on commit) |
| Frontend tests | 74 passed (prior); shell HTML reachability 25/25 × 4 tenants |
| Migrations | 47 (latest `20261003190000_AddPaymentParentPaymentId`) |

## Per-flow status (local Development)

| Journey | FrozenHub1 | FrozenHub2 | GulfHarvest | Status |
|---|---|---|---|---|
| 1 Login → settings → company header | **PASS** (TRN 900…001) | **PASS** (TRN 900…002) | **PASS** header + sample VAT / CT TRN | **PASS** local |
| 2 Customer → credit sale → invoice → ledger | **PASS** grand 31.50 | **PASS** grand 31.50 | seed only | **PASS** FH |
| 3 Product → purchase → stock → sale | **PASS** seed path | **PASS** seed path | seed only | **PASS** FH |
| 4 POS → draft recovery → finalize → PDF | **PASS** POS UI + VAT sample gate | **PASS** VAT sample | n/a | **PASS** local (sample VAT) |
| 5 Partial payment → adjustment → receipt → ledger | **PASS** 1330 / 500 | **PASS** 1330 / 500 | n/a | **PASS** FH |
| 6 Return/credit note → reversal → reports | **PASS** returns list + unit reverse | **PASS** returns list | n/a | **PASS** (list + suite) |
| 7 VAT return/profit → daily close → backup/restore | **PASS** VAT+profit; daily-close off until enabled | same | header only | **PASS** local with note |

## Unresolved (non-blocking for local finish)

1. 44 PostgreSQL HTTP isolation tests skipped (`HEXABILL_TEST_POSTGRES` unset).
2. Real VAT TRNs — clients replace samples in Settings before Production.
3. GulfHarvest logo artwork not invented (empty logo OK).
4. Staging backup/restore not rehearsed.
5. GitHub push blocked until HTTPS credentials available.
6. Production deploy not authorized.

## Local bootstrap

```bash
# API :5000 + Vite :5174 (avoid :5173 if another app binds ::1)
dotnet run --project backend/HexaBill.Api --launch-profile HexaBill.Api
npm run dev --prefix frontend/hexabill-ui -- --host 0.0.0.0 --port 5174

# Idempotent provision + mock commerce (platform admin session)
node scripts/tier0-local-bootstrap.mjs

# Journey amount checks
node scripts/tier0-local-journey-verify.mjs

# Shell route reachability (4 tenants)
node scripts/tier0-browser-shell-check.mjs
```

Development `Tier0Provisioning:CreateMissingTenants=true` + `SeedSampleVatTrn=true` (gitignored `appsettings.Development.json`). Production keeps `SeedSampleVatTrn=false` / rejects samples.

## Deploy / migration / rollback (staging — not production)

```bash
dotnet ef database update --project backend/HexaBill.Api --startup-project backend/HexaBill.Api
curl -X POST https://<api-host>/api/superadmin/tier0/provision -H "Authorization: Bearer <token>"
```

**Production execution remains separately authorized.**
