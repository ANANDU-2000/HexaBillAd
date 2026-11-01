# HexaBill ERP — Final End-to-End Financial Data Reconciliation and Product Catalogue Integration
## Master Task Board

| Task ID | Phase | Description | Status | Evidence / Notes |
|---|---|---|---|---|
| TASK-P0-01 | Phase 0 | Re-verify Git environment, HEAD commit `6171d688`, Vercel & Render production state | IN_PROGRESS | Commit verified `6171d688`. Render DB connected. |
| TASK-P0-02 | Phase 0 | Create tracking files: TODO, PROGRESS, EVIDENCE | IN_PROGRESS | Created and actively updated. |
| TASK-P1-01 | Phase 1 | Re-query baseline counts & sums on live DB (81 cust, 283 prod, 5,109 inv, 10,627 items, 5,330 pmts, 1,563 purchases, 7,217 purchase items, 242 expenses, 23,237 movements) | PENDING | Comprehensive database queries. |
| TASK-P1-02 | Phase 1 | Reconcile every domain record-by-record and generate reconciliation reports | PENDING | Generate domain comparison logs. |
| TASK-P2-01 | Phase 2 | Fix FrozenHub 1 Historical Expenses: Implement tenant-safe unified expense read model | PENDING | `ExpenseService.cs` + `ExpensesPage.jsx`. |
| TASK-P2-02 | Phase 2 | Fix Expenses Page UI & filters (Today, Yesterday, Last 7d, Month, Year, All Dates, Custom, Category, Branch, Route, Search, Pagination, Sort, CSV, PDF, Category Breakdown, Ledger) | PENDING | Unified display without separate historical tab requirement. |
| TASK-P2-03 | Phase 2 | Fix Expenses Summary Statistics (Period Base, Period VAT, Period Gross, Historical vs Operating, Claimable vs Unclaimable) | PENDING | Eliminate fabricated / mismatched totals. |
| TASK-P2-04 | Phase 2 | Enforce Historical VAT rule (Starplus historical expense VAT does NOT post to current UAE VAT returns) | PENDING | Distinct accounting domain. |
| TASK-P3-01 | Phase 3 | Individual 242 Historical Expenses Audit: Compare SourceExpenseId, Category, Dates, Amount, VAT Rate/Amount, Tax Type, Notes | PENDING | Handle null TotalAmount (232 records) correctly. |
| TASK-P3-02 | Phase 3 | Generate `EXPENSE-RECONCILIATION.csv`, `EXPENSE-DATE-AUDIT.csv`, `EXPENSE-CATEGORY-AUDIT.csv` | PENDING | Pass/Fail/Review status per expense. |
| TASK-P4-01 | Phase 4 | Fix Purchases History & Reporting: Implement unified authorized purchase history in `PurchasesPage.jsx` & API | PENDING | 1,563 historical purchases + 7,217 purchase items. |
| TASK-P4-02 | Phase 4 | Purchases filters, pagination, CSV, PDF, and explicit status (Not Verified / Historical Status Unavailable, no fabricated Paid status) | PENDING | Transparent status representation. |
| TASK-P4-03 | Phase 4 | Generate `PURCHASE-RECONCILIATION.csv` & `PURCHASE-ITEM-RECONCILIATION.csv` | PENDING | Verified unit prices, VAT, totals. |
| TASK-P5-01 | Phase 5 | Audit Supplier Payment Status & FIFO Allocation: `PurchaseService.ComputeFifoPaymentStatusAsync()`, `SupplierService` | PENDING | Null AmountPaid / null PurchaseId handling. |
| TASK-P5-02 | Phase 5 | As-of Date Cutoff: Ensure 1 Nov 2026 payments (6976, 6978, 6988 = AED 1,651.13) do NOT settle 31 Oct as-of reports | PENDING | Strict cutoff enforcement. |
| TASK-P5-03 | Phase 5 | Generate `SUPPLIER-PAYMENT-STATUS-AUDIT.csv` & `PAYMENT-DATE-CUTOFF-QA.md` | PENDING | Supplier ledger, pending purchases KPI, overdue report reconciled. |
| TASK-P6-01 | Phase 6 | Read candidate products for FrozenHub 2 (Tenant 23) catalogue: 283 Starplus + 15 FH1 operating | PENDING | Candidate extraction & schema alignment. |
| TASK-P6-02 | Phase 6 | Deduplication & Conflict Analysis (287 distinct names, 293 SKUs, 11 duplicate names, 5 duplicate SKUs) | PENDING | Classify EXACT_MATCH, NEW_PRODUCT, DUPLICATE_CANDIDATE, SKU_CONFLICT, etc. |
| TASK-P6-03 | Phase 6 | Generate `FROZENHUB2-PRODUCT-IMPORT-PREVIEW.csv` and `FROZENHUB2-PRODUCT-DUPLICATES.csv` | PENDING | Reviewable preview prior to write. |
| TASK-P6-04 | Phase 6 | Prepare Idempotent Zero-Stock Catalogue Import script for Tenant 23 (Stock=0, no inventory movements, no financial transactions, unconfigured price safe guard) | PENDING | Dry-run & approval gated. |
| TASK-P7-01 | Phase 7 | Fix Report Calculation Consistency: Implement shared financial read model (OperatingActivity, HistoricalBusinessActivity, CombinedContinuityActivity, StatutoryAccountingActivity) | PENDING | `ReportService.cs`, `ExpenseService.cs`, `SalesVsExpenses`. |
| TASK-P7-02 | Phase 7 | Synchronize Dashboard, Expenses, Purchases, Sales Ledger, Reports, P&L, Daily Close, Exports | PENDING | Identical date/filter contracts. |
| TASK-P7-03 | Phase 7 | COGS and Profit Methodology Verification (no equating purchases with COGS, no fake profit metrics) | PENDING | Clear methodology labeling. |
| TASK-P8-01 | Phase 8 | Timezone & Date Audit: Asia/Dubai timezone, inclusive-start exclusive-end business-day ranges | PENDING | Date-only filters never cut off midday. |
| TASK-P8-02 | Phase 8 | Boundary test: 31 Oct 2026 vs 1 Nov 2026, month boundaries, All Dates | PENDING | Source, DB, API, UI comparison. |
| TASK-P9-01 | Phase 9 | Expenses & Purchases Month-by-Month Acceptance: Verify 2025-11 through 2026-06 expense months (242 records, AED 14,239.00) and all purchase months | PENDING | Month-by-month reconciliation. |
| TASK-P10-01 | Phase 10 | Payment Status & Balance Reconciliation: 5,330 historical payments + 16 cleared operating payments + 21 opening receivables | PENDING | Unambiguous cleared vs pending audit. |
| TASK-P11-01 | Phase 11 | End-to-End Page QA (Dashboard, Products, POS, Billing History, Sales Ledger, Customer Ledger, Payments, Purchases, Suppliers, Expenses, Reports, Outstanding, Daily Close, VAT Return, Print, PDF) | PENDING | Authenticated UI & API checks. |
| TASK-P12-01 | Phase 12 | Cross-Page Financial Invariants: Automated checks across pages for matching totals | PENDING | Mismatch detection and reporting. |
| TASK-P13-01 | Phase 13 | Automated PostgreSQL Integration Tests for Expenses, Purchases, FIFO, FH2 Catalogue, Tenant Isolation | PENDING | Integration tests execution. |
| TASK-P14-01 | Phase 14 | Security & Production Safety Audit: Tenant isolation, no IDOR, credential scrubbing, backup & rollback readiness | PENDING | Multi-tenant security guarantee. |
| TASK-P15-01 | Phase 15 | Release Staging & Verification (Release A, B, C, D, E) | PENDING | Incremental verified releases. |
| TASK-P16-01 | Phase 16 | Compile Required Documentation and Reconciliation Artifacts | PENDING | All CSV and Markdown deliverables. |
| TASK-P17-01 | Phase 17 | Final Acceptance Checklist Verification | PENDING | Gate review and sign-off. |

