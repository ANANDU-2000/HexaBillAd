# Backup, Restore & Import Strategy

## Why backup/restore and CSV import fail (not an AI issue)

- **Schema mismatch:** Backup from SQLite or old schema vs restore into PostgreSQL / new schema.
- **Missing columns:** e.g. `AuditLogs` missing `EntityId` (fixed by DatabaseFixer running first for SQLite).
- **TenantId / OwnerId:** Multi-tenant systems must map old OwnerId to TenantId and validate relationships.
- **Import:** Column name mismatch, encoding, required fields, duplicate keys, date/numeric format, missing FKs.

## What was fixed (SQLite)

- **AuditLogs.EntityId:** DatabaseFixer now adds **AuditLogs** columns **first**, so Purchase and other services no longer hit “table AuditLogs has no column named EntityId”. Only “duplicate column” is ignored; other errors are logged.
- **After pull:** Restart the backend so the fixer runs again.

## Professional approach (for later)

### Backup / Restore

1. **Versioning:** In backup payload store `schemaVersion`, `databaseType`, `createdAt`.
2. **On restore:** Compare with current schema; if mismatch, run a **transformer** (map fields, apply TenantId, validate relationships) instead of raw dump.
3. Never do direct DB dump restore in a multi-tenant SaaS; always parse → validate → insert.

### CSV / Excel import (3 layers)

1. **Schema detection:** Map user columns to internal fields (e.g. “Customer Name” / “Cust Name” → customer name). Optional: use LLM to suggest mapping.
2. **Validation engine:** Required fields, types, duplicate SKU/invoice, valid dates, no negative values. Return a structured error report (row + message).
3. **Dry run:** Preview + list of errors → user confirms before applying.

### AI usage (optional, for value-add only)

- Use **Groq / Gemini / HuggingFace** for: smart CSV column mapping suggestions, business insight text, alerts.
- Do **not** use AI for: backup restore, financial calculations, or core validation (keep deterministic).

## Super Admin and production import

- Super Admin can have a subpage for: usage, cost, and control (e.g. feature flags, API key placeholders).
- Production import from CSV (and other formats) should: detect/adapt to column keywords, validate, verify, then process with a loader. Two “agents” (product import vs other data import) can share the same validation/verification pipeline; Super Admin can later control which keys/models are used and update the app when variables change.
