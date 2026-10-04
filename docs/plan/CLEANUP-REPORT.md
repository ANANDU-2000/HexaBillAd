# CLEANUP-REPORT (dry run)

**Date:** 2026-10-04  
**Commit baseline:** `6dc8d9c`  
**Rule:** prove unused before delete. No removals in this dry-run commit except ignore tightening.

## Candidates

| Candidate | Risk | Proof of non-use (this pass) | Action |
|---|---|---|---|
| `clients/` | safe ignore | already `/clients/` in `.gitignore` | keep ignored; never commit |
| Codex worktree | external | not in repo | leave alone |
| `Desktop/HexaBill_Backups/` | safe | outside repo | keep outside |
| Duplicate progress narratives in `docs/refactor-progress.md` | needs review | historical log; still referenced by humans | do not delete yet; MASTER-LOOP/STATE supersede for status |
| Large FE chunks (BarChart/index >500kb) | needs review | build warning only | code-split later (Phase 7) |
| `npm audit` 28 vulns | needs review | transitive | separate security pass |
| Startup `ExecuteSqlRaw` DDL in `Program.cs` | needs review | still executed at boot | migrate to EF migrations later; never edit old migrations |
| Unused Lucide imports (lint warnings) | safe | eslint unused-vars | gradual fix in UI slices |
| `crystal-freeze-header-reference.png` | keep | branding reference; TRN forbidden in code | keep |

## Removals performed

| Commit / date | Item | Grep proof |
|---|---|---|
| 2026-10-04 master-loop-2 | Root `package.json` + `package-lock.json` (empty `{}` / empty packages) | No workspace consumers; FE lives under `frontend/hexabill-ui` |
| 2026-10-04 master-loop-2 | Local (gitignored) `appsettings.Development.json` scrubbed to synthetic placeholders matching `appsettings.example.json` | File is `.gitignore`’d; tracked configs already synthetic; `rg` for prior real patterns → CLEANUP note only |

## Removals performed (prior dry-run note)

None in the original dry-run commit.

## Ignore tightening (applied)

See `.gitignore` / `.cursorignore` updates in the same commit: backups, evidence PDFs, local db copies, agent patches.

## Next safe deletes (after second proof)

1. Stale zip extracts under repo root if any appear (`*.zip` already ignored?).
2. Orphan test evidence folders accidentally committed under `tests/` — none found this pass.


## Release audit appendix - 4 October 2026, SHA 315c1c5

757 tracked files; zero byte-identical nonempty tracked code/config/docs. Ten runtime file-set groups share normalized windows of 20 significant lines. Whitespace/comments/import-only lines excluded; migrations/designer/tests excluded from window scan. These are copied blocks, not proof of non-use or exhaustive semantic duplication. No source deleted.

| SHA256 window | One-based source locations | Action |
|---|---|---|
| 990b99e8c6882e894c580b905fb8d9c642ba2730cd11918dcddec955fc40a3dd | FileUploadService.cs:109; R2FileUploadService.cs:159 | Keep both providers; extract shared validation |
| 3d423c4efb8e2189661ab0bb0318142f8e8411050c4fca94f52b53763b43e937 | SignupService.cs:142; SuperAdminTenantService.cs:1218 | Shared seed candidate |
| 06ae4b04d265541dae1f680d373cc14dd9e4ac4f6d0f21943f5deb0ccb6eadd5 | Agreements/Quotations/SalaryCertificatesController.cs:27 | Tenant-user resolution boilerplate |
| cf5ea0c94f0a4cccb4ea97a4933db3880dba0d2db085eb5759082a2440bdbeed | SuperAdminController.cs:1042; UsersController.cs:66 | Preserve platform/tenant policies |
| fa1fd72917ce311c2d63ca188178dd75d676a3149c0da2a2c7715c5cc9e13a00 | middleware.js:10; frontend/hexabill-ui/middleware.js:5 | Two deployment-root entry points; parity before extraction |
| 4e718af940d501820efcc4aba670f0b7a291edeb7928f49cfb19dfd321b4aef4 | AgreementEditorPage.jsx:86; SalaryCertificateEditorPage.jsx:134 | Form reuse candidate |
| 62494a8f1eb89b6270365eeb1044660aa0ed458c8c7dc725ce4af7bd5eaade3b | AgreementsPage.jsx:136; QuotationsPage.jsx:138; SalaryCertificatesPage.jsx:185 | List reuse candidate |
| 93caca51d66bcb6bd27c9000ab3174f34aa77602f458098cb27dbb5bb4c154ca | QuotationEditorPage.jsx:153; SalaryCertificateEditorPage.jsx:133 | Editor reuse candidate |
| 0c7836ac74c9b89d8aaafbc93821c22324633190827c2a436c37f95119195619 | PosPageLegacy.jsx:5; PosEnterprisePage.jsx:23 | Both active; rollback retained |
| 967c0999761ce0ba3b7bb3498bf38fd9a584e55a45b30730a7499566202bc747 | PosPageLegacy.jsx:2193; DiscountPopup.jsx:32; PosEnterprisePage.jsx:2433 | Discount UI clone; retain rollback |

PosPageLegacy is active via PosPage rollback; IPdfService/PdfService are DI consumers. Orphan candidates require dynamic/config/test/script proof before removal. Current lint: 237 warnings; npm audit: 28 package findings, 22 high. See RELEASE-AUDIT-20261004.md.
