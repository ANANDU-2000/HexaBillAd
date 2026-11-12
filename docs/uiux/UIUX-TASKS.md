# UI/UX redesign loop (owner-approved 2026-11-12)
Rule: Dashboard home cards, POS (all), Billing History/invoice screens are NOT edited (ui-lint PROTECTED list).
Direction: DESIGN-SYSTEM-V2 (one blue accent, white bordered cards, no left bars/caps/gradients), older-user comfort.
Loop per batch: change -> `npm run build` -> `npm run ui-lint` -> `e2e/ui-audit.spec.js` (m390,t768,d1440) -> screenshots -> commit.
Measured baseline (audit 2026-11-12, phone/tablet/desktop): tap<44 184/1878/1583, text<12px 14/12/21, low-contrast 15/15/14,
ALL-CAPS 69/79/326, cut-off text 23/14/48, unlabeled inputs 16/28/28, nested scroll 6/40/19.

## Batches
- [x] B0 ui-lint ratchet, Profit Inspector, Reports (restyle + toolbar + KPI)
- [ ] B1 shell: rail item width 48, comfort layer (<=1023px: controls >=44px), page transition, press feedback
- [ ] B2 mass restyle of all non-protected pages (caps, hues, amber, <12px, shadows, gradients, left bars) + white-on-orange contrast
- [ ] B3 Products (icon-only row actions need labels/menu, price nowrap, tab strip scroll cue, gap)
- [ ] B4 Sales Ledger (worst page), Outstanding, VAT Return, Delivery Notes
- [ ] B5 Settings (section picker, sticky save, mm fields with preview) 
- [ ] B6 unlabeled inputs + unnamed icon buttons (a11y names) across pages
- [ ] B7 /recurring-invoices and /routes redirects: explain or fix
- [ ] B8 Customers, Customer Ledger, Payments, Purchases, Expenses, Suppliers
- [ ] B9 remaining pages, Super Admin last
