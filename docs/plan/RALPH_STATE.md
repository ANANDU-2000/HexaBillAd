# RALPH_STATE — HexaBill autonomous loop

Last updated: 2026-10-24 ~09:55 UTC by Claude Code (iteration 3). Evidence below is from tools run in iterations 1–3; anything not re-checked is labelled.

## CURRENT_REPOSITORY_AND_DEPLOYED_COMMITS

| Item | Value | How verified |
|---|---|---|
| Render API `srv-d68jpdvpm1nc7393q4d0` live (before this push) | `b44e316f` (live 08:16:43 UTC) = rollback target for release 3 | Render `list_deploys` |
| Release 3 (this push) | `75a176a9` void-safe delete · `07c80ebb` discount row + receiver footer · `9a8a28b1` saved-sale PDF discount/unit · `aa133899` phone Print + preview totals · `ecdfa514` void rehearsal e2e · docs commit | local `claude/release-ledger-fix` |
| Release worktree | `~/.claude-worktrees/hexabill-release` | — |
| Local `main` (shared) | `56ac9c11`, diverged from `origin/main`; untouched by Claude | `git rev-list` |
| Codex hotfix worktree | `0d54856d` + uncommitted Discount-row edit (idle since 12:48 IST). Its Discount-row diff is now carried in `07c80ebb` (credited). Codex must rebase before pushing. | `git status` |
| Vercel frontend | **UNVERIFIED** (MCP 403 for the team scope) | Vercel MCP |

## PHASE_AND_ACTIVE_TICKET

- P0-A print + P0 test-bill clean-up. Owner approval (A1–A4) from 2026-10-24.
- Status board:
  - `RALPH-008` Void-safe invoice delete — VERIFIED (PostgreSQL red→green + browser rehearsal); production pending release.
  - `RALPH-009` Discount row (A4/A5) — VERIFIED locally (PDF matrix + browser download).
  - `RALPH-010` Receiver Name/Sign footer (VOICE-01) — VERIFIED locally (geometry test + visual review vs client original).
  - `RALPH-011` Saved-sale PDF dropped Discount / used product unit — VERIFIED locally (red→green, browser download).
  - `RALPH-012` Print Options unreachable on phones; preview totals missing discount — VERIFIED locally (5 viewports).
  - `RALPH-013` Settings script (approved header + 7000) — READY, rehearsed; **BLOCKED on production write access**.
  - `RALPH-014` Test-invoice clean-up — READY (manifest + rehearsal); **BLOCKED on owner in-app action** after release 3.
  - `RALPH-007` (A2 payment 1462 → CLEARED) — SUPERSEDED: 1462 belongs to test invoice 1618; correct end state is VOID via RALPH-014; customer 115 → 0.00.

## P0_BLOCKERS

- Production settings not applied (header still `Legacy`, no series): needs someone with write access to run `docs/production/FH1-APPROVED-CORRECTIONS-2026-10-24.sql` (revision 2, settings only) after a fresh backup.
- Test invoices still active in production: owner (Vahid) deletes the five allowlisted invoices in Billing History after release 3 is live (`docs/production/FH1-TEST-INVOICE-CLEANUP-MANIFEST.md`).
- Starplus must stop issuing before 7000 (6889 on 2026-10-24, ~18.6/day → ~2026-10-30).
- Sales Ledger / print fixes not yet production-verified (no authenticated production session available to Claude).
- Vercel deploy unverifiable from this session.

## DONE_WITH_EVIDENCE

### Iteration 3 (2026-10-24)
- **Live read-only reconciliation (09:15 UTC)**: tenant 20 = FrozenHub 1 (owner 34 Vahid); 12 sales; genuine 1631/1632/1638/1639 and balances 128 = 720/720/1001/281, 130 = 0/0/299/299, 131 = 0/0/806/806 match the owner's list; 1791254855 (1634) PaidAmount 0 is consistent — its payment 1482 is VOID (voided 2026-10-21 12:29 UTC). Test lines all product 90 `FH-ONBOARD-1` (no genuine use). Receipts: only REC-2026-0001 on genuine payment 1488. No returns/credit notes/VAT periods.
- **RALPH-008** `SaleService.DeleteSaleAsync` removed payments (cascading receipts) and recalculated before saving. Now voids payments, recalculates after save in the same transaction, audit has `EntityId` + voided payment ids. `SaleDeleteVoidsPaymentsPostgreSqlTests`: fails on old code (expected 3 payments, found 0), passes now. Browser rehearsal `e2e/fh1-test-invoice-void.spec.js` m390/t768/d1440 3/3 with DB read-back.
- **RALPH-009/010** `PdfService`: Discount rows (Codex diff, credited); A4 footer with separate Name/Sign writing lines, spacing measured from client original `Invoice_6584`, lifted, `ShowEntire()` so it never splits (a first attempt split the footer across pages at 5/20 items — caught by the new geometry assertions and fixed). `ProductionShapedInvoicePdfTests` 41/41 (40-case matrix with production settings + saved-sale test).
- **RALPH-011** `SaleService.GenerateInvoicePdfAsync` DTO lacked `Discount` and printed product unit, found by the browser download check; fixed; `SavedSalePdf_PrintsStoredDiscountAndLineUnit` red→green.
- **RALPH-012** `PrintOptionsModal` capped to viewport with scrolling body and visible footer (Print first/full-width on phones); `InvoicePreviewModal` shows Discount/Round off. `e2e/fh1-invoice-print.spec.js` m360/m390/t768/d1024/d1440 5/5 (preview, Share→Download PDF text-checked, Share→Print layout=full PDF 200, Print button on screen ≥44px).
- **Gates**: backend full suite on disposable PostgreSQL 1224 passed / 0 failed / 1 skipped (opt-in migration rehearsal = NOT TESTED); frontend `npm test` 290/290; `npm run build` OK; related e2e (invoice-preview-actions, billing-history, sales-ledger-load-failure, invoice-pdf) 23 passed / 12 skipped by design (phone-only specs at ≥768).
- **Browser host**: `tools/HexaBill.SyntheticBrowserHost` on loopback 5078, DB `hexabill_codex_browser_fh` (disposable PG 18, port 55901), synthetic tenants only; `frozenhub1-test` given FrozenHub 1's production print settings + approved lock + client logo.

### Iterations 1–2 (kept)
- Ledger hotfix released (`5e495c62`), invoice series released dormant (`b44e316f`), production-shaped PDF reproduction of the 06:48 UTC failure, Starplus numbering analysis, settings script rehearsal.

## FAILED_TESTS_AND_ROOT_CAUSE

- Footer first version split across pages for 5/20-item A4 invoices — product defect introduced by taller footer; fixed with calibrated spacing + `ShowEntire()`.
- `fh1-invoice-print.spec.js` early failures: wrong menu (Download/Print are under Share), PyMuPDF cp1252 output under `-I` (fixed in-script), then two real defects (missing PDF discount, unreachable phone Print) — fixed.
- `fh1-test-invoice-void.spec.js` first run: dialog text check failed because the copy edit had not applied; applied and passed.
- Local SQLite API path is stale (`no such column: u.IsActive`) — not used; synthetic PostgreSQL host used instead.

## SAFE_NEXT_ACTION

1. Verify release 3 live on Render + health; then the owner runs the settings script and the in-app clean-up; Claude verifies read-only per the manifest.
2. VAT (P0-C) review of release scope remains separate — no VAT changes in releases 1–3.
3. Starplus migration (P0-D) staging work continues independently; numbers 2000–6889 stay below the 7000 series.

## PRODUCTION_CHANGE_APPROVALS_NEEDED

- Approved and pending execution by someone with access: settings script (header + 7000); in-app deletion of the 5 allowlisted test invoices.
- Not covered: Starplus stop-issuing date, migration cutover, VAT Group 3, Vercel access.

## NONDESTRUCTIVE_RESTART_COMMAND

```
cd "C:\Users\anand\.claude-worktrees\hexabill-release"
git fetch origin; git status --short; git log --oneline -8 origin/main
# disposable PG: "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "<scratchpad>\pgdata" -o "-p 55901 -c listen_addresses=127.0.0.1" -w start
set HEXABILL_TEST_POSTGRES=Host=127.0.0.1;Port=55901;Database=<fresh db>;Username=hbtest
dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --filter "FullyQualifiedName~ProductionShapedInvoicePdfTests|FullyQualifiedName~SaleDeleteVoidsPayments|FullyQualifiedName~InvoiceSeriesStart"
```

## ITERATION_COUNT_AND_PROGRESS

- Iteration 3 (manual). Completion promise **not eligible**: production settings + test-bill clean-up not executed, production print/ledger not verified by an authenticated session, migration and VAT gates open.

## ITERATION 4 (2026-10-24, after release a407b1aa)

- **Live read-only state:** release a407b1aa live, health 200, no errors since deploy. Tenant 20 unchanged: five test invoices (1618, 1629, 1630, 1633, 1634) linked only to customer 115 and product 90; payments 1462 Completed, 1478/1479/1481 CLEARED, 1482 VOID; no receipts, returns, invoice versions or price references. Invoice 1634 PaidAmount 0 matches its VOID payment (no open discrepancy). Stock product 90 = 45; expected 50 after the in-app void. Genuine invoices 1631/1632/1638/1639 and balances 128=720, 130=0, 131=0 unchanged.
- **Numbering:** no duplicate live invoice numbers in tenant 20; no number in the 7000 series yet (INVOICE_SERIES_START not set; owner action pending). Starplus max 6892, 22 invoices in last 24 h → reaches 7000 around 29 October.
- **Header:** the app forces the approved bilingual header for subdomain frozenhub on settings read and PDF (test added: 42/42 ProductionShapedInvoicePdfTests). The stored Legacy row does not change printing. Live print still needs an authorized session to confirm.
- **VAT:** tenant 20 COMPANY_TRN 105607243000003 (verified). VAT_EFFECTIVE_DATE row absent → code default 01-01-2026; registration effective date per owner is 2026-11-01. Not enforced by the backend. Accountant decision required on pre-registration invoices; no setting changed. Gulf Harvest (22) has CORPORATE_TAX_TRN 105543085200001 and empty COMPANY_TRN (correct).
- **UI audit (synthetic frozenhub1-test, desktop 1440, core workflows):** 11 passed, 5 failed, 7 skipped. Causes so far: (a) customers-crud needs a branch+route; the synthetic tenant had none, now created via API (fixture gap, fixed in environment only); (b) pos-checkout hard-codes product "gulfharvest Sample Chicken 1kg" from the tier-0 bootstrap dataset; (c) payments-crud and pos-credit-sale expect amounts (307.02, 12.57) from that dataset; (d) bulk-payments and one more need inspection. None yet confirmed as a product defect. Run is not complete: phone/tablet widths not run for these specs.
- **Customer pin / route location:** customer-pin specs need FeatureFlags__CustomerStopLocation=true; the synthetic host was restarted with that flag (local only; production flags unchanged).
- **Blocked on external action:** (1) owner sets INVOICE_SERIES_START=7000 in Settings; (2) owner voids the five test invoices in-app; (3) live print verification needs an authorized owner browser session; (4) Starplus billing cutoff decision and collision policy for the 7000+ range; (5) VAT effective-date / tax-point decision by accountant.
- **Next:** classify the remaining UI failures (fix fixture data for the dataset-dependent specs, then fix only confirmed product defects); run tablet/phone widths for the same set; re-run after owner actions.
