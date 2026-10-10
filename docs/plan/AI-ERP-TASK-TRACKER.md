# HexaBill AI-native ERP — single task tracker

**Status:** IN_PROGRESS — tracker adopted into repo 2026-10-10 on branch `uiux-audit-p1` (base `origin/main` = `c6ba249`).
**Last verified (2026-10-10, read-only):** local `main` fast-forwarded `022e418` → `c6ba249`. Render backend `srv-d68jpdvpm1nc7393q4d0` live = `92a5059` (manual deploy 2026-10-10 10:53 UTC, `autoDeploy` off). `origin/main` = `92a5059` + 2 frontend-only commits (`4a3ac0b`, `c6ba249`). Vercel frontend SHA UNVERIFIED.
**Linked trackers (not duplicated here):** `docs/production/TASK-TRACKER.md` + `BUG-REGISTER.md` (T-/B- IDs), `docs/plan/PRODUCTION-ISSUE-REGISTER.md` (PS-), `docs/plan/ERROR-REGISTER.md` (REL-), `docs/plan/VAT-IMPLEMENTATION-TRACKER.md`, `docs/uiux/PREMIUM-UX-TRACKER.md` (UX). `docs/plan/STATE.md` is historical (stale deploy SHA).
**Session order approved by owner 2026-10-10:** Checkpoint 1 = UX Phase 1 audit (read-only) → Checkpoint 2 = P0-02. Read-only production checks authorized for P0-02.
**Current milestone:** P0 — Production stability and evidence.
**Tracker contract:** real tasks only; update `Last verified`, `git SHA`, test command/outcome, exact source reference/evidence. States `TODO / IN_PROGRESS / PASS / FAIL / BLOCKED / NOT TESTED`. Do not count skips as PASS. Existing VAT UI tracker is separate; link relevant entries.

| ID | Priority | Milestone | Task | Status | Evidence / gate |
|---|---|---|---|---|---|
| P0-01 | P0 | 0 | Capture `git status`, source SHA, Render/Vercel deployed versions and source drift | PASS (Vercel NOT TESTED) | 2026-10-10: see header; Render `list_deploys` live `92a5059`; Vercel SHA unverified (prior 403) |
| P0-02 | P0 | 0 | Investigate maintenance UI on frozenhub login (explicit maintenance vs arbitrary 503); recoverability | PASS (code, local) / production BLOCKED (owner rollback) | LIVE ROOT CAUSE 2026-10-10: Render deploy `92a5059` logged `Production database has 2 pending EF migrations; readiness will remain closed.` (10:55:05 UTC); live `/health` and `/api/maintenance-check` = 503 `InitializationFailed`. Every API call 503 → frontend showed "Under Maintenance". Fix: gate/maintenance 503 bodies carry `reason` (`SERVICE_UNAVAILABLE` / `MAINTENANCE_ENABLED`) + `Retry-After`; maintenance flag read past tenant query filter (was invisible to signed-in tenant requests); frontend shows "Server unavailable" vs "Scheduled maintenance", polls `/api/maintenance-check` 5→60s, Try again. Tests: `ServiceUnavailableContractTests` (2, red→green), `serviceErrors.test.js` (5), `e2e/service-availability.spec.js` (3 × m390/d1440 green; all 3 red on old code). Backend 778/778 on fresh disposable PG, 0 skips; frontend 144/144; build OK. Production restore = rollback to `bdcc429` or backup+apply 2 additive migrations — owner action pending |
| P0-03 | P0 | 0 | Verify PostgreSQL integration skips, migration history and disposable-PG migration rehearsal | PARTIAL | 2026-10-10: full suite with `HEXABILL_TEST_POSTGRES` on fresh disposable DB 778/778, 0 skips. Old disposable DB `hexabill_master_loop_test` lacks today's VAT columns (42703) — reuse of stale test DBs gives false failures. Silent-return PG tests and fresh-history migration collision (REL-004/011) still open |
| P0-04 | P0 | 0 | Fix confirmed wrong-company/TRN/footer in Gulf Harvest/Frozen Hub print | PARTIAL | GH PASS (T-001, T-010a-c, Starplus absent assertions); FrozenHub family T-010d BLOCKED(asset) — FH BW logo present in `SeedLogos/` since `9630420`, re-check |
| P0-05 | P0 | 0 | Reconcile expected four tenants vs shown three; no duplicate creations | PARTIAL | B-004 note: read-only prod check counted 7 tenants; SuperAdmin list pageSize 20, case-sensitive search, stat cards count current page only |
| P0-06 | P0 | 0 | Audit real create/edit/save/delete in POS, purchase, expense, payment, SKU, stock and reports | PARTIAL | T-004a-c PASS (SQLite HTTP harness); returns HTTP round-trip T-004d TODO |
| P0-07 | P0 | 0 | Check idempotency/retry/double-payment and tenant leakage in APIs, caches, logs and exports | PARTIAL (client fixed) | Old client re-sent a failed expense POST (browser test: 2 requests). Now writes auto-retry only with `Idempotency-Key` or POS `externalReference` (`isAutoRetryable`). Server-side dedupe for purchases/expenses/returns still TODO |
| P1-01 | P1 | 1 | Tenant onboarding, owner invitation/reset, subdomains, role permissions | TODO | 4 synthetic tenant E2E |
| P1-02 | P1 | 1 | Staff job title, active vs attendance distinction, owner activity dashboard | TODO | role and activity E2E |
| P1-03 | P1 | 1 | Last finalized customer-product-unit price reuse, returns/void/edit edge cases | TODO | historical price tests |
| P1-04 | P1 | 1 | Daily opening/closing cash UX, tender reconciliation, branch/cashier | TODO | expected vs counted and role tests |
| P1-05 | P1 | 1 | Frozen Hub header only + common print identity/Arabic/monochrome design | TODO | PDFs and image diff |
| P1-06 | P1 | 2 | Inventory routes/screens/modal/form count and premium shared design tokens | IN_PROGRESS (audit PASS, implementation TODO) | 2026-10-10 Checkpoint 1: `docs/uiux/PAGE-INVENTORY.md` recount + `docs/uiux/PREMIUM-UX-TRACKER.md` (25 confirmed defects (8 P1, 14 P2, 3 P3) + 1 NOT REPRODUCED + 1 NOT TESTED, baseline metrics at 360/390/768/1440); `e2e/ux-audit.spec.js` 28/28 passed on synthetic local data |
| P1-07 | P1 | 2 | Desktop navigation, tablet, mobile quick create, no duplicate chrome | TODO | Playwright viewport matrix |
| P1-08 | P1 | 2 | Tenant global search + indexed results + shortcuts | TODO | permission and latency tests |
| P1-09 | P1 | 2 | Faster invoice/POS/purchase/expense workflows; explicit save confirmation | TODO | click/time and DB E2E |
| P1-10 | P1 | 2 | PWA install, auth/cache/privacy and offline semantics where feasible | TODO | install/clear session checks |
| AI-01 | P2 | 3 | Backend tool registry with tenant/role scope and source links | TODO | negative cross-tenant tests |
| AI-02 | P2 | 3 | Provider registry + API-key safe vault + model/capability/cost routing | TODO | synthetic provider tests |
| AI-03 | P2 | 3 | SuperAdmin provider/test/keys/models/quotas/usage/email alerts | TODO | auth audit + budget tests |
| AI-04 | P2 | 3 | Read-only assistant for sales, AR, stock, expenses, routes, daily close, staff | TODO | grounded response evidence |
| VOICE-01 | P2 | 4 | Malayalam/English/Hindi/Arabic push-to-talk STT, captions, text fallback | TODO | locale/accent/noise eval |
| VOICE-02 | P3 | 4 | LiveKit real-time voice & Gemini Live/voice pipeline optional | TODO | latency, privacy, caps |
| VOICE-03 | P3 | 4 | Voice-drafted invoice with confirmation & idempotent posting | TODO | injection, ambiguity, denial tests |
| MAP-01 | P2 | 5 | Existing routes/stops/collections map + delivery/visit completion | TODO | geofence/role/e2e |
| MAP-02 | P3 | 5 | Opt-in location tracking, freshness, attribution/licensed tiles | TODO | permission/session/retention |
| AUTO-01 | P2 | 5 | Daily summaries, overdue reminder drafts, stock alerts, owner email alerts | TODO | dedupe/quiet hours/audit |
| ML-01 | P3 | 6 | Data quality check, demand/reorder/payments baseline, time-split evaluation | TODO | baseline accuracy report |
| ML-02 | P3 | 6 | Approved model rollout, feedback, drift and safe scheduled retraining | TODO | offline comparison/pilot |
| FINAL-01 | P0 | ALL | Cross-tenant security/PII, unit integration, PG, E2E, build, PDF, AI failures | TODO | No unexplained skips |
| FINAL-02 | P0 | ALL | Stage rollout plan, backups, feature flags, rollback, support docs | TODO | Written approval for prod |

## Session log
### 2026-10-10 — Checkpoint 1: UX Phase 1 audit (read-only)
- **Source:** branch `uiux-audit-p1` from `c6ba249`. Changes are docs plus one audit spec; no product code. Nothing committed yet, pending owner review.
- **Environment:** local API on 127.0.0.1:5000 over the throwaway SQLite copy `%TEMP%\hexabill-uitest`. Synthetic expenses were added through the local API. No production access was used for this checkpoint.
- **Commands:** `npx playwright test e2e/ux-audit.spec.js --project=m360 --project=m390 --project=t768 --project=d1440 --workers=1` → **28 passed**.
- **Results:**
  - 25 defects confirmed: 8 P1, 14 P2, 3 P3. One suspected defect was not reproduced (UX-E08, expense list scroll). No P0 UX defect.
  - Not tested: large datasets (only 2 invoices), RTL, a real device keyboard.
- **Next task:** Checkpoint 2, P0-02.

## Start-of-session template
```
CHECKOUT SHA: <verified>
BRANCH / CLEAN STATUS: <verified>
CURRENT TASK ID: <single task>
WHY P0/P1: <verified symptom>
FILES RELEVANT: <paths>
REPRODUCTION: <command/steps>
SCOPE AND SAFETY: <no live writes>
```

## End-of-session template
```
STATUS: PASS | FAIL | BLOCKED | NOT TESTED
TASK ID:
FILES CHANGED:
ROOT CAUSE:
TEST COMMANDS/RESULTS:
PG/FRONTEND/E2E STATUS:
TENANT SECURITY EVIDENCE:
AI PRIVACY/COST IMPACT:
OPEN RISKS:
GIT STATUS:
NEXT ONE TASK:
STOP HERE — do not begin next phase automatically.
```
