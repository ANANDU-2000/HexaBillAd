# UI inventory — first sweep (2026-11-12)

42 tenant routes × 390 × 844 (phone), synthetic tenant `gulfharvest`. Raw JSON:
`%TEMP%\opencode\ui-inventory\m390.json`, screenshots `%TEMP%\opencode\ui-inventory\m390\*.png`.
Repeat with `npx playwright test e2e/ui-inventory.spec.js --project=m390` (then `t768`, `d1440`).

## Result at a glance

| metric | result |
|---|---|
| horizontal overflow | **0 / 42 pages** |
| text below 12 px | **0 / 42** |
| controls below 44 × 44 | **24 pages**, 1–4 controls each |
| stuck spinner after load | none — corrected, see the note below |
| error card on screen | `/billing-history`, `/pending-bills`, `/documents`, `/vat-return` |
| page height > 2 000 px at 390 | `/settings` 4 727 · `/help` 3 506 · `/agreements/new` 2 821 · `/quotations/new` 2 716 · `/worksheet` 1 967 |

## Small-target offenders (44 px rule)

| page | count |
|---|---|
| `/pos` | 4 |
| `/products` | 3 |
| `/settings` | 3 |
| `/legacy/invoices` | 3 |
| `/dashboard`, `/billing-history`, `/worksheet` | 2 each |
| `/sales-ledger`, `/pending-bills`, `/payments`, `/customers`, `/quotations`, `/agreements`, `/delivery-notes`, `/returns/create`, `/stock-adjustments`, `/reports`, `/reports/outstanding`, `/profit-history`, `/daily-close`, `/vat-return`, `/documents`, `/route-map`, `/salary-certificates` | 1 each |

## Tall pages that need structure, not scrolling

- `/settings` 4 727 px — needs the sticky section index (already in the plan).
- `/help` 3 506 px — needs an accordion index.
- `/agreements/new` 2 821 px, `/quotations/new` 2 716 px — document editors; need sticky totals + step sections.
- `/worksheet` 1 967 px — needs a sticky filter bar.

## Failed requests — read the caveat before filing bugs

The sweep fired 42 page loads in 84 s, so the API rate limiter returned **429** for everything from
`/delivery-notes` onward. Those are sweep artifacts, not defects.

Requests that failed **before** the limiter kicked in, and were re-checked directly afterwards:

| endpoint | status | note |
|---|---|---|
| `GET /api/quotations` | 500 | "Failed to list quotations" |
| `GET /api/customers/pending-summary` | 500 | "Pending bills could not be loaded" |
| `GET /api/legacy/invoices/unified` | 500 | `UNIFIED_INVOICES_FAILED` |
| `GET /api/legacy/payments/summary` | 500 | "Internal server error" |
| `GET /api/payments` | 500 | "Payments could not be loaded" |

These ran against a **throwaway SQLite copy** of the dev database, which is known to be missing columns the
current code expects (the sales-ledger 500 was `no such column: p.LegacyInvoiceId`, fixed by adding the
column to the copy — no code change). Treat the five rows above as **schema drift in the copy until proven
otherwise**: verify each against a freshly migrated PostgreSQL test database before writing a bug or a fix.
`GET /api/reports/vat-return` returned 200 in the same pass, so the limiter had cleared.

## Second pass (same day) — touch-target sweep

Root cause found: the app's root font is 14 px, so Tailwind's rem spacing renders 12.5 % small
(`h-11` = 38.5 px, `h-8` = 28 px). Every "44 px" target written as `h-11` was really 38.5 px.

Changes:
- `tailwind.config.js` gains `h-touch` / `w-touch` / `min-h-touch` / `min-w-touch` = **44 px**.
- Shared `Button` sizes are now 44 px at touch widths and compact from `xl` up (was 40/36 px from `md`).
- `DateField`, `DateRangeFilter`, `OverflowMenu`: compact sizes moved from `md:` to `xl:`.
- Toast dismiss button gets a 44 × 44 hit area (was 24 × 24) — this alone was the only offender on 20 pages.
- Daily close status card: 40 px → 44 px.

Re-measured at 390: `/pos` 4 → 0, `/dashboard` 2 → 0, `/products` 3 → 0, `/sales-ledger` 1 → 0,
`/route-map` 4 → 1, `/worksheet` 2 → 3 (three stacked toasts in that capture, now 0).
`/settings` still reports two 12 × 13 inputs: those are the styled checkbox inside the toggle switch,
which is drawn larger than its input — reviewed, not a defect.

The inventory rule now ignores controls nested in a label that is already ≥ 44 px tall, so a checkbox
inside a 44 px row no longer counts as a small target.

## What the first sweep proves

1. The layout basics hold: nothing scrolls sideways, nothing is below the 12 px floor.
2. The remaining phone work is **density and hierarchy**, not breakage — except the five 500s above.
3. The "stuck spinner" on `/payments` and `/settings` was a **false positive in this sweep**: the detector matched
   `[role="status"]`, which is what the toast uses. The sweep now waits for spinners to settle and ignores anything
   inside the toast host. Re-measured: no page keeps a spinner after load.
4. Every page has at least one page-level scroll; the tall ones need in-page navigation.

Next sweep adds `t768` and `d1440`, and the loop in `docs/ui-loop-plan.md` takes one page per commit
from the wave table.
