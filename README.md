# HexaBill - SaaS Billing System

**Multi-tenant billing and invoicing platform**

---

## ðŸ—ï¸ Project Structure

**TWO SEPARATE APPLICATIONS:**

```
HexaBill/
â”œâ”€â”€ backend/
â”‚   â””â”€â”€ HexaBill.Api/              # ASP.NET Core 9 API (SaaS Backend)
â”‚       â”œâ”€â”€ Modules/            # Feature modules
â”‚       â”œâ”€â”€ Core/               # Tenancy, storage, auth, infrastructure
â”‚       â”œâ”€â”€ Data/               # Database context
â”‚       â”œâ”€â”€ Models/             # Entity models
â”‚       â””â”€â”€ Migrations/         # Versioned EF schema
â”‚
â”œâ”€â”€ frontend/
â”‚   â””â”€â”€ hexabill-ui/            # React SaaS App (app.hexabill.com)
â”‚       â””â”€â”€ src/
â”‚           â”œâ”€â”€ pages/          # SaaS pages only (Login, Dashboard, POS, etc.)
â”‚           â”œâ”€â”€ components/
â”‚           â””â”€â”€ services/
â”‚
â”œâ”€â”€ frontend-marketing/          # Marketing Site (hexabill.com) - Future
â”‚   â””â”€â”€ .gitkeep                # Placeholder for separate marketing site
â”‚
â””â”€â”€ docs/
    â”œâ”€â”€ RUN_LOCALLY.md
    â”œâ”€â”€ database-schema.md
    â””â”€â”€ deployment.md
```

**Key Separation:**
- âœ… `frontend/hexabill-ui/` = **SaaS Application** (private, tenant-scoped)
- âœ… `frontend-marketing/` = **Marketing Site** (public, demo requests)
- âœ… **One SQL file** for all enterprise tables (no duplicates)

---

## ðŸš€ Quick Start

### Backend
```bash
cd backend/HexaBill.Api
dotnet restore
dotnet run
```
**Database Setup:**
```bash
dotnet ef database update
```

### Frontend
```bash
cd frontend/hexabill-ui
npm install
npm run dev
```

---

## ðŸ” Default Login (Development only)

These accounts are seeded only when `ASPNETCORE_ENVIRONMENT=Development`. Production never resets the SystemAdmin password to a known value.

- **SystemAdmin:** admin@hexabill.com — password from `HEXABILL_DEV_ADMIN_PASSWORD` or `SEED_ADMIN_PASSWORD` (never commit)
- **Tenant 1:** owner1@hexabill.com — password from `HEXABILL_DEV_OWNER1_PASSWORD`
- **Tenant 2:** owner2@hexabill.com — password from `HEXABILL_DEV_OWNER2_PASSWORD`

To create the first production SystemAdmin, set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` once (only used if no SystemAdmin exists).

## Environment

| Variable | Used by | Notes |
|----------|---------|-------|
| `DATABASE_URL` | API / Render | PostgreSQL URL in production |
| `ConnectionStrings__DefaultConnection` | API / local | SQLite `Data Source=hexabill.db` by default |
| `JWT_SECRET_KEY` or `JwtSettings__SecretKey` | API | Required in Production; placeholder rejected |
| `ALLOWED_ORIGINS` | API | Comma-separated frontend origins |
| `PORT` | API | Render bind port; local default `5000` |
| `R2_ENDPOINT`, `R2_ACCESS_KEY`, `R2_SECRET_KEY` | API | Cloudflare R2; local disk is used if unset |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | API | Optional email |
| `VITE_API_BASE_URL` | Frontend | Local: `http://localhost:5000/api`; Production: Render URL |

## CI / CD

GitHub Actions (`.github/workflows/ci.yml`) runs on `main` / `DEV`:

1. Backend restore, Release build, `HexaBill.Tests`
2. Frontend `npm ci`, lint, production build (`frontend/hexabill-ui`)
3. Trivy filesystem scan
4. Docker build of the API with **repository-root** context (`backend/HexaBill.Api/Dockerfile`)

Frontend deploys via Vercel (`vercel.json` â†’ `frontend/hexabill-ui`). Backend deploys via Render (`render.yaml`, health check `/health`).

## Testing

```bash
dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --configuration Release
cd frontend/hexabill-ui && npm run lint && npm run build
```

---

## ðŸ“‹ Tech Stack

- **Backend:** ASP.NET Core 9, PostgreSQL, EF Core
- **Frontend:** React 18, Vite, Tailwind CSS
- **Auth:** JWT Bearer Tokens
- **Multi-tenant:** TenantId-based isolation

---

## ðŸ›¡ï¸ Security

- Tenant isolation enforced at middleware level
- PostgreSQL RLS support
- JWT-based authentication
- Role-based access control

---

**Status:** Active Development  
**Version:** 2.0

