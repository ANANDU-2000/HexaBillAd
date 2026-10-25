# HexaBill UI/UX Fix Plan and Design System, 25 Oct 2026

Companion to `UIUX-ISSUE-REGISTER-2026-10-25.md`. Every row ID here (UIX-, SYS-) refers to that register.

**Authority:** `docs/uiux/DESIGN-SYSTEM.md` is the design authority. The older `.cursor/design/HEXABILL-DESIGN-SYSTEM.md` is reference only. Where this plan and DESIGN-SYSTEM.md disagree, DESIGN-SYSTEM.md wins, and this plan should be corrected.

**Tracker:** all work is tracked in `docs/uiux/PREMIUM-UX-TRACKER.md`.

---

## 1. Goal and non-goals

**Goal.** A business user can trust what the screen says, can find the next action without reading, and can use every page at 360 px and at 1440 px without sideways scrolling or clipped text. A super admin can see the platform state without seeing noise or dangerous controls next to ordinary ones.

**Non-goals (this pass):**
- No change to VAT, invoice, payment, stock, or numbering logic. The only backend changes allowed are error wording and the logo-load path, and each one needs a test.
- No dark mode (DS-12 stays blocked).
- No login redesign. It has its own spec in DESIGN-SYSTEM.md.
- No POS rebuild. Only token and copy changes reach POS.
- No AI ERP work.

---

## 2. What is wrong, in one table

| Area | Problem | Register rows |
|---|---|---|
| Trust | VAT page and Worksheet disagree | UIX-001 |
| Safety | SQL console in main nav; server guard unverified | UIX-002 |
| Safety | Error logs flooded by logo image requests; toasts on every super admin page | UIX-003, UIX-004, UIX-024 |
| Safety | Dangerous controls with no confirmation, or in the wrong place | UIX-005, UIX-006, UIX-007 |
| Audit | UI telemetry written to the business audit log | UIX-008 |
| Dates | UTC day used for defaults; years-wide default ranges | UIX-013, UIX-014 |
| Copy | Placeholders shipped as features; developer wording | UIX-015 to UIX-021, UIX-028 |
| Icons | Money icon on non-money items; shared icons; History as "delete" | UIX-025, UIX-026 |
| Money and dates | Two money formats; no shared date helper | UIX-027, SYS-03 |
| Layout | Clipped tabs, fixed-width filters, tables off-screen, dropdown overlap | UIX-029 to UIX-036 |
| System | 699 raw palette classes; 142 arbitrary sizes; 37 `min-h-screen`; decoration | SYS-01, SYS-02, SYS-04, SYS-05 |

---

## 3. Design system decisions

These apply DESIGN-SYSTEM.md. Only new decisions are listed. Where a rule already exists, the plan points to it.

### 3.1 Colour: one palette, status means status

Tokens are the only colour source. Mapping for the codemod (SYS-01):

| Raw class | Use instead | Why |
|---|---|---|
| `red-*` | `error` (`bg-error-bg`, `text-error-fg`, `border-error-border`, solid `bg-error`) | Danger, overdue, loss |
| `amber-*`, `yellow-*`, `orange-*` | `warning` | Attention, partial, low stock |
| `green-*`, `emerald-*` | `success` | Paid, posted, profit |
| `sky-*`, `cyan-*` (notices) | `info` | Neutral notices and tips |
| `blue-*` for notices | `info` | Blue on actions stays `primary` (S2-1 already did this) |
| `indigo-*`, `purple-*`, `violet-*`, `fuchsia-*`, `pink-*`, `rose-*`, `teal-*`, `lime-*` | `primary` if it is an action, `neutral` if it is decoration | No new hues. Super admin included (SYS-06) |
| `slate-*`, `zinc-*`, `stone-*`, `gray-*` | `neutral-*` | Already done for `gray-*` |
| Charts | Chart tokens only (`--chart-1` to `--chart-6`) | DESIGN-SYSTEM.md §1 |

Colour means status. Owed or overdue amounts use `amount-negative`. Received or credit amounts use `amount-positive`. Ordinary totals stay `text-text-primary`. Never colour alone: pair it with a word or icon.

Dark mode stays off. The codemod must not add `dark:` variants.

Exceptions: print and PDF stay black on white (DESIGN-SYSTEM.md §17). They are server-side and out of scope here.

### 3.2 Type and numbers

Use the scale in DESIGN-SYSTEM.md §2 exactly. Three rules are enforced by tests:
- No text below 11px. `text-micro` (11px) is the floor, and only for bottom-nav labels and key hints.
- Amounts, quantities, dates and invoice numbers use `tabular-nums` and align right.
- Amounts are never truncated. They wrap or the row gets wider. They do not get `…`.

### 3.3 Money display (UIX-027, OD-1)

One helper: `formatMoney(amount, currency)` in `utils/currency.js`.
- Prefix form: `AED 594.00`. The currency code comes from the tenant setting (`useBranding().currency`), not a hard-coded "AED".
- Two decimals. Negative values keep the minus sign.
- Values are not recalculated. The helper only formats what the API returns.
- `formatBalance` (Dr and Cr) is replaced by plain words (UIX-028, OD-4).

Snapshot tests for: 0, 1, 1234.5, −7.29, a large value, and a null.

### 3.4 Dates (UIX-014, OD-2)

- API calls send `YYYY-MM-DD` from `localDateString()` only. Never `toISOString().slice(0, 10)` for a local day.
- Display in tables and filters: `dd/mm/yyyy` (default, OD-2). One helper: `formatDate(ymd)` in `utils/`.
- Native `<input type="date">` shows the browser's own format. If OD-2 is "dd/mm/yyyy everywhere", the display either uses a text field with a mask, or a small formatted label beside the native picker. Choose one and record it.
- Default ranges: current month to date (UIX-013, OD-3). The "All dates" preset stays explicit.
- Saved ranges (Expenses) are keyed by tenant and expire after 30 days.

### 3.5 Icons (UIX-025, UIX-026)

- Lucide only. One icon per nav ID. A unit test fails if two nav items share an icon.
- Money icon (`Banknote`, `Coins`, `Wallet`) only on amounts and money pages. Never on a PDF, a report name, a settings tab or a feature flag that is not about money.
- Destructive actions use `Trash2` with the `error` tokens. `History` means history only.
- Warnings use `AlertTriangle`. Information uses `Info`.
- Icon sizes from DESIGN-SYSTEM.md §3.

Proposed changes for the duplicates (pick unique Lucide icons; the test enforces the rule):

| Nav ID | Now | Proposed |
|---|---|---|
| `users` (tenant) | `Shield` | `UserCog` |
| `sa-settings` | `Shield` | `SlidersHorizontal` |
| `suppliers` | `Building2` | `Factory` |
| `sa-tenants` | `Building2` | keep |
| `billing-history` | `History` | keep (only use of History for navigation) |
| Destructive "Clear" buttons | `History` | `Trash2` |
| "Pending bills PDF", "Outstanding Bills" | `DollarSign` | `FileText` / `Receipt` (report icons) |

### 3.6 Copy (the rules and the dictionary)

Rules:
- Sentence case. No exclamation marks. Name the object and the amount where it helps.
- Errors say what happened and what to do. Include a Retry button when a retry makes sense.
- Never show: "API", "backend", "endpoint", "claim", "token", "ID" (except in a URL), "Resource", "tracking", "stock units", "paired", "not yet implemented", "coming soon", "use API", raw JSON, raw exception text.
- Never describe an unbuilt feature inside the product. Hide it.

Dictionary (from → to):

| From (seen in screenshots) | To |
|---|---|
| "Email functionality is not yet implemented…" | Tab hidden (OD-10) |
| "Enable email notifications (Coming soon)" | Removed with the tab |
| "Create form coming soon. Use API for now." | Removed. Button hidden until built |
| "export coming soon" toast | Button hidden until built |
| "A paired PC saves the scheduled copy." | "Automatic copy to a computer: not set up." |
| "Device / folder: No PC connected" | "Computer: not set up" |
| "Available: 3.00 stock units; required: 5.00 stock units" | "Only 3 Carton of Basmati rice in stock. This sale needs 5." |
| "Filtered to product ID 135" | "Showing movements for Basmati rice 5 kg" (with a clear control) |
| "Resource not found" + "No activity recorded" | "No activity yet." (empty state). Real errors get a real message |
| "1 bills", "1 items" | "1 bill", "2 bills" (pluraliser) |
| "Vat tracking.tracking panel", "Page VatReturn" | Not written to the audit log at all (UIX-008) |
| "Dr: 1,200.00 AED" / "Cr:" | "Owes you 1,200.00 AED" / "You owe 1,200.00 AED" (OD-4) |
| "Net VAT payable −7.29 AED" | "Refund due 7.29 AED" (OD-8, accountant sign-off) |
| "Action filter: backend matches action text…" | Removed |
| "Failed to retrieve logo data URI" | Not shown (silent background call, UIX-004) |
| "This page could not load" | "Could not load purchases. Try again." + Retry |
| "Impersonate" | "Open read-only support" (OD-6) |
| "Clear all data" (Profile) | Removed from Profile. Settings only: "Delete sales, purchases and expenses. Keep products and customers." |
| "9 AM - 6 PM GST" | "9 AM to 6 PM, UAE time" |
| "Email support: hexastack78@gmail.com" | The one support contact (OD-7) |

### 3.7 Layout and responsive rules

- **Shell owns height.** Pages do not use `min-h-screen`. There is one vertical scroll, on `main`. Nested page scroll is not allowed (SYS-05, DESIGN-SYSTEM.md §8).
- **Filters.** No fixed-width fields (`w-36` and similar). Use flexible fields with a minimum width. Desktop: one row. Tablet: wrap to two rows. Phone: stacked, full width.
- **Presets and chips.** At least 32px tall on desktop, 44px on phones. Text 12px minimum.
- **Tabs.** `whitespace-nowrap`. The tab row scrolls sideways on phones. A tab never clips its own label (UIX-029).
- **Tables.** Below 768px: cards (`ModernTable mobileCards`) or a contained scroll with a sticky first column for wide financial grids (DESIGN-SYSTEM.md §7). The page never scrolls sideways.
- **Status cells.** Use `Badge`. Never a bare `span` that can clip (UIX-032).
- **Dropdowns.** Render above the table layer with the `z-dropdown` token, and flip when there is no room (UIX-034).
- **Breakpoints.** Test at 360, 390, 768, 1024 and 1440 (DESIGN-SYSTEM.md §15). Add 1280 where a page changes at that width.

### 3.8 Super admin (platform)

- Label "Platform" in the shell, never tenant names or tenant chrome.
- No second hue (SYS-06). Primary actions use `primary`. Destructive actions use `error` and a typed confirmation.
- Dangerous controls:
  - Maintenance Mode: a switch, a confirmation that names the impact, and a banner while it is on (UIX-006).
  - Read-only support session: a clear name, a reason field, and the audit row shown after it starts (UIX-005).
  - SQL console: moved under Infrastructure, behind re-auth, not in the main nav, and removed if the server guard cannot be verified (UIX-002, OD-5).
- Error logs group by signature (path + code) with a count. Critical events show the count of distinct issues, not the count of repeats (UIX-003, UIX-024).
- Health counts are defined (active, total, test tenants excluded or not) before the number is shown (UIX-023).

### 3.9 States

From DESIGN-SYSTEM.md §10 and §11:
- Loading: skeletons that match the final layout. Refresh keeps old data on screen and shows a small spinner.
- Empty: `EmptyState` with one next action. Never a bare "No data".
- Error: `ErrorState` with plain words and Try again. Never raw text from the server.
- Toasts: only to confirm a completed action. Never for background failures (UIX-004).

---

## 4. Phases and exit gates

Each phase is a separate branch and PR, so each one can be reverted alone. Sizes: S (under half a day), M (one to two days), L (more). These are estimates, not commitments.

### Phase 0: Safety and trust (behaviour changes; no redesign)

| Row | Change | Size |
|---|---|---|
| UIX-002 | Verify the server guard for the SQL console first. Then move it under Infrastructure, behind re-auth, or remove it | M |
| UIX-003 | Load logos through the authenticated client (`Logo.jsx` pattern) or a public logo URL. Map 401 to auth, not GENERAL-ERROR | M |
| UIX-004 | Add a `silent` option to background API calls. Use it for branding and logo | S |
| UIX-005 | Rename "Impersonate" to the read-only support label (OD-6). Primary colour | S |
| UIX-006 | Maintenance Mode: switch, confirm, banner | S |
| UIX-007 | Remove Profile danger card. Settings is the only place. Icon `Trash2` | S |
| UIX-008 | Stop writing UI telemetry to the audit log. Keep real audit rows | M |
| UIX-009 | Remove dead "Live Chat" and the personal Gmail once OD-7 is answered. The dead link can go now | S |
| UIX-014 | Replace UTC defaults with `localDateString()` in six places | S |
| UIX-001 | Backend: find and fix the VAT window or source issue. Add a test that VAT equals Worksheet for the same invoice window. UI does not change in this phase | L (backend) |

**Exit gate (all must hold):**
1. As a super admin, loading Dashboard, Tenants, Settings and Error Logs produces zero toasts and zero `/api/storage` 401s in Error Logs.
2. SQL console: either the server guard is proven by a test, and the page sits under Infrastructure, or the page is removed. Record which.
3. Maintenance Mode cannot be turned on without a confirmation step.
4. Profile has no destructive control.
5. A VAT page visit adds no audit row named "tracking" or "Page".
6. With the clock faked to 2026-10-25T00:30+04:00, the agreement, quotation and salary certificate editors default to 2026-10-25.
7. UIX-001: the VAT backend test status is recorded in the tracker, whether it passes or fails. VAT sign-off stays BLOCKED until it passes.

### Phase 1: Design foundation (presentational)

| Row | Change | Size |
|---|---|---|
| SYS-01 | Palette codemod with the §3.1 mapping. Allowlist charts and print | L |
| SYS-03 | `formatMoney`, `formatDate`, `pluralise` helpers. Lint rule: no new `toLocale*` or `Intl` outside `utils/` | M |
| UIX-027 | Money prefix (after OD-1). Replace the 16 literal `AED` prefixes in POS legacy with the helper | M |
| UIX-028 | Balances in plain words (after OD-4) | S |
| UIX-025, UIX-026 | Icon map, uniqueness test, destructive icon | S |
| SYS-04 | Remove decorative gradients and heavy shadows. Cards use borders | M |
| SYS-06 | Super admin indigo to primary | S |

**Exit gate:**
- Grep gate: no raw palette class outside the allowlist.
- Grep gate: no `toLocale*` or `Intl` outside `utils/`.
- Grep gate: no `text-[9px]`, `text-[10px]` or `text-[13px]`.
- Snapshot tests for `formatMoney`, `formatDate`, `pluralise` pass.
- Icon uniqueness test passes.

### Phase 2: Lists, filters and responsive

| Row | Change | Size |
|---|---|---|
| UIX-013 | Default ranges to current month (after OD-3). Saved range keyed by tenant | M |
| UIX-011 | Dashboard attention rows: pluraliser, currency in the amount slot, helper on its own line | S |
| UIX-012 | VAT net wording (after OD-8). Numbers unchanged | S |
| UIX-029 | Tabs: nowrap, scroll, no clipped labels | S |
| UIX-030 | Price list to cards below 768 | M |
| UIX-032 | Route status to `Badge`, nowrap | S |
| UIX-033 | Email column: min width, truncate with title | S |
| UIX-034 | Product picker dropdown above the table | S |
| UIX-035 | Date filter row: no fixed widths, 32px chips, one date control | M |
| UIX-036 | Super admin tenant list: cards below 768, pinned name column on desktop | M |
| SYS-02 | Review each arbitrary size class in tables, filters and modals. Keep touch targets | M |
| SYS-05 | Remove `min-h-screen` from pages. Shell owns height | M |

**Exit gate (Playwright, five widths, every touched route):**
- No page-level horizontal scroll.
- No clipped tab labels (`scrollWidth` equals `clientWidth` on each tab).
- Tables below 768px render as cards or a contained scroll with a sticky first column.
- Date filter row: at most two rows at 768px.
- No nested vertical scroll (the existing nested-scroll metric from UX-3).

### Phase 3: Copy and content

| Row | Change | Size |
|---|---|---|
| UIX-015 | Hide Email and Notifications tabs (OD-10). Remove "coming soon" toasts and "use API" line. Hide unbuilt export buttons | S |
| UIX-016 | Backup copy per dictionary | S |
| UIX-017 | Stock error wording in backend (message only), with a test | S |
| UIX-018 | Product name in stock history, ID stays in URL | S |
| UIX-019 | Empty and 404 handling after repro | S |
| UIX-020 | Super admin audit: humanised details, raw JSON behind "View raw", developer note removed | S |
| UIX-021 | Feature flag names and help text | S |
| UIX-022 | Announcement date label matches the field (OD-2) | S |
| UIX-024 | Critical events grouped by signature | M |
| UIX-039 | Sales Ledger explanation moved to a tooltip, or removed | S |
| UIX-040 | Server error page: plain words and one way back | S |

**Exit gate:**
- Copy test: no forbidden word from §3.6 appears in user-visible strings (a grep over `src`, excluding comments and tests).
- Toast list: a scripted run of each page that shows zero "coming soon", zero "not yet", zero raw exception text.

### Phase 4: Verify first (repro before fix)

These rows may already be fixed or may be data issues. Each one ends as FIXED, NOT REPRODUCED, or BLOCKED.

| Row | What to reproduce |
|---|---|
| UIX-010 | Purchases "could not load": which request fails and why |
| UIX-019 | "Resource not found": which request returns 404 |
| UIX-023 | Health "Companies" count: definition, then the number |
| UIX-031 | Invoice action grid on phone |
| UIX-033 | Email column wrap in Customers |
| UIX-037 | Create Company footer visibility |
| UIX-038 | Company phone field clip at 360 and 768 |

### Phase 5: Gates and evidence

- Playwright at 360, 390, 768, 1024 and 1440 for every route touched in phases 0 to 4.
- Accessibility check (UX-8: axe, no serious or critical issues) on touched routes.
- Before and after screenshots, synthetic data only, in `docs/uiux/evidence/2026-10-25/`. Keep screenshots free of personal data.
- Update `docs/uiux/PREMIUM-UX-TRACKER.md`. Each row gets a status and an evidence path.

---

## 5. Owner decisions (with defaults)

| ID | Question | Default if no answer | Blocks |
|---|---|---|---|
| OD-1 | Money format: prefix or suffix | Prefix (`AED 594.00`) | UIX-027 |
| OD-2 | Date display | `dd/mm/yyyy` in tables and filters | UIX-022, UIX-035, SYS-03 |
| OD-3 | Default date range on Ledger, Reports, Expenses | Current month to date | UIX-013 |
| OD-4 | Balance wording | Plain words, Dr and Cr in a tooltip | UIX-028 |
| OD-5 | SQL console | Move under Infrastructure, behind re-auth. Remove if the guard cannot be verified | UIX-002 |
| OD-6 | Name of the read-only support action | "Open read-only support" | UIX-005 |
| OD-7 | Support email, phone and hours | Use `SUPPORT_EMAIL`. Owner supplies the details. Dead and personal contacts removed | UIX-009 |
| OD-8 | VAT net wording | "Payable" when positive, "Refund due" when negative, accountant to confirm | UIX-012 |
| OD-9 | First day of "Week" | Leave as is (recorded in DESIGN-SYSTEM.md) | none |
| OD-10 | Unbuilt tabs | Hidden until built | UIX-015 |

---

## 6. Blockers

- **UIX-001 (VAT data).** Blocks any VAT screen sign-off and UIX-012. The UI cannot fix a backend data mismatch.
- **UIX-002 (SQL console guard).** Blocks keeping the console in any form until the guard is verified.
- **UIX-023 (health counts).** Blocks the Health number until the definition is agreed.
- **OD-7 (support contact).** Blocks the final Help page copy.

---

## 7. Test plan

**Unit tests (Vitest):**
- `formatMoney`, `formatDate`, `pluralise`, `formatBalance` replacement: snapshot tests (§3.3, §3.4).
- Icon uniqueness across the nav catalogue (`navigation/moreMenuConfig.js`).
- `localDateString` used for every default date (fake clock at 00:30 UAE).
- Copy dictionary test: forbidden words absent from user-visible strings.
- Backend: VAT total equals Worksheet total for the same invoice window (UIX-001). Stock message wording (UIX-017).

**Playwright (new spec `e2e/uiux-2026-10-25.spec.js`, five widths):**
- No page-level horizontal scroll on every touched route.
- Tab labels not clipped.
- Tables below 768 render as cards or a contained scroll.
- Super admin: zero toasts after load; zero `/api/storage` 401s in Error Logs.
- Maintenance Mode requires confirmation.
- Profile has no "Clear all data".
- Date filter row: at most two rows at 768.
- Product picker dropdown sits above the table at 1024.

**Grep gates (run in CI or as a script):**
- No raw palette class outside the allowlist.
- No `toLocale*` or `Intl` outside `utils/`.
- No `text-[9px]`, `text-[10px]`, `text-[13px]`.
- No `min-h-screen` outside the shell and error screens.
- No `toISOString().slice(0, 10)` for a local day.
- No forbidden copy in user-visible strings.

**Test data:** local tenants only (gulfharvest, frozenhub1, frozenhub2), per the existing tracker. No production data, no production writes, no deploy.

---

## 8. Risks and rollback

| Change | Risk | Mitigation | Rollback |
|---|---|---|---|
| UIX-003 logo loading | Logo stops showing if the authenticated path breaks | Test on both tenant and platform hosts; keep the data URI path | Revert the phase 0 PR |
| UIX-004 silent option | A real error is hidden | Silent only for background branding and logo calls; real saves always toast | Revert |
| UIX-008 telemetry | A real audit row is dropped | Only telemetry events are removed. A test checks that a Sale, Payment or Stock row still appears | Revert |
| UIX-027 money prefix | A printed or copied amount changes shape | Display only. Snapshot tests. No value changes | Revert the formatter |
| SYS-01 codemod | Colour changes the meaning of a status | Map per §3.1. Review screenshots for each status | Revert the codemod PR |
| UIX-013 default ranges | Users see less history on first load | Clear "All dates" preset. Range shown in the title | Revert |
| UIX-001 backend | Changing VAT query changes figures | Test first. Compare totals with the Worksheet for the same window. No change to tax rules | Revert the backend PR |

---

## 9. Out of scope (kept on the tracker)

- Dark mode (DS-12).
- PWA (UI-026).
- Arabic and RTL checks (UX-7).
- Remaining Stage 2 module work not named here.
- Login and invite redesign (DESIGN-SYSTEM.md, Authentication entry).
- POS enterprise behaviour (token changes only).

---

## 10. Order of work

Phase 0 first, because it protects users and data. Phase 1 next, because later phases use its helpers. Phases 2 and 3 can run in parallel if they touch different files. Phase 4 can start at any time because it is repro-only.
