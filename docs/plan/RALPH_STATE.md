# RALPH_STATE — HexaBill autonomous loop

Last updated: 2026-10-24 ~08:25 UTC by Claude Code (iteration 2). Evidence below is from tools run in iterations 1–2; anything not re-checked is labelled.

## CURRENT_REPOSITORY_AND_DEPLOYED_COMMITS

| Item | Value | How verified |
|---|---|---|
| Render API `srv-d68jpdvpm1nc7393q4d0` live | **`b44e316f`** (release 2, live 08:16:43 UTC). Release 1 `5e495c62` was live 08:12:39 UTC. Previous `c8a5b564` = rollback target | Render `list_deploys`; `/health` and `/api/health` 200; no exception logs after 08:12 UTC |
| `origin/main` | `c8a5b564` → `65dee417` (Codex ledger fix, cherry-picked) → `5e495c62` (PDF matrix test) → `b44e316f` (invoice series) | fast-forward pushes, no force |
| Release worktree | `~/.claude-worktrees/hexabill-release`, branch `claude/release-ledger-fix` | — |
| Local `main` (shared checkout) | `56ac9c11`, diverged from `origin/main` (Codex docs/migration line); not touched by Claude | `git rev-list` |
| Codex hotfix worktree | `codex/frozenhub-sales-ledger-pdf-p0` @ `0d54856d` + uncommitted Discount-row edits (untouched). `0d54856d` content is now on `origin/main` as `65dee417`; Codex must rebase before pushing. | `git status` |
| Vercel frontend | **UNVERIFIED** — Vercel MCP 403 for the team scope. `SalesLedgerPage.jsx` change passed `npm test` 290/290 and `npm run build` locally | Vercel MCP |

## PHASE_AND_ACTIVE_TICKET

- Owner approval received 2026-10-24 ("APPROVED ALL SAFELY ORDERWISE FIX AND BUILD") for A1, A2, A3, A4.
- `RALPH-004` A1 Sales Ledger hotfix — RELEASED (production verification pending an authenticated ledger load).
- `RALPH-005` P0-A PDF reproduction with production settings — PASS (local render + visual review); production print not yet observed.
- `RALPH-006` A3 invoice-series code — RELEASED, dormant until `INVOICE_SERIES_START` is set.
- `RALPH-007` A2 + approved header + A3 settings script — WRITTEN AND REHEARSED; **BLOCKED on write access** (Render MCP is read-only; no credentials used or requested).

## P0_BLOCKERS

- **Approved script not yet executed in production**: `docs/production/FH1-APPROVED-CORRECTIONS-2026-10-24.sql`. Until it runs: payment 1462 stays `Completed` (the ledger now tolerates it), customer 115 balance stays 21.00, FrozenHub 1 still prints the **Legacy** header (phone + long stored address), and new invoices still get 10-digit numbers.
- **FrozenHub 1 production print header is `Legacy`.** `INVOICE_HEADER_STYLE` was saved as `Legacy` on 2026-10-21 12:26 UTC and `INVOICE_HEADER_STYLE_LOCKED` is absent, so the approved bilingual header and the Musaffah-17 address rule are inactive in production. The script sets both.
- **Starplus must stop issuing before 7000** (6889 on 2026-10-24, ~18.6 invoices/day → ~2026-10-30). If Starplus issues ≥7000 and those are later migrated into tenant 20, they collide with the new FrozenHub 7000 series.
- Ledger fix production verification: needs one authenticated Sales Ledger load and a log check for `PaymentStatus` errors.
- Receiver's Name/Signature footer move (VOICE-01) not implemented.

## DONE_WITH_EVIDENCE

### RALPH-004 — Sales Ledger hotfix released (A1)
- Code: `65dee417` (cherry-pick of Codex `0d54856d`): `PaymentStatus.Completed` member; ledger/report/payment filter treat it as cleared; sanitized 500 message; frontend status normalisation; FrozenHub locked-header address rule.
- Tests: full backend suite on disposable PostgreSQL 18 (`hexabill_release1`): 1171 passed / 0 failed / 1 skipped (opt-in migration rehearsal = NOT TESTED). Frontend `npm test` (node --test) 290 passed / 0 failed; `npm run build` OK.
- Deploy: `5e495c62` live 08:12:39 UTC; health 200; no errors since.

### RALPH-005 — QuestPDF failure reproduced against production settings
- Evidence: failing production request 06:48:25 UTC `GET /api/sales/1632/pdf?layout=full` (A4, tenant 20, 2 items, logo from base64) on `b7e45a90`.
- Test: `tests/HexaBill.Tests/billing/ProductionShapedInvoicePdfTests.cs` — tenant 20 live settings (Legacy, no lock, letterhead-only off, 52/35 mm stored margins, phone/email/long address, TRN customer with balance) + sale 1632 lines; matrix {Legacy, approved locked bilingual} × {A4, A5} × {full, body} × {1, 2, 5, 20, 50 items}: **40/40 pass** on the release code.
- Visual review (PyMuPDF PNG, 90 dpi, scratchpad `render2`/`render3`): approved header = English left, logo centred and uncropped, Arabic right, "Abu Dhabi, Musaffah 17", no phone/email; 50 items → 4 pages with repeated column header; totals reconcile (sale 1632: 267.50 + 13.38 + 0.12 = 281.00; 50 items: 5321.00); amount in words correct; footer not clipped. Legacy header renders but is NOT the approved design.

### RALPH-006 — Invoice series (A3) released dormant
- `b44e316f` live 08:16:43 UTC. Release-candidate full suite on disposable PostgreSQL: 1221 passed / 0 failed / 1 skipped. Iteration-1 unit tests 9/9 and PostgreSQL concurrency test (8 locked sales → 7002..7009) included.

### RALPH-007 — Approved production script (A2 + header + A3)
- File: `docs/production/FH1-APPROVED-CORRECTIONS-2026-10-24.sql` — one transaction; guards abort on any unexpected before-state; audit rows as platform admin user 1; final read-back; rollback block.
- Rehearsal on disposable PostgreSQL (app schema, tenant-20 rows reproduced): run 1 → payment 1462 `CLEARED`, customer 115 `10.50` (TotalPayments 42.00), header `BilingualMonochrome` + locked, `INVOICE_SERIES_START=7000`, 4 audit rows; run 2 → aborted at the first guard (safe to re-run); rollback block → restored `Completed`, 21.00/31.50, `Legacy`.

### Iteration 1 (kept)
- State reconstruction; live incident re-verification; review of `0d54856d` (69 `CLEARED` filters in 16 files exclude `Completed`; customer 115 stored 21.00 vs true 10.50); invoice-number root cause (`FH-SMK-1791254849` digits); Starplus rate/duplicates (live numbers unique, deleted copies re-issued).

### A4 — smoke/test records (owner action in app; nothing deleted by Claude)
Tenant 20, customer 115 "FrozenHub Onboard Customer", created by user 34: `FH-SMK-1791254849` (sale 1618, Paid), `1791254850` (1629, Paid), `1791254851` (1630, Paid), `1791254854` (1633, Paid), `1791254855` (1634, Pending). Already deleted: `0001` (1606), `1791254856` (1635). Void through the in-app void path **after** the script has run, so balances recalculate from the corrected payment. Invoices for customers 128/130/131 are real and are NOT test data.

## FAILED_TESTS_AND_ROOT_CAUSE

- `ProductionShapedInvoicePdfTests` first run: 4 failures (`ArgumentOutOfRangeException`) in the 1-item cases — test-data bug (read line index 1 after trimming to one line). Fixed in the test; no product defect.
- Frontend: `npx vitest run` reported 152 failed files / no tests — wrong runner; the project uses `node --test` via `npm test`: 290/290 pass.
- Iteration 1: `SeriesStart_IsTenantScoped` wrong expectation, corrected.

## SAFE_NEXT_ACTION

1. Someone with production write access takes a fresh Render backup and runs the approved script; Claude then verifies read-only: payment 1462, customer 115, settings, and that the next FrozenHub invoice number is 7000.
2. Owner opens Sales Ledger and prints one invoice; Claude checks logs for `PaymentStatus` / `conflicting size constraints`.
3. VOICE-01 footer: move Receiver's Name/Signature up with a larger signing gap (A4/A5) + PDF render review — coordinate with Codex, which has uncommitted `PdfService.cs` edits.
4. P0-B duplicate-toast / product-barcode partial-save investigation.

## PRODUCTION_CHANGE_APPROVALS_NEEDED

- A1–A4: **approved** 2026-10-24. Done: A1 release, A3 code release. Ready but needs write access: A2, approved header settings, A3 setting (one script). A4: owner voids in app after the script.
- Not covered by this approval: Starplus stop-issuing date (must be before it reaches 7000), migration cutover, VAT Group 3 deploy, Vercel access to verify the frontend deploy.

## NONDESTRUCTIVE_RESTART_COMMAND

```
cd "C:\Users\anand\.claude-worktrees\hexabill-release"
git fetch origin; git status --short; git log --oneline -6 origin/main
# disposable PG (if stopped): "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "<scratchpad>\pgdata" -o "-p 55901 -c listen_addresses=127.0.0.1" -w start
set HEXABILL_TEST_POSTGRES=Host=127.0.0.1;Port=55901;Database=hexabill_release2;Username=hbtest
dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --filter "FullyQualifiedName~ProductionShapedInvoicePdfTests|FullyQualifiedName~InvoiceSeriesStart"
```

## ITERATION_COUNT_AND_PROGRESS

- Iteration 2 (manual; `/ralph-loop` not installed). Two production releases, both fast-forward and health-checked.
- Completion promise: **not eligible** — approved script not executed, ledger/print not production-verified, footer change, migration, VAT and UX gates open.
