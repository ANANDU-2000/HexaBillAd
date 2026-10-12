# ERP Bug Register

Environment for all rows: disposable loopback PostgreSQL 18 (port 55472), synthetic tenants, local API bridge 5078, Vite 5175. Production was not touched. Branch `codex/live-erp-qa-20261012`.

| ID | Module | Sev | Status | Summary | Root cause | Files | Regression test |
|---|---|---|---|---|---|---|---|
| QA-C01 | Customers | P1 | VERIFIED | Duplicate-email "Add anyway" create returned HTTP 400 and showed a failure | Confirmation path built a different payload than normal create (blank optional values) | CustomersPage.jsx (shared buildCustomerPayload) | e2e/customer-save-contract.spec.js "duplicate email confirmation..." |
| QA-C02 | Customers | P2 | VERIFIED | Credit limit like 750.50 was rejected by the browser (step mismatch) and negatives were accepted by the control | Number input had no min/step | CustomersPage.jsx (add and edit forms) | "positive-credit edit..." and "fractional credit create..." (both fail without the fix, confirmed) |
| QA-C03 | Customers | P1 | VERIFIED | Duplicate name, phone, near-duplicate name or bad route on create/update returned HTTP 500 | Service throws InvalidOperationException for business rules; controller mapped every exception to 500 | CustomersController.cs | CustomersHttpIsolationTests (2 new, 500 before, 409 after) |
| QA-C04 | Customers | P2 | VERIFIED | Page offered "Add anyway" for a duplicate phone, then the server refused it | Client warning contradicted server rule (phone unique per tenant) | CustomersPage.jsx | e2e "duplicate phone is blocked..." (UI message, no row, API 409) |
| QA-T01 | QA tooling | P3 | FIXED | scripts/run-customer-save-qa.ps1 failed on Windows PowerShell 5.1 | Static GetBytes, IE-engine web request, stderr under Stop | run-customer-save-qa.ps1 | script run to exit 0 |

## Open / not yet reproduced
- Product create "failed but saved" under a lost response: NOT_REPRODUCED in the product HTTP tests; needs a browser failure-injection test.
- Customer duplicate-name near-match (e.g. "X CUSTOMER") wording shown to the user: not browser-tested.
- Everything in sections 14-25 of the mission (sales, purchases, expenses, payments, daily close, stock, VAT reports, staff roles, concurrency): NOT_TESTED in this checkpoint.
- Live Gulf Harvest read-only inspection: NOT_TESTED (no credentials supplied; none guessed).
