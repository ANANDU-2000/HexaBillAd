# VAT files review — 10 October 2026

Scope: review and report corrections first, as confirmed by Anandu in this chat. No application code, tests, original plan, branch, database, production configuration, or deployment was changed. This report and review evidence are new files.

**Verdict: revise the plan and prompt before implementation.** Most defects are visible in the current code, but several findings are inaccurate or incomplete. The proposed filing contract preserves a known incorrect Form 201 mapping. Passing the existing tests does not establish filing correctness.

## Files and checkout checked

- `VAT/VAT-RETURN-PLAN.md` and `VAT/CODEX-GOAL-PROMPT.md`.
- The attached `pasted-text-1.txt`: same prompt content, with only a final-newline difference.
- Planning dependencies: `IMPLEMENTATION-PROMPT.txt`, `FINANCE-INVARIANTS.md`, `ERROR-REGISTER.md`, `STATE.md`, and `PHASE-TODO.md`.
- VAT report/calculation, validation, controller, basis resolver, period model, date/time helpers, calculator, tenant query filters, migration/index declarations, and relevant transaction-service guards.
- VAT page, profit card, API wrappers, navigation, print CSS, PDF interface and relevant PDF/font implementation, and existing VAT/tenancy/security/Zayogya tests.
- Current branch: `release-1`; HEAD: `e14c7dcd6ddaa0acefc74cfde0f7bb1cd8cfff3b`. `tier0-continuation` exists but was not checked out.
- `docs/plan/VAT-RETURN-PLAN.md` is absent. The supplied plan remains in `VAT/`; do not install it as authoritative until the corrections below are incorporated.
- The Frozen Magic source file/archives described by the plan were not located in this workspace's source-file search. Its layout description is a supplied reference, not independently verified code evidence.

Line references below describe the reviewed HEAD. All source paths are relative to the repository root. Static confirmation means the implementation supports the finding; it does not mean a new behavioral regression was executed.

## Corrections required before using the prompt

### 1. Replace the filing mapping, or explicitly restrict the release to a draft management report

The plan's F-12/§3.1 treats `Box2` as zero-rated, `Box3` as exempt, `Box4` as reverse-charge base, `Box12` as recoverable input VAT, and `Box13a/b` as payable/refundable. That is the application's custom mapping, not the FTA filing mapping. This is already recorded in `ERROR-REGISTER.md` REL-015/016.

FTA's published return guide maps Box 2 to tourist refunds, Box 3 to reverse-charge supplies received, Box 4 to zero-rated supplies, Box 5 to exempt supplies, Box 12 to output tax due, Box 13 to recoverable tax, and Box 14 to the net position. Box 1 also separates amounts by Emirate. See the [FTA VAT Returns User Guide, August 2021](https://tax.gov.ae/DataFolder/Files/Pdf/VAT%20Returns%20User%20GuideEnglishV40%2015%2008%202021%20SEP2021.pdf).

Correction: use unambiguous internal names such as `standardOutputVat`, `recoverableInputVat`, and `netVatPayable`. Add a separately versioned filing projection after accountant-approved mapping/fixtures. Do not label the existing custom boxes or exports “Official FTA Form 201.” Blocking reverse-charge transactions alone does not repair the other incorrect labels. Ordinary financial reporting can proceed as a clearly identified draft management report while filing approval remains OPEN.

The summary formula must include every supported output-tax category. `Output = Box1b` is only safe for an explicitly restricted standard-sales report; it omits reverse-charge output when that category is enabled.

### 2. Correct F-10: the unique period index already exists

`backend/HexaBill.Api/Data/AppDbContext.cs:753` configures a unique `(TenantId, PeriodStart, PeriodEnd)` index. `Migrations/20260310151454_AddVatReturnEngineFields.cs:309` also creates it with `unique: true`.

Correction: verify the deployed/local schema actually has the index; do not blindly add a duplicate migration. Test conflicting Calculate requests and return a controlled result on the unique violation. Add concurrency control and overlap prevention: uniqueness on identical dates does not prevent overlapping ranges or conflicting status updates. Existing migration-chain problems in REL-004/011 remain separate blockers; `EnsureCreated` is not migration rehearsal.

### 3. Correct F-22: the routes are different and a frontend caller exists

`ReportsController.cs:508` exposes `/vat-return/export/excel`; `:601` exposes `/vat-return/export`. These are not duplicate route declarations. The older endpoint has a distinct DTO/format and `frontend/hexabill-ui/src/services/index.js:1172` still defines a wrapper for it.

Correction: mark this as divergent legacy export behavior. Search actual callers, migrate them, and choose a documented deprecation/compatibility policy before removing the route. The legacy `GetVatReturnAsync` also passes an inclusive quarter end to an exclusive-end calculation; add a last-day transaction regression.

### 4. Qualify F-15/F-16 with the existing tenant filters

The unsafe owner/tenant comparisons remain in the VAT service, validator, and suggest-period queries. However, `AppDbContext.cs:1184` onward adds a strict tenant query filter to entities with `TenantId`; ordinary established tenant requests exclude NULL-tenant rows. The PostgreSQL VAT ID lookup uses raw SQL, but subsequently reloads entities through the filtered EF query.

Correction: do not claim an already-proven HTTP data leak solely from the fallback text. Retain the cleanup requirement and reproduce it under normal authenticated tenant scope, authenticated platform scope, and raw SQL paths. Platform-scoped service calls remain a concern. Avoid a backfill that guesses tenant identity from numeric owner/tenant equality; ambiguous ownership must remain unresolved. Verify local Zayogya legacy rows before removing compatibility paths or adding a global startup failure.

### 5. Expand F-07/F-09: immutability needs more than return guards

Calculate assigns every stored box before checking status (`ReportsController.cs:294–307`). A Locked period is overwritten while retaining the Locked label; Submitted is overwritten and reset to Calculated. Lock calculates/validates fresh figures but saves only status/user/time, not the newly calculated figures or lines (`:391`).

`VatReturnValidationService.cs:36` guards only `Status == "Locked"`. Changing to Submitted therefore removes this protection. Update guards also inspect inconsistent dates: sale/purchase updates check the old date, while expense update checks the requested date. A transaction can potentially move into or out of a locked period through the unchecked side. Daily Close guards are separate and cannot substitute for VAT guards.

Correction: guard both Locked and Submitted, check old and new VAT-effective dates, and serialize Lock with every VAT-changing write. Add a lock-vs-post race regression; a read/check followed by an unrelated write is insufficient. Freeze full financial content and lines atomically, with a version/hash. Current tenant identity headers may refresh on reprint under the documented policy.

### 6. Repair the phase and test instructions

- Phase 0 explicitly expects new regression tests to fail, while the generic loop requires the full suite to be green before each phase passes. Replace this with a baseline/preparation gate: existing baseline green, explicit expected-red regressions logged, and every new red regression assigned to its owning fix phase. An unexpected baseline failure still blocks.
- The prompt says statutory tabs change for all tenants, but also demands identical Zayogya output. State exactly what is frozen: amounts, workflow, API fields, exports, and/or visual layout. Preserve a reviewed before-state; if legacy erroneous behavior must change, obtain a specific decision rather than declaring both requirements satisfied.
- Profit tests currently encode VAT-inclusive sales and pending expenses. Replace that expectation only through failing-first revised coverage and an evidence explanation, as the prompt requires. Do not silently delete the test.
- The strict non-sample TRN rule for Lock conflicts with Phase 6's sample-only synthetic lock/submit journey. Specify a test-only policy with an explicit environment guard; production samples must remain rejected. A syntactically valid TRN is not proof of registration verification.
- Derived VAT acknowledgement needs a server contract: authenticated actor, reason, timestamp, affected references, calculation version/hash, tenant scope, and expiry after relevant data changes. A browser checkbox is insufficient. Accountant confirmation is needed before treating acknowledgement as filing eligibility.
- Define a Reviewed operation and amended-version lifecycle; the proposed status machine has a Reviewed state but no endpoint/action to reach it.
- Define “Submit”: the current operation changes local status only. It does not file with FTA. Product acknowledgement must distinguish local marking from verified filing, with external reference/evidence if required. FTA's guide describes portal submission; see the [FTA guide](https://tax.gov.ae/DataFolder/Files/Pdf/VAT%20Returns%20User%20GuideEnglishV40%2015%2008%202021%20SEP2021.pdf).
- Choose the branch/checkpoint deliberately: the supplied prompt requires `tier0-continuation`, while the newer STATE/PHASE-TODO checkpoints describe `release-1`. Do not start from an older branch and lose recent fixes.

## F-01 through F-25 review

No finding is marked FIXED by this review. “Confirmed” below denotes static code confirmation.

| Finding | Review result | Evidence and required correction |
|---|---|---|
| F-01 | Confirmed | `VatReturnPage.jsx:391,1112` restricts ProfitBased tabs. Keep statutory detail available; move the estimate into Summary. Define Zayogya visual compatibility. |
| F-02 | Confirmed; expand | `VatReturnReportService.cs:488–498` sums GrandTotal and expenses without Approved filtering, and omits returns. Specify returned COGS/stock/write-off treatment too; simply subtracting returned revenue can produce a wrong profit estimate. |
| F-03 | Confirmed | Sale and purchase gross-derived fallbacks lack provenance. DTO line classes have no derived flag and validator has no V015. Some existing sales fallback rounding uses default midpoint rounding. |
| F-04 | Confirmed; expand | `VatReturnReportService.cs:206–227` subtracts every sale return from standard sales without loading original scenario. Add posted-status filtering and original-line scenario/tax evidence. |
| F-05 | Confirmed | Output values and recoverable input are clamped (`:226,367`); validator V010 also repeats the clamp. Preserve signed management amounts and separately approve filing treatment. |
| F-06 | Confirmed; more severe | Public calculation catches exceptions into zero DTO/SYS001 (`:65`). GET later replaces ValidationIssues (`ReportsController.cs:125`), potentially removing SYS001. Several controller catches expose raw errors. Preserve failure identity across all consumers, including lock and exports. |
| F-07 | Confirmed; more severe | Calculate overwrites Locked boxes as well as resetting Submitted (`ReportsController.cs:294–307`). Reject before calculating or assigning anything; test both statuses. |
| F-08 | Confirmed | GET/exports calculate live; the period only supplies status/id. Lock does not store detail snapshot or refresh persisted calculated boxes. Centralize snapshot retrieval for all outputs and validation. |
| F-09 | Confirmed; expand | ReturnService has no VAT-period guard. Validator ignores Submitted; updates check only one side of date changes. Include approval/rejection/reversal/deletion, indirect expenses, imports, and lock/write concurrency. |
| F-10 | Partially incorrect | Unique index exists in model and migration. Transactional/idempotent upsert and range-overlap control remain required. Actual database index installation was not inspected. |
| F-11 | Confirmed; more severe | GET stamps date-only values UTC; Calculate converts GST to UTC (`ReportsController.cs:255`) then truncates UTC dates for period identity. This shifts period keys and purchase/expense calendar filters. Assess stored timestamp semantics before changing convention. |
| F-12 | Confirmed, unsafe scope | Reverse charge adds eligible input but not output tax. REL-016 also covers non-reverse-charge box-label errors. Restrict official filing until the complete mapping is approved. |
| F-13 | Confirmed | Expense claimable precedence treats explicit zero like missing and can fall back to full VAT. Preserve intentional zero/partial recovery and distinguish stored tax from unsupported estimates. |
| F-14 | Overstated | V009 compares lines with boxes and can detect clamp/classification discrepancies; V010/V011 check internal arithmetic. They are not independent-source assurance, but “can never fail” is false. Keep useful consistency checks and add independent reconciliation. |
| F-15 | Qualified risk | Legacy fallbacks exist; global EF tenant filters change ordinary-request exposure. Reproduce host/JWT/platform/raw-query behavior before claiming a leak. Document safe backfill candidates and ambiguous NULL rows. |
| F-16 | Qualified | Query predicates differ, but global tenant filters can make their effective row sets equal in normal scope. Align tenant filtering and test actual scope; profit also differs in statuses/dates. |
| F-17 | Existing protection; more proof needed | Validation/exports constrain periodId by TenantId (`ReportsController.cs:446,521,572`). Add foreign-id 404 checks for every period operation/export; tests run here are not that complete matrix. |
| F-18 | Confirmed | VatTrackingRequest has no field lengths/whitelist; EventType is incorporated into an audit action. Staff is explicitly authorized on tracking, contradicting “Staff cannot call any VAT endpoint.” Define telemetry policy separately. |
| F-19 | Confirmed | VAT DTO/page/export header lacks company/TRN metadata. Fetch tenant-scoped current settings; provide shared-TRN warning without cross-tenant disclosure. |
| F-20 | Partly overstated | No VAT PDF method/endpoint exists. Browser print is used, but `src/index.css:191` already resets off-screen position/opacity for print. Blank mobile printing is not established without browser evidence. Reuse PDF/font infrastructure and test actual outputs. |
| F-21 | Confirmed | CSV interpolates references without quoting/escaping/BOM and uses culture-dependent decimal formatting (`ReportsController.cs:587`). Sanitize text fields for formulas; keep trusted negative numeric values numeric. Party-name CSV columns do not currently exist. |
| F-22 | Incorrect as stated | Two distinct routes and two DTOs exist; frontend has wrappers for both. Consolidation/deprecation and date-boundary fixes are needed, not a duplicate-route deletion. |
| F-23 | Confirmed | Page is large, with diagnostics/backfill visible in ordinary workflow. Split around stable report contract and role-gate administrative operations on the server. |
| F-24 | Confirmed; browser proof pending | Tabs use flex-wrap; lock/submit handlers lack dedicated in-flight state/confirmation/acknowledgement. Some loading UI already exists, so avoid claiming none. Verify each viewport/state with actual rendering. |
| F-25 | Confirmed | Workflow/export handlers have no authoritative audit call. Client tracking is not proof of committed business action. Persist server audit with transaction result/version, including idempotent replay behavior. |

## Missing findings to add

1. **Screen/export disagreement is already in the frontend.** `VatReturnPage.jsx:462–470` substitutes detail or Sales Ledger totals for zero boxes and recomputes net payable. With zero standard taxable value plus zero-rated sales, it can display zero-rated net in the standard taxable summary. With a purchase VAT 5 and an equal purchase-return VAT 5, backend recoverable is zero but the UI substitutes the purchase's 5. Make server totals authoritative; show incomplete data as a warning instead of synthesizing filing figures. Test the screen against the actual export content, not only a shared service DTO.

2. **Unposted returns affect VAT.** Sale/purchase return queries have no status restriction, although models distinguish Pending/Approved/Rejected/Reversed. Only the approved/posted tax-effective lifecycle should enter the calculation; add pending, rejection, reversal, and same-period/prior-period cases. Also bind purchase-return recovery reversal to the original claimed portion and tax scenario; an unclaimable purchase return must not reduce another purchase's recovery.

3. **Monthly deadline calculation is wrong.** `GetPeriodLabelAndDue` uses `AddMonths(2).AddDays(27)` from the first day of the month. January therefore gives 28 March. The normal deadline is 28 days after the tax period ends, subject to official exceptions; see [FTA filing guidance](https://tax.gov.ae/en/taxes/genericcontent/filing.vat.returns.and.making.payments.aspx). Add month-end/leap/year-boundary tests, an official deadline override, and approved business-calendar behavior. Do not treat an estimate as an authoritative deadline.

4. **Filing-cycle design is too narrow.** `QuarterlyFta` models only the Feb–Apr stagger. FTA's published guide also lists Mar–May and Apr–Jun cycles. Store a verified filing-cycle anchor/effective date instead of assuming a universal FTA quarter; Custom/year reports must be explicitly separated from lockable filing periods. See the [FTA return guide](https://tax.gov.ae/DataFolder/Files/Pdf/VAT%20Returns%20User%20GuideEnglishV40%2015%2008%202021%20SEP2021.pdf).

5. **Rounding granularity is not yet proved.** The service rounds invoice/return header totals; the plan mandates original invoice-line rounding. Declare the authoritative posted-line source, discount/round-off treatment, and reconciliation tolerances; use a fixture where rounding per line differs from rounding the invoice aggregate. Detail lines currently can remain unrounded while boxes are rounded.

6. **Entertainment policy conflicts.** Edge case 11 says nonclaimable entertainment; VatCalculator applies a 50% cap. Record this policy as OPEN with accountant-reviewed examples, rather than copying the calculator's assumption into new tests. Petroleum/excise/partial-recovery classification needs similarly explicit supported cases.

7. **Stale-response handling is absent at page level.** `fetchVatReturn` directly writes each response, including a subsequent Sales Ledger fallback. An older period request can replace newer state; test period and tenant switches, failures, and loading completion. Existing shared API session tests are not a page-period race test.

8. **TRN gates are absent on local Lock/Submit.** Their handlers do not read TRN settings. Cover missing/invalid/sample TRNs server-side even when requests bypass the UI. Define how current headers may change on a locked reprint without changing amounts or audit identity.

9. **Shared-TRN outputs are tenant contributions.** A per-tenant PDF must not imply it is a consolidated filed return while accountant consolidation is pending. Preserve data isolation and record external consolidation/filing evidence explicitly.

## Test evidence from this review

Fresh results for this checkout, not inherited counts from STATE:

| Check | Result | Evidence |
|---|---|---|
| Focused backend VAT/Zayogya/report-isolation/Staff authorization tests, Release | 63 passed, 0 failed, 0 skipped; API and test compilation succeeded | `review-evidence/backend-tests.log`, `review-evidence/vat-review.trx` |
| Full existing frontend suite | 127 passed, 0 failed, 0 skipped | `review-evidence/frontend-tests.log` |
| Frontend production build | Succeeded in 50.09 s; existing chunk-size and browser-data warnings remain | `review-evidence/frontend-build.log` |
| PostgreSQL/full backend suite | NOT RUN; HEXABILL_TEST_POSTGRES is unset | This is not Phase 0 or a release gate PASS. |
| New defect reproductions, migrations, real data backfill | NOT RUN | Review-only scope; no existing test was changed. |
| Browser screenshots / mobile PDF / three tenant export samples | NOT RUN | No new UI/PDF implementation was produced. |

Toolchain: .NET SDK 9.0.311, Node 24.13.0, npm 11.6.2. Backend test-build log contains 44 compiler-warning lines (43 API, 1 tests); no zero-warning claim is made. These existing tests cover selected normal paths and earlier estimate behavior; they do not prove all proposed fixtures, lifecycle concurrency, export parity, or an approved Zayogya golden baseline.

The focused command was:

```powershell
dotnet test tests/HexaBill.Tests/HexaBill.Tests.csproj --configuration Release --filter 'FullyQualifiedName~Vat|FullyQualifiedName~ZayogyaRegressionSnapshotTests|FullyQualifiedName~ReportsHttpIsolationTests|FullyQualifiedName~StaffAuthorizationTests' --logger 'trx;LogFileName=vat-review.trx' --results-directory VAT/review-evidence
```

## Recommended revision order

1. Reconcile plan authority/branch, filing-vs-management scope, Zayogya compatibility, synthetic TRN policy, period cycles, and accountant-owned decisions. Retain the original supplied files as references.
2. Rebaseline on the chosen current checkout with disposable PostgreSQL and a reviewed Zayogya baseline. Split the expected-red preparation gate from green implementation gates.
3. Add expected-red regressions for wrong dates, ignored return statuses, UI/export substitution, error-to-zero propagation, Locked/Submitted mutations, and lock-vs-write races, alongside the original findings.
4. Fix tenant filters and provenance, calculation/date/rounding rules, and immutable lifecycle. Maintain a safe draft-only default where filing policy is unresolved.
5. Verify migration repair/rehearsal prerequisites before adding schema-dependent workflow. Confirm existing indexes rather than duplicating them.
6. Build one authoritative report/snapshot projection for screen/PDF/Excel/CSV, then rebuild the responsive page and test actual extracted export content.
7. Complete synthetic tenant journeys, full regression/security/performance, accountant review, and deploy/rollback rehearsal. Prepare deployment instructions against the final implementation; this review does not authorize or perform deployment.

OPEN decisions: approved filing projection including reverse charge/Emirate allocation; verified tenant filing certificates/cycles; shared-TRN consolidation; negative-adjustment filing treatment; expense eligibility and returned COGS policy; amended-period workflow; acknowledged-derived-data policy; Zayogya golden compatibility; branch authority; production sample policy reconciliation and test-only fixtures; migration history repair/rehearsal.
