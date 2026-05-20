# Backend trust & reliability — tranche notes

Short checklist for the **trust tranche** (invoice integrity, observability, auth hardening, performance). Items here are **tracked work**; some are already healthy in code, others need explicit verification in staging.

## 1. Invoice numbering / races

- **Owner:** `InvoiceNumberService` in `backend/HexaBill.Api/Modules/Billing/InvoiceNumberService.cs` (used from sale creation path).
- **Action:** Confirm allocation is **single-writer** per tenant/branch (DB sequence, `FOR UPDATE`, or equivalent) under concurrent POS load; document the guarantee in code comments if not obvious from reading the method.

## 2. `Console.WriteLine` / debug logging

- **Rule:** Production request paths should use `ILogger` with no secrets; ad-hoc `Console.WriteLine` is acceptable in **one-off scripts/tools** only.
- **Action:** Periodic grep of `Console.WriteLine` under `backend/HexaBill.Api` and migrate stragglers to structured logging or remove.

## 3. JWT refresh

- **Spike:** [`docs/JWT_REFRESH_SPIKE.md`](./JWT_REFRESH_SPIKE.md) — short-lived access + refresh rotation, revocation story.
- **Action:** Implement in a **feature-flagged** slice after security review; keep backward compatibility until all clients use refresh.

## 4. Indexes & report cache

- **Action:** After profiling slow reports in staging (same DB tier as prod), add **additive** indexes and optional short-TTL caching for heavy read-only aggregates. Any schema change ships only via **versioned migrations** (additive, backward compatible).

## 5. Transactions on destructive paths

- Bulk deletes, balance fixes, and irreversible updates should remain in explicit **transactions** with rollback on failure (existing enterprise rules).
