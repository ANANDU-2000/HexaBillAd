# Enterprise SaaS Production Rules

**This file is the single source of truth.** The Cursor rule in `.cursor/rules/enterprise-saas-production.mdc` is set to **always apply** and references this file. All code changes, migrations, and features must comply with these rules. No exceptions.

---

## 1. No breaking DB schema

- Do not rename, drop, or change types of columns in a way that breaks existing queries or running instances.
- Do not remove tables or columns that are in use without a deprecation path and migration plan.
- Prefer additive changes (new columns with defaults, new tables) over in-place breaking changes.

---

## 2. All migrations backward compatible

- Every migration must be **backward compatible**: old app versions must continue to work against the DB after the migration runs.
- Use **add column with default**, **new table**, or **nullable new column**—not “drop column” or “rename column” without a multi-step plan.
- Never deploy a migration that requires a specific new app version to be live first (no “migrate then deploy” coupling in a single step).

---

## 3. All new features behind feature flag

- New user-facing or high-impact features must be **off by default** and toggled via feature flag (DB setting, env var, or config).
- Feature flags must be documented (name, purpose, default, removal plan).
- No shipping a major new feature as always-on without a flag and staging validation.

---

## 4. All API endpoints must

- **Validate role:** Check that the user has the required role (e.g. Owner, Admin, Staff, SystemAdmin) before performing the action. Return 403 if not allowed.
- **Validate tenant isolation:** For tenant-scoped data, ensure every query and mutation is filtered by `TenantId` (or equivalent) derived from the authenticated user. Never return or modify another tenant’s data.
- **Use try/catch:** Wrap handler logic in try/catch; do not let exceptions bubble unhandled to the framework. Return a structured error response (e.g. 500 with a safe message, no stack trace to client).
- **Log errors:** Log exceptions and important failures (with correlation ID / request ID) for debugging. Do not log sensitive data (passwords, tokens, PII in full).

---

## 5. No unhandled promise rejection

- Every `async` function and `.then()` chain must have `.catch()` or be wrapped in try/catch (or equivalent) so that no unhandled promise rejection can occur in production.
- Frontend: use try/catch in async handlers and optional global `unhandledrejection` handler for defense in depth.
- Backend: async controller actions must use try/catch or a global exception middleware that catches and logs.

---

## 6. All destructive actions wrapped in transaction

- Any operation that **deletes** or **irreversibly updates** data (e.g. clear tenant data, bulk delete, financial correction) must run inside a **database transaction**.
- On failure, roll back the transaction. Commit only after all steps succeed.
- Document which endpoints are destructive and that they are transactional.

---

## 7. No global state mutation

- Avoid mutating global or static state that affects request handling (e.g. global caches that are written per request without thread-safety).
- Prefer request-scoped or tenant-scoped services and caches. If global state is used (e.g. feature flags), it must be read-only in request path or properly synchronized.

---

## 8. No direct delete without cascade check

- Before **deleting** an entity, ensure **dependencies** (foreign keys, child records) are either:
  - Handled by DB cascade rules (document and verify), or
  - Explicitly deleted or reassigned in code in a defined order within a transaction.
- Do not perform a raw `DELETE` that can leave orphans or violate FK constraints. Check cascade behavior and dependent tables first.

---

## 9. All new features tested in staging before production

- New features and migrations must be **deployed and tested in a staging environment** (same stack as production: PostgreSQL, env, feature flags) before production deploy.
- No “deploy straight to production” for new DB migrations or major features. Document staging sign-off or checklist where applicable.

---

## 10. No change allowed without migration file

- Any change to the **database schema** (tables, columns, indexes, constraints) must be done via a **versioned migration file** (e.g. EF Core migration, or SQL migration in a migrations folder).
- Do not apply schema changes manually in production without a corresponding migration file in the repo. Migrations are the single source of truth and must be run in order in all environments.

---

## Summary checklist (for code review / PR)

| Rule | Checklist item |
|------|----------------|
| 1 | No breaking schema change |
| 2 | Migration is backward compatible |
| 3 | New feature behind feature flag (if applicable) |
| 4 | API: role + tenant isolation + try/catch + error logging |
| 5 | No unhandled promise rejection (frontend + backend) |
| 6 | Destructive actions in a transaction |
| 7 | No global state mutation in request path |
| 8 | No delete without cascade/dependency check |
| 9 | Feature/migration tested in staging before prod |
| 10 | Schema change has a migration file |

---

*Last updated: Feb 2026. All contributors and AI assistants must follow these rules for HexaBill production.*
