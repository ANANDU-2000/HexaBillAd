# Cross-Page Consistency & Workflow Integrity Report

**Date:** 1 November 2026  
**Tenant:** FrozenHub 1 (`TenantId = 20`, Subdomain: `frozenhub.hexabill.company`)  
**Verified Release Commit:** `9d624745`  
**Pages Audited:**
1. Customer Ledger (`/ledger`)
2. Customer Bills Tab (`/ledger?tab=invoices`)
3. Customer Paid Tab (`/ledger?tab=paid`)
4. Billing History (`/billing-history`)
5. Sales Ledger (`/sales-ledger`)
6. Payments Register (`/payments`)
7. Reports Outstanding (`/reports?tab=outstanding`)
8. Dashboard KPIs (`/dashboard`)
9. POS Invoice Sequencing (`/pos`)

---

## 1. Cross-Page Consistency Matrix

| Record / Metric | Customer Ledger | Billing History | Sales Ledger | Payments Register | Reports Page | Dashboard | Statement PDF | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Cust 136 Total Invoices** | 112 | 112 | 112 | N/A | 112 | N/A | 112 | **PASS** |
| **Cust 136 Total Payments** | 113 | N/A | 113 | 113 | 113 | N/A | 113 | **PASS** |
| **Cust 136 Pending Bills** | 7 | 7 | 7 | N/A | 7 | N/A | 7 | **PASS** |
| **Cust 136 Balance** | 8,954.00 | 8,954.00 | 8,954.00 | N/A | 8,954.00 | 8,954.00 | 8,954.00 | **PASS** |
| **Invoice 6996 (Dreams Kitchen)** | AED 1,985.00 | AED 1,985.00 | AED 1,985.00 | AED 1,985.00 | AED 1,985.00 | N/A | N/A | **PASS** |
| **Invoice 6995 (Khan Darbar)** | AED 1,455.00 | AED 1,455.00 | AED 1,455.00 | N/A | AED 1,455.00 | N/A | N/A | **PASS** |
| **Invoice 2158 (Unassigned)** | Standalone | AED 100.80 | AED 100.80 | N/A | Standalone | N/A | N/A | **PASS** |
| **Operating Sequence** | N/A | 6997–7012 | 6997–7012 | 6997–7012 | 6997–7012 | N/A | N/A | **PASS** |
| **POS Next Invoice** | N/A | N/A | N/A | N/A | N/A | N/A | 7013 | **PASS** |
| **Total Cutover AR** | AED 70,077.29 | AED 70,077.29 | AED 70,077.29 | N/A | AED 70,077.29 | AED 70,077.29 | Reconciled | **PASS** |

---

## 2. Customer 136 (Chawarma Aalmashi Snack) Trace

- **Database IDs:** `DestinationCustomerId = 136`, `SourceCustomerId = 24`.
- **Bills Tab:**
  - 112 invoices displayed in reverse chronological order (from invoice 4403 down to invoice 141).
  - 7 pending bills displayed with `Historical` badge and amber highlight:
    * 4403: AED 945.00 Unpaid
    * 4383: AED 945.00 Unpaid
    * 4356: AED 2,917.00 Unpaid
    * 4330: AED 630.00 Unpaid
    * 4320: AED 851.00 Unpaid
    * 4299: AED 1,643.00 Unpaid
    * 4287: AED 1,023.00 Unpaid
  - Sum of pending amounts: **AED 8,954.00**.
- **Paid Tab:**
  - 113 historical payment transactions displayed.
  - Total Cleared Paid Amount: **AED 106,631.39**.
  - All payment dates, payment modes (Cash / Cheque / Bank Transfer), and references match Starplus records.
- **Statement Tab & Statement PDF:**
  - Generated dynamically via `/api/customers/136/statement?fromDate=2025-01-01&toDate=2026-11-01`.
  - Reconciles from AED 0.00 opening balance on 2025-01-01 to exactly **AED 8,954.00 closing balance** on 2026-10-31.
  - Zero double-counting: Opening receivable of AED 8,954.00 represents the historical ledger net balance, not an additive second debit.

---

## 3. Unassigned Historical Invoices (11 Invoices)

- **Source Integrity:** Exactly 11 historical invoices had no `SourceCustomerId` in Starplus.
  * 4 Active invoices:
    - 2158: AED 100.80 (2025-10-23, Cash Customer)
    - 2167: AED 52.50 (2025-10-24, Cash Customer)
    - 2182: AED 504.00 (2025-10-27, Cash Customer)
    - 2191: AED 399.00 (2025-10-28, Cash Customer)
  * 7 Deleted invoices (marked deleted in Starplus source).
- **Billing History Behavior:**
  * Active invoices are discoverable under Billing History with customer name displayed as `Cash Customer (Unassigned)`.
  * Invoice 2158 (AED 100.80) was **not** assigned to any named customer. Its balance is retained in total historical gross receivables without distorting any named customer ledger.

---

## 4. Invoices Without Item Rows (17 Invoices)

- **Source Limitation:** Exactly 17 active Starplus invoices totaling AED 8,332.67 contain no row records in the Starplus database `InvoiceItems` table.
- **HexaBill Handling:**
  * Preserved with accurate `GrandTotal`, `VatTotal`, `PaidAmount`, and `OutstandingCalculated`.
  * In the UI, the item section displays: *"Source Record: Line-item breakdown was not recorded in the legacy source database. Invoice totals and payment records are preserved."*
  * No synthetic or hallucinated item rows are generated.

