# HexaBill UI/UX Issue Register, 25 Oct 2026

Scope: all 309 screenshots from `hexabill_al_uiuimages_1.zip` (dated 17 Oct 2026, reviewed in 26 contact sheets), plus a code read of the frontend in the extracted snapshot.

**What this is:** a findings register. Nothing was run, no app was started, no backend or database was called, and no code was changed.

**Evidence basis:**
- Screenshot IDs use the form `#NNN (HHMMSS)`. `#NNN` is the position in the zip's sorted list.
- Code locations are relative to `frontend/hexabill-ui/src/` unless they start with `backend/`.
- `VERIFY` means the location or cause is a hypothesis that still needs a repro or a read.
- The extracted repo here has no git metadata, so the commit is not confirmed. Some rows may already be fixed. Step 1 of every fix is to reproduce.

**Severity** (same scale as `docs/uiux/PREMIUM-UX-TRACKER.md`): **P0** blocks a business task or risks wrong or lost data. **P1** major friction in a daily workflow. **P2** visible inconsistency or wasted space. **P3** polish.

**Status values:** TODO, IN_PROGRESS, PASS, FAIL, BLOCKED, NOT REPRODUCED.

**Where these go:** add the rows to `docs/uiux/PREMIUM-UX-TRACKER.md`, which is the single active tracker. Do not add them to the superseded `UI-TASK-TRACKER.md` or `UI-AUDIT.md`. Existing IDs are cross-referenced where they overlap.

---

## Top 8 for the owner (read these first)

1. **VAT page and Worksheet disagree (UIX-001, P0).** The VAT page shows Total Sales 0.00 for 1 Aug to 31 Oct. The Worksheet shows 15.75 AED for October, from invoice 0001 dated 14/10/2026. This is a data question, not a styling bug. Until it is answered, no VAT screen should be signed off.
2. **SQL console is in the super admin main menu (UIX-002, P0 until verified).** The page says "read-only", but I did not find the server-side guard in this pass. The UI text is not a control.
3. **Security-class errors are flooding the logs (UIX-003, P1).** There are 86 unresolved "critical" events, most of them one repeated error from logo image requests. Those requests have no auth header.
4. **Destructive actions are in the wrong places (UIX-007, P1).** "Clear all data" appears on the Profile page, in Settings, and on the super admin tenant page, with a history icon.
5. **Things that look like features are placeholders (UIX-015, P1).** "Email functionality is not yet implemented", "coming soon", and a toast that tells users to "use API for now".
6. **Dates can be wrong in documents (UIX-014, P1).** Several editors default to the UTC day, so between 00:00 and 04:00 UAE time they show yesterday.
7. **Internal wording reaches users (UIX-016, 017, 018, 020, 024, 028).** Examples: "paired PC", "stock units", "product ID 135", raw JSON, "Dr/Cr".
8. **Design system drift (SYS-01).** About 699 raw Tailwind palette classes remain in 74 files. The existing S2-1 codemod covered blue and gray only.

---

## A. Data trust and safety

| ID | Sev | Where | Screenshots | What is wrong | Code location | Fix | Tracker link | Status |
|---|---|---|---|---|---|---|---|---|
| UIX-001 | P0 | Tenant VAT page, Worksheet | #218, #270, #221, #271, #033, #219 | VAT page for 1 Aug to 31 Oct shows Total Sales 0.00. Worksheet for October shows 15.75 AED, and invoice 0001 (14/10/2026) is 15.75 AED. The VAT page also warns "invoice outside period". | `VatReturnPage.jsx:231` calls `reportsAPI.getVatReturn(params)`. The period is in UI state (`fromDate`, `toDate`, lines 137-176). Root cause is in the backend VAT query, not checked in this pass. | Backend first: add a test that the VAT total equals the Worksheet total for the same invoice-date window. Then the UI shows the same number, or says why it differs. | Earlier VAT plan; F-11 in that plan (VERIFY) | BLOCKED (data) |
| UIX-002 | P0 | Super admin SQL Console | #301, #282 to #284 | "SQL Console" is in the main super admin nav. The page says "Read-Only Mode: Only SELECT queries allowed". No server-side guard was found in this pass. | `platform/SuperAdminSqlConsolePage.jsx`; nav at `components/SuperAdminLayout.jsx:83` and `navigation/moreMenuConfig.js:163` | Verify the server enforces read-only: a read-only DB role, a SELECT-only parser, a statement timeout, and an audit row per run. Until verified: move it under Infrastructure, behind a re-auth step, and out of the main nav. Remove it if it cannot be verified. | New | TODO (verify first) |
| UIX-003 | P1 | Super admin Error Logs, Infrastructure, Critical events | #298, #299, #309 | Rows read "SECURITY: tenant_id claim missing" with code GENERAL-ERROR. Path is `/api/storage/tena...`, tenant and user are blank. Critical events show 86 unresolved, 6 in the last 24 hours. | Backend `Core/Tenancy/TenantIdExtensions.cs:43` throws `UnauthorizedAccessException`. Frontend fallback sets a raw storage URL in an `<img>`: `tenant/TenantBrandingContext.jsx:113-117`, `features/settings/SettingsPage.jsx:1057` and `:1910`. Likely cause: `<img src>` sends no Authorization header (VERIFY with a network trace on Settings as super admin). The code mapping 401 to GENERAL-ERROR is not yet located (VERIFY). | Load logos through the authenticated client and convert to a blob or data URI (the pattern in `components/Logo.jsx`). Or serve a public logo URL. Classify 401 as auth, not GENERAL-ERROR. Dedupe critical events by signature (path + code), with a count. | New; related to UI-009 (old logo rule) | TODO |
| UIX-004 | P1 | Every super admin page | #282 to #288, #292 to #309 (most) | Persistent red toast "Failed to retrieve logo data URI". It stays on screen while the user works. | Backend `SettingsController.cs:142` returns that message. Frontend: `TenantBrandingContext.jsx:97-102` catches silently, but the shared error handler in `services/api.js` (around lines 200-212) still shows a toast. The only silent paths are auth calls (`api.js:755`, `:992`). `tenant/brandingLoadGate.js:7` skips the platform host. VERIFY how `admin.hexabill.company` is classified. | Add a `silent` request option for background calls. Skip branding on the platform host unless impersonating. Make the request not run at all when there is no tenant. | New | TODO |
| UIX-005 | P1 | Super admin dashboard, tenant list: "Impersonate" | #289 | Button label says "Impersonate". The action starts a read-only support session, and the toast says "Read-only support session opened for 30 minutes". The button uses indigo, which is a second palette. | `platform/SuperAdminDashboard.jsx:318-331` (calls `startSupportSession`, then `window.open`); button `bg-indigo-600` at line 329 | Rename to "Open read-only support". Keep the reason prompt. Use the primary token. Show the audit row after the session starts. Owner decides the name (OD-6). | New | TODO |
| UIX-006 | P1 | Super admin Settings, Security | #307 | Maintenance Mode is switched by a bare checkbox. It puts every tenant user on a maintenance screen, with no confirmation. | `platform/SuperAdminSettingsPage.jsx:259-272` | Use a switch with an On/Off label. Confirm before turning it on, and name the impact ("all 6 companies will see a maintenance screen"). Keep the Save step. Show a banner on the super admin pages while it is on. | New | TODO |
| UIX-007 | P1 | Profile, Settings, Tenant detail: "Clear all data" | #097, #229, #230, #027, #237 | Three entry points with near-identical labels. Profile has a red "Danger zone" card that only links to Settings. The icon is History, which means "undo", not "delete". | `pages/company/ProfilePage.jsx:332-349`; `features/settings/SettingsPage.jsx:1790-1812` (confirmation modal at 1941-2026, which already has a typed phrase, checkbox, reason and password); `platform/SuperAdminTenantDetailPage.jsx:955-971` (and modal near 1895) | Remove the card from Profile. Keep one destructive path, in Settings, using the existing modal. Use `Trash2` with the `error` tokens. Copy: "Delete sales, purchases and expenses. Keep products and customers." | New | TODO |
| UIX-008 | P1 | Activity Log (tenant) | #099, #231 | Log rows show "Vat tracking.tracking panel" and "Page VatReturn". UI view and click telemetry is written into the business audit log. | `features/reports/VatReturnPage.jsx:27` (`trackVatEvent`, `page: 'VatReturn'`); `:788` (`'TrackingPanel'`). `utils/auditLogFormat.js:95-106` only splits camel case, so it cannot map these. The backend endpoint for `trackVatEvent` probably writes the audit row (VERIFY). | Do not write view or click telemetry to the audit log. Send it to analytics, or a separate table. If kept, map labels in `auditLogFormat.js` and hide telemetry by default. | New | TODO |
| UIX-009 | P1 | Help and Support | #240 | Email support is a personal Gmail address. The phone number is an Indian number. "Live Chat" has action `#` (dead). Hours read "9 AM - 6 PM GST", and GST is also the UAE tax name. | `pages/HelpPage.jsx:84-97`. `pages/company/UpdatesPage.jsx:91` uses `SUPPORT_EMAIL`, so one constant already exists. | Use one support contact constant. Owner supplies it (OD-7). Remove "Live Chat" unless a real channel exists. Write hours as "UAE time". | New | TODO (needs owner input) |
| UIX-010 | P1 | Purchases | #037 | Page shows "This page could not load". | VERIFY: purchases route and `ErrorState` usage. | Reproduce first. Then fix the cause, not the message. | New | NOT REPRODUCED (not checked) |
| UIX-014 | P1 | Document editors, VAT effective date, CSV name | Code only | Default dates use `new Date().toISOString().slice(0, 10)`. That is the UTC day. Between 00:00 and 04:00 in UAE (UTC+4), the default is yesterday. | `features/documents/AgreementEditorPage.jsx:35, 137`; `QuotationEditorPage.jsx:70, 273`; `SalaryCertificateEditorPage.jsx:50, 177`; `platform/SuperAdminTenantDetailPage.jsx:2138`; `features/reports/ReportsPage.jsx:3302` (file name only) | Use `localDateString()` from `utils/dateFormat.js`. Test: fake the clock to 2026-10-25T00:30+04:00, expect `2026-10-25`. | New. The dashboard date was already fixed (DESIGN-SYSTEM.md, Dashboard) | TODO |

## B. Wrong information, placeholders and copy

| ID | Sev | Where | Screenshots | What is wrong | Code location | Fix | Tracker link | Status |
|---|---|---|---|---|---|---|---|---|
| UIX-011 | P1 | Dashboard, "Needs attention" rows | #007, #014 | "1 bills", "1 items". Damage puts a currency value in the count slot and "lost this period" in the unit slot. VAT estimate puts its helper sentence in the unit slot. | `features/dashboard/DashboardTally.jsx:453` ("bills"), `:465` ("items"), `:475-477`, `:485`. Render at `:78` joins count and unit with no plural rule. | Use a pluralise helper ("1 bill", "2 bills"). Put currency in the amount slot. Move helper copy to its own line. | DESIGN-SYSTEM.md, Dashboard (Needs attention) | TODO |
| UIX-012 | P1 | VAT page, net position | #219 | "Net VAT payable −7.29 AED" beside "Net VAT receivable 7.29 AED". The sign and wording conflict. | VERIFY label location in `VatReturnPage.jsx` | Positive reads "Payable". Negative reads "Refund due". Show the amount unsigned. Wording needs the accountant's sign-off (OD-8). The numbers do not change. | New | TODO (wording needs OD-8) |
| UIX-013 | P1 | Customer Ledger, Reports, Expenses: default date range | #039, #144, #072, #211, #038, #116 | Ledger opens with a 5-year range (17-10-2021 to 17-10-2026). Reports opens with 2 years. Expenses opens with 365 days, and the saved range has no tenant key, so an old range can come back. | `features/customers/CustomerLedgerPage.jsx:171-177`, `:189-196`; `features/reports/ReportsPage.jsx:63-69`; `features/expenses/ExpensesPage.jsx:243-257` | Default to the current month to date (OD-3). Store the saved range per tenant. Show the range in the page title. Test: first load sends a range of 31 days or less. | DESIGN-SYSTEM.md, Expenses (Dates) | TODO |
| UIX-015 | P1 | Settings: Email and Notifications tabs; Reports exports; Recurring invoices | #095, #096, #227, #228 | "Email functionality is not yet implemented. This feature will allow you to:" with a feature list. "Enable email notifications (Coming soon)". Export buttons show toast "coming soon". Recurring invoices toast: "Create form coming soon. Use API for now." | `features/settings/SettingsPage.jsx:1494`, `:1540`, `:1560`; `features/reports/ReportsPage.jsx:1850`, `:2130`, `:3405`; `features/sales/RecurringInvoicesPage.jsx:64` | Hide the unbuilt tabs (OD-10). Remove the "use API" line, which tells users to use an API. Hide export buttons until they work. Do not describe unbuilt features in the product. | New | TODO |
| UIX-016 | P2 | Backup page | #102, #233, #275 | "Company data only. A paired PC saves the scheduled copy." "Device / folder: No PC connected". | `pages/company/BackupPage.jsx:255`, `:295-296` | "Automatic copy to a computer: not set up." One action: "Set up". | New | TODO |
| UIX-017 | P1 | Sale and purchase stock error | #134 | "Insufficient stock… Available: 3.00 stock units; required: 5.00 stock units." | Backend `Core/Infrastructure/ValidationService.cs:195` | "Only 3 Carton of Basmati in stock. This sale needs 5." Use the product's unit name, not the ID or the word "stock units". Backend change is wording only. Add a test on the message. | New | TODO |
| UIX-018 | P2 | Stock adjustment history | #181 | "Filtered to product ID 135". | `features/inventory/StockAdjustmentsHistoryPage.jsx:107` | Show the product name. Keep the ID in the URL. | New | TODO |
| UIX-019 | P2 | Toast on some pages | #082, #223 | "Resource not found" toast, with "No activity recorded" beside it. | VERIFY which request returns the 404 | Show an empty state for a list with no items. Map 404 on list endpoints to empty. Use plain copy for real errors. | New | NOT REPRODUCED (not checked) |
| UIX-020 | P2 | Super admin Audit Logs | #297 | Details column shows raw JSON, cut off. Helper text reads "Action filter: backend matches action text containing the selected value." | `platform/SuperAdminAuditLogsPage.jsx:218`, `:242` (raw `log.details`). The helper text location is VERIFY. | Use `formatAuditDetails` and `humanizeAction` (already in `utils/auditLogFormat.js`), as the tenant log does. Keep raw JSON behind a "View raw" control. Remove the developer note. | New | TODO |
| UIX-021 | P2 | Super admin Settings, Feature Flags | #303, #304 | "Enable Branches & Routes (default for new tenants)" next to "Enable Routes". No help text on any flag. | `platform/SuperAdminSettingsPage.jsx:157` and the flags list | Name each flag by its outcome. Add one help line each. | New | TODO |
| UIX-022 | P3 | Super admin Settings, Announcement banner | #306 | Label reads "Start Date (YYYY-MM-DD)". The native field shows dd-mm-yyyy. | VERIFY label location in `SuperAdminSettingsPage.jsx` | One date display (OD-2). Label matches the field. | New | TODO |
| UIX-023 | P2 | Super admin Health | #300, #291, #292 | Health shows "Companies 5". The onboarding list and tenant table show 7 tenants. | `platform/SuperAdminHealthPage.jsx` (count source VERIFY); onboarding report in `SuperAdminDashboard.jsx` | Data question first: which count is right, and what does "Companies" mean (active, total, or excluding test tenants). Do not change the UI until the count is agreed. | New | BLOCKED (data) |
| UIX-024 | P2 | Super admin, Critical events popover | #309 | "86 unresolved · 6 in last 24h · 5 in last 1h". The first four entries are the same message. | `components/SuperAdminLayout.jsx` (popover) and the error log source | Group by signature, with a count per group. Close after triage. Tied to UIX-003. | New | TODO |
| UIX-039 | P3 | Sales Ledger | #149 | An engineering explanation sits in the page body. | VERIFY `features/sales/SalesLedgerPage.jsx` | Move it into a help tooltip, or remove it. | New | TODO (VERIFY) |
| UIX-040 | P3 | Server error page | #285 | Server error page has no next step and no link back. | VERIFY `pages/ErrorPage.jsx` | Plain text: what happened, one button to go back. Hide the trace. | New | TODO (VERIFY) |

## C. Icons, currency and money display

| ID | Sev | Where | Screenshots | What is wrong | Code location | Fix | Tracker link | Status |
|---|---|---|---|---|---|---|---|---|
| UIX-025 | P2 | Money icon on non-money items | #105, #063, #148, #014 | Dollar icon on "Pending bills PDF", "Outstanding Bills", "Billing" settings tab, "Multi-Currency" and "Daily cash close" feature flags. | `features/customers/CustomerLedgerPage.jsx:2519`; `features/reports/ReportsPage.jsx:218`; `features/settings/SettingsPage.jsx:837`; `platform/SuperAdminTenantDetailPage.jsx:2150`, `:2158`, `:2159` | Use the icon map in the plan (§3.5). Money icon only on amounts and money pages. | New | TODO |
| UIX-026 | P2 | Icon reuse | (sheets) | Two nav items share one icon. Destructive buttons use the History icon. | Shield: `navigation/moreMenuConfig.js:136` (Users) and `:164` (SA Settings). Building2: `:99` (Suppliers) and `:158` (SA Tenants). History: `:83` (Billing History) and the destructive buttons at `ProfilePage.jsx:346`, `SettingsPage.jsx:1808`, `SuperAdminTenantDetailPage.jsx:969`. | One icon per nav ID. Test: a unit test that fails on a duplicate. Destructive uses `Trash2`. | DESIGN-SYSTEM.md §3 ("no two nav items share one") | TODO |
| UIX-027 | P2 | Money format | #290 (suffix), POS (prefix) | `formatCurrency` puts AED after the amount: "594.00 AED". The design doc says a prefix or a column header. POS legacy writes "AED" as a prefix in 16 places, so two formats are on screen. | `utils/currency.js:19-21`; `features/sales/PosPageLegacy.jsx` (16 literal uses) | One formatter, prefix form: "AED 594.00" (OD-1). Values do not change. Snapshot test for both positive and negative. | DESIGN-SYSTEM.md §2 and §9 | TODO (needs OD-1) |
| UIX-028 | P2 | Balances, Dr and Cr | VERIFY (ledger screens) | Balances read "Dr: 1,200.00 AED" and "Cr:". These are accountants' abbreviations for shop owners. | `utils/currency.js:55-63` | Plain words: "Owes you" and "You owe" (OD-4). Keep Dr and Cr in a tooltip for accountants. | New | TODO (needs OD-4) |

## D. Layout and responsive (mobile and tablet)

| ID | Sev | Where | Screenshots | What is wrong | Code location | Fix | Tracker link | Status |
|---|---|---|---|---|---|---|---|---|
| UIX-029 | P1 | Tab bars | #165, #167, #168 | Tab label clipped: "Overdu". | VERIFY which tab component (`components/ui/TabNavigation.jsx` or `ReportSwitcher.jsx`) | `whitespace-nowrap`, a minimum width, and tabs that scroll sideways (DESIGN-SYSTEM.md §8). Test: `scrollWidth` equals `clientWidth` per tab at 360. | DS-9 | TODO |
| UIX-030 | P1 | Price list on phone | #182, #183, #184 | Columns run off the right edge. | `features/products/PriceList.jsx` | Card list below 768 (`mobileCards`). | UI-013 (re-opened) | TODO |
| UIX-031 | P2 | Invoice action grid on phone | #138 | Action buttons jumbled. | VERIFY `features/sales/BillingHistoryPage.jsx` mobile view | Use the phone card pattern with one primary action and an overflow menu. | UX-C03 pattern | TODO (VERIFY) |
| UIX-032 | P2 | Route sales table | #189 | Status "Pendi" cut off. | `features/branches/RouteDetailPage.jsx:797` (plain span, no `nowrap`, no width) | `whitespace-nowrap`. Status as `Badge`. Column minimum width. | New | TODO |
| UIX-033 | P2 | Customers table, email column | #081 | Email wraps one letter per line. | VERIFY `features/customers/CustomersPage.jsx` table column | Minimum width, truncate with a `title`, and no per-letter wrap. | New | TODO (VERIFY) |
| UIX-034 | P2 | Purchase form, product picker | #279 | Dropdown covers the items table. | `features/purchases/ProductPicker.jsx`, `PurchasesPage.jsx` | Render the dropdown above the table with a `z-dropdown` token, and flip it when there is no room. Test: open at 1024 and check it sits over the list. | New | TODO |
| UIX-035 | P2 | Date filter row | #038, #039, #072 (layout) | Fixed-width date fields (`w-36`, 144px). Preset chips are 28px tall on desktop (`md:h-7`). "Today" and "Yesterday" shortcuts are 11px text. Native date picker shows the browser's own format. | `components/ui/DateRangeFilter.jsx:28`, `:52`, `:58`; `components/ui/DateField.jsx:12` | Use the `Form` primitives. Chips at least 32px on desktop. One date control (OD-2). | DESIGN-SYSTEM.md §6 and §8 | TODO |
| UIX-036 | P2 | Super admin tenant list | #292, #293 | Table scrolls sideways. The last column ("USE…") is cut off. Long names wrap. | `platform/SuperAdminTenantsPage.jsx` | Card list below 768. On desktop, pin the name column and drop low-value columns. | DESIGN-SYSTEM.md §7 | TODO |
| UIX-037 | P3 | Create Company modal | #294, #295 | Long single column. Footer visibility not confirmed. | `platform/SuperAdminTenantsPage.jsx` (modal) | Footer outside the scroll area, so Save is always visible (DESIGN-SYSTEM.md §12). | DESIGN-SYSTEM.md §12 | TODO (VERIFY) |
| UIX-038 | P3 | Settings, company phone field | #273 | Field may be clipped at the right edge. | VERIFY `features/settings/SettingsPage.jsx` | Check at 360 and 768. | New | TODO (VERIFY) |

## E. Design system drift (systemic)

| ID | Sev | What | Evidence | Fix | Tracker link | Status |
|---|---|---|---|---|---|---|
| SYS-01 | P2 | Raw Tailwind palette classes. Red, amber, green, emerald, indigo, purple, rose, sky, slate and others are used directly, not through tokens. | Grep: 699 matches in 74 files (includes `bg-`, `text-`, `border-`, `ring-`, `from-`, `to-`). Examples: `pages/company/UsersPage.jsx` (50 matches), `features/reports/ReportsPage.jsx` (79), `features/sales/pos/PosEnterprisePage.jsx` (22). | Codemod with the mapping in the plan (§3.1). Blue and gray are already done (S2-1). | S2-1 (extend), DS-12 | TODO |
| SYS-02 | P2 | Arbitrary sizes such as `w-[...px]`, `min-h-[...px]` and `max-h-[...px]`. | Grep: 142 matches in 55 files. Many are fine (touch targets). Check each in tables, filters and modals. | Review each match. Allowlist the touch targets. Replace the rest with tokens or layout. | DS-11 | TODO |
| SYS-03 | P2 | No single date or money display helper. | Grep: 410 matches in 84 files for `toLocale*`, `Intl.*` and `en-GB`. Money display is in `utils/currency.js`, but dates are formatted in place. | `formatDate` and `formatMoney` in `utils/`. Lint rule against new `toLocale*` calls outside `utils/`. | DESIGN-SYSTEM.md §2 | TODO |
| SYS-04 | P2 | Decoration: gradients, heavy shadows, large rounded corners, AI-style icons. The design doc says no decorative gradients or shadows. | Grep: 63 matches in 24 files. Examples: `pages/company/ProfilePage.jsx:186` (gradient background), `pages/ErrorPage.jsx:40` (gradient background). | Remove decorative gradients. Cards use borders, not shadows. Keep `shadow-lg` for overlays only. | DESIGN-SYSTEM.md §4 and §9 | TODO |
| SYS-05 | P2 | Page height and scroll. `min-h-screen` appears in 37 places. Design rule: one scroll on `main`, no nested page scroll. | Grep: 37 matches. `components/Layout.jsx:350` and `:494` are the shell; the others are pages and error screens. | Shell owns height. Pages do not use `min-h-screen`. Check with the existing nested-scroll metric (UX-3). | DESIGN-SYSTEM.md §8 and "Overflow" | TODO |
| SYS-06 | P2 | Super admin uses a second hue. | `platform/SuperAdminDashboard.jsx:329` (`bg-indigo-600`). The design doc says super admin uses the same tokens. | Map to `primary` (see UIX-005). | DESIGN-SYSTEM.md, Shell | TODO |

---

## F. Checked and not a bug (do not "fix")

| Item | Why it is not a bug |
|---|---|
| Welcome email variables (screenshot #305) | Code uses `{companyName}`, `{trialEndDate}`, `{ownerEmail}` consistently (`platform/SuperAdminSettingsPage.jsx:198`, `:206`). The earlier reading of the parentheses came from a low-resolution image. |
| Onboarding "Complete 15/5" (screenshot #291) | Code says "Complete (5/5)" (`platform/SuperAdminDashboard.jsx:526`). The earlier reading was a misread of small text. |
| Currency "¤" and double-encoded text (UI-015, UI-016, UI-018 in the older audit) | Not present in the new screenshots. Those rows stay PASS. |

## G. Owner action (not a UI fix)

- **Screenshot #006 shows an API key for a Linear workspace.** It is not HexaBill. The key is not reproduced here. If that key is still valid, rotate it. Do not share screenshots that show keys.

---

## H. Open decisions

Each one is listed in the plan (§5) with a default. The owner decides before the related fix starts.

| ID | Question | Default |
|---|---|---|
| OD-1 | Money: prefix ("AED 594.00") or suffix ("594.00 AED")? | Prefix, as the design doc says |
| OD-2 | Date display in tables and filters | dd/mm/yyyy in tables. The API keeps YYYY-MM-DD |
| OD-3 | Default date range on Ledger, Reports, Expenses | Current month to date |
| OD-4 | Balance wording: Dr and Cr, or plain words | Plain words, with Dr and Cr in a tooltip |
| OD-5 | Super admin SQL console: keep, move, or remove | Move under Infrastructure, behind re-auth. Remove if the server guard cannot be verified |
| OD-6 | Name for the impersonation feature | "Open read-only support" |
| OD-7 | Support email, phone and hours | Use `SUPPORT_EMAIL`. Remove personal and dead contacts. The owner supplies the details |
| OD-8 | VAT net wording: Payable and Refund due | Payable and Refund due, with an accountant's sign-off |
| OD-9 | Week start for the "Week" filter | Leave as is. Already recorded in the design doc |
| OD-10 | Unbuilt tabs (Email, Notifications) | Hide until built |

---

## I. What is not covered in this register

- **Live behaviour.** Nothing was clicked. Every row marked VERIFY needs a repro on a local build.
- **Arabic and RTL.** Not reviewed in this set.
- **Real data volume.** Screenshots show small lists.
- **The AI ERP screens.** Not in this set.
- **Financial logic.** No VAT, invoice, payment or stock calculation was changed or reviewed beyond the data question in UIX-001.
