# Deploy to Production — Quick Steps

**Before deploy:** Backend and frontend build OK. Backend runs locally; `/health` returns 200.

**Your code lives in:** `ANANDU-2000/HexaBillAd` (commit `8305a00` and later).

---

## Use ONE repo — do not create new ones

Creating more repos does **not** fix deployment. The issues are **settings** (wrong repo linked, env, Redeploy vs push), not the repo. Stick to **HexaBillAd**. Do the one-time checklist below; after that, deploy = push to main.

---

## Edit and update — one by one

Do these in order. One change per step, then Save where needed.

**RENDER (backend)**  
1. Open **Render** → your **HexaBill** web service.  
2. **Settings** → **Build & Deploy** → **Repository**. If it is not **HexaBillAd**, change it to **ANANDU-2000/HexaBillAd**, branch **main**. Click **Save**.  
3. **Environment** (left sidebar). Click **Edit** (or the variable).  
4. Find **ASPNETCORE_ENVIRONMENT**. Set value to exactly: **Production** (no URL). Save.  
5. Find **ALLOWED_ORIGINS**. Set value to exactly (no spaces after commas):  
   `https://hexabill.company,https://www.hexabill.company`  
   (Add `,https://hexa-bill-sw.vercel.app` if you use that domain.) Save.  
6. Click **Save** (or **Save, rebuild, and deploy**) so the backend restarts.

**VERCEL (frontend)**  
7. Open **Vercel** → project **hexa-bill-sw**.  
8. **Settings** → **Git**. Set **Production Branch** to **main**. Save.  
9. **Settings** → **General** (or **Build and Deployment**). Set **Root Directory** to **frontend/hexabill-ui** (or leave empty if you use the override commands). If you set Root Directory, set **Build Command** to **npm run build** and **Output Directory** to **dist**. Save.  
10. **Settings** → **Environment Variables**. Ensure **VITE_API_BASE_URL** = **https://hexabill.onrender.com** for Production. Add or edit if missing. Save.

**TRIGGER NEW DEPLOYMENT**  
11. On your PC, open terminal in the repo folder. Run:  
    `git commit --allow-empty -m "chore: trigger deploy"`  
    then  
    `git push origin main`.  
12. In **Vercel** → **Deployments**, wait for the new deployment to show **Ready**.  
13. Open that new deployment → **⋯** (three dots) → **Promote to Production**.

Done. Your live site will use the latest code and current settings.

---

## ⚠️ Private GitHub repo — check Vercel access

If your repo is **Private** (HexaBillAd is private), Vercel needs GitHub app installation:

1. **GitHub** → your profile → **Settings** → **Applications** → **Installed GitHub Apps** → find **Vercel**.
2. **Configure** → check **Repository access**:
   - Should include **ANANDU-2000/HexaBillAd** (or "All repositories").
   - If missing, click **Configure** → add **HexaBillAd** → **Save**.
3. **Vercel** → project **hexa-bill-sw** → **Settings** → **Git**:
   - Repository should show **ANANDU-2000/HexaBillAd**.
   - If it says "Not connected" or shows a different repo, click **Connect Git Repository** → select **HexaBillAd** → **Connect**.

**If Vercel can't access the private repo:**
- Auto-deploy won't work (no webhook deliveries).
- "Create Deployment" may fail with "commit author required" or "repository not found".
- Fix: ensure Vercel GitHub app has access to **HexaBillAd**.

---

## Deploy with Vercel token (no GitHub — fixes "commit author" / auto-deploy)

Use this when GitHub → Vercel keeps failing. **Do not put your token in chat or in the repo.**

1. **Get a token:** Vercel Dashboard → **Settings** → **Tokens** → Create Token (e.g. "Deploy HexaBill"). Copy the token.
2. **Create or edit `.env`** in the **repo root** (or in `frontend/hexabill-ui`). Add:
   ```
   VERCEL_TOKEN=your_token_here
   ```
   Optional (if you want to deploy to a specific project):
   ```
   VERCEL_PROJECT_ID=prj_cEFitsLVK0VRbE4IqBfQQ31xea2n
   VERCEL_ORG_ID=team_xxxx
   ```
   Get **Project ID** from Vercel → project **hexa-bill-sw** → Settings → General. Get **Org ID** from the project URL or from an existing `.vercel/project.json` after running `npx vercel link` once.
3. **Run the script** from the repo root (PowerShell):
   ```powershell
   .\scripts\deploy-vercel-direct.ps1
   ```
   The script will:
   - Build and deploy to Vercel (production) — no GitHub, no "commit author" check
   - Auto-link to a project if `.vercel` directory doesn't exist
   - Show deployment URLs when done
   
   **Note:** If it links to the wrong project (e.g. `hexabill-ui` instead of `hexa-bill-sw`), remove `.vercel` directory in `frontend/hexabill-ui` and set `VERCEL_PROJECT_ID` in `.env` to the correct project ID, then run the script again.

---

## ⚠️ Why production didn’t update (repo mismatch)

- **Render** was linked to **`ANANDU-2000/HexaBill`** (different repo). So pushes to **HexaBillAd** never triggered a Render deploy. **Fix:** In Render Dashboard → HexaBill service → **Settings** → **Build & Deploy** → **Repository** → change to **HexaBillAd** (or connect and select `ANANDU-2000/HexaBillAd`), then **Save** and **Manual Deploy** → **Deploy latest commit**.
- **Vercel** is connected to **HexaBillAd**. If the live deployment still shows an old commit (e.g. `aeee6b3`) or keeps redeploying old code, see **“Force Vercel to use latest commit”** below.

---

## 1. GitHub push (trigger Vercel + Render)

```powershell
cd "c:\Users\anand\Downloads\HexaBil-App\HexaBil-App"
git status
git add -A
git commit -m "Production: ping/connection fixes, deploy prep"
git push origin main
```

- **Vercel:** Auto-deploys when you push to `main` (if repo is connected).
- **Render:** Auto-deploys when you push to `main` (if repo is connected and Root Directory = `backend/HexaBill.Api`).

---

## 2. Force Vercel to use latest commit (fix “old redeploy” issue)

**Why Redeploy doesn't get latest code:** Redeploy rebuilds the **same** commit (e.g. aeee6b3), not the latest on GitHub (8305a00). Use **step 4** (push) to deploy latest.

If Vercel is not updating after a push and keeps redeploying old code:

1. **Redeploy from latest commit (no “Create Deployment”):**
   - Vercel → your project (**hexa-bill-sw**) → **Deployments**.
   - Find the **latest** deployment (top of the list). Check its commit — if it’s **not** `8305a00` or your latest, continue.
   - Click the **⋯** (three dots) on that deployment → **Redeploy**.
   - In the redeploy dialog, leave **“Use existing Build Cache”** **unchecked** so it does a full rebuild from the **current** `main` branch, then confirm. Redeploy still uses the same commit (e.g. aeee6b3)—to get 8305a00 use step 4 (push).
2. **If Production still shows an old deployment:** After the new deployment is **Ready**, open it → **⋯** → **Promote to Production** so the live site (e.g. hexabill.company) serves the new build.
3. **Make sure Git is connected to `main`:** **Settings** → **Git** → **Production Branch** should be **main**. If it was something else, change to **main** and save; the next push will deploy from `main`.
4. **Trigger a fresh deploy with a push:** From your repo run:  
   `git commit --allow-empty -m "chore: trigger Vercel deploy"` then `git push origin main`. That creates an empty commit and pushes; Vercel will build from the new tip of `main` (which includes 8305a00).

---

## 3. Vercel (frontend) — check

| Item | Action |
|------|--------|
| **Root Directory** | Prefer **`frontend/hexabill-ui`** (so Build = `npm run build`, Output = `dist`). If you use repo root with overrides (Build = `cd frontend/hexabill-ui && npm run build`, Output = `frontend/hexabill-ui/dist`), keep it consistent. |
| **Build** | `npm run build` (if Root = frontend/hexabill-ui) or `cd frontend/hexabill-ui && npm run build` (if Root empty). |
| **Output** | `dist` or `frontend/hexabill-ui/dist` to match. |
| **Env (Production)** | `VITE_API_BASE_URL` = `https://hexabill.onrender.com` (or your Render API URL). |

**"Production deployment settings differ from Project Settings" warning:** Production is running a build made with *old* settings. Fix: create a **new** deployment from the latest commit (push to main), then **Promote to Production**. That new deployment will use your current Project Settings. Do not rely on Redeploy to fix the mismatch.

After push, open the Vercel project → **Deployments** → latest should build and go live.

---

## 4. Render (backend) — check

| Item | Action |
|------|--------|
| **Root Directory** | `backend/HexaBill.Api` |
| **Runtime** | Native or Docker (per `render.yaml` / dashboard) |
| **Env** | `ASPNETCORE_ENVIRONMENT=Production`, `DATABASE_URL`, `ALLOWED_ORIGINS` (include your Vercel URL), `JwtSettings__SecretKey` |
| **Health** | `/health` — used by Render for health checks |

After push, Render will rebuild and deploy. First request after free-tier spin-down may take 30–60 s.

---

## 5. Production checks after deploy

1. **Backend:** Open `https://hexabill-api.onrender.com/health` (or your URL) → expect `{"status":"Healthy",...}`.
2. **Frontend:** Open your Vercel URL → login and use Dashboard/Reports.
3. **CORS:** If login/API fails with CORS, add the **exact** Vercel URL to Render env `ALLOWED_ORIGINS` (comma-separated, no spaces) and redeploy backend.

---

## 6. Errors / risks (already addressed)

- **Ping 404:** Handled; ping is best-effort, no disconnect/toast.
- **Connection spam:** Health check backoff (15s → 60s) when backend is down.
- **API base:** Production uses `VITE_API_BASE_URL`; localhost only when host is localhost/127.0.0.1.

Full details: `docs/PRODUCTION_DEPLOYMENT_VERCEL_RENDER.md`.

---

## 8. Render & Vercel env — fix these now

### Render (backend) — correct values

| Variable | Must be | Your screenshot / common mistake |
|----------|--------|----------------------------------|
| **`ASPNETCORE_ENVIRONMENT`** | **`Production`** (exactly) | ❌ Do **not** set this to a URL. If it’s `https://hexabill.company` or any URL, change it to **`Production`**. The backend uses this for environment name only, not for CORS. |
| **`ALLOWED_ORIGINS`** | Comma-separated, **no spaces** after commas | ❌ Spaces (e.g. `https://hexabill.company, https://www...`) can break CORS. Use the copy-paste value below. |
| **`DATABASE_URL`** | Your Render Postgres URL | ✅ Keep as-is. |
| **`JwtSettings__SecretKey`** | Long random secret | ✅ Keep as-is. |

**Copy-paste for Render (hexabill.company):**

- **`ASPNETCORE_ENVIRONMENT`** → set to exactly: `Production`
- **`ALLOWED_ORIGINS`** → set to exactly (no spaces after commas):
  ```
  https://hexabill.company,https://www.hexabill.company,https://hexabill.netlify.app,https://www.hexabill.netlify.app
  ```
  If you also use Vercel, add: `,https://hexa-bill-sw.vercel.app`

After editing, **Save** then **Manual Deploy** so the backend restarts with the correct env.

### Vercel (frontend)

| Variable | Value | Note |
|----------|--------|------|
| **`VITE_API_BASE_URL`** | `https://hexabill.onrender.com` or `https://hexabill.onrender.com/api` | ✅ Both work; the app adds `/api` if missing. Your current value is fine. |

Backend is up: [https://hexabill.onrender.com](https://hexabill.onrender.com) returns `{"service":"HexaBill.Api","status":"Running","version":"2.0"}`.

---

## 7. One-time fix so latest code (8305a00) goes to production

| Platform | What to do |
|----------|------------|
| **Render (backend)** | Dashboard → your HexaBill **web service** → **Settings** → **Build & Deploy** → **Repository**. If it says `HexaBill`, change it to **HexaBillAd** (connect GitHub and pick `ANANDU-2000/HexaBillAd`, branch `main`). Save, then **Manual Deploy** → **Deploy latest commit**. |
| **Vercel (frontend)** | Project **hexa-bill-sw** → **Deployments** → find the deployment for commit **8305a00** (or latest). If it’s not “Production”, open it → **⋯** → **Promote to Production**. If there’s no deployment for 8305a00, push again from this repo or use **Redeploy** on the latest deployment so it rebuilds from current `main`. |
| **Env (both)** | See **section 7** (Render: fix `ASPNETCORE_ENVIRONMENT`; Vercel: `VITE_API_BASE_URL` is OK). |
