# T5 concurrency runner. Local disposable PostgreSQL only (127.0.0.1:55481, hexabill_codex_browser_* DB).
# Starts ONLY the synthetic API host (no Vite), runs `node <Entry>`, stops the host.
# Usage: powershell -NoProfile -File tests\concurrency\run.ps1 [-FirstSeed] [-Scenarios c1,c2] [-Runs 3] [-Entry tests/concurrency/run.mjs]
param(
    [string]$Database = 'hexabill_codex_browser_loopc_20261108',
    [int]$PostgresPort = 55481,
    [int]$ApiPort = 5186,
    [string]$Scenarios = 'c1,c2,c3,c6,c7',
    [int]$Runs = 3,
    [string]$Entry = 'tests/concurrency/run.mjs',
    [switch]$FirstSeed
)
$ErrorActionPreference = 'Stop'
function New-QaSecret([int]$Bytes) { $b = New-Object byte[] $Bytes; $g = [Security.Cryptography.RandomNumberGenerator]::Create(); try { $g.GetBytes($b) } finally { $g.Dispose() }; [Convert]::ToBase64String($b) }
if ($Database -notmatch '^hexabill_codex_browser_[a-zA-Z0-9_]+$' -or $PostgresPort -ne 55481) { throw 'Local synthetic DB on 55481 only.' }
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$api = $null
try {
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:HEXABILL_TEST_POSTGRES = "Host=127.0.0.1;Port=$PostgresPort;Database=$Database;Username=hexabill_qa"
    $pw = New-QaSecret 24
    $env:HEXABILL_SYNTHETIC_PASSWORD = $pw
    $env:HEXABILL_OWNER_PASSWORD = $pw
    $env:HEXABILL_EDGE_PROXY_SECRET = (New-QaSecret 48)
    $env:Hosting__EdgeProxySecret = $env:HEXABILL_EDGE_PROXY_SECRET
    $env:HEXABILL_API = "http://127.0.0.1:$ApiPort"
    $env:HEXABILL_SYNTHETIC_API_PORT = "$ApiPort"
    $env:PGHOST = '127.0.0.1'; $env:PGPORT = "$PostgresPort"; $env:PGUSER = 'hexabill_qa'; $env:PGDATABASE = $Database
    $env:HEXABILL_QA_PSQL = $psql
    $env:HEXABILL_CONC_RUNS = "$Runs"
    $env:HEXABILL_CONC_SCENARIOS = $Scenarios
    $seed = Join-Path $root 'tools\HexaBill.SyntheticSeed\bin\Debug\net9.0\HexaBill.SyntheticSeed.dll'
    $hostDll = Join-Path $root 'tools\HexaBill.SyntheticBrowserHost\bin\Debug\net9.0\HexaBill.SyntheticBrowserHost.dll'
    if ($FirstSeed) {
        & dotnet $seed
        if ($LASTEXITCODE -ne 0) { throw 'seed failed' }
    } else {
        # The seed tool's --rotate-password refuses once extra users exist; re-hash every user of THIS local DB instead.
        $env:HEXABILL_HASH_INPUT = $pw
        $hash = (& dotnet run --project (Join-Path $PSScriptRoot 'HashTool') -v q --nologo | Select-Object -Last 1)
        Remove-Item Env:HEXABILL_HASH_INPUT
        $f = Join-Path $env:TEMP 't5-reset.sql'
        Set-Content -Path $f -Encoding ascii -Value ('update "Users" set "PasswordHash" = ''' + $hash + '''; delete from "FailedLoginAttempts";')
        & $psql -X -q -v ON_ERROR_STOP=1 -f $f
        $rc = $LASTEXITCODE
        Remove-Item $f
        if ($rc -ne 0) { throw 'password reset failed' }
    }
    Remove-Item Env:HEXABILL_SYNTHETIC_PASSWORD
    if (Get-NetTCPConnection -LocalPort $ApiPort -State Listen -ErrorAction SilentlyContinue) { throw "Port $ApiPort in use" }
    $log = Join-Path $env:TEMP ('hexabill-conc-' + [Guid]::NewGuid().ToString('N'))
    $api = Start-Process dotnet -ArgumentList ('"' + $hostDll + '"') -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput "$log-api.out" -RedirectStandardError "$log-api.err"
    $env:HEXABILL_CONC_APILOG = "$log-api.err"
    $ready = $false
    for ($i = 0; $i -lt 80; $i++) {
        if ($api.HasExited) { throw "API exited; see $log-api.err" }
        try { $s = Invoke-RestMethod "$env:HEXABILL_API/__synthetic-host" -TimeoutSec 2; if ($s.syntheticOnly -eq $true) { $ready = $true; break } } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready) { throw 'API not ready' }
    Push-Location $root
    try { & node $Entry; $code = $LASTEXITCODE } finally { Pop-Location }
    Write-Host "API log: $log-api.err"
    exit $code
} finally {
    if ($null -ne $api -and -not $api.HasExited) { Stop-Process -Id $api.Id -Force }
}
