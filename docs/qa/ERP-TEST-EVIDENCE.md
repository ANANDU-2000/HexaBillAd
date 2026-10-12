# ERP Test Evidence (2026-10-12)

| Test | Scope | Command | Result |
|---|---|---|---|
| T-CUST-BROWSER | Customer create/edit/duplicate email/phone, credit, terms, refresh, SQL row count | `scripts/run-customer-save-qa.ps1 -ResumeFixtures -Projects m360,t768,d1440` | PASS 12/12 |
| T-CUST-RED | Same two credit tests with the page fix reverted | `-Projects m360 -TestFilter credit` | FAIL 2/2 as expected, then PASS after restore |
| T-CUST-HTTP | Duplicate name/phone create/update return 409 | `dotnet test --filter CustomersHttpIsolationTests` | 500 before fix (2 failed), PASS 11/11 after |
| T-BACKEND-FULL | Whole backend suite on fresh PostgreSQL DB | `HEXABILL_TEST_POSTGRES=... dotnet test` | PASS 793/793, 0 skipped |
| T-BACKEND-NOPG | Same without PostgreSQL | `dotnet test` | 741 passed, 52 skipped (PostgreSQL-gated; not counted as pass) |
| T-FRONT-UNIT | Frontend unit tests | `npm test` | PASS 154/154 |
| T-LINT | ESLint on CustomersPage.jsx | `npx eslint` | 0 errors, 7 pre-existing warnings |

No credentials, tokens or private customer data are recorded. Screenshots remain under the ignored e2e results folder.
