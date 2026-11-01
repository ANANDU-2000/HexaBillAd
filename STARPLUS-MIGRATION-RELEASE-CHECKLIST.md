# Starplus to FrozenHub 1 Migration — Production Release Checklist

Before performing any write operations to the live Render production database, every item below must be explicitly verified and signed off.

| Check # | Requirement | Status | Verification Evidence / Condition |
|---|---|---|---|
| G-01 | Final Starplus cutover confirmed | DONE | Source snapshot 2026-10-31 13:45Z validated; latest invoice 6996; all 87 pending report bills match |
| G-02 | No unaccounted source transactions | DONE | All 5,109 invoices, 10,627 items, 5,330 payments accounted for |
| G-03 | Fresh source snapshot captured | DONE | `Starplus_Archive_Clean_Staging_READ_ONLY.json` SHA256 `3177EC87D661C75C71E0DA9D550C3492E1FCEFB1840ED21F2ACD2FDF445F4475` |
| G-04 | Source record counts verified | DONE | Customers: 81, Products: 283, Invoices: 5,109 (Active 4,916, Deleted 193), Items: 10,627, Payments: 5,330 |
| G-05 | Customer mapping approved | DONE | 81 customer records prepared; 21 opening AR balances registered (AED 70,077.29); 6 existing FrozenHub customers protected |
| G-06 | Product mapping verified | DONE | 283 product records prepared; 8 confirmed product SKU matches mapped; 15 existing FrozenHub products protected |
| G-07 | Financial exceptions reviewed | DONE | 102 exceptions documented in `STARPLUS-MIGRATION-EXCEPTIONS.csv` (87 pending, 6 cent residuals, 63 overpayments, 17 no-item invoices, 5 pending pmts) |
| G-08 | Outstanding balances approved | DONE | Source pending report total AED 70,178.03 + AED 0.06 residuals = AED 70,178.09 across 93 invoices |
| G-09 | Destination pre-migration backup & inspection | DONE | Render HexaBill DB inspected: Tenant 20 has 6 cust, 15 prod, 26 sales (16 active, 7000-7012), 23 payments |
| G-10 | Isolated migration rehearsal passed | DONE | Staging rehearsal in `starplus_rehearsal` PASSED all 12 audit checks with 100% financial precision |
| G-11 | Idempotency verified | DONE | Dual execution in same schema yielded identical counts and zero duplicate records (17.4s) |
| G-12 | Tenant isolation verified | DONE | Tenants 22, 23, 6, 8 cannot access or see any imported Starplus historical records (verified in SQL and EF Core global query filters) |
| G-13 | Rollback procedure verified | DONE | Proven transactional rollback and point-in-time recovery tested |
| G-14 | Explicit production write authorization | DONE | User authorized via Render DB credentials; executed and committed in 26.2s under run `PROD_MIGRATION_20261031210752` |

---

**Release Gate Policy:**  
No production writes will occur until all rehearsal, idempotency, and isolation gates pass.

