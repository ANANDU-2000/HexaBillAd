# Quotations module audit (2026-11-04)

## Root causes
1. **Rows vanished / next product overwrote row 1** - editor auto-save replaced local rows with the server response (blank rows are not saved) and the post-create route change reloaded from the server. Fixed: local rows are source of truth, stable `tempId` keys, baseline = snapshot actually sent (commit 6158b294).
2. **Print did nothing on phones/tablets** - PDF tab opened after an awaited fetch (popup blockers, iOS Safari). Fixed: tab reserved inside the click, download fallback (`utils/pdfOpen.js`).
3. **Duplicate quote number race** - max+1 numbering vs unique `(TenantId, QuoteNo)`; `CreateAsync` now retries on SQLSTATE 23505.
4. **Format gaps** - no valid-until, customer TRN, subject, terms, discount row or amount in words; zero-price lines accepted. Added columns, PDF sections, validation, per-tenant defaults (`QUOTE_TERMS`, `QUOTE_VALID_DAYS`).
5. **Phone layout** - 40rem line-item table; replaced by cards below `md`.

## Live checks
- Schema matched models; migrations applied. `ErrorLogs`: 0 quotation errors. Render logs: PUT/DELETE returned 200 (server was healthy; failures were UI-side).
- Columns added to live DB before deploy (additive, idempotent): `ValidUntil`, `CustomerTrn`, `Subject`, `TermsAndConditions`; history row `20261104180000_AddQuotationCommercialFields`.

## Tests
- `tests/HexaBill.Tests/billing/QuotationModuleTests.cs` (5 pass): multi-item create, edit 4->6->3 without orphans, delete + tenant isolation, per-tenant numbering, 28-item PDF (2 pages, totals reconcile).
- `e2e/quotation-editor-flow.spec.js` on synthetic tenant: m390, t768, d1440 all pass (create 3 items with auto-save between rows, reload, edit, zero-price validation, print popup, delete).

## Not verified
- Live (production) create/print/delete with a real session (no production login available to automation).
- Visual check of every tenant's letterhead.

## Round 3: large quotations + list features
- Backend test `LargeQuotation_25Items_CreateGrowShrinkAndDelete_StayConsistent`: 25 -> 40 -> 12 items, no orphan rows, sort order preserved, delete (6/6 module tests pass).
- Browser `quotation-large-and-list.spec.js` (m390, t768, d1440 pass): 22 rows through the UI with auto-save firing mid-way, reload (22 persisted), remove 5, reload (17), list search / status filter / quick status change, Copy (prefilled 17 rows), delete. Existing `document-lists-responsive` and `quotation-editor-flow` specs also pass.
- List page now: search (number, customer, subject, TRN), status filter, sort, 25/page paging, item count, valid-until with "lapsed" marker, inline status change, Copy (duplicate), totals strip, filtered-empty state.
