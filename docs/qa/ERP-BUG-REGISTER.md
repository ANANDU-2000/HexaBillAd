# ERP Bug Register

Environment for all rows: disposable loopback PostgreSQL 18 (port 55472), synthetic tenants, local API bridge 5078, Vite 5175. Production was not touched. Branch `codex/live-erp-qa-20261012`.

| ID | Module | Sev | Status | Summary | Root cause | Files | Regression test |
|---|---|---|---|---|---|---|---|
| QA-C01 | Customers | P1 | VERIFIED | Duplicate-email "Add anyway" create returned HTTP 400 and showed a failure | Confirmation path built a different payload than normal create (blank optional values) | CustomersPage.jsx (shared buildCustomerPayload) | e2e/customer-save-contract.spec.js "duplicate email confirmation..." |
| QA-C02 | Customers | P2 | VERIFIED | Credit limit like 750.50 was rejected by the browser (step mismatch) and negatives were accepted by the control | Number input had no min/step | CustomersPage.jsx (add and edit forms) | "positive-credit edit..." and "fractional credit create..." (both fail without the fix, confirmed) |
| QA-C03 | Customers | P1 | VERIFIED | Duplicate name, phone, near-duplicate name or bad route on create/update returned HTTP 500 | Service throws InvalidOperationException for business rules; controller mapped every exception to 500 | CustomersController.cs | CustomersHttpIsolationTests (2 new, 500 before, 409 after) |
| QA-C04 | Customers | P2 | VERIFIED | Page offered "Add anyway" for a duplicate phone, then the server refused it | Client warning contradicted server rule (phone unique per tenant) | CustomersPage.jsx | e2e "duplicate phone is blocked..." (UI message, no row, API 409) |
| QA-D01 | Settings / owner clear data | P0 | VERIFIED | Owner "Clear transactional data" failed and rolled back for any tenant with a damaged sale return | Deleting sales cascades to returns, but DamageInventories.SourceReturnId (no cascade) was never cleared: PostgreSQL 23503 | SuperAdminTenantService.cs | tenancy/ClearTenantDataPostgreSqlTests (fails before, passes after) |
| QA-P01 | Products | P1 | VERIFIED | Create product with SKU "BEEF 250gm" showed "SKU can only use letters, numbers, dots, dashes, and underscores"; clients did not understand why it failed | Server rule rejects spaces; form gave no hint and no help | ProductForm.jsx, utils/sku.js | tests/sku.test.js, e2e/product-sku-autofix.spec.js (m360, t768, d1440) |
| QA-C05 | Customers (ledger page) | P1 | FIXED (live cause NOT confirmed) | Add customer on Customer Ledger showed only "Failed to create customer" | Same values save with HTTP 201 on the synthetic tenant, so the live failure is data or server dependent. The page discarded the server reason (object-shaped validation errors, empty gateway bodies), offered Add anyway for a phone the server forbids, and never checked whether a failed answer had actually saved | CustomerLedgerPage.jsx, utils/apiError.js | tests/apiError.test.js, e2e/ledger-add-customer.spec.js (lost answer reconciled once, duplicate phone blocked) |
| QA-T01 | QA tooling | P3 | FIXED | scripts/run-customer-save-qa.ps1 failed on Windows PowerShell 5.1 | Static GetBytes, IE-engine web request, stderr under Stop | run-customer-save-qa.ps1 | script run to exit 0 |

## Open / not yet reproduced
- Clear data still leaves supplier payments, supplier credits, daily cash closes, cash drawer movements, quotations, held and recurring invoices and credit notes not linked to a return. Owner decision needed on whether "clear" should remove them.
- Print format and uploaded logo: code and unit/PDF tests pass; not visually checked against a real tenant logo, and no live access.

- Product create "failed but saved" under a lost response: NOT_REPRODUCED in the product HTTP tests; needs a browser failure-injection test.
- Customer duplicate-name near-match (e.g. "X CUSTOMER") wording shown to the user: not browser-tested.
- Everything in sections 14-25 of the mission (sales, purchases, expenses, payments, daily close, stock, VAT reports, staff roles, concurrency): NOT_TESTED in this checkpoint.
- Live Gulf Harvest read-only inspection: NOT_TESTED (no credentials supplied; none guessed).
