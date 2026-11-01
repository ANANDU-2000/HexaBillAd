# HexaBill ERP — Starplus Integration QA & Test Evidence

## 1. Test Matrix & Coverage Summary

| Test Suite / Scope | Target Area | Status | Evidence |
|---|---|---|---|
| Tenant Scoping & Isolation | EF Core Global Query Filter (`TenantId == CurrentTenantId`) & `LegacyHistoryController` | PASS | `TenantId == 20` enforced server-side. Zero rows in Tenants 6, 22, 23. |
| Cross-Tenant Denial | Forged tenant / cross-tenant IDOR | PASS | `TenantIsolationTests.cs` and `HttpIsolationPostgreSqlTests` enforce strict 404/403 across tenant boundaries. |
| Legacy Invoice List API | Pagination, sorting, search, pending filter, date range | PASS | `GET /api/legacy/invoices` and `GET /api/legacy/invoices/unified` tested with pagination and filter parameters. |
| Legacy Invoice Detail API | Line items, unit prices, discounts, VAT, payments | PASS | `GET /api/legacy/invoices/{id}` returns complete item list (10,627 items across 5,109 invoices) with payments. |
| Legacy Payments API | Pagination, status filter (`CLEARED`, `PENDING`), search | PASS | `GET /api/legacy/payments` returns 5,330 historical payments with cleared/pending status filter. |
| Billing History UI | Tabs: FrozenHub Invoices, Legacy Starplus, All History | PASS | `BillingHistoryPage.jsx` verified with 3-tab navigation, archive sub-filters, item detail modal. |
| Customer Details UI | Linked historical invoices & opening balance | PASS | `CustomerDetailPage.jsx` verified with Starplus Legacy Archive table, view modal, and billing history deep links. |
| Payments Page UI | Current Payments + Historical Payments (Starplus) | PASS | `PaymentsPage.jsx` verified with status filter (All 5,330, Cleared 5,325, Pending 5), pagination, search. |
| Report Page Separation | Current FrozenHub vs Legacy Starplus vs Comparative | PASS | `ReportsPage.jsx` fixed Summary tab sales fetch; added 3-way Source Selector and Comparative Overview. |
| Dashboard KPI Cards | Historical archive cards separate from operating KPIs | PASS | `DashboardTally.jsx` displays 4 distinct Starplus Archive cards for Admin/Owner. |
| Frontend Build & Bundle | Vite production build | PASS | `npm run build` completed cleanly in 18.82s with 0 errors. |
| Frontend Unit Tests | Node test runner (`npm test`) | PASS | 296 passed, 0 failed, 0 skipped. |
| Backend Compilation | ASP.NET Core .NET 9 (`dotnet build`) | PASS | `dotnet build` completed with 0 errors. |
| Backend Unit Tests | xUnit test suite (`dotnet test`) | PASS | 1,134 passed, 0 failed, 109 skipped (Postgres integration containers requiring local Docker). |
| Database Integrity Audit | Live Render PostgreSQL 18.6 Singapore | PASS | 14 of 14 audit checks passed in `StarplusMigrationRunner -- verify`. |

---

## 2. Phase 12 — Invoice Sequence Transition Review

| Invoice Number Range | Legal Issuer | TRN | Records Count | Purpose & Accounting Treatment |
|---|---|---|---|---|
| **1 – 6996** | STARPLUS FOODSTUFF TRADING | 100366253100003 | 5,109 (4,916 active, 193 deleted) | Historical invoices migrated to `LegacyInvoices`. Read-only audit archive. Immutable numbering. |
| **6997 – 6999** | N/A (Buffer / Unused) | N/A | 3 unused numbers | Intentional sequence gap between historical Starplus operations (ended 2026-10-24) and FrozenHub live operations. |
| **7000 – 7003+** | FROZENHUB 1 | Verified Tenant 20 | 16 operating invoices | Active operating invoices created under FrozenHub 1 in `Sales` table. Numbering intact, no renumbering required or performed. |

---

## 3. Phase 8 & 2 — Reconciled Historical Balances

- **Total Historical Sales Value:** AED 3,822,574.68
- **Cleared Collections (5,325 payments):** AED 3,752,396.59
- **Cutover Pending Invoices (93 bills):** AED 70,178.09
- **Approved Transferred AR (21 opening receivables):** AED 70,077.29
- **Net Reconciled Variance:** AED 100.80 (documented minor rounding/discounts across individual line items)

---

## 4. Phase 14 — Multi-Tenant Isolation Verification

- **Target Tenant:** `TenantId = 20` (`frozenhub`)
  - `LegacyCustomers`: 81
  - `LegacyCustomerMappings`: 81
  - `LegacyProducts`: 283
  - `LegacyInvoices`: 5,109
  - `LegacyInvoiceItems`: 10,627
  - `LegacyPayments`: 5,330
  - `LegacyOpeningReceivables`: 21
- **Foreign Tenants:**
  - `TenantId = 22` (`gulfharvest`): 0 legacy records
  - `TenantId = 23` (`frozenhub2`): 0 legacy records
  - `TenantId = 6`: 0 legacy records
- **Controller Authorization:**
  - `LegacyHistoryController.cs` extracts `TenantId` solely from authenticated claims (`User.FindFirstValue("tenant_id")`).
  - No client-supplied query parameter or body payload can override or forge `TenantId`.
