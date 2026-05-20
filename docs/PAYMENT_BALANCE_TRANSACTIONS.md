# Payment and balance transactions (audit notes)

This document captures how **HexaBill.Api** keeps **payments**, **sales**, and **customer aggregates** consistent. Use it when changing `PaymentService`, `BalanceService`, `CustomerService`, or related controllers.

## Balance recalculation: nested transactions

- `BalanceService.RecalculateCustomerBalanceAsync` **opens its own transaction only when** `DbContext.Database.CurrentTransaction` is null. Callers such as `PaymentService.UpdatePaymentStatusAsync` that already use `BeginTransactionAsync` therefore run balance recalculation **in the same outer transaction** without committing early.
- `CustomerService.RecalculateCustomerBalanceAsync` does **not** start a transaction; it runs queries and `SaveChangesAsync` on the shared `AppDbContext`, so it participates in the ambient transaction when one exists.

## PaymentService (high level)

| Path | Transaction | Balance / aggregates |
|------|----------------|----------------------|
| Create payment (invoice / customer) | Wrapped in `BeginTransactionAsync` | Recalc or sale updates inside same scope (see implementation) |
| `UpdatePaymentStatusAsync` | Single transaction | `_balanceService.RecalculateCustomerBalanceAsync` after status-driven sale updates; no nested commit |
| `UpdatePaymentAsync` | Single transaction | `CustomerService.RecalculateCustomerBalanceAsync` before save |
| `DeletePaymentAsync` | Single transaction | `CustomerService.RecalculateCustomerBalanceAsync` before save |

Always preserve **tenantId** filters on queries and keep **try/catch + logging** when extending these flows.

## SaleService / ReturnService

Multiple code paths use `BeginTransactionAsync` (create/update/delete flows). When a path touches **stock**, **sale totals**, and **customer balance**, keep mutations and any **balance recalculation** inside **one** database transaction unless you have a documented exception.

## Concurrency (balance)

There is **no global per-tenant mutex** on balance recalculation. Concurrent requests for the same customer can interleave at the application layer; mitigation today is **transaction-scoped writes** and **recalc-from-source** semantics. If you observe lost updates under load, consider a **per-tenant advisory lock** or **serialization** for bulk tools—not for every read path.
