# Documentation index

Start here. This index points to the one authoritative file for each purpose. It does not move or delete anything.

## Work authority (read in this order)

1. `AGENTS.md` (repository root): engineering and AI safety contract.
2. `docs/plan/AI-ERP-TASK-TRACKER.md`: the single active task tracker and session log. Update it at the end of every task.
3. `docs/plan/HEXABILL-AI-ERP-MASTER-GOAL.md`: milestones; read only the section for the current phase.
4. `docs/plan/AI-PROVIDER-CATALOG.md` when changing AI or voice providers; `docs/plan/AI-ERP-E2E-TEST-MATRIX.md` for validation.

Linked trackers (do not duplicate their rows in the active tracker): `docs/production/TASK-TRACKER.md`, `docs/production/BUG-REGISTER.md`, `docs/plan/PRODUCTION-ISSUE-REGISTER.md`, `docs/plan/ERROR-REGISTER.md`, `docs/plan/VAT-IMPLEMENTATION-TRACKER.md`, `docs/uiux/PREMIUM-UX-TRACKER.md`.

## Evidence and records by area

| Area | Where |
| --- | --- |
| Production save incident | `docs/qa/HEXABILL-PRODUCTION-SAVE-INCIDENT.md` |
| Live schema snapshot (no credentials) | `docs/database/LIVE-SCHEMA-2026-10-17.md` |
| Product and customer create field matrix | `docs/database/PRODUCT-CUSTOMER-CREATE-FIELDS-2026-10-17.md` |
| Production recovery and verification | `docs/production/` (dated documents are historical facts, not current deployment evidence) |
| QA registers and test evidence | `docs/qa/` |
| UI/UX audit, page inventory, tokens | `docs/uiux/` |
| Deployment and local run | `docs/deployment.md`, `docs/RUN_LOCALLY.md` |
| Database schema description | `docs/database-schema.md` and root `DATABASE_SCHEMA.md` (different content; neither is a copy of the other) |
| Historical snapshots | `docs/archive/` |

## Known exact duplicates (verified by content hash on 2026-10-17)

These pairs are byte-identical. Nothing was removed because the first pair lives in a folder the engineering register records as intentionally preserved, and the second pair needs an owner decision on which goal is canonical.

| Canonical copy (edit this one) | Duplicate (leave until a reference check and owner decision) |
| --- | --- |
| `docs/qa/HEXABILL_FIELD_BY_FIELD_QA_CODEX_MASTER.md` | `TEST END TO END/HEXABILL_FIELD_BY_FIELD_QA_CODEX_MASTER.md` |
| `docs/qa/HEXABILL_SHORT_GOAL_UNDER_4000.txt` | `TEST END TO END/HEXABILL_SHORT_GOAL_UNDER_4000.txt` |
| undecided | `docs/plan/HEXABILL-END-TO-END-GOAL.md` and `docs/plan/HEXABILL_CLAUDE_END_TO_END_GOAL.md` |
| `.cursor/skills/hexabill-pos-ux-phase/SKILL.md` | `.agents/skills/hexabill-pos-ux-phase/SKILL.md` (both tool ecosystems discover their own path; keep both) |

## Cleanup rules

- Never remove migrations, tenant or client assets, evidence, backups, or the legacy POS (`PosPageLegacy.jsx` is a feature-flagged fallback).
- Search imports, routes, CI, deployment files and docs before moving or deleting anything, and record the result in the tracker.
- Keep moves in their own commit, separate from fixes.
- Real client documents never go into Git (`/clients/` is ignored).
