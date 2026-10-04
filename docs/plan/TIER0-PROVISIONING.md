# Tier 0 provisioning runbook

## Configuration

Section: `Tier0Provisioning` (see `appsettings.Development.json`).

| Tenant | Existing ID | Canonical slug | Legacy slug |
|---|---|---|---|
| FrozenHub owner 1 | 20 | `frozenhub1` | `frozenhub` → redirect via `LEGACY_SUBDOMAIN` |
| FrozenHub owner 2 | (create once) | `frozenhub2` | — |
| GulfHarvest | 22 | `gulfharvest` | — |

## Rules

- Re-running `POST /api/superadmin/tier0/provision` is idempotent: no credential reset, no overwrite of non-empty settings.
- Owner 2 requires explicit `OpeningDataChoice` (usually `Empty`) **and** a one-time SuperAdmin `CreateTenant` with `SharedLegalIdentityFromTenantId=20` before the provisioner will fill empty identity fields.
- `SeedSampleVatTrn` only seeds synthetic TRNs outside Production. Production Tax Invoices reject sample TRNs.
- GulfHarvest `CorporateTaxTrn` `105543085200001` is stored in `CORPORATE_TAX_TRN` only — never `COMPANY_TRN` / `vat_trn`.
- Real VAT TRNs remain empty until clients enter them in Settings.

## Owner 2 create checklist (manual, once)

1. Set `Tier0Provisioning:FrozenHub2:OpeningDataChoice` = `Empty`.
2. Set owner email/name/phone (do not commit secrets).
3. As platform admin, create tenant with subdomain `frozenhub2`, shared legal identity from tenant 20, confirm fingerprint, `OpeningDataChoice=Empty`.
4. Call `POST /api/superadmin/tier0/provision`.
5. Verify login on `frozenhub2.<domain>` and redirect from `frozenhub.<domain>` → `frozenhub1.<domain>`.

## Rollback

- Subdomain rename: restore `Tenants.Subdomain` to `frozenhub` and clear `LEGACY_SUBDOMAIN` setting for tenant 20.
- Do not delete financial rows. Additive settings only.
