# HexaBill Production Deployment: Vercel + Render + PostgreSQL

Deploy **frontend** on **Vercel** (with optional custom domain), **backend** on **Render**, and **database** on **Render PostgreSQL**.

---

## Overview

| Component   | Platform        | Purpose                          |
|------------|------------------|----------------------------------|
| Frontend   | **Vercel**       | React app, HTTPS, custom domain  |
| Backend API| **Render**       | .NET 9 Web Service               |
| Database   | **Render PostgreSQL** | Persistent data            |

**Order of setup:** Database → Backend → Frontend (each step uses the previous).

---

## 1. Render PostgreSQL (Database)

1. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **PostgreSQL**.
2. Create a new PostgreSQL instance:
   - **Name:** `hexabill-db` (or any name)
   - **Region:** Choose closest to your users (e.g. Singapore / Oregon).
   - **Plan:** Free (or paid for production).
3. After creation, open the database and copy:
   - **Internal Database URL** (use this for the backend on Render; it looks like `postgres://user:pass@host/dbname`).

**Save this URL** — you will add it to the backend as `DATABASE_URL`. Do not commit it to git.

---

## 2. Backend on Render (Web Service)

1. **New** → **Web Service**.
2. **Connect repository:** GitHub → `ANANDU-2000/HexaBill` (or your repo).
3. **Settings:**
   - **Name:** `hexabill-api` (your backend URL will be `https://hexabill-api.onrender.com` or your custom name).
   - **Region:** Same as DB if possible.
   - **Branch:** `main`.
   - **Root Directory:** `backend/HexaBill.Api`.
   - **Runtime:** `Docker` or **Native** (see below).
   - **Build Command** (Native):
     ```bash
     dotnet restore && dotnet publish -c Release -o out
     ```
   - **Start Command** (Native):
     ```bash
     dotnet out/HexaBill.Api.dll
     ```
   - Or use **Docker** and add a `backend/HexaBill.Api/Dockerfile` (see optional section).

4. **Environment variables** (Required):

   | Key | Value | Notes |
   |-----|--------|--------|
   | `ASPNETCORE_ENVIRONMENT` | `Production` | |
   | `DATABASE_URL` | *(paste Internal Database URL from step 1)* | From Render PostgreSQL |
   | `PORT` | `10000` | Render sets PORT; 10000 is default if not set |
   | `ALLOWED_ORIGINS` | `https://your-app.vercel.app,https://hexabill.com,https://www.hexabill.com` | Your Vercel URL + custom domains (comma-separated, no spaces) |
   | `JwtSettings__SecretKey` | *(long random string, e.g. 64 chars)* | Generate with: `openssl rand -base64 48` |
   | `JwtSettings__Issuer` | `HexaBill.Api` | Optional override |
   | `JwtSettings__Audience` | `HexaBill.Api` | Optional override |

   **Important:** Add your **exact** Vercel URL(s) to `ALLOWED_ORIGINS` (e.g. `https://hexabill.vercel.app`). After you add a custom domain in Vercel, add that too (e.g. `https://app.hexabill.com`).

5. **Save** and **Deploy**. First deploy will run migrations (handled by `Program.cs` on startup).
6. Copy your backend URL, e.g. `https://hexabill-api.onrender.com` (no `/api`). You will use `https://hexabill-api.onrender.com/api` for the frontend.

**Optional – Free tier spin-down:** On free plan the service sleeps after inactivity. First request after sleep can take 30–60 seconds. Use a paid plan for always-on.

---

## 3. Frontend on Vercel

1. Go to [Vercel](https://vercel.com) → **Add New** → **Project**.
2. **Import** your GitHub repo `ANANDU-2000/HexaBill`.
3. **Configure:**
   - **Root Directory:** `frontend/hexabill-ui` (click Edit and set).
   - **Framework Preset:** Vite.
   - **Build Command:** `npm run build` (default).
   - **Output Directory:** `dist` (default for Vite).
   - **Install Command:** `npm install`.

4. **Environment variables** (add before first deploy):

   | Key | Value | Environment |
   |-----|--------|-------------|
   | `VITE_API_BASE_URL` | `https://hexabill-api.onrender.com/api` | Production (and Preview if you want) |

   Use your **actual** Render backend URL from step 2. The app expects the base URL to include `/api` (e.g. `https://hexabill-api.onrender.com/api`).

5. **Deploy.** Your app will be at `https://your-project.vercel.app` (or your custom subdomain).

6. **Custom domain (strong/secure):**
   - Project → **Settings** → **Domains**.
   - Add domain, e.g. `app.hexabill.com` or `hexabill.com`.
   - Follow Vercel’s DNS instructions (A/CNAME). Vercel provides HTTPS automatically.
   - After adding the domain, add the **exact** origin to the backend’s `ALLOWED_ORIGINS` (e.g. `https://app.hexabill.com`) and redeploy the backend if needed.

---

## 4. Environment Variables Summary

### Render (Backend) – Web Service

```
ASPNETCORE_ENVIRONMENT=Production
DATABASE_URL=postgres://... (from Render PostgreSQL)
PORT=10000
ALLOWED_ORIGINS=https://your-app.vercel.app,https://app.hexabill.com
JwtSettings__SecretKey=<generate with: openssl rand -base64 48>
```

### Vercel (Frontend) – Project

```
VITE_API_BASE_URL=https://hexabill-api.onrender.com/api
```

### Render PostgreSQL

- No env vars needed in the app; connection comes from `DATABASE_URL` on the backend.

---

## 5. Build and Deploy Order

1. **Create** Render PostgreSQL → copy Internal Database URL.
2. **Create** Render Web Service → set `DATABASE_URL` and other env vars → deploy → copy backend URL.
3. **Create** Vercel project → set `VITE_API_BASE_URL` to `https://<your-backend>.onrender.com/api` → deploy.
4. **Update** backend `ALLOWED_ORIGINS` with the final Vercel URL (and custom domain if added).
5. **Redeploy** backend after changing `ALLOWED_ORIGINS`.

---

## 6. Security Checklist

- [ ] `JwtSettings__SecretKey` is long and random (never commit to git).
- [ ] `DATABASE_URL` and secrets only in Render/Vercel env, not in code.
- [ ] `ALLOWED_ORIGINS` includes only your real frontend URLs (no `*` in production).
- [ ] Custom domain on Vercel uses HTTPS (Vercel default).
- [ ] Backend uses `ASPNETCORE_ENVIRONMENT=Production` (HTTPS redirect and stricter settings).

---

## 7. Troubleshooting

| Issue | What to do |
|-------|------------|
| CORS errors in browser | Add the **exact** frontend origin (including `https://`) to backend `ALLOWED_ORIGINS` and redeploy. |
| 401 Unauthorized | Check JWT secret is set and same; token may be expired — try logging in again. |
| Backend 500 / DB errors | In Render dashboard check **Logs**; ensure `DATABASE_URL` is the Internal URL and migrations ran (see startup logs). |
| Frontend “cannot connect” | Confirm `VITE_API_BASE_URL` in Vercel is correct (with `/api`) and backend is not sleeping (free tier). |
| Blank page on Vercel | Confirm Root Directory is `frontend/hexabill-ui` and build succeeds; check Build Logs. |

---

## 8. Optional: Docker for Backend (Render)

If you prefer Docker on Render, add `backend/HexaBill.Api/Dockerfile`:

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY out/ .
ENV ASPNETCORE_URLS=http://0.0.0.0:${PORT}
EXPOSE 10000
ENTRYPOINT ["dotnet", "HexaBill.Api.dll"]
```

And build locally or in CI: `dotnet publish -c Release -o out`, then Docker build copies `out/`. On Render, set **Docker** as runtime and point to this Dockerfile (or build in Render from the same `backend/HexaBill.Api` context).

---

## 9. Quick Reference URLs

After deployment, you will have:

- **Frontend:** `https://your-app.vercel.app` or `https://app.hexabill.com`
- **Backend API:** `https://hexabill-api.onrender.com` (API base for frontend: `https://hexabill-api.onrender.com/api`)
- **Database:** Managed in Render; connect only from backend via `DATABASE_URL`.

Use this doc as the single place to plan and record your production env and URLs.
