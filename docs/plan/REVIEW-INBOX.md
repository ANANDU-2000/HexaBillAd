# REVIEW-INBOX.md

## 2026-10-05 IST — Chrome Pay All contract repair (REL-031)

Chrome against isolated synthetic data reproduced a missing Pay All control: the customer-scoped outstanding-invoice endpoint omitted `customerId`, while the ledger required that property to admit each invoice. Added the response field and mapped `sale.CustomerId` without weakening the existing frontend or backend customer/tenant filters. A real HTTP contract regression failed before the fix; focused customer isolation passed 16/16 afterward. Full backend suite on a separate fresh PostgreSQL database passed **673 / 0 skipped / 0 failed**; Release API build **43 warnings / 0 errors**. No entity/schema/migration changed.

Chrome then posted the 105 AED allocation (5 + 40 + 60) and voided all three new payments through the app. Balances returned to 105 AED; the two original independent equal 50 AED receipts remain cleared. Other synthetic tenants' balances/sales/payments remain at baseline. Screenshots before/after, posted/voided, and five ledger sizes were actually inspected. This verifies that path only: full page counter remains 0 DONE / 2 partial / 59 NOT RUN. A guarded test bridge is required while migration initialization fails; it explicitly reports migrationProof=false and cannot certify Production startup.

New REL-032 is still open: Bills footer reports 0 paid despite the visible partial invoice showing 100 paid. The code totals only fully paid invoices. Also prioritize UI lost-response/manual-resubmission behavior: the previous iteration verified API/service-key replay but did not establish the form's key lifetime across retries. No browser acceptance for that behavior is claimed.

Runtime synthetic credentials were generated only in process memory and rotated after detecting CLI argument/title echo risk; verified stdin input avoids credential arguments. Browser storage was cleared, owned Chrome/API/Vite/PG stopped, and pre-existing local services left running. No production operations, commits/pushes or flag changes.

Current release review: [RELEASE-AUDIT-20261004.md](RELEASE-AUDIT-20261004.md), defects: [ERROR-REGISTER.md](ERROR-REGISTER.md). Nine initial findings cover money history, failed migration chain, VAT divergence, silent zero reports, incomplete golden regression evidence, dependencies and stale trackers. Current owner appoints Codex single executor for PRODUCTION-RELEASE-LOOP.md; prior read-only role is superseded for this release. Historical entries below are preserved. No production sign-off.

## 2026-10-04 — startup and schema-readiness review (REL-011)

**Severity: S1.** `Program.cs` has two independent migration checks: a delayed task around lines 1350–1409 and database initialization around lines 1411 onward. Both suppress migration failures; the latter is background work and explicitly continues after failed DDL. Production PostgreSQL skips EF migrations but still attempts direct schema DDL helpers, whose failures are logged as warnings. The ready health check proves database connectivity, not that required schema initialization completed. Therefore a reachable/ready process can still serve against an incomplete schema. This finding expands REL-011; it does not resolve the historical migration collision. A safe fix needs one authoritative initialization/readiness lifecycle and tests proving pending or failed schema work prevents readiness and business requests. No schema initialization behavior changed in this review iteration.

## 2026-10-04 — tenant-wide diagnostics write (REL-018)

**Severity: S1.** `DiagnosticsController.FixMissingColumns` was authorized to tenant Admin/Owner roles. Although SQLite-only, its raw `UPDATE Sales` initialization had no tenant predicate, so one tenant owner could mutate all tenants' `TotalAmount`/`PaidAmount` values. It also performed schema changes outside EF migrations. Retired the endpoint with HTTP 410, restricted access to SystemAdmin, and directed operators to versioned migrations. HTTP integration coverage proves a tenant owner receives 403, SystemAdmin receives 410, and a synthetic tenant-B sale in a repair-triggering state remains untouched. Full PostgreSQL test suite passed after the change. The fix does not close the independent startup migration/readiness risk (REL-011).

## 2026-10-04 — SQL console query literal retention (REL-019)

**Severity: S2.** The SystemAdmin SQL console stored up to 200 characters of successful query text in application logs and audit details and reflected provider exception messages to the caller. Query text can contain literal credentials or client data. Replaced query snippets with a random per-execution ID in both log and audit records, and made failure responses generic. A PostgreSQL-backed controller regression executes a synthetic literal and confirms the literal is not present in persisted audit details. Full backend PostgreSQL suite passed **635/635**, zero skipped; API build passed with zero warnings/errors. Log-provider output is not separately captured in the regression, but code now logs only the random query ID.

## 2026-10-04 — Codex worktree uncommitted WIP (inventory)

**Path:** `C:\Users\anand\.codex\worktrees\afa0\HexaBilngApp`  
**Branch tip commit:** `846ee95` (already ancestor of `main` @ `a958394`)  
**Working tree:** dirty — ~33 modified, 5 untracked. Diffstat ~702 insertions / 316 deletions.

### Modified (feature groups)
- **Settings / TRN:** `SettingsService.cs`, `SettingsController.cs`, `CompanySettings.cs`, `DTOs.cs`, `SettingsPage.jsx`, `TenantCompanySettingsTests.cs` (untracked)
- **Document header / PDF / receipt:** `PdfService.cs`, `InvoiceTemplateService.cs`, `InvoiceTemplatesController.cs`, `PaymentReceiptService.cs`, `ReceiptPreviewModal.jsx`, `receiptPreview.test.js`, `DocumentHeaderTests.cs` (untracked)
- **Sales / returns / daily close touchpoints:** `SaleService.cs`, `SalesController.cs`, `ReturnService.cs`, `DailyCloseService.cs`
- **SuperAdmin:** `SuperAdminTenantService.cs`, `SuperAdminTenantsPage.jsx`
- **Test harness:** several `*PostgreSqlTests.cs`, factories, collections (small edits)
- **Docs:** `PHASE-TODO.md`, `refactor-progress.md`

### Untracked
- `docs/plan/IMPLEMENTATION-PROMPT.txt` (main already has a tracked copy — compare before overwrite)
- `docs/plan/PAGE-SPECIFICATION.md` (already on main)
- `tests/.../DocumentHeaderTests.cs`
- `tests/.../PostgresTestSchema.cs`
- `tests/.../TenantCompanySettingsTests.cs`

### Action for executor
Port onto `main` in slice "Port Codex WIP"; resolve conflicts preferring main's Tier0 commits where behavior already supersedes; keep Settings reconciliation + header tests if they still add coverage.

## 2026-10-04 — Legal risk: sample TRN in Production

Anandu approved sample VAT TRNs on Tax Invoices in Production until clients update. Executor must keep banner + audit trail. Accountant/FTA validity is **client responsibility**. Track until real TRNs entered.

## 2026-10-04 — D8 conflict

MASTER-LOOP D8 says empty VAT blocks Tax Invoice. DECISIONS 2026-10-04 sample-TRN override wins for FrozenHub1/2 and GulfHarvest. Zayogya stays D6 unchanged (may remain empty/no sample).

## 2026-10-04 — Codex WIP port decision: DO NOT APPLY

Compared worktree dirty tree vs `main` @ `a958394` / `master-loop`.

**Content-identical (line-ending noise only):** SettingsPage, ReceiptPreviewModal, InvoiceTemplateService, PaymentReceiptService, DocumentHeaderTests, SalesController, InvoiceTemplatesController, PaymentReceiptTests, web factories, SuperAdminTenantsPage, SettingsHttpIsolationTests, TenantCompanySettingsTests, PostgresTestSchema, receiptPreview.test.js, DailyCloseService.

**Regressive vs main (do not port):**
- Removes `CountOtherTenantsSharingVatTrnAsync` + shared-TRN warning on settings PUT
- Reverts `RequireTaxInvoiceVatTrn` to ignore Production sample guard (partially aligned with later Anandu sample-in-prod decision, but main already has SampleVatTrn helper)
- Removes `Subdomain ?? string.Empty` null-coalesce (GetTenants 500 fix)
- Requires source COMPANY_TRN before shared-legal owner setup (blocks empty/sample flow)
- Removes `MustChangePassword=false` / `SessionVersion++` on password reset
- Strips audited `ReverseSaleReturnAsync` (~254 lines) back to inline damage inventory

**Conclusion:** Main Tier0 commits already contain the valuable Codex intent. Port = no file copies. Backup patch kept at `Desktop/HexaBill_Backups/codex-wip-port-20261004-101602/`.
## 2026-10-04 — purchase return quantity integrity (REL-020)

- **Severity:** S1 money/stock integrity.
- **Finding:** `CreatePurchaseReturnAsync` accepted arbitrary quantities and did not account for previous returns; repeat/concurrent requests could reduce stock and record supplier returns beyond the original purchase quantity.
- **Fix:** Reject empty/oversized/duplicate-line requests and nonpositive or excess quantities. Serialize tenant purchase-return posting and lock the PostgreSQL purchase header row before calculating remaining quantities.
- **Evidence:** `PurchaseReturnStockTests` now covers zero, over-purchase, and duplicate full-return attempts; focused tests pass 6/6. Full PostgreSQL and browser verification pending.
## 2026-10-04 — readiness gate hardening (REL-011, partial)

- `/health/ready` now remains 503 while asynchronous database initialization is pending or failed, and after initialization it checks DB connectivity plus pending EF migrations before returning 200.
- The readiness failure payload is generic and no longer echoes provider exception text.
- The separate delayed migration task has been consolidated into the initializer. The Production/Render fast path now performs the final pending-migration check before returning; supplier-credit schema failure leaves readiness failed.
- HTTP regression covers initialization-pending, initialization-failed, and a reachable SQLite schema with unapplied migrations; all return 503. Focused readiness/purchase-return tests pass 7/7.
- **Still open:** pre-host schema helpers and many nested DDL catches still warn/continue; the production migration collision is unresolved. This is partial containment, not closure of REL-011.

## 2026-10-04 — readiness does not gate application traffic (REL-021)

**Severity: S1.** `DatabaseInitializationStatus` is consulted only by `/health/ready`. The global request pipeline has no corresponding gate, while `/health` checks DB connectivity only and can return 200 without proving schema readiness. Initialization runs asynchronously after the server starts, so business routes remain reachable while state is Pending or Failed unless the hosting platform is configured to honor `/health/ready` exclusively. Production release instructions currently call for `/health`; therefore REL-011's partial change does not yet guarantee fail-closed serving. Add a request-pipeline gate with explicit health/readiness exceptions and regressions proving a business endpoint returns 503 until Ready, while both health endpoints report unavailable for Pending/Failed state. Also test startup's real hosting path. No code changed for this finding.


## 2026-10-04 — REL-021 request gate implemented locally

`DatabaseInitializationGateMiddleware` now returns 503 for non-health requests while database initialization is Pending or Failed. `/health` reflects initialization state, and readiness remains responsible for connectivity and migration checks. HTTP regression confirms a business route plus both health endpoints remain unavailable until the schema state permits service. Full PostgreSQL-configured backend suite passed **643/643**, no skips; Release API build passed with 43 warnings and 0 errors. Production hosting health-check configuration and an end-to-end Production/Render startup were not exercised.


## 2026-10-04 — anonymous return refunds omitted from cash close (REL-022)

**Severity: S1.** `CreateSaleReturnAsync` and `ApproveSaleReturnAsync` only created the cleared cash refund `Payment` when the source sale had a customer. Anonymous cash sales therefore kept `RefundStatus=Refunded` without recording money out. Separately, `DailyCloseService.ApplySaleBranchFilterAsync` retained only payments with a `SaleId`; return payments carry `SaleReturnId` and no `SaleId`, so branch close omitted those outflows. Failing-before tests reproduced both gaps. The fix records refunds regardless of customer identity and includes refunds via their tenant-scoped SaleReturn/source-sale branch. Focused failing-before regressions pass; full PostgreSQL-configured suite passes **646/646**, zero skips/failures; Release API build passes with 43 warnings and 0 errors.


## 2026-10-04 — tenant suspension lookup failed open during login (REL-023)

**Severity: S1.** The login service caught all tenant-status lookup exceptions and proceeded with a valid user/password. If the tenant status query failed while the user query remained available, a suspended or expired tenant could receive a new JWT. A SQLite command interceptor reproduced the issue before the fix; the test verifies login denial and unchanged `LastLoginAt`. `AuthService` now fails closed when the status check errors. Focused regression and full PostgreSQL-configured suite pass (**647/647**, zero skips/failures); Release API build passes with 43 warnings and 0 errors.

## 2026-10-04 — supplier merge omitted tenant predicate on purchase returns (REL-024)

**Severity: S1.** Supplier merge's preview count and raw update matched purchase returns only by `SupplierId`. Although supplier IDs are globally unique in valid data, each purchase return has its own tenant key, and relying on referential consistency does not enforce isolation. Both operations now scope by `TenantId` and supplier ID. A platform-scope SQLite integration regression seeds a tenant-B return referencing tenant-A's loser and verifies its count is zero and SupplierId is unchanged. Focused regression passes; full PostgreSQL-enabled suite passes 648/648 with zero skips or failures.

## 2026-10-04 — POS invoice title and TRN policy conflict (REL-025)

**Severity: S2 legal/document.** Both POS shells render a hardcoded “Tax Invoice” label without checking tenant TRN. The main PDF service uses `SampleVatTrn.DocumentTitle` in its primary render paths, but `SimplePdfService` and the static HTML template retain hardcoded titles. Source search found no `SimplePdfService` DI registration or route, so that path's runtime use is unproven. Separately, DECISIONS.md records an owner-approved decision to seed sample TRNs in Production, then a newer same-day section proposing `SAMPLE INVOICE` output and marking it pending owner approval. The approved sample-seeding decision does not explicitly approve the proposed document-title rule. Resolve that policy conflict, then align active UI/PDF paths and verify in a synthetic browser session.

## 2026-10-04 — return balance recalculation crossed tenant scope (REL-026)

**Severity: S1 isolation.** Seven return/credit-note paths fetched a customer by key and then used the row's own tenant ID to recalculate its balance. Under a broad/platform DbContext scope, a tenant-A return referencing a tenant-B customer could cause a write to that tenant-B row. A regression with a malformed cross-tenant reference failed before the fix (balance 777 became 0); all paths now pass the operation's explicit `tenantId`, allowing the balance service's `(customerId, tenantId)` filter to deny the cross-tenant write. Focused return and credit-note/Daily Close tests pass 22/22. Full suite against a disposable PostgreSQL 17 UTF-8 cluster passes 649/649 with zero skips. Isolated Release build passes with 43 existing warnings. Browser journeys remain pending.

## 2026-10-04 — shared balance service tenant boundary (REL-027)

**Severity: S1 isolation.** The `IBalanceService` API previously accepted only a customer ID for recalculation and validation, then derived TenantId from the row fetched by key. With platform-wide query scope this could update a foreign tenant's balances. All balance mutation and validation APIs now require a tenant ID; queries use `(CustomerId, TenantId)`, and callers in the sales/payment APIs, validation controller, and scheduled reconciliation job supply the verified operation/customer tenant. `BalanceMismatch` carries TenantId so platform repair stays scoped per row. Added a synthetic platform-scope regression for tenant-A operation against a tenant-B customer. Full disposable PostgreSQL suite passes 650/650, zero skips; Release build has 43 warnings and 0 errors.

## 2026-10-04 — bulk allocation overpaid invoices (REL-028)

**Severity: S1 money.** Bulk allocation reused the same outstanding-invoice DTO for repeated invoice entries and read balances before acquiring any invoice lock. Duplicate entries could consume the same balance twice. A deterministic PostgreSQL regression held the invoice row until two independent requests reached a lock wait; the original implementation then committed 200 AED against a 100 AED invoice. Validation now rejects repeated IDs; PostgreSQL locks all requested invoices by tenant/customer in stable ID order before reading outstanding amounts. Cleared allocation refreshes the sale's state from posted payments. The no-outstanding case now fails before committing a success audit or idempotency row, and the HTTP handler maps that expected failure to 400. Three SQLite regressions and the PostgreSQL race pass; the full suite passes 654/654 with zero skips/failures. Isolated incremental Release build passes with zero warnings/errors; earlier clean-build warnings remain recorded. Browser verification is pending. Idempotency-key scope/retries and sub-cent allocation precision remain review follow-ups, not claimed fixes.

## 2026-10-04 — allocation rounded beyond receipt budget (REL-029)

**Severity: S1 money.** Allocations used unrounded decimal amounts for the remaining receipt budget but rounded each persisted Payment.Amount independently. Failing-before SQLite regressions observed a 0.03 AED budget posting 0.04 AED (two 0.015 allocations), a 0.015 budget posting 0.02 AED, and a 0.004 request posting 0.00 AED. The endpoint now rejects sub-cent receipt totals and allocation entries before any write. A valid cent-precision split verifies that a 0.03 budget allocates 0.02 then 0.01 and updates the customer's remaining balance correctly. The ledger uses the existing roundMoney helper for its summed pay-all total so JavaScript floating-point summation does not cause ordinary cent-precision invoices to fail the stricter endpoint validation. Seven allocation regressions pass; full dedicated disposable PostgreSQL suite passes 658/658, zero skips/failures. Release build passes with 43 existing warnings; frontend test/lint/build commands pass, lint has 237 warnings. Browser reproduction/acceptance remains pending.

Next retry review: PaymentIdempotency has a globally unique raw string key and no TenantId property, so it has no automatic tenant query filter. PaymentService does tenant-scope the returned payment, but both create/allocation check the key before their transaction/row lock and do not recheck after waiting. The ledger prepares an idempotency key for pay-all but does not pass it to paymentsAPI.allocatePayment; that service sends no Idempotency-Key header. These are confirmed source gaps; cross-tenant collision and concurrent retry behavior still need dedicated failing-before regressions before a fix is claimed. No schema/history change was made.

## 2026-10-04 — payment idempotency tenant boundary and replay (REL-030)

**Severity: S1 money/retry integrity.** Create and allocation looked up a globally unique raw key before entering the transaction, then inserted the same raw key. Failing-before synthetic tests found tenant B was blocked by tenant A's key, changed-amount retries silently returned the prior payment, and replay responses changed after later payments. Deterministic PostgreSQL tests held an invoice until both same-key requests blocked: create's second request failed ArgumentException and allocation's failed DbUpdateException instead of returning the first payment. Two frontend transport regressions also proved allocation omitted Idempotency-Key, including after a lost response.

Both endpoints now share tenant-qualified hashed storage keys within the existing 100-character column, take a PostgreSQL transaction advisory lock before looking up the key, bind new keys to a request hash, and atomically save a complete response with the payments and audit. Decimal hashing canonicalizes equivalent 40 and 40.00 values without rounding money. Legacy raw-key lookup includes explicit payment tenant ownership. The allocation client and ledger now forward the same caller key; callers without one receive a generated UUID.

The first full post-change suite exposed a replay regression (667 pass / 3 fail): a snapshot of a subsequently voided payment still said CLEARED. Corrected replay to keep the original identity but refresh payment, paired adjustment and affected summaries when the retained payment has been mutated. The 17 focused idempotency and existing HTTP/PG void-identity cases now pass. The final complete PostgreSQL-enabled suite passes 672/672 with zero skips/failures (1m20s); API Release has 43 warnings / 0 errors. Frontend 84/84, lint 237 warnings / 0 errors, Vite 33.59s. Browser acceptance remains pending.

Compatibility limits: legacy rows never stored a complete request fingerprint, so they use tenant-scoped live replay. New rows use versioned keys/snapshots. No schema or historical migration changed, but a backend rollback to code that only knows raw keys would not recognize the new hashed keys: Stage B must verify a rollback build with versioned-key replay support or an explicitly rehearsed write/retry freeze. A rollback is not declared safe merely because the schema stayed unchanged. UI timeout/resubmission-key lifetime remains a separate browser review item.
# 5 October 2026 — REL-032 Bills totals correction

Chrome reproduced the visible partial invoice paid100 while the footer showed0. The old algorithm filtered fully paid statuses and summed invoice face values. The shared invoiceBillTotals helper now sums the supplied rows' actual paid amounts, coerces numeric values and rounds final totals. Desktop and mobile use the same calculator. Seven regressions applied to the copied original algorithm initially had5fail/2pass and now7/7 pass. FullFE99/99, lint236warnings0errors, build28.72sPASS; focused Zayogya3/3. Backend/schema/VAT/print code unchanged; full backend673/0/0 remains historical.

Five Bills sizes were captured/inspected. Empty date-filtered scope shows zero totals and survives refresh with customer/tab/dates. Chrome row Pay5 posts only ID22; BillsPaid/Pending changes100/105→105/100 without reload. Receipt preview shows5 AED with a legacy-reconstruction warning, so no original snapshot/PDF/header acceptance is claimed. UI void22 retains source history, disables receipt controls and restores Bills100/105, invoicePaid100 and all four customer balances105. Full page remains partial; existing layout, all interactions/error states, role, long-text, Back/scroll and complete tenant journeys still require evidence. No production sign-off.

# 5 October 2026 — REL-033 payment retry and REL-034 mobile layout

Real Chrome reproduced a committed payment whose response was lost: the next Save generated another UUID and another receipt. Customer Ledger now journals the original request/key before POST, scoped by origin, tenant, user and customer. It retains that command for network/server uncertainty, blocks changed forms and offers recovery after reload. One send path handles create/allocation, receipt offer and refresh. No credentials are stored; the financial request is held in same-tab sessionStorage without an arbitrary expiry. Server authorization remains authoritative. Corrupt/unavailable storage fails before posting. Closing the browser or using another tab is outside this verified recovery scope; full page/error-state acceptance remains open.

Chrome confirms one 21 AED payment after lost response, frozen 105 AED allocation after reload and one 19 AED payment after the actual 30-second UI timeout. Exact-key/body comparisons return true; all new receipts are retained VOID after application API cleanup and all four synthetic baselines reconcile. Eight new tests pass; full FE92/92, lint236 warnings0errors, focused Zayogya3/3. Build and teardown results are in RELEASE-AUDIT. Mobile general-payment text overlap was additionally found and corrected (REL-034); full acceptance is not inferred from these screenshots. REL-032 remains OPEN. Additional Chrome check forced403 on a retry after a lost committed response: before it discarded the journal and allowed two23 receipts; after the guard it retains uncertainty, all three calls use one key/body and only one27 receipt commits. All new IDs12–21 are retained VOID after API cleanup. Final frontend build41.83s passes.
