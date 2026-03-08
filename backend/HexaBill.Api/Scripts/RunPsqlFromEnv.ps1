# Run SQL script against Render Postgres using .env (no DB shell on Render free/basic).
# Usage: from backend\HexaBill.Api run: .\Scripts\RunPsqlFromEnv.ps1 [script.sql]
# Default script: Scripts\Ensure_SupplierLedgerCredits.sql

param(
    [string]$Script = "Ensure_SupplierLedgerCredits.sql"
)

$envFile = Join-Path $PSScriptRoot "..\\.env"
if (-not (Test-Path $envFile)) {
    Write-Error ".env not found at $envFile. Run from backend\HexaBill.Api or set path."
    exit 1
}

# Parse .env (skip comments and empty; first = wins)
$vars = @{}
Get-Content $envFile -Raw | ForEach-Object { $_ -split "`r?`n" } | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $idx = $line.IndexOf("=")
        if ($idx -gt 0) {
            $k = $line.Substring(0, $idx).Trim()
            $v = $line.Substring($idx + 1).Trim()
            if (-not $vars.ContainsKey($k)) { $vars[$k] = $v }
        }
    }
}

$dbHost = $vars["DB_HOST_EXTERNAL"]
$dbPort = $vars["DB_PORT"]
$dbName = $vars["DB_NAME"]
$dbUser = $vars["DB_USER"]
$dbPass = $vars["DB_PASSWORD"]
$url = $vars["DATABASE_URL_EXTERNAL"]

if (-not $url) {
    if ($dbHost -and $dbUser -and $dbName -and $dbPass) {
        $url = "postgresql://${dbUser}:${dbPass}@${dbHost}:$dbPort/$dbName"
    } else {
        Write-Error "Need DATABASE_URL_EXTERNAL or DB_HOST_EXTERNAL, DB_USER, DB_NAME, DB_PASSWORD in .env"
        exit 1
    }
}

$scriptPath = Join-Path $PSScriptRoot $Script
if (-not (Test-Path $scriptPath)) {
    $scriptPath = Join-Path (Split-Path $PSScriptRoot -Parent) $Script
}
if (-not (Test-Path $scriptPath)) {
    $scriptPath = $Script
}
if (-not (Test-Path $scriptPath)) {
    Write-Error "SQL script not found: $Script"
    exit 1
}

# Run psql (URL must be quoted if password has special chars)
$env:PGPASSWORD = $dbPass
& psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $scriptPath
$exit = $LASTEXITCODE
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
if ($exit -ne 0) {
    Write-Host "psql exited with $exit. Install PostgreSQL client (psql) if missing."
    exit $exit
}
Write-Host "Done."
