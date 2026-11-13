# UI/UX + speed plan — 13 Nov 2026

Scope: shell (top bar), filters, Profit & Margin, data freshness, motion, notifications.
This is the working checklist. Each phase ships independently and is verified before the next.

## Findings (measured, not guessed)

| # | Finding | Evidence |
|---|---|---|
| 1 | Three back controls on Profit & Margin | `Go back` (hidden mobile header), `Back` (tablet/desktop header), `Back to Dashboard` (page) |
| 2 | The top bar spends 448px on a search field | Measured header button widths: `[.., 44, 69, 448, 44]` |
| 3 | Profit & Margin renders every invoice | `invoices.map(...)`, no slice/page size |
| 4 | Sales Ledger filters expand into a 3-column grid of labelled fields | `Filters` panel: date, customer, type, status, invoice, outstanding min/max, amount min/max |
| 5 | Activity Log needed sideways scroll on tablets | 6-column table from 768px; fixed by cards to 1280px |
| 6 | Create sheet scrolled sideways | body `scrollWidth 406` vs `clientWidth 390` (negative margins) |
| 7 | Bottom nav sat under content on tablets | `md:pb-6` overrode the 76px clearance; now 84px + safe area |
| 8 | Polling exists in several places with different rules | POS 30s, route map/pages, dashboard summary, alerts 60s, presence 180s, health 15s when down |
| 9 | No shared invalidation after a mutation | pages wait for manual refresh or their own interval |

## Phase 1 — Shell declutter (in progress)

- [x] Remove the in-page `Back to Dashboard` (shell already has Back).
- [x] Replace the 448px search field with a 44px icon button that opens the existing Ctrl/Cmd+K palette.
- [ ] Keep one action group on the right: New, alerts, avatar. Move Assistant into the account menu (optional, needs sign-off).
- [ ] Top bar 64px → 56px on tablet, sidebar header matched.
- [ ] Page heading spacing: title row directly under the bar, actions aligned to the title baseline.

Acceptance: no page has more than one back control; header height ≤ 56px on tablet; search reachable in one tap; no horizontal scroll.

## Phase 2 — Filters and dates (Sales Ledger, Profit & Margin, Billing History)

- [ ] One compact filter row: `This month ▾ | Filters (2) | Search | Clear`.
- [ ] Advanced filters in a popover/sheet (customer, status, type, invoice, ranges), not an always-open grid.
- [ ] Date inputs with a calendar icon inside, native picker, `dd-mm-yyyy` hint.
- [ ] Applied filters shown as removable chips under the row.
- [ ] Filters stay in the URL (already partly done) and survive back/forward.
- [ ] Presets as a compact segmented control or a menu, not six buttons.

Acceptance: the filter area occupies ≤ 96px closed; opening it does not push the table more than one viewport; keyboard and 44px targets kept.

## Phase 3 — Profit & Margin page

- [x] Pagination, 20 invoices per page (`x–y of n`, Previous/Next), resets on filter change.
- [ ] Sticky table header under the top bar.
- [ ] Tabs for `All bills` / `Margin issues` inside the card instead of two loose buttons.
- [ ] Compact summary cards (4 across, one row) with the margin badge inline.
- [ ] Expand/collapse all + remember expanded rows while paging.

Acceptance: page height is bounded, no endless scroll, 60 invoices load in one paint, keyboard accessible.

## Phase 4 — Data freshness and speed

- [ ] One rule for polling: `scheduler` only, visible tab only, 30–60s, jitter, no overlapping calls.
- [ ] Remove ad-hoc `setInterval` polling that duplicates `scheduler` (POS, legacy POS, admin pages).
- [ ] After a mutation (invoice, payment, stock, customer, expense) emit one event; affected lists refetch without a full reload.
- [ ] Refetch on tab focus only for pages that opted in, with a 30s throttle.
- [ ] Abort in-flight requests on unmount; ignore stale responses (request sequence id).
- [ ] Deduplicate reference data (products, customers, branches) with a short TTL cache.
- [ ] Verify no double initial fetch in production builds.
- [ ] Measure: interaction < 200ms, list paint < 300ms, no request storms in the network panel.

Acceptance: edits appear on the related screen without F5; no polling while hidden; no duplicate requests in a 60s window.

## Phase 5 — Motion, loaders, notifications

- [ ] Shared skeleton loaders for cards, tables and lists (no layout jump).
- [ ] Hover = background + border only; press = 0.98 scale on buttons; 120–160ms, `prefers-reduced-motion` respected.
- [ ] Page transition already exists (`hb-page-in`); make it 160ms and avoid double animation on tab changes.
- [ ] Success toast on every mutation (save, sync, export, delete), with the record name.
- [ ] Error toast with Retry; offline banner stays.
- [ ] Empty states: icon + one sentence + primary action.

Acceptance: every write shows a toast; no spinner without a skeleton on lists; animations do not fire more than once per navigation.

## QA matrix (every phase)

- Widths: 360, 390, 752, 768, 1024, 1280, 1440, 1920.
- Tablet portrait and landscape; phone with keyboard open; drawer open/closed.
- States: loading, empty, error, offline, long lists (500+ rows), slow 3G.
- Roles: Owner, Admin, Staff, owner-only pages.
- Checks: `npm test` (464), `npm run ui-lint`, `eslint`, `npm run build`, no console errors.

## References checked

- Shopify admin — compact filter row, grouped nav, pinned settings.
- Linear — command palette instead of a permanent search field, quiet active states.
- Stripe dashboard — one filter bar, chips for applied filters.
- Shopify/Stripe mobile — bottom sheets with 56–60px rows and icon tiles.
- Zendesk — a real icon rail is ≤ 8 destinations.
