# HexaBill Production Checklist

Use this list to ensure **all critical features work** before and after deploying to production (e.g. Render backend + PostgreSQL).

---

## Backend (Render + PostgreSQL)

| Item | Status | Notes |
|------|--------|--------|
| Connection string from env | Required | Use `ConnectionStrings__DefaultConnection` or Render env; no hardcoded path in prod |
| Health checks | In place | `GET /health` (lightweight), `GET /health/ready` (DB check) |
| Migrations on deploy | Required | Run `dotnet ef database update` in build/start command or use Render DB init |
| CORS | Required | Restrict `AllowedOrigins` in production to your frontend URL(s) only |
| Logging | Recommended | Structured logs (e.g. Serilog); avoid Console.WriteLine in hot paths |
| Error responses | Required | No raw exception text to client; use correlation ID + generic message |

---

## Frontend (Netlify / Vercel / static host)

| Item | Status | Notes |
|------|--------|--------|
| API base URL | Required | Set `VITE_API_BASE_URL` to production API (e.g. `https://your-api.onrender.com/api`) |
| 500 handling | Required | Show "Something went wrong" + optional correlation ID; no stack trace |
| Auth token storage | In place | Ensure HTTPS in production so token is secure |

---

## Features That Must Work in Production

| Feature | Where to verify |
|---------|------------------|
| Login / Signup | `/login`, `/signup` |
| Dashboard | `/dashboard` – summary, pending bills count, low stock alert |
| Alerts & notifications | Bell icon in header – low stock, overdue, etc. |
| POS / Billing | `/pos` – create invoice, Cash/Credit/Pending |
| Sales Ledger | `/sales-ledger` – entries, pending, balance |
| Customer Ledger | `/ledger` – per-customer balance and history |
| Reports – Outstanding Bills | `/reports?tab=outstanding` – pending/overdue list and export |
| Reports – Summary | `/reports` – summary, sales, expenses |
| Products & stock | `/products` – list, add, edit, stock adjustment |
| Purchases | `/purchases` – add purchase, list; no horizontal page scroll on mobile |
| Payments | `/payments` – record payment, link to invoice |
| Expenses | `/expenses` – add, list |
| Settings | `/settings` – company, branding |
| Backup & Restore | `/backup` – download backup, upload restore (admin) |
| Import data | `/import` – links to backup, products, ledger |
| Updates & Contact Admin | `/updates` – what’s new, WhatsApp/Email contact (if env set) |
| Subscription | `/subscription` – plan info |

---

## Alerts & Notifications (Owner/Admin)

- **Low stock:** Backend creates alerts; bell icon shows count; "View Products" action.
- **Overdue invoices:** Alerts; "View Reports" → Outstanding Bills.
- **Pending bills count:** Dashboard card and Reports → Outstanding Bills.
- **Browser/WhatsApp/Email:** Use Updates page (Contact Admin) for WhatsApp/Email; browser alerts via in-app notifications (bell).

---

## Data Integrity

- Ledgers (Sales, Customer) must reflect latest sales and payments; no duplicate or missing rows from normal flows.
- After restore from backup, all pages should show restored data.
- Tenant isolation: each tenant sees only their own data.

---

## Quick Deploy Reference

**Backend (Render):**
- Build: `dotnet publish -c Release -o out`
- Start: `./out/HexaBill.Api` (or `dotnet out/HexaBill.Api.dll`)
- Env: `ASPNETCORE_ENVIRONMENT=Production`, `ConnectionStrings__DefaultConnection=<PostgreSQL URL>`
- Optional: run migrations in a pre-start script or separate job

**Frontend:**
- Build: `npm run build` (Vite)
- Env: `VITE_API_BASE_URL=https://your-api.onrender.com/api`
- Optional: `VITE_SUPPORT_WHATSAPP`, `VITE_SUPPORT_EMAIL` for Updates page contact

---

**Last updated:** With Updates page, Reports tab sync from URL, and Purchase page scroll/layout fixes.
