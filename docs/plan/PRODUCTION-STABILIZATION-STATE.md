# Production stabilization — live checklist

Source: HexaBill_Production_Stabilization_Master_Prompt.md. Inspected starting state8Oct2026: release-1 / bdcc429, product tree clean; master/goal/screenshot pack untracked user inputs. Full objective preserved. Historical green notes are not current certification.

## Fresh baseline and current slice

- Clean npm ci/restore PASS. Baseline FE99/101 with two obsolete iframe mocks; latest after VAT/modal changes113/113 pass, zero skips/failures; lint234 warnings/0errors, build27.95s PASS. Existing chunk/browser-data warnings remain.
- Backend baseline649/675 with26 failures caused by shared FIN09 DailyClose lock contamination on8October; per-test factories fixed it. Latest full Release PG-enabled692/692, zero skips/failures (1m18s). EnsureCreated is not migration proof.
- Shared-email auth before9pass/2fail, now scoped tenant/platform query using trusted host; BCrypt/fresh status/token expiry retained. Fixed login stage instrumentation and20 before/20 after HTTP measurements recorded; no latency improvement claim. Real GulfHarvest/Zayogya form login/dashboard verified; broader role/lockout matrix OPEN.
- Owner-directed5% positive operating-profit comparison uses existing ProfitBased setting only. Server nullable estimate/UI card/profit tab; legacyProfitVat0 and all filing boxes unchanged. Focused VAT15/15, card5/5 pass. Four synthetic API comparisons and SQL baseline205/100/105; GulfHarvest card/Refresh/profit tab and Zayogya no-card/tab browser proof. No production settings changed.
- PaymentModal actual-component lost-response regression reproduced different keys and missing remount recovery (2fail). Existing ledger journal now preserves scoped original key/body and blocks changed drafts; five component regressions PASS, including invoice envelope fix. Real UI/PG lost-response/reload/changed-draft recovery proved same key/body/payment10; both new rows9/10 voided and all tenants restored205/100/105; PaymentsPage single/bulk retry defects remain OPEN.
- Current architecture map61 routes;331 screenshot inventory,24 contact-sheet inspected/307notreviewed. Full route acceptance OPEN.
- Test runtime interrupted between continuation contexts. Prior owned API/Vite absent; retained PG recovered after unavailable55442 port to loopback50801. Guarded bridge migrationProof=false, flagsOFF. Newly owned API/Vite/proxy/helper stopped, retained PG cleanly stopped, browser logout/tab/clipboard/runtime credential cleanup confirmed. See PAYMENT-RECOVERY-EVIDENCE.md.

## Full live checklist

- [ ] Phase0: current architecture/service/route map, screenshot corpus grouping, fresh complete baseline and failure investigation.
- [ ] Phase1: login stage instrumentation,20-attempt before/after p50/p95, all auth/host/lockout/errors and navigation/dashboard browser proof.
- [ ] Phase2: sale stage measurements,1/10/50line matrix, durable retry identity, stock/money reconciliation.
- [ ] Phase3: payments/group receipts, every create/retry entry point, mobile selection, statuses/roles/filters, balances and print.
- [ ] Phase5: GulfHarvest/Frozen/Zayogya and every document's full print/PDF matrix.
- [ ] Phase4: per-tenant VAT clarity and accountant-approved filing/margin fixtures.
- [ ] Phase6: responsive shell/sidebar/quick-create/global search, every route at5sizes and200% zoom.
- [ ] Phase7: every field/tab/modal/click/network/destructive/permission matrix.
- [ ] Phase8: DailyClose cash/count/variance/reopen/lock/version/timezone workflow.
- [ ] Phase9: optional saved stops, routes and explicit active-trip tracking with driver scope.
- [ ] Phase10: tenant/role-scoped deterministic AI tools, citations, draft/confirmation/audit/provider budgets.
- [ ] Phase11: four full persona journeys, production-like smoke, zeroS1/S2, reconciled money/stock/reports and clean errors.
- [ ] Final diff/cleanup/full regression/smoke, final commit and main push only after complete gate.

Accountant mapping/margin fixtures, migration-history/baseline strategy, approved Zayogya golden/document-title policy and compatible rollback remain unresolved. Continue independent local fixes; no invented financial rules or historical migration edits. Specialist read-only performance/finance/release reviews completed; principal owns edits. See companion register/evidence/matrices/signoff. No main push/deploy/production data mutation this slice.
