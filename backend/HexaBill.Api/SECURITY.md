# HexaBill API – Security & Data Isolation

## Data isolation (multi-tenant)

- **Tenant ID source:** Tenant scope is taken **only** from the validated JWT (`tenant_id` / `owner_id` claims). It is **never** taken from request body, query, or route for tenant-scoped data access.
- **Controllers:** Tenant-scoped controllers inherit `TenantScopedController` and use `CurrentTenantId` (from JWT or, for SystemAdmin, `X-Tenant-Id` impersonation header).
- **SystemAdmin:** Only users with `TenantId = 0` (SystemAdmin) may:
  - Impersonate a tenant via `X-Tenant-Id`.
  - Call Super Admin endpoints that accept `tenantId` in body/query (e.g. backup another tenant, delete tenant).
- **Backup / Restore:** Non–SystemAdmin users can only create backup or restore for their own tenant. SystemAdmin can target any tenant.

## Same email / same company / staff

- **Email uniqueness:** `Users.Email` is **globally unique** (unique index). One email can belong to only one user and thus one tenant. There is no cross-tenant reuse of the same login email.
- **Login:** Login uses email + password. The user’s `TenantId` is fixed in the DB; the JWT carries that tenant. No “company selector” is needed because one email maps to one tenant.
- **Staff vs owner:** Staff and owner are distinguished by `User.Role`. All are scoped by `User.TenantId`; staff can be further restricted by branch/route assignments. Data access always filters by `CurrentTenantId` (and, where applicable, branch/route).

## Leakage prevention

- **No client-supplied tenant for data access:** Do not use `request.TenantId` or `request.Body.TenantId` to decide which tenant’s data to read/write unless the action is explicitly SystemAdmin-only and the code path checks `IsSystemAdmin`.
- **SQL:** Prefer parameterized queries and EF Core (no raw concatenation of user/tenant input). Use `ExecuteSqlInterpolated` or parameters; avoid `ExecuteSqlRaw` with string concatenation.
- **Audit:** Super Admin impersonation and destructive actions (e.g. delete tenant) are audited.

## Firewalls and deployment

- Use HTTPS in production (e.g. Render/Vercel).
- Restrict admin endpoints (e.g. `/api/superadmin/*`) by role (`SystemAdmin`) and, if needed, by IP or VPN in front of the app.
- Keep secrets (JWT, DB URLs, API keys) in environment variables or a secret store; do not commit them.
- Rate limiting and login lockout (e.g. `FailedLoginAttempts`) reduce brute-force and abuse risk.

## Trust and impact

- **Data isolation:** Enforced by always deriving tenant from JWT (or impersonation for SystemAdmin) and filtering all tenant-scoped queries by that tenant.
- **Same email:** Single global email uniqueness prevents “same email, different company” confusion and cross-tenant login mix-up.
- **Staff and company:** One user → one tenant; role and optional branch/route further restrict what data they can see or change.
