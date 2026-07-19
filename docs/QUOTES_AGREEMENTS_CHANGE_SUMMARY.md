# CHANGE SUMMARY — Quotations, Agreements & Money-Flow Audits

**Date:** 2026-07-19  
**Session scope:** Phase 0 audits (B0–B3) + Track A (A1–A4). Track B money-path **impl** not included (gated on approval).

---

## Files touched

### Audits (docs only)
- `docs/invoice-number-edit-assessment.md` (B0)
- `docs/return-flow-audit.md` (B1)
- `docs/vat-expense-audit.md` (B2 — already present / refreshed by audit)
- `docs/backup-feature-verification.md` (B3)
- `docs/QUOTES_AGREEMENTS_CHANGE_SUMMARY.md` (this file)

### Backend (A1 + A4)
- `Models/Quotation.cs`, `Models/Agreement.cs`, `Models/DocumentDtos.cs`
- `Modules/Documents/*` (QuoteNumberService, QuotationService, AgreementService, Controllers, DocumentsFeature)
- `Data/AppDbContext.cs` — DbSets + indexes
- `Migrations/*_AddQuotationsAndAgreements.cs`
- `Modules/Billing/IPdfService.cs`, `PdfService.cs` — Quote + Agreement A4/A5
- `Program.cs` — DI registration
- `Modules/SuperAdmin/SettingsService.cs` — `Feature_QuotesAgreements`, `COMPANY_LICENSE`

### Frontend (A2 + A3)
- `utils/quoteMath.js` — ToEven tax (10×4.25@5% → 2.12 / 44.62)
- `services/documentsApi.js`, export from `services/index.js`
- `pages/company/QuotationsPage.jsx`, `QuotationEditorPage.jsx`
- `pages/company/AgreementsPage.jsx`, `AgreementEditorPage.jsx`
- `App.jsx`, `Layout.jsx`, `MorePage.jsx` — routes + nav

---

## What changed

| Item | Detail |
|------|--------|
| Quotation CRUD | Server totals; `Quote-{n}`; status Draft\|Final |
| Agreement CRUD | Fixed clause template; Second Party blank; First Party from Settings (+ license CN-4937175) |
| PDF | QuestPDF A4/A5 download/print from editor |
| Feature flag | `Feature_QuotesAgreements` — explicit `false` disables; missing/true enables (opt-out). Removal: drop check ~60 days after stable |
| B0 recommendation | Edit invoice # with uniqueness + gap warn for unpaid / non–VAT-locked; **not implemented** |
| B1/B2/B3 | Audit docs only; no money-path code |

---

## Manually verified

- Backend `dotnet build` — succeeded
- Frontend `npm run build` — succeeded (vite production)
- Acceptance calc `calcQuoteLine(10, 4.25, 5)` → Tax **2.12**, Line **44.62** — PASS (node)

## Not verified (why)

- Live create/edit/PDF against running API + DB (API process was stopped for build lock; no staging deploy in this session)
- Invoice create/return regression against live tenant
- Backup create/download on production disk
- Migration applied to staging/prod DB (additive migration created; apply on deploy)

---

## B-impl gate (awaiting your approval)

1. **B0-impl:** Approve editable invoice number approach in `docs/invoice-number-edit-assessment.md` before any code.
2. **B1-impl / B2-impl:** One confirmed bug per follow-up prompt from audit docs.
3. **B3:** No rebuild; optional UI indicator only if desired (backup is real; POS has no fake auto-backup label).
