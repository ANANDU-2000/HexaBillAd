# FrozenHub 1 & 2 Invoice Printing — To-do

Created 2026-10-31 from the supplied engineering brief and the current local checkout. This is a planning artifact; no production system, database, tenant setting, or deployment was changed while creating it.

## Current baseline

- Local branch: `feature/worksheet-analytics`
- Local HEAD: `427e1684d9b1f1a4b0d13abddc0d2757d1bd50ba`
- Worktree already had changes in `CompanySettings.cs`, `InvoiceTemplateService.cs`, `PdfService.cs`, `SettingsService.cs`, `SettingsPage.jsx`, two tests, `docs/production/TASK-TRACKER.md`, a migration note, and `output/`. Preserve and review these before editing; do not assume they belong to this task.
- `docs/production/TASK-TRACKER.md` contains earlier FrozenHub implementation and release claims, including tests and deployment identifiers. Those claims have not been independently revalidated against the current checkout or live services for this to-do. Reconcile them with read-only evidence before relying on them.
- Tracker says a FrozenHub black-and-white logo asset is missing, and owner confirmation of legal identity, P.O. Box, and bank details is outstanding. Verify whether those blockers remain.
- The pasted input contains live-looking production credentials and API keys. Treat them as compromised: rotate/revoke each exposed credential with its provider, update dependent services through the approved secret manager, verify old credentials no longer work, and review access logs. Do not copy secret values into this file, Git, chat, MCP context, browser storage, or logs. Rotation and production configuration changes are security-sensitive and require the authorized operator.
- Do not make tenant or financial data changes until the identity, authorization, backup, rollback, and environment-specific approval gates below are met.

## Ordered checklist

### 0. Contain exposed credentials — P0

- [ ] Inventory the credential types exposed in the supplied text without copying their values.
- [ ] Revoke/rotate each exposed API, database, deployment, signing, storage, and proxy credential at its source; coordinate dependent service updates to avoid an outage.
- [ ] Confirm old values are rejected, services are healthy, and access/audit logs show no unexplained use.
- [ ] Record rotation evidence without recording secret values. Keep credentials in the approved server-side secret manager; do not save them to MCP, repository files, prompts, or frontend configuration.
- [ ] If the authorized operator or access is unavailable, mark this gate BLOCKED and do not perform production changes.

### 1. Re-establish the source-of-truth baseline — P0

- [ ] Preserve the existing dirty worktree; inspect diffs for all pre-existing modified and untracked files before touching related code.
- [ ] Read current project instructions and the relevant print/settings tracker entries. Reconcile the pasted brief with current code and recorded prior work; do not repeat fixes already present.
- [ ] Read-only verify current Git remote/commit relationships and available deployment commit/status for frontend and backend. Record evidence and access limits; do not infer live state from the tracker.
- [ ] Confirm whether any maintenance/503 incident, account-access issue, customer-data leak in printouts, incorrect saves, or financial-integrity issue is still open. Classify and mitigate P0 issues before feature work.
- [ ] Capture a baseline of existing relevant tests and known failures; do not represent skipped or unavailable checks as passing.

### 2. Verify tenant identities and authority — P0

- [ ] Using authenticated, read-only evidence, verify the tenant IDs, slugs, legal entities, owner identities, and authorization scope for FrozenHub 1 and FrozenHub 2. Treat IDs and subdomains in the brief as hints only.
- [ ] Confirm tenant 2's exact registered/display identity, tax registration, licence, VAT relationship, and effective date from authoritative owner-approved records. Do not copy tenant 1's legal or tax details by assumption.
- [ ] Confirm each tenant's independently stored contact phone and approved print address. Verify whether P.O. Box details are authorized; omit unverified values.
- [ ] Confirm the shared bank account holder and both tenants' authorization to use it against the original bank document and owner approval. Never infer shared accounting or customer data from shared banking.
- [ ] Keep all values tenant-scoped. Do not consolidate tax, ledger, invoice, payment, stock, customer, or balance records.

### 3. Map current implementation and data flow — P0

- [ ] Trace settings UI form/state → authenticated GET/PUT (or PATCH) → DTO/validation → tenant-scoped persistence → save response/refetch.
- [ ] Trace each print route and data source for invoice, delivery, combined invoice, receipt, credit note, customer statement, and supplier statement.
- [ ] Inventory A4, A5, 80 mm, and 58 mm templates and their shared header/footer components, logo assets, Arabic fonts/shaping, and signature blocks.
- [ ] Trace pending-invoice count and outstanding/current balance calculations to authoritative backend queries. Document date/status filters, credits, voids, payments, tenant scope, and as-of timestamp semantics before editing.
- [ ] Map VAT date handling and tenant/global configuration. Confirm the documented effective date is not applied globally to unrelated tenants.
- [ ] Identify applicable EF Core schema/migrations and whether any schema change is actually needed. Prefer no migration if existing settings support the requirement.

### 4. Implement only verified gaps — P1

- [ ] Review current uncommitted implementation before deciding what remains. Keep changes within existing settings, authorization, PDF, and migration boundaries.
- [ ] Ensure owner/admin-only settings writes, server-verified tenant scope, validation, audit logging, safe error handling, and no secrets in responses/logs.
- [ ] Keep contact phones independent per tenant; use a shared bank profile only if the existing architecture can securely represent explicit authorized tenant association.
- [ ] Match the approved bilingual invoice layout: centered FH logo, readable lighter wordmark, correct English/Arabic identity, approved Musaffah 17 address where applicable, no redundant heading, and no foreign-company signature text.
- [ ] Keep required invoice fields and supported formats. Prevent collisions, clipping, blank pages, truncation, and grayscale readability problems; preserve Arabic RTL shaping and wrapping.
- [ ] Show distinct verified bank account number and IBAN only after source-document confirmation. Never hardcode banking values in a generic PDF template.
- [ ] Render pending count, outstanding balance, and current-balance label/timestamp from the documented deterministic backend definitions; avoid exposing another tenant's data.
- [ ] Use deterministic VAT rules by tenant and invoice date; show explicit missing-data states. Do not let AI calculate or post financial values.

### 5. Verify locally with synthetic data — P1

- [ ] Add or update focused tests for settings validation/persistence, authorization, tenant isolation, and save/refetch behavior.
- [ ] Test forged tenant IDs and a non-member invoice ID; prove both are denied without cross-tenant data leakage.
- [ ] Test tenant-specific phones and headers, authorized shared-bank settings, and identity separation with synthetic tenants. Do not use live customer records for test fixtures.
- [ ] Test pending count/balance across unpaid, partially paid, paid, voided, credited, and date-boundary invoices; reconcile expected values.
- [ ] Test VAT dates on both sides of the approved tenant effective date and verify unrelated tenants remain unaffected.
- [ ] Test generated PDFs for every supported format, short/long names, Arabic text, long email/address, logo fallback, multi-page item tables, discounts/rounding, payment information, signatures, and page boundaries.
- [ ] Run targeted backend/frontend tests and builds; use disposable PostgreSQL for persistence and isolation tests. Record exact commands, counts, skips, and exit codes.
- [ ] Inspect searchable PDF text and rendered page images. Record before/after screenshots or equivalent evidence; verify no customer/financial data appears in logs.

### 6. Browser and device acceptance — P1

- [ ] With authorized test accounts and synthetic data, verify settings edit → save → reload/refetch → print for both tenant contexts.
- [ ] Verify 360/390 px phone, 768 px tablet, and 1024/1440 px desktop behavior; keyboard operation, modal scrolling, loading/errors, preview/download, and print scaling.
- [ ] Verify actual printer output for supported A4/A5/thermal formats where hardware is available. Otherwise mark physical print NOT TESTED and provide exact acceptance steps.
- [ ] Do not create real production invoices or payments just to exercise printing.

### 7. Release gate — P0 approval required

- [ ] Confirm critical tests pass with no unexplained skips, tenant-isolation tests pass, PDFs are visually accepted, and settings persist after reload.
- [ ] Verify a restorable backup, restore evidence, migration compatibility, rollback plan, and no unintended tenant/data changes.
- [ ] Confirm production health and deployment compatibility using read-only checks.
- [ ] Obtain explicit environment-specific approval before any production migration, settings write, or deployment. Do not trigger release if a critical test or security gate fails.
- [ ] After an approved release only: verify frontend/backend deployment IDs and commit hashes, health, logs, migration state, authorized settings GET/PUT, and read-only PDF output for both tenants. Check financial invariants and other-tenant impact.
- [ ] Record owner acceptance and unresolved blockers. Mark COMPLETE only when every mandatory acceptance item has evidence.

## Completion evidence to record

- Current source/deployment commits and schema evidence.
- Requirement matrix: DONE / PARTIAL / BLOCKED / NOT STARTED.
- Changed files and migration/rollback details.
- Test commands, pass/fail/skip counts, and database isolation evidence.
- PDF format inventory, text/image review, responsive/browser evidence, and physical print status.
- Tenant identity and settings approval evidence without publishing sensitive values.
- Production status only if an authorized release actually occurred.
- Remaining blockers and the person or evidence needed to resolve each one.
