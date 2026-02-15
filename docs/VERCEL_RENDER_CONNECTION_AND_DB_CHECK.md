# Vercel frontend ↔ Render backend connection & DB check

Connect the Vercel frontend to the Render API and verify users/super admin in the database.

---

## 1. Connect Vercel frontend to Render backend

The frontend (hexa-bill.vercel.app) must call your API (hexabill.onrender.com). Two places to set:

### A. Vercel (frontend)

1. **Vercel Dashboard** → your **HexaBill** project → **Settings** → **Environment Variables**.
2. Add (or edit):
   - **Name:** `VITE_API_BASE_URL`
   - **Value:** `https://hexabill.onrender.com`  
     (no trailing slash; the app adds `/api` itself)
3. **Redeploy** the frontend (Deployments → ⋮ → Redeploy) so the new value is used in the build.

### B. Render (backend – CORS)

1. **Render Dashboard** → your **HexaBill** web service → **Environment**.
2. Set **`ALLOWED_ORIGINS`** to include your Vercel URL (comma-separated, no spaces), e.g.:
   ```env
   https://hexa-bill.vercel.app
   ```
   If you already have other origins (e.g. custom domain), add this one:  
   `https://hexa-bill.vercel.app,https://app.yourcompany.com`
3. Save. Render will redeploy.

After both are set, login from the Vercel site should hit the Render API and CORS will allow it.

---

## 2. Render backend logs (errors)

From **Render Dashboard** → your HexaBill service → **Logs** you may see:

- **`relation "Subscriptions" does not exist`**  
  The background job (TrialExpiryCheckJob) was failing when the `Subscriptions` table was missing. The job is now resilient: it skips when the table is missing and logs a debug message. Ensure **migrations have run** (they run on startup). If the DB was created before all migrations existed, trigger a **manual redeploy** so the app runs migrations again; or run them manually (see below).

- **Other DB errors**  
  Check that **DATABASE_URL** on Render is the **Internal** Postgres URL and that the database is up.

---

## 3. Vercel frontend logs

- **Build logs:** Vercel → project → **Deployments** → click a deployment → **Building** / logs. Fix any build errors (e.g. missing env, wrong Root Directory).
- **Runtime:** The app is static (React); there are no server-side runtime logs. For API errors or CORS, use the browser **Developer Tools** (F12) → **Console** and **Network** when you sign in or call the API.

---

## 4. UI: tab title, Inter font

- **Browser tab title** is set in `frontend/hexabill-ui/index.html`:  
  **"HexaBill – Billing & Invoicing for Business"** and a short **meta description** for SEO. No “multi-tenant” in the title.
- **Inter font** is already loaded (Google Fonts in `index.html`) and applied in `src/index.css` (`font-family: 'Inter', ...`). Buttons and logo use the existing HexaBill styles.

---

## 5. Super admin and users – check with psql

Only a **super admin** can create companies (tenants). If there are no users yet, the DB will have no rows in **Users** (and no tenants). You can check and fix from your machine using the **external** Postgres URL.

### Get the external URL

- **Render Dashboard** → your **PostgreSQL** service → **Connections** → **External Database URL**  
  (looks like `postgresql://user:password@dpg-xxxxx.singapore-postgres.render.com/dbname`).

### Connect with psql

From a terminal (replace with your actual URL and password):

```bash
# Option 1: URL in one go (Linux/macOS/Git Bash)
PGPASSWORD='YOUR_PASSWORD' psql -h dpg-xxxxx.singapore-postgres.render.com -U hexabill_user hexabill

# Option 2: If you have the full URL
psql "postgresql://hexabill_user:YOUR_PASSWORD@dpg-xxxxx.singapore-postgres.render.com/hexabill?sslmode=require"
```

(On Windows PowerShell you may need to set `$env:PGPASSWORD='...'` then run `psql ...`.)

### Useful queries

```sql
-- List all users (id, email, role)
SELECT "Id", "Email", "Role", "TenantId", "OwnerId" FROM "Users";

-- List tenants (companies)
SELECT "Id", "Name", "Slug" FROM "Tenants";

-- Check if Subscriptions table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'Subscriptions'
);

-- Check applied migrations
SELECT "MigrationId", "ProductVersion" FROM "__EFMigrationsHistory" ORDER BY "MigrationId";
```

If **Users** is empty, you need to create the first **super admin** user (and optionally a tenant). That is usually done via:

- A one-time seed/script, or  
- A signup flow that creates the first tenant + admin, or  
- Direct SQL insert (only if you know the correct schema and password hashing).

Your codebase may have a **Super Admin** signup or seed endpoint; check the backend docs or auth/superadmin modules. Do **not** paste real passwords in docs or chat.

---

## Summary

| Task | Where | Action |
|------|--------|--------|
| Frontend → API | Vercel | `VITE_API_BASE_URL` = `https://hexabill.onrender.com`, then redeploy |
| CORS | Render | `ALLOWED_ORIGINS` = `https://hexa-bill.vercel.app` (and any other frontend URLs) |
| Render errors | Render Logs | Subscriptions error is handled; ensure migrations run (redeploy if needed) |
| Vercel errors | Vercel Deployments + Browser F12 | Build logs and Network/Console for API calls |
| Tab title / SEO | Repo | Already set in `index.html` |
| Inter font | Repo | Already in `index.html` and `index.css` |
| Users / super admin | Postgres | Use **External** URL and psql; run the queries above to inspect **Users** and **Tenants** |
