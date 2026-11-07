# LOOP-STATE: UI/UX + Performance loop memory

Save as `docs/uiux/LOOP-STATE.md`. This file is the loop's **only memory between sessions**. The agent reads it first and writes it last, every iteration. Keep it under 300 lines: move old iteration rows to `LOOP-STATE-ARCHIVE.md` when the history table passes 30 rows.

---

## 1. Now (overwrite every iteration)

| Field | Value |
|---|---|
| Updated | 2026-11-07 session 1 (setup done) |
| Branch / HEAD | loop/integration @ 9183b31e (+ setup commit); worktree `C:/Users/anand/.claude-worktrees/hexabill-loop-integration` |
| Current task | T1: A01 (worktree hexabill-loop-A01); T2: P-00 not started |
| Status | RUNNING |
| Next exact action | Finish A01, then P-00 harness (needs local PG, see Learned facts) |
| Last command + exit | — |
| Last error (1 line) | — |
| Open files | — |

## 2. Baselines (fill once in P-00, then compare against them)

| Metric | Page | Desktop 1440 | Phone 360 throttled | Date |
|---|---|---|---|---|
| Time to first data row | /ledger?customerId=… | | | |
| Time to first data row | /sales-ledger | | | |
| Time to first data row | /billing-history | | | |
| POS ready (search usable) | /pos | | | |
| POS add item → total updated | /pos | | | |
| Long tasks > 200 ms during load | /ledger | | | |
| JS shipped for route (kB gz) | /pos, /ledger, /reports | | | |
| Requests during 5 min idle | /pos | | | |
| Build output total (kB gz) | — | | | |
| Money snapshot hash (H03) | 3 ledgers + VAT + worksheet | | | |

## 3. Decisions in force (owner answers + assumed defaults)

| ID | Decision | Source | Date |
|---|---|---|---|
| D-UX-1 | `tab: 700px` breakpoint | ASSUMED default (yes) until owner answers | |
| D-UX-2 | Auto location during routes | ASSUMED Optional, on by default | |
| D-UX-3 | Auto-reorder stops | ASSUMED On with Undo | |
| D-UX-4 | Driver pin needs office approval | ASSUMED yes (matches existing `arrivalRequest`) | |
| D-UX-5 | Voice provider first | ASSUMED Gemini Live via LiveKit, after data-terms check | |

## 4. Learned facts (things a fresh session would otherwise rediscover)

Add one line per fact. Delete a line when it is no longer true.

- Shell switches at `md`=768 in `Layout.jsx` (L55/L103); the HONOR Pad portrait is 752 CSS px, so it gets the phone layout.
- `assistantChat.js describeChatReply()` used to drop `data.text` for `mode==='reply'` (fix = UX-A02).
- POS (`PosEnterprisePage.jsx` ~L530) reloads ALL product pages via `loadAllProductPages` + customers every 60 s.
- `CustomerLedgerPage.jsx` fetches customers `pageSize:1000` (~L868) and sales+payments `pageSize:1000` (~L1164) for the cash ledger.
- Only 2 uses of `@tanstack/react-virtual` in the app; 15 uses of AbortController/signal.
- `api.js` axios timeout is 30 s, with a 30 s GET cache (`_bypassCache` to skip).
- `useAutoRefresh` and most polls already skip when the tab is hidden.
- `driverRoute.js arrivalRequest()` already sends lat/lng and `updateSavedLocation` for owner/admin; for staff the fix goes to the office to confirm.
- `PosPageLegacy.jsx` must stay (flag `VITE_POS_ENTERPRISE_V2=false` falls back to it).

- LOOP-STATE is owned by the orchestrator in the integration worktree; team branches must NOT edit it (avoids merge conflicts). Teams report evidence; orchestrator records it.
- Primary checkout (`HexaBilngApp`, branch main) is SHARED with Codex sessions and has 57 uncommitted files from other work. Never edit or stage there. Loop work lives only in `~/.claude-worktrees/hexabill-loop-*`; junction `frontend/hexabill-ui/node_modules` from the primary tree.
- Loop docs originally sat in the repo root (+ identical `_1` copies, left untouched). Canonical copies are now `docs/uiux/*` on loop/integration. DESIGN-SYSTEM v1 kept as `DESIGN-SYSTEM-v1-2026-10.md`.
- No Docker and no psql/pg_isready on PATH. PostgreSQL 18 is at `C:\Program Files\PostgreSQL8in`. Working QA cluster notes: memory `hexabill-local-qa-harness` (start `pg_ctl` with output redirected, runner = `scripts/run-customer-save-qa.ps1`, Playwright projects `m360,m390,t768,d1024,d1440`).
- `docs/uiux/evidence/` already exists in repo (untracked files in primary tree); evidence for this loop goes in `docs/uiux/evidence/2026-11-07/`.

## 5. Task board (mirror of the loop file; tick here first)

`[ ]` todo · `[~]` doing/blocked · `[x]` done · `STUCK` · `BLOCKED-BACKEND`

- Perf: P-00 [ ] P-01 [ ] P-02 [ ] P-03 [ ] P-04 [ ] P-05 [ ] P-06 [ ] P-07 [ ] P-08 [ ] P-09 [ ] P-10 [ ]
- A: A01 [ ] A02 [ ] A03 [ ] A04 [ ] A05 [ ] A06 [ ]
- B: B01 [ ] B02 [ ] B03 [ ] B04 [ ] B05 [ ] B06 [ ]
- C: C01 [ ] C02 [ ] C03 [ ] C04 [ ] C05 [ ] C06 [ ] C07 [ ] C08 [ ] C09 [ ]
- D: D01 [ ] D02 [ ] D03 [ ]
- E: E01 [ ] E02 [ ] E03 [ ] E04 [ ] E05 [ ] E06 [ ]
- F: F01 [ ] F02 [ ] F03 [ ] F04 [ ] F05 [ ]
- G: G01 [ ] G02 [ ] G03 [ ] G04 [ ] G05 [ ] G06 [ ] G07 [ ] G08 [ ] G09 [ ] G10 [ ]
- H / E2E gates: H01 [ ] H02 [ ] H03 [ ] E2E-G1 [ ] E2E-G2 [ ] E2E-G3 [ ]

## 6. Iteration history (append; newest at the bottom)

| # | Date | Task | Result | Commit | Tests (unit/e2e) | Evidence path | Notes |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## 7. Stuck log

| Task | Attempts | Last error | Root-cause guess | What a human should check |
|---|---|---|---|---|
| | | | | |

## 8. NEEDS-BACKEND queue (copy also into REVIEW-INBOX)

| Task | Contract | Status |
|---|---|---|
| E03 | `POST /assistant/chat/stream` SSE: token / tool / card / done | waiting |
| E05 | `POST /assistant/voice/session` → `{url, token, room, expiresAt, provider}` | waiting |
| F02 | `source:"auto"|"manual"` on the visit body; live-position ping endpoint if not reusable | waiting |
| P-04 | Server-side customer cash-ledger endpoint (paged), replacing client merge of 1,000 sales + 1,000 payments | waiting |
| P-05 | `GET /products/lookup?q=&limit=20` (fast POS search) + `updatedSince` delta | waiting |
