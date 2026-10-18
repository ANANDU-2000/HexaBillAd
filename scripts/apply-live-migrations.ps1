<#
  Applies the pending additive HexaBill migrations to the LIVE database, after taking and verifying a backup.
  Run it yourself in PowerShell:   powershell -NoProfile -File scripts\apply-live-migrations.ps1
  Add -DryRun to rehearse only on a restored local copy (no live write).

  Reads the connection from %LOCALAPPDATA%\HexaBill\production-recovery-20261018\env\production.env (never printed).
  Needs the PostgreSQL 18 client (the live server is 18.6).
  Steps: 1) read-only check of live  2) pg_dump -Fc  3) restore to a scratch local database and compare all row counts
         4) rehearse both SQL files twice on the copy  5) (not -DryRun) apply both to live in ONE transaction  6) verify.
  Stops at the first failed check. Nothing is dropped or rewritten; both SQL files are idempotent.
#>
param([switch]$DryRun)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$bin = 'C:\Program Files\PostgreSQL\18\bin'
$work = Join-Path $env:LOCALAPPDATA 'HexaBill\production-recovery-20261018'
$envFile = Join-Path $work 'env\production.env'
$files = @('docs\database\PENDING-MIGRATIONS-2026-10-18.sql', 'docs\database\AI-CONSENT-MIGRATION-2026-10-18.sql') | ForEach-Object { Join-Path $repo $_ }
$local = @('-h', '127.0.0.1', '-p', '55474', '-U', 'hexabill_return_qa')   # local scratch cluster used for rehearsals
$scratch = 'hexabill_live_rehearsal_' + (Get-Date -Format 'yyyyMMddHHmmss')
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dump = Join-Path $work "production-before-migrations-$stamp.dump"

function Use-Live { Get-Content $envFile | Where-Object { $_ -match '^(PG\w+)=(.*)$' } | ForEach-Object { Set-Item "Env:$($Matches[1])" $Matches[2] } }
function Use-Local { foreach ($v in 'PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSSLMODE','PGOPTIONS') { Remove-Item "Env:$v" -ErrorAction SilentlyContinue } }
function Native {
    param($exe, [string[]]$a)
    # psql prints harmless NOTICE lines on stderr; under -ErrorAction Stop Windows PowerShell 5.1 would treat them as failures, so judge by the exit code.
    $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $out = & "$bin\$exe" @a 2>&1; $code = $LASTEXITCODE } finally { $ErrorActionPreference = $old }
    if ($code -ne 0) { throw "$exe failed ($code): $(($out | ForEach-Object { "$_" } | Where-Object { $_ -notmatch 'NOTICE' } | Select-Object -First 3) -join ' ')" }
    $out | ForEach-Object { "$_" } | Where-Object { $_ -notmatch 'NOTICE|^\s*$|^At |CategoryInfo|FullyQualifiedErrorId|^\+ ' }
}
# Windows PowerShell 5.1 drops double quotes inside native arguments, so queries go through a temporary file.
function Query { param([string]$sql, [string[]]$conn = @()) $f = Join-Path $env:TEMP ('hb-q-' + [guid]::NewGuid().ToString('N') + '.sql'); Set-Content $f $sql -Encoding ascii; try { Native psql.exe ($conn + @('-At', '-F', ' | ', '-f', $f)) } finally { Remove-Item $f -ErrorAction SilentlyContinue } }
$sizeSql = 'select count(*) from information_schema.tables where table_schema=''public'' and table_type=''BASE TABLE''; select count(*) from "__EFMigrationsHistory";'

# generated once: a script that counts every table
$countSql = Join-Path $work 'count-tables.sql'

Use-Live; $env:PGOPTIONS = '-c default_transaction_read_only=on'
Write-Host '1) live check (read-only)'
$before = Query $sizeSql
Write-Host "   tables / history rows: $($before -join ' / ')"

Write-Host '2) backup'
Native pg_dump.exe @('-Fc', '--no-owner', '-f', $dump)
Write-Host "   $dump ($((Get-Item $dump).Length) bytes)"

Write-Host '3) restore to a scratch database and compare row counts'
Use-Local
Query "create database $scratch" ($local + @('-d', 'postgres')) | Out-Null
Native pg_restore.exe ($local + @('-d', $scratch, '--no-owner', '--no-privileges', '--exit-on-error', $dump))
$gen = "select 'select ' || quote_literal(table_name) || ' as t, count(*) as n from public.' || quote_ident(table_name) || ' union all' from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name"
$parts = Query $gen ($local + @('-d', $scratch))
Set-Content $countSql ((($parts -join "`n")) + "`nselect 'zz_end', 0 order by 1") -Encoding ascii
$restored = Native psql.exe ($local + @('-d', $scratch, '-At', '-F', '|', '-f', $countSql))
Use-Live; $env:PGOPTIONS = '-c default_transaction_read_only=on'
$live = Native psql.exe @('-At', '-F', '|', '-f', $countSql)
if (Compare-Object $restored $live) { throw 'Row counts of the restored backup do not match live. Stopped; nothing was changed.' }
Write-Host "   all $($live.Count - 1) table counts match"

Write-Host '4) rehearsal on the restored copy (each file twice)'
Use-Local
foreach ($f in $files) { 1..2 | ForEach-Object { Native psql.exe ($local + @('-d', $scratch, '-1', '-v', 'ON_ERROR_STOP=1', '-q', '-f', $f)) } }
$rehearsed = Query $sizeSql ($local + @('-d', $scratch))
Write-Host "   copy now: tables / history rows: $($rehearsed -join ' / ')  (expected 75 / 64)"
if ($rehearsed[0] -ne '75' -or $rehearsed[1] -ne '64') { throw 'Rehearsal result is not the expected 75 tables / 64 history rows. Stopped; live was not touched.' }
if ($DryRun) { Write-Host 'Dry run finished. Live was NOT changed.'; return }

Write-Host '5) apply to LIVE in one transaction'
Use-Live; Remove-Item Env:PGOPTIONS -ErrorAction SilentlyContinue
$one = Join-Path $work "apply-all-$stamp.sql"
Get-Content $files | Set-Content $one -Encoding utf8
Native psql.exe @('-1', '-v', 'ON_ERROR_STOP=1', '-q', '-f', $one)

Write-Host '6) verify live'
$env:PGOPTIONS = '-c default_transaction_read_only=on'
$verifySql = $sizeSql + ' select c.relname || '' owned by '' || pg_get_userbyid(c.relowner) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=''public'' and c.relname in (''RouteRuns'',''DriverLocationCurrents'',''AiUsageDaily'',''TenantDocumentChunks'',''TenantAiConsents'') order by 1; select count(*) || '' invalid indexes'' from pg_index where not indisvalid;'
$after = Query $verifySql
$after | ForEach-Object { Write-Host "   $_" }
Write-Host 'Done. Tell Claude Code the result so it can continue (Render variables, push, deploy, tests).'
