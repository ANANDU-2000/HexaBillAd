# Production issue register

8 October 2026; full master scope preserved. Static candidates need executable reproduction. Historical REL IDs remain in ERROR-REGISTER.md.

| ID | Severity / root cause | Evidence and status |
|---|---|---|
| PS-001 | Login S2: first email match shadowed same-email tenant/platform accounts | Scoped trusted-host lookup implemented; original11 tests9pass/2fail, now11/11 plus real PostgreSQL regression. JWT workspace, assignments, settings, fresh disabled/suspended/expired/unknown-host checks covered. Full auth/browser/role matrix remains OPEN. |
| PS-002 | Test isolation S2: FIN09 closed today's date in shared factory | Retained SQLite Closed version2 reproduced26 unrelated failures. Per-test DailyClose factories; latest full PG-enabled692/692, no skip/fail. Product lock rules unchanged. |
| PS-003 | Print fixture S2: mocks expected obsolete popup rather than current iframe | Four repaired fixture tests pass; full browser/PDF matrix OPEN. |
| PS-004 | Payment retries S1 | PaymentsPage single/bulk still generate fresh service keys, partial bulk failures discarded: OPEN. PaymentModal component reproduced new key after lost committed response and absent recovery after remount (2fail before). Modal now reuses existing scoped ledger journal, freezes body/key, explicit recovery, retains uncertainty after rejected retry;4 new component regressions PASS. Real browser/PG lost committed13 response, reload, blocked changed35 draft, replay same body/key/payment10 PASS; new rows9/10 voided, four baseline balances restored. Full modal/role/print matrix OPEN. |
| PS-005 | Group receipt/status UX S2 | Hidden selection totals/mobile eligibility/CASH VOID status candidates: OPEN reproduction and fix. |
| PS-006 | Payments pagination S2 | First100 local fetch/filter cannot represent101+ rows: OPEN executable fixture and server-pagination acceptance. |
| PS-007 | Sale retry S1 candidate | POS lacks stable ExternalReference; global unique index disagrees with tenant lookup. OPEN real service/PG/browser reproduction. |
| PS-008 | Performance S2 | Login fixed stage instrumentation and20 before/20 after measurements recorded; BCrypt dominates warm timings, no improvement claim. Sale1/10/50 and browser20 timing/full failure matrix OPEN. |
| PS-009 | VAT assurance S1 | Unsupported “authoritative for filing” wording removed. Owner-requested5% positive operating-profit comparison added only to existing ProfitBased view; all standard boxes/legacyProfitVat preserved; four-tenant API and GulfHarvest/Zayogya browser proof. Filing mapping/exports/print/full accounting acceptance remain OPEN. |
| PS-010 | Login lockout tenant isolation S2 candidate | LoginLockoutService persists by email globally; failures/clears can cross same-email workspaces. Existing behavior, not solved by scoped AuthService query. OPEN executable regression before narrowly changing scope. |
| PS-011 | Browser startup errors S2 candidate | Captured unread-count/dashboard Axios errors after test API restart invalidated JWT. Actual relogin/loaded dashboard/VAT succeeded. OPEN distinguish expected expired-session noise from current-session failure; no zero-console-error claim. |
| PS-012 | Sales Ledger receipt S2 | Real browser disables original CLEARED cash receipts because display status Paid reaches receipt eligibility. OPEN status-mapping regression/fix; all group receipts remain gated. |
| PS-013 | Invoice payment amount S2 | Real modal showed0/no invoice information due incorrect nested service envelope. Failing component0vs60 reproduced; compatibility normalization implemented; componentPASS and actualUI60 auto-fill/invoice details/mobile scroll actions verified. Full role/error matrix OPEN. |
| REL-004/011 | Migration/startup S1 | Fresh-history collisions, best-effort DDL/entrypoint failure continuation. OPEN approved migration strategy and fresh/copied rehearsal; EnsureCreated/bridge not proof. |
| REL-015/016 | VAT S1 | Filing-box/reverse-charge/accountant margin fixtures remain REQUIREMENTS BLOCKED; a5% display request does not supply legal eligibility, invoice wording or expected statutory boxes. |

One principal owns product edits. Specialist reviews read-only. No production operations, main push or historical migration edits.
