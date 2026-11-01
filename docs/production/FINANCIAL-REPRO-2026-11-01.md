# Financial defect reproduction - 2026-11-01

- Checkout: main at 9e7a3f3b; existing shared-worktree edits preserved.
- Disposable PostgreSQL 18 on port 55439, synthetic data only.
- FAIL: ReturnBalancePostgreSqlTests: 23 passed, 1 failed, 0 skipped. Approved full return ledger summary expected -5, actual 0.
- FAIL: CustomerLedger_DoesNotCreditUnclearedCheques: expected 10.75, actual 6.75 with pending and returned cheques of 2 each.
- Ledger credits non-void payments, while PDF adds uncleared payments back. Fixes must be coordinated to prevent double counting. PdfService contains unrelated uncommitted changes.
- NOT TESTED: authenticated browser, live settings, PDF concurrency, full regressions and deployed behavior. No production changes.
- Local follow-up: customer ledger credits only CLEARED and Completed receipts, including dated opening and invoice settlement queries. PDF no longer adds uncleared cheques back to the corrected ledger; its separate uncleared-cheque label remains. Existing unrelated PdfService edits were preserved.
- PASS: `dotnet test tests/HexaBill.Tests --filter 'FullyQualifiedName~CustomerLedger_DoesNotCreditUnclearedCheques|FullyQualifiedName~FrozenHubPrintFinalTests' --no-restore --verbosity quiet`, disposable PostgreSQL configured: 34 passed, 0 failed, 0 skipped. The cheque reproduction uses PostgreSQL; the print tests use their existing fixture, not PostgreSQL.
- The approved-return summary failure is NOT FIXED. Completed, refund, statements, dashboard and broader PostgreSQL reconciliation remain NOT TESTED. The change remains uncommitted and undeployed.
- Next: verify settled, returned, void, legacy completed and refund cases; investigate return summary; run PostgreSQL, statement, dashboard and PDF regressions.
