# AI release proposal — production changes pending

Target: Render workspace `My Workspace` (`tea-ctr63al2ng1s73ersr5g`), API `HexaBill` (`srv-d68jpdvpm1nc7393q4d0`), PostgreSQL `dpg-d68jhpk9c44c73ft047g-a`. No other service or database is in scope. This document is a reviewable proposal, not deployment evidence.

## Observed state

Read-only inspection on 18 October: live source `0a2ed68d754cc0cd3f508ef8c862962c50458372`, deploy `dep-dba4c85g1s2s73anvscg`, readiness HTTP 200, maintenance mode disabled, manual deployment configured. Database history has 59 entries and lacks the four tables below. Five tenants are active; that count alone does not reconcile historical tenant inventory claims. Existing uncommitted VAT fixes and unrelated UX work are excluded from the AI checkpoint.

## Proposed sequence after approval and remaining gates

1. Finish the VAT transaction incident checkpoint, verify financial regressions, and identify the exact release SHA. Do not deploy an arbitrary dirty checkout or infer remote HEAD.
2. Take a fresh private production backup; verify restore, row preservation, forward-migration rehearsal, forced rollback and old/new application compatibility. Prior protected backup artifacts exist outside Git/OneDrive; their existence alone is not a fresh restore drill.
3. Review and apply `docs/database/PENDING-MIGRATIONS-2026-10-18.sql` as the application database role in one transaction with `ON_ERROR_STOP`. It adds `RouteRuns`, `DriverLocationCurrents`, `AiUsageDaily`, `TenantDocumentChunks` plus three search columns and four history entries. Expected history count: 63. Verify table ownership, indexes, defaults and preservation of existing rows. Do not run any Down migration or remove historical objects.
4. Merge only approved AI variables into the API service environment (`replace=false`); preserve unrelated values. Begin with `Ai__Enabled=false`, `Ai__AllowCustomerData=false`, `Ai__AllowPaidFallback=false`, empty `Ai__FallbackProvider`, daily call limit 200, token limit 200000, timeout 20, persistent database usage ledger. Leave live driver location disabled. Do not set any frontend `VITE_*` secret.
5. Configure only an approved provider's Kind/BaseUrl/Model/ApiKey/Paid. Verify current provider documentation and pricing; obtain a rotated server-held secret. Never embed a key in this file, a tool argument visible in chat, Git or browser storage. The previous provider reports (Groq accepted, Gemini HTTP 403) are historical and were not retested here. Do not silently choose a new provider, model, paid tier or data-processing policy.
6. Publish only the reviewed commits after approval, verify the remote SHA, deploy that source, and verify the new live deploy/version and readiness. The current deploy tool targets the configured branch rather than an explicit SHA, so check the remote branch immediately before triggering. Environment changes and deployment must be coordinated; do not assume saved values are active.
7. With an authenticated SystemAdmin session, verify provider status never exposes keys. A synthetic connectivity test is permitted only once pricing/paid-call authorization is established. With existing authorized owner/staff sessions, check customer/product create/save/refetch, tenant branding, forged tenant IDs, non-member invoice IDs, role redaction and normal ERP behavior with AI disabled.
8. Enable model traffic only after explicit provider data-use/retention/region approval and a decision about which clients may opt in. Current model enablement and customer-data consent are global server switches, not per-tenant consent. Typed messages can contain personal data. Company records are retrieved by deterministic server tools and are not sent back to the provider. Browser speech services have a separate privacy decision.

## Rollback

Disable AI and provider fallback, then verify normal ERP screens. Keep additive database tables and history if rolling back application code. Use the recorded prior live deployment only after confirming compatibility. Never restore an old full backup over newer production writes, and never undo financial history to roll back this assistant change.

## Remaining decisions / evidence

- Environment-specific approval for the named production database transaction, publishing the reviewed source and deploying the named API service.
- Approved provider/model, rotated key, pricing and data-processing policy. No real provider request was made in this checkpoint.
- Per-client AI consent/feature rollout rule; no new tenant authorization policy was invented here.
- Existing owner and SystemAdmin application access for live acceptance; Render access does not substitute for application authorization.
- VAT incident verification, fresh production restore/rehearsal/compatibility gate and full release verification remain open. The historical fresh-install migration-chain defect is separate and must stay recorded, not counted as a pass.

Render references checked: [environment variables](https://render.com/docs/configure-environment-variables), [deployments](https://render.com/docs/deploys), [health checks](https://render.com/docs/health-checks). Saved variables take effect on an applicable deploy; the documented dashboard supports saving without deployment. No Render environment update was executed here.
