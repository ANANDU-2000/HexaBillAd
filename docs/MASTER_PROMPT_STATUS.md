# Master prompt / backlog — implementation status

This file tracks **what is implemented in the repo** versus the master prompt and quick-reference backlog. It is the live status sheet; do not treat the master prompt file as authoritative for “already shipped” items.

**Last reviewed:** May 2026 (product detail + Tally forms wave)

## Recently shipped (UI / API)

| Area | What shipped |
|------|----------------|
| Sales ledger | Overdue-only filter + URL `overdue=1`, days overdue column, “Record payment” deep-link to ledger with `recordPayment` |
| Customer ledger | Opens payment modal when `recordPayment` query is present, then clears param |
| Customers | `sortBy` query; sort UI; WhatsApp actions; **Overdue (30d+)** tab (balance + stale activity) |
| Customers API | `GetCustomers` accepts `sortBy`; super-admin path uses same sort keys |
| Customer detail | Statement PDF date range + download |
| Products | **`/products/:id` detail page** (read-only + edit modal + adjust stock + recent movements); list **View** + row click; History link to stock adjustments |
| Reports | AI Insights tab behind `VITE_REPORTS_AI_INSIGHTS` (default off); **Route** report tab exists (`tab=route`) |
| Dashboard | `netVatPayablePeriod` owner card; lighter card chrome |
| POS | Tablet split; Enter-to-add-row; initial product focus; sticky mobile totals; **WhatsApp** on invoice success; mobile customer search `min-h-11` |
| Purchases / suppliers | **Tally voucher** shared field classes; mobile **accordion sections**; sticky save bar above BottomNav; supplier modals use same field heights |
| Reports / summary API | `SummaryReportDto.NetVatPayablePeriod` in `ReportService` |

## Still open (from context / files1)

| Item | Notes |
|------|--------|
| Low-stock WhatsApp alerts | Feature-flag + tenant setting (not shipped) |
| JWT refresh | Design only: `docs/JWT_REFRESH_SPIKE.md` |
| Invoice number concurrency audit | `docs/BACKEND_TRUST_TRANCHE_NOTES.md` |
| Recurring purchases / purchase return | Tier 2 — `docs/TIER2_IMPLEMENTATION_NOTES.md` |
| POS sticky bar / WA | Shipped; optional further 44px pass on every cart control |

## Trust / reliability tranche (tracked, not all coded)

See [`docs/BACKEND_TRUST_TRANCHE_NOTES.md`](./BACKEND_TRUST_TRANCHE_NOTES.md).

## Related docs

- [`files1/HEXABILL_QUICK_REFERENCE.md`](../files1/HEXABILL_QUICK_REFERENCE.md)
- [`docs/JWT_REFRESH_SPIKE.md`](./JWT_REFRESH_SPIKE.md)
