# CHANGE SUMMARY — A1b list failures + whitespace (local only)

**Date:** 2026-07-19  
**Scope:** A1b only. No money-path / Track B. Production/Render **not** touched.

## Root cause

`GET /api/quotations` and `GET /api/agreements` returned **500** because local SQLite had **no** `Quotations` / `Agreements` tables. Routes and frontend paths were correct.

## DB used

| Item | Value |
|------|--------|
| Source | `appsettings.json` → `Data Source=hexabill.db` |
| Env prod vars | `DATABASE_URL` / `ConnectionStrings__DefaultConnection` **unset** |
| Path | `backend/HexaBill.Api/hexabill.db` |
| Tenants on this DB | Id 1 Demo Company 1; Id 2 Demo Company 2 (local demo — not live Zayoga Postgres) |

## What changed

1. **Surgical schema** on local SQLite only: created `Agreements`, `Quotations`, `QuotationItems` + indexes; inserted `__EFMigrationsHistory` row `20260719171633_AddQuotationsAndAgreements`. Did **not** run full `MigrateAsync` (local drift / duplicate columns).
2. **List UX:** hide empty-state card when `error` is set ([QuotationsPage.jsx](frontend/hexabill-ui/src/pages/company/QuotationsPage.jsx), [AgreementsPage.jsx](frontend/hexabill-ui/src/pages/company/AgreementsPage.jsx)); removed `max-w-5xl`.
3. **Whitespace:** editors use `items-start`, tighter padding, no forced `flex-1` equal panes.
4. **Prod prep (not applied):** [Scripts/AddQuotationsAndAgreements.sql](backend/HexaBill.Api/Scripts/AddQuotationsAndAgreements.sql) for later Render/Zayoga.

## Manually verified

- `GET /api/quotations` → **200** `data: []` (then 1 after create)
- `GET /api/agreements` → **200** `data: []` (then 1 after create)
- Create quote 10 @ 4.25 @ 5% → Tax **2.12**, Grand **44.62**, `Quote-1`
- Create agreement → `AGR-1`
- Backend: `Build succeeded.`
- Frontend: `npm run build` → `✓ built in 21.86s`

## Not verified

- Live browser toast gone after refresh (API verified; hard-refresh UI)
- Production/Render Zayoga migration — **intentionally not applied**
