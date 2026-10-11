# Premium UX Tracker

This is the single active UX tracker, adopted 2026-10-10. Rows from the earlier [UI-TASK-TRACKER.md](UI-TASK-TRACKER.md) and [UI-AUDIT.md](UI-AUDIT.md) remain as history. Open items from those files are re-stated here only when re-verified on the current build. The master task list (P0 and AI phases) is [../plan/AI-ERP-TASK-TRACKER.md](../plan/AI-ERP-TASK-TRACKER.md).

**Statuses:** TODO, IN_PROGRESS, PASS, FAIL, BLOCKED, NOT REPRODUCED.

**Severity:**
- **P0:** blocks a business task, or risks wrong or lost data.
- **P1:** major friction in a daily workflow.
- **P2:** visible inconsistency or wasted space.
- **P3:** polish.

**Design-system authority:** [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md). The older `.cursor/design/HEXABILL-DESIGN-SYSTEM.md` is reference only.

## How this audit was run (Phase 1, 2026-10-10)

**Build and environment**
- Build: branch `uiux-audit-p1` = `origin/main` `c6ba249`. Frontend only; the backend is the same as live `92a5059`.
- Data: local API on 127.0.0.1:5000 over the throwaway SQLite copy `%TEMP%\hexabill-uitest\hexabill-uitest.db`, tenant `gulfharvest`.
- Synthetic data added for this audit: 2 categories and 30 expenses (`UX audit synthetic expense N`). The local tenant also has 9 customers and 2 invoices.
- No production data was used.

**Harness**
- Spec: `frontend/hexabill-ui/e2e/ux-audit.spec.js`.
- Command: `npx playwright test e2e/ux-audit.spec.js --project=m360 --project=m390 --project=t768 --project=d1440 --workers=1` → 28 passed.
- Output (gitignored): `e2e/.shots/ux-audit/<vp>.jsonl` and `e2e/.shots/audit-*.png`.
- **What it measures:** the y-position of the first record, interactive controls above it, row height and buttons per row, the smallest text in the rows, the vertical scroll containers, and the bottom nav. It also checks whether a real mouse-wheel scroll reaches the last record (not a programmatic scroll).

**Not covered by this run**
- Lists with hundreds of rows (local data is small), Arabic/RTL, a real phone keyboard, and touch gestures. Those are still **NOT TESTED**.

**Reference screenshots:** 22 of the 331 images in `HEXABILL IMAGES UI.zip` were mapped to the four target screens. See `docs/plan/UI-SCREENSHOT-INVENTORY.csv`, status `MAPPED_UX_AUDIT_2026-10-10`. Those images date from 2026-09-27 and 2026-10-04, older than the current build. Every row below was re-checked live, and defects that are only in the screenshots are marked as such.

## Baseline metrics (before any redesign)

"First record" is the top of the first data row, given as px from the top of the viewport (and as % of viewport height). "Controls" counts interactive elements above that row.

| Page | 360×800 | 390×844 | 768×1024 | 1440×900 |
|---|---|---|---|---|
| Customers: first record / controls / row height | 552 px (69%) / 13 / 116 px | 552 (65%) / 13 / 116 | 469 (46%) / 13 / 67 | 419 (47%) / 13 / 59, 6 actions per row |
| Billing History: first record / controls / card height | 209 (26%) / 4 / 204 px, 3 buttons | 209 (25%) / 4 / 204 | 240 (23%) / 5 / 65 | 209 (23%) / 5 / 57 |
| Expenses: first record / controls / row height | 593 (74%) / 16 / 249 px | 573 (68%) / 16 / 233 | 752 (73%) / 22 / 41 | 566 (63%) / 22 / 36 |
| Customer Ledger picker: first customer / controls | 399 (50%) / 7 | 399 (47%) / 7 | 248 (24%) / 10 | 226 (25%) / 10 |
| Customer Ledger, customer selected: top of Ledger tab | 577 (72%) | 577 (68%) | 345 (34%) | 281 (31%) |
| Bottom nav height | 65 px | 65 px | none | none |

## Confirmed defects

Evidence images are in `frontend/hexabill-ui/e2e/.shots/`; "screenshot" refers to `HEXABILL IMAGES UI.zip`.

### Customers (`/customers`, `features/customers/CustomersPage.jsx`)

| ID | Sev | Issue (before state) | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| UX-C01 | P1 | At 360px, five stacked sections come before the list: back + subtitle, Refresh + Add, 5 tabs, an "Overdue invoices (Reports)" banner, and a search card with Export/Import/Sort. The first customer starts at 69% of the viewport, so only about 1.5 records are visible above the bottom nav. | `audit-customers-m360.png`; screenshots 2026-10-04 161712–161812 | Compact header: title + count, one full-width search, a filter/sort button that opens a sheet, and Add as the primary action. Move Export/Import and Refresh into an overflow menu. The overdue banner becomes a tab badge. | PASS |
| ↳ fix | | One header card: title + count, **Add** (primary), "…" (Refresh, Export, Import, Overdue report); search + sort on one row; tabs with counts. **After @360: first record 552→247 px (69%→31%), controls above 13→9, row 116→60 px.** @1440 first record 419→267 px. | `e2e/ux-audit.spec.js`, `workflows.spec.js` UX-1 (create customer via UI, persisted via API) | | |
| UX-C02 | P2 | Header content is clipped at the left screen edge at 360px (back arrow, Refresh button, overdue banner), caused by the `-mx-6` header wrapper. | `audit-customers-m360.png` | Use the page's own padding; no negative margins. | PASS |
| ↳ fix | | Removed `-mx-6` header and dashboard back arrow; nothing touches the screen edge @360. | `audit-customers-m360.png` | | |
| UX-C03 | P2 | Desktop rows carry 5 differently coloured action buttons (View, WhatsApp, Statement, Edit, Delete) that compete with the data. | `audit-customers-d1440.png` | One primary row action (open ledger) plus a menu for the rest. Use neutral styling; only Delete is destructive. | PASS |
| ↳ fix | | Desktop rows: Ledger (ghost) + Collect only when owed + "…"; phone rows: name/phone, neutral balance + "Outstanding", one "…". One `customerMenuItems` for both. Fixed: phone menu hid **Delete** from owners (checked `role === "admin"`); now `isAdminOrOwner` like desktop. Positive balances no longer red. | `audit-customers-d1440.png`, e2e | | |
| UX-C04 | P3 | At 1440px, the first record is at 47% of the screen. The overdue banner and search card add about 170px. | `audit-customers-d1440.png` | Put search, filters and actions on one toolbar row. | PASS |
| ↳ fix | | Overdue banner moved into the "…" menu / tab badge; desktop rows 69→59 px. | e2e | | |

### Billing History (`/billing-history`, `features/sales/BillingHistoryPage.jsx`)

| ID | Sev | Issue | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| UX-B01 | P1 | Each invoice card on a phone is 204px tall, with full-width View and a blue Collect on every row, so only about 3 invoices fit per screen. | `audit-billing-history-m360.png`; screenshot 2026-10-04 161424 | Compact row: invoice no. and date on the left, total and status on the right, customer below. Tapping the row opens it. Collect is an inline action only when an amount is outstanding. | PASS |
| ↳ fix | | Phone rows: two lines (number + total; customer + status + date), tap opens the invoice, **Collect only while money is owed**, one "…". **After @360: row 204→60 px; 3 rows per screen → 8+.** Tests: `e2e/billing-history.spec.js` (row height ≤72, Collect exactly on non-paid rows). | | | |
| UX-B02 | P1 | At 360px the search placeholder is clipped ("Invoice #, custor") and the date inputs are clipped, with the calendar icon overlapping the text. | `audit-billing-history-m360.png` | Search goes full width. Dates move into a date-range control (presets plus a custom sheet). | PASS |
| ↳ fix | | Search full width; dates behind a calendar button on phones (summary label), inline from 768px. Nothing clips at 360. | `e2e/billing-history.spec.js` (date range empties a future range) | | |
| UX-B03 | P2 | Status colours: unpaid "Pending" uses danger red and "Partial" uses bright yellow. Red should mean overdue or error, not a normal open invoice. | same | Map status to tokens: Paid = success, Partial = warning, Unpaid = neutral, Overdue = danger. Always pair colour with a text label. | PASS |
| ↳ fix | | `salePaymentSettlement.getInvoicePaymentBadge`: Paid = success, Partial = warning, open ("Pending") = neutral. Red reserved for errors/overdue. Shared with POS/receipt badges, so they change too. | | | |
| UX-B04 | — | Behaviour with many invoices (pagination, scroll) | local data has only 2 invoices | Re-test after seeding synthetic sales | PASS |
| ↳ fix | | 27 synthetic invoices: pagination (10/page, Next), search (server-side, debounced) and date range verified. Found and fixed: the list had no scroll container, so rows below the fold and pagination were unreachable (same class as UX-E08 scroll check). | `e2e/billing-history.spec.js` | | |

### Expenses (`/expenses`, `features/expenses/ExpensesPage.jsx`)

| ID | Sev | Issue | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| UX-E01 | P1 | Seven blocks come before the first expense: action row, preset chips, Filters toggle, summary card, Ledger/By category tabs, VAT line, and an "Expenses Ledger" card header. The first record is at 74% (360px) and 73% (768px), with 16–22 controls above it. | `audit-expenses-m360.png`, `audit-expenses-t768.png`; screenshots 161641–161657 | One header (title, total for the period, Add), one compact period selector that opens a sheet, and the list. Move the VAT readiness note into the summary. Remove the nested card. | PARTIAL |
| ↳ fix 2 | | Filters toggle moved onto the period-chip row (no full-width row); "Average per day" hidden on phones. **First row @360: 66% → 51% (531 → 411 px).** Still above the 35% target: the summary card and Ledger/By-category tabs stack above the list. Next: put the summary totals on the chip row, or move tabs into the card header. | `audit-expenses-m360.png` | `expenses-crud.spec.js` passes after the change | |
| ↳ fix 3 | | Totals and the Ledger / By category tabs share one row. Filters collapse behind the Filters button below 1024px (was 768px), so the tablet form grid no longer sits above the list. Preset chips scroll on one row below 1024px instead of wrapping. Header and gap spacing trimmed. **First record: 360px 411→387 px (51%→48%), 768px 752→498 px (73%→49%), 1440px 566→528 px (63%→59%). Target 35% not met on any width; remaining stack at 360 is the page header (≈81 px), the period chips, the totals row and the Missing VAT banner.** | `audit-expenses-m360.png`, `audit-expenses-t768.png`; `e2e/ux-audit.spec.js` | `ux-audit` expenses 8 passed; `expenses-crud` 3 passed (clean run) | PARTIAL |
| ↳ note | | Mobile rows now sit directly on the page (no nested card), and the "Expenses ledger" heading shows only from md. First row still at 66% @360: the period chips, Filters, summary card and tabs stack above it. Next: fold the summary into the Filters sheet. | `audit-expenses-m360.png` | | |
| UX-E02 | P1 | Each expense card on a phone is 217–249px for a single-line expense, so about 3 fit per screen. | `audit-expenses-m360-scrolled.png` | Two-line row: category and note on the left, amount and date on the right; status as an icon with a label. | PASS |
| ↳ fix | | Mobile row is one compact row: category + date, note, status/branch/quarter, amount + VAT on the right, icon actions. **After @360: row 249→100 px.** | `e2e/expenses-crud.spec.js` (mobile list) | | |
| UX-E03 | P2 | Ordinary expense amounts are shown in danger red. | same | Use the neutral amount colour; reserve red for rejected or over-budget items. | PASS |
| ↳ fix | | Ordinary amounts are neutral text on phones (no red). Status is text (Approved / Pending / Rejected), not colour alone. | | | |
| UX-E04 | P1 | Add Expense dialog at 360px: the Save/Cancel footer runs off-screen (button bottom at 805 on an 800px viewport). The two-column grid clips select values ("No categories", "Main Wareho…"). The bottom nav stays mounted underneath (z 50). | `audit-expenses-add-m360.png` | Single column below 480px, a sticky footer inside the sheet, bottom nav hidden while a sheet is open, and fields sized to their expected content. | PASS |
| ↳ fix | | Add expense form: one column below 640px (no clipped selects), sticky footer with Save and Cancel inside the sheet, submit labelled "Save expense". Test asserts Save is in the viewport at 360. | `e2e/expenses-crud.spec.js` | | |
| UX-E05 | P2 | At 360px the "Add expense" label wraps onto two lines and the preset chips clip "Year" at the right edge. | `audit-expenses-m360.png` (empty-period run) | Shorter label or icon + label, and presets inside a scrollable segmented control. | PASS |
| ↳ fix | | "Add expense" no longer wraps (whitespace-nowrap). | `audit-expenses-m360.png` | | |
| UX-E06 | P2 | At 768px the table clips the VAT column at the right edge, and there are two nested vertical scroll containers (1024/1245 and 960/1215). | `audit-expenses-t768.png`, jsonl `scrollers` | One scroll container. On tablet, drop or merge columns. | PASS |
| ↳ fix | | Route and VAT Period columns are hidden below 1280px, so the table has fewer columns on tablet. The table still scrolls horizontally at 768px (Note, Status and Actions are off-screen). The `scrollers` list at 768 shows the page document plus the sidebar nav (a separate region), not a second list container, so the "two nested scrollers" part was a misread. | `audit-expenses-t768.png` | `ux-audit` expenses (768) | |
| ↳ fix 2 | | Below 1280px the ledger shows the compact list (the same layout as phones), not the 12-column table. The table only renders at 1280px and up. The table needs about 1,290 px, so it could not fit at 768–1024. **768px first record 498→392 px (49%→38%).** The 768px screenshot shows no clipped columns and visible Edit and Delete icons. | `audit-expenses-t768.png` | `ux-audit` expenses 6 passed (m360, t768, d1440); `expenses-crud` (m360, t768 passed; d1440 passed alone, see note) | PASS |
| ↳ follow-up | | Tablet list rows are 96 px tall, close to the phone card size. Brief asks to avoid oversized mobile-style cards on tablet. Candidate: a two-column grid of rows at 768–1279. Not done. | `audit-expenses-t768.png` | — | TODO (P3) |
| ↳ note | | One batch run of `expenses-crud` at d1440 failed at `input[name="amount"]` in the edit dialog (timeout). The same test passed when run alone. Not isolated; not a fixed flake. | `e2e/.results/…d1440/error-context.md` | — | OPEN |
| UX-E07 | P2 | The empty period shows a large nested card ("Expenses Ledger" > "No expenses in this period."). | `audit-expenses-m360.png` (pre-seed) | A compact empty state with the next action (Add expense, change period). | PASS |
| ↳ fix | | Empty period: one line of plain text plus an Add expense button (owners). Shows "for this period" wording. The desktop table's empty row now has the same Add expense button (mobile already had it). | `e2e/expenses-states.spec.js` (empty period at m360/t768/d1440: message + 2 visible Add expense buttons, in viewport at 360) | `expenses-states` 6 passed | |
| UX-E08 | — | Suspected from code: the phone list cannot scroll (all ancestors `overflow-hidden`). | Wheel scroll reached the last record at 360 and 390 | — | NOT REPRODUCED |
| UX-E09 | P1 | When the expense list fails to load, the phone view shows "Expenses could not be loaded." with no recovery action. The desktop view had Retry, but with different wording. | `expenses-crud` m360 failure screenshot (`test-failed-1.png`): message with no button | Same copy on both layouts: "Expenses could not be loaded. Check your connection, then try again." plus a "Try again" button that reloads the list. | PASS |
| ↳ fix | | Mobile error state gained "Try again"; desktop Retry relabelled "Try again" with the shared copy. Verified the failing request was HTTP 429 (see the rate-limit note in the tracker), so the recovery path is the one a user would hit. | `e2e/expenses-states.spec.js` (failure → Try again → list request re-issued) | `expenses-states` 6 passed (m360/t768/d1440) | |
| ↳ env | | Local harness hits the API's global limit (300 requests/min per IP, `backend/HexaBill.Api/Core/Authorization/SecurityConfiguration.cs:254`, skipped only for HTTP integration-test hosts). Repeated Playwright runs produced 429s and intermittent "could not be loaded" failures in `expenses-crud` (3 of the 4 three-viewport runs had one failure; the failing requests were 429; the single-viewport reruns passed). This is a test-environment limit, not a product defect. Production risk: many staff behind one NAT IP share the same limit. Not changed in this checkpoint. | `expenses-crud` failing trace: list GET = 429 | — | OPEN (backend review) |

### Customer Ledger (`/ledger`, `features/customers/CustomerLedgerPage.jsx`)

| ID | Sev | Issue | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| UX-L01 | P2 | Before search the screen shows a back/export/refresh bar, a "Filter:" label and two full-width selects (branch, route). Search sits at about 36% of the screen, and the first customer at 50% (360px). | `audit-ledger-m360.png`; screenshots 2026-09-27 114519, 2026-10-04 161310 | Search first. Branch and route move into a filter chip/sheet that shows the active filters. | PASS |
| ↳ fix | | Picker: search first; branch/route behind **Filters** (active-count badge, stays open while a filter is set); compact Add. Top bar shown on phones only for an open customer; record actions in one "…" (Export/print PDF, Refresh, Reconcile). Removed a dead **Settings** button (no handler), a duplicate Print (same PDF export) and the date/user text. **After @360: first customer 399→149 px (50%→19%), controls 7→3.** | `e2e/ux-audit.spec.js` | | |
| UX-L02 | P1 | After selecting a customer at 360px: 7 colour-coded icon-only buttons (aria-labelled, but no visible text), then dates, branch, route and staff selects. The Ledger tab starts at 72% of the viewport, leaving less than 100px for transactions above the bottom nav. | `audit-ledger-selected-m360.png`; jsonl `/ledger#selected`; screenshots 161319–161335 | Customer summary bar: name, balance, then Collect as primary and More. Move filters into a sheet. Transactions get the main scroll area. | PASS |
| ↳ fix | | Selected customer: name + balance on one row (neutral amount, Dr/Cr), **Receive payment** (labelled primary), **Pay all** only with open invoices, one "…" (Edit, Statement/Pending bills/Full ledger PDF, WhatsApp, Send statement, Refresh, Reconcile). Phones: period/branch/route/staff collapse to a one-line summary + Change; top bar hidden (back in the search row); duplicate name line hidden. Ledger tab: 4 coloured icon buttons → one menu; Paid/Closing no longer green/red. **After @360: Ledger tab 577→296 px (72%→37%).** | `e2e/customers-ledger.spec.js` (6 passed: Pay all, 7 menu items, payment dialog opens, nav hidden), `e2e/ux-audit.spec.js` | | |
| UX-L03 | P2 | The branch select is clipped ("Main Wareho…") and there is a full-width "Add customer" button inside the ledger picker. | same | Size fields to their content; Add customer moves to quick-create. | PASS |
| ↳ fix | | Selects full width on phones in a 2-column grid (no clipping); placeholder shortened (F2 hint in tooltip). | `audit-ledger-selected-m360.png` | | |
| ↳ note | | Add customer now compact (icon on phone). Selected-customer filter row still clips "Main Wareho…" — handled with UX-L02. | | | |

### Daily close (`/daily-close`, `features/dailyClose/DailyClosePage.jsx`)

Local setup (not in source): the page is gated by the tenant feature `daily_close` (`Tenants.FeaturesJson` = `["daily_close"]`, read by `TenantFeatureFlags.IsEnabled`). Without it the page shows "Daily close is not enabled for this workspace". For the synthetic `gulfharvest` tenant (id 5) in `%TEMP%/hexabill-uitest/hexabill-uitest.db` this was set once with a local SQLite update. It is not a production change. Baseline below is with the flag on.

Baseline (360px): 1,574 px page height; "Submit close" at 1,430 px; the bottom navigation covered the lower part of the form.

| ID | Sev | Issue (before state) | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| DC-01 | P1 | The close form ran under the phone bottom navigation. The actions (Refresh expected, Save draft, Submit close) sat at the end of a 1,574 px page, so the user had to scroll to the bottom to close the day. | `e2e/.shots/audit-daily-close-m360.png`; probe: Submit close at y=1,430 | The close task owns the phone screen (`data-shell-hides-nav` on the page root). Actions move into a sticky footer on phones with safe-area padding. From md they sit inline again. | PASS |
| ↳ fix | | `DailyClosePage.jsx`. `daily-close.spec.js` "the bottom nav is hidden and the close actions stay on screen" (m360 passed): nav count 0; after scrolling to the end, Save draft, Submit close and Refresh are in the viewport. | `e2e/.shots/review/daily-close-m360-bottom.png` | | |
| DC-02 | P1 | Save draft and Refresh expected rendered white on white, so they were invisible in the footer. `LoadingButton` always applies its primary variant (`bg-primary-600`, `text-white`) and only appends the page's classes, so the override did not win. | Probe: buttons present with `border-transparent`; screenshot showed only Submit close | On this page, use plain buttons with explicit outline and primary styles, and a pending label ("Saving…", "Submitting…"). Shared `LoadingButton` left unchanged (see DC-04). | PASS |
| ↳ fix | | Footer reviewed in the browser at 360px: refresh icon (44px), Save draft, Submit close (the only green action). | `e2e/.shots/review/daily-close-m360-bottom.png` | `daily-close.spec.js` (m360, t768, d1440) | |
| DC-03 | P2 | Draft persistence: a saved count was not verified after refresh. | Spec: Save draft → POST 2xx → reload → counted cash equals 123.45 | Verified after reload from the server, not from local state. | PASS |
| DC-04 | P2 | Shared `LoadingButton` cannot be restyled from outside: "Add movement" rendered dark slate (`bg-slate-800`) and "Reopen day" amber (`bg-amber-700`), because both the primary fill and the override applied and the CSS order decided the colour. | `daily-close-m360-bottom.png` ("Add movement") | A caller's background class replaces the primary fill. Other classes unchanged. | PASS |
| ↳ fix | | `src/components/Loading.jsx`: `hasBgOverride` drops `bg-primary-600 hover:bg-primary-700` only. 34 uses in 15 files; 9 use a background override, which now behaves deterministically. Regression: `daily-close` and `expenses-crud` (m360, passed). Open design choice: "Add movement" is still a dark secondary, not the blue primary. | | `daily-close.spec.js`, `expenses-crud.spec.js` m360 (3 passed) | |
| DC-05 | P3 | The intro paragraph takes three lines before the first input. The sentence about settlement adjustments is an accounting rule and must stay. | `audit-daily-close-m360.png` | Keep the wording; move the rule next to "Expected in drawer" as a one-line note. | TODO |
| DC-06 | P1 | Close and reopen were not exercised. | — | `e2e/daily-close-close.spec.js` on a past day (2026-10-10) so the other specs are not blocked. | PARTIAL |
| ↳ fix | | Test 1: opening cash set so expected drawer cash is zero; count zero; Submit close → server reports the day closed (`isLocked`) → Reopen with a reason → server reports it open. Test 2: a 5.00 variance with no reason is refused by the server (4xx), the day stays open, and the reason is shown. Reopen keeps the day record with status `Reopened` (not locked). Expected cash for that day with no opening cash is -1,597.50 (cash paid out with no opening balance), so the page cannot record a negative count. | | `daily-close-close.spec.js` (m360, t768, d1440: 4 passed in total on the last run) | |
| ↳ not tested | | Recent closes row details and report links after close, Add movement, Capital and transfers rows, the variance reason saved with a close, and the closed-day notice on a phone. | | — | NOT TESTED |

### Payments (`/payments`, `features/payments/PaymentsPage.jsx`)

Route `/payments` is visible only when `canManagePayments(user)`; other roles are redirected to the dashboard. Audited with one synthetic receipt (the local tenant has one payment). The audit's row measurement needs two or more records, so row density is not measured yet (PY-06).

Baseline (360px): intro text four lines; "Add Payment" and "Bulk Payment" each wrapped onto two lines; Bulk Payment in green as a second primary; customer name touching the amount on rows; search card padded 24px.

| ID | Sev | Issue (before state) | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| PY-01 | P2 | Header actions wrapped: "Add Payment" and "Bulk Payment" each took two lines at 360px, and Refresh was a full text button. | `e2e/.shots/audit-payments-m360.png` (before) | One row on phones: Refresh as an icon-only 44px button, Bulk Payment and Add Payment flex 1 with nowrap labels. From sm the labels return. | PASS |
| ↳ fix | | `PaymentsPage.jsx` header; `e2e/payments-list.spec.js` "phones: Refresh, Bulk Payment and Add Payment share one row" (m360 passed). | `audit-payments-m360.png` (after) | | |
| PY-02 | P2 | Bulk Payment was green (`bg-success`), competing with Add Payment as a second primary. | `audit-payments-m360.png` (before) | Bulk Payment is secondary (outline). Add Payment is the only primary. | PASS |
| ↳ fix | | Asserted in `payments-list` (Bulk Payment background is not primary blue). | | | |
| PY-03 | P2 | On phone rows the customer name ran into the amount ("Walk-in Cafe 500.00 AED" with no gap). | `audit-payments-m360.png` (before) | Name truncates in its own flex column; amount is `shrink-0` nowrap with tabular figures. | PASS |
| ↳ fix | | `payments-list` "a payment row keeps the amount beside a long customer name" (name box ends before the amount box starts). Screenshot after: "gulfharvest Walk-in ..." with the amount clear. | `audit-payments-m360.png` (after) | | |
| PY-04 | P3 | Intro text was 16px and ran to four lines; the search card had 24px padding on phones. | `audit-payments-m360.png` (before) | Intro 14px on phones (16px from sm). Search card 12px padding on phones. The business rule text (cleared payments only; cheques) is kept. | PASS |
| PY-05 | P3 | Desktop search stretched across the whole filter card (about 930px). | `audit-payments-d1440.png` (before) | Bounded at 26rem (416px) from sm, per the desktop search guidance. | PASS |
| PY-06 | P1 | Payment create, edit and void were not exercised end to end. | — | `e2e/payments-crud.spec.js`: create through the modal (customer with an outstanding balance, amount 30–40% of it) → API read-back → refresh → edit amount -10% and reference → API read-back → refresh → void → API status VOID. | PARTIAL |
| ↳ fix | | Passes at 360, 768 and 1440 (1 test each). Rule found: a customer payment must reference an outstanding invoice; the API refuses on-account payments (`Customer has no outstanding invoices...`), so the test selects a customer with a balance. Edit and void are both confirmed in the API, not by toast. Edit and void buttons are icon-only with a `title` (accessible name from title); no aria-label. | `payments-crud.spec.js` | `payments-crud` 3 passed (m360, t768, d1440) | |
| ↳ not tested | | Bulk Payment, cheque clearing and cheque status, invoice allocations across several invoices, receipts and print, role restriction for non-payment roles, and row density with two or more receipts (the audit needs two rows). | | — | NOT TESTED |

### Receipts (no `/receipts` route; lives on `/payments`, `components/ReceiptPreviewModal.jsx`)

Route discovery: `App.jsx` has no receipts route. Receipts are a selection and preview on the Payments page: row checkbox, a selection bar with "Generate Receipt", a row "Print payment receipt" action, and the preview modal (Download PDF, Print receipt, Close). Eligibility (`utils/receiptEligibility.js`): cleared incoming payments in cash, cheque, online or debit only; not refunds, returns or settlement adjustments. Server rules match.

Local setup (not in source): PDF download needs the tenant flag `receipt_snapshots` (`Tenants.FeaturesJson` = `["daily_close","receipt_snapshots"]` for the synthetic tenant id 5 in the UI-test DB). Without it a receipt is reconstructed from current records and the preview says it was "reconstructed... original company and invoice details were not saved".

| ID | Sev | Issue (before state) | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| RC-01 | P2 | A combined receipt for two cash payments printed "Payment Method: Multiple". The label was hard-coded for every combined receipt. | `e2e/.shots/…` preview text; `PaymentReceiptService.cs` (`combined.PaymentMethod = "Multiple"`) | One method when every payment in the batch uses the same one; "Multiple" only for a mixed batch. | PASS |
| ↳ fix | | `PaymentReceiptService.cs`: distinct methods in the batch decide the label. Backend tests first: `CombinedReceipt_SameMethodForEveryPayment_ShowsThatMethod` (failed before the fix) and `CombinedReceipt_MixedMethods_ShowsMultiple`. `dotnet test --filter PaymentReceiptTests` → 41 passed; `--filter Receipt` → 77 passed, 8 skipped (PostgreSQL-only, see below). | `PaymentReceiptTests.cs` | `receipts.spec.js` asserts `Payment Method: CASH` and no "Multiple" (m360, t768, d1440: 2 passed each) | |
| RC-02 | P1 | Batch selection total, preview amounts and the server PDF were not verified together. | — | Select two cleared cash payments, check the selection total equals their sum, Generate Receipt → preview total → Download PDF returns `%PDF` with the `application/pdf` type and a non-empty body. | PASS |
| ↳ fix | | `e2e/receipts.spec.js` "select cleared payments, total is right, server returns the receipt PDF". Fixtures are two cash payments created through the API for a customer with a balance. | | `receipts.spec.js` (m360, t768, d1440) | |
| RC-03 | P2 | A voided payment should not offer a receipt. | — | Row has no receipt checkbox after void. | PASS |
| ↳ fix | | `receipts.spec.js` "a voided payment cannot get a receipt". Skips when no voided payment exists (the payments CRUD spec creates one). | | `receipts.spec.js` | |
| RC-04 | P2 | Tenants without the `receipt_snapshots` flag get a receipt number with no saved snapshot and no PDF download. The preview says so, and only "Print receipt" remains. This is a product decision (owner): enable the flag per tenant, or accept print-only receipts for those tenants. | `ReceiptPreviewModal.jsx` (Download only when `isHistoricalSnapshot`); `PaymentsController.cs` returns 409 "Use Print for this copy" | Owner decision. Do not change silently. | OPEN (decision) |
| RC-05 | — | Not tested: "Print receipt" (opens a print window and writes the HTML receipt), receipt history on the customer ledger, the flag-off (legacy) preview state, multi-customer rejection message, print layout with tenant branding, and Arabic text in the receipt. | — | Add a print-window check and a flag-off fixture. | NOT TESTED |
| RC-06 | — | Backend PostgreSQL-only tests were skipped locally: `HttpIsolationPostgreSqlTests` (`PostGenerateReceipt_Fin06…`, `ReceiptPreviewThenPdfDownload_OnPostgreSql`, `GetCustomerReceipts_CrossTenant…`). No disposable PostgreSQL is configured on this machine. | `dotnet test` output: 8 skipped | Provide a disposable PostgreSQL connection string for the test run. | BLOCKED (environment) |

### Bulk payments (Payments page, `Bulk Payment Entry` dialog)

Rows of customer, amount, method, date and reference; "Add Another Payment"; "Save All Payments (n)". A failed row pauses the batch with "Saved bulk payments: x of n confirmed" and "Retry remaining payments (k)". The client retries a keyed POST itself once (same `Idempotency-Key`); the server then returns 201 without a duplicate, so a pause shows only if the retry also fails.

| ID | Sev | Issue (before state) | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| BP-01 | P3 | Saving a row without a customer showed "Please select a customer or an invoice." The bulk dialog has no invoice field, and the bulk check's own message ("Select a customer for every bulk payment.") never appeared. | Probe and `bulk-payments.spec.js` before the fix | Check the customer before the draft builder runs, so the bulk message shows. | PASS |
| ↳ fix | | `PaymentsPage.jsx` `saveBulkPayments`: customer check first. `bulk-payments` "a row without a customer is refused before anything is saved": no POST sent, message shown, dialog kept open with its data. | | `bulk-payments.spec.js` (m360, t768, d1440) | |
| BP-02 | P1 | Two customers saved in one batch: the test had not verified it through the API. | — | Save two rows, check the batch message, then read back each payment through the API (one per row, right customer and amount) and refresh. | PASS |
| ↳ fix | | `bulk-payments` "two customers saved together, confirmed through the API". | | | |
| BP-03 | P1 | When a row fails, the batch must pause without losing the other row, and a retry must not duplicate the row that succeeded. | — | Fail the second row (including the client's own keyed retry) until released; wait for the enabled "Retry remaining payments (1)"; release the failure; click Retry; API shows exactly one payment per row. | PASS |
| ↳ observed | | Without the hold, the client's own keyed retry succeeded about 1 s after the 500 and the batch finished without the pause. That is the designed behaviour (keyed writes), and no duplicate was created. | probe log | `bulk-payments` "a failed row pauses, then resumes…" | |
| BP-04 | — | Test data: the bulk and receipt specs pay down the local customer balances. Specs now use small amounts (10–21 AED) and customers with a balance above 60. When balances run out, the specs report that no customer has enough balance. | — | Re-create balances on the synthetic tenant (or add an invoice fixture) before a long run. | OPEN (test data) |
| BP-05 | — | Not tested yet: cheque and online rows (reference required), an invoice-linked bulk row, pause after the page is reloaded (saved batch restored from local storage), and the "Resume bulk payments" button. | — | Add a reload-during-pause test and a cheque-reference validation test. | NOT TESTED |

### Purchases (`/purchases`, `features/purchases/PurchasesPage.jsx`)

Audited at Checkpoint 5 (2026-10-10) with 12 synthetic purchases and 2 synthetic suppliers seeded into the local tenant (`seed-purchases` script, local API only). Create, edit, delete and pay were **not** exercised in this checkpoint, so they stay NOT TESTED.

Baseline (before): first record 360px **823 px (103%, below the fold)**, row 410 px with 5 buttons; 768px 593 px (58%), row 205 px; 1440px 372 px (41%), row 106 px.

| ID | Sev | Issue (before state) | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| PU-01 | P1 | At 360px the filter block (search, Status, Period, Category, Export, Clear) is always expanded, about 360 px tall, before the status tiles and the list. | `audit-purchases-m360.png` (before) | Filters behind one Filters button below 1024px, with an active-filter count (same pattern as Expenses). | PARTIAL |
| ↳ fix | | Filters collapse below 1024px (`purchase-filters`, `aria-expanded`, count badge). **360px first record 823→491 px (103%→61%).** Target 35% not met; the remaining stack is the header (about 70 px), the Filters button, the status tiles and the Purchase List title row with its two buttons (VAT Return and the bulk "Mark all with VAT as claimable"). | `audit-purchases-m360.png` | `e2e/purchases-list.spec.js` "filters sit behind one button" (m360, t768 passed) | |
| PU-02 | P1 | Each mobile purchase card is 410 px tall: a 6-field detail grid and 4 buttons are always visible. | `audit-purchases-m360.png` (before) | Compact two-to-three-line row (invoice and total, supplier and date with status, due amount). Items, details and actions appear when the row opens. | PASS |
| ↳ fix | | Rows are 86 px with one button each. Items, details and actions (Pay supplier, Supplier ledger, Edit, Delete) appear on expand. Mobile and tablet use the compact list below 1280px (same breakpoint as Expenses). | `audit-purchases-m360.png`, `audit-purchases-t768.png` | `e2e/purchases-list.spec.js` "a purchase row stays compact and opens" (m360, t768 passed) | |
| PU-03 | P2 | Overdue 0 and Unpaid 12 were red, and the Pending amount was amber. Red appeared for an ordinary open balance and for a zero count. | `audit-purchases-m360.png` (before) | Red only for overdue items that exist. Unpaid and Pending are neutral. Partial stays amber. | PASS |
| ↳ fix | | `statusChip` tone and Pending amount changed. Test asserts the Overdue count is not red when there are none. | | `e2e/purchases-list.spec.js` "overdue is red only when overdue purchases exist" (m360, t768, d1440 passed) | |
| PU-04 | P2 | "Add Supplier" and "New Purchase" wrapped onto two lines at 360px. | `audit-purchases-m360.png` (before) | Keep both labels on one line (`whitespace-nowrap`). | PASS |
| PU-05 | P1 | When the list request fails, the page shows "No purchases found. Create your first purchase to get started." with a toast that disappears. A failed load looks like an empty business. | Code: `loadPurchases` catch → `toast.error` only; empty branch unconditional | Persistent error in the list card with "Try again" and the same wording on every width. Empty-state text is hidden while the error shows. The list keeps its last rows. | PASS |
| ↳ fix | | `listError` state, `role="alert"` banner, `loadPurchases()` retry, empty branches gated by `!listError`. Test asserts the alert and Try again on a 500, the request re-issued on retry, rows return, and no "No purchases found". | | `e2e/purchases-list.spec.js` "a failed load shows an error" (m360, t768 passed; d1440 passed on a clean run). Trace showed a 429 on one retry from the local per-IP limit, see Expenses ↳ env | |
| PU-06 | P2 | Desktop: money values wrapped ("AED" on a second line), invoice numbers split across two lines, and ordinary amounts were coloured (Total green, Paid blue, Balance amber, VAT orange, discount purple). | `audit-purchases-d1440.png` (before) | Numbers never wrap (`whitespace-nowrap tabular-nums`). Ordinary amounts neutral. | PASS |
| ↳ fix | | Desktop cells changed (invoice, subtotal, VAT, total, discount, paid, balance). | `audit-purchases-d1440.png` (after) | `ux-audit` purchases 1440 (run passes); screenshot reviewed | |
| PU-07 | P2 | Desktop: 4 action buttons wrapped into two rows, so each row was 106 px. | `audit-purchases-d1440.png` (before) | Actions on one line (`flex-nowrap`, `whitespace-nowrap`). | PASS |
| ↳ fix | | Desktop row 106→59 px. | `audit-purchases-d1440.png` (after) | `ux-audit` purchases 1440 | |
| PU-08 | P2 | Desktop rows showed 4 buttons (Pay, Ledger, Edit, Delete). The brief asks for one primary row action and a menu for the rest. | `audit-purchases-d1440.png` | One primary action (Pay supplier, shown only when money is owed) plus a "…" menu (Supplier ledger, Edit purchase, Delete purchase). | PASS |
| ↳ fix | | `OverflowMenu` (shared, keyboard support) on each desktop row. Row controls 4→2, row height 59→55 px. Smallest text in rows is still 10.5 px on desktop (UX-S06, open). | `audit-purchases-d1440.png` | `e2e/purchases-crud.spec.js` (opens the menu, edits, deletes via menu items) | |
| PU-09 | P3 | The phone list header wraps: the "Purchase List" title, the VAT Return link and the bulk "Mark all with VAT as claimable" banner each take a row (about 110 px). Bulk-claim wording is also awkward. | `audit-purchases-m360.png` | Move VAT Return to the page header or menu. Rephrase the bulk action (copy review). | TODO |
| PU-10 | P1 | Purchase create, edit, delete and pay were not exercised end to end. | — | Workflow test with API read-back after each save, and a refresh check, at each width. | PARTIAL |
| ↳ fix 2 | | `e2e/purchases-crud.spec.js` is viewport-aware now. Passed at 360, 768 and 1440 (2 tests each, 6 total): mobile form (item card labels) and desktop form (item table) for create and edit; mobile row expand and desktop row menu for edit and delete; pay from either list. Not yet reviewed visually on the mobile form (no screenshot review). | | `purchases-crud` 6 passed (m360, t768, d1440) | PARTIAL |
| ↳ fix (desktop, Checkpoint 6) | | `e2e/purchases-crud.spec.js` (desktop 1280px+): create through the form (supplier, invoice, product, qty 5 × 20) → API total 105.00 → refresh → edit qty to 6 → API total 126.00 → refresh → delete via menu and confirm → API null and gone from list. Pay supplier from a row → URL carries the amount → save → POST supplier payment → API supplier net payable reduced by that amount. **Not tested:** the same flows on mobile (the mobile form and item list), print and export, VAT toggles, supplier auto-registration modal, and payment allocation to a specific invoice (payments go to the oldest bills first). Persistence is read through the API, not by querying the SQLite file. | `e2e/.results` (not kept) | `purchases-crud` 2 passed (d1440, clean run) | PARTIAL |
| PU-12 | P2 | The Pay supplier link puts the amount and the invoice number in the URL (`?recordPayment=1&amount=…&ref=…`). These can end up in history, logs and referrers. The brief says sensitive data must not go in URLs. | `openPay` in `PurchasesPage.jsx` | Pass the amount and reference through router state (location.state) instead of the query string, and keep the URL to the supplier name. | PASS |
| ↳ fix | | `openPay` passes `{ payment: { amount, reference } }` in router state. `SupplierDetailPage` applies it once and then replaces the history entry with state cleared. The URL is `/suppliers/<name>` only. Removed the unused `useSearchParams` import. | `SupplierDetailPage.jsx` | `e2e/purchases-crud.spec.js` pay test asserts the URL has no `amount=`, `ref=` or `recordPayment` and that the amount is filled (3 widths passed) | |
| PU-11 | P3 | UX copy: row buttons renamed "Pay supplier" and "Supplier ledger" (was "Pay" and "Ledger"). Filter and tile labels were unchanged. | `purchases-list.spec.js` names | Keep consistent with the glossary when the copy review runs. | PASS |
| PU-13 | P1 | On phones the inline purchase form ran under the bottom navigation. The fixed nav sat under the form's Cancel and Save bar. The shell hides the nav for routes, sheets and dialogs, but this form is inline, so the rule did not apply. | `e2e/.shots/review/purchase-form-m360.png` (before) | Mark the inline panel with `data-shell-hides-nav`; `useOverlayOpen` treats it like a dialog. | PASS |
| ↳ fix | | `useShellChrome.js` selector plus the `PurchasesPage.jsx` form container. `purchases-list` "the purchase form hides the bottom nav" (m360, passed). | | | |
| PU-14 | P3 | The main purchase form labels (Supplier Name, Invoice No, Purchase Date, Expense Category, Add Product) were not linked to their inputs, so screen readers did not announce them. | Code: label siblings without `htmlFor` | Link each label to its input with `htmlFor` and `id`. | PASS |
| ↳ fix | | `purchases-list` asserts `getByLabel` for four of them. | | | |


### Suppliers (`/suppliers`, `features/purchases/SuppliersPage.jsx`)

Baseline (Checkpoint 5): 360px first record 295 px (37%), row 136 px with 1 button; 1440px first record 249 px (28%), desktop row with 3 icon buttons.

| ID | Sev | Issue (before state) | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| SU-01 | P1 | "Include deactivated" did nothing. The summary endpoint only returned active suppliers, and the DTO hard-coded `IsActive = true`, so a deactivated supplier never came back and never showed "Deactivated". | `SupplierService.GetAllSuppliersSummaryAsync` (`s.IsActive` filter); `e2e/suppliers-list.spec.js` "add supplier -> persisted -> deactivate" failed at the toggle step | Add an opt-in `includeInactive` query flag (default false, so existing callers are unchanged). Report each row's real `IsActive`. The page sends the flag and reloads when the toggle changes. | PASS |
| ↳ fix | | `backend/HexaBill.Api/Modules/Purchases/SupplierService.cs`, `SuppliersController.cs`; `frontend/hexabill-ui/src/services/index.js`, `SuppliersPage.jsx`. Backend test `GetAllSuppliersSummary_DeactivatedSupplier_HiddenByDefaultAndListedWhenIncluded` added to `tests/HexaBill.Tests/tenancy/SuppliersHttpIsolationTests.cs`. | | `dotnet test --filter SuppliersHttpIsolationTests` → 7 passed, 0 failed (new test included; it fails on the old code because the flag was ignored). Browser: `suppliers-list` 2 passed (m360, d1440). | |
| SU-02 | P2 | At 360px the search was about 210 px wide, so its placeholder was clipped ("Search name or pho"). It shared a row with two checkboxes. | `audit-suppliers-m360.png` (before) | Search takes the full width. The two checkboxes go on their own row below 768px and share the row from 768px. | PASS |
| ↳ fix | | Placeholder shortened to "Search suppliers". `suppliers-list` asserts the search is at least 280 px wide at 360px. A desktop regression (first record 249→287 px) was caught in the audit and fixed. | `audit-suppliers-d1440.png` | | |
| SU-03 | P2 | Each mobile supplier card had a full-width "More" button, which opened Edit and Deactivate in a second row. The card was 136 px. | `audit-suppliers-m360.png` (before) | One "…" menu in the card header (shared `OverflowMenu`). Edit supplier, then Deactivate supplier (danger, after a separator). | PASS |
| ↳ fix | | Card 136→108 px, 1 control. Menu hidden for roles without `canManage`, as before. | `audit-suppliers-m360.png` (after) | `suppliers-list` "search uses the full width and each card has one actions menu" | |
| SU-04 | P2 | Desktop rows had three icon buttons (Open, Edit, Deactivate). The row and the eye button both carried the label "Open <name>". | `audit-suppliers-d1440.png` (before) | Keep the eye icon for Open. Move Edit and Deactivate into the same "…" menu used on phones. | PASS |
| ↳ fix | | Row controls 3→2 (eye and "…"). The desktop test uses the first visible row. | `audit-suppliers-d1440.png` (after) | `suppliers-list` at d1440 (2 passed) | |
| SU-05 | P3 | The intro text under the title wrapped to three lines at 360px beside the refresh and Add buttons. | `audit-suppliers-m360.png` | Shorter helper text on its own full-width line on phones; beside the title on desktop. | PASS |
| ↳ fix | | Phones: "Find a supplier and open its ledger." is one line under the header row. Desktop: same text beside the title (no extra height). | `audit-suppliers-m360.png`, `audit-suppliers-d1440.png` | `suppliers-list` (m360, t768, d1440) | |
| SU-06 | P2 | First record at 360px was 295 px (37%, target 35%). Search, the two checkboxes and the intro text stacked above the list. | `audit-suppliers-m360.png` (before) | One row on phones: search plus an icon-only Filters button (44px, active count on the icon and in its name). The checkboxes open in a panel below. | PASS |
| ↳ fix | | First record 360px 295→257 px (37%→32%), controls 5→4. Desktop 249→238 px (28%→26%). Phone search row: search flex 1, 44px trigger. Asserted by `suppliers-list` "first supplier record starts in the upper part of a 360x800 phone" (≤35%). | `audit-suppliers-m360.png` (after) | `suppliers-list` m360 (4 passed) | |
| SU-07 | P1 | Supplier edit and the statement PDF were not verified. Edit could lose typed input: the form loads the saved details after it opens, and a late load overwrote the user's entries (SU-09). | — | `e2e/suppliers-edit-statement.spec.js`: edit phone and address from the list, read back through the API, restore the original values; statement PDF from the ledger's Ledger tab. | PARTIAL |
| ↳ fix | | Passes at 360, 768, 1440 (edit and statement at each width; the loading regression at 1440). Not yet covered: credit limit, payment terms, the Bills and Paid tabs, deactivate and reactivate from the ledger, share. | | `suppliers-edit-statement` 6 passed (m360, t768, d1440) | |
| SU-09 | P1 | Supplier edit overwrote the user's input. The form fetched the saved details after it opened and replaced every field, so anything typed before the response arrived was lost. | `SuppliersPage.jsx` `openEditModal` (setEditForm after await) | While the details load, the fields and Save are disabled and "Loading supplier details" is shown. | PASS |
| ↳ fix | | `SuppliersPage.jsx`: `editLoading` flag; fields inside a disabled fieldset until the load finishes. Regression holds the details response, checks the fields and Save are disabled, then releases it and checks the values show. | | `suppliers-edit-statement` "fields are disabled while the saved details load" (d1440 passed) | |
| SU-08 | P3 | Supplier ledger header clipped the supplier name at 360px ("UX Audit ..."), so the open account could not be read in full. | `e2e/.shots/review/supplier-ledger-m360.png` (before) | Let the ledger title wrap (no truncation). | PASS |
| ↳ fix | | `SupplierDetailPage.jsx` title `truncate` → `break-words`. `suppliers-list` asserts the heading has the full name and no horizontal clipping. Ledger tabs (Ledger, Bills, Paid) still not exercised. | | `suppliers-list` "supplier ledger header shows the full supplier name" (m360, d1440 passed) | |


### Shared shell and navigation

| ID | Sev | Issue | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| UX-S01 | P1 | The bottom nav (65px) shows on every phone route, including the POS workspace (under the checkout bar) and while the Add Expense dialog is open. There is no virtual-keyboard handling in the app (no `visualViewport` / `interactive-widget`). | `audit-pos-m360.png`, `audit-expenses-add-m360.png`; `components/BottomNav.jsx`, `Layout.jsx:550` | Adaptive nav: show it on browse routes, hide it on POS, create/edit forms, open sheets and when the keyboard is open. Document the decision in DESIGN-SYSTEM.md. | PASS |
| ↳ fix | | `navigation/quickCreate.js` (`shouldShowBottomNav`), `hooks/useShellChrome.js` (keyboard via `visualViewport`, `aria-modal` observer), `Layout.jsx`, `BottomNav.jsx`; POS/Purchases fixed bars use `--hb-bottom-nav-h`. Hidden on `/pos`, `*/new|edit|create`, `/returns/create`, open dialogs/sheets, keyboard. POS checkout now at the bottom edge (was 65px up). | `tests/quickCreate.test.js`, `e2e/shell-navigation.spec.js` (m360/t768/d1440) | | |
| UX-S02 | P2 | Duplicate navigation: the top hamburger (`Layout.jsx:352`) and the bottom "More" (`BottomNav.jsx:80`) open the same `MoreMenuSheet`. | code | Keep one entry point per breakpoint. | PASS |
| ↳ fix | | Hamburger renders only where the bottom nav (with More) is hidden, e.g. POS and forms. | `e2e/shell-navigation.spec.js` asserts 0 "Open menu" on /customers @360 | | |
| UX-S03 | P2 | Three scroll models: viewport-shell routes, inner `overflow-auto`, and SuperAdmin document scroll. This produces nested vertical scrollers at 768px on Customers (2) and Expenses (2). | jsonl `scrollers` | One primary scroll container per page. | TODO |
| UX-S04 | P2 | Shared primitives are barely used. `<Button>` appears only in `DashboardTally.jsx` and the dev page, and `PageHeader` only on `/__design`. There are 964 raw `<button>` elements in 96 files and 43 hand-written `fixed inset-0` overlays in 22 files. | grep counts in [PAGE-INVENTORY.md](PAGE-INVENTORY.md) | Adopt the primitives page by page during the Phase 2 rework; no global CSS patch. | TODO |
| UX-S05 | P2 | No quick-create. The Sale pill is the only create shortcut, and `QuickActionsPanel.jsx` is dead code. | code | One role-filtered `+` action sheet (Invoice, POS, Purchase, Expense, Receive payment, Customer, Product). | PASS |
| ↳ fix | | `components/QuickCreate.jsx`: phone sheet from bottom-nav **+ New**, top-bar **New** menu from 768px. Role-filtered (`getQuickCreateActions`, same rule as routing; server still authorizes). Create forms open via `?new=1` (`hooks/useCreateIntent.js`) on Customers, Expenses, Products, Purchases. Receive payment → Customer Ledger; Pay supplier → Suppliers (both need a counterparty first). | `tests/quickCreate.test.js` (staff filtering), e2e deep links ×3 routes | | |
| UX-S06 | P3 | Smallest text in rows is 10.5px on desktop and 11px in phone expense/ledger rows. | jsonl `minFontInRows` | Secondary text at least 12px on phone and 12px on desktop, at token contrast. | TODO |
| UX-S07 | P2 | The POS toolbar uses one-off brown, purple and grey icon buttons. | `audit-pos-m360.png` | Use the token button variants. | TODO |
| UX-S08 | P3 | The desktop sidebar truncates the tenant name ("GULF HARVEST G…"). | `audit-customers-d1440.png` | Two-line name or a short brand name from tenant settings. | TODO |

## Checks that passed

- No page-level horizontal overflow on any of the five audited routes at 360, 390, 768 or 1440px.
- A wheel scroll reaches the last record on every audited list.
- Every icon-only button on the selected Customer Ledger screen has an aria-label or title.

## Coverage totals (route level)

Source: [COVERAGE-MATRIX.md](COVERAGE-MATRIX.md), generated from `App.jsx`.

- Discovered routes: 62 = 5 public (login, signup, Admin26, onboarding, error page) + 45 app pages (tenant, shared, profile/more) + 10 SuperAdmin + 2 redirects (`/`, `/recurring-invoices`).
- Verified locally with an interaction test: 5 routes (`/login`, `/billing-history`, `/customers`, `/ledger`, `/expenses`).
- Layout sweep only: 10 routes.
- Not verified: 45 routes.
- Nested tabs, subtabs, forms, modals and drawers: **not yet inventoried**, so no totals are reported for them.

## Next
Status as of Checkpoint 3 (2026-10-10). P0-02 is PASS on code (production rollback still owner-blocked, see [AI-ERP-TASK-TRACKER.md](../plan/AI-ERP-TASK-TRACKER.md)). UX-S01, UX-S02, UX-S05 and the Customers / Customer Ledger / Billing History rows are PASS in this table.

Still open in this table, in order:
1. **UX-E01** (Expenses, PARTIAL): first record is still 48% at 360px (target 35%). The phone decision is open: keep the period chips for quick switching, or move them into the Filters sheet as the audit proposed. UX-E06 is PASS (tablet uses the compact list).
2. **UX-S03** (one scroll model per page), **UX-S04** (adopt shared primitives), **UX-S06** (secondary text below 12px), **UX-S07** (POS toolbar buttons), **UX-S08** (sidebar tenant name).
3. Modules not yet audited at the nested-interface level: POS, Purchases, Suppliers, Payments, Daily Close, Inventory, Routes, VAT, Dashboard/Reports, Staff, Settings, SuperAdmin, PWA, AI. Use [COVERAGE-MATRIX.md](COVERAGE-MATRIX.md) for the route list.

### Authentication (`/login`, `auth/Login.jsx`)

Finding: every other browser spec signs in by writing the token into local storage (`signIn` in `e2e/session.js`). Before this checkpoint no spec used the login form, so the login blocker class was untested in the browser.

| ID | Sev | Issue (before state) | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| AU-01 | P1 | No browser test of the login form (wrong password, empty submit, correct login, logout). | `session.js` `signIn` writes localStorage | `e2e/auth-login.spec.js`: wrong password is reported and no session is stored; email kept; empty submit shows what is missing; correct password reaches `/dashboard`; logout returns to `/login` and clears the token. Phones sign out from the More sheet; desktop from the account menu. | PASS |
| ↳ fix | | Test only (no application change). Message text is matched by pattern (incorrect / invalid / wrong / required). | | `auth-login.spec.js` (m360, t768, d1440: 9 passed in total on the last run) | |
| AU-02 | — | Not tested: disabled account, expired session, password change, permission change, subdomain resolution for a second tenant, lockout after repeated wrong passwords. | — | Add with synthetic accounts per tenant (owner, staff, disabled). | NOT TESTED |

### Products (`/products`, `features/products/ProductsPage.jsx`, `ProductDetailPage.jsx`)

Create uses the `Add product` form (`components/ProductForm.jsx`, named fields). Desktop and tablet rows carry Edit, View, Print barcode, Adjust stock, Stock history and Deactivate. Phone cards carry View and Edit only. Deactivate needs the typed word DEACTIVATE.

| ID | Sev | Issue (before state) | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| PR-01 | P2 | Phones could not deactivate a product: the phone card has no Deactivate, and the detail page had Edit, Adjust stock and Full history only. Owners on phones had no way to hide a product from POS. | `products-crud.spec.js` phone run: card buttons View and Edit only | Owners and admins get Deactivate (typed DEACTIVATE) and Activate on the product detail page, the same confirmation as the list. | PASS |
| ↳ fix | | `ProductDetailPage.jsx`: `changeStatus` (deactivate uses the same delete endpoint as the list; activate uses the activate endpoint), a confirmation with the typed word, and a reload from the API after success. Hidden for roles that cannot manage products. | | `products-crud.spec.js` phone run deactivates from the detail page (m360 passed) | |
| PR-02 | P1 | Product create, edit and deactivate were not verified against the database. | — | `e2e/products-crud.spec.js`: create through the form (SKU, name, cost, sell price) → API read-back → list refresh → edit sell price 20.00 → 22.75 → API read-back → deactivate with the typed word → product read by id shows inactive. | PASS |
| ↳ fix | | Test only. The list hides inactive products, so the test reads the product by id. | | `products-crud.spec.js` (m360, t768, d1440: 3 passed) | |
| PR-03 | — | Not tested: Activate from the list or detail page, unit conversion, barcode print, categories, product import, pagination, price list, long Arabic product names. Stock adjustment is covered below (SA-01 to SA-02). | — | Next: price list, categories, barcode print. | NOT TESTED |
| SA-01 | P1 | Stock adjustment without a reason: the browser's own tooltip blocked the submit (native `required` on the reason field), so the app's message ("Please provide a reason for the stock adjustment") never appeared. | `stock-adjust.spec.js` before the fix | Remove the native `required` and keep `aria-required`, so the app's message is shown. Nothing is sent without a reason. | PASS |
| ↳ fix | | `StockAdjustmentModal.jsx`. The test checks the message, and that no adjust-stock request was sent. | | `stock-adjust.spec.js` (m360, t768, d1440: 3 passed in total on the last run) | |
| SA-02 | P1 | Stock adjustments were not confirmed against the database, or in the history. | — | `e2e/stock-adjust.spec.js`: create a product through the API, add 5 with a reason (server stock 5), remove 2 with a reason (server stock 3), then both reasons appear on the stock history page. | PASS |
| ↳ not tested | | Negative stock beyond zero, adjustments on several branches, stock alerts below reorder level, and the history filters. | | — | NOT TESTED |

### POS checkout (`/pos`, `features/sales/pos/PosEnterprisePage.jsx`)

Layouts: wide layouts (desktop and tablet here) use `Add Row` (opens the product drawer) and `Save Invoice`. Phones use `Add Product to Bill` (same drawer) and `Checkout`, then `Save & Generate Invoice` in the payment sheet. The product drawer lists each product as a button (name, price, stock). Saving posts to `/api/sales` with an external reference for duplicate protection.

| ID | Sev | Issue (before state) | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| PS-01 | P1 | POS checkout was not verified against the database. The total on the cashier's screen was never compared with the stored sale. | — | `e2e/pos-checkout.spec.js`: open the product drawer, pick a product, read the grand total from the screen, save, then read the sale by id from the API and compare totals. | PASS |
| ↳ fix | | Test only. Passes at 360 (phone path), 768 (wide path on tablet) and 1440 (wide path). | | `pos-checkout.spec.js` (m360, t768, d1440 passed) | |
| PS-02 | P1 | Stock after a sale and a double click on save were not verified. A double click on a financial save must not create two sales. | — | `e2e/pos-stock-duplicate.spec.js`: stock drops by the sold quantity (API before and after); a double click sends one sale request and gets one successful response. | PASS |
| ↳ fix | | Test only. Passes at 360, 768 and 1440 (4 passed at 360 and 768; 2 at 1440). | | `pos-stock-duplicate.spec.js` | |
| PS-03 | — | Not tested: cart quantity changes, discounts, customer selection for credit sales, payment split, cash drawer effects, returns, hold and resume, invoice print and delivery note, and the saved invoice in Billing History. | — | Next: credit sale and payment, then Billing History. | NOT TESTED |

### Staff accounts (`/users`, `pages/company/UsersPage.jsx`)

Owners and admins manage staff here. Add User (Name, Email, Password, Role, Phone) posts to `/api/users`. Delete is refused for a user with transactions ("Consider deactivating instead"). Login refuses an inactive user (`AuthService.cs`), but no screen or update call sets a user inactive: `UpdateUser` does not write `IsActive`, and the UI has no status control.

| ID | Sev | Issue (before state) | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| ST-01 | P1 | A staff member with any transaction cannot be removed or disabled from the product. The API refuses delete and says "Consider deactivating instead", but there is no deactivate control and the update call does not set the active flag. A former employee keeps the ability to sign in (until their existing sessions expire). | `UsersController.cs` DeleteUser; `UpdateUser` (no `IsActive`); `UsersPage.jsx` (no status control) | Owner decision needed first: how a disabled account is treated (revoke existing sessions at once, or only refuse new logins), and who may disable whom. This changes access control, so it is not implemented in this session. | BLOCKED (security decision) |
| ST-02 | P2 | Staff accounts are capped by the plan. The Add User message is accurate ("Staff limit reached for this company. No new user was created."), but the cap also limits test data: leftovers from failed runs block later runs. | Live API response (400) during tests | Test data cleanup before each staff test (only accounts with the test prefixes). Owner to confirm the plan's limit for production. | PASS (message); test data handled |
| ST-03 | P1 | Owner creates a staff account through the form and the role is stored; a staff user with no transactions can be removed; a staff login cannot open Add User. | — | `e2e/staff-users.spec.js`: create via the form (name, email, password, role Staff) → API read-back of the role → delete with the typed DELETE word → gone from the API. Staff login (API sign-in as that user) → `/users` shows no Add User and no Users heading. | PASS |
| ↳ fix | | Test only. Desktop row button is "Delete User"; phone card button is "Delete". | | `staff-users.spec.js` (m360, t768, d1440: 6 passed in total on the last run) | |
| ST-04 | — | Not tested: Edit user, Reset password, job titles and permissions, branch and route assignment, the activity log and online status, session revocation, and password change by the user. | — | Add after ST-01 is decided. | NOT TESTED |

### Settings (`/settings`, `features/settings/SettingsPage.jsx`)

Company tab: company name (English, Arabic), VAT TRN (15 digits), corporate tax TRN, address, phone, email, invoice header style. Saves go to `PUT /api/settings`; single keys to `PUT /api/settings/{key}`.

| ID | Sev | Issue (before state) | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| SE-01 | P1 | The header "Save Changes" button (shown once something changed) did nothing. It sat above the form element, so its submit never reached the form, and no request was sent. A user who clicked it would believe the change was saved. | `settings-company.spec.js` (no PUT sent; the bottom button worked) | Connect the header button to the form with the `form` attribute; the form has an id. | PASS |
| ↳ fix | | `SettingsPage.jsx`: `<form id="settings-form">` and `form="settings-form"` on the header button. Test clicks the header button and checks the server value, then reloads. | | `settings-company.spec.js` "company name: saved, read back through the API and after a reload, then restored" (m360, t768, d1440 passed) | |
| SE-02 | P2 | VAT TRN validation was not verified: a value that is not 15 digits must be refused next to the field, with no request sent. | — | Enter 12345 → Save Settings → message "VAT TRN must contain exactly 15 digits" next to the field, no PUT, stored TRN unchanged. | PASS |
| ↳ fix | | Test only. `settings-company.spec.js` "VAT TRN: a value that is not 15 digits is refused…" (m360, t768, d1440 passed). | | | |
| SE-03 | — | Not tested: the other settings tabs (billing, email, notifications, backup), the Arabic company name round trip, logo upload, invoice header style, and whether a saved company name appears on printed documents. | — | Next: printed document header check with the saved company name (print PDF of an invoice), then the other tabs. | NOT TESTED |

### VAT return (`/vat-return`, `features/reports/VatReturnPage.jsx`)

The draft return ("Return boxes (draft — not FTA mapping)") comes from `GET /api/reports/vat-return?from&to`. The page reads each box by its API name (`box1a`, `box1b`, `box9b`, `box13a`, `box13b`, and so on).

| ID | Sev | Issue (before state) | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| VR-01 | P1 | The draft boxes showed 0.00 for Box 1a, 1b, 9b, 13a and 13b while the API returned the real figures (Box 1a: 2815.67 from the API, 0.00 on the screen). The response converter camel-cased `box1a` to `box1A`, so the page found no value under the name it reads. | `vat-return.spec.js` failed before the fix (Box 1a: 0.00 vs 2815.67). Cause: `services/api.js` `transformResponseKeys` ran `camelcaseKeys` with no exclusion. Only these five properties in the API have a digit followed by a lowercase letter (`DTOs.cs`, `VatReturnPeriod.cs`). | Keep keys that have a digit followed by a lowercase letter as the API sends them (`exclude: [/\d[a-z]/]`). Every other key still converts. | PASS |
| ↳ fix | | `services/api.js`: the exclusion applies only to those keys. Checked: no frontend code reads the old `box1A` or `box13B` spelling. | | `vat-return.spec.js` "draft boxes on screen equal the backend figures for the same period" (m360, t768, d1440: 3 passed) | |
| VR-02 | — | Not tested: other periods (only the suggested period is checked), a period with no data, VAT figures on the Reports pages, any export or print of the return, and FTA mapping (the page labels the draft as not FTA mapping). | — | Next: a second period with data and a period with no data. Filing and FTA mapping stay out of scope until the owner asks for them. | NOT TESTED |

### Reports: aging (`/reports`, Customer Aging and AP aging tabs, `features/reports/ReportsPage.jsx`)

Both tabs read `GET /api/reports/aging` and `GET /api/reports/ap-aging` for the page's as-of date (today by default). The cards are 0-30, 31-60, 61-90 and 90+ days, plus Total Outstanding.

| ID | Sev | Issue (before state) | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| AG-01 | P1 | The 0-30 card showed AED 0.00 and 0 invoices (suppliers on AP aging) while the API had the amounts: today Customer Aging 0-30 is 2283.20 (27 invoices) and AP aging 0-30 is 3437.70 (2 suppliers). The Total Outstanding card was right. The response converter renamed `bucket0_30` to `bucket030` (and `bucket31_60`, `bucket61_90` likewise), so the page read nothing. The `|| 0` fallback hid it. | `reports-aging.spec.js` with the previous converter rule: "0-30 Days amount on screen: Expected 2283.2, Received 0". The converter output was checked with `camelcase-keys` in node. | Keep keys with an underscore before a digit as the API sends them: `exclude: [/\d[a-z]/, /_\d/]` in `services/api.js` (the same change that fixed VAT-01). Other keys still convert. | PASS |
| ↳ fix | | `services/api.js`. The test checks every card on both tabs against the API (amount and count), and the Total Outstanding card. Limit: on this tenant only the 0-30 bucket has invoices today, so 31-60, 61-90 and 90+ are compared as zero. | | `reports-aging.spec.js` (Customer Aging and AP Aging; m360, t768, d1440: 6 passed) | |
| AG-02 | P1 | Historical aging is wrong. The calculation does not exclude invoices dated after the as-of date: for as-of 2026-06-30 all 27 invoices (dated 2026-10-04) have days overdue -96 and are counted in 0-30. Balances also use today's payment status, not the status on that date. Every past date tried (2026-06-30 to 2026-10-01) returns the same figures. The page invites users to "Set a past date to see historical aging". | API read with `asOfDate=2026-06-30`. `ReportService.cs` `GetAgingReportAsync`: `daysOverdue = (asOfDate - InvoiceDate).Days` with no date filter. | Owner decision first: this changes a financial formula. Minimum fix: skip invoices dated after the as-of date. Whether balances should be rebuilt from payments up to that date is a separate decision. Not changed in this session. | OPEN (owner decision) |
| AG-03 | P2 | The "Export Excel" button on Customer Aging only shows "Aging report export coming soon". | `ReportsPage.jsx` Customer Aging export handler (`showToast.info('Aging report export coming soon')`). | Implement the export, or hide the button until it exists. Owner to choose. | OPEN |
| AG-04 | — | Not tested: the customer and supplier filters, drill-down from a card, the historical as-of dates (until AG-02 is decided), and the export files. | — | After AG-02. | NOT TESTED |

### Reports: summary (`/reports`, Summary tab, `features/reports/ReportsPage.jsx`)

The four cards read `GET /api/reports/summary` for the date range the page shows (From Date and To Date).

| ID | Sev | Issue (before state) | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| RP-01 | P1 | The summary cards (Total Sales, Total Purchases, Total Expenses, Net Profit) were not verified against the API. On the range shown when this was checked, Total Sales was 2956.45 AED and Net Profit -1154.25 AED. | `reports-summary.spec.js` reads the range from the page's own date inputs, calls the API for that range, and compares the four cards. | Test only. No change needed. | PASS |
| ↳ fix | | Test only. The expected values are non-zero, so an empty or misplaced card fails the test. | | `reports-summary.spec.js` (m360, t768, d1440: 3 passed) | |
| RP-02 | P3 | The API names these fields `salesToday`, `purchasesToday`, `expensesToday` and `profitToday`, but they sum the selected date range (`ReportService.cs`, `GetSummaryReportAsync`). The values are correct; the names mislead anyone who reads the code. | `ReportService.cs` lines 136-180 | Rename in a later cleanup, together with the page and the test. Not changed here. | NOTE |
| RP-03 | — | Not tested: the staff view (the controller clears `ProfitToday` on one path, `ReportsController.cs` around line 1307), the branch and route filters, the PDF export, and the other tabs (Sales, Product Analysis, Net sales, Returns, Customers, Overdue, Outstanding, Collections, Credit notes, Expenses, Branch, Route, Branch P&L, Damage, Staff, Cheque, P&L). | — | Next: Sales tab and Product Analysis totals against the API, then the staff view. | NOT TESTED |

### Reports: sales (`/reports`, Sales tab, `features/reports/ReportsPage.jsx`)

The tab loads `GET /api/reports/sales` for the page's date range, page 1 only, with `pageSize: 100`. The charts and the invoice list are built from the rows it receives.

| ID | Sev | Issue (before state) | Evidence | Proposed solution | Status |
|---|---|---|---|---|---|
| SL-01 | P2 | The Sales tab shows at most the first 100 invoices of the range. The response has `totalCount`, but the tab never reads it, so a range with more than 100 invoices shows incomplete charts and an incomplete list, with no warning. The summary cards are not affected (they come from the summary API). | `ReportsPage.jsx` Sales load (`page: 1`, `pageSize: 100`, `salesData = salesResponse.data.items`); charts use `reportData.sales` (around lines 1539 and 1586). Not reproduced on this tenant: the range has 38 invoices. | Fetch every page (or show "Showing 100 of N" with paging) and make the charts use the full set. Decide which first, since it changes the tab's data flow. | PASS |
| ↳ fix | | `ReportsPage.jsx` Sales load reads every page (100 per request, cap 50 pages = 5000 invoices). Past the cap the table header says "Showing the first N of M invoices". Noted: the tab fires its load twice on open (pre-existing, not changed). | | `reports-sales.spec.js` mocked 250-invoice range lists 250 rows, pages 1–3 requested (m360, t768, d1440; 6 passed in total, run twice) | |
| SL-02 | P2 | The Sales Details table had not been compared with the API. | — | `reports-sales.spec.js`: the table has one row per invoice the API returns for the range (38 here), and each row's total and paid amount equal the API's. | PASS |
| ↳ not tested | | The Sales tab charts, the status and customer filters, and the phone layout beyond the horizontal scroll. | | — | NOT TESTED |

- Test added with SL-02: `reports-sales.spec.js` (m360, t768, d1440: 3 passed). It fails if a range holds more than 100 invoices, until SL-01 is decided.
