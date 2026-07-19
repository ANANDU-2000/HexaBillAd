# Enterprise POS V2 — CHANGE SUMMARY

## Default (updated)
- **Enterprise is ON by default** for `/pos`.
- Opt out / rollback: `VITE_POS_ENTERPRISE_V2=false` or `localStorage.setItem('hexabill_pos_enterprise_v2','0')` then reload.
- Legacy side-drawer page remains at [`PosPageLegacy.jsx`](../frontend/hexabill-ui/src/pages/company/PosPageLegacy.jsx) for rollback only.

## Why the previous screenshot looked wrong
Cashiers were on **Legacy** (flag defaulted off). Legacy uses `w-[28rem] shrink-0` in a flex row, which **shrinks the invoice table**. Enterprise uses a **portal overlay** (`ProductDrawer`, 480px) so table width never changes.

## Shell contract
- [`PosShell`](../frontend/hexabill-ui/src/pages/company/pos/PosShell.jsx): `header` (≤56px) + `toolbar` (~48px) + scrollable body + `footer` (totals / payment / Save).
- Only the invoice table region scrolls; footer does not scroll away.

## Deterministic Interaction Engine (V2)
Modules under [`frontend/hexabill-ui/src/pages/company/pos/engine/`](../frontend/hexabill-ui/src/pages/company/pos/engine/):

| Module | Role |
|--------|------|
| `rowId.js` | Stable `rowId` per cart line (`createRowId`, `ensureCartRowIds`, `createEmptyLine`) |
| `PosLogger.js` | `posLog` — DEV only (`import.meta.env.DEV`) |
| `rowStateMachine.js` | `IDLE → SEARCHING → PRODUCT_SELECTED → EDITING_* → COMPLETED → SEARCHING` |
| `invoiceStore.js` | Zustand pointers: `activeInvoiceRowId`, `drawerOwnerRowId`, `rowPhase`, `drawerOpen`, … |
| `commands.js` | Pure command types (`SELECT_PRODUCT`, `COMMIT_ROW_AND_NEXT`, …) |
| `CommandDispatcher.js` | Single `dispatch` → store + cart (`flushSync` on structural cart updates) |
| `InteractionEffects.js` | Double `requestAnimationFrame` only for scroll/open/focus (**no `setTimeout`**) |
| `KeyboardEngine.jsx` | Single capture-phase document listener; cells use `data-pos-control` + `data-pos-row-id` |
| `usePosInteraction.js` | Hook wiring store + dispatcher into `PosEnterprisePage` |

### rowId migration
- Every cart line carries `rowId` (generated on add / ensured on load, draft restore, hold resume, undo).
- Product write target is `drawerOwnerRowId` (never array index).
- Discount Enter → `MOVE_NEXT_FIELD` → `COMMIT_ROW_AND_NEXT` (append empty line + open drawer + focus search in one path).
- Removed: `useEffect([cart.length])` delayed drawer open and setTimeout focus stacks for this flow.

### Perf / catalog
- **Table virtualization disabled** (was freezing UI around row ~24 when `cart.length > 40`: wrong scroll parent + nested `overflow-x-auto max-h-full`). Desktop always renders full `cart.map` keyed by `rowId`; single vertical scroller on `tableScrollRef`.
- Catalog remains client-only via `useProductCatalog`; barcode matches route through `SELECT_PRODUCT` (dispatcher).

### Blocker fixes (Jul 2026)
- `SELECT_PRODUCT` repairs ghost owner (empty line / new row) instead of silent reject; always closes drawer on failure.
- `removeFromCart` clears interaction pointers when deleted row was active.
- Cell focus resolves visible `[data-pos-control]` nodes (desktop wins over `md:hidden` mobile).
- `closeDrawer` no longer clears `focusedControl`; KeyboardEngine passes DOM `control` into `MOVE_NEXT_FIELD` so Discount Enter commits next row.

## Continuous billing
- Add Row → center scroll → overlay drawer → search focus.
- After Discount field Enter → new row + drawer opens again (one Enter).

## Verified
- `npm run build` — passed after interaction engine wiring + stuck-at-24 / F3-Enter blocker fixes.

## Not verified on hardware
- Live Discount-Enter → next-row drawer blink timing on cashier PC
- Overlay vs table box-model measurement
- Exact 18–20 visible rows @ 1920×1080
- Full F-key / barcode / draft restore smoke with default-on path
- Physical barcode wedge end-to-end
