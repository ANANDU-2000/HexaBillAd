# FrozenHub 1 + 2 — Invoice Print Repair: Corrected TODO / Plan

Created 2026-11-01. Supersedes the ordering in `FROZENHUB-PRINTING-TODO.md` (written against old branch
`feature/worksheet-analytics @ 427e1684`, now stale). The root-cause audit was based on `main @ 89a2d1d9`.
Current local checkpoint is `main @ 3e7cad34`; the shared worktree contains pre-existing edits and untracked
files across print, settings, migration, and reconciliation work. Preserve all of them; do not infer ownership from this plan.

Tenants: FrozenHub 1 = tenant 20 (`frozenhub.hexabill.company`), FrozenHub 2 = tenant 23 (`frozenhub2.hexabill.company`).
Reference sample: invoice 7000, ISHAKALI RESTAURANT, 24-10-2026, AED 806.00 (must stay financially unchanged).

---

## A. Root causes — verified in code at 89a2d1d9

| # | Symptom | Code evidence | Fix type |
|---|---------|---------------|----------|
| RC-1 | Bank block never prints | `PdfService.cs:868-872` `RenderInvoiceBankDetails` returns silently unless `INVOICE_BANK_ACCOUNT_NAME`, `INVOICE_BANK_NAME`, `INVOICE_BANK_IBAN` are all non-empty. T20 keys absent, T23 keys empty (per live DB audit — re-confirm read-only). | Data (owner values) + code (no silent skip, readiness check) |
| RC-2 | Duplicate "FROZENHUB" left heading | `PdfService.cs:1376` title printed unless `compactInvoice && logo != null`. `compactInvoice` = `INVOICE_HEADER_PRESENTATION == "compact"` (`SettingsService.cs:294`). | Code: FrozenHub policy always suppresses left title when logo present |
| RC-3 | Email + P.O. Box missing | `PdfService.cs:1380-1383` email hidden when `FrozenHubHeaderPolicy` (`INVOICE_HEADER_STYLE_LOCKED`) unless compact; P.O. Box printed **only** when compact. | Code: FrozenHub policy prints Mob → P.O. Box → Email → Address → TRN always |
| RC-4 | Customer balance wrong / missing | `PdfService.cs:2236` `GetCustomerPendingBalanceInfoAsync` = operating Sales − Payments − Returns only; ignores `LegacyOpeningReceivables` / `LegacyInvoices` / `LegacyPayments` that `CustomerService.cs:1107-1242` (ledger) already uses with no-double-count rule. | Code: extract one shared balance projection used by ledger + PDF |
| RC-5 | Footer hidden for valid balances | `PdfService.cs:588` footer only when `TotalPendingBills > 0` (operating Sales count only). | Code: always show summary when customer is set (zero shown as 0 / AED 0.00) |
| RC-6 | Amount-in-words truncated | `PdfService.cs:520-523` cut to 77 chars + "...". | Code: wrap, never truncate |
| RC-7 | Bank line order | Prints Account Name → Bank → IBAN; client wants Bank Name → Account Name → IBAN. | Code |

Note: setting `INVOICE_HEADER_PRESENTATION=compact` would already unhide email/P.O. Box today — but that is a workaround; the fix belongs in the FrozenHub header policy so both tenants behave identically.

---

## B. BLOCKERS — owner must supply / approve (do NOT invent)

> 2026-11-01 status: B-1 and B-2 are **BLOCKED** (no verified value supplied). Code is ready to print them once saved; nothing was written to live tenants.

- [ ] **B-1 IBAN** — exact value from the ADCB Islamic bank document (do not confuse with account number; account number is NOT printed).
- [ ] **B-2 P.O. Box** — 8316 vs 8318 conflict; 8316 is on the Silver Line reference (another company). Need FrozenHub's real number.
- [ ] **B-3 Print email** — one shared invoice contact email for both tenants? (T20 has `frozenhubfoods@gmail.com`; T23 differs). Login emails must not change.
- [ ] **B-4 Bank sharing** — written confirmation that tenant 23 may print the same ADCB account (account name FROZENHUB FOODSTUFF TRADING LLC SPC).
- [ ] **B-5 FH2 legal identity** — same legal name / Arabic name / VAT TRN as FH1, or different? (Do not copy T20 TRN to T23 by assumption.)
- [ ] **B-6 Reprint footer wording** — confirm label "Customer balance as of <Dubai date/time>" on reprints of old invoices.
- [ ] **B-7 Production write approval** — settings writes on T20/T23 + deploy (CLAUDE.md rule 10).

Code work in C–E can proceed now; F (live data) and G (release) wait for B.

---

## C. Code fixes (local, test-first) — P0

### C-1 Header policy (RC-2, RC-3) — `PdfService.RenderCompanyHeader`
- [x] Test first: FrozenHub-policy A4/A5 PDF text contains Mob, `P.O. Box:`, email, `Abu Dhabi, Musaffah 17`, VAT TRN; left block does NOT contain standalone `FROZENHUB` title when logo present. (Synthetic tests; FH1 A4/A5 and FH2 A5. Empty TRN now asserts `INVOICE`, not `TAX INVOICE`.)
- [x] Left block order: Mob → P.O. Box → Email → `INVOICE_PRINT_ADDRESS` (fallback `Abu Dhabi, Musaffah 17, UAE`) → TRN. (Automated order assertions.)
- [x] Each line omitted only when its setting is empty (no placeholders). (Synthetic empty-settings test covers phone, P.O. Box, email, CT/VAT placeholder omission and address fallback.)
- [x] Optional `INVOICE_PRINT_EMAIL` key falls back to `COMPANY_EMAIL`. (Automated synthetic test; owner decision B-3 on live contact value remains open.)
- [x] Logo: reduce `LetterheadLogoBox` size slightly; keep aspect ratio; fallback when image fails. (Automated size/aspect/failure tests; synthetic PDF visual review.)
- [x] Right block: Arabic name (≤2 lines), Arabic address, Arabic TRN; no overlap with logo column; phone digits/`+` LTR-isolated (already done — keep). (Synthetic PNGs visually reviewed; digit direction covered by the focused phone/header suite.)
- [ ] Non-FrozenHub tenants (Starplus, Gulf Harvest) render unchanged — regression test. (Gulf Harvest and Zayogya regression tests pass; Starplus PDF regression was not included in this run.)

**Local C-1 evidence (2026-11-01):** focused command and 90/90 result, 0 skips, recorded in `docs/production/print-evidence/2026-11-01-current-checkpoint-C1/README.md`; synthetic PDFs/PNGs are stored alongside it. This does not verify current production settings or close owner blockers B-1..B-7. The header can also print `CT Reg. No.` when configured; its live presence/order was not verified.

### C-2 Bank block (RC-1, RC-7) — `RenderInvoiceBankDetails` + `SettingsService`
- [x] Order: `Bank Name:` → `Account Name:` → `IBAN:` (grouped in 4s), under a "Bank Details" label. No account-number line. (`Bank_PrintsBankNameThenAccountNameThenIban_AndNoAccountNumberLine` A4+A5.)
- [x] Save validation (`SettingsService.EnsureInvoiceBankDetailsCompleteAsync` + `IsValidIban`): all-or-none checked against the tenant's merged stored values; ISO 13616 mod-97; UAE = `AE` + 21 digits. Partial/typo saves rejected with a clear message. (`Settings_PartialBankDetails_*`, `Settings_InvalidIban_*`, `Iban_Mod97` ×7.)
- [x] Readiness: Settings UI shows an amber "Bank details will not print until … filled in" notice; incomplete stored config prints no block and no placeholder (`Bank_IncompleteStoredConfig_PrintsNoBlockAndNoPlaceholder`). A server-side `printReadiness` API field was NOT added (UI computes it from the same three fields).
- [x] Shown on A4 + A5 only; not on 80mm/58mm (`Bank_NotForcedOntoThermalReceipts`).
- [x] No bank values hard-coded in source/bundle/logs. Tests use the published ISO example IBAN `AE07 0331 2345 6789 0123 456` (not a real account) with the approved bank/account names.

### C-3 Customer balance projection (RC-4, RC-5)
- [x] Implemented by **reusing the Customer Ledger directly** instead of a new service: `GetCustomerPendingBalanceInfoAsync` now takes `CustomerService.GetCustomerLedgerAsync(...)` closing balance and `GetOutstandingInvoicesAsync(...)` count, so the rule cannot drift from the ledger. Bill Paid/Due come from the invoice (`PaidAmount`, `ReturnedAmount`).
- [x] Opening receivable vs historical invoices — never both (ledger rule). Test: opening-only 1,611.99 + new 500 → **2,111.99**, 1 pending; 7 historical invoices = 8,954 + opening 8,954 + new 806 → **9,760.00**, 8 pending (not 18,714).
- [x] Pending count = open operating sales + open historical invoices (`GetOutstandingInvoicesAsync`).
- [x] Pending cheques: **finding** — the Customer Ledger credits every non-void payment, including PENDING and RETURNED cheques. The footer adds those back (balance counts cleared collections only) and prints "Uncleared cheques (not yet deducted): AED x". The ledger itself was NOT changed (separate financial-screen decision — see Open issues).
- [x] Ledger-equality assertions in tests (`LedgerClosingAsync` == printed balance for 143/136 shapes; pending-cheque case documents the intended difference).
- [ ] Tests run on EF InMemory, not PostgreSQL. Full suite incl. PostgreSQL-gated tests was run (see D), but these specific footer tests have no PostgreSQL variant yet.

### C-4 Footer layout (RC-5, RC-6, whitespace)
- [x] Always shown when `CustomerId` resolves to a customer of the invoice's tenant (also on the "body"/letterhead layout): `Bill Total | Bill Paid | Bill Due` / `Pending Bills | Customer Balance | As of dd-MM-yyyy HH:mm (UAE)`. Zero shows `0` / `AED 0.00`. Ledger read failure hides it (never a guessed 0.00).
- [x] Supplemental label printed: "Customer balance and pending bills are current account figures as of the time shown, not part of the original invoice." (B-6 wording still owner-approvable.)
- [x] Amount-in-words: 77-char truncation removed; wraps (`AmountInWords_IsNotTruncated`).
- [x] Order: totals → Bank Details → "Received the above goods in good order" → Receiver's Name/Sign | `For <CompanyNameEn>` → balance summary. Same on A5 (A5 bank text 6.5pt to match body).
- [~] Dead space: short A4 still leaves the lower third empty — the earlier client request (P0-PRINT-003) keeps the receiver block directly after the totals, and rows are not stretched. Multi-page: table header repeats, footer whole on last page (`ShortAndLongInvoices_KeepFooterTogetherOnLastPage` A4 1/40, A5 1/30). The company letterhead is not repeated on page 2 (unchanged behaviour).
- [x] No Starplus text on FrozenHub invoices (existing assertions pass).

### C-5 Settings UI — `SettingsPage.jsx`
- [x] Bank fields reordered (Bank name → Account name → IBAN), inline `validateInvoiceBankIban` (all-or-none + mod-97), amber readiness notice. `tests/settingsInvoiceBank.test.js` 3/3.
- [ ] Save → refetch → reload Playwright test: NOT run (needs the local browser harness; see Open issues).
- [x] "Invoice contact email" field → `INVOICE_PRINT_EMAIL` (blank = company email). Login email untouched.

---

## D. Local verification — P0 gate
- [x] `dotnet test` full suite, in-memory: **2093 passed, 0 failed, 114 skipped** (114 = PostgreSQL-gated). With a fresh disposable PostgreSQL 18 (127.0.0.1:55491): **2203–2206 passed, 1 skipped** (`MigrationRehearsal…`, needs migration rehearsal env) and **1 pre-existing failure** `ReturnBalancePostgreSqlTests.Ledger_NetsApprovedReturns_…(-5)` — fails identically on clean `HEAD 6171d688` without these changes.
- [~] Intermittent text-layer flake: 1–3 PDF tests per full run report a missing substring; the PDF *renders correctly* but its Lato text layer extracts as blanks. Rate ≈1/12 focused runs on this tree vs 0/18 on clean HEAD. Guarding QuestPDF global re-assignment (PdfService + CustomerService ctors) did not remove it. Root cause unresolved — see Open issues.
- [x] PNG evidence for invoice 7000 shape (cust 131), cust 143, cust 136, 1-item, 40-item A4, 30-item A5, FH1 + FH2, A4 + A5, using the repo FrozenHub B/W logo — `docs/production/print-evidence/2026-11-01-final/` (+ BEFORE client screenshot). Visually inspected.
- [x] Frontend: `npm test` 342/342, build OK, lint 0 errors in changed files (3 pre-existing lint errors in `ExpensesPage.jsx` etc., not touched).

### Open issues found during C-2..D
1. **Ledger counts pending/returned cheques as collected** (`CustomerService.GetCustomerLedgerAsync`, payments filter `Status != VOID`). Invoice footer compensates; the ledger screen/reports do not. Needs an accounting decision.
2. **PDF text-layer flake** under concurrent generation (see D). Visual output correct; search/copy can be blank. Investigate QuestPDF 2024.12.2 concurrency / font registration per request.
3. **Pre-existing** PostgreSQL failure `ReturnBalancePostgreSqlTests` on HEAD (approved return → customer credit −5 shows 0).
4. Two agents edited `PdfService.cs` / `FrozenHubPrintFinalTests.cs` concurrently on 2026-11-01 — review the combined diff before any commit.

## E. Docs to maintain
- [ ] `FROZENHUB-PRINT-FINAL-PROGRESS.md` (per item: expected / actual / root cause / file / test / PDF evidence / T20 / T23).
- [ ] `FROZENHUB-PRINT-DATABASE-AUDIT.md` (read-only settings snapshot for T20/T23 — keys + empty/non-empty, no bank values).
- [ ] `FROZENHUB-PRINT-ACCEPTANCE.md` (final checklist below).
- [ ] `docs/plan/AI-ERP-TASK-TRACKER.md` P1-05 / P0-04 status update.

## F. Live tenant settings — after B-1..B-5, B-7
- [ ] Read-only snapshot of T20 + T23 `Settings` rows (backup for rollback).
- [ ] Write via authenticated Settings UI/API as owner (audit trail), not raw SQL:
  - T20: phone `+971 55 529 8878`, P.O. Box (B-2), email (B-3), address, bank ×3 (B-1).
  - T23: phone `+971 50 286 8906`, same P.O. Box/email/address/bank; own legal identity (B-5).
- [ ] Verify T20 save did not touch T23 and vice versa.

## G. Release + live acceptance — after B-7
- [ ] Review diff, no secrets, no invoice/payment/VAT/numbering mutation.
- [ ] Push → verify GitHub main SHA → Render deploy SHA → Vercel deploy.
- [ ] Authenticated Chrome: T20 invoice 7000 + cust 143/136 invoices; T23 test invoice → download PDF + browser print → screenshots.
- [ ] Check Render logs, cross-tenant isolation.

---

## Final acceptance checklist
- [ ] Left FROZENHUB duplicate heading removed (T20, T23)
- [ ] Phones: T20 +971 55 529 8878, T23 +971 50 286 8906
- [ ] P.O. Box verified + printed
- [ ] Email printed as approved
- [ ] Abu Dhabi, Musaffah 17, UAE printed
- [ ] FH logo centred, lighter, not distorted
- [ ] Arabic block correct, no overlap
- [ ] Bank Name ADCB Islamic / Account Name FROZENHUB FOODSTUFF TRADING LLC SPC / verified IBAN
- [ ] No account-number line
- [ ] Footer: bill total, paid, due, pending count, customer balance, as-of — matches Customer Ledger
- [ ] Opening receivables included, no double count (cust 143, 136); zero shown correctly (cust 131)
- [ ] Amount in words not truncated
- [ ] Signature block correct, no Starplus text
- [ ] A4, A5, multi-page, short invoice pass; thermal unchanged
- [ ] PDF download + browser print work
- [ ] Tenant isolation passes
- [ ] No production financial mutation
- [ ] Live PDF evidence recorded for both tenants
