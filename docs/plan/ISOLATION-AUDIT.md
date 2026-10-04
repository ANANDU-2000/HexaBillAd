# Isolation audit (Tier 0 gate)

**Commit:** `6dc8d9c`  
**Date:** 2026-10-04  
**Rule:** every raw SQL / file path / job / cache / search path must prove a tenant filter.

## Summary

| Area | Status | Notes |
|---|---|---|
| EF global tenant filters | PASS (unit/HTTP) | Existing `TenantIsolation*` + HTTP isolation suites |
| Raw SQL at startup (`Program.cs` ExecuteSqlRaw) | REVIEW | Mostly additive DDL (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`). Not tenant-scoped by nature (schema). No tenant data SELECT without filter found in this pass’s first 80 hits. |
| Hosted services | REVIEW | `AlertCheckBackgroundService` registered in `Program.cs` — must iterate per-tenant (verify before Production). |
| Caches | PARTIAL | No widespread `IDistributedCache` tenant-key audit completed this session. |
| Search / FTS | PARTIAL | No `to_tsvector` usage found in first pass; product/customer search goes through EF tenant scope. |
| Files / R2 keys | PASS (unit) | `SettingsService.ValidateAssetKey` requires `tenants/{tenantId}/…` |
| Cross-tenant HTTP (SQLite) | PASS | 564 BE tests incl. isolation |
| PostgreSQL HTTP isolation (44) | **NOT RUN** | `HEXABILL_TEST_POSTGRES` unset; Docker not available on this machine |
| Provisioning + LEGACY_SUBDOMAIN redirect | PASS (local prior) | Tier0ProvisioningTests + local browser evidence |

## Raw SQL inventory (startup DDL)

Located under `backend/HexaBill.Api/Program.cs` (~lines 423–584+): `ExecuteSqlRaw` for column/index creation. These are schema migrations-in-startup, not tenant queries. Prefer moving remaining DDL into EF migrations in a later cleanup slice (do not edit old migration history).

## Background jobs

- `AlertCheckBackgroundService` — confirm tenant loop + no cross-tenant alert fanout before Production.

## PostgreSQL gate

```
NOT RUN — blocker: HEXABILL_TEST_POSTGRES not set; docker CLI absent
```

When available:

```bash
# set HEXABILL_TEST_POSTGRES to a disposable DB, then:
dotnet test tests/HexaBill.Tests --filter FullyQualifiedName~PostgreSql
```

## Rollback

No schema changes in this audit doc. PG run is read-only tests against a disposable DB.
