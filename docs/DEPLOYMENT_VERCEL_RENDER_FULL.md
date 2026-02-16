# HexaBill – Full Deployment Guide (Vercel + Render)

**Repo:** https://github.com/ANANDU-2000/HexaBill.git  
**Frontend:** Vercel | **Backend:** Render | **Database:** Render PostgreSQL

---

## 1. Quick Push & Update Workflow

To push updates for both frontend and backend:

```bash
# 1. Commit and push to main
git add .
git commit -m "Your update message"
git push origin main

# 2. Vercel auto-deploys when you push (if connected)
# 3. Render auto-deploys when you push (if connected)
```

**Vercel** and **Render** both watch the `main` branch. Pushing triggers new builds. No manual deploy needed unless auto-deploy is disabled.

---

## 2. Environment Variables

### Vercel (Frontend – hexabill-ui)

| Key | Value | Notes |
|-----|--------|-------|
| `VITE_API_BASE_URL` | `https://hexabill.onrender.com/api` | Use your actual Render backend URL. Include `/api`. |

- **Where:** Vercel Dashboard → Project → Settings → Environment Variables  
- **Redeploy** after changing (Deployments → ⋮ → Redeploy)

### Render (Backend – hexabill-api)

| Key | Value | Notes |
|-----|--------|-------|
| `ASPNETCORE_ENVIRONMENT` | `Production` | |
| `DATABASE_URL` | *(Internal Postgres URL from Render)* | From PostgreSQL service → Internal URL |
| `PORT` | `10000` | Render sets this; 10000 is typical |
| `ALLOWED_ORIGINS` | `https://hexa-bill.vercel.app,https://your-domain.com` | Comma-separated, no spaces. Add all frontend URLs. |
| `JwtSettings__SecretKey` | *(64+ char random)* | `openssl rand -base64 48` |

### hexabill:10000 (Internal Address)

On Render, your backend web service has an **internal hostname** (e.g. `hexabill`) and **port** (e.g. `10000`). Other Render services in the same region can reach your API at:

```
http://hexabill:10000
```

- **Use case:** Service-to-service calls (e.g. a worker or cron calling your API from Render)  
- **Frontend:** Uses the **external** URL: `https://hexabill.onrender.com` (or your custom domain)  
- **Database:** Use the **Internal Database URL** from Render PostgreSQL (e.g. `dpg-xxx-a`, not `singapore-postgres.render.com`) for backend ↔ DB

---

## 3. IP Ranges (Vercel / Firewall)

If you need to allowlist Vercel or other services (e.g. Render firewall, DB allowlist):

| Range | Use |
|-------|-----|
| `74.220.52.0/24` | Vercel / outbound IP range |
| `74.220.60.0/24` | Vercel / outbound IP range |

- **Render:** Usually does not require IP allowlisting for inbound; it uses public URLs.  
- **PostgreSQL:** Render Postgres accepts connections from Render services via internal network. For external access, use the External URL and add your IP if needed.  
- **Vercel → Render:** Vercel serverless runs from dynamic IPs. Use **CORS** (`ALLOWED_ORIGINS`) on the backend instead of IP allowlisting for API access.

---

## 4. Render Setup Checklist

1. **PostgreSQL** – Create DB, copy **Internal Database URL**  
2. **Web Service** – Connect repo, set Root Directory: `backend/HexaBill.Api`  
3. **Env vars** – `DATABASE_URL`, `ALLOWED_ORIGINS`, `JwtSettings__SecretKey`, etc.  
4. **Build** – `dotnet restore && dotnet publish -c Release -o out`  
5. **Start** – `dotnet out/HexaBill.Api.dll`

---

## 5. Vercel Setup Checklist

1. **Import** repo `ANANDU-2000/HexaBill`  
2. **Root Directory** – `frontend/hexabill-ui`  
3. **Framework** – Vite  
4. **Env** – `VITE_API_BASE_URL` = `https://<your-backend>.onrender.com/api`  
5. **Deploy**

---

## 6. Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS error | Add exact frontend URL to `ALLOWED_ORIGINS`, redeploy backend |
| 401 / token | Re-login; ensure `JwtSettings__SecretKey` is set |
| Blank page | Check Vercel build logs; confirm Root Directory |
| DB connection failed | Use **Internal** DB URL on Render; ensure migrations ran |
| Backend sleeping | Free tier sleeps; first request slow. Use paid plan for always-on |

---

## 7. Vercel API Key (for CLI / MCP)

- **Never commit** the API key. Add to local `backend/HexaBill.Api/.env` or root `.env`:
  ```
  VERCEL_TOKEN=your_vercel_token_from_dashboard
  ```
- **Where to get:** Vercel Dashboard → Settings → Tokens → Create
- **Use for:** `vercel` CLI, Vercel MCP, or scripts. Frontend env vars (`VITE_API_BASE_URL`) go in **Vercel Dashboard → Project → Settings → Environment Variables**.

---

## 8. File Reference

| Purpose | Path |
|---------|------|
| Vercel config | `frontend/hexabill-ui/vercel.json` |
| Render blueprint | `render.yaml` |
| Backend env (local) | `backend/HexaBill.Api/.env` (gitignored) |
| Frontend env example | `frontend/hexabill-ui/.env.example` |
