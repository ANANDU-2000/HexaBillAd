# POS + Ledger UX — Local Test Script

**Commit to test:** `de653fd` — `feat(ui): POS keyboard contract, product picker panel, and ledger density`  
**App (local):** http://localhost:5173 (Vite default; check terminal if different)  
**POS route:** http://localhost:5173/pos  
**Ledger:** http://localhost:5173/ledger  
**Suppliers:** http://localhost:5173/suppliers  

Log in with your usual tenant Owner/Admin account before testing.

---

## A. POS keyboard-only (mouse unplugged or ignore mouse)

1. Open **POS** → click **Add Product Row** if cart empty.
2. Focus product search → type part of a product name → **↑ / ↓** to move highlight → **Enter** to select.
3. Focus should move to **Qty** → type qty → **Enter** → **Unit Price** → **Enter** → **Discount** → **Enter** (adds next row or advances).
4. Focus search again → **Esc** → search clears/blurs; row stays.
5. Type exact barcode/SKU/name with panel closed → **Enter** should select that product (or best single match).
6. **Ctrl+S** or **F9** → save invoice (same as Save button).
7. Confirm shortcut hint under **Add Product Row**:  
   `Tab = next field · Enter = select / next · Esc = cancel search · Ctrl+S / F9 = save`

**Pass if:** 3 products added and qty edited without mouse; save works via Ctrl+S/F9.

---

## B. Product picker panel (desktop)

1. Focus an empty row search field.
2. Confirm products open in a **right sidebar** (not a floating box over the header).
3. Scroll the cart/page — panel must **stay docked**, not jump to top-left.
4. Click a product row in the panel → same as Enter (product fills, focus Qty).
5. Click outside panel (not on search) → panel closes.
6. Click empty cart row body → search focuses and panel opens.

**Pass if:** no “Browsing all products” floating over HexaBill header.

---

## C. Product picker (mobile ~390px width)

1. DevTools → iPhone / 390px width.
2. Add product → search focus opens **bottom sheet**.
3. Pick a product → sheet closes; totals/Checkout still reachable above bottom nav.
4. Checkout sticky bar still above bottom nav (`~4.75rem`).

**Pass if:** sheet usable; Checkout not hidden under bottom nav.

---

## D. Totals & Payment layout (desktop / tablet)

1. On POS, check Totals card order:  
   INV Amount → VAT → Round Off → Discount → **Total** (largest) → Free sample checkbox.
2. Payment card: Method / Amount / quick amounts / Notes use same spacing as Totals.
3. At ~768–1024px: Totals/Payment **stack** (not a tiny squeezed column).
4. From large desktop (`lg+`): 3 columns Totals | Payment | Save.

**Pass if:** Total is the heaviest number; fields readable on laptop width.

---

## E. Density / icon actions

1. **Suppliers** table: Ledger / Edit / Delete are **icon-only** with hover tooltip (`title`).
2. **Supplier detail** ledger/purchases: **Pay** is icon-only with tooltip.
3. **Customer ledger** Actions: Return / PDF / Delete / Settle are icon-only with tooltips.
4. Resize to mobile: touch targets feel ~44px (not tiny icons only).

**Pass if:** tooltips readable; no missing actions.

---

## F. Regression smoke (must not break)

| # | Flow | Result |
|---|------|--------|
| 1 | Create **paid** invoice (Cash + amount) | ☐ |
| 2 | Create **credit** invoice (Pending / unpaid) | ☐ |
| 3 | Apply **line or invoice discount** | ☐ |
| 4 | **Hold** invoice → **Resume** | ☐ |
| 5 | Print / download PDF after save | ☐ |
| 6 | Supplier → Record payment (FIFO) | ☐ |

---

## Breakpoint checklist

| Width | POS keyboard | POS mouse | Product panel | Icon tooltips |
|-------|--------------|-----------|---------------|---------------|
| ≥1280 desktop | ☐ | ☐ | ☐ | ☐ |
| ~1024 laptop | ☐ | ☐ | ☐ | ☐ |
| ~768 tablet | ☐ | ☐ | ☐ | ☐ |
| ~390 mobile | ☐ (touch) | ☐ | ☐ | ☐ |

---

## Phase 2c checks (panel / chrome / summary)

1. Open panel empty search → **Recent** only after cart has products; otherwise browse only.
2. Panel wider (`w-96` / `xl:w-[26rem]`) — more of the product name visible.
3. On `/pos`: app header is shorter; Backup/Settings/P&L/Users icons hidden (sidebar still has them). Leave POS → full header returns.
4. Totals: red `-AED` when discount &gt; 0; **Grand Total** is largest number; Totals+Payment share one border.

## If something fails

1. Note: page + breakpoint + steps + screenshot.
2. Do **not** continue other flows until that regression is fixed/reverted.
3. Commit under test: `de653fd` (branch `main`, 1 commit ahead of origin until you push).
