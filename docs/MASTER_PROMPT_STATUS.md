# Master prompt / backlog — implementation status

This file tracks **what is implemented in the repo** versus the master prompt and quick-reference backlog. It is the live status sheet; do not treat the master prompt file as authoritative for “already shipped” items.

**Last reviewed:** May 2026

## Recently shipped (UI / API)

| Area | What shipped |
|------|----------------|
| Sales ledger | Overdue-only filter + URL `overdue=1`, days overdue column, “Record payment” deep-link to ledger with `recordPayment` |
| Customer ledger | Opens payment modal when `recordPayment` query is present, then clears param |
| Customers | `sortBy` query (`balancedesc`, `activitydesc`, default name); sort UI; WhatsApp from phone (desktop + mobile) |
| Customers API | `GetCustomers` accepts `sortBy`; **super-admin** path applies same sort keys after search filter |
| Customer detail API | `LastActivity` on `CustomerDto` where mapped |
| Products | Link to stock adjustments filtered by `productId`; history URL support on `StockAdjustmentsHistoryPage` |
| Reports | “AI Insights” tab gated by `VITE_REPORTS_AI_INSIGHTS === 'true'` (default off) |
| Dashboard | Summary includes `netVatPayablePeriod`; owner-only dashboard card + link to Reports summary tab; reduced heavy shadows on key surfaces |
| POS | Tablet/desktop split (line items vs totals/payment); **Enter** on product search adds next row when dropdown closed; initial focus on first empty product row (new invoice) |
| Reports / summary API | `SummaryReportDto.NetVatPayablePeriod` populated from period VAT inputs in `ReportService` |

## Trust / reliability tranche (tracked, not all coded)

See [`docs/BACKEND_TRUST_TRANCHE_NOTES.md`](./BACKEND_TRUST_TRANCHE_NOTES.md) for invoice numbering audit, logging hygiene, JWT refresh spike pointer, and DB/report performance follow-ups.

## Related docs

- [`files1/HEXABILL_QUICK_REFERENCE.md`](../files1/HEXABILL_QUICK_REFERENCE.md) — page and flow reference (updated alongside this status)
- [`docs/JWT_REFRESH_SPIKE.md`](./JWT_REFRESH_SPIKE.md) — refresh-token design spike (no mandatory implementation)
