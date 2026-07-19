# HexaBill POS + Ledger UX Audit (Phase 0)

**Date:** 2026-07-19  
**Branch:** live working tree at audit time  
**Scope:** read-only inventory. No fixes proposed here.

## Master-plan contradictions / corrections

| Assumption in master plan | Live finding |
|---------------------------|--------------|
| `PosPage.jsx` ~3,671 lines | **~3,466 lines** |
| `CustomerLedgerPage.jsx` ~4,936 lines | **~4,918 lines** |
| `handleProductSearchKeyDown` at ~L761 | **Does not exist.** Product search inputs have no `onKeyDown`. Barcode field has inline Enter handler (~L2157). |
| Product dropdown `getBoundingClientRect` at ~L2317 / ~L2636 | Actual sites: **desktop ~L2190–2191**, **mobile ~L2465** |
| Cart Action buttons are icon+text | Cart Actions are **icon-only** Trash2 (already). Density work on POS is mainly **column widths** (`w-80`/`w-28`/…). |
| Save shortcut Ctrl+S / F9 | **Neither exists.** Save is click-only. Phase 1 may add Ctrl+S or F9. |
| Customer ledger F-keys incomplete | Window `keydown`: **F2** search, **F4** payment, **F5** statement, **F7** PDF (~L536–568). |

---

## PosPage.jsx

**Path:** `frontend/hexabill-ui/src/pages/company/PosPage.jsx`  
**Lines:** ~3466

### 1. Keyboard / focus / refs

| Line(s) | Symbol / API | What it does |
|--------|----------------|--------------|
| 129 | `customerInputRef` | Modal customer search input (~3006). No `.focus()` wiring found in-file. |
| 130 | `productSearchRefs` | Map index → product search input. Desktop ~2133, mobile ~2441. Focus after add-row; dropdown rect. |
| 131 | `lastAddedRowIndexRef` | Set in `addEmptyRow` (~648). Effect ~532–543 scrolls + focuses new row. |
| 532–543 | `useEffect([cart.length])` | Focus last-added product search after 300ms. |
| 1760–1761 | Hold modal | `autoFocus`; Enter → `handleHoldConfirm()`. |
| 2157–2172 | Barcode input (desktop) | Enter → barcode/SKU lookup → `addToCart(product, index)`. |
| 3088 | Edit-reason textarea | `autoFocus` only. |

**Absent:** `handleProductSearchKeyDown`, `onKeyUp`, `tabIndex`, Arrow/Enter/Escape on product search, document-level save shortcuts.

### 2. Positioning / dropdowns

| Line(s) | Kind | Description |
|--------|------|-------------|
| 1914 | `absolute` | Quick customer search under header. |
| 2102 | `relative` | Description cell for overflow escape. |
| 2181 | `absolute` | Desktop product dropdown caret. |
| **2183–2193** | **`fixed` + getBoundingClientRect** | Desktop product dropdown (`z-[10000]`, 600×500). **Detaches on scroll.** |
| **2460–2467** | **`fixed` + getBoundingClientRect** | Mobile product dropdown. |
| 2847+ | `fixed` | Mobile payment sheet / sticky bar / modals. |

### 3. Cart table column widths

| Col | Header `w-*` | Line |
|-----|--------------|------|
| SL | `w-12` | ~2079 |
| Description | `w-80` | ~2080 |
| Unit | `w-28` | ~2081 |
| Qty | `w-24` | ~2082 |
| Unit Price | `w-32` | ~2083 |
| Total | `w-28` | ~2084 |
| Discount | `w-24` | ~2085 |
| Vat | `w-28` | ~2086 |
| Amount | `w-32` | ~2087 |
| Actions | `w-24` | ~2088 |

Body cells mostly omit `w-*`; horizontal overflow driven by header fixed widths + table content.

### 4. Action column (cart)

Desktop ~2359–2367 / mobile ~2427–2434: **icon-only** Trash2 with `title` / `aria-label`. No icon+text in Actions.

### 5. Density tokens

Copy-paste Tailwind only (`py-3 sm:py-4`, `min-h-[52px]`, `text-base`). No shared ROW_HEIGHT / column-width constants.

### 6. Save shortcuts

None (Ctrl+S / F9 absent). Save via `handleSave` click (~2803 desktop).

### 7. Totals / Payment JSX

- Totals card ~**2621**
- Discount inside Totals ~**2694**
- Payment card ~**2730**
- Save column ~**2800**
- Mobile payment sheet ~**2846**

### 8. Cart helpers

- `addToCart` ~571–644; closes row dropdown on replace.
- `addEmptyRow` ~646–660 + `lastAddedRowIndexRef`.
- `showProductDropdown` keyed by index; open on focus / change.

---

## CustomerLedgerPage.jsx

**Path:** `frontend/hexabill-ui/src/pages/company/CustomerLedgerPage.jsx`  
**Lines:** ~4918

### 1. Keyboard / refs

| Line | Kind | What |
|------|------|------|
| 65–68, 76, 150, 153, 260 | `useRef` | Payment/customer load guards, search debounce, search input, filter debounce |
| 536–568 | `window` keydown | F2 search focus; F4 payment; F5 statement; F7 PDF |
| 2016 | `ref={searchInputRef}` | Search input |

No JSX `onKeyDown` / `tabIndex` / `autoFocus` on tables.

### 2. Positioning

No `getBoundingClientRect`. Customer results are in-flow panel (~2047). Sticky tabs/thead. Payments selection bar `fixed bottom-0` (~4430).

### 3. Tables

No column `w-*`. Tables use `min-w-[1000px]` / `w-full` + `overflow-x-auto`; mobile card alternates (`md:hidden`).

### 4. Icon+text row actions

Ledger desktop Actions (~3735–3798): Return, Return bill, Delete return, Settle credit.  
Invoices (~4118–4125): Pay (label hidden below `sm`). Other invoice actions icon-only.

### 5. Density

Copy-paste Tailwind; no shared density constants. Shared: `STATUS_PROP`, page size constants only.

---

## SuppliersPage.jsx

**Path:** `frontend/hexabill-ui/src/pages/company/SuppliersPage.jsx`  
**Lines:** ~694

### 1. Keyboard

None (`onKeyDown` / `useRef` / `autoFocus` absent).

### 2. Positioning

Search icon `absolute` (~261). No fixed dropdowns.

### 3. Tables

No column `w-*`. Desktop `hidden md:block` + `overflow-x-auto`; mobile cards.

### 4. Icon+text row actions

~381–391: **Supplier Ledger**, **Edit**, **Delete**.

### 5. Density

Copy-paste `px-2 py-1` / `text-sm` / `h-4 w-4`.

---

## SupplierDetailPage.jsx

**Path:** `frontend/hexabill-ui/src/pages/company/SupplierDetailPage.jsx`  
**Lines:** ~814

### 1. Keyboard

None.

### 2. Positioning

Sticky thead in bills mini-table (~402). No getBoundingClientRect popovers.

### 3. Tables

No column `w-*`. Multiple tables with `overflow-x-auto` only (ledger / purchases / payments).

### 4. Icon+text row actions

Ledger Pay ~583–594; Purchases Pay ~659–661. Payments Edit/Delete icon-only.

### 5. Density

Copy-paste Pay button classes; `tabs` / `DISCOUNT_TYPES` only as shared non-layout constants.

---

## SupplierLedgerModal.jsx

**Path:** `frontend/hexabill-ui/src/components/SupplierLedgerModal.jsx`  
**Lines:** ~254

### 1. Keyboard

None.

### 2. Positioning

None in-file (uses shared `Modal`).

### 3. Tables

Transactions table `w-full text-sm`; no column `w-*`; `overflow-x-auto`.

### 4. Icon+text row actions

None in table rows (toolbar Export CSV / Record Payment outside rows).

### 5. Density

Inline `p-2` / `text-sm` only.

---

## Phase readiness notes (facts only)

- Phase 1 must **introduce** product-search keyboard handlers and optional Ctrl+S/F9; extend `addEmptyRow` / `lastAddedRowIndexRef`, do not replace.
- Phase 2 must remove `fixed`+`getBoundingClientRect` product pickers (~2183, ~2460) in favor of a side panel / mobile sheet.
- Phase 3 density: Suppliers / SupplierDetail / CustomerLedger still have icon+text row actions; POS cart Actions already icon-only — focus POS on column width budget.
- Phase 3b: Totals ~2621, Payment ~2730.
