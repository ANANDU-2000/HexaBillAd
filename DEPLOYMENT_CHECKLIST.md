# HexaBill Deployment Checklist (Render + Vercel)

Use this to verify and fix production. Backend = Render, Frontend = Vercel.

---

## 1. Render (Backend)

| Check | Action |
|-------|--------|
| **Root Directory** | Must be **empty** (repo root). If set to `backend/HexaBill.Api`, deploy fails with "HexaBill.Api.csproj not found". |
| **Dockerfile** | `backend/HexaBill.Api/Dockerfile` (path from repo root). |
| **Env vars** | `DATABASE_URL` (from linked PostgreSQL or paste internal URL), `JwtSettings__SecretKey` (or generate), `ALLOWED_ORIGINS` (optional; CORS allows `*.vercel.app` by default). |
| **Health** | After deploy: `GET https://hexabill.onrender.com/health` → `{"status":"ok"}`. |
| **DB migration** | If expenses/error-logs fail: run `backend/HexaBill.Api/Scripts/RUN_ON_RENDER_PSQL.sql` in Render PSQL once, then restart API. Or: `cd backend/HexaBill.Api/MigrationFixer`, set `DATABASE_URL`, `dotnet run`. |

---

## 2. Vercel (Frontend)

| Check | Action |
|-------|--------|
| **Root Directory** | Must be **empty** (repo root). vercel.json uses `cd frontend/hexabill-ui`; if Root = `frontend/hexabill-ui` the build fails. |
| **Env var** | `VITE_API_BASE_URL` = `https://hexabill.onrender.com` (no trailing slash). apiConfig adds `/api` automatically. |
| **Build** | Uses `cd frontend/hexabill-ui && npm install` and `npm run build`; output = `frontend/hexabill-ui/dist`. |

---

## 3. Quick verification

1. **Backend:** Open `https://hexabill.onrender.com/health` → must return `{"status":"ok","timestamp":"..."}`.
2. **Frontend:** Open your Vercel URL → login page loads; network tab shows API calls to `https://hexabill.onrender.com/api/...`.
3. **CORS:** If frontend gets CORS errors, add your Vercel URL to Render env `ALLOWED_ORIGINS` (e.g. `https://your-app.vercel.app`). Backend already allows `*.vercel.app`.

---

## 4. If deploy fails on Render

- **"HexaBill.Api.csproj not found"** → Set Root Directory to **empty** (repo root), save, redeploy.
- **Build timeout** → Render free tier may sleep; first request can be slow. Use health check URL to wake.

---

## 5. If expenses or error-logs fail (42703 / errorMissingColumn)

1. Render Dashboard → PostgreSQL → **Connect** → **PSQL**.
2. Paste and run entire `backend/HexaBill.Api/Scripts/RUN_ON_RENDER_PSQL.sql`.
3. Restart the API on Render.

See [MIGRATION_INSTRUCTIONS.md](MIGRATION_INSTRUCTIONS.md) and [RENDER_RUN_MIGRATION_NOW.md](RENDER_RUN_MIGRATION_NOW.md).
