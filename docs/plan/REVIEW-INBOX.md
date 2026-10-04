# REVIEW-INBOX.md

Read-only findings for the executor. Second tools (Codex) append here; they do not edit product code.

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
