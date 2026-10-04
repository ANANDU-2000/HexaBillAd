# Release error register

Opened 4 October 2026 from fresh code and local test audit. Stage A. No browser-FIXED status without before/after evidence.

| ID | Tenant / page | Severity | Steps / expected | Actual / evidence | Status |
|---|---|---|---|---|---|
| REL-001 | Synthetic / payments cleanup API | S1 | Two independent equal-amount receipts must remain separate | Historical amount-only grouping deleted later rows; now scoped safe refusal 409 | IMPLEMENTED; regression + Chrome API pass; full journey pending |
| REL-002 | Synthetic / payments void | S1 | Void/reverse preserves source and retry identity; simultaneous requests audit once | Source and linked adjustment retained VOID; retry preserves ID; terminal status; PG race originally audited twice, now once | IMPLEMENTED; full tests pass; Chrome void + five inspected views; journey pending |
| REL-003 | Synthetic / customers force delete | S1 | Posted financial history cannot be hard-deleted | Posted history now blocks deletion; unused master only removable | IMPLEMENTED; regression + Chrome API pass; full journey pending |
| REL-004 | Local PostgreSQL / migrations | S1 | New disposable database reaches head | 42P07 Customers exists after InitialPostgreSQL; fresh rehearsal | OPEN, reproduced DB |
| REL-005 | Synthetic / dashboard VAT | S1 | Same period + tenant yields VAT-return amount | Claimability filters differ; ReportService:279,304,868 | OPEN, code confirmed, browser NOT RUN |
| REL-006 | Synthetic / financial reports | S2 | Query error visibly unavailable with retry | Zero/empty fallbacks; ReportService:1268,1348 | OPEN, code confirmed, browser NOT RUN |
| REL-007 | Zayogya regression only | S2 | Approved prior text/render baseline compared | Tests assert inputs/PDF size, not prior golden output | OPEN, coverage gap |
| REL-008 | Frontend dependencies | S2 | Exposure triaged, compatible fixes verified | npm audit: 28 packages, 22 high | OPEN, audit reproduced |
| REL-009 | Release trackers | S2 | One evidence-based status per gate | Trackers conflict | OPEN, docs confirmed |
| REL-010 | Synthetic / Daily Close | S2 | Closed cash day rejects money changes until audited reopen | Payments/sales/purchases lack a shared close guard; drawer movements alone check | OPEN, static finding; reproduction pending |
| REL-011 | Local / startup migration handling | S1 | Failed migrations leave history pending | Program inserts all pending IDs after an existing-column exception; separately skips AddBranchAndRoute | OPEN, code confirmed; no history edits made |
| REL-012 | Local / readiness | S2 | CanConnectAsync false returns 503 | /health/ready discards boolean and reports Ready | OPEN, code confirmed; failure-path reproduction pending |
| REL-013 | Synthetic / ledger Paid tab | S3 money UI | Mode filter changes displayed rows | Filter by Mode button has no handler | OPEN, browser + source confirmed |
| REL-014 | Synthetic / payment edit balance | S1 | Reducing receipt by 10 increases canonical balance by 10 | Aggregate queried old stored payment before edit save; corrected save order | IMPLEMENTED; failing-before regression then pass; browser edit pending |

Detailed sources, test counts, duplicate inventory and work order: RELEASE-AUDIT-20261004.md. Evidence from local DB rehearsal is distinct from browser evidence. Production is NOT READY.
