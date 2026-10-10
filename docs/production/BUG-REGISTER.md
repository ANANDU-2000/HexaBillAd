# Bug Register (confirmed defects only)
Open legacy items tracked in `docs/plan/PRODUCTION-ISSUE-REGISTER.md`: PS-003/004/005/006/007/008/009/010/011/012/001/013.
| ID | Severity | Module | Reproduction | Root cause | Fix commit | Status |
|----|----------|--------|--------------|-----------|-----------|--------|
| B-001 | S2 | Print | Statement PDF for a tenant with no COMPANY_ADDRESS printed another business's address "Mussafah 44 - Abu Dhabi" | hard-coded fallback in CustomerService.GenerateCustomerStatementAsync | (this commit) | FIXED |
| B-002 | S2 | Auth | 5 failed logins in workspace A locked the same email in workspace B; success in B cleared A (PS-010) | lockout keyed by bare email | (this commit) | FIXED |
