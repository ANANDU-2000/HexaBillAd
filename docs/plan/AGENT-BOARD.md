# HexaBill Agent Board
Integration base: `integration/2026-10-25` (not pushed). Production backend: `a0af6ae7`. Branch format from now on: `agent/<role>/<TASK-ID>` off the current integration SHA.

| ID | priority | owner | dependency | evidence needed | branch | status | blockers | next action |
|---|---|---|---|---|---|---|---|---|
| OPS-000 Wave 0 recovery | P0 | Lead+QA | - | branch/bundle inventory, Render+Vercel SHA, backup proof | - | IN_PROGRESS | Vercel 403; PITR unconfirmed | Lead: Render backup check |
| P0-PRINT-001..006 | P0 | Print | - | rendered PDFs A4/A5/80/58, 1-50 items, crash repro | merged to integration | READY_FOR_QA | live owner session for browser print | QA: render review on integration |
| P0-NUM-001 literal 00000 / FH1 7000 | P0 | Billing | - | unit+concurrency test, uniqueness scan | agent/billing/P0-NUM-001 | IN_PROGRESS | prod settings write approval | Billing: failing test first |
| P0-NUM-002 unique index (3fcf026) | P0 | Billing | backup proof | staging index build (passed), prod scan | billing/invoice-numbering | VERIFIED_LOCAL | backup + approval | hold |
| P0-FIN-002 edit/delete stock log | P0 | Billing | - | create→edit×2→delete test, one net movement per product | agent/billing/P0-FIN-002 | IN_PROGRESS | - | Billing test |
| VAT-001 tax title by date | P0 | Billing | - | tests across effective date | merged | READY_FOR_QA | VAT_EFFECTIVE_DATE prod write approval; accountant | QA |
| UX-003 Sales Ledger 320 + touch | P1 | UI/UX | - | 6-width screenshots, audit rerun | merged | READY_FOR_QA | owner session for real data | QA |
| UX-003b 1024 Returns + in-page taps | P1 | UI/UX | UX-003 | audit diff, screenshots | ui/ux-003b | IN_PROGRESS | - | UI |
| MIG-003 Starplus staging import | P1 | Migration | dumps | per-table counts, VAT, balances, idempotent rerun | migration/starplus-staging-design | IN_PROGRESS (rebuild after restart) | 3 owner decisions; source freeze; prod approval | Migration rebuild |
| P0-SEC-001 storage test env leak | P1 | QA | - | suite parallel on/off | qa branch | IN_PROGRESS | - | QA |
| QA-VERIFY integration | P0 | QA | above | full suite, PDF/browser/DB | - | TODO | owner login in QA 1:1 | QA full suite on integration tip |
