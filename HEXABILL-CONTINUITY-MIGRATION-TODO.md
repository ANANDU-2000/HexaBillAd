# HexaBill ERP — Starplus to FrozenHub 1 Continuity Migration TODO

## Mission Summary
Transition from a separate, isolated Starplus historical archive to an end-to-end integrated business continuity workflow within the standard HexaBill ERP application for FrozenHub 1 (Tenant ID: 20). Completely isolate FrozenHub 2 (Tenant ID: 23). Resolve backend schema mismatch and cross-tenant data exposure. Complete missing migration domains (Purchases, Expenses, Inventory, Versions, Receipts).

---

## Task Matrix

| Task ID | Release | Module | Description | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Release A | Security / Dashboard | Remove hardcoded financial fallbacks & standalone Starplus card in `DashboardTally.jsx` | **IN PROGRESS** |
| **SEC-02** | Release A | Security / Reports | Remove hardcoded financial fallback totals in `ReportsPage.jsx` | **IN PROGRESS** |
| **SEC-03** | Release A | Security / Multi-tenant | Ensure FrozenHub 2 (Tenant 23) displays ZERO Starplus legacy data and cannot access legacy endpoints | **NOT STARTED** |
| **API-01** | Release A | Database / EF Core | Resolve `LegacyInvoices` schema mismatch (`DueDateSource`, `Notes`, `ItemsCount`, `SourceExternalReference`) | **IN PROGRESS** |
| **API-02** | Release A | Backend / Endpoints | Verify real PostgreSQL execution for all `/api/legacy/*` endpoints (returns 200 with tenant context) | **NOT STARTED** |
| **UI-01** | Release B | Billing History | Unify Billing History: single chronological list of operating & historical invoices by default | **NOT STARTED** |
| **UI-02** | Release B | Customer Ledger | Integrate historical and operating invoices/payments into seamless running balance ledger | **NOT STARTED** |
| **UI-03** | Release B | Customers | Surface mapped business customers in normal Customers list with linked history | **NOT STARTED** |
| **UI-04** | Release B | Sales Ledger | Full chronological sales ledger with source-preserving read models and drill-down | **NOT STARTED** |
| **UI-05** | Release B | Payments | Unify Payments: chronological list of historical and operating collections (Cleared/Pending/Voided) | **NOT STARTED** |
| **UI-06** | Release B | Invoice Print | Retain original issuer ("STARPLUS FOODSTUFF TRADING") and TRN for legacy invoices; FrozenHub for new | **NOT STARTED** |
| **MIG-01** | Release C | Purchases | Migrate 1,563 historical purchases & 7,217 purchase items into preserved schema & UI | **NOT STARTED** |
| **MIG-02** | Release C | Expenses | Migrate 242 historical expenses & 10 categories into preserved schema & UI | **NOT STARTED** |
| **MIG-03** | Release C | Inventory | Preserve 23,237 stock transactions without replaying historical movements to live stock | **NOT STARTED** |
| **MIG-04** | Release C | Versions & Receipts | Migrate 1,592 invoice versions, 41 receipts, and 184 receipt allocations | **NOT STARTED** |
| **FIN-01** | Release D | Accounting / AR | Reconcile AED 70,178.09 cutover AR = AED 70,077.29 approved opening + AED 100.80 Inv 2158 | **NOT STARTED** |
| **QA-01** | Release E | Acceptance | Automated real PostgreSQL browser tests on Desktop, Tablet, and Mobile across all pages | **NOT STARTED** |
| **REL-01** | Release E | Deployment | Verify Vercel (frontend) & Render (backend) production deployments and database integrity | **NOT STARTED** |
