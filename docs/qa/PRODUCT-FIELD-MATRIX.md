# Products field matrix

This matrix describes the implementation and disposable local tests. Environment-specific diagnostics are retained privately.

| Actual field | Server contract | Current source guidance / local verification |
|---|---|---|
| SKU | Required, max 50; allowed letters/numbers/dot/dash/underscore; tenant-scoped uniqueness | Name suggestion + explicit code input. Inactive reuse now rejected without changing history. Browser all-field persistence pending. |
| Barcode | Optional, max 100; active tenant uniqueness | Scan/manual/SKU-based Code128 input. Hardware/camera NOT TESTED. |
| English name | Required, max 200 | Linked label/example and inline required/length validation; further invalid-field browser coverage pending. |
| Arabic name | Optional, max 200 | Arabic example, dir auto. Unicode round trip partly covered by existing HTTP tests; browser pending. |
| Category | Optional, active category must belong to tenant | Dropdown and nested create category. Current service silently drops invalid category; acceptance pending. |
| Quantity unit | Required, max 20 | Form options CRTN/KG/PIECE/BOX/PKG/BAG/PC/UNIT/CTN/PCS/LTR/MTR. Server allows a nonblank custom unit. |
| Conversion to base | Minimum 0.0001, maximum 999999.99 | Four decimals supported by form/API; PostgreSQL widening migration tested locally. Meaning/helper and invalid input behavior pending. |
| Cost price | 0–1,000,000 enforced by service | Form example 120.00, rounds two decimals. Currency/tax basis and inline range validation pending. |
| Selling price | 0–1,000,000 enforced by service | Form example 140.00; below-cost confirmation. Invalid input behavior pending. |
| Expiry date | Optional UTC-compatible date | Blank becomes null. Valid/clear/edit/refresh/browser overflow pending. |
| Product image | Optional upload; form checks image MIME + 5MB | Create upload follows confirmed create; edit upload precedes metadata save. Failure, persistence and actual storage tests pending. No production upload performed. |
| English description | Optional, DTO max 500 | Current textarea lacks max length/linked label. Browser long-text round trip pending. |
| Arabic description | Optional, DTO max 500 | Arabic example and dir auto; max length/round trip pending. |

The implementation adds ReorderLevel with nonnegative integer validation and verifies its create/edit persistence. Stock quantity remains intentionally absent: opening balance/adjustments are separate inventory transactions. The complete form now accounts for fourteen data controls.

Selection/bulk: current source has selectedIds, count, typed soft-deactivation confirmation, partial-failure retention and per-record authorization. This is code evidence, not a browser PASS. Mocked selection/bulk cases pass at 360/1440. Real local workflows pending.

Latest real Chrome/API/PostgreSQL test across all five viewports fills every supported control, creates a category and product, verifies tenant/fields in PostgreSQL, reopens/decodes image, edits every text/numeric/unit/date field, retains opening stock 25.5, and clears image/category/expiry. Five current cases pass. Form reference removal and actual image rendering were separately reproduced and fixed. Role, failure and state-machine gates are IN PROGRESS; no module PASS inferred from a screenshot or build.
