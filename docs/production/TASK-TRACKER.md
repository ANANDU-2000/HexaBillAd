# Task Tracker
| ID | Pri | Module | Problem | Root cause | Files | Fix | Test | Evidence | Status |
|----|-----|--------|---------|-----------|-------|-----|------|----------|--------|
| T-001 | P0 | Print | PDF identity source | Invoice/delivery/combined/receipt/credit-note/statement PDFs already load the document filtered by auth tenant and read settings for that tenant (verified in SaleService 2600, SalesController 296, PaymentsController 541, ReturnService 1386, CustomerService 1367). Defect found: customer statement fell back to hard-coded "Mussafah 44 - Abu Dhabi" address | CustomerService.cs | omit address when tenant has none | StatementForeignIdentityTests (red→green) | see TEST-EVIDENCE | PASS |
| T-002 | P0 | Payments/POS | Duplicate posting (PS-004, PS-007) | | | | | | TODO |
| T-003 | P0 | Auth | Cross-tenant login lockout (PS-010) | Lockout row keyed by bare email for all workspaces | LoginLockoutKey.cs, LoginLockoutService.cs, AuthController.cs, SuperAdminTenantController.cs | key = workspace-scoped (t{id}:/p:), admin lock global, admin unlock clears all scopes; unknown host keeps legacy key; no schema change | LoginLockoutTenantScopeTests (red→green), auth suite 24 pass | in-memory only, PG pending | PASS |
| T-004 | P0 | All | CRUD persistence sweep | | | | | | TODO |
| T-005 | P0 | Dashboard | Totals reconcile with persisted rows | | | | | | TODO |
| T-010 | P1 | Print | 3-column monochrome bilingual header + doc coverage | | | | | | TODO |
| T-020 | P2 | VAT UI | Review/Lock, period picker, Form 201 tab | | | | | | TODO |
| T-030 | P3 | UI | Responsive pass | | | | | | TODO |
| T-040 | P4 | E2E | Playwright workflows | | | | | | TODO |

Blockers: local PG connection string; FrozenHub BW logo; Vercel re-auth; prod backup/approval; accountant Form 201 review.
Next: T-002 (PS-007 POS retry, PS-004 payments page keys).
