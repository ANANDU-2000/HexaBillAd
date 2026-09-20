# HexaBill Run 1 Plan

Status: approved for execution in ordered work items

Base commit: `6442bcd20757a5b50faea061131043349ad4678e`

Branch: `run1-identity-subdomain`

## Work item 1: subdomain and host context

Files expected:

- `backend/HexaBill.Api/Models/HostingOptions.cs`
- `backend/HexaBill.Api/Shared/Hosting/ITenantHostResolver.cs`
- `backend/HexaBill.Api/Shared/Hosting/TenantHostResolver.cs`
- `backend/HexaBill.Api/Shared/Middleware/TenantHostMiddleware.cs`
- `backend/HexaBill.Api/Models/Tenant.cs` for normalized slug constraints
- `backend/HexaBill.Api/Program.cs` service registration and middleware placement
- `backend/HexaBill.Api/appsettings.json` and environment examples
- `frontend/hexabill-ui/src/utils/tenantHost.js`
- focused host and slug tests

Behavior:

- Parse the request host from `Origin` when present and use `X-Tenant-Slug` only as the frontend hint.
- Reject disagreement between the host slug and the header.
- Resolve platform, tenant, marketing, and unknown hosts without revealing valid slugs.
- Support `slug.localhost:5173` in development.
- Cache slug resolution and tenant status for 60 seconds.
- Default enforcement mode is `LogOnly`.

Verification:

- Unit tests for reserved, malformed, uppercase, Unicode, short, long, and duplicate slugs.
- Host tests for platform, tenant, marketing, localhost, unknown, and disagreement cases.

## Work item 2: identity model and database contract

Files expected:

- `backend/HexaBill.Api/Models/User.cs`
- `backend/HexaBill.Api/Data/AppDbContext.cs`
- new EF migration under `backend/HexaBill.Api/Migrations`
- `backend/HexaBill.Api/Scripts/run1_01_identity.sql`

Changes:

- Add non-null `IsPlatformAdmin` and `IsActive` with safe defaults.
- Add the platform-user versus tenant-user check constraint.
- Backfill platform-admin state only for expected existing tenant-null users.
- Make the SQL script pre-check and abort on unexpected counts.

Rollback:

- Drop the new constraint and columns only after restoring a database backup and validating the prior application version.

## Work item 3: login, JWT, session, and host enforcement

Files expected:

- `AuthService`, `AuthController`, `SecurityConfiguration`
- `TenantContextMiddleware`, `TenantContextService`, `TenantIdExtensions`
- authorization policies and obsolete `JwtMiddleware`
- session-version mutation paths
- focused authentication integration tests

Changes:

- Host-first login gate.
- Claims: `sub`, `role`, `tid`, `tslug`, `sv`, `plat`.
- Twelve-hour lifetime with no 30-day remember-me token.
- Reject missing user, inactive user, missing session version, or stale session version.
- Enforce host and JWT tenant agreement according to Off, LogOnly, and Enforce.

## Work item 4: tenant creation and support sessions

Files expected:

- `SuperAdminTenantService` and its controller
- new SupportSession model, DbSet, migration, and SQL script
- support-session authorization middleware/controller
- audit service integration
- frontend support-session banner and countdown

Changes:

- Atomic tenant, owner, settings, and login URL creation.
- Replace all `X-Tenant-Id` impersonation with expiring support sessions.
- Read-only support sessions reject mutation methods.

## Work item 5: isolation and uniqueness fixes

Files expected:

- payment, validation, balance, return, alert, user, sale, purchase, route, branch, and report services
- migration and `run1_02_tenant_isolation.sql`
- two-tenant regression tests

Changes:

- Remove tenant-zero query bypasses from tenant-scoped code.
- Scope every ID lookup by tenant.
- Verify foreign customer ownership before payment creation.
- Add tenant-scoped uniqueness after duplicate pre-checks.
- Protect alerts with null or zero tenant IDs.

## Work item 6: CORS, error handling, and anonymous endpoint cleanup

Files expected:

- `Program.cs`
- `SecurityConfiguration.cs`
- `GlobalExceptionHandlerMiddleware.cs`
- diagnostics and health endpoints
- Auth, Users, Payments, Sales, and Customers controllers

Changes:

- One strict origin policy based on configured base domain.
- Remove reflected `.vercel.app` origins, credentials mode, and `X-Tenant-Id` CORS support.
- Generic internal errors with trace IDs.
- Restrict or remove anonymous diagnostics.

## Work item 7: frontend host-aware login

Files expected:

- `tenantHost.js`
- `api.js`, `apiConfig.js`, `useAuth.jsx`, `superAdmin.js`
- login, branding, routing, and logout components
- frontend tests/build configuration as needed

Changes:

- Remove `selected_tenant_id` and `X-Tenant-Id`.
- Send `X-Tenant-Slug` from the parsed host.
- Tenant branding before login.
- SuperAdmin login only on the platform host.
- Clear all caches on logout.

## Work item 8: verification and report

Commands:

- `dotnet test backend/HexaBill.Tests/HexaBill.Tests.csproj`
- `npm run build` from `frontend/hexabill-ui`
- targeted searches proving removal of forbidden legacy references
- no production database or deployment mutation

Deliverables:

- `docs/audit/run1-report.md`
- `docs/audit/run1-findings-later.md`
- numbered SQL scripts and migration order
- exact test/build output
- unresolved deployment or credential blockers

## Deployment boundary

Code changes will prepare, but will not execute, deployment configuration.

- Vercel requires the wildcard domain and nameserver setup for `*.hexabill.company`.
- Render requires `api.hexabill.company` and the DNS target shown by Render.
- Vercel and Render environment variables will be documented and verified only after provider access is connected.
- Production rollout order is LogOnly, observe audit mismatches, then Enforce.

## Rollback

- Each work item is committed separately.
- Revert only the current work-item commit after review.
- Never use destructive Git commands or modify production data.
- Database rollback requires a backup and a reviewed reverse SQL script.
