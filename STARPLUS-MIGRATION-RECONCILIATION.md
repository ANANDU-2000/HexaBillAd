# HexaBill ERP — Starplus to FrozenHub 1 Financial Reconciliation

## 1. Pending Bills & Outstanding Ledger

### A. The 87 Pending Bills Report
- **Report Date:** 31 Oct 2026 13:36
- **Total Invoices Reported:** 87
- **Report Stated Total:** AED 80,636.39
- **Report Stated Paid:** AED 10,458.36
- **Report Stated Balance:** AED 70,178.03
- **Archive Match Rate:** 87 of 87 (100.00%)
- **Discrepancy:** AED 0.00 across all 87 invoices. Every invoice number, date, amount, paid amount, and outstanding balance in the report perfectly matches the Starplus database export.

### B. The 6 One-Cent Residual Invoices (AED 0.06)
In addition to the 87 pending invoices in the printed report, the database contains 6 invoices with an unpaid balance of exactly AED 0.01:
1. Invoice `6040` (Customer 76): Total AED 73.50, Paid AED 73.49, Balance: AED 0.01
2. Invoice `3639` (Customer 14): Total AED 200.00, Paid AED 199.99, Balance: AED 0.01
3. Invoice `3664` (Customer 14): Total AED 50.00, Paid AED 49.99, Balance: AED 0.01
4. Invoice `3704` (Customer 27): Total AED 225.00, Paid AED 224.99, Balance: AED 0.01
5. Invoice `3726` (Customer 27): Total AED 320.00, Paid AED 319.99, Balance: AED 0.01
6. Invoice `3756` (Customer 14): Total AED 50.00, Paid AED 49.99, Balance: AED 0.01
- **Sum:** AED 0.06
- **Total Positive Outstanding in Database:** AED 70,178.03 + AED 0.06 = **AED 70,178.09** across 93 invoices.
- **Accounting Policy:** These are preserved without silent round-off.

### C. Overpayments & Credit Discrepancies (AED 4.19)
- **Count:** 63 invoices where `PaidAmount > TotalAmount`
- **Total Excess Paid:** AED 4.19
- **Accounting Treatment:** Maintained as credit/overpayment adjustments linked to the customer accounts, not discarded or mixed with current revenue.

### D. Pending Payments (5 Transactions)
- **Count:** 5 payments in `Payments` table with `Status = 'PENDING'`
- **Total Value:** AED 3,509.13
- **Policy:** Never treated as cleared or received cash; flagged for reconciliation with bank statements.

---

## 2. Customer Balance Cache Discrepancy (76 of 81)
- In Starplus, 76 of 81 customer records have `Customers.PendingBalance` that diverges from the sum of unpaid invoices.
- **Rule:** Never use `Customers.PendingBalance` or `Customers.Balance` as target opening balance. All opening balances derive strictly from reconciled open invoices + unapplied payments.

---

## 3. Invoices Without Line Items (17 Active, 2 Deleted)
- 17 active historical invoices in Starplus have no records in `SaleItems`.
- **Preservation Policy:** Classified as `INCOMPLETE_SOURCE_ITEMS`. Grand total, paid amount, dates, and customer details are preserved in the legacy archive. Synthetic items will NOT be fabricated.

