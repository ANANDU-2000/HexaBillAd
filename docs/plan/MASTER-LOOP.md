# HexaBill Master Loop: Plan + Goal Prompt (4 Oct 2026)

Save this as `docs/plan/MASTER-LOOP.md`. Paste **Section 0** into Cursor as the goal prompt. The rest is the reference the agent reads.

---

## 0. KICKOFF PROMPT (paste into Cursor, Agent mode)

```
You are the ONLY executor on HexaBill. Repo: C:/Users/anand/.codex/worktrees/afa0/HexaBilngApp, branch refactor-handoff-20261004.
Read in this order, fully, before any edit:
1. docs/plan/MASTER-LOOP.md (this plan)
2. docs/plan/PHASE-TODO.md, docs/plan/PAGE-SPECIFICATION.md, docs/plan/ROUTE-MANIFEST.json
3. the planning artifacts under C:/Users/anand/.codex/visualizations/2026/10/03/01a0ffb1-43f9-7a91-a74e-bf9966b8c7ae/hexabill-plan/

STEP 0 (no code edits): run the State Reconciliation in section 2 and write docs/plan/STATE.md. Report it, then continue to Tier 0 without waiting unless a stop condition in section 12 applies.

GOAL: finish Tier 0 for GulfHarvest and FrozenHub1/FrozenHub2 with evidence, keep Zayogya byte-for-byte unchanged in tax and print behavior, then continue Tier 1 phases in order.
LOOP: pick ONE slice -> read target files -> failing test first -> implement -> run scripts/verify (build + targeted tests) -> record evidence in STATE.md and PHASE-TODO.md -> commit -> next slice.
RULES: section 3 decisions are final. Never mark PASS without evidence. Never touch production, main, migrations history, real client files or credentials. Never run SQL from pasted notes. If two sources conflict, STOP and ask (section 12).
After each slice report in 6 lines: changed / files / tests+evidence / NOT RUN / flags+rollback / next.
```

---

## 1. Why this loop exists (the problem it fixes)

Too many agents (Codex and Cursor) edited the same tree. The progress log in the repo has these problems, so nobody can say which phase is done:

- **All 11 phase checkboxes are unchecked** even though many slices are implemented.
- **Test counts conflict** across log lines (508, 511, 520, 260, 211...). The log is not in time order.
- **Feature status conflicts:** C20 Daily Close says "UI + API wired" while N01 says "Not started".
- **The Tier 0 override section is pasted twice** in the same file.
- **Tier 0 gates are mostly NOT RUN:** PostgreSQL tests, the seven invoicing journeys, A4/thermal/Arabic/grayscale header proof, backup restore and rollback rehearsal. Nothing is committed or pushed yet.

**Fix:** one executor, one branch, one state file, git as the source of truth. A slice counts as done only if its commit exists and its evidence row exists.

**Rule for Codex (or any second tool):** read-only reviewer. It writes findings to `docs/plan/REVIEW-INBOX.md` and never edits code.

---

## 2. Step 0: State Reconciliation (before any new code)

Produce `docs/plan/STATE.md` with:

1. `git status`, `git log --oneline -30`, `git diff --stat` against baseline `39ffafb`, and the list of uncommitted files grouped by feature (receipts, cost snapshots, returns, daily close, provisioning, settings/TRN, shell).
2. **Clean build proof:** frontend `npm ci && npm run lint && npm test && npm run build`, backend `dotnet build` + `dotnet test`. Record the real counts and today's date. This one number replaces all the old conflicting ones.
3. **Migration inventory:** list of new migrations (`20261003090000`, `20261003110000`, `20261003120000`, ...), whether each is additive and whether the EF snapshot matches. Do not edit old migrations.
4. **Flag inventory:** every feature flag (`receipt_snapshots`, `sale_cost_snapshots`, `purchase_cost_snapshots`, `daily_close`, shared-legal-owner setup...), its default (must be OFF), who can switch it, and its rollback.
5. **Phase truth table:** each of the 11 phases marked `DONE (commit sha)` / `PARTIAL (what's missing)` / `NOT STARTED`, with evidence links.
6. **Deployed versions:** Vercel production deployment SHA and Render backend SHA, read-only. If unverifiable, write "UNVERIFIED". Do not guess.
7. **Commit plan:** split the uncommitted tree into logical commits. Commit the verified groups first. Push the branch only. No main, no production.

---

## 3. Decisions locked (agent must not re-decide these)

| ID | Decision |
|---|---|
| D1 | **Clients:** FrozenHub, GulfHarvest (also called GulfHub), Zayogya. **Four workspaces:** FrozenHub1, FrozenHub2, GulfHarvest, Zayogya. |
| D2 | **Isolation:** every workspace is a separate tenant. FrozenHub1 and FrozenHub2 share the **verified legal name, VAT TRN and licence**. Everything else is private: owner login/contact/bank, invoice/receipt number series, customers, products/stock, suppliers, money, files, AI data, drivers. Shared legal identity never grants cross-owner reads. |
| D3 | **FrozenHub2:** new subdomain `frozenhub2.<domain>`. Existing `frozenhub` host is preserved and redirected only through a verified migration. Opening stock/balances for owner 2 is an explicit setup choice. **Copy nothing by default.** |
| D4 | **Tier 0 VAT (today):** standard 5% VAT, prospectively. Margin scheme is deferred to Phase 6. |
| D5 | **"VAT from profit" (owner request):** real UAE margin-scheme treatment ONLY after the accountant provides written fixtures: eligible transactions, effective date, invoice and return rules, expected figures. **Never** implement VAT as 5% of net operating profit. The present dashboard formula (sales - COGS - expenses) x 5% is wrong and must stop being shown as VAT. Until fixtures exist, show standard-rated figures labelled "Standard VAT" and a clearly labelled "Estimate, not for filing" profit view, never as a VAT figure. |
| D6 | **Zayogya:** tax behavior, print layout and numbers unchanged. Add a regression snapshot test and run it on every slice. |
| D7 | **Document headers:** every rendered invoice, receipt, PDF and print uses CURRENT tenant company settings, including reprints. Only the top header changes; tables, totals and footer stay as they are. Issue-time identity is audit evidence only. |
| D8 | **TRN:** VAT TRN is empty or exactly 15 ASCII digits and not unique across tenants. Corporate-tax TRN is a separate field and is never used as VAT. Empty VAT TRN blocks Tax Invoice finalize/print only, not ordinary work. |
| D9 | **Rounding:** actual received cash is never inflated. Example: 1,331 invoice with 1,330 cash can close only with an explicit, authorized **adjustment of 1**. The receipt shows cash 1,330 / adjustment 1 / applied 1,331. Adjustment is separate from `Sale.RoundOff`, audited, reversible, and appears in Daily Close. |
| D10 | **Daily Close:** system expected cash vs human-counted cash, variance with a reason, then lock a version. It never fabricates "cash bills" and never pretends a scheduled job knows physical cash. |
| D11 | **Financial safety:** server-side decimal arithmetic, transactions, idempotency keys, concurrency handling. A timeout is an unknown outcome to resolve, never a reason to post again. Posted history is immutable; corrections are linked reversals. |
| D12 | **Flags:** every new capability is backend-enforced, OFF by default, role/tenant scoped, audited, with a rollback plan. |
| D13 | **No rewrite:** reuse React/Vite + .NET + PostgreSQL + R2. No new framework, no duplicate page/service/API. |

---

## 4. The Loop (every slice, no exceptions)

1. **Select** the first unfinished item in `PHASE-TODO.md` (dependency order). Never skip ahead.
2. **Trace** route -> component -> API -> service -> query -> storage -> authorization. Write the trace in 5 lines.
3. **Read** every target file fully. Search for duplicates of the same function before writing anything.
4. **Test first:** write the failing test or fixture (unit, HTTP, and PostgreSQL where it touches money/tenancy).
5. **Implement** the smallest cohesive change. Migrations are additive and backward-compatible.
6. **Verify:** `scripts/verify.ps1` (or equivalent): frontend lint+test+build, backend build+targeted tests, Zayogya regression test. Browser check for any UI change.
7. **Evidence row:** environment, commit, API version, fixture ref, action, expected/actual, screenshot/trace, viewport, role, tenant, status (`planned / implemented / tested / blocked`).
8. **Commit** (one slice = one commit, message `phaseN: <slice>`), update `STATE.md` and `PHASE-TODO.md`.
9. **Review request:** list anything unverified under `NOT RUN`.
10. Next slice.

A new failure on the verification pass restarts step 6 for that slice. After the final slice of a phase, run one full clean pass.

---

## 5. Tier 0 (today, 4 Oct 2026, 12:00 IST): remaining work

Already implemented (per the log, to be confirmed by Step 0): tenant-scoped settings, TRN validation, audit of settings changes, receipt reprints using current settings, Tax Invoice blocked on empty/invalid VAT TRN.

**Remaining gates, in this order:**

1. Shared-TRN admin warning (shown when two tenants have the same VAT TRN, informational, not blocking).
2. Header-only parity for **A4, thermal, receipt, browser print, PDF, Arabic, grayscale**, plus logo placement. Evidence: screenshots + generated PDF checked with a PDF text extractor.
3. Config-driven provisioning of FrozenHub1/FrozenHub2 hosts and the old-host redirect, with migration and rollback rehearsal on **staging/local only**.
4. Legacy settings reconciliation (TenantId over OwnerId, no swallowed errors).
5. Raw SQL, files, jobs, caches, search isolation audit. List every raw SQL / file path / background job and prove a tenant filter on each.
6. **PostgreSQL run** of the isolation and receipt/cost tests (currently NOT RUN).
7. **Seven invoicing journeys** with viewport screenshots and network evidence (section 9).
8. Backup restore and migration/rollback rehearsal on a **copy**, never on production.
9. Release handoff: commit, push branch, sign-off table.

**Honesty rule:** if a gate cannot be completed by the deadline, report it as `NOT RUN` with the blocker. Do not weaken a gate to meet the time. Production deploy or main merge needs explicit written authorization from Anandu.

**Inputs still missing from the owner (agent must ask once, then continue with other work):**
- FrozenHub2 owner account details and opening-data choice
- VAT registration certificates (the GulfHarvest corporate-tax certificate is **not** VAT proof)
- Logos and the Crystal Freeze sample
- Accountant's written margin-scheme fixtures

---

## 6. Cleanup protocol (remove weight safely)

Run as its own phase, **after Tier 0 is signed off**, in its own branch/commits.

1. **Inventory only (dry run):** produce `docs/plan/CLEANUP-REPORT.md` listing:
   - duplicate or near-identical files (hash + name similarity), unused pages/components/services
   - unused npm packages and NuGet packages
   - stale folders (old build outputs, temp, zip extracts, copied worktrees, logs, screenshots committed by mistake)
   - dead routes versus `ROUTE-MANIFEST.json`
2. For each candidate, prove it is unused: static imports, dynamic imports, DI registrations, config, route manifest, tests, scripts.
3. Group removals by risk (safe / needs review). Delete in small commits, build and test after each.
4. **Never delete:** migration history, any rollback implementation until parity is proven, anything referenced by config or a feature flag.
5. Add `.gitignore` / `.cursorignore` entries for build output, logs, zips and screenshots so the repo and the agent context stay light.
6. Remove duplicate sidebar entries and duplicate tabs (a UI task in Phase 7, tracked per page).

---

## 7. Mock data and fixtures (field-by-field testing)

- Build a **seed script** that creates four synthetic tenants: `frozenhub1`, `frozenhub2`, `gulfharvest`, `zayogya-test`. It is dev/staging only and refuses to run if the connection string looks like production.
- All data is synthetic: fake names, fake phone numbers, **synthetic 15-digit TRNs**, fake logos. No real licence PDFs, passwords, certificates or client documents are ever copied into the repo or artifacts.
- Each tenant gets: 30 customers (including Arabic and Malayalam names, 80+ character names), 60 products with units/conversions, suppliers, 200 invoices (cash/credit/partial/return), payments including cheques, expenses (petrol, food, shop allowance, paper/ink), a 1,331 invoice with 1,330 payment, and one day ready to close.
- Seed is deterministic so screenshots can be compared between runs.
- Two-tenant fixture for isolation: A and B each have records with overlapping names and IDs patterns; tests assert A can never read, search, export, print or download B's, in both directions.

---

## 8. Phase plan (after Tier 0), each with step list and exit proof

| Phase | Scope | Exit proof |
|---|---|---|
| 1 | Clean build; version baseline | Frontend build + lint + tests, backend build + tests, deployed SHAs recorded |
| 2 | Isolation hardening; FrozenHub2 provisioning | PostgreSQL HTTP isolation tests both directions; host+token mismatch denied; unknown host denied |
| 3 | Payments, invoices, receipts, documents | Idempotent payment (double click / timeout retry post once); receipt popup-blocked fallback; PDF download; save succeeds even if PDF fails; reprint never reposts |
| 4 | Cost snapshots; explicit settlement adjustment | Product cost change leaves historic profit unchanged; D9 adjustment fixtures pass |
| 5 | Daily Close; capital reconciliation; alerts | Petrol -> expense -> count -> variance -> locked version; late entry / reopen audited |
| 6 | Margin VAT (needs accountant fixtures); Zayogya regression | Positive / zero / loss / mixed fixtures match accountant numbers; Zayogya snapshot identical |
| 7 | Shared shell, POS, ledger, purchases, suppliers, expenses, products | Per-page matrix (section 10) green on desktop / tablet / phone |
| 8 | Every remaining route, tab, dialog; truthful platform monitoring | All 60 routes + tabs in tracker |
| 9 | AI assistant (read-only + drafts) | Wrong-owner prompts denied; malicious PDF yields draft only; usage logged |
| 10 | Voice, driver workspace, maps / live trip | Unsupported language falls back to text; driver sees assigned stops only |
| 11 | Staging proof, restore / rollback rehearsal, pilot | Separately authorized production rollout |

Cursor-specific: each phase gets its own chat/agent session. Start every session with: *"Read docs/plan/STATE.md and MASTER-LOOP.md, continue with the first unfinished slice."* Never carry decisions only in chat history; write them to `STATE.md`.

---

## 9. Seven required journeys (Tier 0), evidence each

1. New sale -> partial/credit -> invoice PDF -> ledger -> payment -> receipt -> Back (state restored).
2. Purchase -> supplier bill -> stock update -> supplier ledger/payment -> statement.
3. Petrol expense -> expense chart/ledger -> cash source -> count/difference -> daily close.
4. Product cost change -> historical profit unchanged; returns/units/damage reconcile.
5. Owner A cannot access Owner B IDs / files / search / drafts / AI / jobs, and vice versa.
6. Header change in settings -> reprint shows new header, totals and footer unchanged.
7. Empty VAT TRN -> Tax Invoice blocked with clear message; ordinary work still allowed.

(Driver, offline-retry and AI journeys are Phase 9-10.)

---

## 10. Page, tab, field and edge-case matrix (use for every page)

For each of the 60 routes and every tab/sub-tab/dialog in `PAGE-SPECIFICATION.md`, record at 360x800, 390x844, 768x1024, 1366x768 and 1440x900:

**Structure:** loading skeleton (not blank white card), empty, error with retry, populated, long list, stale data, read-only role.
**Fields (each one):** label, required marker, type and keyboard (numeric / phone / email on mobile; 16px minimum input text), validation message wording, min/max/precision, paste, Arabic and Malayalam text, 80+ character names, trailing spaces, zero, negative, very large, decimal rounding, duplicate submit, Enter key, Tab order, autofocus.
**Buttons:** one clear primary action, disabled-while-saving, 44-48px touch target, keyboard shortcut on desktop, confirm on destructive, double-click safe.
**State:** search text, active tab, filters, selected record, page and scroll preserved across Back and after save; URL carries it; scoped by tenant + user.
**Network:** offline, slow, 401, 403, 429, 5xx, timeout, chunk-load failure, retry once without double posting.
**Access:** owner, admin, staff, driver, platform admin, support (read-only); direct API call parity with UI.
**Visual:** 200% zoom, RTL layout, grayscale print, safe area, orientation change, no horizontal overflow, no nested double scroll, no cut-off buttons.
**Print and PDF:** A4, thermal, browser popup denied, print cancelled, one page vs 50 vs 200 lines, same data as on-screen preview.

Status per cell: `planned / implemented / tested / blocked`. A passing build or one screenshot never marks a page verified.

---

## 11. UX and ERP design rules (Tally-style, modern, premium)

- **Layout:** stable shell, compact desktop rows (Tally-like dense lists), sticky table headers and totals, keyboard-first entry (Tab / Enter / Ctrl+S, arrow keys on grids), minimal clicks.
- **Mobile:** replace blank white cards with skeletons. Four bottom tabs (Home / Sale / Ledger / More). Large touch targets, sticky primary action, no sideways scrolling. Tables become two-line cards with amount right-aligned.
- **Sidebar:** group menu, remove duplicates and unwanted pages, no long scroll.
- **Lists first:** Purchases, Suppliers, Expenses show dense lists with totals, plus a pie/bar chart for expenses by category.
- **Ledger (highest priority):** keep search, filters and customer through Back and after payment; tabs Ledger / Invoices / Payments / Reports; Record Payment deep link; receipt offered right after payment; no stale customer swap.
- **Language:** English, Arabic RTL and Malayalam tested separately. Currency is not hardcoded as AED; read it from tenant settings.
- **Errors:** plain wording, say what to do next, no raw technical text, show reference ID.
- **Reduce clicks:** keep a count per core flow. Target: new credit sale <= 4 taps after picking customer; payment + receipt <= 3.

---

## 12. New features: where, what, how it behaves

1. **Daily Close** (`/daily-close`, flag `daily_close`): sections: sales, purchases, gross profit, expenses (petrol / food / shop allowance / paper-ink), collections, expected cash, **counted cash input**, variance + reason, capital-in-market check (cash in hand + book balance + outstanding credit), Lock button, History list.
2. **Settlement adjustment** (in Record Payment): when received < due, options are *Leave due* or *Authorized adjustment* (needs permission, reason, amount cap). Receipt shows cash / adjustment / applied. Month-end report lists all adjustments so owner sees the exact leakage.
3. **Alerts:** variance above threshold, unclosed day, negative stock, overdue customers, repeated adjustments by one user. In-app first; WhatsApp/email later as flags.
4. **Owner AI assistant** (Phase 9): per-owner isolated; reads data through deterministic tools, never calculates money itself, never runs SQL; drafts invoices from uploaded PDFs for review, never auto-posts; price and summary reports with cited sources; text and voice in English, Arabic, Malayalam with honest text fallback. Super admin sees usage per tenant, model, tokens and budget.
5. **Provider setup** (server-side keys only): Gemini, Grok, OpenRouter, OpenCode/OmniRoute behind one provider layer. Check each provider's current terms; **no confidential client data to free tiers that log or train on prompts**; no silent paid fallback; hard budget cap per tenant.
6. **Driver and map** (Phase 10): simple Today list -> stop -> Navigate -> delivered -> collect payment -> receipt. Driver sees only assigned stops. Saved shop pin, visit GPS and live trip are three separate things. Live tracking only during an explicit active trip, with freshness indicator and auto-stop at trip end. Offline retry once, idempotent.
7. **Platform (super admin):** real alerts, client names, errors, infrastructure and usage with source / unit / as-of; "unavailable" shown honestly, never a fake green zero. Heap, process memory, container limit, DB sessions and pool shown separately.

---

## 13. Which model in Cursor Pro

I can't see your model picker, so check which of these are listed today:

| Job | Use |
|---|---|
| Step 0 reconciliation, financial logic (VAT, rounding, settlement, cost snapshots), tenant isolation, migrations, final review of each phase | The **strongest reasoning model** available in Cursor (an Opus-class Claude, or equivalent top model). Slower and uses more of your Pro quota, but this is where bugs cost money. |
| UI work, page-by-page layout, forms, tests, cleanup | A **mid-tier fast model** (a Sonnet-class Claude or equivalent). Good enough and much cheaper. |
| Renames, small fixes, formatting | A cheap/fast model. |

Avoid **Auto** for money or tenancy code, because you can't tell which model touched it. Don't enable Max/very-long-context mode by default; use it only for Step 0 and cross-file isolation audits. Keep `.cursorignore` tight to save context and quota.

---

## 14. Stop conditions (ask Anandu, otherwise keep going)

Stop and ask only if:
- two sources conflict on a financial or legal rule (for example VAT on profit vs standard 5%)
- an action touches production, `main`, a real database, a domain, or credentials
- a destructive action (delete, restore, migration on non-copy data) is needed
- required input is missing and nothing independent is left to do
- tests show a tenant leak or posted-money mismatch (stop, report, fix before anything else)

Everything else (reversible local steps, tests, commits on the branch) proceeds without asking.

---

## 15. Files the loop maintains

| File | Purpose |
|---|---|
| `docs/plan/MASTER-LOOP.md` | this file, rules and decisions |
| `docs/plan/STATE.md` | single truth: phase table, test counts, flags, deployed SHAs, open blockers |
| `docs/plan/PHASE-TODO.md` | ordered checklist with commit SHA per checked item |
| `docs/plan/EVIDENCE.md` (or tracker table) | one row per page x role x tenant x viewport |
| `docs/plan/CLEANUP-REPORT.md` | duplicates, unused files, removals done |
| `docs/plan/REVIEW-INBOX.md` | findings from a second tool (Codex), read-only |
| `docs/plan/DECISIONS.md` | any new decision, with date and who approved |

Log order: newest first, one entry per slice, never paste a section twice.
