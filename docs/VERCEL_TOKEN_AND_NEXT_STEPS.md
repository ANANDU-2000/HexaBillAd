# Vercel token, 404 fix, and next steps

After creating the Vercel project and deployment.

---

## 1. Save your Vercel token (never commit it)

You created a Vercel token (starts with `vcp_...`). Store it only in **local** env so it is never pushed to git.

**Option A – backend `.env` (recommended if you already have one)**

- Open `backend/HexaBill.Api/.env`.
- Add a line:
  ```env
  VERCEL_TOKEN=vcp_your_actual_token_here
  ```
- Save. This file is already in `.gitignore`, so it will not be committed.

**Option B – root `.env`**

- In the repo root create or edit `.env` (ensure `.env` is in `.gitignore`).
- Add:
  ```env
  VERCEL_TOKEN=vcp_your_actual_token_here
  ```

Use this token for:
- **Vercel MCP in Cursor:** Cursor does not include a Vercel MCP by default. To use one, add a Vercel MCP entry in `.cursor/mcp.json` that reads the token from the **environment** (e.g. `env.VERCEL_TOKEN`), and set `VERCEL_TOKEN` in your local `.env` so the MCP can use it. Never put the real token inside `mcp.json`.
- **Vercel dashboard:** You can check deploys, logs, and env at [vercel.com](https://vercel.com) without MCP.
- **CLI:** `vercel login` or `vercel link` with the token; or scripts that call the Vercel API using the env var (never hardcode).

---

## 2. Fix 404 on hexa-bill.vercel.app

If the deployment is “Ready” but the site shows **404 NOT FOUND**:

**A. Check project settings in Vercel**

1. Vercel Dashboard → your **HexaBill** project → **Settings** → **General**.
2. Set **Root Directory** to: `frontend/hexabill-ui` (and save).
3. In **Build & Development** (or **Build**):
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Save and trigger a **Redeploy** (Deployments → ⋮ on latest → Redeploy).

**B. Repo config (already updated)**

- `frontend/hexabill-ui/vercel.json` now has `buildCommand`, `outputDirectory`, `framework`, and SPA rewrites.
- Push that file and let Vercel redeploy from the repo so the build uses `dist` and routing works.

After that, `https://hexa-bill.vercel.app` should show the app instead of 404.

---

## 3. Allow frontend in backend (CORS)

So the browser can call your Render API from the Vercel URL:

1. **Render Dashboard** → your **HexaBill** backend service → **Environment**.
2. Set **`ALLOWED_ORIGINS`** to include your Vercel URL (comma-separated, no spaces), e.g.:
   ```env
   https://hexa-bill.vercel.app
   ```
   If you already have other origins, add this one:  
   `https://hexa-bill.vercel.app,https://hexabill.onrender.com`
3. Save. Render will redeploy; then the frontend on Vercel can call the API.

---

## 4. Custom domain (next)

When the app works on `https://hexa-bill.vercel.app`:

1. **Vercel** → project → **Settings** → **Domains** → Add your domain (e.g. `app.yourcompany.com`).
2. Add the **CNAME** (or A) record in your DNS as Vercel shows.
3. Add the **same** domain to **`ALLOWED_ORIGINS`** on Render.
4. Optional: add a custom domain for the API (e.g. `api.yourcompany.com`) in **Render** → **Custom Domains**.

See **`docs/CUSTOM_DOMAIN_AND_CLIENT_SETUP.md`** for the full domain and client setup.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Save `VERCEL_TOKEN` in `backend/HexaBill.Api/.env` (or root `.env`). Do not commit. |
| 2 | Fix 404: Root Directory = `frontend/hexabill-ui`, Output = `dist`, push `vercel.json`, redeploy. |
| 3 | In Render set `ALLOWED_ORIGINS` = `https://hexa-bill.vercel.app` (and any other frontend URLs). |
| 4 | Add custom domain in Vercel (and optionally in Render) when ready. |
