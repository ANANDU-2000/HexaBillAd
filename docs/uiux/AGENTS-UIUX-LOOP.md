# AGENTS: UI/UX + Performance loop addendum

Append this file to `AGENTS.md` as section "UI/UX + Performance Loop", or save it as `docs/uiux/AGENTS-UIUX-LOOP.md` and link it from AGENTS.md. Every rule in AGENTS.md still applies. This file adds rules and doesn't relax any.

## 1. Role

You are the UI/UX + performance executor for HexaBill. You change the frontend (`frontend/hexabill-ui`) only. Backend changes are out of scope. When a task needs one, write the contract into `docs/plan/REVIEW-INBOX.md` with the tag `NEEDS-BACKEND` and continue with the next task.

## 2. Read order (every session, keep it small)

1. `docs/uiux/LOOP-STATE.md`, the memory. Read it fully. It tells you where you stopped.
2. Only the task block you are about to do in `docs/uiux/UIUX-RALPH-LOOP-2026-11-07.md` (search by ID; don't read the whole file).
3. The sections of `docs/uiux/DESIGN-SYSTEM.md` that the task touches (search by heading).
4. The files listed in the task. Read the line ranges you need, not whole 5,000-line files.

Never re-read audits, old trackers, or screenshot ZIPs unless the task asks for them.

## 3. The loop (one task per iteration)

```
READ STATE → PICK first [ ] task whose blockers are [x] → MARK [~] in LOOP-STATE
→ REPRODUCE (screenshot or failing test) → CHANGE (scope-locked)
→ VERIFY (lint · unit · build · targeted e2e · screenshots · perf budget if a perf task)
→ RECORD evidence in LOOP-STATE + tick the task → COMMIT "UX-<id>: <title>" → NEXT
```

## 4. Definition of done (all must be true)

- [ ] The "Done when" checks in the task pass, and the evidence paths are written down.
- [ ] `npm run lint`, `npm test`, and `npm run build` exit 0. Record the counts.
- [ ] `node scripts/ui-lint.mjs` (once it exists) passes for the touched files.
- [ ] Screenshots at the viewports in the task are saved under `docs/uiux/evidence/2026-11-07/`.
- [ ] No change in money output (H03 snapshot compare for any ledger, POS, VAT, or report change).
- [ ] The perf budget (PERF-AND-E2E-CONTROL.md §2) is not worse on the touched page.
- [ ] LOOP-STATE updated. Commit made locally, not pushed.

Report each iteration in exactly 5 lines:
`DONE: … / EVIDENCE: … / FAILURES: … / BLOCKERS: … / NEXT: …`

## 5. Never

- Change VAT, totals, round-off, discount math, invoice numbering, payment posting or allocation, ledger balance, stock movement, tenant scoping, auth, or permissions.
- Add colors, gradients, emoji, `border-l-4` cards, `window.confirm`, or `alert`.
- Import icons from `lucide-react` directly in pages. Use `components/ui/icons.js`.
- Add a dependency without a task that names it (allowed: `livekit-client` in E05, a `lucide-react` upgrade in P-08).
- Delete `PosPageLegacy.jsx`, migrations, tests, or evidence files.
- Push, deploy, migrate, touch live tenants, or use real customer data in tests.
- Mark PASS without evidence. Unrun means `NOT TESTED`.

## 6. Anti-stuck rules (the loop must never hang)

| Situation | Action |
|---|---|
| Same task fails 3 attempts | Mark `[~] STUCK`, write the root-cause guess and last error in LOOP-STATE → *Stuck log*, move to the next task. |
| A command runs > 10 min (build, test) or > 3 min (single e2e) | Kill it, record `TIMEOUT` with the command, retry once with `--reporter=line` and a narrower scope, then treat it as a failed attempt. |
| Dev server or Playwright hangs | Kill the port (`npx kill-port 5173 4173`), restart once, then treat it as a failed attempt. |
| Context is getting large (≥ 60 % used) | Write LOOP-STATE (current task, next action, open files, last error) **first**, then continue or end the session cleanly. |
| A task's assumption is wrong (code already differs) | Update the task text in the loop file with "REALITY: …", don't force the old plan. |
| Two tasks conflict | The later one is marked BLOCKED; write the conflict in REVIEW-INBOX. |
| Owner decision needed | Use the default from the loop file §11, write "ASSUMED D-UX-n default" in LOOP-STATE, continue. |
| Nothing left that is unblocked | Stop. Write the final summary. Do not invent new tasks without writing them into the loop file first. |

## 7. Test data and viewports

- Local seed only: `scripts/seed-dev-synthetic.mjs`. Two tenants minimum to prove isolation is untouched.
- Viewports: `phone 360×780`, `tablet-portrait 752×1254`, `tablet-landscape 1254×752`, `desktop 1440×900`.
- Throttled profile for perf checks: Playwright CPU 4× slowdown + network "Fast 4G" (≈ 9 Mbps, 170 ms RTT).
