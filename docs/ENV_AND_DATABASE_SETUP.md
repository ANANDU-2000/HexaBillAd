# Environment variables & database (PostgreSQL) setup

Where to save your **Render PostgreSQL** details and other secrets.

---

## ⚠️ Never commit real credentials

- Do **not** put your real password or database URLs in any file that is committed to git.
- Use **Render Dashboard** for production. Use a local **`.env`** only for local dev, and keep `.env` gitignored.

---

## 1. Production (backend on Render)

Set these in **Render Dashboard** → your **backend Web Service** → **Environment** tab.

| Variable | What to set | Example (fake) |
|----------|-------------|----------------|
| `DATABASE_URL` | **Internal Database URL** from your Render Postgres | `postgresql://user:xxx@dpg-xxx-a/hexabill` |
| `ASPNETCORE_ENVIRONMENT` | `Production` | |
| `PORT` | `10000` (or leave unset; Render sets it) | |
| `ALLOWED_ORIGINS` | Your Vercel URL(s), comma-separated | `https://hexabill.vercel.app,https://app.hexabill.com` |
| `JwtSettings__SecretKey` | Long random string (e.g. `openssl rand -base64 48`) | |

**Which URL to use on Render?**

- Use the **Internal Database URL** for the backend Web Service (same Render account, same region = faster and more secure).
- Format: `postgresql://hexabill_user:PASSWORD@dpg-xxxxx-a/hexabill` (host without `.singapore-postgres.render.com`).

You do **not** need to create a `.env` file on Render; the dashboard env vars are enough.

---

## 2. Local development (optional)

If you want to run the backend locally and point it at **Render Postgres** (e.g. to test production DB):

1. Copy the example file:
   ```bash
   cd backend/HexaBill.Api
   cp .env.example .env
   ```
2. Edit **`.env`** and set only the variables you need:
   - For **Render Postgres from your machine**, use the **External Database URL** in `DATABASE_URL` (the one with `singapore-postgres.render.com`).
   - Do **not** commit `.env` (it is in `.gitignore`).

**Note:** ASP.NET Core does not load `.env` files by default. To use `.env` locally you can either:

- Export variables in your shell before `dotnet run`, or
- Use a package like `DotNetEnv` and load `.env` at startup (optional).

For local dev, many developers use **SQLite** (no `DATABASE_URL` set) and use Postgres only on Render.

---

## 3. What to store where (summary)

| What | Where to save | Never put in git |
|------|----------------|-------------------|
| Internal DB URL | Render Dashboard → Backend Service → `DATABASE_URL` | ✅ Yes |
| External DB URL | Only in Render Dashboard or local `.env` if you need it | ✅ Yes |
| DB password | Render Dashboard; or local `.env` | ✅ Yes |
| JWT secret | Render Dashboard → `JwtSettings__SecretKey`; or local `.env` | ✅ Yes |
| `.env.example` | Repo (placeholders only, no real values) | N/A |

---

## 4. Your current database (reference)

You created a Postgres instance on Render. Keep these only in a **private** place (e.g. password manager or Render env):

- **Database name:** `hexabill`
- **Username:** `hexabill_user`
- **Password:** *(store only in Render env or local .env)*
- **Internal URL:** for backend on Render (host: `dpg-d68jhpk9c44c73ft047g-a`, no `.singapore-postgres.render.com`)
- **External URL:** for connecting from your PC (host: `dpg-d68jhpk9c44c73ft047g-a.singapore-postgres.render.com`)

**Next step:** When you create the **backend Web Service** on Render, add `DATABASE_URL` = Internal Database URL (paste from the Postgres “Internal Database URL” field). No need to put the password in a separate variable; it’s inside the URL.
