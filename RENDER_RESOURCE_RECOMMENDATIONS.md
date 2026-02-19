# HexaBill – Render Resource Recommendations

## Backend (hexabill-api)

| Plan | RAM | CPU | Use Case |
|------|-----|-----|----------|
| **Free** | 512 MB | 0.1 shared | Development, demos. Spins down after 15 min inactivity. |
| **Starter** | 512 MB | 0.5 shared | **Minimum production.** 1–5 companies, light traffic. |
| **Standard** | 2 GB | 0.5 shared | **Recommended production.** 10–50 companies, moderate traffic. |
| **Pro** | 4 GB | 1 dedicated | 50–200 companies, higher concurrency. |
| **Pro+** | 8 GB | 2 dedicated | 200+ companies, heavy reporting and background jobs. |

### Suggested starting point
- **Production:** **Standard (2 GB RAM)** for a stable multi-tenant SaaS.
- **Starter (512 MB)** is workable but may hit limits under load (reports, backups, many tenants). With many pages, APIs, and GET/POST requests, Starter can cause **timeouts**, **random 500s**, or **slow responses** when several users or tabs are active. If you see those, upgrade to Standard.

---

## PostgreSQL Database

| Plan | RAM | Storage | Use Case |
|------|-----|---------|----------|
| **Free** | 256 MB | 1 GB | Development only. Not for production. |
| **Starter** | 256 MB | 1 GB | Very small production (1–5 companies). |
| **Standard** | 1 GB | 10 GB | **Recommended.** 10–100 companies. |
| **Pro** | 4 GB | 64 GB | 100+ companies, larger datasets. |

### Suggested starting point
- **Production:** **Standard (1 GB RAM, 10 GB)** for typical SaaS usage.
- **Starter (256 MB, 1 GB)** with many tenants or heavy queries can contribute to **DB timeouts** or **500** errors from connection/memory pressure. Upgrade to Standard when you have more than a few companies.
- Upgrade to **Pro** when you have 100+ active tenants or large report volumes.

---

## Project-level robustness

1. **Connection pooling:** Use PgBouncer or Render’s connection pooler for PostgreSQL.
2. **Health checks:** `/health` endpoint is configured in `render.yaml`.
3. **Retries:** Backend uses `NpgsqlRetryingExecutionStrategy` for transient DB errors.
4. **Timeouts:** 30s command timeout to avoid long-running queries blocking the app.
5. **Migrations:** Run migrations on deploy; `FailedLoginAttempts` and `ProductCategories` are created at startup if missing.

---

## Quick reference

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Backend | 512 MB (Starter) | 2 GB (Standard) |
| PostgreSQL | 256 MB (Starter) | 1 GB (Standard) |
| Total monthly (approx) | ~$7–15 | ~$25–35 |
