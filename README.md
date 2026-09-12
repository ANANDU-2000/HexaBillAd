# HexaBill - SaaS Billing System

**Multi-tenant billing and invoicing platform**

---

## 🏗️ Project Structure

**TWO SEPARATE APPLICATIONS:**

```
HexaBill/
├── backend/
│   └── HexaBill.Api/              # ASP.NET Core 9 API (SaaS Backend)
│       ├── Modules/            # Feature modules
│       ├── Shared/             # Shared components
│       ├── Data/               # Database context
│       ├── Models/             # Entity models
│       └── Scripts/
│           └── 01_COMPLETE_DATABASE_SETUP.sql  # ⭐ Single SQL file
│
├── frontend/
│   └── hexabill-ui/            # React SaaS App (app.hexabill.com)
│       └── src/
│           ├── pages/          # SaaS pages only (Login, Dashboard, POS, etc.)
│           ├── components/
│           └── services/
│
├── frontend-marketing/          # Marketing Site (hexabill.com) - Future
│   └── .gitkeep                # Placeholder for separate marketing site
│
└── docs/
    ├── HEXABILL_GOAL_AND_PROMPT.md
    ├── HEXABILL_UX_UI_MASTER_PROMPT.md  # Master UX/UI design system (all pages)
    ├── UI_UX_DESIGN_LOCK.md              # 🔒 UI/UX lock — always think & update from this
    ├── FOLDER_STRUCTURE.md               # Detailed structure guide
    └── ARCHITECTURE_LOCK.md
```

**Key Separation:**
- ✅ `frontend/hexabill-ui/` = **SaaS Application** (private, tenant-scoped)
- ✅ `frontend-marketing/` = **Marketing Site** (public, demo requests)
- ✅ **One SQL file** for all enterprise tables (no duplicates)

---

## 🚀 Quick Start

### Backend
```bash
cd backend/HexaBill.Api
dotnet restore
dotnet run
```
**Database Setup:**
```bash
# 1. EF Core migrations (automatic)
dotnet ef database update

# 2. Enterprise tables (manual SQL)
psql -d hexabill_db -f backend/HexaBill.Api/Scripts/01_COMPLETE_DATABASE_SETUP.sql
```

### Frontend
```bash
cd frontend/hexabill-ui
npm install
npm run dev
```

---

## 🔐 Default Login (Development only)

These accounts are seeded only when `ASPNETCORE_ENVIRONMENT=Development`. Production never resets the SystemAdmin password to a known value.

- **SystemAdmin:** admin@hexabill.com / Admin123!
- **Tenant 1:** owner1@hexabill.com / Owner1@123
- **Tenant 2:** owner2@hexabill.com / Owner2@123

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

Frontend deploys via Vercel (`vercel.json` → `frontend/hexabill-ui`). Backend deploys via Render (`render.yaml`, health check `/health`).

## Testing

```bash
dotnet test backend/HexaBill.Tests/HexaBill.Tests.csproj --configuration Release
cd frontend/hexabill-ui && npm run lint && npm run build
```

---

## 📋 Tech Stack

- **Backend:** ASP.NET Core 9, PostgreSQL, EF Core
- **Frontend:** React 18, Vite, Tailwind CSS
- **Auth:** JWT Bearer Tokens
- **Multi-tenant:** TenantId-based isolation

---

## 🛡️ Security

- Tenant isolation enforced at middleware level
- PostgreSQL RLS support
- JWT-based authentication
- Role-based access control

---

**Enterprise roadmap:** See PLAN.txt (metrics, risk score, cost estimation, automation).

---

## Production: Branch & Route Data

If Branch/Route pages or Reports tabs show zeros or "No data found":

1. Run `FIX_PRODUCTION_MIGRATIONS.sql` **sections 5 and 5b** on production (adds `Sales.BranchId`/`RouteId`, backfills data)
2. Run: `node backend/Scripts/ensure-zayoga-branch-route.js`
3. Restart the API or wait ~5 minutes for the schema cache to refresh

---

**Status:** Active Development  
**Version:** 2.0
