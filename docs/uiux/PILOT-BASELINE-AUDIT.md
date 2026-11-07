# Pilot baseline audit: Customers and Payments (before any redesign)

> **Scope change (owner, 2026-11-07): the app stays English-only. No Arabic translation, no RTL work, no bilingual printing in this programme. Only UI/UX fixes on the current ERP. Every Arabic/RTL item below is CANCELLED and kept only as history.**

Captured 2026-11-07, real Edge browser through Playwright, local synthetic tenant `gulfharvest-test` in a CLONED database (`hexabill_codex_browser_pilotvol_20261107`) with production-like volume: 221 customers (English, Arabic, very long names), 403 invoices, 250 payments (cash/cheque/online/debit, one returned cheque). The original synthetic database is untouched.

Spec: `frontend/hexabill-ui/e2e/ux-pilot-capture.spec.js` (stage `before`). Result: 8 of 8 captures ran (4 viewports x English/Arabic), 0 page errors.
Evidence: `docs/uiux/evidence/pilot-before/` (screenshots `<screen>-<lang>-<viewport>.png`, measurements `metrics-<lang>-<viewport>.json`).
Viewports: `t768` = 768x1024 portrait tablet, `d1024` = 1024x768 landscape tablet, `d1440` desktop, `m390` phone.

## Findings (each seen in a screenshot or measurement)

| ID | Sev | Screen / viewport | Finding | Evidence |
|---|---|---|---|---|
| B1 | P0 (Arabic) | all pages, `lang=ar`, d1024 | In RTL the sidebar is mirrored to the right but the page content is not offset, so the sidebar covers the content. Customer names and the page header are hidden behind it. Cause: physical `lg:pl-*` style offsets in the shell. | `customers-ar-d1024.png` |
| B2 | P1 | all pages, t768 | The 80 px icon rail breaks labels mid-word ("Dashboar/d", "Customer/s", "Payment/s", "Custome/r Ledger"). | `payments-en-t768.png` |
| B3 | P1 | Payments, d1024 and t768 | Records are 150-165 px tall cards. About 2.5 (landscape) to 3.5 (portrait) payments are visible per screen. The header block (title, tabs, description, buttons, filters, hint) takes about 330 px before the first record. A tablet landscape screen has room for a dense table with a sticky header. | `payments-en-d1024.png`, `payments-en-t768.png` |
| B4 | P1 | Payments, all | The tab "Historical Payments (Starplus)" with a hard-coded "5,330 Records" badge is shown to every tenant. It is a tenant-specific legacy feature with a literal count. Other pages (Expenses, Purchases) gate the same legacy data with an `isFrozenHub1` check; Payments does not. | `PaymentsPage.jsx` ~L729 |
| B5 | P2 | Customers, d1024 | At landscape tablet the list is a single-column card list with name, phone and "Dr: 1992.06 AED / Outstanding". No columns to compare balance, last payment or contact. About 8 customers per screen. | `customers-en-d1024.png` |
| B6 | P2 | Customers | "Ajman Frozen Goods 1, 10, 3, 4, 7, 9": sort order is alphabetical, not natural, so 10 comes before 3. Long names are truncated without a way to read them. | `customers-en-d1024.png` |
| B7 | P2 | Customers | Balance wording "Dr: 1992.06 AED" uses accounting shorthand that a shop owner may not read. | same |
| B8 | P2 | Payments | Smallest text is 10 px (below the design-system minimum of 12 px). 86-113 controls under 32 px on the desktop and landscape views (row checkboxes and icon buttons). | `metrics-en-d1440.json` |
| B9 | P1 (Arabic) | all pages | The interface has no Arabic text. Only the user's data (customer names) is Arabic. There is no translation layer in the app; `hexabill_lang` only sets `dir`/`lang`. | all `*-ar-*.png` |

## Measurement gap

The layout probe found no record rows at t768 and d1024 (its selectors did not match the card markup there), so first-record position and row height are only valid at d1440: Customers first record at y=281 (31% of the viewport) with 22 controls above it; Payments at y=376 (42%) with 26 controls above it. Tablet numbers above come from the screenshots, not the probe. The probe must be fixed before the after-run so the comparison is like for like.

## Not covered by this baseline

Real iPad/Android tablet touch behaviour, an on-screen keyboard, slow network, and print output. Dense-list performance with thousands of rows (the server pages at 100/25).

## Decisions from the owner (2026-11-07)

1. **Superseded the same day: English only. Arabic/RTL findings B1 and B9 are cancelled.** All i18n code written for it was reverted.
2. Tablet: 1024x768 landscape is primary, 768x1024 portrait gets equal testing.
3. Pilot screens: Customers and Payments.
4. Legacy POS: not touched. Production sets no `VITE_POS_ENTERPRISE_V2`, so production serves the new POS; the legacy page remains reachable only on a device with `localStorage.hexabill_pos_enterprise_v2=0`.
