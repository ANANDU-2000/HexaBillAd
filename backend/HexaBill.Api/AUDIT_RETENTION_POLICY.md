# Audit Log Retention Policy

## Overview

`AuditLogs` stores field-level change tracking (OldValues/NewValues JSON) for entities. Without a retention policy, this table grows unbounded and can impact performance.

## Recommended Policy

| Environment | Retention | Action |
|-------------|-----------|--------|
| Development | 30 days | Optional; keep for debugging |
| Production | 90–365 days | Archive or delete older records |

## Implementation Options

### Option A: Settings-Based Retention (Recommended)

1. Add a setting `AUDIT_RETENTION_DAYS` (default: 365) at OwnerId=0.
2. Run a nightly job (e.g. extend `DailyBackupScheduler` or add `AuditRetentionJob`) that:
   - Reads `AUDIT_RETENTION_DAYS` from Settings
   - Deletes `AuditLogs` where `CreatedAt < DateTime.UtcNow.AddDays(-retentionDays)`

### Option B: Archive Before Delete

1. Export older records to cold storage (S3, Azure Blob) as JSON/Parquet
2. Then delete from `AuditLogs`
3. Keeps data for compliance while freeing database space

### Option C: Date Partitioning (PostgreSQL)

1. Convert `AuditLogs` to a partitioned table by month
2. Detach/drop old partitions instead of DELETE
3. Better for very high volume

## SQL to Manually Purge (One-Time)

```sql
-- Delete AuditLogs older than 365 days (adjust as needed)
DELETE FROM "AuditLogs"
WHERE "CreatedAt" < NOW() - INTERVAL '365 days';
```

## Status

- **Policy defined:** Yes
- **Background job:** Not implemented (see Option A)
- **Settings key:** `AUDIT_RETENTION_DAYS` — add to Settings table for OwnerId=0 when implementing
