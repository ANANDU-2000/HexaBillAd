# Tier 0 provisioning runbook

## Configuration

Section: `Tier0Provisioning` (see `appsettings.example.json`; local values in gitignored `appsettings.Development.json`).

| Tenant | Existing ID (prod/staging) | Canonical slug | Legacy slug |
|---|---|---|---|
| FrozenHub owner 1 | 20 | `frozenhub1` | `frozenhub` → redirect via `LEGACY_SUBDOMAIN` |
| FrozenHub owner 2 | (auto-create) | `frozenhub2` | — |
| GulfHarvest | 22 | `gulfharvest` | — |
| Zayogya | optional | `zayoga` | — (no sample VAT) |

## Rules

- Re-running `POST /api/superadmin/tier0/provision` is idempotent: no credential reset, no overwrite of non-empty settings.
- **Development:** `CreateMissingTenants=true` creates FH1/GH/Zayogya when absent; FrozenHub2 is always auto-created via `CreateTenantAsync` with shared legal identity from owner 1 when missing.
- Owner 2 requires `OpeningDataChoice=Empty` plus `OwnerEmail` / `OwnerName` / `Phone`.
- `SeedSampleVatTrn` only seeds synthetic TRNs outside Production. Production Tax Invoices reject sample TRNs.
- Shared-legal clone that copied the source sample TRN is realigned to each tenant’s own sample fixture (non-Production).
- GulfHarvest `CorporateTaxTrn` `105543085200001` is stored in `CORPORATE_TAX_TRN` only — never `COMPANY_TRN` / `vat_trn`.
- Real VAT TRNs remain empty until clients enter them in Settings (local uses samples).

## Local bootstrap

```bash
node scripts/tier0-local-bootstrap.mjs
```

Sets local owner passwords via SuperAdmin reset (`Owner123!` by default) and seeds product/customer/supplier per tenant.

## Rollback

- Subdomain rename: restore `Tenants.Subdomain` to `frozenhub` and clear `LEGACY_SUBDOMAIN` setting for the FrozenHub1 tenant.
- Do not delete financial rows. Additive settings only.
