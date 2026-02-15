# Production readiness & Super Admin – plan and roadmap

For **~1000 clients** (companies), **scalable SaaS**, **strong error handling**, and **advanced Super Admin** control. Use this to prioritise work and avoid conflicts.

---

## 1. Vercel / MCP / local file

- **Vercel token:** Keep it only in **local** `.env` (e.g. `backend/HexaBill.Api/.env` or repo root `.env`) as `VERCEL_TOKEN=vcp_...`. Never commit. See `docs/VERCEL_TOKEN_AND_NEXT_STEPS.md`.
- **Vercel MCP in Cursor:** Cursor does **not** ship with a Vercel MCP. To use one:
  - Add a Vercel MCP config in `.cursor/mcp.json` that reads `VERCEL_TOKEN` from the environment (so the token stays in `.env`, not in the JSON file).
  - Or use the **Vercel dashboard** for deploy checks, logs, and env (no MCP).
- **Deploy / conflicts:** Always pull before pushing; run build and tests locally to catch errors and reduce deploy failures.

---

## 2. Production for ~1000 clients – risks and mitigations

| Risk | Mitigation | Status / next step |
|------|------------|--------------------|
| **DB connections** | Use connection pooling (Npgsql default); keep timeouts and max pool size sane. | ✅ Default pooling. Consider tuning if you see connection exhaustion. |
| **Tenant data leak** | Every API filters by `TenantId` / owner; middleware enforces context. | ✅ Enforced. Audit new endpoints. |
| **Unhandled exceptions** | Global exception handler returns 500 + correlationId, logs full detail. | ✅ `GlobalExceptionHandlerMiddleware` first in pipeline. |
| **Rate limiting** | Security middleware (rate limit) to avoid abuse. | ✅ In place. Tune limits for 1000 clients if needed. |
| **Migrations on deploy** | Migrations run at startup; idempotent where possible (e.g. sequence). | ✅ Fixed. Keep new migrations idempotent. |
| **CORS** | `ALLOWED_ORIGINS` on Render; frontend only calls configured API. | ✅ Set for Vercel + custom domain. |
| **Secrets** | No secrets in repo; env in Render/Vercel and local `.env` only. | ✅ .gitignore for .env. |
| **Scaling** | Single instance per environment. For 1000 clients, monitor CPU/memory and plan horizontal scaling or larger instance. | 📋 Monitor; scale when needed. |
| **Errors in logs** | Structured logging; correlation IDs; PostgreSQL error middleware. | ✅ In place. Optional: persist critical errors to DB (e.g. ErrorLogs). |

---

## 3. Error prevention and code strength

- **Global handler:** First middleware catches unhandled exceptions, logs with correlation ID, returns stable JSON (no stack trace to client).
- **PostgreSQL middleware:** Logs and classifies DB errors; helps debug production issues.
- **Consistent responses:** Use `ApiResponse<T>` / standard JSON shape so frontend can handle errors uniformly.
- **Validation:** Validate input at API boundary; return 400 with clear messages.
- **New features:** Always scope by tenant; add try/catch where appropriate; log and return safe messages to client.

---

## 4. Super Admin – current vs advanced (roadmap)

**Current Super Admin capabilities**

- Companies (tenants) CRUD, suspend, activate, delete.
- Company detail: users, subscription, usage metrics, duplicate data, clear data.
- Demo requests approval.
- Platform dashboard (totals, lifecycle).
- Diagnostics, backups, audit (where implemented).

**Suggested advanced features (plan and build over time)**

| Feature | Purpose | Priority | Status |
|--------|---------|----------|--------|
| **Platform health endpoint** | DB status, last migration, company count for monitoring. | High | ✅ **Done:** `GET /api/superadmin/platform-health` (SystemAdmin only). |
| **Audit log viewer (platform-wide)** | See who did what, when, per company or globally. | High | Planned |
| **Billing / usage per company** | Invoices, usage vs plan, overages. | Medium |
| **Global search** | Search across companies (e.g. by name, email) for support. | Medium |
| **Feature flags per company** | Enable/disable features per company. | Medium |
| **Country / region defaults** | Default currency, locale, legal templates by country. | Medium |
| **Bulk operations** | Bulk suspend, bulk email, bulk export. | Low |
| **API usage and rate limits per company** | Throttling and quotas per company. | Low |
| **Real-time alerts** | Notify Super Admin on critical events (e.g. payment failure, abuse). | Low |

**Better flow**

- Single “Companies” list with filters (status, country, plan).
- Company detail: tabs (Overview, Users, Billing, Logs, Settings) and clear actions (Suspend, Impersonate, Export).
- Demo requests: one queue with Approve / Reject and optional template company.

---

## 5. UI/UX and logic

- **Company app (client-facing):** Clean, minimal; “company” not “tenant”; one primary action per screen; loading and error states on all async actions.
- **Super Admin:** Dense but clear; tables with sort/filter; destructive actions behind confirmation; success/error toasts.
- **Real-time:** Today most updates are on request (refresh or next load). For “real-time” later: add SignalR or similar for live notifications (e.g. new invoice, alert); start with high-value screens (e.g. dashboard totals, alerts).

---

## 6. What to build next (suggested order)

1. **Platform health endpoint** (e.g. `/api/superadmin/health`) – DB, migrations, optional disk – for monitoring and status pages.
2. **Audit log storage and Super Admin viewer** – Log key actions (company create/suspend, user add, etc.) and show in Super Admin UI.
3. **Country/region defaults** – Default currency and locale per country for new companies.
4. **Stronger validation and error messages** – Consistent 400 responses and user-facing messages on all public APIs.
5. **Real-time** – Only after core scaling and Super Admin features are stable; start with one channel (e.g. alerts or dashboard).

---

## 7. Summary

- **Vercel:** Token in local `.env`; use dashboard or optional Vercel MCP with env-based token.
- **Production:** Global handler, tenant scoping, CORS, migrations, and secrets are in place; monitor and scale as you approach 1000 clients.
- **Super Admin:** Plan advanced features (audit, health, billing, flags, country defaults); improve flow (companies list, company detail tabs, demo queue).
- **UI/UX and real-time:** Keep client app simple and consistent; add real-time only when needed and after core robustness is done.

Use this doc to align work and avoid conflicts; implement in small steps and test after each change.
