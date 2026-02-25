# Production Verification Checklist

Use this checklist when deploying or troubleshooting Ledger, Reports, and Dashboard in production (Render + Vercel).

## Environment Variables

| Item | Location | Action |
|------|----------|--------|
| `VITE_API_BASE_URL` | Vercel env | Must be `https://hexabill.onrender.com` (no trailing slash). Frontend uses this for API calls in production. |
| `DATABASE_URL` | Render env | Must point to production PostgreSQL. Invoices and Ledger both read from this DB. |
| `ALLOWED_ORIGINS` | Render env | Must include your Vercel frontend URL (e.g. `https://your-app.vercel.app`). See `.env.example`. |

## Backend (Render)

- **Migrations**: Run `dotnet ef database update` or your migration command in Render Shell after deploy.
- **Logs**: Check Render Logs for `[GetCustomerLedger]` when opening Customer Ledger page. Shows `customerId`, `tenantId`, `from`, `toEnd`, `salesCount`.

## Frontend (Vercel)

- **API base**: [apiConfig.js](frontend/hexabill-ui/src/services/apiConfig.js) uses `PRODUCTION_API` when hostname is not localhost. If `VITE_API_BASE_URL` is set, it overrides.
- **Date format**: Dates are sent as `YYYY-MM-DD` via `toYYYYMMDD()` in services. No changes needed.

## API Quick Test

- Ledger: `GET https://hexabill.onrender.com/api/customers/{customerId}/ledger?fromDate=2024-01-01&toDate=2026-12-31` (with auth)
- Reports: `GET https://hexabill.onrender.com/api/reports/sales?fromDate=2024-01-01&toDate=2026-12-31` (with auth)

## Troubleshooting

### manifest.webmanifest 401

If `manifest.webmanifest` returns 401 on preview URLs (e.g. `billing-app-suragsunils-projects.vercel.app`):

- **Cause**: Vercel [Deployment Protection](https://vercel.com/docs/security/deployment-protection) requires auth for preview deployments.
- **Fix**: Vercel Dashboard → Project → Settings → Deployment Protection → set to **"Only Production Deployments"** so previews are public, or use the production URL (e.g. `billing-app-nine-sage.vercel.app`).

### Ledger 500 (hexabill-api.onrender.com)

- **Check Render Logs**: Look for `[GetCustomerLedger] Error` and `GetCustomerLedgerAsync` stack traces.
- **Schema mismatch**: If PostgreSQL is missing columns in SaleReturns (e.g. migrations not applied), the backend now falls back to a safe projection. Ensure migrations are run: `dotnet ef database update` in Render Shell.
- **Date range**: Verify `fromDate`/`toDate` are valid (YYYY-MM-DD). Very large ranges can cause timeouts.

## Recent Fixes (Ledger & Reports)

1. **Ledger date normalization**: Dates now use `ToUtcKind()` and inclusive end date (AddDays(1)) to match Sales Report.
2. **Branch report "Unassigned"**: Sales with `BranchId==null` and `RouteId==null` now appear in Branch comparison as "Unassigned".
3. **Ledger 500 schema fallback**: SaleReturns query now catches PostgreSQL `undefined_column` and falls back to a projection that excludes optional columns (BranchId, RouteId, ReturnType) when missing.
