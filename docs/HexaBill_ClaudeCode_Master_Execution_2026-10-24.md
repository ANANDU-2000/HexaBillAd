# HEXABILL ERP — CLAUDE CODE MASTER EXECUTION PLAYBOOK
**24 October 2026 | Client defects, invoice printing, Starplus migration, complete UX QA, daily close, routes and live maps**

> **THIS IS AN EXECUTION INSTRUCTION, NOT A REQUEST FOR ANOTHER PLAN.** Work sequentially through the verified backlog, using tools, code changes, tests, browser evidence, and durable checkpoints. Do not claim work is complete merely because code builds. Do not invent client requirements or skip safety gates to obtain a green report.

## 0. Role, mission, and non-negotiable outcome

You are the **single coordinating principal engineer** for the **existing** HexaBill multi-tenant ERP: .NET/C#, React, PostgreSQL, Render backend, Vercel frontend, GitHub. Claude Code is taking over from a Codex session that reached its context/usage limit. Your mission is to **preserve the current checkout, restore urgent client operations, accurately migrate approved historical business data, and then finish verified UI/UX, daily close, and route/map workflows**.

**Priorities are not interchangeable.** Work in this order:

1. **P0: FrozenHub 1/Vahid production incidents** — Sales Ledger enum crash, QuestPDF failing PDFs, wrong or absent invoice header/logo, print/download differences, saved invoice correctness. Create and release an isolated hotfix only after validation.
2. **P0: Financial integrity and invoice identity** — original legacy invoice numbers retained; configure new FrozenHub 1 invoices to begin at **7000** subject to collision and approved cutover verification; pending bills/payments never drift.
3. **P0: Group 3 VAT and tenant safety** — finish incomplete tests, preserve historical VAT evidence, obtain owner-approved settings, avoid blocking billing.
4. **P0: Starplus → FrozenHub 1 historical migration** — inventory, source-to-target mapping, staging rehearsal, exact reconciliation, approved production cutover, browser sign-off.
5. **P1: All module workflows and responsive UI/UX** — desktop/tablet/mobile, tables, filters, icons, notification states, text duplication, overlap, scroll and print reliability.
6. **P1/P2: Daily close, drivers, routes, real live GPS map/route builder** — finish and verify what already exists; add only evidenced missing behavior; get explicit approval for paid map services/location retention.
7. **Final staged release** — commit tested checkpoints, push the appropriate verified release(s), verify Render and Vercel and real approved browser smoke tests.

Maintain an **evidence-based TODO checklist** for each phase; continue safe independent tasks without asking “Should I continue?”. Stop only the affected action if an external authorization, sensitive security decision, production tax/financial ambiguity, unavailable credential, or genuine blocking failure prevents it. Preserve progress before a usage/context limit.

### Critical difference between “finished” and “released”

- `IMPLEMENTED`: code is present, not necessarily proven.
- `TESTED`: relevant tests and real workflow pass in isolated environment.
- `STAGING VERIFIED`: appropriate record-level and browser evidence passed.
- `READY FOR CUTOVER`: owner/accountant approvals, backup, capacity, and rollback complete.
- `RELEASED`: real deployment successful.
- `PRODUCTION VERIFIED`: authorized real-client workflow observed after deployment.
- `CLIENT ACCEPTED`: owner signs off on visual print and ledger outcomes.

Do not turn `NOT TESTED`, `SKIPPED`, or `BLOCKED` into `PASS`.

---

## 1. First execution: reconstruct exact CURRENT state (do not guess)

Working directory formerly reported:
`C:\Users\anand\OneDrive\Desktop\My StartUps Projects\HexaBilngApp`

1. Read `AGENTS.md` and obey existing repo safety/continuous-local-execution requirements.
2. Execute `git status --short`, `git branch -vv`, `git log --oneline -20`, `git remote -v`, `git worktree list`, inspect local and remote commit divergence.
3. Preserve staged, unstaged, untracked files and any concurrent worktree; checkpoint them securely **without leaking secrets or client data**. Never run `git reset --hard`, `git clean -fd`, destructive checkout, or force-push.
4. Read, then update rather than replace:
   - `docs/plan/AI-ERP-TASK-TRACKER.md`
   - `docs/production/PRINT-SPECIFICATION.md`
   - `docs/plan/PRINT-MATRIX.md` if present
   - `docs/plan/VAT-IMPLEMENTATION-TRACKER.md` and `VAT-RETURN-EVIDENCE.md` if present
   - `docs/plan/UX-ROUTE-MATRIX.md` if present.
5. Review earlier reported commits only if present at actual HEAD: `4e421b8`, `3646183`, `71c87b4`, `a1874cd`, `ad7b959`. **These are historic handover claims, not proof of the current checkout/deployment.**
6. Query Render/GitHub/Vercel deployed commit IDs and compare with local commits. If a tool returns 403, label production frontend version `UNVERIFIED`—do not guess.
7. Identify active feature branches, unfinished Group 3 VAT modifications and migration work. No new multi-file rewrites before this reconciliation.
8. Identify whether the old Starplus → FrozenHub import already began and whether migration mapping/batch tables exist; **rerun must be idempotent**.
9. Create `docs/plan/CLAUDE-HANDOVER-2026-10-24.md` with verified commit IDs, exact running command, failing test, next action, safety blockers and what another agent needs to resume.

**First tool actions should start immediately; do not respond with another questionnaire.** Keep reports compact and factual.

---

## 2. Client's spoken Malayalam requirements — translate into actionable English

**Source:** Four Malayalam excerpts/transcriptions supplied directly in chat. Preserve their intent; uncertainty about a person/invoice name must remain labeled unresolved. Treat other attached voice notes as **audio requiring verified transcription**—do not invent words that were not heard. Read the WhatsApp images/PDFs and inspect the actual evidence files available to the running session. If media files are unavailable in Claude's workspace, request the exact missing file **only when its content blocks that task**.

| Ref | What client said / reliable English meaning | Required observable change |
|---|---|---|
| **VOICE-01 — receiver fields** | The `Receiver's Name` and `Receiver's Signature` area should be moved a little higher; use the older invoice's proportions/length and allow enough blank room between writing the recipient's name and signing. | Preserve both distinct fields; move the receiver block upward, increase usable signing space, do not crowd the last rows/totals or clip footer. Compare old vs newly generated A4 PDFs. |
| **VOICE-02 — invoice numbers** | Starplus had reached roughly the 6000 range. **Start the new FrozenHub invoice numbers from 7000** so original pending-paper invoice numbers and migrated references do not become confusing. | The first eligible *new* FrozenHub 1 invoice after the approved switch starts at **7000**, if available; subsequent numbers advance atomically with concurrent saves. **Old Starplus invoices keep EXACT ORIGINAL INVOICE NUMBERS** and searchable legacy references. Never renumber issued PDFs or overwrite existing HexaBill invoices. |
| **VOICE-03 — accepted design/address** | “This is enough; this print design is fine.” Remove mobile/contact detail from the printed address/header; print only **Abu Dhabi, Musaffah 17** there. | Do not redesign the approved style; on FrozenHub approved print layout show exactly `Abu Dhabi, Musaffah 17` as English printed location. Do **not delete contact details from the database**. Leave Arabic company wording anchored to verified license/certificate rather than inventing text. |
| **VOICE-04 — PDF copy** | Client asks for the relevant bill's **PDF/print copy** in the old/approved format. The spoken identifying name is not unambiguous from the supplied transcript. | Ensure existing invoice can be opened/downloaded as PDF; identify requested invoice using actual invoice number/customer record, not a guessed person name. |

### Other explicitly reported client behavior from earlier discussion

- Product/customer creation may commit successfully but show false red errors, green+red duplicate toasts, or stale display; product barcode secondary save may partially fail.
- FrozenHub 1 and FrozenHub 2 may share **verified legal identity**, not customer, inventory, payment or invoice data. Tenant settings and print formats may diverge.
- Wrong/no header, logo cropped or sticker-like, bilingual spacing, duplicate old-company text in sample references, excessive top blank gap; invoice total/discount/round-off not always visible; wrong amount in words in older implementations.
- Clients rely heavily on tablets. There are oversized filters, odd field widths, overlapping controls, hidden icons/actions, horizontal and vertical scroll glitches, duplicate labels/text/sentences, broken selection/deletion/status controls, and generally inconsistent forms.
- Production incident: `Sales ledger failed: Cannot convert string value 'Completed' ... mapped 'PaymentStatus' enum`.
- Production incident: QuestPDF `document content contains conflicting size constraints` and PDF generation fails.
- Need trustworthy pending bills, invoice items, customer balances, payment receipts, and historical PDF availability after Starplus migration.

### Evidence inventory, not design permissions

- Reference invoice: `Invoice_6584_Frozen_Hub(4).pdf` (also earlier versions). Its **Starplus branding/text appears in old mockup backing content**; do not copy that into new FrozenHub output.
- Company logos: `FrozenHub_Transparent_BW.png`, original `logo of frozhen(2).jpeg`, `Gulf_Harvest_Transparent_BW.png` and original Gulf Harvest BW image. Verify that cleaned assets preserve actual lettering/shape and have genuine transparent or paper-matching background.
- WhatsApp invoice screenshots and extra audio from 24 Oct; verify, create one short per-record transcript with timestamp and confidence. **Do not claim to have accurately transcribed unheard clips.**
- FrozenHub official VAT TRN `105607243000003`; effective registration `2026-11-01`; legal name `FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C`; licence `CN-6774701`.
- Gulf Harvest CT registration `105543085200001` **is not established as VAT registration**. Never put it into a VAT field.

---

## 3. P0 urgent: restore Sales Ledger / payment enum compatibility

Read actual:
- `frontend/hexabill-ui/src/features/sales/SalesLedgerPage.jsx`
- `backend/HexaBill.Api/Modules/Import/SalesLedgerImportService.cs`
- Payment entity/configuration/converter/ledger controller and any status enum modules.

Previous read-only Render finding: in **HexaBill production `Payments.Status`**, `Completed` occurred **once** under tenant **20**; `Sales.PaymentStatus` contained `Paid`, `Pending`, `Partial`. This points to a `Payments.Status` / enum deserialization mismatch but **verify current code, exact query and tenant again**.

- [ ] Reproduce actual failing ledger request, capture masked stack, API endpoint and query; do not modify the payment to “make the error disappear.”
- [ ] Trace status semantics from source/payment workflow. Map `Completed` only to the semantically correct recognized payment state; support legacy values at the correct boundary or prepare a carefully audited data correction.
- [ ] Test `Completed`, `CLEARED`, `PENDING`, `VOID`, valid sale statuses, unexpected/null values and historic records.
- [ ] Ensure the ledger still reports correct totals, payment allocations, balances and statuses; no default “Paid” for an unknown status.
- [ ] Prevent one bad historical status from crashing unrelated ledger rows when a safe, logged partial result/controlled failure is possible.
- [ ] Reproduce and verify in isolated PostgreSQL and authorized browser; update tracker.
- [ ] If database backfill needed, prepare exact `before → after`, affected IDs, rollback and approval; do not silently edit live financial history.

**Pass evidence:** real ledger load, relevant historic payment visible, unchanged total/allocations, unit + integration test + live read-only verification.

---

## 4. P0 urgent: QuestPDF / all printed documents / FrozenHub approval

Start with actual `backend/HexaBill.Api/Modules/Sales/PdfService.cs`, `SimplePdfService.cs`, `InvoiceNumberService.cs`, `LogoUploadService.cs`, `PrintOptionsModal.jsx`, Settings page and related renderer/tests. Preserve existing behaviors unless evidence proves them wrong.

### 4.1 Diagnose PDF constraint errors, do not guess

- [ ] Reproduce with a controlled invoice matching the client's failing paper/layout/data.
- [ ] Enable relevant QuestPDF diagnostic layout tracing **in nonproduction development**; locate the exact failing component and parent size constraints.
- [ ] Check `Column`, `Row`, `Table`, fixed `Height`, `MinHeight`, `MaxHeight`, `AspectRatio`, Arabic RTL/shaping, logo width/height, table content and footer pagination.
- [ ] Avoid blanket `Unconstrained()` or suppressing errors. Use flexible sizing and correct page-break behavior.
- [ ] Add tests for many items, long names, empty logo, high Arabic text, large totals, narrow receipt widths and different letterhead modes.
- [ ] Render actual PDF pages to PNG and inspect full header/body/footer; do not pass based on extracted strings alone.

### 4.2 Approved A4/A5 invoice design (Vahid)

- **English left**, **approved original black/white centered logo**, **verified Arabic right**. Use right-to-left shaping/font that actually works (the older print spec recommends Noto Sans Arabic).
- **English printed address line EXACTLY:** `Abu Dhabi, Musaffah 17`. No mobile, email, unrelated address details in this **printed header**; keep stored contact info unchanged.
- Preserve approved title, table/columns, line widths, Arabic alignment, invoice metadata, boldness and overall style. Compare the supplied image/PDF as *visual reference* but never copy its Starplus legal identity.
- Logo: no cropping, fake white rectangular sticker, stretch or clipping; include clear black-on-white appearance and balance, preserve source image and preview upload. Do not assume that changing logo CSS fixes storage or PDF rendering.
- Footer: ensure **Receiver's Name and Receiver's Signature** occupy separate usable handwriting spaces. Move their area **slightly upward**, give additional vertical gap comparable to the old invoice. Keep total/amount-in-words/pending balance legible and do not push footer onto a second page unexpectedly.
- Plain paper includes company header and logo; preprinted paper omits duplicate pre-existing letterhead. Verify setting and `layout=auto` in actual print flow.
- Printer PDF, download, share and preview should agree as specified, but may intentionally differ in letterhead overlays; document any such intentional difference.
- Thermal 80mm/58mm: compact readable layout without trying to force A4 three-column header geometry.

### 4.3 Invoice content correctness

- [ ] Company identity/trade license/approved Arabic are tenant-scoped and legally verified.
- [ ] Printed `INVOICE` vs `TAX INVOICE` reflects **saved historical treatment plus approved legal rule**, not merely format of TRN.
- [ ] Invoice number, date, customer, line items, unit, quantity, unit price, discount, line VAT, subtotal, rounding, grand total and amount-in-words reconcile with persisted invoice.
- [ ] Do not recalculate historic issued invoices on reprint, invent a customer TRN or substitute new product prices.
- [ ] Multi-page PDF has proper repeating table header/footer, no clips, no cut total, no hidden signatures.
- [ ] Export PDF a real requested invoice (once exact number resolved), compare to old/approved sample and record owner approval status.

**Tests and visual matrix:** A4/A5 × plain/preprinted × legacy/bilingual × FrozenHub 1/2/Gulf Harvest where supported; 1/5/20/50 lines, long English/Arabic, null logo and full logo; thermal 80mm/58mm. Save actual PNG evidence to local private QA folder (not Git if contains customer info).

---

## 5. P0 invoice numbering: NEW FrozenHub 1 invoice sequence begins at 7000

This is a **new client requirement**, not an instruction to renumber old billing records.

- [ ] Inspect `InvoiceNumberService.cs`, sales create path, DB unique constraints, sequence/counter settings, branch prefixes, imported historic numbers, soft-deleted invoices, POS/credit note families.
- [ ] Read-only query all existing FrozenHub 1 invoice numbers, including active/deleted/legacy prefixes; check collision with `7000` and any higher issued numbers.
- [ ] Establish **effective cutover timestamp** and distinguish **NEW native HexaBill invoice** from **IMPORTED Starplus historical invoice**.
- [ ] If 7000 is unused, make **first next NEW FrozenHub 1 invoice exactly 7000** then 7001, 7002... with tenant-scoped atomic allocation and idempotency. Never reuse an issued number, even if invoice voided/removed.
- [ ] If `7000` already belongs to an issued invoice, **do not overwrite/reuse or reset**. Report exact collision and choose next collision-free number only with appropriate owner confirmation; record the deviation.
- [ ] Source Starplus invoices retain their **literal original printed InvoiceNo**; expose `Legacy Source = Starplus`, `Legacy Invoice Number` and searchable mapped destination unique ID as distinct fields. No globally replacing the old number with 7000-series.
- [ ] Ensure customer pending bill paper and HexaBill historical view show the same original reference; no duplicate/conflicting invoice PDFs.
- [ ] Test concurrent creates, retries after response loss, manual invoice number overrides, cancellation/voids, imports, 7000/6999 boundary, tenant isolation and restart.
- [ ] Migration never advances the *new native invoice generator* merely because an old invoice carries a number in that range; separate namespace or explicit provenance and robust uniqueness constraints are necessary.
- [ ] Production sequence change needs validated cutover, lock/atomicity, proof existing invoices unchanged, and authorized rollout.

**Pass:** new invoice in isolated tenant starts at 7000 without collision, distinct original Starplus invoice number is unchanged and searchable, no duplicates after concurrent/failed requests.

---

## 6. P0 complete pending financials / Starplus → FrozenHub 1 migration

**Prior verified read-only baseline (refresh):** source `starplus-billing-db` / Render Postgres `dpg-d4b0c91e2q1c73bamq70-a`, Oregon; target `hexabill` / `dpg-d68jhpk9c44c73ft047g-a`, Singapore. Previous target workspace believed FrozenHub 1 TenantId `20` / owner Vahid, **verify tenant and OwnerId in actual DB and authorization**.

Previously counted source: `Customers 80`, `Products 276`, `Sales 4,980`, `SaleItems 10,358`, `Payments 5,188`, `Purchases 1,529`, `PurchaseItems 7,036`, `InventoryTransactions 22,621`, `InvoiceVersions 1,541`, `PaymentReceipts 39`, `Expenses 242`. Destination tenant 20 previously had 2 customers, 5 products, 9 sales, 7 payments; refresh both baselines. Backup `2026-10-23T18_22Z.dir.tar.gz` is a compressed Postgres directory-format dump, **not proof that original PDFs are included**.

### 6.1 No-loss migration workstream — execute, do not only plan

- [ ] Rotate exposed Starplus credential **before writable access**; don't paste passwords into prompts/logs. Restrict inbound IP rules. Read-only Render MCP can inspect, but **does not execute migration writes**; obtain an approved secure PostgreSQL write connection outside MCP.
- [ ] Verify source legal/business scope, both old source users, Vahid account and correct target tenant/OwnerId; source users' numeric IDs do not carry over.
- [ ] Inspect current migration batches and current source data; compare latest backup cutoff with live source; freeze or implement verified delta capture.
- [ ] Validate restore of source backup into isolated PostgreSQL. Snapshot/restore destination into disposable staging; verify restore integrity before live writes.
- [ ] Inventory **every business table**, FK, file reference and financial meaning; classify `migrate`, `transform`, `archive`, `exclude` with reasons.
- [ ] Create persistent mapping `(source_table, source_id, source_namespace, destination_tenant, destination_id, hash, batch_id, status)` and exact audit logs, idempotent insert strategy, test rollback.
- [ ] Reconcile customers, product identity/SKU/barcodes/units/prices, 4,980 invoices, 10,358 invoice items, payments/allocations, receipt relationships, discounts, round-off, pending balances, purchases, expenses, inventory movements, returns, version history and known PDF references.
- [ ] Do not double-count current stock: choose a well-documented opening balance/cutover and historical movements strategy.
- [ ] Do not merge people on name/phone or financial records on invoice number alone. Historical source reference + immutable mapping is authoritative.
- [ ] Preserve **every original invoice number** and its line snapshot, payments, receipt links and printed PDF if actually stored. For missing originals, flag `MISSING ORIGINAL`; reconstructed PDF must be labeled as reconstruction, not claimed authentic original.
- [ ] Original `Payments` and `PaymentReceiptPayments` relations may differ in target schema; explicitly map allocations and unallocated credits.
- [ ] Old source had **4,980 nonzero `Sales.VatTotal`** records, aggregate **189,980.03** at previous read-only inspection. The client asks for **no *new* VAT added by migration**. **Do not silently zero historical VAT, rewrite grand totals, change pending debt, or file legacy VAT as new statutory VAT.** Preserve original stored values with provenance and flag questionable legal treatment for accountant review. Where the treatment affects financial migration integrity, hold that record/cutover until approved.
- [ ] For every pending bill, reconcile invoice total minus valid payments/credits/refunds using the SOURCE's actual semantics. Check denormalized `Sales.PaidAmount` and `Customers.PendingBalance` as evidence, not unquestioned truth. Explain every discrepancy down to source payment IDs.
- [ ] For each source table prove: source eligible rows = migrated rows + approved exclusions + explicit blocked rows. **Critical unexplained financial mismatch must equal zero.**
- [ ] Perform **full staged migration**, test app browser on copied data (customer ledger, original invoice lookup, 1/20-item PDFs, pending bills and print), tenant-scoped security tests and performance.
- [ ] Prepare production manifest (source/destination IDs, exact owner/tenant, backup restore evidence, storage capacity, reconciliation, known exceptions, rollback, window, post-cutover validation). Obtain explicit final approval before production financial writes if repo instructions require it.
- [ ] Execute real live migration using secure writer only AFTER staging pass + valid cutover authorization; atomic resumable batches; stop on nonreconciling finance. Never truncate existing FrozenHub records or touch FrozenHub 2/Gulf Harvest.
- [ ] After live cutover, read-only reconcile per source invoice/customer, ensure original invoice numbers searchable and pending bills exact. Live approved browser verifies owner can open old invoices and item details and export PDF; no mutation solely for testing.

### 6.2 Mandatory migration outputs

`docs/migration/STARPLUS-FROZENHUB-RUNBOOK.md`, `SOURCE-INVENTORY.md`, `FIELD-ID-MAP.md`, `CUSTOMER-LEDGER-RECONCILIATION.md`, `INVOICE-ITEMS-RECONCILIATION.md`, `PENDING-INVOICES.md`, `PAYMENT-ALLOCATIONS.md`, `PDF-MANIFEST.md`, `VAT-EXCEPTIONS.md`, `RESTORE-AND-ROLLBACK.md`, `CUTOVER-APPROVAL.md`. Keep sensitive per-client data **out of public Git**; use private evidence storage, sanitized version-controlled summaries.

---

## 7. P0 VAT correctness and deployment readiness

Earlier Group 3 work reportedly fixed global `VAT_EFFECTIVE_DATE=01-01-2026`, pre-registration tax invoice formatting, hardcoded return VAT, and ledger import guards. **Current code and production deployment are the source of truth.**

- [ ] Distinguish **pre-registration / standard-rated / zero-rated / exempt / out-of-scope / review-required**; pre-registration no-VAT is not automatically `zero-rated`.
- [ ] FrozenHub verified VAT TRN `105607243000003`, effective registration `2026-11-01`; ensure effective dates only apply with correct tax point and exceptions; original historic records preserved.
- [ ] A real TRN with missing effective date must trigger a controlled configuration issue, not a false global default.
- [ ] Verify FrozenHub 1/2 independently; shared legal identity only with verified approval, different operational data; Gulf Harvest CT number never used as VAT TRN.
- [ ] Sales, POS, credit invoices, returns, payments, expenses, purchases, imports, VAT return state, historical reprints and PDF print title tested; return VAT derived from original line, never flat 5%.
- [ ] Historical six reported VAT-bearing exceptions (four FrozenHub 1, one Gulf Harvest, one FrozenHub 2) remain in accountant queue; **do not rewrite financial records or filed returns**.
- [ ] Before deploying Group 3, check live configuration. Earlier FrozenHub 1 lacked its effective date. Never ship a version that knowingly blocks legitimate billing until owner-approved settings or safe rollout are in place.
- [ ] Repeat targeted VAT, full backend PostgreSQL, PDF and real-browser boundary tests. Track native test crash, flaky EF test fixture collisions and intermittent PDF tests; a single green retry is not proof of stability.

---

## 8. P1 UI/UX — discover EVERY route, page, tab, form and subtask

Do a real feature inventory by reading React router, sidebar/menu, permission maps, controllers and DB schema. **Do not write “all pages PASS” unless each route was actually tested.** Some modules may be role/tenant-specific; mark N/A with reason.

Create `docs/plan/ERP-ALL-FEATURES-ACCEPTANCE-MATRIX.md` with each route + nested tab + form + modal + flow + action + role + API + DB entities + E2E test + screenshot + desktop/tablet/mobile status + evidence.

### 8.1 Scope, minimum module checklist

- [ ] Authentication, password reset/logout, expired session, switching tenants, role permissions and super-admin.
- [ ] Dashboard KPI cards, quick access, filters, date ranges, charts, status wording, links and loading.
- [ ] Customers create/edit/delete/deactivate, customer ledger, statements, balance, search, duplicates, bulk actions.
- [ ] Products create/edit/delete, stock, SKU/barcode, category, unit, price list, batch selection, active state, stock adjustment.
- [ ] Sales invoices, credit sales, POS, history, edit/void, print/download/share, partial payment, receipts, aging.
- [ ] Purchase, purchase items, supplier, supplier ledger, payments, returns, inventory and costs.
- [ ] Expenses create/edit/filter/category/approval, dashboard link, reports and print.
- [ ] Sales and purchase returns, credit notes, payment reconciliation, refunds and stock effects.
- [ ] Reports, date filters, export, empty states, 0–30 / 31–60 / 61–90 aging, pagination, >500/5000 row cases and warning state.
- [ ] VAT setup, preview, Form 201 if supported, review/lock/submit history, tenant-specific schedule.
- [ ] Print configuration, logos, letterhead selection, invoice templates and all document families.
- [ ] Daily close, branch/route setup, driver route pages, live map, deliveries, route expenses, customer visits if implemented.
- [ ] Settings, company/legal identity, security/admin controls, audit logs, backup and super-admin alerts.
- [ ] AI assistant / voice UI only after accounting validation; confirmable actions and tenant scope.

### 8.2 UX defects checklist — concrete visual criteria

At **1440, 1280, 1024, 768, 430, 390, 360, 320 CSS px** (at least 1440/1024/768/390 mandated), inspect:

- [ ] No fixed-width input/filter substantially wider than function; balanced proportions. Filter height, padding and button size consistent; optional collapsible filter bar on compact screens.
- [ ] No text overlap, cutoff, repeated titles/labels/sentences, misspellings, placeholder text, duplicate buttons, missing icons, crooked alignments or excessive gaps.
- [ ] Tables have predictable density, readable row height, usable sticky headers/first columns where appropriate, true pagination, functioning filters, sorting, bulk selection, row actions and empty/loading/error states.
- [ ] Touch targets reachable on tablets; no essential action hidden in hover-only menus; no horizontal overflow that hides row actions; short stable dialogs with visible Save/Cancel.
- [ ] Sidebar, header, modal, drawers, date pickers, dropdowns and notifications have correct stacking, scroll containment, focus, keyboard behavior and back/navigation.
- [ ] Status visual meaning matches DB: `Paid/Pending/Partial`, success/error toasts, disabled/working state, one toast per mutation, no false save failures.
- [ ] Date filters and dropdowns actually filter the server result; verify timezone/boundary, empty/no results and reset functions.
- [ ] Layout uses consistent typography, restrained monochrome/brand accent, accessible contrast and a common UI component scale; **do not make unrelated decorative changes while fixing functional bugs**.
- [ ] Capture BEFORE and AFTER screenshots and a specific assertion for each confirmed defect; check both narrow mobile and tablet after fixing.

### 8.3 Full CRUD / business-path contract

For each applicable screen: **Open → create → validate → save → read back → search → edit → reload → verify DB → update or cancel → applicable delete/status change → verify downstream reports/print**. Include malformed input, duplicates, rapid double click, lost response, HTTP 400/401/409/500, stale token, delayed reads and concurrent edits. Run writes only against disposable/staging tenant data.

Cross-workflows include:

- Product → stock → sale → payment → ledger → receipt → report → return.
- Customer → credit invoice → partial payment → final settlement → statement.
- Supplier → purchase → stock → supplier payment → return → report.
- Expense → category → payment → report.
- VAT classification → sale → return → print → reporting.
- Route/customer → driver assignment → live location → delivery action → route close → daily close.

**Pass only if actual saved data and visible UI match.**

---

## 9. P1 daily close — complete existing feature, not duplicate it

The older repository snapshot contained `backend/.../Models/DailyCashClose.cs` and EF migrations `20261003150000_AddDailyCashClose.cs`, `20261003160000_AddDailyCashCloseBankSnapshot.cs`. **Inspect whether controllers/services/UI actually exist in CURRENT checkout**.

- [ ] Define per-tenant/per-branch/per-day/user cash close and explicit timezone (UAE), correct business date, shift, opening cash.
- [ ] Aggregate cash sales, payments, receipts, cash refunds, drawer adjustments and digital/bank amounts **by appropriate tender method**, no double-counting.
- [ ] Display expected vs physically counted cash, variance, variance reason, notes and attachments, reconciled bank snapshots.
- [ ] Staff enters counted values; manager reviews/approves; enforce role-based authorization and close-lock rules. No automatically guessing physical cash.
- [ ] Ensure re-open/reversal audited and protected; no silently editing prior closed accounting records.
- [ ] Daily close shortcut on dashboard/mobile/tablet with usable UI, clear reconciliation statuses and one confirmation per action.
- [ ] Tests: no transactions, negative variance, partial payment, split tenders, returns, duplicate close clicks, timezone midnight, cross-branch, concurrent closures, correction approval, export/print parity.
- [ ] End-to-end: create isolated sample sales/payments/refunds, count cash, close, reopen under approved role, verify report snapshot.

---

## 10. P1/P2 delivery, live GPS map and AI-assisted route maker

**Do not start from scratch.** Earlier snapshot already included:
`RouteMapController.cs`, `RouteMapService.cs`, `RouteRunService.cs`, `DriverLocationService.cs`, `RouteAssistantTools.cs`, `RoutesPage.jsx`, `RouteMapPage.jsx`, `DriverRoutePage.jsx`, `StopCard.jsx`, `route-live-location.spec.js` and related tests. Inspect actual routes/migrations/states first; fix missing pieces rather than generating an entirely new map stack.

### 10.1 Core dispatch and map correctness

- [ ] Live map loads with genuine licensed/provider-backed geographic data; don't fake “live GPS” with static sample points.
- [ ] Tenant- and role-secured driver roster, active routes, assigned customers, scheduled stops, ordering, ETA when available, actual last updated timestamp, stale/offline location state.
- [ ] Dispatcher assigns/reorders stops; driver sees route list + map, navigation link, customer contact only with permission, delivery success/failure reason, photos/signature if approved, failed delivery reschedule.
- [ ] Route completion and route expenses reconcile with sales/payments and daily close; cannot duplicate completed stops.
- [ ] Location sharing requires explicit informed consent, appropriate permissions, minimized retention, stop/pause controls and clear employee-privacy policy; no covert tracking.
- [ ] Mobile maps keep stop controls usable, respect browser geolocation permission denial and offline fallback, don't allow marker overlays to block input.
- [ ] Mock GPS in tests using realistic sequences; never write fabricated production coordinates.

### 10.2 Route maker / GPT assistant

- [ ] Discover current optimizer and mapping provider; get explicit approval before new paid maps/geocoding/routing API usage.
- [ ] Geocode verified customer addresses; show low-confidence addresses for human correction rather than inventing lat/long.
- [ ] Optimize based on realistic vehicle capacity, delivery windows, stop priority, shift, distance/travel time where provider supplies it. Provide explainable before/after route comparison and fallback if provider unreachable.
- [ ] “AI route maker” may **suggest** sequence and summarize constraints; deterministic server rules authorize assignments. Never allow LLM to autonomously post invoices, payments, stock or route completion.
- [ ] Human dispatcher confirms optimized route; save server-side with audit history and tenant isolation.
- [ ] Tests: 0/1/100 stops, missing address, duplicate customer, permissions, GPS denied, offline, stale vehicle location, route reorder, concurrent dispatch, mismatched route run, API cost/quotas.

---

## 11. Production/test environment and QA approach

- **Repo code:** use local checkout, compare remote/deployed SHA, don't trust older ZIP or prompt as current code.
- **Render MCP:** reads and connection metadata are useful, but its SQL query action is **read-only**. DB writes require a separately authorized secure connection/tool; never bypass read-only restrictions.
- **Chrome / real browser:** use available authorized Chrome computer use only if actually supported in this Claude Code runtime. Otherwise use Playwright visible/headed mode and screenshots. Do not claim browser interaction if only HTTP text was fetched.
- **Prod read-only:** examine real invoices, users, settings, ledger, map; **do not create test invoices/payments or reset passwords on live client**.
- **Staging writes:** use disposable isolated PostgreSQL, synthetically scoped or secured test data; safe no-shared-prod connection.
- **PDF visual QA:** export PDF → render every affected page to PNG → inspect header/body/footer + actual text + amounts; compare approved sample.
- **Automated:** .NET unit + integration with PostgreSQL enabled, frontend unit/lint/build, Playwright real server in 1440/1024/768/390, permission/tenant isolation, security basics, print matrix.
- **Performance:** test real paginated datasets, especially 4,980 historic invoices / 10,358 items in staging, no huge client-side all-record loading, no misleading truncation.
- **Flaky tests:** track `DriverLocationHttpTests`, `RouteRunHttpTests` fixture `Users.Id` collisions, intermittent QuestPDF assertion, past native access violation. Investigate root, don't mark PASS on a lucky rerun.

### Defect severity and stop rule

`P0`: invoice print/ledger cannot function, accounting incorrect, cross-tenant leak, data corruption, billing unavailable, tax violation. `P1`: critical save/filter/page/touch workflow fails. `P2`: layout/consistency/accessibility problems. `P3`: polish/optional enhancements. **P0 before broad UI redesign or maps.** For a candidate fix: failing reproduction where feasible, narrow change, targeted tests, integration, browser, visual, downstream regression, tracker + local commit. Continue to next actionable issue; after three unsuccessful fixes of the same root cause, investigate shared architecture, don't blindly retry.

---

## 12. Release design — avoid “push all” unsafe bundling

An ordinary push to GitHub `main` may auto-deploy Render backend (and possibly Vercel). **Do not accidentally deploy unverified Group 3 VAT or migration code in an urgent print hotfix.** The customer request is to finish and push the system, but a *single massive unverified main push* may break live billing.

- **Release A: isolated urgent repair** (enum, QuestPDF, approved FrozenHub print header/footer and print/download). Branch from actual verified production base, cherry-pick *only* tested dependencies, capture diff. Once verified and relevant production approval confirmed, commit, push normally, verify deployment IDs and live print/ledger read-only behavior.
- **Release B: VAT and invoice-number cutover** after complete tests, verified tax settings and explicit owner/accountant classification decisions. Historical financials unchanged.
- **Release C: Starplus historical migration** is a **database migration**, not a Git push. Requires scoped source/destination backups, verified mapping, staging diff, owner/finance approval and controlled production writer. Postcutover audit mandatory.
- **Release D: responsive UX, daily close and maps** by independent tested commits and release gates; new paid map API/privacy changes need explicit permission.

All `git push` actions: fetch/review remote, no force push, no secrets, explicit merge/rebase safety, exact commit logs, verify auto deploy and both frontend/backend running SHA. If required approval/deployment tooling missing, mark `READY TO RELEASE — APPROVAL REQUIRED`, not `RELEASED`.

---

## 13. Master execution checklist with exit gates

### Phase A — Current state, confidentiality and evidence
- [ ] Verified Git/branches/worktrees/deployment SHA, protected uncommitted changes.
- [ ] Read `AGENTS.md`, tracker, print/VAT/migration docs.
- [ ] Rotated exposed source DB password or documented security owner action; no passwords in prompt or repo.
- [ ] Verified source/target IDs, Vahid ownership, current tenant mapping.
- [ ] Ingested all usable client screenshots/audio; exact English requirements matrix; unresolved audio labeled.

### Phase B — P0 urgent owner billing
- [ ] Reproduced and fixed `Completed` PaymentStatus enum / Sales Ledger crash.
- [ ] Reproduced and fixed QuestPDF conflicting size exception with exact component evidence.
- [ ] Produced approved FrozenHub 1 bilingual A4/A5 PDFs with `Abu Dhabi, Musaffah 17` and no unwanted printed mobile/email.
- [ ] Proper black/white centered logo, correct legal name and Arabic, no clipping/cropping/duplicated header.
- [ ] Receiver name/signature block moved up with functional handwriting gap.
- [ ] Plain vs preprinted behavior passes; print, preview, download and share checked.
- [ ] Totals, VAT classification, items and amount-in-words unchanged/correct.
- [ ] Relevant P0 tests and real browser checks pass; isolated hotfix release safely verified.

### Phase C — Invoice numbers, financial and VAT
- [ ] Source Starplus invoice originals retain same displayed number, customer, amounts and line items.
- [ ] Next NEW FrozenHub 1 invoice **7000** where free, collision/atomicity/approval verified.
- [ ] No new VAT added to migrated legacy financial records; stored historical VAT not silently removed.
- [ ] Group 3 current state confirmed; pre-registration/return/import/print/report cases pass.
- [ ] FrozenHub VAT effective date configuration and Gulf Harvest CT/VAT separation approved before enabling billing-impacting rules.
- [ ] Historical VAT exceptions and accountant decisions recorded.

### Phase D — Migration
- [ ] All source tables inventoried, updated cutoff; exact owner mapped.
- [ ] Source and target backups restore-tested, storage capacity checked, target existing rows preserved.
- [ ] Mapping/idempotent migration tool and secure writer implemented; dry-run/staging completed.
- [ ] Customers/products/invoices/items/payments/allocations/returns/purchases/expenses/inventory/PDFs accounted for.
- [ ] **Every pending customer invoice reconciles**; zero unexplained financial mismatches.
- [ ] Original PDF availability/reconstruction manifest complete and honest.
- [ ] Live cutover authorization recorded; production batches safely executed or precisely blocked.
- [ ] Live FrozenHub 1 owner can search old invoice number, see items/payment/pending, print copy; other tenants unaffected.

### Phase E — Whole app functional and UI/UX
- [ ] Actual route/feature inventory built; every existing page/tab/subflow classified.
- [ ] Core CRUD + financial workflow Playwright tests pass with real database verification.
- [ ] Filters/sorts/date pickers/pagination/row actions/bulk select/delete behave correctly.
- [ ] Duplicate toasts/text/buttons removed; error states and form saves are truthful.
- [ ] Responsive screenshots at desktop/tablet/mobile; no overlap, clipping or action-hidden overflow; proper icon/input/filter sizing.
- [ ] Print documents beyond sales invoice, statements, payment receipts, returns and exports verified where supported.
- [ ] User role/tenant/permission tests, malformed/expired/lost-response tests and performance thresholds passed.

### Phase F — Daily close, live maps, routes
- [ ] Existing daily close implementation audited and completed; financial counted/expected reconciliation.
- [ ] Route/run/driver/live-location pages inspected, repaired, access-controlled and E2E-tested.
- [ ] Map rendering, customer geocoding and route actions backed by real permitted provider data.
- [ ] Driver consent, location TTL/retention, role access and stale/offline state verified.
- [ ] AI suggestions require human confirmation, never direct autonomous accounting writes; provider cost approved.

### Phase G — Release and proof
- [ ] Unstable test causes resolved or explicit release risk assessed; repeatability demonstrated.
- [ ] Full backend PostgreSQL suite, frontend test/lint/build and 4-viewport E2E exact counts recorded.
- [ ] PDF artifacts visually inspected against client-approved refs.
- [ ] Each PR/commit has traceable change/test evidence and no secrets/customer data.
- [ ] Backup/restore/rollback verified and real legal/financial approvals recorded.
- [ ] Only verified releases pushed; Render/Vercel actual hashes/health checked.
- [ ] Real owner acceptance captured for new PDF and historical pending bills.

---

## 14. Run the self-correcting loop and persist progress when limits approach

Repeat this **bounded** inner loop per task:

1. `OBSERVE`: user complaint/screenshot/audio + current actual code + network/log/database.
2. `REPRODUCE`: minimal failing unit/integration or Playwright case.
3. `TRACE`: identify precise underlying cause, from UI to HTTP to backend to DB/print.
4. `REPAIR`: smallest high-quality patch. Don't guess or change unrelated data.
5. `VERIFY`: targeted test, backend transaction check, live-ish browser, visual PDF where applicable.
6. `REGRESSION`: related workstream and dependency suite.
7. `REVIEW`: tenant isolation, privilege, price/quantity/tax/payment invariants, performance.
8. `DOCUMENT`: status and evidence in tracker; local commit for verified checkpoint.
9. `CONTINUE`: next highest-impact unlocked task; do not ask for another prompt unless truly blocked.

At usage/context cutoff, write `docs/plan/NEXT-AGENT-HANDOFF.md` containing branch/HEAD, uncommitted paths, last real test command and exit code, current failing assertion, source/target backup and cutover status, pending owner decisions, and a **single exact next command**. Never say “I will finish in the background.”

### Milestone report template

```md
## Checkpoint YYYY-MM-DD HH:mm
- Phase / task ID:
- Status: IMPLEMENTED | TESTED | BLOCKED | RELEASED | PRODUCTION VERIFIED
- Actual git HEAD / branch / deployed SHA:
- Exact root cause / modified files:
- Test command → pass/fail/skip/not-run:
- Browser URL/environment and viewport (redacted):
- Screenshot/PDF evidence path (private):
- Source/destination record-count and finance reconciliation if migration:
- Data/tenant/VAT safety impact:
- Next highest-priority unblocked task:
- User approval genuinely required (if any):
```

---

## 15. FIRST ACTION — DO THIS, DON'T ASK WHAT TO DO

1. In the existing repository, run Git + deployment status and read `AGENTS.md`/tracker.
2. Determine whether latest live client can open Sales Ledger. Reproduce `Completed` status mapping and print PDF error against safe test fixtures, read-only prod diagnosis.
3. Locate selected Vahid print reference and render current A4 screenshot; compare old vs new, including receiver signature spacing, approved address, logo.
4. Fix the two P0 failures, add regression tests, perform PDF rendered-image review and real browser checking.
5. Create a **small isolated validated hotfix**; release only through the proper production approval/safety gate.
6. Then implement/verify tenant 20 NEW invoice numbering from 7000 without renumbering legacy; continue historical financial migration staging reconciliation.
7. After finance and migration are verified, systematically finish every existing UI route/tab, daily close and GPS/map/AI route features through the explicit acceptance matrix.
8. Keep going through safe local work. Never turn a limit/approval/blocker into a false DONE.

**Final status vocabulary:** `RELEASED AND VERIFIED`, `READY TO RELEASE — APPROVAL REQUIRED`, or `BLOCKED — NOT SAFE TO RELEASE`, backed by actual evidence. The goal is owner-visible reliability, not a large green checklist without proof.
