# Ordered field and action QA

Every row requires actual field discovery, examples/validation, create, API/DB persistence, refresh/reopen, edit/update, errors, permissions and responsive regression. No module passes from navigation or builds alone.

User requested live write tests on 2026-10-14. Live metadata canaries use clearly labelled synthetic identities, zero opening balances and no existing-client edits. They are archived through reversible supported actions after verification. Financial posting tests use isolated synthetic tenants; no live invoice/payment/stock/expense posting is implied by a metadata canary.

| Order | Module / action group | Current evidence | Gate |
|---|---|---|---|
| 0 | Dashboard, navigation, alerts, maintenance/access/version | Authenticated live dashboard observed; dynamic claims and totals require deterministic reconciliation | IN PROGRESS |
| 1 | Products: every field, create, refresh, edit, image, stock, deactivate/reactivate, select/bulk | Local real field flows all five viewports; local real bulk/status at 360/1440; HTTP/PG integrity regressions. Live synthetic canary pending | IN PROGRESS |
| 2 | Customers: contact/tax/type/terms/credit/route/branch, optional fields, create/edit, selection, ledger links | Live synthetic canary pending; downstream ledger/financial checks separate | NOT TESTED |
| 3 | Shop location: manual address, confirmed map pin/GPS, denied permission, clear/edit | Requires actual field/permission discovery; no background tracking | NOT TESTED |
| 4 | Expenses: amounts/date/category/tax/tender/attachments, save/edit/archive | Financial writes in isolated test tenant | NOT TESTED |
| 5 | Suppliers/Purchases: every field, products/units/tax/discount/returns, stock/payables | Financial writes in isolated test tenant | NOT TESTED |
| 6 | Daily Close: opening/tenders/count/variance/close/reopen/authorization | Financial writes in isolated test tenant | NOT TESTED |
| 7 | Payments: allocations/tenders/partial/full/duplicate/void and ledger | Financial writes in isolated test tenant | NOT TESTED |
| 8 | Sales/POS: product/customer/unit/tax/prices, save/print/edit/void/history | Financial writes in isolated test tenant | NOT TESTED |
| 9 | Stock: opening/adjust/purchase/sale/return, history/concurrency/reconciliation | Local withdrawal race regression passes; remaining full flow pending | IN PROGRESS |
| 10 | Reports/VAT: dates/filters/export/tenant branding, deterministic totals | No report PASS without underlying transactions and reconciliation | NOT TESTED |
| 11 | Secondary pages: quotations, delivery notes, returns, worksheet, branches/routes, users, settings, audit/backup | Discover nested tabs and roles, preserve authorization and customer assets | NOT TESTED |
| 12 | SuperAdmin and infrastructure: observability, tenant boundaries, provider/keys, deployments, schema health | Read-only diagnostics retained privately; production changes remain approval gated | IN PROGRESS |

For each discovered bug: REPRODUCE → root cause → FIX → targeted TEST → browser/API/DB VERIFY → RETEST. Capture status codes, null/missing/type errors and sanitized screenshots. Record PASS / FAIL / BLOCKED / NOT TESTED per action; retain the full module gate until every required action is verified.
