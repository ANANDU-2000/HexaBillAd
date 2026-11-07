# T4 bug hunt 1 (2026-11-08)

Database: hexabill_codex_browser_loopb_20261108 (synthetic). Specs: frontend/hexabill-ui/e2e/bughunt/.
Format: BUG-n | feature | severity | repro | failing test | suspected file:line

## Bugs (2 real, both reproduced)

- BUG-8 | Products / Stock | S1 (data: tenant-wide stock overwrite by lowest role) | Sign in as a Staff user, `POST /api/products/recompute-stock` returns 200 and rewrites every product StockQty from InventoryTransactions. The sibling `reset-all-stock` is Admin,Owner only; recompute is `Admin,Owner,Staff`. For migrated tenants whose stock has no movement history this zeroes or changes stock (same class of risk as the bulk balance recompute the owner banned). | `e2e/bughunt/roles-permissions.spec.js` test `BUG-8 Staff cannot trigger ...` (fails: 200) | `backend/HexaBill.Api/Modules/Products/ProductsController.cs:723` (`[Authorize(Roles = "Admin,Owner,Staff")]`). NEEDS-BACKEND: restrict to Admin,Owner.
- BUG-9 | Purchases | S3 (latent, no UI calls it today) | As Owner, `POST /api/purchases/{id}/upload` (multipart PDF) returns 403 because the attribute is `Roles = "Admin,Staff"` (Owner missing, every other write on this controller lists Owner). | same file, test `BUG-9 Owner can attach ...` (fails: 403) | `backend/HexaBill.Api/Modules/Purchases/PurchasesController.cs:527`. NEEDS-BACKEND: add Owner.

## Production signals (read-only)
- Render logs: BLOCKED (needs owner API key). `list_logs` with workspace tea-ctr63al2ng1s73ersr5g returned "forbidden".
- Vercel: `vercel ls hexabill-ui` shows only Ready production deployments, `--status ERROR` returns none. The frontend is a static SPA, so there are no runtime logs to group; no error signatures to turn into tests.

## Features attacked and what held (regression tests that PASS)
- Payments and POS sales API (`money-edges.spec.js`, 13 tests pass): 0/negative amounts 4xx, 3-decimal amount rounded to 2dp, overpayment refused, same-key double submit = 1 payment, three concurrent different-key payments cannot exceed the invoice, double-submit same externalReference = 1 invoice and one stock deduction, oversell blocked when ALLOW_NEGATIVE_STOCK=false under concurrency, qty 0/-1, price 1e9, 501-char notes refused with 4xx, emoji/Arabic notes saved.
- Returns: qty 0/negative/over-sold refused, 3 concurrent full returns accepted exactly once, stock restored once.
- Products: duplicate SKU, 500-char name, negative cost, negative stock refused. Purchases: qty 0, negative qty/cost refused, same-key double submit = one, duplicate supplier invoice no refused.
- Daily close (`daily-close-edges.spec.js`, 6 pass; flag turned on inside the run and back off): preview with absurd dates/amounts, negative counted/opening cash, variance without reason, 5 concurrent closes, movement 0/negative/1e12/unknown kind/5000-char note, movement on a closed day, reopen of never-closed day.
- UI sweep (`ui-sweep.spec.js`, 12 pass): /pos /payments /returns/create /daily-close /purchases /products at 360, 752, 1254, 1440: no page errors, no 4xx/5xx, no sideways scroll, no control past the screen edge, no undefined/NaN text. Expired token and mid-session expiry go to login; offline reload not blank; loading state does not flash the empty state; a 500 on Payments is not shown as an empty list. Screenshots: `docs/uiux/evidence/2026-11-08/sweep/`.
- UI forms (`form-abuse.spec.js`, 4 pass): double-click Create Product = 1 product, 500-char name, negative cost, double-click Add Payment = 1 payment, negative/zero amount blocked before the request.
- Roles (`roles-permissions.spec.js`): Staff blocked from users, settings write, clear-data, reset-all-stock, payment delete/status; Staff and Owner cannot read other tenants' sales/customers/payments by id; Staff page sweep clean.

## Not covered (time)
Driver role, Admin role UI sweep, two-tab same-record edit, browser back during save, refresh mid-form, slow-3G throttle, Suppliers/Expenses/Stock adj. UI forms.

## Harness notes
- The synthetic seed's `--rotate-password` refuses to run if the tenant has extra users or non-empty FeaturesJson, so specs that create users or flip flags must clean up in afterAll (the specs do). A local unlimited plan row was inserted in my DB only (SubscriptionPlans + Subscriptions for tenant 1) so Staff/Admin users can be created.
- Product create ignores stockQty by design (stock starts at 0); negative stock is allowed by default (ALLOW_NEGATIVE_STOCK missing = true, SaleService.cs:97). Not bugs, noted for test authors.
