# Production environment: where each secret lives (names only, no values)

This file lists WHAT is needed and WHERE it is kept. It never contains a password, key or connection string. If you see a real secret in this file, remove it and rotate it.

## Where the real values are
| Place | What it holds | Notes |
|---|---|---|
| Render dashboard, service `HexaBill` (`srv-d68jpdvpm1nc7393q4d0`), Environment | The values the running server reads | The only place the live server gets its settings. Changing a variable restarts the service. |
| `%LOCALAPPDATA%\HexaBill\production-recovery-20261018\env\production.env` (this computer only, owner-only file permissions, outside Git and OneDrive) | Database connection details and the two AI keys the owner pasted for maintenance | Used by maintenance scripts (backup, schema report, migrations). Never copy it into a repository, document, ticket or chat. |
| `%LOCALAPPDATA%\HexaBill\production-recovery-20261018\` (same folder) | Full database backups (`*.dump`), row counts, evidence | Backups contain customer data. Keep them private. |

`.gitignore` already blocks `.env`, `**/.env`, `.env.local` and `.env.*.local`. Never put these values in a frontend variable (`VITE_*` is published to every browser).

## Variable names
Database (maintenance file): `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSLMODE`, `DATABASE_URL_EXTERNAL` (from your computer), `DATABASE_URL_INTERNAL` (only works inside Render).

AI providers (Render environment, backend only):
```
Ai__Enabled                         master switch
Ai__Provider / Ai__FallbackProvider primary and fallback provider keys (for example gemini, groq)
Ai__AllowCustomerData               true only after the provider's data terms are approved (the owner approved this on 2026-10-18)
Ai__AllowPaidFallback               keep false
Ai__Providers__<key>__Kind / BaseUrl / Model / ApiKey / Paid
```
Feature switches: `FeatureFlags__CustomerStopLocation`, `FeatureFlags__LiveDriverLocation`.

## How to use the maintenance file
PowerShell (nothing is printed):
```
Get-Content "$env:LOCALAPPDATA\HexaBill\production-recovery-20261018\env\production.env" |
  Where-Object { $_ -match '^(PG\w+)=(.*)$' } | ForEach-Object { Set-Item "Env:$($Matches[1])" $Matches[2] }
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -c "select 1"
```
Use the PostgreSQL 18 client (the live server is 18.6). For read-only sessions add `$env:PGOPTIONS='-c default_transaction_read_only=on'`.

## After the work: rotate
The database password and both AI keys were pasted into a chat on 2026-10-18. Rotate all three: Render dashboard (database credentials), Google AI Studio (Gemini key), Groq console (Groq key). Then update the Render environment and the maintenance file.
