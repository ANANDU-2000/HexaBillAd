# HexaBill Run 1 Map

Status: Step 0 read-only audit

Audited commit: `6442bcd20757a5b50faea061131043349ad4678e`

Branch: `run1-identity-subdomain`

No feature code, database, deployment setting, or production data was changed during this step.

## 1. Current identity and tenant flow

### Login and JWT creation

- `backend/HexaBill.Api/Modules/Auth/AuthController.cs:Login` accepts credentials and delegates to `IAuthService`.
- `backend/HexaBill.Api/Modules/Auth/AuthService.cs:LoginAsync` finds the user by globally unique email, verifies the password, updates login state, and calls `GenerateJwtToken`.
- `AuthService.GenerateJwtToken` currently emits `owner_id`, `tenant_id`, and `session_version`. A user without `TenantId` receives string value `0` for both tenant-related claims. Token lifetime is 8 hours or 30 days when `RememberMe` is true.
- `backend/HexaBill.Api/Shared/Extensions/SecurityConfiguration.cs:AddSecurityServices` configures JWT bearer authentication. `OnTokenValidated` checks session version only when the claim can be parsed and only rejects a version mismatch for a found user. Missing users, inactive users, and missing session-version claims are not fully rejected.

### Tenant extraction and request scope

- `TenantIdExtensions.GetTenantIdFromToken` accepts `tenant_id`, then falls back to `owner_id`, including suffix matching. `GetTenantIdOrNullForSystemAdmin` and `IsSystemAdmin` use the same legacy claims and tenant ID zero/null conventions.
- `TenantScopedController.CurrentTenantId` is based on `TenantIdExtensions` and therefore inherits the legacy fallback and `X-Tenant-Id` impersonation behavior.
- `TenantContextMiddleware.InvokeAsync` reads `tenant_id` or `owner_id`, allows missing tenant claims for SystemAdmin, loads tenant status, sets `TenantContextService`, and writes PostgreSQL session configuration. It wraps downstream execution and still contains request-path database/schema work.
- `TenantContextService.GetTenantId` falls back from `tenant_id` to `owner_id`.
- `DataValidationMiddleware` checks `owner_id` and `tenant_id` claims and blocks requests when neither is present, with SystemAdmin exceptions.
- `AdminOrOwnerPolicy` determines elevated access using `tenant_id == 0` and `owner_id` fallbacks.
- Many tenant services use `tenantId <= 0` as a broad query bypass or SystemAdmin path. The audit found 116 textual occurrences across the backend, including controllers and services.

### Frontend identity and tenant flow

- `frontend/hexabill-ui/src/hooks/useAuth.jsx` reads `tenant_id` or `owner_id`, writes `selected_tenant_id`, and removes it during logout.
- `frontend/hexabill-ui/src/services/api.js` uses `selected_tenant_id` for cache keys and sends `X-Tenant-Id`.
- `frontend/hexabill-ui/src/utils/superAdmin.js` still falls back to the `owner_id` claim.
- `TenantBrandingContext.jsx` has branding behavior, but there is no host-based tenant resolver equivalent to the requested `tenantHost.js` contract.
- `App.jsx` exposes `/login`, `/signup`, and `/Admin26` based on routes, not on the current hostname.

## 2. Requested-token and host checks not present

The current code does not provide the requested `ITenantHostResolver`, `Hosting:BaseDomain`, `Hosting:PlatformHost`, or `Hosting:EnforcementMode` flow. Login does not resolve the request host before authenticating. There is no verified agreement check between the host tenant and JWT tenant.

`Tenant.Subdomain` exists in the model and has a unique index, but host resolution does not read it. `Tenant.Domain` exists but is not part of an enforced login boundary.

## 3. Exact legacy references found

Search scope: `backend` and `frontend`, excluding generated `bin` and `obj` output where applicable.

| Reference | Approximate count | Main locations |
|---|---:|---|
| `X-Tenant-Id` | 7 | `TenantIdExtensions`, `api.js`, security documentation, CORS headers |
| `selected_tenant_id` | 8 | `useAuth.jsx`, `api.js` |
| `owner_id` | 50 | JWT, authorization, middleware, extensions, frontend helpers, comments |
| `tenantId <= 0` | 116 | routes, branches, reports, products, payments, admin and other services |
| `IsSystemAdmin` | 141 | controllers, extensions, authorization and services |
| `Subdomain` | 77 | tenant model, EF migrations, context, scripts |
| `Domain` | 79 | tenant model, EF migrations, scripts and unrelated domain symbols |
| `.vercel.app` | 6 | `Program.cs`, production settings, environment example and exception middleware |
| `MigrateAsync` | 8 | `Program.cs`, diagnostics and migration utilities |

## 4. Database and schema observations

- `User` currently has nullable `TenantId`, nullable `OwnerId`, and `SessionVersion`. `IsPlatformAdmin` was not found on the model in this audit.
- Existing migrations contain nullable tenant columns on multiple financial and identity-related tables and use both `OwnerId` and `TenantId`.
- `AppDbContext` has a unique filtered index on `Tenant.Subdomain`, but slug validation and reserved-slug enforcement are not implemented as the requested contract.
- `Program.cs` contains multiple startup SQL blocks, including `ALTER TABLE`, `CREATE TABLE`, and `MigrateAsync` paths. This conflicts with the Run 1 rule that production schema changes must ship as migrations plus idempotent SQL scripts and must not run on the request path or production startup.
- `backend/HexaBill.Api/Modules/SuperAdmin/DiagnosticsController.cs:ApplyMigrations` is an authenticated runtime migration endpoint and must be considered separately in the plan.

## 5. CORS and information exposure

- `Program.cs` contains hand-written CORS handling before normal middleware. It reflects origins ending in `.vercel.app`, adds credentials, and explicitly allows `X-Tenant-Id`.
- `Program.cs` also contains additional origin reflection and wildcard behavior around the normal `UseCors` call.
- `SecurityConfiguration.AddSecurityServices` defines multiple CORS policies with `AllowCredentials` and explicit origin lists. The requested single URI-parsing policy is not present.
- Anonymous endpoints include `/api/cors-check`, `/health/ready`, `/api/diagnostics/errors`, `/api/diagnostics/fonts`, and other health or maintenance routes. `/health/ready` currently has a path that can expose exception text.
- `AuthController.Login` and other controllers log or return exception details in several paths. The requested generic `ApiErrors.Internal(traceId)` contract is not consistently applied.

## 6. Isolation-sensitive services

The following requested audit targets were confirmed as needing review:

- `PaymentService.CreatePaymentAsync` has tenant checks for a customer in some sale paths, but the null-sale path and all related payment flows require a complete tenant proof.
- `ValidationService` uses unscoped `Customers.FindAsync` and sale lookups in multiple validation methods.
- `BalanceService` uses an unscoped customer lookup in its balance path.
- `ReturnService` contains both correctly scoped queries and unscoped customer or return lookups. The `GetSaleReturnByIdAsync` and `GetPurchaseReturnByIdAsync` paths require explicit verification.
- `AlertService` must be checked for null or zero tenant records and tenant-user mark/resolve operations.
- `UsersController` authorizes `Admin,Owner,SystemAdmin` broadly on user operations. The requested role hierarchy, self-role restriction, and last-owner protection are not established by the current route attributes alone.

## 7. Appendix A finding status

1. **CONFIRMED**. `AuthService.GenerateJwtToken`, `TenantContextMiddleware`, `TenantScopedController`, and `AdminOrOwnerPolicy` use tenant zero/null and legacy claims as identity signals.
2. **PARTIAL**. `SessionVersion` exists and is checked in `OnTokenValidated`, but missing claims, missing users, inactive users, and all invalidation paths are not fully enforced. Remember-me still permits 30 days.
3. **PARTIAL**. `UsersController` has broad role attributes and requires code-path review for each mutation. The requested hierarchy is not represented by the route policy alone.
4. **CONFIRMED**. `TenantIdExtensions` contains `X-Tenant-Id` handling for SystemAdmin or zero/null tenant paths.
5. **CONFIRMED**. `Program.cs` reflects `.vercel.app` and other origins with credentials in hand-written middleware and additional CORS logic.
6. **CONFIRMED**. Anonymous diagnostics and health paths exist, and exception detail handling is present.
7. **PARTIAL**. PostgreSQL session configuration exists in `TenantContextMiddleware`, but this audit did not execute against a real database. No effective global EF tenant filter was found in the inspected context paths.
8. **CONFIRMED**. Models and migrations contain both `OwnerId` and `TenantId`; the plan must inspect all relevant indexes and duplicate data before changing them.
9. **PARTIAL**. Payment customer validation exists in some paths, but unscoped lookup paths remain and the null-sale case requires a focused test.
10. **CONFIRMED**. Numerous `tenantId <= 0` bypass expressions remain, especially in route, branch, report, product, and payment-related code.
11. **CONFIRMED**. `Tenant.Subdomain` and `Domain` exist, but no enforced host-based tenant resolution is present.
12. **PARTIAL**. The audit found legacy tenant/owner patterns in services; each purchase and expense query must be mapped before modification.
13. **PARTIAL**. Frontend GET caching exists and logout removes `selected_tenant_id`, but the requested complete cache invalidation behavior requires code review beyond this map.
14. **CONFIRMED**. `TenantContextMiddleware` performs tenant status work per request and wraps downstream execution.
15. **PARTIAL**. Public signup exists and the password policy and abuse controls require a dedicated code-path check.

## 8. Deployment configuration observations

- `vercel.json` builds `frontend/hexabill-ui` as a Vite SPA and rewrites all routes to `index.html`.
- `render.yaml` defines the API Docker service but does not currently declare the requested `Hosting__BaseDomain`, `Hosting__PlatformHost`, or `Hosting__EnforcementMode` variables.
- Frontend `.env.example` still documents the old Render URL instead of requiring the final `VITE_API_BASE_URL` custom API domain.
- No Vercel or Render account settings were changed or verified through a connected provider integration during this step.

## 9. Next gate

Step 0 is complete. The next action is to create `docs/audit/run1-plan.md` with exact file changes, migrations, SQL scripts, tests, rollback, and verification commands. Do not implement feature code until that plan is approved.
