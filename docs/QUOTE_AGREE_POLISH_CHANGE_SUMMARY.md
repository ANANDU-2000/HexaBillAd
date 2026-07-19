# CHANGE SUMMARY — Quotation + Agreement polish

**Date:** 2026-07-19  
**Scope:** Dirty Save UX, persist-before-PDF, product search drawer, print/preview parity. **No Track B.**

---

## Bugs fixed

| Bug | Fix |
|-----|-----|
| Save had no edited/saved state | Baseline snapshot; `Save changes` vs `Saved`; `Unsaved changes` badge; `beforeunload` |
| Download/Print used stale DB data | Always create/update from current form when dirty or unsaved, then PDF |
| Quotation preview placeholder header | Live preview loads company Settings (name, address, phone, email, TRN, logo) |
| No product picker on quote lines | Right-side `QuotationProductDrawer` on description focus / search icon |
| Agreement PDF weaker than preview | Logo from Settings, DATE-, clauses, footer block aligned to sample |

## Files

- `frontend/hexabill-ui/src/pages/company/QuotationEditorPage.jsx`
- `frontend/hexabill-ui/src/pages/company/AgreementEditorPage.jsx`
- `frontend/hexabill-ui/src/components/QuotationProductDrawer.jsx`
- `backend/HexaBill.Api/Modules/Billing/PdfService.cs`
- `backend/HexaBill.Api/Modules/Billing/IPdfService.cs`
- `backend/HexaBill.Api/Modules/Documents/AgreementsController.cs`

## Notes

- Quotation header = **tenant Settings** (same as invoices). Demo Company will not look like Zayoga until Settings match; Zayoga TenantId 6 on prod uses real Settings.
- Agreement First Party + clauses remain fixed Zayoga template; only Second Party is typed.
- Calc unchanged: `10 × 4.25 @ 5%` → Tax **2.12**, Line **44.62**.

## Verify

- `dotnet build` — 0 errors  
- `npm run build` — OK  
- Prod money tables untouched
