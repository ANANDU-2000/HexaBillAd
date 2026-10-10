# HexaBill Production Stabilization — Master Goal
Scope: tenant-safe bilingual monochrome printing, verified CRUD persistence and balances, VAT/report reconciliation, responsive UI for Gulf Harvest, FrozenHub1, FrozenHub2 and all tenants.
Plan: `~/.claude/plans/linear-skipping-journal.md`. Priority: P0 isolation/integrity → P1 print → P2 VAT UI → P3 responsive → P4 E2E/cleanup → P5 production (gated).
Related: `docs/plan/VAT-IMPLEMENTATION-TRACKER.md`, `docs/plan/PRODUCTION-ISSUE-REGISTER.md` (PS-xxx).
Rules: failing test first; disposable PG + synthetic data only; no push/merge/deploy/prod migration without explicit approval.
Resume: read TASK-TRACKER.md "Next".
