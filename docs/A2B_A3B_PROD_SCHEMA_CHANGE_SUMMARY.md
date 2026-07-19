# CHANGE SUMMARY — Prod schema + A2b Quote-5 + A3b Agreement

**Date:** 2026-07-19  
**Scope:** Additive Quotes/Agreements schema on EXTERNAL Postgres + local SQLite; Quotation editor/PDF Quote-5 parity; verbatim Zayoga Agreement template. **No Track B** (invoice number / returns / VAT money path untouched).

---

## Field-gap report (before → after)

### Quotation vs Quote-5
| Gap | Status |
|-----|--------|
| Per-line subtitle | Added `DescriptionSubtitle` + editor + preview/PDF |
| Editable salutation / intro / closing | Added columns + form defaults (`Dear Sir/Mam,` / thank-you intro / hope-offer closing) |
| Tax cell stacked AED + % | Preview + QuestPDF |
| Closing + AUTHORIZED SIGNATURE | Preview + PDF (logo reused from Settings when present) |
| Page X of Y | PDF footer |
| Dual logos second upload | Not invented — single Settings logo path only |

### Agreement vs signed sample
| Gap | Status |
|-----|--------|
| Paraphrased clauses | Replaced with **verbatim** sample wording (Whereas + bullets + Display/Return Policy) |
| Fixed First Party | `ZAYOGA GENERAL TRADING SOLE PROPRIETORSHIP LLC`, `CN-4937175`, `ABUDHABI UAE`, `+971564525130` |
| Footer TEL / email / web | Fixed template strings in DTO + PDF |
| Second Party Name/License/Address/Mobile blank | Wired through form → live preview → PDF |

---

## Production DB (EXTERNAL only)

- **Host (no secrets):** `dpg-d68jhpk9c44c73ft047g-a.singapore-postgres.render.com`
- **Database:** `hexabill`
- **Zayoga TenantId:** `6` (`ZAYOGA GENERAL TRADING`)
- **Applied:** `Scripts/AddQuotationsAndAgreements.sql` (earlier) + `Scripts/AddQuotationLetterFields.sql` (A2b columns)
- **Tables/columns:** `Quotations`, `QuotationItems`, `Agreements`; A2b: `Salutation`, `IntroLine`, `ClosingLine`, `DescriptionSubtitle`
- **Money tables:** untouched (`Sales` / `Payments` / etc. not modified)

## Local SQLite

- Applied same A2b columns via `Scripts/ApplySqliteQuotationLetterFields.py` on `hexabill.db`
- EF migration file: `Migrations/20260719190000_AddQuotationLetterFields.cs` (+ snapshot update)

---

## Files touched (high level)

**Backend:** `Quotation.cs`, `DocumentDtos.cs`, `QuotationService.cs`, `AgreementService.cs` (verbatim `AgreementTemplate`), `PdfService.cs` (Quote-5 + Agreement PDF), SQL scripts, migration  
**Frontend:** `QuotationEditorPage.jsx`, `AgreementEditorPage.jsx`

---

## Acceptance checks

- Line VAT: `10 × 4.25 @ 5%` → Tax **2.12**, Line **44.62** (ToEven) — unchanged in `quoteMath.js` / `QuotationService.ComputeTotals`
- Quote-5 style document totals target: Subtotal **477.50**, Tax **23.88**, Grand **501.38** (recreate sample lines in editor)
- Agreement sample fill: AL SAGAR FISH GRILL / blank license / Abudhabi UAE / 0501437475 → body uses typed Second Party; First Party + clauses fixed
- Builds: `dotnet build` succeeded; frontend build run in verify step
- **Prod money tables untouched**

---

## Out of scope (confirmed)

- Track B invoice number edit / returns / VAT expense fixes
- Pointing everyday local `dotnet run` at prod Postgres
