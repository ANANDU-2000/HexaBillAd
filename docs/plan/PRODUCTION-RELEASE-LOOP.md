# HexaBill: Fix Loop -> Production Release -> Live Verification

Save as `docs/plan/PRODUCTION-RELEASE-LOOP.md`. Paste **Section 0** into Codex. Read with `AGENTS.md` and `E2E-FIX-LOOP.md`.

---

## 0. GOAL PROMPT (paste into Codex)
```
You are the single executor for HexaBill (repo ANANDU-2000/HexaBillAd). Read AGENTS.md, docs/plan/STATE.md, DECISIONS.md, E2E-FIX-LOOP.md, PRODUCTION-RELEASE-LOOP.md first.

GOAL, in four stages. Do not skip a stage. Each stage has a gate; if a gate fails, STOP, fix via the loop, retest, and continue.
Stage A: review all code, run the full fix loop locally on synthetic tenants until the release gate (section 3) is green.
Stage B: pre-deploy safety (backup, migration rehearsal on a copy, baseline capture) (section 4).
Stage C: production deploy in order: DB migrations -> Render backend -> Vercel frontend (section 5), with health checks and rollback ready.
Stage D: live verification on the production links (section 6): read-only walk of every page for each real client, write tests only in a dedicated smoke tenant, Zayogya unchanged.

OWNER AUTHORIZATION: see section 1. Only what is listed there is allowed. Anything else: stop and ask.
Never put credentials in files, logs, screenshots or commits. Write and delete tests in real client tenants are allowed ONLY under the rules in section 6A (tagged test records, cleanup ledger, no touching existing records). Report after every iteration (section 9).

```

---

## 1. Owner authorization (edit: delete any line you do NOT approve)

Approved by the owner (Anandu), 4 Oct 2026, for this release only:

- [ ] Push branch `release-1` and merge to `main` after the Stage A gate is green.
- [ ] Apply additive EF migrations to the production PostgreSQL **after** a verified backup and a successful rehearsal on a copy.
- [ ] Deploy the backend to Render and the frontend to Vercel from the merged commit.
- [x] Read access to all production tenants (GulfHarvest, FrozenHub, FrozenHub2 if it exists, Zayogya) to open every page, search, filter and view documents.
- [x] **Write and delete tests in the REAL GulfHarvest, FrozenHub and FrozenHub2 tenants (owner requirement, 4 Oct 2026)**, only under section 6A. The owner accepts these unavoidable effects: invoice/receipt numbers used by test records are not reused (gaps in the series), audit logs keep every test action permanently, and dashboard/report totals include test records until they are reversed.
- [x] **Zayogya stays READ-ONLY** (the owner said do not touch it). To test Zayogya writes, the owner must add a line here.
- [ ] Also create ONE dedicated production tenant `smoke-test` for the destructive or risky tests that section 6A forbids in real tenants (optional but recommended).
- [ ] Read-only database role for diagnostics. No manual SQL writes. Schema changes only through EF migrations.

NOT approved unless the owner adds a line here: creating FrozenHub2 in production, redirecting the old FrozenHub host, enabling any feature flag for real clients, enabling margin VAT, writing in the Zayogya tenant, restoring production from backup, changing or deleting any EXISTING real record (see 6A forbidden list).

---

## 2. Credentials handling

- The owner logs in himself in the agent's Chrome session (or provides credentials through an environment variable/credential manager at runtime). Credentials are never typed into prompts, files, logs or screenshots.
- Discover tenant hosts and slugs from authenticated company records. Do not guess spellings.
- After testing, log out and clear the session. Redact tokens, cookies and TRNs from evidence (`1055****0001`).

---

## 3. Stage A: review and fix loop (release gate)

1. Code review pass of the diff since baseline `39ffafb`. Output `REVIEW-INBOX.md` with findings by severity. Pay special attention to: tenant filters on every query, raw SQL, file paths, background jobs, caches, idempotency on money writes, migration safety.
2. Run the loop in `E2E-FIX-LOOP.md` for GulfHarvest -> FrozenHub1 -> FrozenHub2, with Zayogya regression only.
3. Close all S1/S2 in `ERROR-REGISTER.md`. S3 on money pages must also be closed.
4. **Release gate (all must be true, with evidence):**&#x20;
   - FE `npm ci && npm run lint && npm test && npm run build` pass.
   - BE `dotnet build && dotnet test` pass, **including the 44 PostgreSQL tests**. If PostgreSQL cannot run, the gate FAILS; stop and report exactly what is missing.
   - Seven journeys pass on each tenant; isolation passes both directions on PostgreSQL.
   - Header proofs (A4, thermal, receipt, PDF, Arabic, grayscale, logo) for GulfHarvest and FrozenHub; Zayogya snapshot identical.
   - VAT page correct in Standard mode; `vat_margin_scheme` is OFF and stays OFF.
   - Secrets `git grep` clean; no client documents in the repo.
   - All new feature flags default OFF.

---

## 4. Stage B: pre-deploy safety (STOP points marked)

1. **Record versions (read-only):** current Render backend SHA/deploy ID, Vercel production deployment ID (last READY one is the rollback target), Render DB info. Save in `STATE.md`.
2. **Backup:** create a fresh production DB backup/snapshot. Record its ID and time. **STOP if it cannot be created.**
3. **Restore rehearsal:** restore that backup into a throwaway database copy (never into production). Record row counts for key tables.
4. **Migration rehearsal:** apply the new migrations on the copy; run the app against it; confirm the counts are unchanged and the app boots. List every migration and confirm it is additive. **STOP if any migration drops, renames or rewrites data.**
5. **Baseline capture (read-only, before deploy):** for Zayogya, GulfHarvest and FrozenHub: take a sample of existing invoices (PDF text) and the current VAT totals for a closed period, and customer/ledger totals. Store masked values in `EVIDENCE.md`. These are compared again after deploy.
6. **Auto-deploy check:** confirm which branch Vercel and Render deploy from, so a merge does not deploy unexpectedly before the DB migration step.
7. Rollback plan written down: previous Vercel deployment, previous Render commit, DB migrations stay (additive) with flags OFF.

---

## 5. Stage C: production deploy (strict order)

1. **Freeze:** tell the owner the deploy window; no other pushes.
2. **Migrate DB first** (additive only) using the app's migration path, not manual SQL. Verify the schema and row counts match the rehearsal. The backend reads new columns even with flags OFF, so migration must precede the new backend.
3. **Deploy backend (Render)** from the merged commit. Wait for build and start. Check:&#x20;
   - `GET /health` returns 200 and the database is connected
   - the deployed SHA equals the merged commit (via version endpoint/headers/dashboard; if no version endpoint exists, say UNVERIFIED and add one)
   - logs show no startup errors
4. **Deploy frontend (Vercel)** from the same commit. Confirm the production alias points to the new READY deployment and the build log has no errors.
5. **Immediate smoke (2 minutes):** load the login pages for each tenant host; `/health`; one authenticated read per tenant.
6. **Auto-rollback triggers:** `/health` not 200 for 3 minutes, 5xx rate above normal, login failures, or any tenant data leak. Rollback = Vercel previous deployment, Render previous commit. Do not touch the database (additive migrations stay; flags OFF).

---

## 6. Stage D: live verification on production links

### Layer 1: platform (no login)

Hosts load, TLS valid, correct tenant branding on each host, unknown host denied, `/health`, security headers, no console errors on the login pages.

### Layer 2: each real client, READ PASS first (GulfHarvest first, then FrozenHub, FrozenHub2 if present, then Zayogya read-only)

Owner logs in (section 2). Agent opens **every route in `ROUTE-MANIFEST.json` the role can see**, at 390x844 and 1366x768, and:

- checks loading, populated and empty states, console errors, failing network calls
- uses search, filters, sorting, pagination, tab switches and Back/refresh behavior
- opens dialogs and forms, **types test values but does NOT save, submit or confirm**
- opens existing invoices/receipts, previews, downloads PDFs and prints to PDF; checks header, totals, footer and VAT labels against the baseline
- compares ledger, VAT and report totals with the pre-deploy baseline (must be identical) The read pass does no writes. Complete it for a tenant before starting that tenant's write pass (6A). Zayogya never gets a write pass.

### Layer 3: write tests in the dedicated `smoke-test` tenant only

Run the whole feature script from `E2E-FIX-LOOP.md` section 6: create customers/products, POS sale, partial and credit, payments, receipt, rounding adjustment (1,331 / 1,330), returns, purchases, supplier payment, expenses, Daily Close, VAT page, print/PDF, users/roles, backup. Use the same 5 viewports and field/button checklist.

### 6A. Tagged write and delete pass in REAL tenants (GulfHarvest, FrozenHub, FrozenHub2 only)

Run after that tenant's read pass and after Layer 3 passes in `smoke-test`. Every create/edit/delete/void/pay/print action in `E2E-FIX-LOOP.md` section 6 is tested here, with these rules:

**Preconditions (STOP if any is missing)**

1. Fresh production backup taken within the last hour; ID recorded.
2. Notifications (WhatsApp, SMS, email, reminders) to customers are off or the test customers have fake contact details, so no real person is messaged.
3. No VAT period currently being filed or locked for that tenant; no Daily Close in progress. If either exists, skip the affected tests and mark NOT RUN.
4. A cleanup ledger file exists locally (gitignored): `clients/test-ledger-<tenant>.json`, listing every record the agent creates (type, ID, number, time).

**Tagging**

- Every record the agent creates is prefixed `ZZ-TEST` (customer, product, supplier, expense note, invoice reference/notes). Test customers use fake phones (`+000...`), test products use a unique SKU `ZZ-TEST-n`.
- Only records tagged `ZZ-TEST` may be edited, voided, returned or deleted. Existing real records may be opened and read, never changed.

**Allowed (on tagged records only)** Create/edit/deactivate customers, products, suppliers; POS sale (cash, credit, partial); payments incl. the 1,331/1,330 case with the authorized adjustment of 1; receipts, PDF, print; returns and credit notes; purchases and supplier payments; expenses with attachment; stock adjustment on `ZZ-TEST` products; filters, search, pagination, export; staff user add/role change/remove for a tagged test user.

**Forbidden in real tenants (do in `smoke-test` instead)**

- Daily Close / lock day, VAT filing or period lock, backup restore, "restore invoice version".
- Changing company settings, logo, TRN or header (test these in `smoke-test` and local only).
- Changing or deleting any existing real customer, product, invoice, payment, user or setting.
- Bulk delete, bulk import over real data, stock adjustments on real products.
- Any action that sends a real message or touches a real bank/payment gateway.

**Delete and cleanup rules**

- Use the app's own legitimate flow: posted invoices are voided or reversed with a return/credit note and posted payments are voided; drafts and unposted test master data are deleted; test customers/products are deactivated or deleted if the app allows. No SQL deletes. Hard-deleting posted financial records is never done.
- After testing, reconcile: customer and supplier balances, stock quantities and cash/ledger totals for the tenant must equal the pre-test baseline **excluding** `ZZ-TEST` records, and tagged records must net to zero (sales offset by returns/voids, payments by voids, stock back to start).
- Any mismatch is an S1: stop, do not continue to the next tenant, report the ledger and the mismatch.
- Accepted leftovers (owner agreed in section 1): used invoice/receipt numbers, audit-log entries, and test records visible in reports as zero-net or voided.
- Tell the owner the exact list of numbers consumed per tenant (for the accountant's records).

**Order:** GulfHarvest -> FrozenHub -> FrozenHub2. Finish and reconcile one tenant before starting the next.

### Layer 4: isolation in production (attempts only)

With the `smoke-test` token, try GET requests for IDs belonging to a client tenant (IDs taken from the read-only pages) and for files/exports/search. Expect 403/404 every time. Never store or print the returned data. Also confirm client tokens cannot read `smoke-test`. Log pass/fail only.

### Layer 5: Zayogya

Compare against baseline: invoices, receipts, print, VAT totals, ledger. Any difference = S1 + rollback decision.

### Layer 6: soak (30 minutes after deploy)

Watch Render logs, error rate, response times, Vercel errors, DB connections. Record in `EVIDENCE.md`. Anything abnormal = report.

Any failure found: add to `ERROR-REGISTER.md`, reproduce on local synthetic data, fix through the loop, and run a new release cycle (small hotfix path: same gates, smaller diff). Do not hot-patch production by hand.

---

## 7. What stays OFF in production after this release

`vat_margin_scheme`, `receipt_snapshots`, `sale_cost_snapshots`, `purchase_cost_snapshots`, `daily_close`, shared-owner setup, AI assistant, voice, driver/map. The owner enables each per tenant later, one at a time, after its own pilot and rollback note. Exception: if the owner's `DECISIONS.md` says a flag must be ON for GulfHarvest or FrozenHub, enable it only for that tenant and test it live.

---

## 8. Not part of this release unless separately approved

- Creating FrozenHub2 and redirecting the old FrozenHub host (needs owner account details, opening-data choice, and a rehearsed redirect with rollback).
- Margin VAT for real clients (needs the accountant's signed examples).
- Real client VAT certificates: a missing real VAT TRN means documents print as "Invoice" with an owner banner.

---

## 9. Report format (after every stage and iteration)
```
Stage / iteration:
Gate result: PASS | FAIL (which item)
Versions: Render SHA, Vercel deployment ID, DB backup ID
Tested: tenants, pages X/61, viewports, layers
Found: S1 a / S2 b / S3 c / S4 d
Fixed: ids + commits
Open: top 5
NOT RUN: items + exact reason
Rollback ready: yes/no (target IDs)
Next:

```

Final output: a sign-off table (tenant x layer x PASS/FAIL/NOT RUN) with evidence links and an explicit list of everything unverified. Never write "production ready" unless every gate in sections 3-6 is PASS.