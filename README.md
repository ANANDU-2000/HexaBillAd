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
│       ├── Core/               # Tenancy, storage, auth, infrastructure
│       ├── Data/               # Database context
│       ├── Models/             # Entity models
│       └── Migrations/         # Versioned EF schema
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
    ├── RUN_LOCALLY.md
    ├── database-schema.md
    └── deployment.md
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
dotnet ef database update
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
dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --configuration Release
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

**Status:** Active Development  
**Version:** 2.0
