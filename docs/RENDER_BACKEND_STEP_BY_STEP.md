# Render Backend – Step by Step (Web Service)

Use these values on the **New Web Service** form. Your repo is already connected (ANANDU-2000/HexaBill).

---

## ⚠️ CRITICAL: Root Directory

**Root Directory must be exactly:** `backend/HexaBill.Api`  
**Not** `HexaBill.Api` (that path does not exist at repo root; the backend lives under `backend/`).

If you see: `Root directory "HexaBill.Api" does not exist` or `lstat .../backend/HexaBill.Api: no such file or directory` → in Render go to **Settings** → **Build & Deploy** → set **Root Directory** to **`backend/HexaBill.Api`** → Save. Then **Manual Deploy** again.

---

## 1. Basic settings

| Field | Value |
|-------|--------|
| **Name** | `hexabill-api` (or keep `HexaBill`) |
| **Project** | Optional – e.g. create project "HexaBill" |
| **Language** | **Docker** |
| **Branch** | `main` |
| **Region** | **Singapore (Southeast Asia)** (same as your DB) |
| **Root Directory** | **`backend/HexaBill.Api`** (must include `backend/` prefix) |
| **Instance Type** | **Free** (or Starter $7 if you want no sleep) |

---

## 2. Docker

The repo **Dockerfile** works with **Root Directory empty** and **Docker Build Context** = `.` (repo root): it copies `backend/HexaBill.Api/` explicitly, so the build succeeds without changing Render settings.

If you prefer to set Root Directory, use **one** of these:

**Option A (Root Directory empty – current default):**
- **Root Directory**: leave **empty**
- **Dockerfile Path**: `backend/HexaBill.Api/Dockerfile`
- **Docker Build Context Directory**: `.`
- No Pre-Deploy Command.

**Option B (Root Directory set – paths relative to repo root):**

| Field | Value |
|-------|--------|
| **Dockerfile Path** | `backend/HexaBill.Api/Dockerfile` |
| **Docker Build Context Directory** | `backend/HexaBill.Api` (must be exactly this – not `backend` alone) |
| **Docker Command** | Leave empty |

**If you see `.../HexaBill.Api/backend: no such file`:**  
1. **Pre-Deploy Command** must be **empty** (delete any `backend/HexaBill.Api/` or `$`).  
2. Use **Docker Build Context Directory** = **`backend/HexaBill.Api`** (full path from repo root), **not** `.`  
3. **Dockerfile Path** = **`backend/HexaBill.Api/Dockerfile`**  
4. Save → Manual Deploy.

---

## 3. Environment variables

Click **Add Environment Variable** and add these **one by one** (use your real values):

| NAME | VALUE |
|------|--------|
| `DATABASE_URL` | Your **Internal** URL from Render Postgres, e.g. `postgresql://hexabill_user:YOUR_PASSWORD@dpg-d68jhpk9c44c73ft047g-a/hexabill` |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ALLOWED_ORIGINS` | `https://hexabill.vercel.app` (replace with your real Vercel URL after you deploy frontend; you can add more later) |
| `JwtSettings__SecretKey` | Long random string (run locally: `openssl rand -base64 48` and paste the result) |

**Important:** Use the **Internal Database URL** from your Postgres (Connections → Internal Database URL). Do not use the external URL here.

---

## 4. Advanced

| Field | Value |
|-------|--------|
| **Health Check Path** | `/health` |
| **Pre-Deploy Command** | Leave empty |
| **Auto-Deploy** | **On** (On Commit) |

---

## 5. Create and deploy

1. Click **Create Web Service**.
2. Wait for the first build (Docker build + deploy). It can take a few minutes.
3. When it’s live, your API URL will be like:  
   `https://hexabill-api.onrender.com`  
   (or whatever name you gave the service).
4. Test: open `https://YOUR-SERVICE-NAME.onrender.com/health` in the browser – you should see `{"status":"Healthy",...}`.

---

## 6. After deploy

- Copy your backend URL (e.g. `https://hexabill-api.onrender.com`).
- You will need it for the **Vercel frontend** as:  
  `VITE_API_BASE_URL=https://hexabill-api.onrender.com/api`
- If your Vercel URL changes later, update **ALLOWED_ORIGINS** in Render (Environment) and redeploy.

---

## Troubleshooting

- **`Root directory "HexaBill.Api" does not exist`**: Set **Root Directory** to **`backend/HexaBill.Api`** (with `backend/` prefix). Settings → Build & Deploy → Root Directory → Save → Manual Deploy.
- **`lstat .../HexaBill.Api/backend: no such file or directory`**: Docker Build Context is wrong. You likely set it to **`backend`** so Render looks for `backend/HexaBill.Api/backend`. Fix: **Settings** → **Build & Deploy** → **Docker Build Context Directory** → set to **`.`** (one dot) and **Dockerfile Path** → **`Dockerfile`** (no path). Save → Manual Deploy. Alternatively set Docker Build Context to **`backend/HexaBill.Api`** and Dockerfile Path to **`backend/HexaBill.Api/Dockerfile`** (both relative to repo root).
- **Build fails:** Root Directory = `backend/HexaBill.Api`. Docker: either (Context = `.`, Dockerfile = `Dockerfile`) or (Context = `backend/HexaBill.Api`, Dockerfile = `backend/HexaBill.Api/Dockerfile`).
- **DB connection error:** Make sure `DATABASE_URL` is the **Internal** URL from the Postgres service (same region).
- **502 / service not starting:** Check **Logs** in Render; ensure `JwtSettings__SecretKey` is set and migrations run (they run on startup in `Program.cs`).
