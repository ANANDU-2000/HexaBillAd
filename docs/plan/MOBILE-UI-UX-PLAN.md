# HexaBill mobile UI/UX plan (iOS + Android web app) — 2026-10-18

Owner-supplied plan for the phone layout of the tenant web app. Evidence in the original: 242 phone-size screenshots (≈400 px), `BottomNav.jsx`, `Layout.jsx`, `DashboardTally.jsx`, `moreMenuConfig.js`. Screenshots may predate current code: re-check each item against the source before changing it. Progress is tracked in the table below and in `AI-ERP-TASK-TRACKER.md`.

## Principles
1. One screen, one job: main action within the first ≈700 px (390×844).
2. Cart and total stay visible while selling; customer/route collapse into one summary line that opens a sheet.
3. Sell first, report second.
4. Numbers agree: every Home figure uses the same period/definition; cost estimates go in a short note or info icon.
5. One primary full-width button per screen at the bottom; secondary actions in a "…" sheet.
6. Warnings use one colour and one place; yellow means "needs your action" only.
7. Lists beat tables on phones (cards with the key number on the right).
8. Every tap target ≥ 44×44 px; icon-only buttons get a label (`aria-label`) or overflow sheet.
9. Back means back; hamburger only on root tabs.
10. No horizontal page scroll; chip/tab rows may scroll with an edge cue.

## Phase 1 — P0
| # | Item | Status |
|---|---|---|
| 1 | Home (`features/dashboard/DashboardTally.jsx`): KPI cards, New sale + Receive payment, Needs attention (3 rows), charts/branches below, no duplicate buttons | **DONE locally 2026-10-18** (phone layout; see tracker). Open: period picker still drives all KPIs (plan wants KPIs fixed to today, period for charts only); "Net sales 0 vs Top customers 15.75" mismatch is backend data, not investigated |
| 2 | POS (`features/sales/pos/PosEnterprisePage.jsx`): one summary row for customer/branch/route/date, sticky total + Checkout, inline stock errors, bottom-sheet pickers | **PARTLY DONE 2026-10-18**: summary line + Bill details sheet done; sticky total + Checkout already existed; inline stock errors and picker sheets not started |
| 3 | Invoice preview: one Share sheet (WhatsApp/Email/PDF/Print), one New sale button, Return items into "…" | not started |
| 4 | Inputs ≥16 px on phones | already enforced globally (`index.css`, max-width 767px); NOT verified on a real iPhone |
| 4b | Header back/hamburger rule; icon buttons get labels and 44 px targets | not started |

## Phase 2 — P1
5 Checkout sheet order (quick amounts, Cash/Cheque/Online first) · 6 Ledger filter sheet; Add-customer mobile flow (Name + Phone, "More details") · 7 Price list as cards; route tabs as chip row; Users as cards with "…" actions (delete red, last, confirmed) · 8 Daily close as steps; VAT return status card + one Export sheet.

## Phase 3 — P2 (after Phase 2 verified)
9 Billing history, stock adjustments, worksheet, settings lists, yellow-box copy cleanup · 10 Android back-button handling and offline POS banner, tested on a real device.

## Verification (per AGENTS.md)
Widths 360/390/768/1024/1440; real flows saved and refetched (sale → checkout → share, add customer, payment, daily close, VAT export); one real iPhone and one Android before release; Playwright 390 px project per Phase 1 screen asserting no horizontal scroll, primary action in first screen, tap targets ≥ 44 px.

## Open decisions for the owner
1. Keep both **Sale** and **New** tabs? (Recommended: yes; centre button opens non-sale records only.)
2. Home "Owed to you": all customers or selected branch?
3. Hide the Email settings section until the feature works? (Recommended: yes.)
4. Minimum phone width: design at 390, test at 360 (recommended).
