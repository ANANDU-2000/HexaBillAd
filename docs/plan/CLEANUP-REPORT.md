# CLEANUP-REPORT (dry run)

**Date:** 2026-10-04  
**Commit baseline:** `6dc8d9c`  
**Rule:** prove unused before delete. No removals in this dry-run commit except ignore tightening.

## Candidates

| Candidate | Risk | Proof of non-use (this pass) | Action |
|---|---|---|---|
| `clients/` | safe ignore | already `/clients/` in `.gitignore` | keep ignored; never commit |
| Codex worktree | external | not in repo | leave alone |
| `Desktop/HexaBill_Backups/` | safe | outside repo | keep outside |
| Duplicate progress narratives in `docs/refactor-progress.md` | needs review | historical log; still referenced by humans | do not delete yet; MASTER-LOOP/STATE supersede for status |
| Large FE chunks (BarChart/index >500kb) | needs review | build warning only | code-split later (Phase 7) |
| `npm audit` 28 vulns | needs review | transitive | separate security pass |
| Startup `ExecuteSqlRaw` DDL in `Program.cs` | needs review | still executed at boot | migrate to EF migrations later; never edit old migrations |
| Unused Lucide imports (lint warnings) | safe | eslint unused-vars | gradual fix in UI slices |
| `crystal-freeze-header-reference.png` | keep | branding reference; TRN forbidden in code | keep |

## Removals performed

| Commit / date | Item | Grep proof |
|---|---|---|
| 2026-10-04 master-loop-2 | Root `package.json` + `package-lock.json` (empty `{}` / empty packages) | No workspace consumers; FE lives under `frontend/hexabill-ui` |
| 2026-10-04 master-loop-2 | Local (gitignored) `appsettings.Development.json` scrubbed to synthetic placeholders matching `appsettings.example.json` | File is `.gitignore`’d; tracked configs already synthetic; `rg` for prior real patterns → CLEANUP note only |

## Removals performed (prior dry-run note)

None in the original dry-run commit.

## Ignore tightening (applied)

See `.gitignore` / `.cursorignore` updates in the same commit: backups, evidence PDFs, local db copies, agent patches.

## Next safe deletes (after second proof)

1. Stale zip extracts under repo root if any appear (`*.zip` already ignored?).
2. Orphan test evidence folders accidentally committed under `tests/` — none found this pass.
