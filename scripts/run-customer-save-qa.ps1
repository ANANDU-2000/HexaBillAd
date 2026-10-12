param(
    [string[]]$Projects = @('m360'),
    [string]$TestFilter = '',
    [string]$Spec = 'e2e/customer-save-contract.spec.js',
    [switch]$ResumeFixtures
)
$ErrorActionPreference = 'Stop'
function New-QaSecret([int]$Bytes) { $b = New-Object byte[] $Bytes; $g = [Security.Cryptography.RandomNumberGenerator]::Create(); try { $g.GetBytes($b) } finally { $g.Dispose() }; [Convert]::ToBase64String($b) }
$qaRoot = Split-Path $PSScriptRoot -Parent
$qaPgBin = 'C:\Program Files\PostgreSQL\18\bin'
$qaDb = 'hexabill_codex_browser_20261012_1525'
$qaApiProcess = $null
$qaViteProcess = $null
$qaExitCode = 1
try {
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:HEXABILL_TEST_POSTGRES = "Host=127.0.0.1;Port=55472;Database=$qaDb;Username=hexabill_qa"
    $env:HEXABILL_SYNTHETIC_PASSWORD = (New-QaSecret 36)
    $env:HEXABILL_OWNER_PASSWORD = $env:HEXABILL_SYNTHETIC_PASSWORD
    Set-Item -Path 'Env:HEXABILL_E2E_EMAIL_GULFHARVEST-TEST' -Value 'owner@gulfharvest-test.hexabill.local'
    $env:HEXABILL_EDGE_PROXY_SECRET = (New-QaSecret 48)
    $env:Hosting__EdgeProxySecret = $env:HEXABILL_EDGE_PROXY_SECRET
    $env:HEXABILL_API = 'http://127.0.0.1:5078'
    $env:HEXABILL_DEV_API_ORIGIN = $env:HEXABILL_API
    $env:HEXABILL_FE_PORT = '5175'
    $env:PGHOST = '127.0.0.1'
    $env:PGPORT = '55472'
    $env:PGUSER = 'hexabill_qa'
    $env:PGDATABASE = $qaDb
    $env:HEXABILL_QA_PSQL = Join-Path $qaPgBin 'psql.exe'
    $qaSeedDll = Join-Path $qaRoot 'tools\HexaBill.SyntheticSeed\bin\Debug\net9.0\HexaBill.SyntheticSeed.dll'
    $qaHostDll = Join-Path $qaRoot 'tools\HexaBill.SyntheticBrowserHost\bin\Debug\net9.0\HexaBill.SyntheticBrowserHost.dll'
    if ($ResumeFixtures) { & dotnet $qaSeedDll --rotate-password }
    else { & dotnet $qaSeedDll }
    if ($LASTEXITCODE -ne 0) { throw 'Synthetic seed failed.' }
    Remove-Item Env:HEXABILL_SYNTHETIC_PASSWORD
    foreach ($qaPort in @(5078, 5175)) {
        if (Get-NetTCPConnection -LocalPort $qaPort -State Listen -ErrorAction SilentlyContinue) {
            throw "Port $qaPort is already in use; no existing process is stopped."
        }
    }
    $qaLogPrefix = Join-Path $env:TEMP ('hexabill-save-qa-' + [Guid]::NewGuid().ToString('N'))
    $qaApiProcess = Start-Process dotnet -ArgumentList ('"' + $qaHostDll + '"') -WorkingDirectory $qaRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput "$qaLogPrefix-api.out" -RedirectStandardError "$qaLogPrefix-api.err"
    $qaUiRoot = Join-Path $qaRoot 'frontend\hexabill-ui'
    $qaViteProcess = Start-Process node -ArgumentList @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5175', '--strictPort') -WorkingDirectory $qaUiRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput "$qaLogPrefix-vite.out" -RedirectStandardError "$qaLogPrefix-vite.err"
    $qaReady = $false
    for ($qaAttempt = 0; $qaAttempt -lt 40; $qaAttempt++) {
        if ($qaApiProcess.HasExited -or $qaViteProcess.HasExited) { throw "Owned server exited; inspect $qaLogPrefix logs." }
        try {
            $qaHostState = Invoke-RestMethod "$env:HEXABILL_API/__synthetic-host" -TimeoutSec 2
            $qaUi = Invoke-WebRequest 'http://127.0.0.1:5175/login' -UseBasicParsing -TimeoutSec 2
            if ($qaHostState.syntheticOnly -eq $true -and $qaUi.StatusCode -eq 200) { $qaReady = $true; break }
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $qaReady) { throw 'Synthetic servers did not become available.' }
    Push-Location $qaUiRoot
    try {
        $qaArgs = @('playwright', 'test', $Spec, '--workers=1')
        foreach ($qaProject in $Projects) { $qaArgs += "--project=$qaProject" }
        if ($TestFilter) { $qaArgs += @('--grep', $TestFilter) }
        & npx.cmd @qaArgs
        $qaExitCode = $LASTEXITCODE
    } finally { Pop-Location }
} finally {
    foreach ($qaProcess in @($qaViteProcess, $qaApiProcess)) {
        if ($null -ne $qaProcess -and -not $qaProcess.HasExited) { Stop-Process -Id $qaProcess.Id }
    }
    foreach ($qaName in @('HEXABILL_SYNTHETIC_PASSWORD', 'HEXABILL_OWNER_PASSWORD', 'HEXABILL_EDGE_PROXY_SECRET', 'Hosting__EdgeProxySecret')) {
        Remove-Item -LiteralPath "Env:$qaName" -ErrorAction SilentlyContinue
    }
}
exit $qaExitCode
