# HexaBill - SaaS Billing System

**Multi-tenant billing and invoicing platform**

---

## 🏗️ Project Structure

**TWO SEPARATE APPLICATIONS:**

```
billingapp/
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

## 🔐 Default Login

- **SystemAdmin:** admin@hexabill.com / Admin123!
- **Tenant 1:** owner1@hexabill.com / Owner1@123
- **Tenant 2:** owner2@hexabill.com / Owner2@123

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

**Status:** Active Development  
**Version:** 2.0
