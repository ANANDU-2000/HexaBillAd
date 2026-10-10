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
| UX-E01 | P1 | Seven blocks come before the first expense: action row, preset chips, Filters toggle, summary card, Ledger/By category tabs, VAT line, and an "Expenses Ledger" card header. The first record is at 74% (360px) and 73% (768px), with 16–22 controls above it. | `audit-expenses-m360.png`, `audit-expenses-t768.png`; screenshots 161641–161657 | One header (title, total for the period, Add), one compact period selector that opens a sheet, and the list. Move the VAT readiness note into the summary. Remove the nested card. | TODO |
| UX-E02 | P1 | Each expense card on a phone is 217–249px for a single-line expense, so about 3 fit per screen. | `audit-expenses-m360-scrolled.png` | Two-line row: category and note on the left, amount and date on the right; status as an icon with a label. | TODO |
| UX-E03 | P2 | Ordinary expense amounts are shown in danger red. | same | Use the neutral amount colour; reserve red for rejected or over-budget items. | TODO |
| UX-E04 | P1 | Add Expense dialog at 360px: the Save/Cancel footer runs off-screen (button bottom at 805 on an 800px viewport). The two-column grid clips select values ("No categories", "Main Wareho…"). The bottom nav stays mounted underneath (z 50). | `audit-expenses-add-m360.png` | Single column below 480px, a sticky footer inside the sheet, bottom nav hidden while a sheet is open, and fields sized to their expected content. | TODO |
| UX-E05 | P2 | At 360px the "Add expense" label wraps onto two lines and the preset chips clip "Year" at the right edge. | `audit-expenses-m360.png` (empty-period run) | Shorter label or icon + label, and presets inside a scrollable segmented control. | TODO |
| UX-E06 | P2 | At 768px the table clips the VAT column at the right edge, and there are two nested vertical scroll containers (1024/1245 and 960/1215). | `audit-expenses-t768.png`, jsonl `scrollers` | One scroll container. On tablet, drop or merge columns. | TODO |
| UX-E07 | P2 | The empty period shows a large nested card ("Expenses Ledger" > "No expenses in this period."). | `audit-expenses-m360.png` (pre-seed) | A compact empty state with the next action (Add expense, change period). | TODO |
| UX-E08 | — | Suspected from code: the phone list cannot scroll (all ancestors `overflow-hidden`). | Wheel scroll reached the last record at 360 and 390 | — | NOT REPRODUCED |

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

## Next
Phase 2 (implementation) starts only after owner review of this audit. Per the approved session plan, the next task is **Checkpoint 2: P0-02** (false "Under Maintenance" lockout). UX implementation then resumes from UX-S01 (adaptive navigation), followed by the Customers and Customer Ledger rows.
