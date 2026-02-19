# Why Production Errors Happen & How to Build Client Trust

## Why So Many Errors Show Up in Production?

### 1. **Environment mismatch**
- **Local:** Windows, SQLite or local PostgreSQL, no CDN, different URLs.
- **Production (Render):** Linux, hosted PostgreSQL, ephemeral disk, different env vars.
- Code that works locally can fail in production because of **database column naming** (e.g. PostgreSQL lowercases `value`), **missing env vars**, or **different paths**.

### 2. **Database schema drift**
- Migrations might not have been run on production in the same order, or the DB was created manually.
- Result: **"column does not exist"** (e.g. `Setting.Value` vs `value`). Fix: map columns explicitly and run migrations in one place (production) from the same codebase.

### 3. **Ephemeral storage on Render**
- Files under `wwwroot/uploads` (logos, attachments) **disappear on every deploy**.
- DB still has the path → frontend requests the file → **404**. Fix: use persistent storage (e.g. R2/S3) for uploads and serve URLs from there.

### 4. **Not testing against production-like setup**
- If you only test locally, you never see PostgreSQL-specific errors, 404s from missing files, or rate limits. Fix: **staging = same stack as production** (PostgreSQL, env vars, optional R2) and run critical flows there before release.

### 5. **Third-party and browser noise**
- Warnings like **feature_collector.js** come from external scripts, not your app. They don’t break trust if the app works; you can ignore or update the script later.

### 6. **Starter plan limits (0.5 CPU, 512 MB RAM, small DB)**
- With **many pages, APIs, GET/POST, and concurrent users**, the Starter plan can contribute to production errors:
  - **512 MB RAM:** Heavy reports, backups, or many concurrent requests can cause **out-of-memory** or restarts → 502/503 or 500.
  - **0.5 shared CPU:** Under load, requests queue → **slow responses** or **timeouts** (e.g. 504 or 500).
  - **DB Starter (256 MB RAM, 1 GB):** Many connections or heavy queries can exhaust connections or memory → **timeouts** or **500** from the backend.
- The **tenant list 500** and **logo 404** you saw were **not** from limits—they were from DB column name and ephemeral disk. But if you see **random 500s**, **timeouts**, or **slow pages** when several users or tabs are open, **Starter limits are likely involved**.
- **When to upgrade:** If you have more than a few companies, or users run reports/backups often, move to **Standard (2 GB RAM)** for the backend and **Standard (1 GB RAM, 10 GB)** for the DB. See `RENDER_RESOURCE_RECOMMENDATIONS.md`.

---

## What to Do So Clients Can Trust the App

### A. **Before each release (mandatory)**

| Step | Action |
|------|--------|
| 1 | Run **all migrations** on the same DB (or staging) that mirrors production. |
| 2 | Test **Super Admin** flows: tenant list, tenant detail, suspend/activate, clear data. |
| 3 | Test **Owner** flows: dashboard, POS, ledger, reports, settings (including logo upload if used). |
| 4 | Test **Staff** flows: POS and ledger with branch/route restrictions. |
| 5 | Use **PostgreSQL** (not only SQLite) for this testing. |

### B. **One-time hardening (recommended)**

| Item | What to do |
|------|------------|
| **DB column mapping** | Ensure every entity maps to real column names (e.g. `Setting.Value` → `value`). Already done for `Setting`. |
| **Uploads** | Configure **R2 (or S3)** for logos/attachments so URLs persist across deploys. Document in README. |
| **Health + errors** | Keep `/api/health` and ensure errors return **structured JSON** (no stack traces to client). |
| **Frontend fallbacks** | Every logo/image request: **onError** → placeholder or initial (already in place for logo). |

### C. **Ongoing (builds long-term trust)**

| Practice | Why it helps |
|----------|--------------|
| **Staging environment** | Same as production (PostgreSQL, env, R2 if used). Deploy here first; run smoke tests. |
| **Check Render logs after deploy** | Catch 500s and "column does not exist" immediately. |
| **Single checklist** | Use `PRODUCTION_CHECKLIST.md` before go-live and for major features. |
| **Document known limits** | e.g. "Logo/uploads reset on deploy until R2 is configured." Sets expectations. |

---

## Summary: Why Errors vs What to Do

| Why errors happen | What to do |
|-------------------|------------|
| DB column name (Value vs value) | Map columns in EF; run migrations on production. |
| Ephemeral disk (logos 404) | R2/S3 for uploads; frontend fallback already in place. |
| No production-like testing | Add staging; test Super Admin + Owner + Staff there. |
| Env / config differences | Document required env vars; validate on startup if possible. |
| **Starter plan (0.5 CPU, 512 MB, small DB)** | Can cause timeouts, 500s, slowness under load. Upgrade to Standard when you have multiple tenants or heavier usage. |

If you do **A (before each release)** and **B (one-time hardening)**, the number of surprises in production drops a lot. **C** keeps trust high as you add features and scale. If errors persist under load, upgrade backend and DB per `RENDER_RESOURCE_RECOMMENDATIONS.md`.
