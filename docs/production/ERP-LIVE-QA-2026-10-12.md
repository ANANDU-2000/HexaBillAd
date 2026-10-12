# Gulf Harvest sequential ERP QA - 2026-10-12

IN PROGRESS / PARTIAL. Read-only production inspection plus isolated local write testing. Not complete ERP acceptance or release approval.

## Baseline

- Checkout `3cd2a208bae0472735cbc1e090f12376c8a71434`, initially main; QA branch `codex/live-erp-qa-20261012`. Four pre-existing untracked user documents preserved.
- Actual production `/health/ready`: HTTP 200, Ready, Connected, Current; deployVersion equals checkout SHA at `2026-10-12T15:24:46Z`. Gulf Harvest `/api/maintenance-check`: HTTP 200, maintenanceMode false.
- Vercel get_deployment for Gulf Harvest: READY, production deployment `dpl_ASo1oPXfYXq6mXoL596AgZJ6d9U8`; frontend metadata SHA `c9dc5e6e18aa91036c71de6a56188e6c01fb0fcc`. Local fixes are not assumed live.
- User signed in through ordinary login. Owner shell and tenant branding observed. No production save/edit/delete/stock recomputation/payment/restore/flag change/deploy performed.
- Bounded browser console capture showed no errors at login and the subsequent POS check. Not proof of no server errors.

## Live route coverage

Thirty entry pages inspected sequentially, including login. Opening a page does NOT certify persistence, totals, permissions, exports or field boundaries. Initial loading-only observations were superseded by loaded checks where noted. Detail/editor/conditional paths remain pending.

| Routes | Observation | Acceptance |
|---|---|---|
| /login | Tenant-branded page and user-completed owner sign-in | PASS for this session; other roles/session states NOT TESTED |
| /dashboard | Period controls, summary and current-cost limitation | Reconciliation NOT TESTED |
| /products, /customers, /suppliers | Loaded lists; create forms opened/cancelled | Writes/dependencies NOT TESTED live |
| /billing-history, /sales-ledger, /ledger | Search/date/customer controls | Details/totals/edit/void/print NOT TESTED |
| /payments, /purchases | Loaded lists; create forms opened/cancelled | Posting/allocation/stock/payable NOT TESTED live |
| /expenses, /branches, /stock-adjustments | Page/list/filter or history controls | Writes/reconciliation NOT TESTED live |
| /quotations, /delivery-notes | Entry pages opened | Editor/convert/details/print NOT TESTED |
| /returns/create | Message directs opening a return from an invoice | Contextual gate; invoice return path NOT TESTED |
| /reports, /vat-return, /worksheet | Report/period/export controls | Each report/totals/export/locks NOT TESTED |
| /daily-close | Explicit workspace feature-disabled message | BLOCKED by live configuration; no flag changed |
| /users, /settings, /audit, /backup | Management/settings/history controls; Settings missing-TRN warning | Staff/permissions/settings/backup/restore writes NOT TESTED live |
| /more | Four additional feature links discovered | Detail paths pending |
| /pricelist, /agreements, /salary-certificates | Entry pages opened | Price mutation/editor/print NOT TESTED |
| /feedback | Subject/details/optional-email controls | Submit NOT TESTED; sends external feedback |
| /pos | Empty draft controls; Cash initially selected | Sale/stock/last-price/ledger/print NOT TESTED live |

## Fields observed

These are inventories, not live boundary-test passes. No real form was submitted.

- Product: SKU, barcode/Auto/Scan, English/Arabic names, category, quantity type, conversion, cost/sell prices, expiry, image, English/Arabic descriptions. Required/numeric HTML attributes inspected. Opening stock uses a separate adjustment.
- Customer: name, phone, email, TRN, credit limit, type, terms, address, location, latitude/longitude. Branch/route conditional controls absent in this live create form. Map/GPS not activated.
- Supplier: name, phone, email, credit limit, terms, address.
- Purchase: supplier, supplier invoice number, date, expense category, VAT/input-tax controls, product search. Product selection/item-row boundaries pending in isolation.
- Payment: customer/invoice selectors, method, amount, date, notes. No posting.
- Settings company tab: English/Arabic legal name, VAT/corporate TRN, header style, contacts/address, logo, letterhead/stamp/signature controls, margins/sizes/offsets, return-template text. Other tabs pending.
- POS: invoice number/date, customer/branch/route controls, line area, discount, zero-invoice toggle, method/amount/notes.

## QA-C01 customer duplicate-email save

P1. Existing customer email E; unique new name/phone, same E, blank credit -> Add Customer -> warning -> Add anyway. Original permitted-email path returned 400 with zero target DB rows. Duplicate-confirmation omitted the optional-field normalization used by ordinary onSubmit: NaN credit serialized to null. Separate duplicate-phone reproduction hit the existing backend uniqueness guard and returned 500; no guard was weakened.

Fix: CustomersPage.jsx uses the same payload builder for ordinary create/edit and confirmation create. Blank credit is 0, optional email is null, IDs/coordinates retain established representations.

- Reproduced original permitted-email path with `& .\scripts\run-customer-save-qa.ps1 -ResumeFixtures`: exit 1, one failing test, expected 201 / actual 400.
- Fixed browser test: `& .\scripts\run-customer-save-qa.ps1 -ResumeFixtures -Projects m360,m390,t768,d1024,d1440`: exit 0, 5 passed / 0 failed / 0 skipped (39.6s). Each checks 201, exactly one POST, one row directly in PostgreSQL scoped to the authenticated tenant, reload/list/API parity, phone/email/Unicode address, zero credit and null coordinates.
- Targeted backend filter and exact command are in the central tracker: exit 0, 65 passed / 0 failed / 0 skipped (27s).
- Frontend npm test: exit 0, 154 passed / 0 failed / 0 skipped. Changed-file ESLint: exit 0, 0 errors, 7 existing warnings.
- QA specialist startup-503/retry browser regression: exit 0, 5 passed across all widths, no skips. Intercepted responses only, not live/backend proof.

Synthetic environment: PostgreSQL 18 on loopback 55472; database `hexabill_codex_browser_20261012_1525`; real guarded API TestServer bridge 5078; Vite 5175; four synthetic tenant slugs, all flags OFF. Separate HTTP test database `hexabill_qa_http_20261012`. EnsureCreated/test schema is NOT migration-chain proof.

Runtime synthetic passwords/edge keys are generated in memory, not logged or saved; new regression traces are disabled. Owned API/Vite processes stop in finally. Cluster/data preserved for investigation; cluster will be stopped before yielding. No production assets/data removed, no external AI provider or paid service used.

## Remaining fix queue

1. Reproduce zero-credit customer -> positive-credit edit: edit JSX omits payment terms although submission requires them. Add the control if confirmed, retaining backend rules.
2. Duplicate-phone contract: UI offers Add anyway despite backend forbidding it; expected conflicts currently appear as 500. Test tenant-local conflict and other-tenant allowance without weakening uniqueness.
3. Inject lost product-create response locally. Source currently says nothing was saved without reconciling a possible commit; reproduce and repair the misleading retry instruction.
4. Product/customer field boundaries and full create/edit/refetch/image/barcode/stock dependency tests, then purchases/expenses/payments/sales/returns/daily close, one bounded checkpoint at a time.
5. Live details/editors/read-only reports and responsive checks. Live Daily Close enablement needs a platform-admin decision after staging verification.
6. Release blockers: complete financial/tenant/staff/print/PG migration acceptance, candidate SHA compatibility/rollback, restore-reported ImageSharp advisories and environment-specific deployment approval. No READY claim.

Exact next action: reproduce missing terms in positive-credit customer edit. Goal remains active; this is an interim fix queue, not the final all-features fix plan.
