# UI loop — plan and protocol (mobile → tablet → desktop)

Goal: every page of HexaBill looks and behaves like one premium iOS-grade product on a phone, then a
tablet, then a desktop — no page left with "web form" leftovers. This file is the operating manual for
the loop; `docs/mobile-ux-audit.md` holds findings, `docs/ui-inventory.json` holds raw measurements.

## 1. How the loop runs

One iteration = one page, one surface at a time, in this order: **390 → 768 → 1440**.
Do not move to the next surface until the current one passes the gate.

```
AUDIT   run e2e/ui-inventory.spec.js for the route; open the screenshot; list every defect
PLAN    pick the 1–3 fixes that change the most for that page; write them in the page's row
FIX     smallest change in the page's own files (no shared-component drift without a note)
VERIFY  screenshot again + measure; compare numbers before/after
RECORD  update docs/mobile-ux-audit.md row and the wave table below
COMMIT  one commit per page, message `ui(<page>): ...`
```

Hard rules
- No financial logic, VAT, stock or permission change in a UI iteration. If the page needs it, stop and report.
- One page per commit. Shared components (`TabNavigation`, `AppToaster`, `BottomNav`, `Layout`) are changed
  only with a note listing every page they touch, and re-verified on three pages.
- Every fix must keep 44 × 44 px targets and `env(safe-area-inset-*)` respect.
- Record the evidence: screenshot path, metric before, metric after. No "looks better" claims.

## 2. The per-page checklist (what "check everything" means)

For each page, on each surface, walk this list top to bottom:

1. **App bar** — back affordance, title size/weight, max 2 actions + overflow, no duplicated title.
2. **Tabs / subtabs** — one row, scrolls with edge fade, active state obvious, badge alignment.
3. **Filters / controls** — collapsed by default, summary readable, reset reachable.
4. **Buttons** — one primary per screen, secondary = outline, destructive = red + confirm, all ≥44 px.
5. **Icons** — consistent stroke (1.75), 20/22 px, never the only cue for a destructive action.
6. **Inputs** — label above, currency prefix inside, 16 px on phones (no iOS zoom), numeric right-aligned.
7. **Scrollbars** — hidden on phone, visible on desktop, no horizontal scroll anywhere.
8. **Dividers / cards** — one radius scale (12/16), one border token, no double borders.
9. **Labels / text** — 17 screen title, 15 row title, 13 body, 12 floor; no all-caps body text.
10. **Money** — `tabular-nums`, one currency format, `—` when unknown, colour only for state.
11. **Loaders** — skeletons for lists/cards, spinner only for actions; never a blank screen.
12. **Empty state** — icon + one sentence + one action; never a dead end.
13. **Error state** — plain sentence, retry button, no raw exception text.
14. **Illustrations / 3D** — only where it earns space (empty states, onboarding, assistant); never behind data.
15. **Motion** — 180 ms sheet slide, 140 ms page/tab fade, 90 ms press scale, `prefers-reduced-motion` honoured.
16. **Thumb reach** — primary action in the bottom third; destructive and rare actions above the fold or in a sheet.
17. **Long content** — sticky section index or collapse; no 4 000 px scroll without navigation.
18. **Data density** — two numbers per card, meta on one line, no repeated zeros.

## 3. Measurements the loop records

`e2e/ui-inventory.spec.js` writes per route × surface:

| field | meaning | pass |
|---|---|---|
| `overflow` | page wider than viewport | false |
| `smallCount` | controls under 44 × 44 | 0 |
| `tinyCount` | text under 12 px | 0 |
| `bars` | fixed bars overlapping content | empty |
| `loader` | spinner present after load | false |
| `errorCard` | error card text on screen | false |
| `failed` | 4xx/5xx requests | empty |
| `height` | page height at 390 | recorded, reviewed |

## 4. Waves

Wave order is by daily pain, not by menu order.

| Wave | Pages | Why first |
|---|---|---|
| W1 | POS, Sales Ledger, Billing History, Pending Bills | money happens here every day |
| W2 | Dashboard, More, Assistant, Settings | first screen and navigation |
| W3 | Customers, Products, Price List, Suppliers, Purchases | master data |
| W4 | Payments, Expenses, Daily Close, Reports, Profit History, VAT Return, Worksheet | period close |
| W5 | Quotations, Agreements, Delivery Notes, Returns, Stock Adjustments, Salary Certificates | documents |
| W6 | Branches, Routes, Route Map, My Routes, Users, Audit, Backup, Documents, Legacy Invoices | admin |
| W7 | Profile, Help, Feedback, Onboarding, Login, Signup | edge journeys |

Each wave is a separate loop. A wave closes when every page in it passes the gate on all three surfaces.

## 5. Gates

- **Phone gate (390)** — no overflow, 0 small targets, 0 tiny text, no fixed bar over content, one primary action, first meaningful data above the fold.
- **Tablet gate (768)** — same, plus: two-column layouts keep one scroll axis, tables do not need horizontal scroll.
- **Desktop gate (1440)** — same, plus: content max-width respected, sidebar + content do not both scroll, keyboard focus visible.
- **Motion gate** — every sheet/menu/page transition uses the shared durations; `prefers-reduced-motion` disables transforms.

## 6. Reference discipline

Use Refero (MCP `refero`) per page, not once for the whole app:
- `refero_search_screens` with the page type (`ios`), e.g. "invoice list rows with amount status badge".
- `refero_search_flows` for journeys, e.g. cart → checkout, invoice → record payment.
- Take **patterns**, not skins: hierarchy, row anatomy, thumb placement, empty-state shape.
- Keep HexaBill's tokens (primary `#1e3a8a`, accent `#10B981`, 12 px text floor). No new palette per page.

## 7. Current status

See the wave table in `docs/mobile-ux-audit.md` for page-level findings. Inventory sweep is repeatable:

```powershell
cd frontend\hexabill-ui
npx playwright test e2e/ui-inventory.spec.js --project=m390   # phone
npx playwright test e2e/ui-inventory.spec.js --project=t768   # tablet
npx playwright test e2e/ui-inventory.spec.js --project=d1440  # desktop
```

Artifacts: `%TEMP%\opencode\ui-inventory\<viewport>\<page>.png` and `<viewport>.json`.
