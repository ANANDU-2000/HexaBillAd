# HexaBill ERP — Continuity Migration Financial Reconciliation

## Source vs Destination Reconciliation Matrix

| Domain | Source Starplus | Migrated Legacy (Tenant 20) | Destination Operating (Tenant 20) | Reconciled Status |
| :--- | :--- | :--- | :--- | :--- |
| **Customers** | 81 | 81 mapped | 84 operating (includes new) | MATCHED |
| **Products** | 283 | 283 mapped | 15 operating | MATCHED |
| **Sales Invoices** | 5,109 (4,916 active, 193 del) | 5,109 (4,916 active, 193 del) | 26 operating (range 7000+) | MATCHED |
| **Invoice Items** | 10,627 | 10,627 | Operating line items | MATCHED |
| **Payments** | 5,330 (5,325 clear, 5 pend) | 5,330 | Operating collections | MATCHED |
| **Purchases** | 1,563 | Missing (Release C) | 10 operating | PENDING MIG |
| **Purchase Items**| 7,217 | Missing (Release C) | Operating purchase lines | PENDING MIG |
| **Expenses** | 242 | Missing (Release C) | 0 operating | PENDING MIG |
| **Stock Trans.** | 23,237 | Missing (Release C) | Current stock moves | PENDING MIG |
| **Invoice Vers.** | 1,592 | Missing (Release C) | N/A | PENDING MIG |
| **Receipts** | 41 | Missing (Release C) | N/A | PENDING MIG |
| **Allocations** | 184 | Missing (Release C) | N/A | PENDING MIG |

---

## Cutover Financial Attribution
- **Historical Sales Total**: AED 3,817,356.88
- **Historical Paid Total**: AED 3,747,182.98
- **Positive Outstanding (Cutover AR)**: AED 70,178.09
- **Approved Transferred AR (21 Customers)**: AED 70,077.29
- **Unassigned Cash Customer Invoice 2158**: AED 100.80
- **Reconciliation Proof**:
  $$\text{AED } 70,077.29 + \text{AED } 100.80 = \text{AED } 70,178.09 \quad (\Delta = 0.00)$$
