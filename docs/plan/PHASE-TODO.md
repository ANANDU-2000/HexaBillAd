# Grounded phase to-do (do not skip order)

Update evidence in `docs/refactor-progress.md`. Implementation continues on **uncommitted** work atop baseline `39ffafb`.

| Phase | Focus | Status | Next action |
|---|---|---|---|
| 1 | FE/BE build, deploy parity | **PARTIAL** | `deployVersion` on health endpoints; `/api/health` allowed on Render upstream (smoke was 403); prod unverified until deploy; billing workflow **79**; FE **72**; Vercel SHA unverified |
| 2 | Tenant isolation, 2nd owner | **PARTIAL** | PostgreSQL + R2 + job isolation tests; TEN01–TEN06 staging |
| 3 | Payments, receipts, invoices | **PARTIAL** | Receipt + snapshots; `PaymentSettlementReceiptFlowTests` also asserts daily-close cash **1330** (adj excluded); staging FIN04–FIN07 |
| 4 | Cost/profit, reversals | **PARTIAL** | Return approve uses `RefundStatus`; super-admin `sale_cost_snapshots` toggle; staging flag pilot |
| 5 | Daily close | **PARTIAL** | SQLite daily-close suite in billing workflow; PG `HttpIsolationPostgreSqlTests` daily-close/FIN09 in postgres job; staging UI NOT RUN |
| 6 | VAT margin + Zayogya | **TODO** | FIN12–FIN13 fixtures |
| 7 | Shell + core commerce UX | **PARTIAL** | Phase-7 pages C03–C13 viewport QA (UX01–UX03) |
| 8 | Remaining routes/tabs/dialogs | **TODO** | Walk PAGE-SPECIFICATION IDs; no PASS without evidence |
| 9 | AI | **TODO** | AI01–AI04 behind flags |
| 10 | Voice + maps | **TODO** | N03–N04, MAP gates |
| 11 | Staging rollout | **BLOCKED** | User-authorized pilot only |

## Immediate implementation queue (code)

1. ~~Audited reversal for approved sale returns (replaces delete)~~ — **done** (API + UI + refund/credit/write-off reversal tests)
2. ~~PostgreSQL concurrent return approval test~~ — `ReturnConcurrencyPostgreSqlTests` (run with `HEXABILL_TEST_POSTGRES`; skips if unset)
3. ~~`sale_cost_snapshots` / `receipt_snapshots` staging migration rehearsal~~ — `StagingSnapshotMigrationsTests` (local SQLite legacy apply); **staging `ef database update` still user-gated**
4. ~~Purchase-return conversion parity~~ — `ConversionAtPurchase` + `PurchaseStockBasis`
5. ~~Tenant feature-flag unit coverage~~ — `TenantFeatureFlagsTests` + super-admin `sale_cost_snapshots` toggle; **staging QA still user-gated**
6. ~~Full `dotnet test`~~ — **508+** pass (+44 PG skip); invoice-stock tests + petrol→close journey; `billing-return-release-fix.yml` (62-test slice)
7. ~~Purchase `ConversionAtPurchase` immutability~~ — `AppDbContext` guard + `PurchaseReturnStockTests`; `StagingSnapshotMigrationsTests` applies `20261003120000`
8. ~~Purchase-line unit cost snapshot parity~~ — `purchase_cost_snapshots`, `PurchaseCostBasis`, migration `20261003130000`, super-admin toggle; **staging apply user-gated**

## Immediate QA queue (evidence)

1. A01 tenant login — desktop/tablet/phone signed-in
2. P02 owner setup — browser → API → DB journey
3. C03 POS — stock + receipt path smoke on staging

## Artifacts checklist

- [x] `docs/plan/IMPLEMENTATION-PROMPT.txt` (copy into agents)
- [x] `docs/plan/ROUTE-MANIFEST.json` + test
- [x] `docs/plan/PAGE-SPECIFICATION.md` (this spec)
- [x] `docs/refactor-progress.md` (live tracker)
- [ ] Staging evidence JSON per page (create as QA runs)
