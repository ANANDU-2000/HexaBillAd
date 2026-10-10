# UI Audit

Findings come from three sources: the reference screenshots in `HEXABILL IMAGES UI/` (62 of 331 reviewed), the code inventory, and live checks on the current build.

Old screenshots are not proof. A finding seen only in a screenshot stays **TODO** until it has been re-checked on the current build.

Severity: **P0** = security or financial defect; **P1** = broken or unusable; **P2** = significant usability problem; **P3** = cosmetic.
Device: **M** = mobile, **T** = tablet, **D** = desktop.

| ID | Route | Component | Device | Problem | Sev | Root cause | Fix | Test | Status |
|---|---|---|---|---|---|---|---|---|---|
| UI-001 | all | Layout.jsx | D/T | Tenant logo and name shown twice (sidebar plus top bar); collapsed rail showed "Z" twice | P2 | Two separate header blocks both render branding | Identity shown only in the sidebar header; top bar is search, alerts and account menu | route-sweep `header:visible ≤ 1` | IN_PROGRESS (code done, sweep pending) |
| UI-002 | all | Layout.jsx | D/T | Profile and logout appear in both the sidebar footer and the header dropdown; the footer hides the last nav item | P2 | Duplicate chrome | Sidebar footer removed; a single account menu holds profile, settings, help, shortcuts and log out | visual + sweep | IN_PROGRESS |
| UI-003 | all | Layout.jsx | D/T | Sidebar scrollbar shows arrow buttons | P3 | Default Windows scrollbar | `.sidebar-scroll`: thin bar, visible on hover only, no buttons | visual d1024 | IN_PROGRESS |
| UI-004 | all (mobile) | BottomNav.jsx | M | Raised Sale FAB overlaps labels and content | P2 | `-mt-5` raised button | Flat pill tab inside the bar | visual m360/m390 | IN_PROGRESS |
| UI-005 | all (mobile) | pages using `mobilePageTitleClass` | M | Page title appears in both the blue bar and the page body | P3 | Shell and page both render the title | Helper is now `hidden md:block`; other pages are handled module by module | visual m390 | IN_PROGRESS |
| UI-006 | all | Layout.jsx | D/T | Header Print button prints a blank page except on VAT | P1 | Global `@media print { body * { visibility:hidden } }` only re-shows `.vat-return-print-area` | Header print button removed; pages keep their own print actions | manual print | IN_PROGRESS |
| UI-007 | all | — | D/T/M | No global search | P2 | Missing feature | `CommandPalette` (Ctrl/Cmd+K), tenant-scoped search APIs, filtered by role | e2e palette spec | IN_PROGRESS |
| UI-008 | /login | Login.jsx | all | Footer "© HexaBill" under the tenant brand | P3 | Static copy | "Powered by HexaBill" on tenant hosts | screenshot login-1440 | PASS |
| UI-009 | /login | Login.jsx | all | Screenshot 09-27 140650 showed HexaBill branding instead of the tenant | P2 | Old build | Already resolved by hostname; verified gulfharvest login shows the GH logo and name | screenshot login-390 / login-1440 | PASS |
| UI-010 | many | index.html / CSS | all | No Arabic font fallback | P2 | Only Inter loaded | Noto Sans Arabic loaded; RTL font stack added | rtl smoke | IN_PROGRESS |
| UI-011 | tables | index.css `.table` | all | Blue-tinted headers, proportional digits | P3 | Old design lock | Neutral header, tabular-nums | visual | IN_PROGRESS |
| UI-012 | /customers | CustomersPage | M | Action buttons overlap customer names; Refresh and tabs clipped | P1 | Desktop row layout on a phone | Card list with an overflow menu | sweep m360 | PASS (phone cards rebuilt; sweep at 360 and 390) |
| UI-013 | /pricelist, /vat-return, /reports | PriceList, VatReturnPage, ReportsPage | M | Tables cut off at the right edge | P1 | Fixed-width tables | Card list, or one justified internal scroll | sweep m360 | TODO (D/F) |
| UI-014 | /pos | PosEnterprisePage | T | VAT and Amount columns hidden at 768px | P1 | Column min-widths | Responsive column set | sweep t768 | TODO (B) |
| UI-015 | /expenses | ExpensesPage | T | Amount column hidden; "Missing VAT Â·" mojibake | P1 | Column widths; encoding | Fix columns; verify encoding after commit e163ab7 | sweep t768 | PASS (mojibake fixed at source; guard test) |
| UI-016 | /dashboard | DashboardTally | D | Date separator shows "â€"" / "Â·" | P2 | UTF-8 decoded as Latin-1 somewhere | Find the source and add a unit test | sweep + unit | PASS (mojibake fixed at source; guard test) |
| UI-017 | /suppliers | SuppliersPage | D | `&quot;Supplier Ledger&quot;` shown as text | P2 | Double-escaped string | Render plain text | sweep | PASS (re-checked: source renders plain text; finding came from an old build) |
| UI-018 | /audit | AuditLogPage | D | Currency shows "¤"; JSON box scrolls inside the page | P2 | Missing currency code; nested scroll | Format with the tenant currency; collapse JSON | sweep | PASS (re-checked: the audit formatter cannot produce "¤") |
| UI-019 | /ledger | CustomerLedgerPage | all | Up to 7 solid-colour action buttons, several icon-only with no label | P2 | Ad-hoc colours | One primary plus an overflow menu; labels | visual | IN_PROGRESS (phone "+" labelled; desktop action row still open) |
| UI-020 | /purchases | PurchasesPage | D | Lime-bordered inputs, pastel cards, items table scrolls inside the page | P2 | Ad-hoc styling | Neutral inputs, single scroll | visual | PASS (voucher classes neutral) |
| UI-021 | /routes, /daily-close, /returns/create | various | D | Large blank areas, weak empty states | P2 | No EmptyState | `ui/EmptyState` with a next action | visual | TODO (F/G) |
| UI-022 | /expenses, /reports | recharts | D/M | Pie labels collide; x-axis labels overlap | P3 | Default label placement | Legend instead of labels; tick interval | visual | TODO (E/F) |
| UI-023 | /settings | SettingsPage | M | "Save Settings" covered by the FAB; tiny radio button | P1 | Fixed overlay; small control | Bottom padding; 44px radio rows | sweep m390 | TODO (H) |
| UI-024 | superadmin | SuperAdminLayout | D | Header offset `left-72` vs sidebar `w-60` | P2 | Hard-coded offset | Align with the sidebar width | visual | PASS (left-60) |
| UI-025 | all | index.css | D | Global print CSS hides everything except the VAT print area | P2 | One-off rule placed in global CSS | Scope the rule to the VAT page (`body.printing-vat`) | print test | PASS (scoped print rules; print emulation) |
| UI-026 | PWA | manifest.webmanifest | M | SVG-only icons, no service worker; not installable on Android | P2 | Incomplete PWA | PNG icons, shell-only service worker | Lighthouse installability | TODO (Phase 4) |
