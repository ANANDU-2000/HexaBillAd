# REVIEW-INBOX.md

Current release review: [RELEASE-AUDIT-20261004.md](RELEASE-AUDIT-20261004.md), defects: [ERROR-REGISTER.md](ERROR-REGISTER.md). Nine initial findings cover money history, failed migration chain, VAT divergence, silent zero reports, incomplete golden regression evidence, dependencies and stale trackers. Current owner appoints Codex single executor for PRODUCTION-RELEASE-LOOP.md; prior read-only role is superseded for this release. Historical entries below are preserved. No production sign-off.

## 2026-10-04 — startup and schema-readiness review (REL-011)

**Severity: S1.** `Program.cs` has two independent migration checks: a delayed task around lines 1350–1409 and database initialization around lines 1411 onward. Both suppress migration failures; the latter is background work and explicitly continues after failed DDL. Production PostgreSQL skips EF migrations but still attempts direct schema DDL helpers, whose failures are logged as warnings. The ready health check proves database connectivity, not that required schema initialization completed. Therefore a reachable/ready process can still serve against an incomplete schema. This finding expands REL-011; it does not resolve the historical migration collision. A safe fix needs one authoritative initialization/readiness lifecycle and tests proving pending or failed schema work prevents readiness and business requests. No schema initialization behavior changed in this review iteration.

## 2026-10-04 — Codex worktree uncommitted WIP (inventory)

**Path:** `C:\Users\anand\.codex\worktrees\afa0\HexaBilngApp`  
**Branch tip commit:** `846ee95` (already ancestor of `main` @ `a958394`)  
**Working tree:** dirty — ~33 modified, 5 untracked. Diffstat ~702 insertions / 316 deletions.

### Modified (feature groups)
- **Settings / TRN:** `SettingsService.cs`, `SettingsController.cs`, `CompanySettings.cs`, `DTOs.cs`, `SettingsPage.jsx`, `TenantCompanySettingsTests.cs` (untracked)
- **Document header / PDF / receipt:** `PdfService.cs`, `InvoiceTemplateService.cs`, `InvoiceTemplatesController.cs`, `PaymentReceiptService.cs`, `ReceiptPreviewModal.jsx`, `receiptPreview.test.js`, `DocumentHeaderTests.cs` (untracked)
- **Sales / returns / daily close touchpoints:** `SaleService.cs`, `SalesController.cs`, `ReturnService.cs`, `DailyCloseService.cs`
- **SuperAdmin:** `SuperAdminTenantService.cs`, `SuperAdminTenantsPage.jsx`
- **Test harness:** several `*PostgreSqlTests.cs`, factories, collections (small edits)
- **Docs:** `PHASE-TODO.md`, `refactor-progress.md`

### Untracked
- `docs/plan/IMPLEMENTATION-PROMPT.txt` (main already has a tracked copy — compare before overwrite)
- `docs/plan/PAGE-SPECIFICATION.md` (already on main)
- `tests/.../DocumentHeaderTests.cs`
- `tests/.../PostgresTestSchema.cs`
- `tests/.../TenantCompanySettingsTests.cs`

### Action for executor
Port onto `main` in slice "Port Codex WIP"; resolve conflicts preferring main's Tier0 commits where behavior already supersedes; keep Settings reconciliation + header tests if they still add coverage.

## 2026-10-04 — Legal risk: sample TRN in Production

Anandu approved sample VAT TRNs on Tax Invoices in Production until clients update. Executor must keep banner + audit trail. Accountant/FTA validity is **client responsibility**. Track until real TRNs entered.

## 2026-10-04 — D8 conflict

MASTER-LOOP D8 says empty VAT blocks Tax Invoice. DECISIONS 2026-10-04 sample-TRN override wins for FrozenHub1/2 and GulfHarvest. Zayogya stays D6 unchanged (may remain empty/no sample).

## 2026-10-04 — Codex WIP port decision: DO NOT APPLY

Compared worktree dirty tree vs `main` @ `a958394` / `master-loop`.

**Content-identical (line-ending noise only):** SettingsPage, ReceiptPreviewModal, InvoiceTemplateService, PaymentReceiptService, DocumentHeaderTests, SalesController, InvoiceTemplatesController, PaymentReceiptTests, web factories, SuperAdminTenantsPage, SettingsHttpIsolationTests, TenantCompanySettingsTests, PostgresTestSchema, receiptPreview.test.js, DailyCloseService.

**Regressive vs main (do not port):**
- Removes `CountOtherTenantsSharingVatTrnAsync` + shared-TRN warning on settings PUT
- Reverts `RequireTaxInvoiceVatTrn` to ignore Production sample guard (partially aligned with later Anandu sample-in-prod decision, but main already has SampleVatTrn helper)
- Removes `Subdomain ?? string.Empty` null-coalesce (GetTenants 500 fix)
- Requires source COMPANY_TRN before shared-legal owner setup (blocks empty/sample flow)
- Removes `MustChangePassword=false` / `SessionVersion++` on password reset
- Strips audited `ReverseSaleReturnAsync` (~254 lines) back to inline damage inventory

**Conclusion:** Main Tier0 commits already contain the valuable Codex intent. Port = no file copies. Backup patch kept at `Desktop/HexaBill_Backups/codex-wip-port-20261004-101602/`.
