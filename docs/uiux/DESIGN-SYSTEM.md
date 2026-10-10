# HexaBill Design System

HexaBill is a commercial accounting ERP. People use it all day to enter sales, purchases and payments, and they read the screens to make money decisions. The design system serves that work:

- **Quiet surfaces.** Neutral backgrounds, hairline borders, no decorative gradients or shadows.
- **One action colour.** Blue (primary-600) marks what you can do. Everything else is neutral.
- **Colour means status.** Green, amber, red and blue only ever signal paid/ok, attention, problem and information, and always with a word or icon beside them.
- **Numbers first.** Amounts use tabular figures, align right and are never truncated.
- **Dense on desktop, roomy on touch.** 40px controls with a mouse; 44px on phones.
- **One of everything.** One top bar, one page title, one primary button per view.

Live reference: run `npm run dev` in `frontend/hexabill-ui` and open **http://localhost:5173/__design**. That page exists only in dev builds; it renders every shared component with sample data, and the Playwright spec `e2e/design-system.spec.js` tests it at all five widths.

## Where things live

| Layer | File | Notes |
|---|---|---|
| Tokens (source of truth) | `src/styles/tokens.css` | CSS custom properties |
| Tailwind mirror | `tailwind.config.js` | Same values as Tailwind names. Change both together |
| Component classes | `src/index.css` | `.btn*`, `.input`, `.label`, `.field-help`, `.field-error`, `.card`, `.table`, `.num`, `.skeleton`, `.kbd` |
| React primitives | `src/components/ui/*` (barrel `ui/index.js`) | PageHeader, Card, StatCard, Button, OverflowMenu, Badge, Alert, ModernTable, TabNavigation, EmptyState, ErrorState, ProgressBar, skeletons |
| Form fields | `src/components/Form.jsx` | `Input`, `Select`, `TextArea` with label, help and error wiring |
| Dialog | `src/components/Modal.jsx` | Centred dialog from md up; bottom sheet on phones |
| Sheets | `src/components/mobile/*` | `MobileSheet`, `MobileFilterSheet`, `MoreMenuSheet`, `ListSkeleton` |
| Mobile helpers | `src/components/mobilePageUi.jsx`, `tallyFormClasses.js` | Class strings for ledger cards, period chips, voucher fields |
| Shell | `src/components/Layout.jsx`, `BottomNav.jsx`, `CommandPalette.jsx`, `ShortcutHelp.jsx` | |
| Tenant identity | `src/tenant/TenantBrandingContext.jsx`, `components/Logo.jsx` | |

Rule: **pages use primitives and tokens, not raw palette classes.** Prefer `text-text-primary` / `text-neutral-600`, `bg-error-bg text-error-fg`, `<Badge variant="success">`. Do not use `text-gray-*`, `bg-red-100` or hex values. Pages that predate this rule are migrated module by module (see UI-TASK-TRACKER.md, Stage 2).

---

## 1. Colour

### Action

| Token | Tailwind | Value | Use |
|---|---|---|---|
| `--primary` | `primary-600` | #2563EB | Primary button, active nav, links, focus ring, selected tab |
| `--primary-hover` | `primary-700` | #1D4ED8 | Hover on primary; link text on white (higher contrast) |
| | `primary-50` / `100` | #EFF6FF / #DBEAFE | Selected row, active chip background |
| `--surface-inverse` | `primary-900` | #1E3A8A | Sidebar background only |

### Surfaces, text and borders

| Token | Tailwind | Value | Use |
|---|---|---|---|
| `--surface-page` | `bg-surface` | #F8FAFC | App background |
| `--surface-card` | `bg-white` | #FFFFFF | Cards, tables, dialogs, inputs |
| `--surface-muted` | `bg-neutral-50` | #F9FAFB / #FAFAFA | Table header, read-only and disabled fields |
| `--surface-sunken` | `bg-neutral-100` | #F3F4F6 | Chips, icon wells, skeleton base |
| `--text-strong` | `text-text-primary` | #0F172A | Headings, amounts, body in tables |
| `--text-muted` | `text-neutral-600` | #4B5563 | Labels, secondary copy |
| `--text-subtle` | `text-neutral-500` | #6B7280 | Hints, meta, placeholders (4.8:1 on white) |
| `--color-border` | `border-surface-border` | #E5E7EB | Hairline on cards, tables and bars |
| `--border-strong` | `border-neutral-300` | #D1D5DB / #D4D4D4 | Input borders, secondary buttons |

Never put body text lighter than `neutral-500` on white.

### Status

Each status has a solid colour (dot, bar, solid button) and a tinted trio for badges and alerts:

| Status | Solid | `fg` text | `bg` tint | `border` | Meaning |
|---|---|---|---|---|---|
| success | `bg-success` #059669 | `text-success-fg` #047857 | `bg-success-bg` | `border-success-border` | Paid, posted, synced, profit |
| warning | `bg-warning` #D97706 | `text-warning-fg` #B45309 | `bg-warning-bg` | `border-warning-border` | Partial, due soon, low stock, unsaved |
| error | `bg-error` #DC2626 | `text-error-fg` #B91C1C | `bg-error-bg` | `border-error-border` | Overdue, failed, validation, loss, destructive |
| info | `bg-info` #3B82F6 | `text-info-fg` #1D4ED8 | `bg-info-bg` | `border-info-border` | Neutral notices, tips, sync state |

### Accounting colour rules

- `--amount-negative` (error-fg) is for **amounts owed or overdue**, and for losses. `--amount-positive` (success-fg) is for **received or credit** amounts, and for profit. Ordinary invoice totals stay `text-text-primary`, not green.
- Debit and credit columns are not coloured by default. Colour the **balance** only, and only when its sign carries meaning (for example, a customer owes us).
- Never rely on colour alone. A red balance also carries a "Due" label or a minus sign.

### Charts

The palette is ordered, so always assign series in this order: `--chart-1` blue #2563EB, `--chart-2` teal #0D9488, `--chart-3` amber #D97706, `--chart-4` violet #7C3AED, `--chart-5` pink #DB2777, `--chart-6` slate #64748B.

- Grid lines use `--chart-grid`; axis text uses `--chart-axis` at 12px.
- Use one colour for a single series.
- Prefer bar and line charts. Use a legend instead of pie-slice labels, and no 3D or gradients.

### Dark theme

Dark values exist for every semantic token (`[data-theme='dark']`), but **the product ships light-only**. The old `prefers-color-scheme` auto-switch was removed: it turned token-driven parts of the dashboard dark while the rest stayed light. Dark mode can be enabled once the Stage 2 migrations have removed raw palette classes (DS-12).

---

## 2. Typography

**Fonts.** Inter for Latin. Noto Sans Arabic for Arabic, which is also the fallback for any Arabic glyph inside Latin text. Root size is 16px on phones (so iOS does not zoom on focus) and 14px from 769px up.

| Role | Tailwind | Size / line | Weight | Use |
|---|---|---|---|---|
| Display | `text-display` | 28 / 1.2 | 600 | Hero figure on the dashboard only |
| H1 | `text-h1` | 24 / 1.2 | 600 | Page title (desktop). Exactly one per page, via `PageHeader` |
| H2 | `text-h2` | 20 / 1.25 | 600 | Section title, page title on phones when shown |
| H3 | `text-h3` | 16 / 1.3 | 600 | Card title, dialog title (18px from md) |
| Body | `text-sm` / `text-body` | 14 / 1.5 | 400 | Default text, table cells, inputs (desktop) |
| Caption | `text-xs` / `text-caption` | 12 / 1.4 | 400–500 | Labels in cards, help text, meta, table headers |
| Micro | `text-micro` | 11 / 1.3 | 500 | Bottom-nav labels and `kbd` hints only. **Nothing smaller.** |

Rules:
- Weights are 400, 500 and 600 only. Use 700 only for printed totals.
- Table headers are 12px, semibold, uppercase, `tracking-wide`, `neutral-600`.
- Every amount, quantity, date column and invoice number uses `tabular-nums` (automatic in `.table` and `ModernTable`; use `.num` elsewhere). Amounts align right (end).
- Currency: show the code (AED, SAR) as a small prefix (`StatCard`) or column header; keep 2 decimals; never truncate an amount. Wrap or shrink it instead.
- Avoid `text-[10px]`, `text-[9px]` and `text-[13px]`. The pages still use 76, 1 and 14 of them (DS-11).

---

## 3. Icons

**Lucide only.** Stroke width is 1.75 in navigation and in the new primitives; the Lucide default of 2 is acceptable inside dense tables.

| Token | Size | Use |
|---|---|---|
| `--icon-xs` | 14px | Inline with 12px text, sort arrows, trends |
| `--icon-sm` | 16px (`h-4 w-4`) | Buttons, inputs, table row actions, alerts |
| `--icon-md` | 18px | Sidebar items, desktop top bar |
| `--icon-lg` | 20px (`h-5 w-5`) | Mobile top bar, bottom nav, dialog close |
| `--icon-xl` | 24px (`h-6 w-6`) | Empty and error states |

Rules:
- Icon-only buttons always have an `aria-label`, and their icon is `aria-hidden`.
- Directional icons (chevrons, arrows) get `rtl:rotate-180`.
- Each concept has one icon, and no two nav items share one.
- No emoji in the UI.

---

## 4. Spacing and layout

- **Scale.** 4px base (Tailwind default). Use 4, 8, 12, 16, 24 and 32 most of the time.
- **Page padding.** 16px on phones (`--content-padding-mobile`), 24px from md up. Maximum content width is 1280px (`max-w-content`).
- **Gaps.** 24px between page sections (`--section-gap`), 12–16px between cards in a grid, 16px between form fields, 4px between a label and its field.
- **Card padding.** 16px on phones, 20–24px from md up (`Card`, `.card`).
- **Grids.** Phone: one column, except KPI tiles, which are two. Tablet: two. Desktop: up to four KPI columns. Forms use two columns from md up.

### Breakpoints

| Name | Min width | Layout |
|---|---|---|
| (base) | 0 | Phone: top bar with menu, title and search; bottom nav; cards instead of tables; dialogs as bottom sheets |
| `sm` | 640px | Large phone: buttons sit inline, KPI icons appear |
| `md` | 768px | Tablet: 80px icon-rail sidebar, white top bar, tables, centred dialogs, 40px controls |
| `lg` | 1024px | Desktop: 240px labelled sidebar (collapse with Ctrl+\) |
| `xl` | 1280px | Wide desktop: content capped at 1280px |

Tested widths: 360, 390, 768, 1024, 1440.

### Layering (`z-*`)

| Tailwind | Value | Use |
|---|---|---|
| `z-sticky` | 20 | Sticky table headers, page action bars |
| `z-nav` | 30 | Sidebar, top bar, bottom nav |
| `z-dropdown` | 40 | Menus, popovers |
| `z-modal` | 50 | Dialog and its overlay |
| `z-sheet` | 60 | Bottom sheets above the bottom nav |
| `z-toast` | 80 | Toasts |
| `z-tooltip` | 90 | Tooltips |

The shell still uses `z-[9999]` for the impersonation banner and `z-[70]` for tooltips; both should move to these names (DS-10).

### Radius and elevation

- **Radius.** 6px (`rounded-md`) for controls and chips. 8px (`rounded-lg`) for cards, dialogs and table frames. 12px (`rounded-t-xl`) only for the top corners of bottom sheets. `rounded-full` only for badges, avatars and dots.
- **Elevation.** None on cards. `shadow-lg` only on overlays (menus, dialogs, sheets, toasts).

---

## 5. Buttons

`<Button>` (`ui/Button.jsx`) or the `.btn` classes.

| Variant | Use |
|---|---|
| `primary` | The one main action of the view: Save, Create invoice, Record payment |
| `secondary` | Cancel, Export, Print, Filter |
| `ghost` | Toolbar and low-emphasis actions; "More" |
| `outline` | Rare. An alternative main action next to a primary (Preview beside Save) |
| `danger` | Destructive confirmation inside `ConfirmDangerModal` only, never on the page |
| `icon` | Icon-only with an `aria-label` |

| Size | Height |
|---|---|
| `sm` | 32px. Dense desktop toolbars and inline actions inside alerts and cards |
| `md` (default) | 44px on phones, 40px from md up |
| `lg` | 44px |
| `icon` | 44px on phones, 36px from md up |

States:
- **Hover:** one step darker.
- **Active:** two steps darker.
- **Focus:** a 2px primary ring, keyboard only (`focus-visible`).
- **Disabled:** 40% opacity and `not-allowed`.
- **Loading:** spinner plus the original label, `aria-busy`, disabled.

Rules:
- One primary button per view. Further actions go into a secondary button or an `OverflowMenu`.
- Labels are a verb plus an object ("Save invoice", not "Submit").
- On phones, page-level actions stretch to full width (`PageHeader` does this). In dialog footers the primary button goes last on desktop and first, on top, on phones (`flex-col-reverse sm:flex-row`).

### Overflow menu

`OverflowMenu` (`ui/OverflowMenu.jsx`) is the "More" button for secondary page or row actions.

- Items: `{ label, icon, onClick, danger, disabled, hidden, separatorBefore }`.
- Destructive items go last, with `separatorBefore` and `danger`.
- Keyboard: arrows, Home/End, and Esc (which returns focus to the button). Clicking outside closes it.
- Rows are 44px on phones.
- Used on the Products header, Customers phone cards and Billing History phone cards.

---

## 6. Inputs, dropdowns and forms

Use `Input`, `Select` and `TextArea` from `components/Form.jsx`. They wire up the label, `aria-invalid`, `aria-describedby` and the error and help text for you. In custom markup use `.input`, `.label`, `.field-help` and `.field-error`.

**Field anatomy:**
- Label: 14px, medium weight, `neutral-700`. A required field adds a red `*`.
- Control: 40px tall (44px on phones), 6px radius, 1px `neutral-300` border, no shadow.
- Help text: 12px, `neutral-500`, below the control.
- Error text: 12px `error-fg`, which replaces the help text. The control also gets a red border and an icon.

**States:**
- Focus: primary border plus a 2px primary/30 ring.
- Error: red border with an error/20 ring.
- Disabled: `neutral-50` fill, grey text, `not-allowed`.
- Read-only: `neutral-50` fill, text still selectable.

**Mobile:**
- Font is 16px (enforced globally) so iOS does not zoom.
- Touch-size floor below md, set in `index.css` base:
  - inputs and selects inside `#main-content` get at least 44px; buttons and tabs at least 40px;
  - the rule uses zero specificity (`:where`), so explicit sizes still win;
  - opt out with `.btn-sm`, `data-size="sm"` or a `[data-dense]` container.
- Set `inputMode="decimal"` on amounts and `inputMode="numeric"` on TRN and phone numbers.
- Use `type="date"` for dates, and `enterKeyHint` where it helps.

**Layout:**
- Forms are one column on phones and two from md up. Group fields into `Card variant="form"` sections with an H3.
- The submit bar sits at the end. On long mobile forms it is sticky at the bottom (`z-sticky`) and padded for the safe area and the bottom nav.

**Validation:**
- Validate on blur and on submit, not on each keystroke.
- On submit, focus the first invalid field.
- Messages say how to fix the problem ("Amount must be greater than zero").

**Voucher-style screens** (POS, purchases, ledger filters): use `tallyFormClasses.js`. The lime 2px borders and blue-tinted sections were replaced with the neutral field style above.

---

## 7. Data tables and mobile cards

Use `ModernTable` (`ui/ModernTable.jsx`) for lists, or `.table` for hand-built tables.

**Structure:**
- The table sits in a white card with a hairline border.
- Header: `neutral-50` background, 12px uppercase labels.
- Rows: hairline separators, `py-2.5`, `hover:bg-neutral-50`.
- Number columns are `align: 'right'` with tabular figures.
- Row actions sit in the last column and do not trigger the row click.

**Sorting:**
- Headers are buttons and set `aria-sort`.
- Sorting is null-safe and numeric-aware.

**Pagination:**
- Shows "Page X of Y" with previous/next.
- From sm up, a windowed page list: 1 … 4 5 6 … 24, never all pages.

**States:**
- Loading shows `TableSkeleton`, never a spinner in an empty table.
- Empty shows the compact `EmptyState`, with a next action.

**Phones (below 768px).** Tables do not scroll sideways at page level. Two options:
1. **`mobileCards` (preferred).** Each row becomes a card:
   - The `mobile: 'title'` column is the heading; `mobile: 'subtitle'` goes under it.
   - The first right-aligned column becomes the amount on the end side.
   - The remaining columns become label/value pairs in two columns.
   - `mobile: 'hidden'` drops a column.
2. **Contained scroll.** For wide financial grids (VAT return, worksheet) the table may scroll inside its card. Keep the first column sticky, and the page itself must not scroll sideways.

`mobilePageUi.jsx` → `MobileLedgerTxnCard` is the ledger-specific card (debit, credit, balance).

---

## 8. Navigation

**Desktop and tablet shell** (`Layout.jsx`):

| Element | Rules |
|---|---|
| Sidebar | `primary-900` navy. 80px icon rail at md, 240px with labels at lg. Groups collapse. The active item is a `primary-600` fill. One thin scrollbar that shows on hover |
| Tenant identity | Shown once only: logo plus name in the sidebar header |
| Top bar | White, 64px, hairline bottom border. Holds search (Ctrl/Cmd+K), alerts and one account menu. No page title (pages render their own H1) and no second logo |

**Phones:**

| Element | Rules |
|---|---|
| Top bar | 56px: menu, page title, search |
| Bottom nav (`BottomNav.jsx`) | Home, Sale, Ledger, More. Labels are 11px. Sale is a flat pill, not a raised FAB |
| "More" | Opens `MoreMenuSheet` |

**In-page navigation:**
- `TabNavigation` uses underline tabs on a single row that scrolls sideways on phones, with `role="tablist"` and `aria-selected`.
- On phones, 4–5 icon tabs can use `MobileIconTabBar`.
- Breadcrumbs only on detail pages ("Customers / Al Noor Trading").

**No duplicates.** One `<header>` per screen, which belongs to the shell. `PageHeader` renders a `<div>`. Pages must not render their own top bar, logo or company name.

**Page titles on phones.**
- On exact list routes the mobile top bar names the page, so the shell sets `data-shell-title="page"` on `#main-content`. `index.css` then visually hides in-page `<h1>`s below md; they stay available to screen readers.
- Detail pages (`/customers/:id`, …) keep their `<h1>`, because it carries the record's name.
- Opt out with `data-keep-mobile`.

---

## 9. Cards, dashboards and charts

- **`Card`** variants: `default`, `metric`, `form`, `table` (no padding) and `empty` (dashed). `CardHeader` gives a title, an optional description and actions on the end side. `elevated` and `glass` are legacy names and render as `default`.
- **`StatCard`** (KPI tile):
  - Content: a 12px label, then the figure (18→24px, tabular), then an optional change line.
  - The currency code is a small prefix so the figure never truncates.
  - `changeType` describes meaning, not sign: fewer overdue invoices counts as *positive*.
  - The icon is a neutral chip, hidden below 640px.
  - Pass `currency` from `useBranding().currency`. Do not rely on the AED default.
- **Dashboard layout:**
  - KPI row: 2 columns on phones, 4 on desktop.
  - Below the KPI row: a primary chart (8 of 12 columns), then a lists card (4 of 12).
  - At most one chart per row on phones, with a fixed height (240px phone, 280–320px desktop).
- **Charts:**
  - Use the chart palette, a 12px axis and horizontal grid lines only.
  - Tooltips show the full formatted amount, axis ticks use compact form (12.4K).
  - Do not use pie charts with more than 5 slices; use a bar chart instead.

---

## 10. Loading and progress

| Situation | Use |
|---|---|
| Route chunk loading | `PageLoading` (spinner plus "Loading this page…") |
| List or table first load | `TableSkeleton` (desktop), `ListSkeleton` (phone cards) |
| KPI row | `KpiSkeleton`, or `StatCard loading` |
| Card or panel | `CardSkeleton`, `LoadingSkeleton variant="line" | "chart"` |
| Button action | `Button loading`: keep the label, disable, `aria-busy` |
| Known-length work (import, backup, upload) | `ProgressBar` with label and % |
| Blocking full-screen wait | `LoadingOverlay`. Avoid it; use only when the user must not interact (e.g. restoring a backup) |

Rules:
- Skeletons match the final layout so nothing jumps when content arrives.
- Refreshing data that is already on screen does not blank it. Show the old data and a small spinner in the toolbar.
- Every loading group has `role="status"` and a label.

---

## 11. Feedback: success, warning, error, empty

| Component | When |
|---|---|
| Toast (`react-hot-toast`, top-right, max 3, 3s) | Confirm a completed action: "Payment recorded". Never for errors that need action |
| `Alert` (inline) | A persistent message about this page or form: VAT deadline, low stock, a save error. Errors and warnings use `role="alert"` |
| Field error | Validation for one field (`Input error=…`) |
| `Badge` | The status of a record (Paid, Partial, Overdue, Draft). `dot` for dense tables |
| `EmptyState` | No data yet, or no results. Say what is missing and give one next action. Use `compact` inside tables and cards |
| `ErrorState` | A panel or page failed to load. Plain words, plus a "Try again" button. Never raw exception text |
| `ConfirmDangerModal` | A destructive action. State the consequence ("Deletes INV-12 and reverses stock") |

Copy: sentence case, no exclamation marks, no "Oops". Name the object and the amount when you can.

---

## 12. Modals, drawers and bottom sheets

| Component | Phone (< 768) | md and up | Use |
|---|---|---|---|
| `Modal` | Bottom sheet: full width, top corners rounded, max 92dvh, safe-area padding | Centred dialog, max-width by `size` (sm 448 … full 1280) | Short tasks: record payment, edit an item, confirm |
| `Modal allowFullscreen` | Full screen | Dialog with a full-screen toggle | Large editors, invoice preview |
| `MobileSheet` | Bottom sheet with a grab handle | Bottom sheet up to lg, centred panel from lg | Filters, pickers, action lists |
| `MoreMenuSheet` | Bottom sheet | n/a | The "More" tab |
| Drawer (side panel) | Use `MobileSheet` | `QuotationProductDrawer` pattern | Pick from a list without leaving the page |

All of them:
- Have an overlay of `neutral-900/50`.
- Close on Esc; closing on overlay click can be configured.
- Move focus inside on open and return it to the trigger on close.
- Lock body scroll while open.
- Scroll their body, not the page.
- Keep the footer outside the scroll area, so Save is always visible.

`Modal` also traps Tab. Dialog titles are `<h2>` and are connected through `aria-labelledby`.

Do not nest dialogs. Put a confirmation inside the same dialog's footer, or close the first dialog before opening the next.

---

## 13. Motion

| Token | Value | Use |
|---|---|---|
| `duration-fast` | 100ms | Press feedback |
| `duration-ui` | 150ms | Colour, border and background changes on hover and focus |
| `duration-panel` | 200ms | Sheet slide-up (`animate-slideUp`), progress width |
| `ease-standard` | cubic-bezier(.2,0,0,1) | Entering elements |

Rules:
- No bouncing, scaling cards, parallax or looping decoration.
- The `shake` animation is reserved for a rejected PIN or password.
- `prefers-reduced-motion` turns all motion off globally (`index.css`).

---

## 14. Accessibility and keyboard

- **Contrast.** WCAG 2.1 AA: body text at least 4.5:1, so on white use no lighter than `neutral-500`. UI boundaries at least 3:1.
- **Focus.** Every interactive element shows a 2px primary ring on keyboard focus (`*:focus-visible` in `index.css`; `focus-visible:` on `Button`). Never write `outline-none` without a replacement.
- **Targets.** At least 44×44px on phones. At least 32px on desktop, except dense table controls, which must still be at least 24px (WCAG 2.5.8).
- **Semantics.**
  - Real `<button>` and `<a>` elements. One `<h1>` per page. Tables have `<th scope="col">`, and `<caption>` where the context is not obvious.
  - Status messages use `role="status"`; errors use `role="alert"`.
  - Icon-only controls have an `aria-label`; decorative icons are `aria-hidden`.
  - A "Skip to content" link exists in the shell.
- **Forms.** Labels are tied to their controls. Errors are linked with `aria-describedby`, and `aria-invalid` is set.

Global keyboard shortcuts:

| Key | Action |
|---|---|
| Ctrl/Cmd+K | Command palette: pages, customers, products, suppliers |
| `/` | Focus page search (ignored while typing in a field) |
| `?` | Shortcut help |
| Ctrl+\ | Collapse or expand the sidebar |
| Esc | Close the dialog, sheet or menu |
| F3, F4, F7–F10 | Existing go-to keys |
| POS keys | POS keyboard engine (unchanged) |

---

## 15. Responsive rules (summary)

1. No page-level horizontal scroll at any width (checked automatically in both specs).
2. Below md:
   - Tables become cards (or scroll inside their own card).
   - Dialogs become bottom sheets.
   - In-page H1s are hidden because the top bar shows the title. `PageHeader` handles this.
3. Fixed bottom UI (bottom nav, sticky submit bars) reserves its height plus `env(safe-area-inset-bottom)`, so nothing sits underneath it.
4. Action rows:
   - Never wrap into three or more lines.
   - Up to two buttons share the row; the rest go into an overflow menu.
   - Mobile tool strips scroll sideways (`MobileActionStrip`).
5. Test at 360, 390, 768, 1024 and 1440.

---

## 16. Arabic and English

- `<html lang dir>` is set before first paint from `hexabill_lang` (`main.jsx`). Under `[dir=rtl]` or `:lang(ar)` the Arabic-first font stack applies with line height 1.65.
- Mixed content: wrap Arabic names in `lang="ar"` (or `dir="auto"`) so they shape and align correctly inside an English UI. Customer and product names may be either language.
- Use logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `text-end`) in new code. Mirror directional icons with `rtl:rotate-180`.
- Numbers stay Western (0–9) and left-to-right in both languages. Amounts stay tabular. Apply `dir="ltr"` to the formatted amount span if the currency code jumps sides.
- Do not change the font weight for Arabic; 400, 500 and 600 render well in Noto Sans Arabic.
- Smoke test: `scripts/phase7-rtl-shell-smoke.mjs`. The design-system spec also checks RTL for overflow.

---

## 17. Print and PDF

Tax documents, which are generated server-side, follow the monochrome bilingual letterhead set by commits 92a5059 and d36f8f2:

- **Colour.** Black on white only. No brand fills, so faxes and photocopies stay legible. The tenant colour may appear only as a thin rule under the letterhead.
- **Page.** A4 portrait, 12–15mm margins. Header block: logo, legal name in English and Arabic, TRN, address. Then document title ("Tax Invoice / فاتورة ضريبية"), number, date.
- **Type.** 9–10pt body, 12–14pt title, tabular figures. Totals right-aligned and bold, with VAT shown separately and the total including VAT.
- **Content rules.**
  - Never print sample or placeholder TRNs.
  - Omit an empty customer-TRN line instead of printing a blank label.
  - Repeat the table header on every page, and keep rows from splitting across pages (`break-inside: avoid`).
- **Browser print (`window.print()`), as implemented in `index.css`:**
  - The shell never prints: the sidebar and skip link are `.no-print`, and header, nav, aside and buttons are hidden. The page content prints on A4 with 12mm margins.
  - A page that marks a region `.print-area` prints only that region. The VAT page keeps `.vat-return-print-area`.
  - The show rule uses the same `body:has(...)` prefix as the hide rule so it wins on specificity.
  - Table headers repeat on each page and rows don't split.
  - Verified with print emulation on /reports, /vat-return and /customers. Before this fix, Reports printed blank.

---

## 18. Tenant branding

| Element | Tenant-specific? | Source |
|---|---|---|
| Company name and logo | Yes. Shown once, in the sidebar header; also on login and documents | `useBranding()` → `companyName`, `companyLogo` |
| Favicon and document title | Yes | BrandingProvider |
| Currency | Yes | `useBranding().currency`. Pass it to `StatCard` and formatters. POS, the discount popup, the product drawers, Products and Quotations now read it instead of hardcoding "AED" |
| Identity accent `--tenant-brand` / `bg-tenant` | Yes, from `primaryColor` in settings (validated hex, else #2563EB) | BrandingProvider sets it on `<html>` |
| Buttons, links, focus, active nav, status colours | **No.** HexaBill primary always | Tokens |

Why the app chrome is not re-coloured per tenant:
- A tenant colour can fail contrast; yellow or light green on white, for example.
- It can clash with status meaning; a red brand colour would read as "error" on every button.
- HexaBill blue keeps every tenant accessible and consistent.

Use `--tenant-brand` only for the logo monogram fallback, a thin accent rule on printed documents, and the login brand panel.

Login on a tenant host shows the tenant name and logo with a "Powered by HexaBill" footer.
