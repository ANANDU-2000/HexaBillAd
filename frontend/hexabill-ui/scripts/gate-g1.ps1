# E2E-G1 gate runner (npm run gate:g1). Runs: lint, unit tests, build, journeys J1/J2/J3/J4/J11 (through the loop
# wrapper, which starts and stops its own API and web server), the H03 money snapshot compare, the perf compare,
# and prints a PASS/FAIL table. Synthetic local tenants only. Each step's full log goes to %TEMP%\hexabill-gate-g1.
param(
    [string]$ToolsDir = 'C:\Users\anand\.claude-worktrees\_loop-tools',
    [int]$ApiPort = 5188,
    [int]$FePort = 5189,
    [string]$Database = 'hexabill_codex_browser_loope_20261108',
    [switch]$FirstSeed,
    [switch]$SkipPerf
)
$ErrorActionPreference = 'Continue'
$uiRoot = Split-Path $PSScriptRoot -Parent
$root = Split-Path (Split-Path $uiRoot -Parent) -Parent
$runSpec = Join-Path $ToolsDir 'run-spec.ps1'
$logDir = Join-Path $env:TEMP 'hexabill-gate-g1'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$table = New-Object System.Collections.ArrayList

function Add-Result([string]$name, [int]$code, [string]$detail, [string]$log) {
    $status = if ($code -eq 0) { 'PASS' } else { 'FAIL' }
    [void]$table.Add([pscustomobject]@{ Step = $name; Result = $status; Detail = $detail; Log = $log })
    Write-Host ("[{0}] {1}" -f $status, $name)
}

function Get-LogPath([string]$name) {
    # Windows file names: no spaces, arrows or other punctuation in the log name.
    Join-Path $logDir (($name -replace '[^A-Za-z0-9]+', '-').Trim('-') + '.txt')
}

function Invoke-Npm([string]$name, [string]$script) {
    $log = Get-LogPath $name
    Push-Location $uiRoot
    try {
        $global:LASTEXITCODE = -1
        & cmd /c "npm run $script > `"$log`" 2>&1"
        $code = $LASTEXITCODE
    } finally { Pop-Location }
    Add-Result $name $code "npm run $script" $log
}

function Invoke-Journey([string]$name, [string]$spec, [string]$projects, [hashtable]$env = @{}) {
    $log = Get-LogPath $name
    foreach ($k in $env.Keys) { Set-Item -Path "Env:$k" -Value $env[$k] }
    try {
        $global:LASTEXITCODE = -1
        $cmdArgs = "-NoProfile -File `"$runSpec`" -Root `"$root`" -Spec $spec -Projects $projects -ApiPort $ApiPort -FePort $FePort -Database $Database" + $(if ($FirstSeed) { ' -FirstSeed' } else { '' })
        & cmd /c "powershell $cmdArgs > `"$log`" 2>&1"
        $code = $LASTEXITCODE
    } finally {
        foreach ($k in $env.Keys) { Remove-Item -Path "Env:$k" -ErrorAction SilentlyContinue }
    }
    if (-not (Test-Path $log)) { $code = 1 }
    $summary = if (Test-Path $log) { (Select-String -Path $log -Pattern '^\s+\d+ (passed|failed)' | ForEach-Object { $_.Line.Trim() }) -join '; ' } else { 'no log' }
    Add-Result $name $code ("$projects | $summary") $log
}

Invoke-Npm 'lint' 'lint'
Invoke-Npm 'unit tests' 'test'
Invoke-Npm 'build' 'build'

Invoke-Journey 'J1 login -> dashboard' 'e2e/gate/j1-login-dashboard.spec.js' 'd1440,m360,t752'
Invoke-Journey 'J2 POS cash sale' 'e2e/gate/j2-pos-cash.spec.js' 'd1440,m360,t752'
Invoke-Journey 'J3 credit sale + ledger receipt' 'e2e/gate/j3-credit-ledger.spec.js' 'd1440,m360'
Invoke-Journey 'J4 unconfirmed payment' 'e2e/gate/j4-unconfirmed.spec.js' 'd1440,m360'
Invoke-Journey 'J11 tenant isolation' 'e2e/gate/j11-tenant-isolation.spec.js' 'd1440,m360'
Invoke-Journey 'H03 money snapshot compare' 'e2e/gate/h03-money-snapshot.spec.js' 'd1440' @{ H03_LABEL = 'after'; H03_COMPARE = 'before' }

if (-not $SkipPerf) {
    $perfLog = Join-Path $logDir 'perf-run.txt'
    Push-Location $uiRoot
    try { & npm run perf:bundle *> (Join-Path $logDir 'perf-bundle.txt'); $bundleCode = $LASTEXITCODE } finally { Pop-Location }
    Invoke-Journey 'perf specs (POS, Ledger, reports)' 'e2e/perf/pages.spec.js,e2e/perf/pos.spec.js' 'd1440,m360' @{ HEXABILL_FE_MODE = 'preview'; PERF_TARGET = 'preview' }
    Invoke-Npm 'perf compare vs baseline' 'perf -- --compare baseline.json'
}

Write-Host ''
Write-Host 'E2E-G1 RESULT'
$table | Format-Table -AutoSize Step, Result, Detail | Out-String -Width 250 | Write-Host
$failed = @($table | Where-Object { $_.Result -eq 'FAIL' }).Count
Write-Host ("Logs: {0}" -f $logDir)
Write-Host ("OVERALL: {0}" -f $(if ($failed -eq 0) { 'PASS' } else { "FAIL ($failed step(s))" }))
exit $failed
