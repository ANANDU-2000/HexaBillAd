# JWT refresh — design spike (no implementation shipped from this doc)

## Goals

- Short-lived access tokens with **refresh** flow for tenant and super-admin sessions.
- **Revocation** story (logout all devices, password change, tenant suspend).
- **Rotation**: refresh token use-once where feasible; detect reuse as compromise signal.

## Non-goals (for first slice)

- Changing password hashing or MFA.
- Full OAuth2/OIDC provider; this is first-party web + optional mobile.

## Proposed components

1. **Access token (JWT)**  
   - Lifetime: 15–60 minutes (config).  
   - Claims: user id, tenant id, role, standard `jti` if useful for denylist later.

2. **Refresh token**  
   - Opaque random, stored server-side (hashed) with **user id**, **tenant id**, **expires**, **replaced by** (rotation chain), **user agent / IP** (optional audit).  
   - HttpOnly Secure cookie for browser, or body field for API clients (document threat model).

3. **Endpoints (sketch)**  
   - `POST /auth/refresh` — accepts refresh cookie/body; returns new access + refresh (rotate).  
   - `POST /auth/logout` — revoke current refresh (and optionally all for user).

4. **Frontend**  
   - Axios (or fetch) interceptor: on `401`, single-flight refresh queue; retry original request once; hard logout on refresh failure.

## Rollout

- Feature flag **off** in production until staging sign-off.  
- Migrate existing sessions: first deploy issues only new refresh tokens on login; old JWT-only sessions age out naturally.

## Open questions

- Super-admin impersonation: whether refresh is **tenant-scoped** or uses a dedicated impersonation session row.  
- SameSite / cross-subdomain cookie policy for marketing site vs API.
