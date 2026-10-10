# CODEX GOAL PROMPT — HexaBill VAT Return (Gulf Harvest, FrozenHub1, FrozenHub2)

Paste everything below into Codex. Put `VAT-RETURN-PLAN.md` at `docs/plan/VAT-RETURN-PLAN.md` first.

---

## ROLE
You are a senior .NET 9 / React engineer working on a real multi-tenant billing and VAT product used by Gulf businesses. A wrong VAT number can cause an incorrect tax filing and a financial penalty. Correctness and tenant isolation come before speed and before looks.

## GOAL
Make the HexaBill VAT Return correct, isolated per tenant, and easy to use on mobile and desktop, in the format of the Frozen Magic VAT report (Output VAT − Input VAT, Sales and Purchases tables, company name and TRN header), with PDF, Excel and CSV exports that always match the screen. It must work for three new tenants: **Gulf Harvest, FrozenHub1, FrozenHub2**, and must not change **Zayogya**.

## READ FIRST (in this order, before any edit)
1. `docs/plan/VAT-RETURN-PLAN.md` — the source of truth. Findings F-01…F-25, design §3, edge cases §4, fixtures §5, phases §6, rules §7.
2. `docs/plan/IMPLEMENTATION-PROMPT.txt`, `FINANCE-INVARIANTS.md`, `ERROR-REGISTER.md`, `STATE.md`, `PHASE-TODO.md`.
3. Backend: `Modules/Reports/VatReturnReportService.cs`, `VatReturnValidationService.cs`, `ReportsController.cs` (VAT endpoints), `VatBasisResolver.cs`, `Models/VatReturnPeriod.cs`, `Core/Infrastructure/VatCalculator.cs`, `ReportDateRangeService.cs`, `VatPeriodLockedException.cs`, `SaleService`, `PurchaseService`, `ExpenseService`, `ReturnService`, the existing PDF service.
4. Frontend: `features/reports/VatReturnPage.jsx`, `VatProfitEstimateCard.jsx`, `services/index.js` (reportsAPI), `Layout.jsx`, `navigation/moreMenuConfig.js`.
5. Frozen Magic reference (read-only, do not copy its gaps): `VatReportPage.jsx`, `ReportsController.GetVatReport`.
6. Existing tests under `tests/HexaBill.Tests` (billing, tenancy, security) so you reuse their helpers.

## NON-NEGOTIABLE RULES
1. Work on the Tier 0 branch named in `IMPLEMENTATION-PROMPT.txt` (verify with `git branch --show-current`). Never touch `main`, production, or production data. Never run a data migration against anything except a local/staging copy.
2. Tenant comes only from host + JWT. Never from client input. No client name, tenant id, or TRN is hard-coded.
3. Do not delete or weaken existing tests. If a test is wrong, say why in the evidence log and replace it with a failing-first test.
4. Zayogya output must be identical before and after (write the regression test in Phase 0 and keep it green).
5. Money is `decimal`. Round per line, away from zero, 2 dp, then sum. No `double`/`float`.
6. Never swallow an exception into a zero result. Errors return a safe message plus a correlation id; no stack traces or raw exception text to the client.
7. Never invent VAT numbers. Any derived/guessed value must be flagged and must block Lock until resolved or acknowledged.
8. Anything that needs an accountant (reverse-charge boxes, shared TRN, negative adjustments) goes in the evidence log under `OPEN` with the safe default from the plan. Do not decide it silently.
9. No real TRN in code, tests, fixtures, or logs. Sample TRNs only in local/test fixtures.
10. If you are unsure whether something is safe, stop that item, record it as BLOCKED, and continue with the next independent item.

## METHOD — red, fix, green, repeat (mandatory loop)
For **every** phase in plan §6 (0 → 7):

```
LOOP (max 6 iterations per phase):
  1. Write or update failing tests first for the phase findings. Run them. Confirm they fail for the expected reason.
  2. Implement the smallest correct change.
  3. dotnet build  (zero errors, zero new warnings in touched files)
  4. dotnet test   (full backend suite; PostgreSQL tests must run, not skip)
  5. npm run build && npm test  in frontend/hexabill-ui
  6. If anything fails: read the failure, fix the cause (not the test), go to 3.
  7. If green: run the phase gate checks from the plan, record evidence, print the ACK block, move on.
If still failing after 6 iterations: STOP the phase, mark it BLOCKED with the exact failing test and your best diagnosis, and do not proceed to phases that depend on it.
```

Do **not** stop while a phase is red and you still have iterations. Do **not** mark PASS on partial results.

## WHAT TO BUILD (summary — the plan has the detail)
- **Phase 0**: baseline counts; failing tests for F-01, F-03…F-10, Zayogya regression.
- **Phase 1**: one tenant-filter helper; remove `TenantId == null && OwnerId == tenantId` fallbacks from every VAT path; backfill **dry-run** report (counts only, no writes); startup guard for NULL `TenantId`.
- **Phase 2**: fix profit estimate (F-02), derived-VAT flagging + validation V015 (F-03), returns by original VAT scenario (F-04), remove clamps (F-05), typed `VatCalculationException` (F-06), single date convention with boundary tests (F-11), one precedence for claimable VAT (F-13), independent assurance checks (F-14).
- **Phase 3**: status machine, 409 on illegal transition, no recalculation of Locked/Submitted (F-07), snapshot on lock and snapshot read for locked/submitted (F-08), lock guard in sale/purchase returns and any other VAT-changing write (F-09), unique period index + transactional upsert (F-10), audit rows (F-25). Migrations additive with tested Down.
- **Phase 4**: DTO additions (company, TRN status, filing type, summary, warnings), `GET vat-return/export/pdf` (Official vs Draft), Excel/CSV fixes (F-19, F-21, F-22), `VatFilingPeriodType` tenant setting.
- **Phase 5**: rebuild the VAT page as components (period bar, company card, tiles, summary table, tab bar, tables/cards, action bar, confirm dialogs, acknowledgement panel, error panel). Tabs always: Summary · Sales · Purchases · Expenses · Credit Notes · FTA Form 201 · Checks. Icons, button states, mobile sticky action bar, 44 px touch targets, table→card on <640 px, stale-response guard, no NaN/undefined/-0.00.
- **Phase 6**: synthetic tenants for Gulf Harvest, FrozenHub1, FrozenHub2 (shared sample TRN for the two FrozenHub tenants, separate data) run end-to-end through settings → invoice → purchase → return → VAT page → PDF/Excel/CSV → lock → submit.
- **Phase 7**: full regression, performance budget, security review, docs update, release notes, rollback plan.

## REQUIRED TESTS (must exist and pass)
Plan §4 cases 1–30 and plan §5 fixtures A–D with exact expected numbers. Plus:
- Screen total = PDF total = Excel total = CSV total for every fixture.
- Query-count assertion on the VAT endpoint (no N+1).
- Concurrency: double Lock, double Calculate, parallel Submit.
- Cross-tenant: FrozenHub1 token + FrozenHub2 host → 403 / no data.
- Frontend: 360 px, 768 px, 1440 px render tests for each tab and for loading, empty, error, locked, missing-TRN states; button-disabled reasons; double-click ignored; stale response ignored.

## ACKNOWLEDGEMENT BLOCK — print after every phase, exactly this shape
```
=== PHASE <n> ACK ===
Status: PASS | FAIL | BLOCKED
Findings covered: F-xx, F-xx
Files changed: <list>
Tests added: <count>   Backend: <passed>/<total>   Frontend: <passed>/<total>   Skipped: <count>
Fixtures verified: A B C D (exact numbers)
Isolation verified for: Gulf Harvest, FrozenHub1, FrozenHub2, Zayogya
Commit SHA: <sha>   Migration: <name or none>   DB version: <x>
Evidence: <paths to screenshots/PDFs/logs>
OPEN items for Anandu/accountant: <list or none>
Next: Phase <n+1>
```
Also write the same block to `docs/plan/VAT-RETURN-EVIDENCE.md` and update `STATE.md`.

## USER-VISIBLE ACKNOWLEDGEMENTS (product behaviour, not just your report)
- After Calculate, Lock, Submit, and each export, the UI shows a success panel: what happened, who, when (GST), period, Net VAT payable, reference id, and a Download PDF button.
- After any failure the UI shows a red panel with a plain-language message, a Retry button, and a copyable correlation id.
- Lock and Submit confirm dialogs repeat company, TRN, period, and Net VAT payable before the action runs.

## FINAL REPORT (when done or blocked)
1. Table: finding F-01…F-25 → FIXED / PARTIAL / OPEN / WONT-FIX with the test name that proves it.
2. Before/after screenshots for mobile and desktop.
3. Sample PDFs for each of the three tenants.
4. List of OPEN decisions with the default you used.
5. Residual risks you still see.
6. Exact deploy and rollback steps. **Do not deploy.**

Begin with Phase 0. Print the baseline counts before changing any code.
