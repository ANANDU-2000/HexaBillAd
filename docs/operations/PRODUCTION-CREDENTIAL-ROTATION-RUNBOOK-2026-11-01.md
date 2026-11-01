# HexaBill production credential rotation runbook

Date: 2026-11-01  
Scope: Render HexaBill service, its Render Postgres database, Vercel `hexabill-ui`, Groq, and Cloudflare R2.  
Policy: No credential values belong in this document, tickets, source, logs, screenshots, or chat.

## Current verified state

- Render workspace: `My Workspace` (`tea-ctr63al2ng1s73ersr5g`). Service: `srv-d68jpdvpm1nc7393q4d0`; Postgres: `dpg-d68jhpk9c44c73ft047g-a`.
- Render service and Postgres ingress allowlists both remain `0.0.0.0/0`. The owner explicitly directed that allowlists remain unchanged. This runbook contains no allowlist change.
- The exposed JWT signing secret was replaced in Render `JwtSettings__SecretKey`. Deployment `dep-dbjn52vb9u1s73eharr0` activated it at `6171d688d01b9f05dee86eacd1075980b78eae40`; existing signed-in sessions may need to authenticate again.
- A replacement edge secret is staged in Vercel Production `HEXABILL_EDGE_PROXY_SECRET` and Render `Hosting__EdgeProxyRotationSecret`. Deployment `dep-dbjn6bdg1s2s7385fedg` is LIVE at `9e7a3f3b4cf16822cf6014e58bce58ef0b8fb06a`, which adds temporary dual-secret acceptance. Vercel Production is also READY at that commit.
- Read-only production smoke: tenant proxy `GET /api/public/tenant-context` returned HTTP 200 with `success=true`; direct Render access to that API returned 403. `/health` and `/health/ready` returned HTTP 200.
- Remaining exposed credentials have **not** been rotated: Groq API key, Cloudflare R2 access/secret keys, Render account API token, and the old Postgres user credential. Their exact values are intentionally omitted.
- Exact-value scanning found the disclosed values in reachable Git history. Current source copies were removed, but history was not rewritten. Do not push any historical secret value again; revoke the associated credentials.
- **Public credential-history exposure is confirmed:** GitHub reports `ANANDU-2000/HexaBillAd` as public, and reachable history contains the exposed credential values. Correction: the local client-provided “before” screenshot is untracked, absent from deployed `HEAD` (`git cat-file -e HEAD:<path>` says it is not in the commit), and its raw GitHub URL returns 404. The committed print evidence README describes the shipped images as synthetic. Do not characterize that screenshot as published. Preserve incident evidence; do not rewrite history without separate approval. Repository visibility has not been changed.
- **Additional handling note:** A required attachment re-read produced a tool result where the redaction pattern missed standalone database/API-token lines. Treat all secret-bearing values in the attachment as compromised; do not reproduce them. This adds no new rotation categories, but prioritizes the already documented Postgres and Render-token actions. No provider changes were made in response.
- **Containment approval and execution status:** Owner approved changing the repository to private. GitHub metadata confirms the owner has admin permission, but the GitHub connector exposes no repository-visibility mutation. Chrome successfully opened the authenticated repository General settings page, which stated that visibility was public. Computer Use later returned a screenshot of a different app than its selected Chrome window and reported concurrent user input, so no setting was submitted. Visibility remains public. In the authenticated GitHub settings page, use **Danger Zone → Change visibility → Private**, complete GitHub’s confirmation, then verify `visibility=private` through GitHub metadata and verify anonymous raw-content access is denied. This action can affect collaborator and automation access. Privatization does not purge reachable history or revoke credentials.
- Seven untracked local migration scripts that contained literal PostgreSQL URLs or a database-password fallback now fail closed on `DATABASE_URL`; all seven `node --check` commands passed. With `DATABASE_URL` removed, a script returned the expected environment-guard error before importing `pg` or connecting. No live DB connection was attempted. The hardcoded development edge placeholder and browser-localStorage edge-secret path were also removed; the Vite proxy reads its key only from the server environment, and E2E setup requires an explicit environment value. Frontend tests passed 342/342, the focused helper test 3/3, and the production build succeeded. Remaining credential values in Git history and the runbook-only provider rotations are still open.
- The owner selected **runbook only** for the remaining provider credential actions. No further provider-dashboard mutations are authorized by that selection.

## Required order

### 1. Prepare provider replacements

1. Confirm the currently active HexaBill service, database, Vercel project, Groq organization, and Cloudflare account. Do not paste or export existing secret values.
2. Inventory external automation that uses the Render account API token (CI, local deployment automation, scheduled jobs, integrations). Create a replacement token with the minimum permissions needed, update those consumers, verify access, then revoke the exposed token.
3. In Render Postgres Credentials, create a new Render-managed default credential. Render makes the newly created managed user the default; the prior user remains valid during the transition. Obtain the new **internal** connection URL from the database dashboard. The app's `DATABASE_URL` in `render.yaml` is `sync: false`, so do not assume a Blueprint sync will update this manual variable.
4. In Groq, create a replacement production key. Never reuse the disclosed key. Keep the test request synthetic and free of customer, staff, or financial data.
5. In Cloudflare R2, create a replacement S3-compatible token with only the required object permissions and the configured bucket scope. Record the access key ID and secret directly in the secret manager; Cloudflare says the secret access key is shown only at creation. Preserve the existing endpoint and bucket values unless the provider configuration itself has changed.
6. Keep the current database, Groq, and R2 credentials valid until the app is deployed with replacements and the smoke checks below pass. Then revoke the exposed credentials at their issuing services.

Official provider guidance: [Render Postgres credential rotation](https://render.com/docs/postgresql-credentials), [Groq security onboarding](https://console.groq.com/docs/production-readiness/security-onboarding), and [Cloudflare R2 API tokens](https://developers.cloudflare.com/r2/api/tokens/).

### 2. Update server-side references

Update only the HexaBill service in the confirmed workspace. Preserve all unrelated variables. Use the protected provider UI or secret-management API; do not print values in command output.

| Setting | Replacement reference |
|---|---|
| Database | `DATABASE_URL` (new internal connection URL for the newly created managed Postgres user) |
| Groq | `Ai__Providers__groq__ApiKey` |
| R2 | `R2_ACCESS_KEY` and `R2_SECRET_KEY` together; keep `R2_ENDPOINT` and bucket references unchanged |
| JWT | Already rotated: `JwtSettings__SecretKey` |
| Edge proxy | Already staged: Vercel Production `HEXABILL_EDGE_PROXY_SECRET`; Render currently accepts it via `Hosting__EdgeProxyRotationSecret` |

An environment update through the connected Render MCP triggered a deployment during this incident. Treat every Render environment update as a possible production deployment; inspect its returned deploy ID and status immediately. Do not trigger a second deployment if the environment update already started one.

### 3. Deploy and verify the coordinated edge switch

The dual-secret backend code is committed locally and was included in the production deployment at `9e7a3f3`. The production proxy smoke passed with the new Vercel secret and Render accepting both edge secrets.

To retire the old edge secret, update Render `Hosting__EdgeProxySecret` to the already staged new value and clear `Hosting__EdgeProxyRotationSecret`. This is a production deployment and requires explicit release approval. After it becomes LIVE:

1. Confirm `/health` and `/health/ready` return 200.
2. Recheck `GET https://frozenhub.hexabill.company/api/public/tenant-context` returns 200 and `success=true` without logging its response body.
3. Recheck direct `https://hexabill.onrender.com/api/public/tenant-context` is rejected with 403.
4. Verify the FrozenHub owner can sign in and tenant routing works. Do not reuse pre-rotation bearer tokens; the JWT rotation intentionally invalidated them.
5. Verify Vercel production is on the intended commit and still uses the new edge reference. Do not rotate or change ingress allowlists in this step.

### 4. Verify remaining provider replacements before revocation

- **Postgres:** Confirm the service and all backup/maintenance consumers use the new connection URL. Use read-only `pg_stat_activity` inspection to confirm no active connections use the previous user. Revoke the previous managed credential only after the new connection and required backup path work.
- **R2:** With synthetic/test data, perform an upload, read-back, and delete through the app's existing authorized flow. Confirm tenant logos/documents can still be read. Revoke the old R2 token only after verification.
- **Groq:** Use a synthetic, non-sensitive health/model request and verify provider status/error behavior. Do not send production customer or financial content. Revoke the old Groq key only after the new key succeeds.
- **Render token:** Test every inventoried automation with the replacement token, then revoke the exposed token and confirm no automation still depends on it.
- **Authentication:** Verify owner and staff sign-in after the JWT rotation; confirm role/tenant boundaries with synthetic accounts. Do not record or export bearer tokens.

### 5. Incident closure evidence

Record only credential names, issuer, rotation timestamp, deployment IDs/commit, health results, synthetic smoke outcomes, and revocation confirmation. Never record credential values or provider screenshots containing them. Keep this incident open until all of the following are evidenced:

- old JWT and edge secrets are no longer accepted;
- exposed Render token, Postgres credential, Groq key, and R2 keys are revoked;
- replacement consumers work, including backup/storage paths;
- tenant proxy smoke passes and direct upstream API remains blocked;
- production allowlists are unchanged by instruction;
- P0 tracker statuses and the next master-goal gate are updated.

Repository privacy containment is already approved and remains pending execution. Complete the private visibility change and verify it before continuing to the next master-goal gate. This may affect collaborator and automation access. After the repository is private, coordinate any history purge separately with GitHub support/repository administrators; deleting a current file alone does not remove historical objects or cached copies. Do not assume public copies can be recalled.

Do not rewrite Git history as part of this runbook. Keep the remote/history handling as a separate owner decision; no history rewrite or destructive cleanup was performed.
