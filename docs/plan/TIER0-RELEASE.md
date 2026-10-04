# Tier 0 release handoff

## Versions

| Item | Value |
|---|---|
| Branch | `tier0-continuation` |
| Baseline | `846ee95` |
| Tier 0 commit | `4950348` (local; push blocked pending GitHub credentials) |
| Backend tests | 553 passed / 44 PostgreSQL skipped / 0 failed |
| Frontend tests | 74 passed |
| Migrations | 47 (latest `20261003190000_AddPaymentParentPaymentId`) |

## Per-flow status

| Journey | FrozenHub1 | FrozenHub2 | GulfHarvest | Status |
|---|---|---|---|---|
| 1 Login → settings → company header | unit/HTTP covered | BLOCKED (tenant not created) | identity settings ready | **PARTIAL** |
| 2 Customer → credit sale → invoice → ledger | existing suite | BLOCKED | n/a | **PARTIAL** |
| 3 Product → purchase → stock → sale | existing suite | BLOCKED | n/a | **PARTIAL** |
| 4 POS → draft recovery → finalize → PDF | existing suite + Tax Invoice VAT gate | BLOCKED | n/a | **PARTIAL** |
| 5 Partial payment → adjustment → receipt → ledger | PASS (1330/1331 fixtures) | BLOCKED | n/a | **PARTIAL** |
| 6 Return/credit note → reversal → reports | PASS (audited reverse) | BLOCKED | n/a | **PARTIAL** |
| 7 VAT return/profit → daily close → backup/restore | daily close PASS; restore BLOCKED | BLOCKED | header only | **PARTIAL** |

No journey is marked full **PASS** without screenshots/network traces on live tenant hosts.

## Unresolved failures / blockers

1. 44 PostgreSQL HTTP isolation tests skipped (`HEXABILL_TEST_POSTGRES` unset).
2. FrozenHub owner 2 not creatable until OpeningDataChoice + owner email/name/phone are supplied.
3. Real VAT TRNs missing — Tax Invoice finalize blocked until entered (by design).
4. GulfHarvest logo missing.
5. Staging backup/restore not rehearsed.
6. Production deploy not authorized.

## Deploy / migration / rollback (staging — not production)

```bash
# Apply additive migrations (staging only, after approval)
dotnet ef database update --project backend/HexaBill.Api --startup-project backend/HexaBill.Api

# Idempotent Tier 0 identity (platform admin JWT required)
curl -X POST https://<api-host>/api/superadmin/tier0/provision -H "Authorization: Bearer <token>"

# Rollback subdomain rename only (SQL sketch — rehearse on staging first)
# UPDATE "Tenants" SET "Subdomain" = 'frozenhub' WHERE "Id" = 20 AND "Subdomain" = 'frozenhub1';
# DELETE FROM "Settings" WHERE "TenantId" = 20 AND "Key" = 'LEGACY_SUBDOMAIN';
```

Frontend: deploy Vercel preview from `tier0-continuation` only.  
Backend: deploy Render preview/staging from the same SHA.  
Verify `deployVersion` / health SHA match before any pilot.

**Production execution remains separately authorized.**
