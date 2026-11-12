# Mobile UX audit — 2026-11-12

Scope: the phone experience (360–430 px) of HexaBill on the real app (Vite + API, synthetic tenant
`gulfharvest`), plus the screens the owner sent in chat. Measurements were taken with Playwright at
390 × 844 on every route, then each screen was reviewed against iOS app patterns from Refero
(flows 6505 cart drawer, 12877 wallet balance + filterable history).

How to read severity: **P0** blocks or misleads money work · **P1** costs taps/time every day ·
**P2** polish that still reads as "web page, not app".

---

## 1. Global shell (every page)

| # | Sev | Problem | Evidence |
|---|-----|---------|----------|
| G1 | P1 | The floating "New" circle sits on the tab bar and covers the last row of content when a list scrolls under it. | `/dashboard` — "Nothing needs attention right now." is half behind the bar |
| G2 | P1 | Content padding is `pb-[4.75rem]` on `main`, but pages that add their own fixed footer (POS, Sales Ledger "Record payment", Settings save bar) sit on top of it, so the last control can hide. | `/settings` 4 727 px page, save bar overlaps the last card |
| G3 | P1 | A random "An error occurred. Please try again." toast fires on Dashboard, Customers and Products. Root cause: `PATCH /api/users/me/ping` returned **500** in the browser (works when called alone → concurrent-write failure). A presence heartbeat must never raise a user-facing error. | network sweep, `/customers` |
| G4 | P1 | No safe-area handling on the bottom bars: on a notched phone the Checkout/Save button sits under the home indicator. | POS bottom bar uses `bottom-0`, no `env(safe-area-inset-bottom)` |
| G5 | P2 | Headers differ per page: some have back arrow + title + 3 icons, POS has a dark strip with 6 controls, Dashboard has a bare title. No single "app bar" rule. | `/pos`, `/dashboard`, `/sales-ledger` |
| G6 | P2 | Page transitions exist (`hb-page-in`) but sheets, filters and tab switches have no motion language; taps give no haptic-like feedback on cards. | code review |

## 2. POS (the screen the owner uses all day)

| # | Sev | Problem |
|---|-----|---------|
| P1 | P0 | Line cards are ~200 px tall for one product: double padding, product header, 4-column grid with a full-width unit price row, then a grey 3-box strip repeating Total / VAT / Amount. Two items fill the whole screen. |
| P2 | P1 | The grey strip repeats numbers already shown in the bottom bar, and prints `0.00` three times when a price is missing — looks broken, not empty. |
| P3 | P1 | "Add Product to Bill" is a full-width primary-blue block above the cart, duplicating the `+` tab and F3. |
| P4 | P1 | Unit price field has no currency hint and is empty (`0`), while the total shows `0.00` — the cashier cannot tell "no price yet" from "free". |
| P5 | P1 | Header strip: invoice number, print, delivery note, hold, resume, new — six controls in 390 px, two of them permanently disabled with no explanation. |
| P6 | P2 | Customer row shows a floating `0.00 AED` with no label (it is the balance), and Branch/Route is a second full-width box. |
| P7 | P2 | Scan is an icon-only 44 px box with no label; the cashier has to know the icon. |

## 3. Sales Ledger

| # | Sev | Problem |
|---|-----|---------|
| L1 | P2 | Verified: the filter panel is **closed by default** (0 date inputs visible on load); the collapsed button showed `… → …` instead of a readable range, so it looked broken. Fixed to "Filters · Any date". | `/sales-ledger` at 390 |
| L2 | P1 | Two chip rows (Today…All dates, then Overdue/Newest/Oldest/filter/download) + a download button on its own line: four rows of chrome. |
| L3 | P1 | Each card repeated Bill / Paid / Pending / Days overdue / Balance / Mode as six equal tiles — no hierarchy, three of them zero. |
| L4 | P1 | "Record payment" is a full-width orange bar per card, the loudest thing on the screen for a secondary action. |
| L5 | P2 | Date inputs show `dd - mm - yyyy` placeholders in an order that does not match the app's `12-11` display. |

## 4. Dashboard

| # | Sev | Problem |
|---|-----|---------|
| D1 | P1 | Period chips wrap to three rows (Today / Week / 30 Days / Month, then Last Month / All Time / Custom) with Refresh orphaned on its own row. |
| D2 | P1 | Six KPI tiles at two per row with `0.00 AED` — half the first screen is zeros. |
| D3 | P2 | Quick actions mix arrows: `→`, `›`, none; "View Register →" wraps mid-phrase. |
| D4 | P2 | "Nothing needs attention right now." duplicates the empty state and is hidden behind the tab bar. |

## 5. Products

| # | Sev | Problem |
|---|-----|---------|
| PR1 | — | Verified OK: the tab strip scrolls horizontally with an edge fade (`TabNavigation`), it is not clipped. |
| PR2 | P1 | "Add product" wraps to two lines inside its button; the `1 total` pill floats alone. |
| PR3 | P2 | "Select page (1) — only the products shown here" is internal jargon above a per-card checkbox. |
| PR4 | P2 | Missing image renders a broken-image glyph instead of a neutral placeholder. |

## 6. Settings

| # | Sev | Problem |
|---|-----|---------|
| S1 | P0 | 4 727 px single column with no section index; a cashier changing VAT must scroll blind. |
| S2 | P1 | Tab strip (Company / Billing / Email / Noti…) is cut at the right edge. |
| S3 | P1 | The company-logo preview overlaps the text beside it. |
| S4 | P2 | Long help paragraphs (print margins, return policy) sit inline at the same weight as field labels. |

## 7. Assistant

| # | Sev | Problem |
|---|-----|---------|
| A1 | P1 | The privacy notice takes the top third and repeats twice before any answer. |
| A2 | P2 | Suggestion chips overflow the right edge with no scroll affordance. |

## 8. More sheet

| # | Sev | Problem |
|---|-----|---------|
| M1 | P2 | Section list is good; rows are 64 px, but "Ask the agent" is the only tinted row, so it reads as selected rather than special. |

## 9. Pages not visually reviewed yet (measured only)

`/payments`, `/expenses`, `/purchases`, `/reports`, `/daily-close`, `/billing-history` render without
horizontal overflow and with ≥44 px targets on the controls Playwright can see, but they were not
opened on a phone in this pass. They still need the same visual review before the plan is called done.

---

## Plan

### Phase 1 — stop the bleeding (P0)
1. `PATCH /api/users/me/ping` becomes best-effort: log and return 200, never 500, never a toast.
2. POS line card: one row `Qty · Unit · Price`, one compact totals line, card padding 12 px. Target
   ≤140 px per line at 390 px, two products visible without scrolling.
3. Sales Ledger: filters collapse behind the existing Filters button (closed by default), keep the
   active-filter count on the button.
4. Settings: sticky section index (Company / Invoice / Print / Return / …) so a section is one tap.

### Phase 2 — native feel (P1)
5. One app-bar component for every page: back arrow, 17 px semibold title, max two actions + overflow.
6. Bottom bars get `env(safe-area-inset-bottom)`; content padding follows the real bar height.
7. Remove the duplicated primary "Add" button from POS; `+` tab and F3 stay.
8. Empty money states: show `—` instead of `0.00` until a price exists.
9. Dashboard: period chips in one horizontal scroller; KPI tiles show only non-zero money by default.
10. Motion: 180 ms slide-up for sheets (already), 140 ms fade/translate on tab switch, 90 ms press
    scale on cards and rows, and a 120 ms cross-fade on route change. Respect `prefers-reduced-motion`.

### Phase 3 — craft (P2)
11. Products: scrollable tab strip with edge fade; neutral image placeholder.
12. Ledger cards: two numbers (Bill, Balance) + one status chip; "Record payment" becomes a 44 px
    ghost button in the card footer.
13. Assistant: collapse the privacy notice into a single line with a "Why?" link.
14. Typography: 17 px screen titles, 15 px row titles, 13 px meta, 12 px floor; one numeric style
    (`tabular-nums`, right aligned) everywhere money appears.

### Acceptance for the phase
- 360 and 390: no horizontal scroll on any audited route.
- Every control ≥44 × 44; no control inside `env(safe-area-inset-bottom)`.
- POS: two lines visible without scrolling; totals never print `0.00` for a missing price.
- Ledger: first invoice visible without scrolling on 390 × 844.
- No error toast on a normal navigation sweep of all 15 routes.
