# Enterprise SaaS Production Rules

Single source of truth for HexaBill backend, API, database, and frontend API changes.

1. **No breaking DB schema** — additive only; no drop/rename without a deprecation plan.
2. **Migrations backward compatible** — the previous app version must work after a migration runs.
3. **New features behind a feature flag** — off by default; document the flag and a removal plan.
4. **Every API endpoint must:** validate role, validate tenant isolation (`TenantId`), use try/catch, and log errors without sensitive data.
5. **No unhandled promise rejection** — all async/then have catch or try/catch; backend has global exception handling.
6. **Destructive actions in a transaction** — bulk delete, clear data, irreversible updates: wrap in a DB transaction; rollback on failure.
7. **No global state mutation** — no request-time writes to global/static state; prefer request/tenant-scoped state.
8. **No direct delete without cascade check** — handle FKs and children (cascade or explicit order in a transaction).
9. **Staging before production** — new features/migrations are tested in staging (same stack as production) before production deploy.
10. **Schema change = migration file** — every DB change goes through a versioned migration file; no ad-hoc production schema changes.

Before submitting backend/API/DB or frontend API-related changes, confirm: role + tenant checks, try/catch, logging, transactions for destructive ops, and a migration file for any schema change.
