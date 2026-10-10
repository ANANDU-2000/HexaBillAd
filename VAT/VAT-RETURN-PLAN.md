# HexaBill VAT Return — Plan (Gulf Harvest, FrozenHub1, FrozenHub2)

Drop this file at `docs/plan/VAT-RETURN-PLAN.md`. Codex reads it with `CODEX-GOAL-PROMPT.md`.
Audit date: 10 Oct 2026. Audit method: static read of both zips (`FROZEN-MAGIC…-main`, `HexaBillAd-main`). **Nothing was compiled or run** (no .NET in the audit sandbox). Every finding below cites a file, but Codex must re-verify each one by test before and after fixing.

---

## 0. Decisions needed from Anandu before Phase 3 (defaults chosen so work can start)

| # | Question | Default Codex uses until you answer |
|---|----------|-------------------------------------|
| D1 | The three clients are on `VatCalculationBasis = ProfitBased`. In the current UI that **hides the Sales / Purchases / Expenses / Credit Notes tabs** (see F-01). Keep the 5% profit estimate? | Keep it as a small labelled "Estimate – not for filing" card. **Never hide the statutory tabs.** Default view = Frozen Magic style (Output VAT − Input VAT). |
| D2 | Which VAT filing period does each client have on its FTA certificate (monthly, standard quarters Jan–Mar…, or staggered Feb–Apr…)? | Add a per-tenant setting `VatFilingPeriodType`. Default `Quarterly-Standard`. Do not guess per client. |
| D3 | FrozenHub1 and FrozenHub2 share one TRN but have isolated data. FTA expects one return per TRN. | Build **per-tenant** returns only. No cross-tenant aggregation. Show a notice: "Shared TRN — the filed return must be consolidated by your accountant." Confirm with their accountant whether two owners can legally share a TRN. |
| D4 | Negative Box 1 adjustments (return of a previous-period invoice) | Show the real negative number with a warning. Do not clamp to 0 (see F-05). Confirm with accountant. |
| D5 | Zayogya | **Unchanged.** Must pass a regression test. |

Rules already decided (from your earlier work, do not change):
- TRN is entered by each owner in their own tenant Settings. Nothing hard-coded.
- Empty TRN: drafts and on-screen report work. Official PDF, Lock and Submit are blocked server-side until a valid 15-digit, non-sample TRN exists.
- Print/PDF header uses the **current** tenant settings. Amounts never change on reprint.
- Tenant comes from host + JWT only. Never from a client-sent tenant id.

---

## 1. What Frozen Magic does (the format to copy)

Source: `VatReportPage.jsx`, `ReportsController.GetVatReport`, `VatReportDto`.

- Header card: company name, `TRN: …`, `Period: from — to`.
- Three tiles: **Output VAT (sales)**, **Input VAT (purchases)**, **Net VAT payable** = Output − Input.
- Summary table, 2 rows: Sales (taxable / VAT / gross), Purchases (taxable / VAT / gross).
- Two collapsible detail tables: Sales (Date, Invoice, Customer, Taxable, VAT, Total) and Purchases (Date, Reference, Supplier, Taxable, VAT, Total).
- Period quick-picks: year selector, Q1–Q4, Full year, YTD, Last 30 days, Custom, Refresh.
- Isolation: `CurrentOwnerId` on every query.

Frozen Magic gaps that HexaBill must **not** copy: no returns/credit notes, no expenses, no zero-rated/exempt split, no lock, no PDF, no validation, swallows errors into a generic 500, prints `ex.Message` to the client.

HexaBill already has the stronger engine (FTA Form 201 boxes, returns, reverse charge, validation V001–V014, lock/submit). The job is: **keep that engine, fix its bugs, and present it in the Frozen Magic layout by default**, with Form 201 as an "FTA Form 201" tab.

---

## 2. Audit findings (HexaBill)

Severity: **S1** wrong money or data leak. **S2** wrong behaviour/legal risk. **S3** UX/quality.

### Money and filing correctness

| ID | Sev | Where | Problem | Fix |
|----|-----|-------|---------|-----|
| F-01 | S1 | `VatReturnPage.jsx` ~L384, L1112 | For `ProfitBased` tenants (your 3 clients) tabs are limited to Overview / Profit / Validation. Sales, Purchases, Expenses, Credit Notes are hidden. This is the likely "VAT page is wrong" for these clients. | Always show statutory tabs. Profit view becomes an optional card (D1). |
| F-02 | S1 | `VatReturnReportService.FillProfitFormAsync` | Profit uses `Sum(GrandTotal)` (VAT-inclusive) and ignores sale returns, deleted/unapproved filtering differs from the main flow (`Expenses` sum has no `Status == Approved`). Profit and the 5% estimate are overstated. | Use net (`Subtotal`) minus returns net; expenses approved only; same date convention as the main report. Label stays "estimate, not for filing". |
| F-03 | S1 | `GetVatReturn201InternalAsync` (sales loop) | Guesses VAT: if `net==0 && vat==0` it divides GrandTotal by 1.05; if `Subtotal≈GrandTotal` it also divides by 1.05. Purchases fall back to "assume 5% inclusive". Guessed numbers go straight into filing boxes. | Keep guess only as a visible **warning line** ("VAT estimated from gross") and a new validation rule V015; the line is flagged `IsDerived=true`. Lock is blocked while any derived line exists unless the owner fixes or explicitly acknowledges. |
| F-04 | S1 | same, returns block | Every sale return is subtracted from standard-rated Box 1a/1b, even if the original invoice was zero-rated or exempt. Zero-rated/exempt returns never reduce Box 2/3. | Subtract returns by the original sale's `VatScenario`. Add `VatScenario` snapshot on the return line if missing. |
| F-05 | S1 | same | `box1a = Math.Max(0, box1a - returnsNet)`; `box1b` same; `box12` clamped to 0. A return of a prior-period invoice makes the true figure negative, and the clamp silently hides it. | Remove clamps. Negative allowed and shown (D4). Box 13a/13b logic stays `max(0, …)` because those are payable/refundable splits. |
| F-06 | S1 | `GetVatReturn201Async` public wrapper | Any exception is swallowed, a zero-valued DTO with `SYS001` is returned with **HTTP 200**. Excel/CSV export call the same method, so an export can silently produce an all-zero return. | Throw a typed `VatCalculationException`. Controller returns 500/422 with a safe message and a correlation id. Exports and PDF refuse to generate on failure. Never include `ex.Message` for end users. |
| F-07 | S1 | `ReportsController.CalculateVatReturn` | If status is not `Locked`, status is reset to `Calculated`. A **Submitted** period that is recalculated falls back to `Calculated` and its boxes are overwritten. | Only `Draft`/`Calculated`/`Reviewed` may be recalculated. `Locked`/`Submitted` return 409 with the stored snapshot. |
| F-08 | S1 | `GET vat-return` | A locked period is re-computed live from transactions, not read from the stored boxes. Anything that bypasses the lock changes a "locked" return. | When status is `Locked`/`Submitted`, serve the stored snapshot + stored lines (new `VatReturnPeriodLine` table or JSON snapshot) and show "Snapshot taken <time>". |
| F-09 | S1 | Lock enforcement | `VatPeriodLockedException` is thrown in Sale, Purchase, Expense services. **Sale returns and purchase returns have no check** (they change Box 1 and Box 11). | Add the same guard in `ReturnService` (sale + purchase returns, create/edit/delete), payment-adjustment flows that change VAT, and any bulk import. Test each. |
| F-10 | S2 | `Period` model / `AppDbContext` | No unique index on `(TenantId, PeriodStart, PeriodEnd)`. Two clicks create two rows; `FirstOrDefault` then picks one randomly. Standard-quarter and FTA-quarter rows can overlap. | Unique index + overlap check by `VatFilingPeriodType`. Use upsert inside a transaction with `Serializable`/advisory lock. |
| F-11 | S2 | Dates | Sales use UTC range (`ToUtcKind` just stamps `Kind=Utc`, no conversion). Purchases/expenses use `DateOnly.FromDateTime`. They agree only if every stored timestamp is a GST wall-clock labelled UTC. | Write a boundary test: invoice at 23:59 and 00:01 GST on the last/first day of a period, for sales, purchases, expenses, returns. If any disagree, centralise on one helper (`ReportDateRangeService`). |
| F-12 | S2 | Reverse charge (REL-015/016 in `ERROR-REGISTER.md`) | Box 4 / Box 10 mapping is flagged as not matching the current FTA Form 201 guide. | Out of scope for this release unless the client has reverse-charge purchases. Detect and **block lock with a clear message** instead of filing a wrong box. Accountant sign-off needed. |
| F-13 | S2 | Box 9b | Claimable VAT on expenses uses 4 layered fallbacks (ClaimableVat → VatAmount → Total−Amount → Amount×rate). Different expenses can be valued by different rules. | One function, one precedence, unit-tested table. Derived values flagged like F-03. |
| F-14 | S2 | V009–V011 | These "assurance" rules re-check numbers computed from the same data, so they can never fail for a calculation bug. | Replace with independent recomputation (SQL aggregate vs. line sum) and a ledger cross-check (sales ledger total = VAT return total, dashboard = VAT return). |

### Tenant isolation

| ID | Sev | Where | Problem | Fix |
|----|-----|-------|---------|-----|
| F-15 | S1 | 57 places `OwnerId == tenantId`, 16 of them `TenantId == null && OwnerId == tenantId` (Sales, Purchases, Expenses, VAT service, suggest-period) | Legacy fallback compares an **owner/user id** to a **tenant id**. A new tenant whose id equals an old owner id will see that owner's untagged rows. New tenants (FrozenHub1/2, Gulf Harvest) are exposed to any legacy untagged rows. | Migration: backfill `TenantId` on all legacy rows from the correct tenant (dry-run report first). Then remove every fallback in VAT paths and add a startup check that fails if `TenantId IS NULL` rows exist. |
| F-16 | S1 | `FillProfitFormAsync` uses `TenantId == tenantId` while main report uses the fallback | Two queries disagree on what belongs to the tenant. | Single tenant filter helper used everywhere. |
| F-17 | S2 | `ValidatePeriodAsync`, `GetVatReturnValidation` | Takes `periodId` from query. Confirm every query adds `TenantId` (looks OK, add a test with a foreign period id → 404). | Tests. |
| F-18 | S2 | `vat-tracking` endpoint | Writes audit rows from client-supplied `EventType`/payload. | Length/whitelist validate. |

### Output, export, UX

| ID | Sev | Where | Problem | Fix |
|----|-----|-------|---------|-----|
| F-19 | S1 | `VatReturnPage.jsx` | No company name or TRN anywhere on the page, print area or the DTO. For three clients and two sharing a TRN, a return without TRN/company is not usable. | Add `CompanyName`, `CompanyNameAr?`, `VatTrn`, `Address`, `TrnStatus` to `VatReturn201Dto`; render on screen, PDF, Excel, CSV. |
| F-20 | S1 | no backend PDF | "Print / PDF" is `window.print()` on a hidden off-screen div (`fixed -left-[9999px] opacity-0`). Mobile browsers often print blank/clipped. | Server-side PDF endpoint (reuse the repo's existing PDF service) + download button. Keep browser print as a secondary option with a real print stylesheet. |
| F-21 | S2 | CSV export | Fields not quoted/escaped (`Customer,Name` breaks columns); a value beginning with `= + - @` is a spreadsheet formula injection. | RFC-4180 quoting + prefix `'` for formula starts; UTF-8 BOM so Excel opens Arabic names. |
| F-22 | S2 | Duplicate routes | `vat-return/export/excel` appears twice in the controller grep (the FTA-201 one and an older `vat-return/export`). | Single route; delete the legacy one after confirming no caller. |
| F-23 | S3 | `VatReturnPage.jsx` (1527 lines) | One file, 7 tabs, wrapped tab row, many inline buttons, "track" panel, backfill button visible to users. | Split into components (§4). Move backfill/diagnostics to an Admin-only menu. |
| F-24 | S3 | Tabs / buttons | Tab row wraps on mobile; action buttons are text-only, inconsistent heights; no loading/disabled reasons. | See §4 spec. |
| F-25 | S2 | Auth | `GET` for Manager allowed; `lock/submit` Owner+Admin. Staff blocked. OK. But no audit row is written on lock/submit/export. | Audit log on calculate, lock, submit, export (who, tenant, period, hash of boxes). |

Previously noted in `docs/plan/FINANCE-INVARIANTS.md`: profit-based 5% estimate stays separate from the statutory payable. Keep that invariant.

---

## 3. Target design

### 3.1 Backend

New/changed contract (`GET /api/reports/vat-return`), all tenant-scoped:

```
VatReturn201Dto (additions)
  company: { name, nameAr?, trn, trnStatus: Valid|Missing|Sample|Invalid, address, phone }
  filingPeriodType: Monthly | QuarterlyStandard | QuarterlyFta
  snapshot: { isSnapshot, takenAt, takenByUserId } // locked/submitted
  summary:  { outputVat, inputVat, netVatPayable, refundable }   // Frozen Magic tiles
  sales:    { taxable, vat, gross, items[] }                      // Frozen Magic table
  purchases:{ taxable, vat, gross, items[] }
  boxes:    existing Box1a…Box13b (Form 201)
  warnings: [{ code, severity, message, refs[] }]                 // incl. derived-VAT, reverse-charge, missing TRN
  profitEstimate?: { …, notForFiling: true }                      // only if D1 keeps it
```

Rules:
1. `NetVatPayable = Output VAT − Input VAT` where Output = Box 1b (after credit notes), Input = Box 12. Same number as Box 13a − 13b. One source of truth, asserted by a test.
2. Server computes everything. The frontend never re-derives VAT.
3. Money is `decimal`, round **per line, away from zero, 2 dp**, then sum (existing `VatCalculator.Round`). Box totals = sum of rounded lines. Document this in the PDF footer: "Amounts rounded per invoice line".
4. All errors use one `ApiResponse` shape with `errorCode` and `correlationId`. No stack traces or raw exception messages to the client.
5. Status machine: `Draft → Calculated → Reviewed → Locked → Submitted`; `Amended` only via an explicit, audited "Unlock/Amend" by Owner with reason. Illegal transitions return 409.
6. Lock = write snapshot (boxes + all lines) in one DB transaction, then set status. Idempotent (second click returns the same result).
7. New endpoint `GET vat-return/export/pdf` (tenant, from, to or periodId). Refuses if TRN invalid for the "Official" variant; "Draft" variant stamped DRAFT is allowed.

### 3.2 Database

- Migration A (safe, additive): `VatFilingPeriodType` on tenant settings; `VatReturnPeriodLine` (or `SnapshotJson`); unique index `(TenantId, PeriodStart, PeriodEnd)`; audit columns.
- Migration B (data): backfill `TenantId` on legacy rows. **Dry run report first** (counts per table per candidate tenant). Never run on production without Anandu's explicit approval.
- Migration C (later, after verification): `TenantId NOT NULL` on Sales, Purchases, Expenses, SaleReturns, PurchaseReturns.

Every migration must have a tested Down path, and be tested against a copy of staging data.

### 3.3 Frontend

Keep Form 201 data, change the layout to Frozen Magic:

Page order (top to bottom):
1. Title row + status chip (Draft / Calculated / Locked / Submitted).
2. Period bar.
3. Company card (name, TRN, period, filing type). Missing TRN → amber banner with button "Add VAT TRN in Settings".
4. Three tiles: Output VAT, Input VAT, Net VAT payable (green/amber/blue, same as Frozen Magic; red if refundable).
5. Summary table (Sales, Purchases, Credit notes, Expenses, Net).
6. Tabs (below).
7. Action bar.

Tabs (always the same set, both clients types): **Summary · Sales · Purchases · Expenses · Credit Notes · FTA Form 201 · Checks**. "Profit estimate" is a card inside Summary only if D1 keeps it.

#### UI rules (desktop and mobile)

- Breakpoints: ≥1024 desktop (tiles in 3 columns, tables); 640–1023 tablet; <640 mobile (tiles stacked, tables become cards).
- Tabs: one row, horizontally scrollable on mobile, active tab auto-scrolls into view, **icon + label** (desktop), **icon + short label** (mobile), a count badge on tabs with rows, a red dot on Checks when blocking issues exist. Minimum touch target 44×44 px. Keyboard arrow-key navigation, `role="tablist"`.
- Icons (lucide-react, already in the repo): Summary `LayoutDashboard`, Sales `Receipt`, Purchases `ShoppingCart`, Expenses `Wallet`, Credit Notes `Undo2`, Form 201 `FileText`, Checks `ShieldCheck`. Actions: Refresh `RefreshCw`, PDF `FileText`, Excel `FileSpreadsheet`, CSV `FileDown`, Print `Printer`, Calculate/Save `Calculator`, Lock `Lock`, Submit `Send`.
- Action bar: desktop = one row, primary (Download PDF) on the left, secondary after; mobile = sticky bottom bar with PDF + a "More" sheet (Excel, CSV, Print, Lock, Submit). Same height (40 px desktop, 48 px mobile), same radius, same focus ring.
- Button states: idle, loading (spinner + label "Preparing PDF…", disabled), disabled **with a reason** (tooltip on desktop, helper text on mobile): "Add your VAT TRN in Settings", "Fix 2 blocking checks", "Period is locked". Double-click protection: ignore clicks while a request is in flight.
- Submit/Lock use a confirm dialog that repeats company, TRN, period and Net VAT payable. Lock requires typing `LOCK`. After success show an **acknowledgement panel**: "Locked by <user> at <time GST>. Net VAT payable AED x. Reference <id>." with a Download PDF button. Errors show a red panel with the safe message and a correlation id to copy.
- Tables: right-aligned numbers, `tabular-nums`, AED formatting, sticky header, sticky totals row, empty state ("No sales in this period" + the date range), loading skeleton, error state with Retry. On mobile each row is a card: reference + date on top, party below, Taxable/VAT/Total as three small columns.
- Never show `NaN`, `undefined`, `Infinity`, `-0.00`. Format negative as `(1,234.56)` in tables and red.
- Dates shown in GST, `DD/MM/YYYY`. Period picker only offers periods valid for the tenant's `VatFilingPeriodType` plus "Custom" (which clearly says it is not a filing period).
- Race safety: ignore stale responses (request id / AbortController) when the user switches periods quickly.
- Accessibility: labels on inputs, `aria-busy` on loading regions, colour never the only signal.

### 3.4 PDF / Excel / CSV rules

- PDF A4, black-and-white friendly (clients want B/W print), page numbers "Page x of y", generated-at (GST), user, period, status. Unlocked = diagonal "DRAFT" watermark.
- Header: tenant company name, TRN, address, phone from **current** tenant settings. FrozenHub1 and FrozenHub2 each show their own settings but may show the same TRN.
- Sections: Summary (3 tiles as a table), Form 201 boxes, Sales detail, Purchases detail, Expenses, Credit notes, Checks/warnings. Long tables repeat the header on every page. Long customer names wrap, never overflow.
- Arabic: if names contain Arabic, use a font with Arabic glyphs; test with one Arabic customer name. No `?` or boxes.
- Filename: `VAT-Return_<TenantSlug>_<PeriodLabel>_<Status>.pdf`. Tenant slug sanitised.
- Excel and CSV carry the same company/TRN header rows and the same totals. CSV escaping per F-21.
- All exports are generated from the same DTO as the screen (one calculation per request) so screen = PDF = Excel = CSV.

---

## 4. Edge cases that must have a test

Money:
1. No transactions in period → all zero, clear "no data" state, PDF still generates, not an error.
2. Only purchases, no sales → Net payable negative → shown as **Refundable**, Box 13b.
3. Sale return of an invoice from an earlier period → negative adjustment, no clamp.
4. Return of a zero-rated invoice → Box 2 reduces, not Box 1.
5. Zero-rated, exempt, out-of-scope, designated-zone sales.
6. Invoice with discount + round-off; multiple VAT lines on one invoice.
7. Legacy sale with `VatTotal = 0` and `Subtotal ≈ GrandTotal` → derived warning, lock blocked.
8. `NULL` Subtotal/VatTotal on purchase → no crash, warning.
9. Deleted (`IsDeleted`) sales excluded; draft / held invoices excluded; zero-value invoices excluded.
10. Purchase with reverse charge → lock blocked with message (F-12).
11. Expense: petroleum, entertainment (non-claimable), VAT-inclusive vs exclusive, unapproved expense excluded.
12. Very large numbers (AED 9,999,999,999.99), 0.005 rounding boundaries, 1000 lines, rounding sum equals box.

Dates:
13. Invoice at 23:59 and 00:01 GST on the first and last day of the period (sales, purchases, expenses, returns).
14. Leap day, year boundary for staggered Nov–Jan quarter.
15. User enters From > To, a future period, a 5-year range, a non-filing range.

Tenants / security:
16. FrozenHub1 cannot see FrozenHub2 data in the report, PDF, Excel, CSV, validation, suggest-period, tracking. Same for Gulf Harvest and Zayogya.
17. Same TRN in two tenants: no uniqueness error; no cross-visibility.
18. A tenant id that equals a legacy owner id sees nothing legacy.
19. Foreign `periodId` → 404. Manipulated `tenantId` in query/body ignored.
20. Staff cannot call any VAT endpoint; Manager cannot lock/submit.

Workflow:
21. Double-click Lock / Submit → one result.
22. Two browsers calculate the same period at once → one row.
23. Recalculate Locked/Submitted → 409.
24. Edit/delete/create sale, purchase, expense, **sale return, purchase return** dated inside a locked period → blocked with the standard message.
25. Missing TRN → Official PDF/Lock/Submit blocked; draft PDF allowed.
26. Sample TRN in production config → blocked.
27. Network failure, 401 expiry mid-export, 500 → UI shows error + Retry, no blank page, no stuck spinner.
28. Slow API (>10 s) → loading state, cancel on navigation.

Rendering:
29. Mobile 360 px, tablet 768 px, desktop 1440 px; screenshot each tab.
30. PDF opens in Chrome, Edge, Adobe, iOS Preview; long company names; Arabic names.

---

## 5. Fixtures (hand-calculated, tests must reproduce exactly)

**Fixture A — standard**
| Item | Net | VAT |
|------|----:|----:|
| Sale 1 (standard) | 1,000.00 | 50.00 |
| Sale 2 (zero-rated) | 2,000.00 | 0.00 |
| Sale return (of Sale 1) | 200.00 | 10.00 |
| Purchase (claimable) | 400.00 | 20.00 |
| Expense (claimable) | 100.00 | 5.00 |
| Purchase return | 100.00 | 5.00 |

Expected: Box 1a = 800.00, Box 1b = 40.00, Box 2 = 2,000.00, Box 9b = 25.00, Box 11 = 5.00, Box 12 = 20.00, Box 13a = 20.00, Box 13b = 0.00. Summary: Output 40.00, Input 20.00, Net payable 20.00.

**Fixture B — refundable**
Purchase net 10,000.00 VAT 500.00, no sales. Expected: Box 1b = 0, Box 12 = 500.00, Box 13a = 0, Box 13b = 500.00, Net payable = (500.00) → "Refundable AED 500.00".

**Fixture C — prior-period return (D4)**
Quarter 1: Sale net 1,000 VAT 50. Quarter 2: return of that sale net 1,000 VAT 50, no other activity. Expected Q2: Box 1a = (1,000.00), Box 1b = (50.00), Box 13a = 0, Box 13b = 50.00 refundable.

**Fixture D — isolation**
Tenant X (FrozenHub1) and tenant Y (FrozenHub2), same TRN, different data. Report for X contains zero rows from Y in every output.

Codex must add more fixtures from real-looking data it generates, and compute each expected value by hand in the test comment.

---

## 6. Phases (each ends with a gate; no phase starts before the previous gate is green)

| Phase | Work | Gate |
|-------|------|------|
| 0 | Branch, baseline: build, run full backend + frontend tests, record counts. Write failing tests that reproduce F-01, F-03…F-10 (red first). | Baseline recorded; new tests fail for the right reason. |
| 1 | Tenant isolation: backfill dry-run, remove legacy fallbacks in VAT paths, single tenant-filter helper (F-15, F-16, F-17). | Isolation tests (16–20) green. Zayogya regression green. |
| 2 | Calculation: fix F-02…F-06, F-11, F-13, F-14; add warnings, derived flags, `VatCalculationException`. | Fixtures A–D exact. Date boundary tests green. |
| 3 | Workflow: status machine, snapshot on lock, unique index, locks on returns, audit rows (F-07…F-10, F-25). | Tests 21–26 green. Migration up/down tested. |
| 4 | API contract (§3.1), company/TRN block, PDF endpoint, Excel/CSV fixes (F-19…F-22). | Screen = PDF = Excel = CSV totals on all fixtures. |
| 5 | Frontend rebuild per §3.3 (components, tabs, icons, buttons, mobile cards, acknowledgements, error states, stale-response guard). | Frontend tests + screenshots 360/768/1440 for every tab and state. |
| 6 | Per-tenant provisioning check for Gulf Harvest, FrozenHub1, FrozenHub2 on staging/synthetic: settings, TRN entry, basis (D1), filing type (D2). | Synthetic end-to-end run per tenant. |
| 7 | Full regression, performance, security review, docs update (`STATE.md`, `ERROR-REGISTER.md`, `FINANCE-INVARIANTS.md`), release notes, rollback plan. | Sign-off checklist (§8) complete. |

Performance budget: a 3-month period with 5,000 sales + 2,000 purchases returns in < 3 s; PDF < 8 s; no N+1 (assert query count in a test).

---

## 7. Hard rules

1. Work on the Tier 0 branch (per `docs/plan/IMPLEMENTATION-PROMPT.txt`: `tier0-continuation`; confirm with `git branch`). Never touch `main` or production without Anandu's explicit written approval.
2. No client names, TRNs, or tenant ids hard-coded. Behaviour comes from tenant settings.
3. Never commit a real TRN. Never use the Crystal Freeze TRN anywhere (already forbidden in repo docs).
4. Zayogya behaviour unchanged.
5. Margin VAT scheme remains out of scope.
6. Do not weaken or delete an existing test to get green. If a test is wrong, explain why in the evidence log and fix it with a failing-first replacement.
7. A phase is PASS only with: build output, test counts, screenshots/PDF samples, commit SHA. Skipped PostgreSQL tests = BLOCKED, not PASS (`HEXABILL_TEST_POSTGRES`).
8. Anything needing an accountant's decision (reverse charge boxes, shared TRN, negative adjustments) is recorded under `OPEN` with the safe default, not silently decided.

---

## 8. Release sign-off checklist

- [ ] All fixtures A–D exact in API, PDF, Excel, CSV, UI.
- [ ] Isolation tests green for Gulf Harvest, FrozenHub1, FrozenHub2, Zayogya in every output.
- [ ] Locked period cannot be changed by any write path (sales, purchases, expenses, both returns, payments adjustments).
- [ ] Missing/sample TRN blocks official PDF, Lock, Submit.
- [ ] Mobile 360 px and desktop screenshots of every tab, loading, empty, error, locked states.
- [ ] PDF checked in Chrome, Edge, Adobe, phone; Arabic name renders.
- [ ] Backfill dry-run report reviewed by Anandu before any data migration.
- [ ] Rollback steps written and tested on a staging copy.
- [ ] Accountant review of OPEN items completed before the first real filing.
- [ ] Anandu explicitly approves the deploy.
