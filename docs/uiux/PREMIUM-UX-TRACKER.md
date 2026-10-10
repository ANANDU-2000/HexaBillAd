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
| PU-08 | P2 | Desktop rows still show 4 buttons (Pay, Ledger, Edit, Delete). The brief asks for one primary row action and a menu for the rest. Smallest text in rows is 10.5 px (UX-S06). | `audit-purchases-d1440.png` | One primary action (Pay when owed) plus a "…" menu. Text 12 px minimum. | TODO |
| PU-09 | P3 | The phone list header wraps: the "Purchase List" title, the VAT Return link and the bulk "Mark all with VAT as claimable" banner each take a row (about 110 px). Bulk-claim wording is also awkward. | `audit-purchases-m360.png` | Move VAT Return to the page header or menu. Rephrase the bulk action (copy review). | TODO |
| PU-10 | — | Create, edit, delete, pay, supplier selection, VAT calculations, print and export on this page were not tested in Checkpoint 5. | — | Verify each with synthetic data in a later checkpoint, with DB persistence checks. | NOT TESTED |
| PU-11 | P3 | UX copy: row buttons renamed "Pay supplier" and "Supplier ledger" (was "Pay" and "Ledger"). Filter and tile labels were unchanged. | `purchases-list.spec.js` names | Keep consistent with the glossary when the copy review runs. | PASS |

### Suppliers (`/suppliers`)

Baseline only (Checkpoint 5, same seeded data): 360px first record 295 px (37%), 5 controls, row 136 px with 1 button; 768px 296 px (29%); 1440px 249 px (28%). Not yet audited beyond the baseline. Supplier create, edit, ledger and payments are TODO.

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
