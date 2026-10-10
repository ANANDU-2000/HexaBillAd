# Payment modal recovery evidence — 8 October 2026

This is a completed local correction, not full Payments/receipt or production sign-off.

## Root causes and changes

PaymentModal generated a new UUID on every submit. Actual React-component regression confirmed different keys after a server commit whose response was lost; reopening exposed no recovery. It now reuses createLedgerPaymentJournal and ledgerPaymentScope already used by Customer Ledger. The original request/key is saved in sessionStorage before POST, scoped to origin/tenant/user/customer. Same-form submit or explicit recovery replays it before checking refreshed balance/duplicate data. Changed drafts cannot replace it. Only confirmed success clears it; rejected retries retain uncertainty. Synchronous submission ref blocks overlapping recovery calls. Recovery can also replay the existing journal's allocate command through the corresponding API. No second journal implementation/schema/financial formula was introduced.

The browser also reproduced absent invoice information and amount0 because the modal expected response.data.success while services return {success,data}. The modal now accepts the actual service envelope and the existing nested compatibility shape, including sale-detail fallback. Regression failed0 versus expected60 before, then passes. Real UI shows invoice003/total60/paid0/outstanding60 and auto-fills60.

Removed verbose request/full-error logs from this payment path. Existing API authorization, posted accounting, receipt eligibility and server idempotency rules remain authoritative.

Files: src/components/PaymentModal.jsx, tests/paymentModalRecovery.test.js; shared existing src/utils/ledgerPaymentIntent.js unchanged.

## Executable evidence

- Original retry/remount component regressions2fail/0pass, corrected4/4 (lost response, changed draft, rejected403 recovery, remount).
- Invoice envelope regression1fail before /PASS after.
- Existing journal regressions retained; latest complete frontend113/113, zero skip/fail; lint0errors/234warnings; build27.95sPASS. Last backend692/692 with PostgreSQL enabled/zero skips; backend unchanged after that run.
- Guarded real API TestServer bridge reports migrationProof=false/flagsOFF; real PostgreSQL17 retained synthetic browser database, no production data.
- Real Sales Ledger owner form saved12 AED as payment9, balance105→93.
- Mutable local test proxy suppressed the committed13 AED/payment10 response with synthetic403. Modal displayed unconfirmed13. Browser reload/reopen restored recovery action while amount field reset0. Changed35 draft produced explicit block and no POST.
- Retry sent the exact same idempotency key and original body and returned the same payment10; the13 and its replay both201 from real API. Three recorded payment POSTs total:12,13,13 replay. No extra35 or second13 database payment.
- Ledger after both payments: sales205,received125,pending80; invoice003 paid25,pending35; VAT9.76 unchanged.
- Both new rows voided through real UI typed DELETE confirmation. IDs9/10 retained VOID; original funds retained; final SQL all four tenants205sales/100invoice-paid/100cleared-funds/105customer-pending. Ledger UI totals restored205/100/105.
- Fixed modal at360x800 inspected; long invoice number wraps, fields fit, Cancel/Continue reached through inner scroll. Cancel posted nothing. Full five-size/200%zoom/keyboard/role/slow-network/print matrix remains OPEN.

Initial failure injection used a primitive REPL flag that the server closure did not observe; that12 AED attempt was an ordinary successful save, not a proven lost-response recovery. The test controller was corrected to a shared mutable object before the13 test above. No false automatic-retry claim.

## Evidence and cleanup

Local %TEMP%/hexabill-goal-20261008-evidence: modal-wire.json, modal-final-reconciliation.csv, modal-unconfirmed-before-reload.png, modal-changed-draft-blocked.png, modal-invoice-mobile-360.png, modal-restored-ledger.png. Synthetic financial evidence only; passwords/JWTs never saved.

Prior runtime stopped between continuation contexts. PostgreSQL's old55442 loopback port was unavailable; retained owned cluster recovered to50801 (PID19268), then clean fast-stop confirmed. Newly owned API13624/Vite26184 stopped; proxy5079/helper5187 closed; browser logged out, clipboard/runtime credentials cleared, tab closed, viewport reset. Final listener/process check empty for owned ports/PIDs. User services were not stopped. Evidence and disposable DB retained.

## Remaining work

PaymentsPage single and bulk retry identity/recovery, partial batch handling, all group receipts/status/filter/pagination, additional tenant/role/journal interactions and document matrix remain OPEN. Sales Ledger receipt buttons currently disable CLEARED cash rows because the ledger display status Paid is being passed to receipt eligibility; PS-012 requires fixing and testing the status mapping. Current working state remains uncommitted on release-1; main not pushed.
