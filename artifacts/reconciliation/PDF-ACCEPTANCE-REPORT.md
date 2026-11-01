# PDF Acceptance & Financial Document Verification Report

**Date:** 1 November 2026  
**System:** HexaBill ERP — FrozenHub 1 (`TenantId = 20`)  
**Verified Backend Commit:** `9d6247455a7a184f4b956f8d61ced43c390d3454`  
**Render Environment:** `https://hexabill.onrender.com`  
**Artifact Dataset:** `artifacts/reconciliation/CUSTOMER-STATEMENT-QA.csv`

---

## 1. Executive Summary

All customer financial PDF generation pipelines have been independently tested and verified against the live Render PostgreSQL production environment.
- **Customer Statement PDFs (`/api/customers/{id}/statement`):** 100% PASS across all 26 audited accounts. Fully integrates historical Starplus invoices and payments chronologically when viewing periods prior to cutover (31 October 2026), with running balances reconciling to the exact cutover opening balance.
- **Pending Bills PDFs (`/api/customers/{id}/pending-bills-pdf`):** 100% PASS. Generates accurate itemized supporting bills for accounts with pending balances (e.g. Customer 136: 7 pending bills totaling AED 8,954.00) and provides deterministic 404 empty-state responses (`"No pending bills found for this customer"`) for cleared accounts without fabricating data.
- **Historical Invoice PDFs (`/api/legacy/invoices/{id}/pdf`):** 100% PASS. Preserves original Starplus legal issuer identity, TRN `100366253100003`, original invoice dates, item descriptions, quantities, and rates.

---

## 2. Customer Statement PDF Verification

| Customer ID | Customer Name | Date Range Tested | Status | Page Count | File Size (Bytes) | Closing Balance Reconciled |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **134** | DAR AL MANDI RESTAURANT & KITCHEN | 2025-01-01 to 2026-11-01 | **PASS** | 20 | 330,592 | AED 15,466.98 |
| **135** | DALLAS RESTAURANT LLC | 2025-01-01 to 2026-11-01 | **PASS** | 22 | 350,653 | AED 12,499.62 |
| **136** | CHAWARMA AALMASHI SNACK | 2025-01-01 to 2026-11-01 | **PASS** | 10 | 216,481 | AED 8,954.00 |
| **137** | DAR AL MANDI AL MUMAIZ | 2025-01-01 to 2026-11-01 | **PASS** | 30 | 434,167 | AED 8,258.90 |
| **138** | DREAMS KITCHEN | 2025-01-01 to 2026-11-01 | **PASS** | 5 | 160,999 | AED 5,301.75 |
| **139** | KHAN DARBAR RESTAURANT | 2025-01-01 to 2026-11-01 | **PASS** | 28 | 424,137 | AED 4,405.00 |
| **140** | STICK MAGIC RESTAURANT | 2025-01-01 to 2026-11-01 | **PASS** | 4 | 146,146 | AED 4,279.00 |
| **141** | TEA ISLAND CAFE | 2025-01-01 to 2026-11-01 | **PASS** | 23 | 356,880 | AED 3,376.15 |
| **142** | DAR AL MANDI KHALDIYA | 2025-01-01 to 2026-11-01 | **PASS** | 4 | 147,464 | AED 2,950.71 |
| **143** | ABAYAN MANDI REST & KITCHEN | 2025-01-01 to 2026-11-01 | **PASS** | 18 | 300,780 | AED 1,611.99 |
| **144** | FRESH SAMAWAR TEA CAFE. | 2025-01-01 to 2026-11-01 | **PASS** | 25 | 376,140 | AED 728.00 |
| **145** | CASH BILL VAHID | 2025-01-01 to 2026-11-01 | **PASS** | 4 | 147,291 | AED 511.00 |
| **146** | CASH BILL HUSSAIN | 2025-01-01 to 2026-11-01 | **PASS** | 1 | 112,641 | AED 420.00 |
| **147** | DALLAS ORIGINAL RESTAURANT | 2025-01-01 to 2026-11-01 | **PASS** | 10 | 214,032 | AED 343.00 |
| **148** | ELITE LEGAL TRANSLATION SOLE-LLC | 2025-01-01 to 2026-11-01 | **PASS** | 1 | 116,699 | AED 324.14 |
| **149** | KASHMIR SPICY RESTAURANT | 2025-01-01 to 2026-11-01 | **PASS** | 9 | 203,397 | AED 301.00 |
| **150** | NELLIKKA RESTAURANT | 2025-01-01 to 2026-11-01 | **PASS** | 4 | 147,666 | AED 144.00 |
| **151** | SHEGER RESTAURANT | 2025-01-01 to 2026-11-01 | **PASS** | 5 | 157,286 | AED 118.00 |
| **152** | TIKKA TOWN RESTAURANT | 2025-01-01 to 2026-11-01 | **PASS** | 23 | 360,343 | AED 83.00 |
| **153** | CRYSTAL FREEZE FOODSTUFF TRADING | 2025-01-01 to 2026-11-01 | **PASS** | 12 | 235,889 | AED 1.00 |
| **154** | TEA TREND CAFETERIA | 2025-01-01 to 2026-11-01 | **PASS** | 14 | 259,179 | AED 0.05 |
| **128** | DILKUSH CAFETERIA L.L.C-S.P.C | 2025-01-01 to 2026-11-01 | **PASS** | 1 | 115,213 | AED 0.00 |
| **130** | GOLDEN PLATE RESTAURANT | 2025-01-01 to 2026-11-01 | **PASS** | 1 | 113,609 | AED 0.00 |
| **131** | ISHAKALI RESTAURANT | 2025-01-01 to 2026-11-01 | **PASS** | 2 | 122,467 | AED 0.00 |
| **132** | GOLDEN EXPRESS RESTAURANT | 2025-01-01 to 2026-11-01 | **PASS** | 1 | 117,593 | AED 0.00 |
| **133** | SASAL NAKEL RESTAURANT | 2025-01-01 to 2026-11-01 | **PASS** | 1 | 117,531 | AED 0.00 |

---

## 3. Mandatory Customer 136 Verification

### Statement PDF (`customer_136_statement.pdf`)
- **HTTP Status:** 200 OK
- **Format:** `%PDF-1.7`, 216,481 bytes, 10 pages.
- **Transactions Listed:** 112 historical invoices + 113 historical payments sorted in chronological order.
- **Opening Balance:** AED 0.00 (as of 2025-01-01)
- **Closing Balance:** **AED 8,954.00**
- **Double Counting Check:** AED 8,954.00 matches both the Cutover Opening Receivable and the sum of the 7 pending invoices. Transferred receivable is not added twice.

### Pending Bills PDF (`customer_136_pending_bills.pdf`)
- **HTTP Status:** 200 OK
- **Format:** `%PDF-1.7`, 129,496 bytes, 1 page.
- **Invoices Included:**
  1. Invoice `4403` (2026-06-28): Original AED 945.00, Paid AED 0.00, Balance AED 945.00
  2. Invoice `4383` (2026-06-26): Original AED 945.00, Paid AED 0.00, Balance AED 945.00
  3. Invoice `4356` (2026-06-23): Original AED 2,917.00, Paid AED 0.00, Balance AED 2,917.00
  4. Invoice `4330` (2026-06-21): Original AED 630.00, Paid AED 0.00, Balance AED 630.00
  5. Invoice `4320` (2026-06-20): Original AED 851.00, Paid AED 0.00, Balance AED 851.00
  6. Invoice `4299` (2026-06-18): Original AED 1,643.00, Paid AED 0.00, Balance AED 1,643.00
  7. Invoice `4287` (2026-06-17): Original AED 1,023.00, Paid AED 0.00, Balance AED 1,023.00
- **Total Outstanding:** **AED 8,954.00** (100% exact match).

---

## 4. Legal Issuer & Branding Retention

- **Historical Starplus Invoices:**
  * Header Issuer: `STARPLUS FOODSTUFF TRADING`
  * TRN: `100366253100003`
  * Disclaimer: "Historical Archive Record — Issued by Starplus Foodstuff Trading prior to system migration."
- **FrozenHub 1 Invoices (6997–7012):**
  * Header Issuer: `FROZENHUB FOODSTUFF TRADING L.L.C - S.P.C`
  * Tax Identity: FrozenHub legal entity
- **Conclusion:** Tax compliance and audit trails strictly maintained without cross-entity commingling.

