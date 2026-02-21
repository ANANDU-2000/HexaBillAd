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

## Recent Fixes (Ledger & Reports)

1. **Ledger date normalization**: Dates now use `ToUtcKind()` and inclusive end date (AddDays(1)) to match Sales Report.
2. **Branch report "Unassigned"**: Sales with `BranchId==null` and `RouteId==null` now appear in Branch comparison as "Unassigned".
