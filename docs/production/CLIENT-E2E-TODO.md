# All-client browser QA status — 2026-11-01

This is a continuation record for the requested client workflows. It is not a release approval. Live production remains read-only; every create/payment/void/print attempt below used disposable synthetic tenants.

## Workspace

- Branch: `feature/worksheet-analytics`
- HEAD at start of this QA pass: `3260f79eaa15edaa24cf24536ed940f7f2a83281`
- QA checkpoints: `1b1c85f9` (hyphenated synthetic tenant login), `4c76d79c` (cross-client isolation), and `2eeb40f3` (payment balance round trip).
- Read-only deployment check: Render HexaBill and Vercel `hexabill-ui` production both still serve commit `1e260f3f624a9e0ecbf42fc9cef45571076c79d8`; the local print correction has not been deployed.
- Local QA database: PostgreSQL 18, `UTF8`, loopback only, `hexabill_codex_browser_allclients_utf8_20261101`; the runner stops this cluster when it exits.
- Synthetic tenants: Gulf Harvest, FrozenHub 1, FrozenHub 2, and Zayoga. The production demo tenant was not included.

## Status

| Work | Status | Evidence / remaining gap |
|---|---|---|
| POS cash checkout, desktop 1024px | DONE (synthetic) | 4/4 Playwright journeys passed; each saved invoice was read back. |
| Payment partial create, edit, refresh, void, desktop 1440px | DONE (synthetic) | 4/4 Playwright journeys passed. Each test chose a customer with an outstanding balance, created a partial payment, verified persistence after refresh, edited it, then voided it and verified the voided audit record remained. Customer balance was reconciled before payment, after payment, after edit, and after void. |
| Phone invoice preview, share/download, new sale actions, 390px | DONE (synthetic, 4 tenants) | 12/12 actions passed across Gulf Harvest, FrozenHub 1, FrozenHub 2, and Zayoga. |
| Synthetic login helper for hyphenated slugs | DONE (local test utility) | Root cause of earlier 400s: `session.js` built an environment key containing `-`, while the runner set `_`. It now normalizes non-alphanumeric slug characters to `_`; the four owner login flows passed. |
| FrozenHub invoice preview/download/print | IN PROGRESS | Both PDFs were generated and text extraction succeeded. Tests failed because the synthetic FrozenHub tenants have no FrozenHub settings: output used `SYNTHETIC FROZENHUB*-TEST`, blank mobile, and omitted the client address/bank details. Existing assertion also expects phone/email to be absent, which conflicts with the latest client correction. The test's `finally` deleted the downloaded PDF after the assertion failure, so PDF visual comparison is NOT TESTED. The extracted sample showed a one-page Arabic/English invoice, discount/VAT totals, and `Pending: 1 | Current balance: AED 782.50 | As of: 31-Oct-2026 19:39 UTC`; these are synthetic test values only. |
| A5 and 80mm/58mm receipt output | NOT STARTED | No representative PDF checks in this pass. |
| Cross-tenant forged invoice/customer access | DONE (synthetic) | One browser-hosted scenario passed 48 negative reads across all 12 ordered tenant pairs: foreign invoice, foreign invoice PDF, tenant token on another host, and forged `X-Tenant-Id` header. Own-tenant sales reads returned 200; foreign invoice reads returned 404; cross-host and forged-header requests returned 403. |
| Reconcile receivables to Sales Ledger, Customer Ledger, payments, returns, opening balances | PARTIAL (synthetic) | Customer balance now reconciles to the partial payment amount through edit and void for all four synthetic clients. Sales Ledger totals, returns, opening balances, and production ledger reconciliation remain untested. |
| Live owner settings save/refetch and client-specific PDF | BLOCKED | Production settings mismatch was found read-only in the existing record. The requested Chrome browser is unavailable in the current computer-use session; the available in-app browser redirects FrozenHub `/settings` to sign-in. Do not save until an owner session and approvals for identity, separate mobiles, shared contact details, bank document and P.O. Box are available. |
| Production demo invoices/payments | NOT RUN (safety gate) | The workspace policy keeps production data read-only and directs money-flow tests to disposable PostgreSQL. The requested demo bills, items, partial payments and voids were exercised in synthetic tenants only. |
| Production credential containment | BLOCKED | The supplied handoff file contains production credentials. No values are recorded here. The connected Render tool can inspect resources and update service environment variables, but there is no connected provider-side revocation/rotation control for all exposed credentials. Rotation is not verified complete. |

## Commands and evidence

- `pwsh.exe -NoProfile -File output\run-allclient-e2e.ps1` on the first `WIN1252` cluster: POS and FrozenHub setup failed because the local database could not represent `₹`. This environment failure is not counted as an application regression.
- The same runner on the fresh UTF-8 cluster: 4/4 POS pass, 4/4 payment pass, 6/6 initial phone actions pass; FrozenHub PDF assertions failed on missing synthetic company settings. A focused phone-only rerun passed all 12 actions across all four tenants.
- Focused `-IsolationOnly` rerun: 1/1 Playwright test passed across all four synthetic tenants and all 12 ordered cross-tenant pairs. Each pair denied foreign invoice and PDF reads (404), foreign-host access and forged tenant headers (403). The rerun returned exit code 0 after the helper was corrected to propagate test failures.
- Focused `-PaymentOnly` rerun: 4/4 Playwright tests passed with customer balance checks after payment, edit, and void.
- FrozenHub test screenshots and Playwright error context are under `output\allclient-e2e\playwright\`.
- No production records, settings, credentials, deployments, or customer balances were changed by the browser tests.

## Next actions

1. Rotate/revoke exposed credentials at their issuing providers and update dependent secrets through the authorized secret manager; verify each old credential is rejected and dependent services recover.
2. Update the synthetic FrozenHub fixture to represent only owner-approved print settings, and align the FrozenHub print E2E assertions with the latest requirements. Keep the other Codex's print implementation changes intact.
3. Re-run FrozenHub A4 print/download and inspect rendered PDF pages visually; then add A5 and supported thermal checks.
4. Run partial-payment and void ledger reconciliation plus forged cross-tenant access denial against the disposable PostgreSQL dataset.
5. Reconcile the read-only live settings, then obtain owner/source-document approvals before any production settings change or release.
6. Decide whether the active demo tenant is in the requested client scope; it was not included in the four-client synthetic matrix above.
