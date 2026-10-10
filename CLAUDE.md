# HexaBill Claude Code entrypoint

This file is intentionally short to minimize always-loaded tokens.

## Authoritative project instructions
1. Read `AGENTS.md` (this repository's engineering/AI safety contract) before edits. If this is the first session, read `docs/plan/HEXABILL-AI-ERP-MASTER-GOAL.md`, then only the section for the CURRENT phase.
2. Read `docs/plan/AI-ERP-TASK-TRACKER.md` at each session start and end. Avoid re-reading all plans on every turn.
3. Use `docs/plan/AI-PROVIDER-CATALOG.md` when changing inference/voice providers; `docs/plan/AI-ERP-E2E-TEST-MATRIX.md` for validation.
4. Inspect ACTUAL Git branch, HEAD, working tree and source. Uploaded ZIP snapshots and historical chat claims may be stale; never claim they represent the deployed system.
5. Execute only the FIRST unfinished/unblocked PHASE and its highest-priority verified task. Don't execute the whole roadmap at once.
6. Preserve completed VAT, trading, payments, daily-close, route, tenant, branding, onboarding, and pricing implementations; extend rather than duplicate.
7. Never invent test results, schema facts, API limits, AI model names, free tier promises, customer IDs, financial numbers, links, keys, or deployed versions.
8. All AI tools are tenant- and role-scoped server-side. Never grant arbitrary SQL, write without preview/approval, or expose secrets. Free-tier providers cannot receive confidential customer data unless approved under documented data-use terms.
9. Use targeted test-first iterations; full PostgreSQL + UI + browser regression at gates. No unexplained skipped integration tests for production readiness.
10. Do not push, merge, deploy, migrate production, rotate keys, delete live data, or place test transactions in live tenants without separate explicit approval. Keep outputs as reviewed checkpoints.
11. Keep responses minimal: DONE / EVIDENCE / FAILURES / BLOCKERS / NEXT TASK. No excessive subagents. Save resumable state to tracker.
