# Live client verification — 2026-10-11

## Goal and current scope

User requested all pending live migrations, backend/frontend redeployment, and actual login plus page-by-page feature/form/realtime checks for four clients on desktop, tablet and mobile. The goal remains **IN_PROGRESS**: production recovery/deployment and public checks are complete; authenticated workflows and all-feature enablement are not complete.

Application source deployed on both platforms: `704f802a8204676205a71be61a22e321e15464d0`. Recovery evidence: [MIGRATION-RECOVERY-2026-10-11.md](MIGRATION-RECOVERY-2026-10-11.md).

## Authoritative client reconciliation

| Tenant ID | Real client subdomain | Production status | Existing active owner accounts | Successful owner login |
|---|---|---|---|---|
| 6 | zayoga.hexabill.company | Active | 1 | NOT TESTED |
| 20 | frozenhub.hexabill.company | Active | 1 | NOT TESTED |
| 22 | gulfharvest.hexabill.company | Active | 1 | NOT TESTED |
| 23 | frozenhub2.hexabill.company | Active | 1 | NOT TESTED |

Production also contains `tenant-3`, `tenant-8`, and `isolationcheck`; these were not merged, renamed, deleted or assumed to be the requested clients. `frozenhub1` is a local-test slug, not the production slug verified for tenant 20. FrozenHub and FrozenHub2 sharing displayed legal identity does not merge their IDs or records.

## Completed live public checks

Each of the four actual domains was checked through the real Vercel-to-Render proxy:

| Check | zayoga | frozenhub | gulfharvest | frozenhub2 |
|---|---|---|---|---|
| GET /login | PASS HTTP 200 | PASS HTTP 200 | PASS HTTP 200 | PASS HTTP 200 |
| GET /api/maintenance-check | PASS 200 / false | PASS 200 / false | PASS 200 / false | PASS 200 / false |
| GET /api/auth/validate without token | PASS HTTP 401 | PASS HTTP 401 | PASS HTTP 401 | PASS HTTP 401 |
| Empty sign-in validation | PASS both required errors | PASS both required errors | PASS both required errors | PASS both required errors |
| 360 × 800 public login layout | PASS | PASS | PASS | PASS |
| 390 × 844 public login layout | PASS | PASS | PASS | PASS |
| 768 × 1024 public login layout | PASS | PASS | PASS | PASS |
| 1024 × 768 public login layout | PASS | PASS | PASS | PASS |
| 1440 × 900 public login layout | PASS | PASS | PASS | PASS |

Responsive checks used the connected browser viewport capability, read the actual `window.innerWidth`, required it to equal the requested width, and measured zero document horizontal overflow with one email field, one password field and one Sign in button. The initial multi-tab sizing attempt applied only to the selected tab, so its mismatched-width observations were discarded; the 20 accepted checks navigated one dedicated audit tab. Overrides were reset afterwards. Empty form submissions showed “Email is required” and “Password is required” without attempting any customer password. This is **public login UI coverage only**, not authenticated application coverage.

All four browser titles resolved to their configured company names. No live password guesses or resets were performed. Existing local test owner credentials were verified only offline against the approved private restored copy; they matched none of the four active production owners. Their password/hash values were not printed or saved to new artifacts.

## Essential authentication blocker

The four connected browser tabs are retained for user sign-in. Existing production owner credentials are required via a protected local file path or manual sign-in in these tabs. Enabling tenant features must use the existing authenticated SuperAdmin endpoint with its audit trail, so an existing SuperAdmin sign-in is also required. Do not forge tokens, reset passwords, mutate permission flags through SQL, or bypass tenant checks.

The user was asked for a protected credential-file path (no passwords in chat) or manual browser sign-ins. No answer has arrived at this checkpoint. Authenticated checks are **NOT TESTED**, not failures and not passes.

## Page-by-page authenticated acceptance matrix

Every row below requires all five viewport sizes above for each actual client, plus relevant read/create/edit/save/refetch/print/validation behavior. Financial write tests remain on disposable PostgreSQL with synthetic data; do not use customer invoices/payments as disposable test records. Production draft/forms, authorized reads and print identity checks must retain authenticated tenant/user/role scope. Local backend evidence (781 passed, zero skips) does not substitute for these live UI checks.

| Actual tenant route | zayoga | frozenhub | gulfharvest | frozenhub2 |
|---|---|---|---|---|
| /dashboard | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /pos | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /billing-history | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /sales-ledger | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /ledger | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /payments | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /purchases | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /expenses | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /customers | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /products | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /suppliers | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /branches | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /routes | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /pricelist | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /stock-adjustments | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /quotations | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /quotations/new | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /delivery-notes | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /returns/create | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /agreements | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /agreements/new | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /salary-certificates | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /salary-certificates/new | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /reports | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /reports/outstanding | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /daily-close | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /vat-return | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /worksheet | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /users | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /settings | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /audit | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /backup | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /profile | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /help | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /feedback | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /more | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /onboarding | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |

Dynamic routes need a real authorized entity ID/name discovered from that client's authenticated API/list. Never copy an entity ID between tenants to make a test pass.

| Detail route | zayoga | frozenhub | gulfharvest | frozenhub2 |
|---|---|---|---|---|
| /products/:id | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /suppliers/:name | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /customers/:id | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /branches/:id | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /routes/:id | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /quotations/:id | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /agreements/:id | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /salary-certificates/:id | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| /delivery-notes/:saleId | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |

Cross-tenant denial must deliberately test a forged tenant identifier and a non-member invoice identifier with established 403/404 behavior once credentials are available. Check owner and staff access separately; broad client feature approval does not grant staff owner permissions.

## Feature availability findings and remaining work

- Production `FeaturesJson` is `[]` for all four clients. No feature flags were changed in this checkpoint. Optional financial flags (receipt snapshots, settlement adjustments, daily close, cost snapshots and VAT effective dating) remain off under the current deterministic `TenantFeatureFlags.IsEnabled` contract.
- Core ERP navigation is not uniformly gated by this array; an empty array alone does not prove that every page is unavailable. Verify each actual page and API with owner credentials rather than inferring availability from the SuperAdmin display.
- Use the existing `PUT /api/superadmin/tenant/{id}/features` audited authorization path to apply approved feature settings after authenticated verification. Preserve staff roles, VAT calculation basis, legal identity, tenant isolation, provider/privacy decisions and any setup requirements for paired local backup.
- `/recurring-invoices` currently redirects to `/dashboard` in the deployed source. It is **not a functioning recurring-invoice page**; it cannot be counted as an all-feature PASS. Its intended product scope and financial behavior must be established and verified before changing that route.
- Platform SuperAdmin pages are an additional privileged surface: dashboard, tenants/detail, demo requests, health, error logs, audit logs, settings, search and SQL console. Client owners must not receive these routes or permissions. SuperAdmin feature configuration and diagnostic checks remain NOT TESTED.
- Remaining acceptance includes save/refetch totals and freshness, print tenant branding/Arabic, dashboard updates after writes, feature-specific fallback/error states, and all permission/isolation boundaries. No paid AI/provider calls, voice/GPS permissions, bulk customer sends, or arbitrary live ledger operations were performed.

## Resume checkpoint

- Branch `main`; checkpoint parent `37fa46d`; deployed runtime source `704f802`. Current task: live four-client authenticated verification and approved feature availability.
- Next unrun acceptance: actual owner login on `https://zayoga.hexabill.company/login`, then dashboard at 360/390/768/1024/1440 before proceeding one route/client at a time.
- Essential blocker: existing production owner/SuperAdmin authentication. Do not retry an unverified password or weaken security to obtain coverage.
- Connected browser 2, retained sign-in tabs: 1 zayoga, 2 frozenhub, 3 gulfharvest, 4 frozenhub2. Check authoritative tab state after user sign-in before resuming; tab IDs alone do not prove authentication.
- Private backup and restore artifacts remain in the authorized recovery directory. Owned local PostgreSQL is stopped at handoff. No source code, tenant permissions, accountant rules or customer assets were changed in this verification checkpoint. Preserve unrelated untracked `docs/uiux/PENDING-TODO.md`.
