# HexaBill: Codex End-to-End Test -> Fix -> Retest Loop (strict)

Save as `docs/plan/E2E-FIX-LOOP.md`. Paste **Section 0** into Codex. Everything else is rules Codex reads.

---

## 0. KICKOFF PROMPT (paste into Codex)

```
You are the single executor for HexaBill (repo ANANDU-2000/HexaBillAd, local: C:\Users\anand\OneDrive\Desktop\My StartUps Projects\HexaBilngApp). Branch: e2e-loop-1 off main. Push the BRANCH only; do not push main, do not deploy.

Read fully, in order: docs/plan/MASTER-LOOP.md, docs/plan/STATE.md, docs/plan/DECISIONS.md, docs/plan/E2E-FIX-LOOP.md, docs/plan/PAGE-SPECIFICATION.md, docs/plan/ROUTE-MANIFEST.json.

MISSION: make GulfHarvest production-ready first, then FrozenHub1, FrozenHub2. Zayogya is regression-only and must stay byte-for-byte unchanged (tax, print, numbers).
Method: use a REAL browser (Chrome) against a LOCAL stack with SYNTHETIC test tenants. Log in as each tenant, exercise every page, button, filter, form, print and PDF. Record every failure in docs/plan/ERROR-REGISTER.md. Fix, retest in the browser, repeat (section 4). Do not stop at passing unit tests: a page is DONE only with browser evidence (section 2).

Hard rules: section 3 (safety). Never use real client credentials or write to production data. Never touch Zayogya behavior. Flags OFF by default. No PASS without evidence. Report after every loop iteration (section 12).
```

---

## 1. Why earlier runs "passed" but the real UI is still bad

Previous sessions verified with unit tests, builds and mocked requests. The real login showed a bad UI because:
- Tests do not look at the screen, they check code.
- Mocked API data hides empty, slow and error states.
- Plan mode produces plans and partial fixes without re-running the app.

**New rule:** a defect counts as fixed only after Codex (a) reproduces it in the real browser, (b) fixes it, (c) reproduces the same steps again and sees it gone, with before/after screenshots. Build/test green alone is never "fixed".

---

## 2. Definition of Done per page (all must be true)

1. Opened in Chrome at **360x800, 390x844, 768x1024, 1366x768, 1440x900** as the correct role and tenant.
2. Screenshot taken for each viewport and **actually inspected** against the checklist in section 7 (not just saved).
3. Every button, tab, filter, search, sort, pagination, form field, dialog and link on the page clicked at least once; result logged.
4. States checked: loading, empty, error (force with offline/401/403/429/500), populated, long text (80+ characters, Arabic, Malayalam).
5. Create / edit / delete (or void) / restore where applicable, and the list refreshes without a manual reload.
6. Back button and page refresh keep search, filters, tab, selected record, page and scroll.
7. Console has no errors; network has no failing calls except forced ones.
8. Evidence row added to `EVIDENCE.md`: page, role, tenant, viewport, commit, screenshot path, status.
9. Zayogya snapshot test still passes.

---

## 3. Safety rules (never break)

1. **Test data lives only in local/staging synthetic tenants**: `gulfharvest-test`, `frozenhub1-test`, `frozenhub2-test`, `zayogya-test`. Created with `scripts/seed-dev-synthetic.mjs`, which must refuse production hosts and connection strings.
2. **Do not log in to real client production accounts and do not create test data there.** Real owners' books must not be polluted. If a production smoke check is needed, it is read-only, uses a dedicated test login, and is listed for the owner to approve first.
3. Never put passwords, licence numbers, TRNs or certificate text into the repo, logs, screenshots or `EVIDENCE.md`. Use masked values (`1055****0001`). Keep real values only in gitignored `appsettings.Development.json` and the local DB.
4. Client documents in `clients/documents of clents/` are read locally only. The folder now holds 4 PDFs and a FrozenHub logo. **Inspect the file `TN-6757679`**: it may be a VAT registration certificate (earlier notes said none was found). Record only "VAT certificate present: yes/no" and the masked number. The GulfHarvest corporate-tax number is never a VAT TRN. GulfHarvest still needs a logo file.
5. Before every push: `git grep` for real TRNs, licence numbers, emails and passwords; fail the push if any match.
6. **Check auto-deploy**: confirm read-only whether Vercel/Render deploy from `main`. Pushing `main` may deploy. Branch pushes only until the owner gives an explicit go.
7. Migrations: additive only, never edit old ones. Apply new migrations to a **copy** first. Rollback plan recorded per migration.
8. Sample/placeholder TRN: never print a made-up TRN on a document titled "Tax Invoice". Without a real VAT TRN the document prints as "Invoice" with no TRN, with a visible owner banner "VAT TRN missing: update in Settings > Company". (Supersedes earlier "sample TRN in production" until the owner confirms in `DECISIONS.md`.)
9. Stop and ask only for: financial/legal conflicts, tenant data leak, destructive migration, real credentials/production DB, production deploy.

---

## 4. The auto-fix feedback loop (engineering loop)

```
LOOP (per tenant, per page group):
  1. RUN     start local API + PostgreSQL + frontend; seed synthetic tenant
  2. TEST    execute the page script (section 6/7) in Chrome, capture screenshots, console, network
  3. LOG     every failure -> ERROR-REGISTER.md row:
             ID | tenant | page | viewport | steps | expected | actual | evidence | severity | status
  4. TRIAGE  S1 money/tenant leak/data loss, S2 feature broken, S3 UX defect, S4 cosmetic
  5. FIX     S1 first, then S2, S3, S4. One cohesive fix per commit; failing test first
  6. VERIFY  rerun the same steps in the browser + targeted unit/PG test + Zayogya snapshot
  7. RECORD  mark row FIXED with commit SHA and after-screenshot
  8. REPEAT  until the group has 0 open S1/S2 and 0 open S3 on the money pages
EXIT: all pages for the tenant meet section 2 AND ERROR-REGISTER has no open S1/S2.
MAX 5 iterations per group; if still failing, write a root-cause note and stop for owner input.
```

Order of work: **GulfHarvest -> FrozenHub1 -> FrozenHub2 -> Zayogya regression only.**
Page-group order: auth/shell -> settings/company -> customers & ledger -> POS/invoices -> payments & receipts -> returns -> purchases & suppliers -> expenses -> products/stock -> daily close -> VAT -> reports -> users/roles -> backup -> remaining routes -> platform admin.

---

## 5. Test data (per tenant, deterministic)

- 30 customers (incl. Arabic/Malayalam names, one 90-character name, duplicates of similar names, one with zero balance, one overdue)
- 60 products with units/conversions, some with zero stock, low stock, no barcode, inactive; each category tagged for VAT eligibility testing (section 8)
- 6 suppliers, 20 purchases (cash / partial / credit)
- 200 invoices: cash, credit, partial, returned, voided; one with 1,331 total and 1,330 received
- Payments: cash, cheque pending/cleared/bounced, overpayment, adjustment
- Expenses: petrol, food, shop allowance, paper/ink, rent; with attachments
- One day prepared for Daily Close with a known cash variance
- A second tenant with overlapping names so isolation tests can try to cross-read

---

## 6. Feature test script for GulfHarvest (run first, then repeat for FrozenHub1/2)

| # | Area | Must test |
|---|---|---|
| 1 | Auth | login, wrong password, locked/expired token, logout, session on two tabs, role redirect |
| 2 | Company settings | name, address, phone, logo upload, VAT TRN (blank / 14 / 15 / letters), CT TRN separate, save, reload, audit entry, header change shows in next reprint |
| 3 | Customers | add, edit, delete/deactivate, duplicate phone, search, filter (all/active/outstanding/overdue/inactive), sort, pagination, pin/location, import/export |
| 4 | Products | add, edit, delete, unit conversion, barcode, stock adjust, low stock, price list, image, category, search/filter |
| 5 | POS / invoice | new sale, add by barcode/search, qty/price edit, discount, round-off, hold/resume draft, credit, partial, save, edit invoice, void, duplicate-click save posts once, offline save |
| 6 | Invoice output | preview = PDF = print (same numbers), A4, thermal, Arabic, grayscale, long item names, 50 and 200 lines, reprint doesn't repost |
| 7 | Payments & receipts | record payment, partial, overpay, cheque states, 1,331/1,330 with authorized adjustment of 1, leave-due, receipt PDF/print, popup blocked fallback, reprint, void payment |
| 8 | Customer ledger | opening balance, running balance, statement, search retained after Back, tab retained, record payment deep link |
| 9 | Returns | full/partial return, stock and balance effect, damage, reversal not delete |
| 10 | Purchases / suppliers | create bill, edit, stock update, supplier ledger, supplier payment, statement |
| 11 | Expenses | add/edit/delete, category settings, attachment, chart (pie/bar by category), list totals |
| 12 | Daily Close | expected cash, counted cash, variance reason, lock, history, reopen with audit, late entry |
| 13 | Reports | every report tab loads, filters, export, empty state, date range, totals match ledger |
| 14 | VAT page | section 8 |
| 15 | Users/roles | add staff, role permissions, driver restricted, owner-only buttons hidden AND blocked by API |
| 16 | Backup/restore | create backup, restore on copy, verify counts match |
| 17 | Isolation | tenant A cannot see/export/search/print B's IDs, files, drafts, in both directions |
| 18 | Errors | offline, 401, 403, 429, 500, slow network, chunk-load failure: message clear, retry works, no double post |

---

## 7. Button, icon, position and field checklist (apply to every page)

**Structure and position**
- One primary action per screen. Desktop: top-right of the page header. Phone: sticky bottom bar above the safe area, 48px high.
- Secondary actions in a `...` menu or ghost buttons. Destructive actions are red, never next to Save, and ask for confirmation.
- Back / breadcrumb top-left. Search at the top of the list, filters directly under it, totals row sticky.
- List row actions: one visible quick action (view/pay), others in a row menu. No row with more than 3 visible icons.

**Icons**
- Use one icon set (the installed `lucide-react@0.294`; check each icon name exists). Same icon means same meaning on every page (edit = pencil, delete = trash, print = printer, pay = banknote). Always with an accessible label or tooltip. Icon-only buttons are at least 44x44px.

**Fields**
- Label above the input, required marker, inline error under the field, plain wording. Mobile input text at least 16px. Numeric keypad for amounts and phone. Decimal precision enforced. Enter submits where sensible; Tab order logical; autofocus on the first field of a modal.

**Lists and tables**
- Desktop: dense Tally-style rows, sticky header and totals, keyboard navigation. Phone: two-line cards, amount right-aligned, no horizontal scroll.
- No nested double scrollbars, no blank white cards while loading (use skeletons).

**Sidebar and navigation**
- Grouped menu, no duplicate entries, no duplicate tabs, no dead routes. Phone: four tabs (Home / Sale / Ledger / More).

Open-source references to study for patterns (do not copy code): ERPNext/Frappe UI, Odoo, Akaunting, InvoiceShelf, shadcn/ui, TanStack Table, cmdk (command palette), react-hook-form. Check each license; add only MIT/Apache-compatible libraries and only if the page needs it. No framework rewrite.

---

## 8. VAT from profit: GulfHarvest and FrozenHub (not Zayogya)

**Status:** the owner wants VAT calculated on profit for GulfHarvest and FrozenHub. This is the UAE margin scheme. It is a tax rule, so the numbers must match the accountant's written examples before the flag goes ON for any real client.

**Facts the agent must respect (as far as I know; accountant to confirm in writing):**
- Margin = selling price - purchase price for each eligible item; VAT is computed on the margin, not on net operating profit (sales - expenses). The margin is treated as VAT-inclusive, so VAT = margin x 5/105.
- The scheme is limited to specific kinds of goods (for example second-hand goods), and conditions apply. **The accountant must confirm in writing that these clients' goods qualify.** If frozen/new goods do not qualify, "VAT from profit" is not lawful for them.
- A loss on an item usually gives zero VAT, not negative VAT.

**Build, in this order**
1. Needs `sale_cost_snapshots` ON for new sales. Margin per line = line total - saved cost at sale. Legacy lines without saved cost are not computed; they stay "standard" or "not available", never guessed from today's product cost.
2. Per-tenant VAT mode: `STANDARD` (default) or `MARGIN`. Per product/category eligibility flag. Effective date applies prospectively only. Zayogya is always `STANDARD` and cannot be switched.
3. Compute server-side with decimals; store the VAT amount per invoice line at posting (immutable). Returns reverse the stored margin VAT with a linked correction.
4. Invoice documents: show what the accountant approves (for margin-scheme sales the invoice normally does not show VAT as a separate line; the accountant confirms the wording). Fixture-driven.
5. **VAT page (`/vat-return`) redesign:**
   - Tabs: **Summary | Margin calculation | Exceptions | Filed history**.
   - Summary: period, VAT payable, a clear label of mode (Standard or Margin).
   - Margin calculation: table per invoice line: date, invoice, item, sale price, saved cost, margin, VAT, eligible yes/no.
   - Exceptions: lines with no saved cost, negative margin, ineligible items, missing TRN.
   - Remove any display of `profit x 5%` as VAT. Any profit-based figure not from the accountant-approved rule is labelled "Estimate, not for filing".
   - Dashboard shows only the computed `netVatPayablePeriod`, same number as the VAT page.
6. **Gate:** unit tests plus accountant fixtures (positive, zero, loss, mixed eligible/ineligible, return, period boundary) must pass. Until the accountant's examples exist, the engine ships behind the OFF flag `vat_margin_scheme` and the live VAT page stays on Standard. Record in `DECISIONS.md` who approved and when.

---

## 9. Print format (shared by GulfHarvest and FrozenHub; Zayogya untouched)

- One shared template. Only the **top header block** is tenant-specific (current Company Settings: name, address, phone, logo, VAT TRN). Items table, totals and footer are identical to now.
- Every render path uses current settings: preview, PDF, browser print, reprint, receipt.
- Outputs to verify for each tenant: A4, thermal 80mm, Arabic header, grayscale, logo missing, logo present, very long company name, TRN blank (prints "Invoice" not "Tax Invoice") and TRN present.
- Evidence: screenshot plus PDF text extraction proving header text. Store under `Desktop/HexaBill_Backups/...`, outside git.
- Zayogya snapshot test pins current HTML/PDF text and VAT totals; it must stay green.

---

## 10. Known pending bugs and gaps (fix through the loop, do not skip)

- Ledger loses search, filters, tab and selected customer after Back or payment.
- Receipt: print popup-denied handling, PDF download, retry, historical balance meaning, hardcoded AED.
- Invoice create/print/PDF failures reported by the owner: reproduce in the browser first.
- Invoice version restore: currently a safety block only; hide the button until it works.
- Delete/edit/filter buttons inconsistent across pages (section 7).
- Stock and Products pages' UX and Tally-style density.
- Report queries returning zero or partial data silently instead of an error.
- Cost snapshots: remaining report consumers and return valuation.
- Mobile: blank white cards, long sidebar, nested scroll, hidden bottom buttons.
- 44 PostgreSQL tests never run (start PG with Docker or local install; if impossible, state exactly why).
- 235 lint warnings, 28 npm audit findings: triage, fix safe ones, no broad major upgrades.
- Super admin: real infra and usage values with source/unit/as-of; never fake green zero.
- New features (AI assistant, voice, driver/map, daily-close alerts) stay OFF and are built only after money and page fixes are green.

---

## 11. Cleanup (strict)

1. Dry run first: `CLEANUP-REPORT.md` listing duplicate files (hash and name), unused components/pages/services/packages, stale folders (old zips, extracts, copied worktrees, logs, screenshots, build output).
2. For each candidate attach proof of non-use: static and dynamic imports, DI registrations, config, route manifest, tests, scripts.
3. Delete in small commits with a build and test after each. Never delete migrations or rollback implementations; never delete anything behind a flag.
4. Update `.gitignore` and `.cursorignore`. Move local evidence outside the repo.
5. Remove demo/mock data only with proof it isn't used by tests or seeds.

---

## 12. Report after every loop iteration (8 lines)

```
Tenant/group: ...   Iteration: n/5
Tested: pages X/61, viewports, roles
Found: S1 a / S2 b / S3 c / S4 d (new this round)
Fixed: ids + commits
Still open: ids (top 5)
NOT RUN: items + exact reason
Flags/rollback: ...
Next: ...
```

Plus a running counter in `STATE.md`: pages done / partial / not run out of 61.

---

## 13. Release gate (before the owner is asked to approve production)

All true, with evidence:
- GulfHarvest, FrozenHub1, FrozenHub2: section 2 met for all money pages; no open S1/S2.
- PostgreSQL tests run; isolation both directions pass.
- Seven journeys pass on each tenant; backup restore and migration rollback done on a copy.
- VAT page: Standard mode correct; margin mode only if accountant fixtures pass and are signed off.
- Print/PDF header proofs for all three tenants; Zayogya snapshot identical.
- Security: secrets grep clean; no real client data in repo.
- Rollback plan and flag states listed; deployed SHAs recorded.

Then ask the owner: **"Approve production deploy? yes / no"**. Agent never deploys on its own.