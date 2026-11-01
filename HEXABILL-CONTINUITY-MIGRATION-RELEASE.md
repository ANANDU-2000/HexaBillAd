# HexaBill ERP — Continuity Migration Release Readiness

## Release Plan
- **Release A (Hotfix)**: P0 Security & Schema Rectification
  - Remove hardcoded frontend fallbacks in `DashboardTally.jsx` and `ReportsPage.jsx`.
  - Fix EF Core schema mismatch in `LegacyEntities.cs`.
  - Execute additive DB schema fix (`DueDateSource`, `Notes`).
  - Deploy to Vercel and Render.
  - Verify FrozenHub 2 shows zero legacy data.
- **Release B**: Complete Unified Business Workflows (Customers, Customer Ledger, Billing History, Sales Ledger, Payments, Dashboard, Reports).
- **Release C**: Missing Historical Domains (Purchases, Purchase Items, Expenses, Stock History, Versions, Receipts).
- **Release D**: Approved Financial Cutover Integration (Zero double counting).
- **Release E**: Complete Production Acceptance & Sign-off.
