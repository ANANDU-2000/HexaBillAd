# HexaBill Design System v2: Modern ERP

Save as `docs/uiux/DESIGN-SYSTEM.md`. It replaces v1, so keep v1 as `DESIGN-SYSTEM-v1-2026-10.md`. Then point `.cursor/design/HEXABILL-DESIGN-SYSTEM.md` at this file.

**Design principle:** a trading ERP is a tool used 8 hours a day by cashiers, accountants, drivers and owners. Every pixel serves the business task, and nothing is decoration. The aim is to look calm, dense, neat and fast, closer to Linear, Stripe Dashboard, Zoho Books or Odoo 17 than to a landing page.

---

## 1. Five rules (if you remember nothing else)

1. **One accent color.** Use primary blue for actions only. Everything else is neutral grey. Green and red are used only for money meaning (received, owed).
2. **Density first.** Table rows are 36 px, controls are 32–36 px on desktop and 44 px on touch. Show more rows, not more whitespace.
3. **One toolbar, one table, one primary action per page.** Filters go in a popover, not on the page.
4. **The same icon always means the same thing** (see §6). Icons come from lucide only, never emoji.
5. **Numbers are sacred.** They are right-aligned and `tabular-nums`, with the currency shown once in the column header and a Dr/Cr suffix. The UI never recomputes a total.

---

## 2. Color tokens

Use only these. They live in `src/styles/tokens.css` and `tailwind.config.js`.

| Role | Token | Hex | Use |
|---|---|---|---|
| Action | `primary-600` / hover `700` / active `800` | #2563EB / #1D4ED8 / #1E40AF | Primary button, link, active tab, focus ring, selected row tint `primary-50` |
| Page | `surface` | #F8FAFC | App background |
| Card / table | `surface-card` | #FFFFFF | Every container |
| Border | `surface-border` | #E5E7EB | All borders, 1 px |
| Text | `text-primary` | #0F172A | Body, values |
| Muted | `text-secondary` | #475569 | Labels, helper, header cells |
| Faint | `neutral-400` | #A3A3A3 | Placeholder, disabled icon |
| Success / received / Cr | `success` fg #047857 bg #ECFDF5 | | Paid, cleared, money in |
| Danger / owed / overdue | `error` fg #B91C1C bg #FEF2F2 | | Balance due, overdue, delete |
| Warning | `warning` fg #B45309 bg #FFFBEB | | Pending, unconfirmed, needs action |
| Info | `info` fg #1D4ED8 bg #EFF6FF | | Neutral notices, "Historical" |

**Banned:** `violet`, `purple`, `indigo`, `teal`, `orange`, `pink`, raw `amber-*`, gradients, colored `border-l-4` cards, colored tile backgrounds for KPIs, and `shadow` on cards.

### Money colors
- Value owed to you (customer Dr balance, overdue): `text-error-fg`.
- Money received or a credit: `text-success-fg`.
- Everything else (sales totals, VAT, purchases): `text-primary`, not colored.
- **Status pills:**
  - Paid: success.
  - Pending or Partial: warning.
  - Overdue: error.
  - Void or Draft: neutral.
  - Historical: info.

### Charts
Use a single-hue series (`primary-600`, `primary-300`). Use a second series in `neutral-400`. Add red only for a negative or overdue series. Use at most 2 donut charts per app (prefer bars).

---

## 3. Typography

Inter. Arabic falls back to Noto Sans Arabic. Root size is 14 px on desktop and 16 px on phone (prevents iOS zoom).

| Role | Size / weight | Where |
|---|---|---|
| Page title | 18 / 600 | One per page, inside the toolbar row |
| Section title | 14 / 600 | Card and section headers |
| Body | 14 / 400 | Forms, text |
| Table cell | 13 / 400 | All table cells |
| Table header | 12 / 500, `text-secondary`, no uppercase | `thead` |
| Label | 12 / 500 | Above inputs |
| Helper / meta | 12 / 400 muted | Under inputs, timestamps |
| KPI value | 18 / 600 tabular | KPI strip |
| Grand total | 20 / 700 tabular | POS, invoice total only |

Rules: no ALL-CAPS labels (except the 2-letter Dr/Cr), and no `font-bold` inside table bodies except on the totals row.

---

## 4. Sizes, spacing, radius

| Thing | Desktop (≥1024) | Tablet (700–1023) | Phone (<700) |
|---|---|---|---|
| Button / input / select | 32 compact · 36 default | 40 | 44 |
| Icon-only button hit area | 32 | 40 | 44 |
| Table row | **36** | 40 | card, 56–72 |
| Table cell padding | 8 px x · 6 px y | 10 · 8 | n/a |
| Toolbar height | 44 | 48 | 2 rows max (≤ 96) |
| Tabs height | 36 | 40 | 44, horizontally scrollable |
| Sidebar | 232 expanded · 64 rail | 64 rail | none (bottom nav) |
| Header | 52 | 52 | 52 |
| Page padding | 16 | 12 | 12 |
| Card padding | 12–16 | 12 | 12 |
| Gap between sections | 12 | 12 | 12 |
| Right drawer (detail, assistant) | 420 | 90 % sheet | full screen |
| Modal | 480 / 640 / 880 | same, max 92 vw | full screen sheet |

- **Spacing scale:** 4, 8, 12, 16, 24, 32. Never use `p-6`, `py-4` or `py-3` in table cells.
- **Radius:**
  - 6 px for controls,
  - 8 px for cards and tables,
  - 12 px for modals and sheets,
  - full round for pills and avatars.
- **Elevation:** cards have a border and no shadow. Menus and popovers use `shadow-md`, and modals use `shadow-xl`.

### Breakpoints
`tab: 700px` (new) · `lg: 1024px` · `xl: 1280px` · `2xl: 1536px`. No page invents its own breakpoint.

---

## 5. Layout patterns (one per page type)

### 5.1 List page (Billing History, Payments, Purchases, Customers, Products…)
```
[Title  count]                        [Export ▾] [+ Primary]
[Search………] [Date preset ▾] [Filters (2) ▾]          ← ListToolbar, 44px
(chips of active filters, only when set)
[KPI strip, optional, 1 row]
┌ table: sticky header · 36px rows · actions = [1 primary] [⋯] ┐
└ sticky footer: totals · pagination                          ┘
```
- Phone: the title row, then Search + Filters, then cards. A FAB appears only if there is no bottom-nav "New".
- First data row: ≤ 200 px from the top of `main` on desktop.

### 5.2 Ledger page (Customer / Supplier)
```
← Name · phone · TRN · Switch(F2)        Balance 4,961.00 Dr · 4 unpaid   [Receive payment] [⋯]
Pending · Bills · Payments · Ledger · Stats                                   ← tabs 36px
[toolbar]  table
```

### 5.3 Entry page (POS, Purchase, Expense, Quotation)
- Desktop: the work area on the left, plus a **sticky right summary column** (300–360 px) with totals and the primary Save.
- Phone: the work area, plus a sticky bottom bar (`Total · [Save/Checkout]`) that opens a sheet.
- No list under an entry form. Entry is its own route or a full panel.

### 5.4 Detail page (Product, Customer, Route)
A header row (name, status, actions), then a KPI strip, then tabs, then content.

### 5.5 Dashboard
A KPI strip (4), then a Needs attention list, then quick actions (6), then a trend chart, then top lists. See the loop file, task G01.

### 5.6 Report page
The report picker (left list ≥1024, sheet on phone), then the toolbar, then the KPI strip, then the chart, then the table, with Export in one menu.

---

## 6. Icons: modern ERP set (lucide-react only)

- **Sizes:** 16 in rows, buttons and inputs · 18 in nav · 20 in empty states and headers · stroke 1.75 (set once via a wrapper `<Icon>`).
- **Color:** inherit the text color. Never color an icon on its own except a status icon.
- **Same concept means the same icon everywhere.**

| Business concept | Icon | Concept | Icon |
|---|---|---|---|
| Dashboard | `LayoutDashboard` | Settings | `Settings` |
| POS / New sale | `ScanBarcode` | Users / staff | `UserCog` |
| Invoice / Billing history | `ReceiptText` | Roles & access | `ShieldCheck` |
| Sales ledger | `BookOpenText` | Activity log | `History` |
| Customer ledger | `BookUser` | Backup | `DatabaseBackup` |
| Customers | `Store` | Help | `LifeBuoy` |
| Payments received | `HandCoins` | Notifications | `Bell` |
| Cheque | `BadgeCheck` (cleared) / `Clock` (pending) | Search | `Search` |
| Purchases | `PackagePlus` | Filter | `SlidersHorizontal` |
| Suppliers | `Factory` | Date range | `CalendarRange` |
| Expenses | `Wallet` | Export | `Download` |
| Products | `Package` | Print | `Printer` |
| Price list | `Tags` | PDF | `FileDown` |
| Stock adjustment | `ArrowUpDown` | Share / WhatsApp | `Share2` / `MessageCircle` |
| Low stock | `PackageMinus` | More actions | `MoreHorizontal` |
| Returns / credit note | `Undo2` | Edit | `Pencil` |
| Delivery note | `Truck` | Delete | `Trash2` |
| Quotation | `FileSpreadsheet` | Duplicate | `Copy` |
| Agreement | `FileSignature` | View | `Eye` |
| Salary certificate | `IdCard` | Collect / pay | `Banknote` |
| Documents | `FolderOpen` | Hold / resume | `PauseCircle` / `PlayCircle` |
| Branches | `Building2` | Refresh | `RotateCw` |
| Routes | `Route` | Barcode scan | `ScanLine` |
| Route map | `Map` | Location pin | `MapPin` |
| My routes (driver) | `Navigation` | I'm here / GPS | `LocateFixed` |
| Daily close | `Vault` | Delivered | `PackageCheck` |
| VAT return | `Percent` | Problem / failed | `CircleAlert` |
| Reports | `BarChart3` | AI agent | `Sparkles` |
| Worksheet | `Calculator` | Voice | `Mic` |

**lucide version:** `lucide-react@0.294` lacks some of these (e.g. `BookUser`, `HandCoins`, `Vault`, `DatabaseBackup`). Upgrade lucide-react in one task (P-08 in the loop file) and verify the bundle size. The fallback is the nearest existing icon. All icons must come from one map file: `src/components/ui/icons.js` (`export const ICONS = { invoice: ReceiptText, … }`). Pages import from the map, never from lucide directly.

---

## 7. Components (the only building blocks)

| Component | Spec |
|---|---|
| `Button` | Variants: `primary` (filled blue), `secondary` (white + border), `ghost`, `danger` (red filled, only in confirm), `link`. Sizes sm 32 / md 36 / lg 44. States: hover, active, focus ring 2 px primary-500/40, disabled 40 % opacity, loading spinner that keeps the width. **One primary per view.** |
| `IconButton` | Square, ghost, with a `title` and `aria-label`. Size follows the hit area in §4. |
| `ListToolbar` | Search (debounced 300 ms) · DatePreset · FiltersPopover · right-side slots. |
| `DatePreset` | Today, Yesterday, This week, This month, Last month, This quarter, This year, All, Custom… Shows `01 Nov – 07 Nov`. |
| `FiltersPopover` | Fields grid, Apply / Clear, and an active count badge. A sheet on phone. |
| `DataTable` (ModernTable v2) | Props: `columns[{key,label,align,width,priority,render}]`, `rows`, `density`, `stickyHeader`, `stickyFooter`, `rowActions{primary, menu[]}`, `onRowClick`, `virtualize` (auto when > 100 rows), `emptyState`, `loading` (skeleton rows), `error` (retry). Columns with `priority:3` hide on tablet; on phone the table renders as `MobileCard` from the same columns. |
| `MobileCard` | Line 1: identity + amount right. Line 2: meta + status pill. Max 72 px. Tap opens detail; `⋯` holds actions. |
| `KpiStrip` | 3–6 cells in one bordered row, with label, value and an optional delta/sub. It wraps to 2×3 on phone. |
| `StatusPill` | Small 20 px pill with a dot and label (§2 status mapping). |
| `Tabs` | Text tabs, 36 px, underline active, optional count `Pending (3)`. |
| `Drawer` | Right side, 420 px, header with title + close, body scroll, footer actions. |
| `Sheet` | Bottom sheet on phone and tablet, drag handle, 90 % max. |
| `Modal` | Only for confirm or short forms (≤ 6 fields). Use Drawer or a route for anything longer. |
| `ConfirmDangerModal` | Title, consequence sentence, red confirm, optional typed confirmation. |
| `Alert` | Inline: info, success, warning, error. 1 px border + tinted bg + icon + text + optional action. Dismissible unless it is blocking. |
| `Toast` | Bottom-center on phone, top-right on desktop. 1 line. Success auto-hides in 3 s; errors stay until closed. |
| `EmptyState` | 20 px icon, 1 sentence, 1 button. No illustrations. |
| `Skeleton` | Rows for tables, blocks for cards. Show after 200 ms (avoid flicker). |
| `MoneyText` | `value`, `dr/cr`, `currency`. Formats `4,961.00`, tabular, colored per §2. |

---

## 8. Business-flow UI rules

| Flow | UI rule |
|---|---|
| Sell (POS) | Keyboard-first: F2 customer → F3 product → qty → Enter → F9 save. Save is always visible. After save: Print / Share / New sale in one toast-bar, not a modal. |
| Collect payment | It always starts from the customer (ledger `Receive payment` or a route stop `Collect`). Show the outstanding balance before the amount is typed. Allocation preview: "This clears 7035 (599.00) and part of 7025". |
| Unconfirmed money action | One warning Alert with `[Check result] [Retry]`. Never auto-retry, never hide it. |
| Purchase | Supplier → bill no/date → items → review totals → Save. The supplier balance is shown as an info line. |
| Expense | Category → amount (incl. VAT toggle) → paid from → date → Save. Max 1 screen. |
| Return | Pick an invoice → pick lines/qty → reason → review credit → Save. |
| Daily close | Date/branch → expected (read-only breakdown) → counted → difference + reason → Submit. |
| Driver route | Start → next stop card (Navigate, Delivered, Problem) → auto arrive → End. |
| Delete / void | Always ConfirmDangerModal. Finalized invoices say "Void" (history kept), not "Delete". |
| Print / PDF | A single `Print ▾` menu: A4, A5, Thermal, Letterhead, PDF, WhatsApp. |
| AI agent | Every write is an ActionCard → Confirm. Read-only answers show "as of" time + source. |

---

## 9. States every screen must have

Loading (skeleton) · Empty (with a call to action) · Error (message + Retry, never a blank page) · Offline (banner, keep showing cached data, and disable money writes) · Slow (> 3 s: "Still loading…" with Cancel) · Saving (button spinner, double-submit blocked) · Saved (toast) · Unknown result (warning Alert, §8).

---

## 10. Motion and accessibility

- Durations: 120 ms for hover and press, 180 ms for drawer and sheet, ease-out. No bouncing, no infinite animations except the spinner and the AI state dot. Respect `prefers-reduced-motion`.
- Contrast is AA (4.5:1 text). The focus ring is always visible. Every icon-only button has `aria-label`. Tables have `<th scope>`.
- Keyboard: `Ctrl+K` palette, `/` search, `?` shortcuts, `Ctrl+J` agent, `Esc` closes the top layer.
- Arabic: `dir="rtl"` per field and per print section. Numbers stay LTR.

---

## 11. Don'ts (the slop list, enforced by `scripts/ui-lint.mjs`)

- Colored KPI tiles, gradient headers, and colored left-border cards.
- Emoji anywhere in the UI.
- More than one filled primary button in a view.
- Icon + label stacked vertically in tabs or table actions.
- More than 2 inline row actions (use `⋯`).
- Paragraph descriptions under page titles (use a `?` tooltip).
- Native `confirm()` / `alert()`.
- Nested scroll boxes inside a page (one scroll per page; tables and drawers excepted).
- Showing raw IDs, stack traces, or English-only system codes to owners or staff.
