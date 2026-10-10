# Bug Register (confirmed defects only)
Open legacy items tracked in `docs/plan/PRODUCTION-ISSUE-REGISTER.md`: PS-003/004/005/006/007/008/009/010/011/012/001/013.
| ID | Severity | Module | Reproduction | Root cause | Fix commit | Status |
|----|----------|--------|--------------|-----------|-----------|--------|
| B-001 | S2 | Print | Statement PDF for a tenant with no COMPANY_ADDRESS printed another business's address "Mussafah 44 - Abu Dhabi" | hard-coded fallback in CustomerService.GenerateCustomerStatementAsync | (this commit) | FIXED |
| B-002 | S2 | Auth | 5 failed logins in workspace A locked the same email in workspace B; success in B cleared A (PS-010) | lockout keyed by bare email | (this commit) | FIXED |
| B-003 | S1 | POS | Retry after lost create response could post a second invoice (PS-007) | no ExternalReference sent | (this commit) | FIXED (browser replay pending) |
| B-004 | S1 | Products | Editing any product through the UI/API set StockQty to 0 (stock loss without an inventory transaction; drift vs InventoryTransactions) | UpdateProductAsync honoured omitted StockQty (default 0) | (this commit) | FIXED. Production data check needed: products edited since this code shipped may have wrong StockQty; run read-only drift query (StockQty vs SUM InventoryTransactions) and repair via existing recompute-stock only with approval |
