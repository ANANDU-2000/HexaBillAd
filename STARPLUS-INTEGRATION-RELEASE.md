# HexaBill ERP — Starplus Historical Migration Release Manifest & Runbook

**Document Version:** 1.0.0  
**Target Tenant:** FrozenHub 1 (`TenantId = 20`, Subdomain: `frozenhub`)  
**Target Legal Entity:** FROZENHUB 1 (TRN: Verified live)  
**Historical Legal Entity:** STARPLUS FOODSTUFF TRADING (TRN: `100366253100003`)  
**Production Backend:** Render Singapore (`hexabill:10000` / `https://api.hexabill.company`, `https://hexabill.onrender.com`)  
**Production Frontend:** Vercel (`https://hexabill.company`, `https://frozenhub.hexabill.company`)  
**Database:** Render PostgreSQL 18.6 Singapore (`dpg-d68jhpk9c44c73ft047g-a.singapore-postgres.render.com:5432/hexabill`)  

---

## 1. Release Manifest & Commits

- **Release Commit:** `7e2384be` (merged `origin/main` baseline `1e260f3f` with verified Starplus integration)
- **Previous Production Commit:** `1e260f3f624a9e0ecbf42fc9cef45571076c79d8`
- **Migration Run ID:** `PROD_MIGRATION_20261031210752`
- **Release State:** Local build, tests, and database validation **100% PASSED**.

---

## 2. Production Database Verification Summary

| Entity / Scope | Count / Amount | Audit Check Result |
|---|---|---|
| **LegacyCustomers** | 81 | `PASS` (Matches source 81) |
| **LegacyCustomerMappings** | 81 | `PASS` (81 rows in `public.LegacyCustomerMappings`) |
| **LegacyProducts** | 283 | `PASS` (Matches source 283) |
| **LegacyInvoices (Total)** | 5,109 | `PASS` (Matches source 5,109) |
| **LegacyInvoices (Active)** | 4,916 | `PASS` (Matches source 4,916) |
| **LegacyInvoices (Deleted Archive)** | 193 | `PASS` (Matches source 193) |
| **LegacyInvoiceItems** | 10,627 | `PASS` (Matches source 10,627) |
| **LegacyPayments (Total)** | 5,330 | `PASS` (Matches source 5,330) |
| **LegacyPayments (Cleared)** | 5,325 | `PASS` (Matches source 5,325) |
| **LegacyPayments (Pending)** | 5 | `PASS` (Matches source 5,525) |
| **LegacyOpeningReceivables** | 21 | `PASS` (Approved transferred AR) |
| **Cutover Pending Bills (93)** | AED 70,178.09 | `PASS` (Gross positive historical AR) |
| **Approved Transferred AR** | AED 70,077.29 | `PASS` (Approved transferred customer balances) |
| **Multi-Tenant Isolation** | Tenants 6, 22, 23 | `PASS` (0 legacy records across foreign tenants) |

---

## 3. Web Workflows & UI Integration

1. **Billing History (`/billing-history`):**
   - 3-Tab selector: `FrozenHub Invoices`, `Legacy Starplus Invoices`, and `All History`.
   - Sub-filters: `Active (4,916)`, `Pending (93)`, `Deleted (193)`, and `All (5,109)`.
   - Server-side pagination (`pageSize = 20`, options `[10, 20, 30, 50, 100]`).
   - "View Items" opens `LegacyInvoiceDetailModal`.

2. **Invoice Details (`LegacyInvoiceDetailModal.jsx`):**
   - Starplus Foodstuff Trading legal header and TRN `100366253100003`.
   - Itemized line items (10,627 historical items) with unit prices, discounts, VAT, and line totals.
   - Linked payments table showing method, amount, date, and cleared status.
   - Disclaimers for the 17 invoices without itemized line details.
   - Print-friendly layout.

3. **Customer Details (`/customers/:id`):**
   - Starplus Legacy Archive section displaying historical invoices.
   - Opening receivables balance displayed distinctly from operating receivables.
   - Deep links to `/billing-history?tab=legacy&search=<customer>`.

4. **Payments (`/payments`):**
   - Added `Historical Payments (Starplus)` tab.
   - Displays all 5,330 historical payments with status filter (`CLEARED` vs `PENDING`).

5. **Reports & Analytics (`/reports`):**
   - Fixed Summary tab sales query so Sales Trend chart matches KPI card values.
   - 3-way Source Selector: `Current FrozenHub (Active)`, `Legacy Starplus (Historical)`, and `Comparative Overview`.
   - Separate historical sales analytics and comparative financial summary.

6. **Dashboard (`/`):**
   - Starplus Historical Archive summary widget for Admin/Owner users with 4 clickable cards.

---

## 4. Test Evidence & Release Readiness

- **ASP.NET Core Backend Tests:** 1,134 passed, 0 failed.
- **React Frontend Tests:** 333 passed, 0 failed.
- **Backend Build:** 0 errors.
- **Frontend Build:** 0 errors (built in 19.66s).
- **EF Core Compatibility:** Verified no migrations alter or drop `Legacy*` tables.

---

## 5. Deployment Procedure & CI/CD Trigger

1. Fast-forward / merge `main` with verified commit `7e2384be`.
2. Push `main` to `origin/main` on GitHub (`https://github.com/ANANDU-2000/HexaBillAd`).
3. Render automatic webhook builds and deploys `backend/HexaBill.Api` as service `hexabill`.
4. Vercel automatic webhook builds and deploys `frontend/hexabill-ui` to `frozenhub.hexabill.company`.
5. Post-deployment verification on `https://frozenhub.hexabill.company`:
   - Login as Owner (`frozenhubfoods@gmail.com`).
   - Navigate to `/billing-history` -> click `Legacy Starplus Invoices` -> verify 4,916 active invoices.
   - Open invoice #6996 -> verify Starplus legal header, line items, and totals.
   - Navigate to `/payments` -> click `Historical Payments (Starplus)` -> verify 5,330 payments.
   - Navigate to `/reports` -> toggle `Legacy Starplus` and `Comparative Overview`.
