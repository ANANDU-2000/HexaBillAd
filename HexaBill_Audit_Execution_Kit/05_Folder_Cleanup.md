# Safe folder cleanup and ownership

This is a proposal. No application file was moved or deleted. Clean structure helps maintenance, but relocating code does not fix production defects or create tenant isolation.

## Keep the current top-level application boundaries

| Current area | Decision |
| --- | --- |
| `backend/HexaBill.Api/Modules/` | Keep feature modules. Add Assistant and TenantDocuments here. |
| `backend/HexaBill.Api/Core/` | Keep shared tenancy, authorization, storage and infrastructure. |
| `backend/HexaBill.Api/Migrations/` | Preserve all versioned migrations and model snapshot. Never clean them as generated junk. |
| `frontend/hexabill-ui/src/features/` | Keep business feature ownership. Split large files in small tested steps. |
| `frontend/hexabill-ui/src/platform/` | Keep platform admin separate from ordinary tenant screens. |
| `tests/`, frontend tests and `e2e/` | Keep meaningful regression, financial, isolation and browser tests. Names containing phase or QA do not prove obsolescence. |
| `scripts/` and `tools/` | Classify by usage and risk before moving. Update CI, docs and relative paths atomically. |
| `docs/` | Establish one active tracker and an index; retain past evidence in an archive. |

## Exact duplicate candidates found by content hashing

The scan compared complete files over 100 bytes with documentation/script/config extensions. It found these four groups. The previous in-repo cleanup report's zero-duplicate result covers a different historical checkout and is not authoritative for this ZIP.

| Current paths | Proposed action | Required verification |
| --- | --- | --- |
| `TEST END TO END/HEXABILL_FIELD_BY_FIELD_QA_CODEX_MASTER.md` and `docs/qa/HEXABILL_FIELD_BY_FIELD_QA_CODEX_MASTER.md` | Use the docs/qa copy as canonical. Replace old location with a short pointer before eventual removal. | Search prompts, scripts, links and external team instructions for old path. |
| `TEST END TO END/HEXABILL_SHORT_GOAL_UNDER_4000.txt` and `docs/qa/HEXABILL_SHORT_GOAL_UNDER_4000.txt` | Same treatment; keep one editable source of instructions. | Confirm no tool imports the old path. |
| `docs/plan/HEXABILL-END-TO-END-GOAL.md` and `docs/plan/HEXABILL_CLAUDE_END_TO_END_GOAL.md` | Choose canonical current goal; make the other a pointer. | Reconcile root AGENTS/CLAUDE references and current scope first. |
| `.agents/skills/hexabill-pos-ux-phase/SKILL.md` and `.cursor/skills/hexabill-pos-ux-phase/SKILL.md` | Keep while both tooling ecosystems require discovery; consider generated sync from one authoritative source. | Do not delete one solely because contents match; discovery paths may be intentional. |

`frontend/package-lock.json` is an empty packages map and there is no frontend-root package.json in the archive. It is a removal candidate after confirming deployment/install commands always target `frontend/hexabill-ui`. Keep the actual application's package-lock.json.

## Proposed documentation consolidation

| Material | Suggested destination/ownership | Caution |
| --- | --- | --- |
| Active execution state | Keep `docs/plan/AI-ERP-TASK-TRACKER.md` as the current work authority specified by AGENTS, with links to focused evidence | Several goals contain different dates, tenant counts and checkpoint policies. Reconcile before editing. |
| Architecture | `docs/architecture/` | Describe actual code separately from proposed architecture. |
| Device UX | Existing `docs/uiux/` | Consolidate design tokens/page patterns; avoid competing design systems. |
| Operational runbooks | `docs/operations/` if adopted | Preserve existing production links via pointers during move. |
| Historical dated snapshots | `docs/archive/YYYY-MM-DD/` | Keep immutable evidence, source commit and original date. |
| Root VAT working documents | Index from `docs/vat/` if adopted | Retain source/SQL and update links; no migration execution during cleanup. |
| Root DATABASE_SCHEMA.md and docs/database-schema.md | Compare content, choose authoritative generated/maintained schema description | They are not exact duplicates; do not overwrite one blindly. |

Prefer two small commits: first documentation index and duplicate pointers; later verified moves. Do not combine UI fixes, migration changes and mass renames in one commit.

## Source refactoring candidates

| File | Snapshot size | Safe extraction direction |
| --- | --- | --- |
| `features/customers/CustomerLedgerPage.jsx` | 5,181 lines | Query/filter state; transaction list; payment actions; receipt preview; retain financial contracts |
| `features/sales/pos/PosEnterprisePage.jsx` | 4,174 lines | Cart state, lookup, checkout, permissions and print flow through existing boundaries |
| `features/sales/PosPageLegacy.jsx` | 3,947 lines | Keep: `PosPage.jsx` imports it as a feature-flagged fallback |
| `features/reports/ReportsPage.jsx` | 3,624 lines | Individual report panels, shared filter contract, export orchestration |
| `features/expenses/ExpensesPage.jsx` | 2,509 lines | List/filter, entry form, attachments and category settings |
| `platform/SuperAdminTenantDetailPage.jsx` | 2,453 lines | Tenant summary, subscriptions, features, support and data operations |

Large file size is evidence of maintenance cost, not proof of a runtime bug. Extract one component/service only when its behaviour is covered. Do not change totals, rounding, authorization or mutation sequencing while doing a purely structural move.

## What can be removed after proof

Reproducible build outputs (`bin`, `obj`, `dist`, node_modules), stale temporary logs and local coverage can be removed from a development workspace when not needed for current evidence. The supplied archive is already small (about 16.5 MiB uncompressed) and does not need a dramatic deletion campaign. These directories should remain ignored, not be mixed into deliverables.

For a candidate source/script/package: search static and dynamic imports, route manifests, DI registration, reflection/config names, CI commands, package scripts, docs and deployment files. Confirm it is not a rollback path. Move into a dated archive if uncertainty remains. Build, run targeted tests and execute the affected route after any move. Use Git to preserve history; do not add repository-size archives back into the repo.

Never remove customer assets, uploaded licences, exports needed by the business, audited records, database backups, migration history or rollback code because a filename looks old. The existing `.gitignore` excludes `/clients/`, runtime uploads and databases; keep sensitive client bytes out of source control. This ignore rule does not make any previously committed secret safe.

## Tenant folder misconception

There should not be a `clients/FrozenHub/agent.py` and a separate copy for every other customer. One versioned assistant runs with a server-verified tenant configuration. Client documents live under tenant-scoped object keys; client rules live as reviewed data; credentials live in the secret system. The same legal details/TRN do not imply the same tenant or permission boundary.

## Completion gate

Every moved/deleted path has an owner, reason, reference search, replacement location, rollback method and verification result. The final diff contains no unrelated reformatting. Application behaviour and tenant data remain intact, and the active tracker points to one next task.
