# STATE.md — HexaBill single source of truth

**As of:** 2026-10-04 (IST)  
**Executor:** Cursor Agent on main repo  
**Working tree:** `C:\Users\anand\OneDrive\Desktop\My StartUps Projects\HexaBilngApp`  
**Branch:** `master-loop-2` (off `main` @ `7edb29b`) — push branch only until owner says otherwise  
**Baseline for diff:** `39ffafb`  
**Codex worktree (read-only):** `C:\Users\anand\.codex\worktrees\afa0\HexaBilngApp`


## Deploy auto-check (read-only, 2026-10-04 master-loop-2)

| Platform | Resource | Auto-deploy from main? | Evidence |
|---|---|---|---|
| Render | HexaBill `srv-d68jpdvpm1nc7393q4d0` (repo HexaBillAd) | **NO** (`autoDeploy=no`, `autoDeployTrigger=off`) | Render list_services |
| Vercel | Project linked to HexaBillAd | **UNVERIFIED** | `list_projects(repoUrl=HexaBillAd)` returned 0; `hexabill-ui` name lookup 404 for team |

No settings were changed.

---

## 1. Git snapshot

```
## main...origin/main
?? docs/plan/MASTER-LOOP.md   (and Step 0 artifacts in this commit)
```

`git log --oneline -30` (newest first): starts at `6dc8d9c` docs(tier0) PR #3 note → Tier0 merge → `846ee95` currency fixes → `e41b7ab` refactor handoff → `39ffafb` backup agent.

`git diff --stat 39ffafb..HEAD`: **256 files**, +23224 / −1523.

Committed groups since `39ffafb`:
- receipts / payment snapshots
- sale & purchase cost snapshots
- returns (audited reverse)
- daily close
- Tier 0 provisioning + sample VAT
- settings/TRN / document header
- shell URL sync + FE tests
- docs (PHASE-TODO, PAGE-SPEC, TIER0-*)

Uncommitted **in Codex worktree only** (not yet on main): SettingsService reconciliation, PdfService header parity extras, DocumentHeaderTests expansion, TenantCompanySettingsTests, PostgresTestSchema, PAGE-SPEC already on main, IMPLEMENTATION-PROMPT extras. See `REVIEW-INBOX.md`.

---

## 2. Clean build proof (2026-10-04)

| Gate | Result | Evidence |
|---|---|---|
| Backend Release build | **PASS** | 0 warnings, 0 errors |
| Backend tests | **PASS** | **555 passed**, **44 skipped** (PostgreSQL), **0 failed**, Total 599 |
| Frontend `npm ci` | **PASS** | 430 packages |
| Frontend lint | **PASS** | 0 errors, 235 warnings |
| Frontend tests | **PASS** | **74/74** |
| Frontend production build | **PASS** | Vite built in ~31s |

This row replaces all older conflicting test counts in `docs/refactor-progress.md`.

---

## 3. Migration inventory (additive only — do not edit history)

| Migration | Additive? | Notes |
|---|---|---|
| `20261003090000_AddPaymentReceiptSnapshot` | yes | receipt_snapshots |
| `20261003110000_AddSaleItemCostBasis` | yes | sale_cost_snapshots |
| `20261003120000_AddPurchaseItemConversionAtPurchase` | yes | |
| `20261003130000_AddPurchaseItemCostCapturedAt` | yes | purchase_cost_snapshots |
| `20261003140000_AddPaymentSettlementAdjustmentFlag` | yes | settlement_adjustments |
| `20261003150000_AddDailyCashClose` | yes | daily_close |
| `20261003160000_AddDailyCashCloseBankSnapshot` | yes | |
| `20261003170000_AddExpensePaidFrom` | yes | |
| `20261003180000_AddCashDrawerMovement` | yes | |
| `20261003190000_AddPaymentParentPaymentId` | yes | latest |
| `AppDbContextModelSnapshot.cs` | n/a | matches latest migration set |

Total migrations in tree: **47** (including older). Snapshot present and in sync with latest.

---

## 4. Flag inventory (default OFF)

| Flag key | Default | Who switches | Rollback |
|---|---|---|---|
| `receipt_snapshots` | OFF (absent from FeaturesJson) | Platform admin FeaturesJson | Remove key from FeaturesJson |
| `sale_cost_snapshots` | OFF | Platform admin | Remove key |
| `purchase_cost_snapshots` | OFF | Platform admin | Remove key |
| `settlement_adjustments` | OFF | Platform admin | Remove key |
| `daily_close` | OFF | Platform admin | Remove key |
| `vat_basis_effective_dating` | OFF | Platform admin | Remove key |
| `localBackupAgent` | OFF | Platform admin | Remove key |
| `FeatureFlags:CustomerMerge` | false (config) | Config / env | Set false |
| `FeatureFlags:SupplierMerge` | false (config) | Config / env | Set false |
| `FeatureFlags:CustomerStopLocation` | false (config) | Config / env | Set false |

Source: `TenantFeatureFlags` in `BackupAgentRules.cs`. `IsEnabled` returns false when FeaturesJson missing/empty.

---

## 5. Phase truth table (11 phases)

| Phase | Status | Evidence |
|---|---|---|
| Tier 0 gates (pre-phase) | **PARTIAL** | T0-01..T0-13 mostly PASS local; PG 44, restore, production deploy BLOCKED; Codex WIP not on main; D5 profit-VAT UI still shows ProfitVat; sample-TRN policy changing per DECISIONS |
| 1 Clean build / version baseline | **PARTIAL** | Clean build PASS today; deployed SHAs UNVERIFIED |
| 2 Isolation + FH2 provisioning | **PARTIAL** | SQLite/HTTP isolation PASS; FH2 provisioned locally; PG NOT RUN |
| 3 Payments / invoices / receipts | **PARTIAL** | Code + unit tests; full journey evidence local only |
| 4 Cost snapshots + settlement adj | **PARTIAL** | Flags OFF by default; tests exist |
| 5 Daily Close | **PARTIAL** | API/UI wired; flag OFF; petrol journey tests |
| 6 Margin VAT | **NOT STARTED** | Needs accountant fixtures; D5 stop-gap required |
| 7 Shell UX (Tally / 4 tabs) | **PARTIAL** | BottomNav exists; matrix not complete |
| 8 Remaining routes matrix | **PARTIAL** | Shell check 25 routes×4 tenants; full 60×5 viewports NOT RUN |
| 9 AI assistant | **NOT STARTED** | |
| 10 Voice / driver / maps | **NOT STARTED** | |
| 11 Staging / restore / pilot | **NOT STARTED** | Production BLOCKED |

---

## 6. Deployed versions

| Surface | SHA | Status |
|---|---|---|
| Vercel production | — | **UNVERIFIED** (not queried this session) |
| Render backend | — | **UNVERIFIED** (not queried this session) |
| GitHub `origin/main` | `6dc8d9c` | Verified local = remote |

---

## 7. Commit plan (logical slices → push main per Anandu auth 2026-10-04)

1. `docs(master-loop): MASTER-LOOP + STATE + DECISIONS + EVIDENCE + REVIEW-INBOX` (this slice)
2. Port Codex WIP → test → `feat(tier0): settings reconciliation + header parity tests`
3. Zayogya snapshot test
4. Sample TRN policy (prod-allowed + banner + shared-TRN warning)
5. D5 profit-VAT labelling fix
6. Header parity evidence artifacts (local backups, not committed binaries)
7. Isolation audit doc + PG if available
8. Journeys / restore sign-off
9. Seed script
10. Cleanup dry-run then safe deletes
11. Phases 1–11 ordered

---

## Slice log (newest first)

### 2026-10-04 — master-loop-2 FIRST A–D
- **changed:** (A) Render autoDeploy=no; Vercel UNVERIFIED; (B) scrubbed real TRN/password literals from tracked files; (C) missing→Invoice+banner, sample→SAMPLE INVOICE; (D) FH1/FH2/GH header PDFs + grayscale logo + Arabic bilingual settings proofs
- **files:** SampleVatTrn.cs, PdfService.cs, SaleService.cs, SettingsService.cs, Program.cs, SettingsPage.jsx, TenantHeaderParityTests.cs, SampleVatTrnTests.cs, scripts, docs
- **tests+evidence:** TenantHeaderParity+DocumentHeader+SampleVatTrn+Zayogya **25 passed**; evidence `Desktop/HexaBill_Backups/master-loop-2-headers-20261004-104308` + VERDICT.md
- **NOT RUN:** browser print live (Vite); Vercel project link; PG 44 (Docker missing)
- **flags+rollback:** none; branch master-loop-2 only; DECISIONS sample-TRN print rules still PROPOSED
- **next:** slice 1 local API+PG 44 tests
### 2026-10-04 — master-loop-2 FIRST A–C
- **changed:** deploy read-only report; scrub client PII from tracked files; sample/missing TRN → Invoice/SAMPLE INVOICE; banner; tests; DECISIONS proposed
- **files:** SampleVatTrn.cs, PdfService.cs, SaleService.cs, SettingsService.cs, Program.cs, SettingsPage.jsx, tests, scripts, appsettings.example, docs
- **tests+evidence:** SampleVatTrn/Zayogya/DocumentHeader/Tier0/LetterIdentity 25 passed
- **NOT RUN:** browser print live; Vercel link confirmation
- **flags+rollback:** none; branch master-loop-2 only
- **next:** D header proofs for FH1/FH2/GH; then PG 44
### 2026-10-04 — slices 3–10 (sample TRN, D5, evidence, seed, cleanup dry-run)
- **changed:** SampleVatTrn prod-allow + auto-fill; Zayogya snapshot; D5 profit estimate; isolation/cleanup/seed/signoff docs
- **files:** SampleVatTrn.cs, SettingsService.cs, VatReturn*, tests, scripts/seed-dev-synthetic.mjs, ISOLATION-AUDIT, CLEANUP-REPORT, TIER0-SIGNOFF, PHASE-MATRIX, .gitignore, .cursorignore
- **tests+evidence:** BE 564p/44sk; FE 74; header PDFs in Desktop/HexaBill_Backups/master-loop-header-20261004-102752
- **NOT RUN:** PG 44; live seven journeys this session; backup restore; full 61×5 matrix; Vercel/Render SHA
- **flags+rollback:** no flag defaults changed (still OFF)
- **next:** PG when available; live journey re-run; Phase 7–8 matrix fill
### 2026-10-04 — Codex WIP port (no-op)
- **changed:** REVIEW-INBOX port decision; no product code
- **files:** REVIEW-INBOX.md, STATE.md
- **tests+evidence:** review only (prior BE 555 / FE 74 still valid)
- **NOT RUN:** n/a
- **flags+rollback:** none
- **next:** Zayogya regression snapshot test

### 2026-10-04 — Step 0 reconciliation
- **changed:** plan docs scaffold; no product code
- **files:** MASTER-LOOP.md, STATE.md, DECISIONS.md, EVIDENCE.md, REVIEW-INBOX.md
- **tests+evidence:** BE 555/44sk/0fail; FE 74; lint 0err; build OK
- **NOT RUN:** Vercel/Render SHA verify; PG suite; full page×viewport matrix
- **flags+rollback:** none changed
- **next:** Port Codex worktree WIP onto master-loop / main



