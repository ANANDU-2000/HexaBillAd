# Deploy HexaBill frontend directly to Vercel (no GitHub, no "commit author" issue)
# Uses local build + Vercel CLI. Put VERCEL_TOKEN (and optional VERCEL_PROJECT_ID) in .env — never commit.

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $ProjectRoot "frontend\hexabill-ui"
$VercelDir = Join-Path $FrontendDir ".vercel"

# Load .env: VERCEL_TOKEN, optional VERCEL_PROJECT_ID, optional VERCEL_ORG_ID
$EnvFiles = @(
    (Join-Path $ProjectRoot "backend\HexaBill.Api\.env"),
    (Join-Path $ProjectRoot ".env"),
    (Join-Path $FrontendDir ".env")
)
foreach ($f in $EnvFiles) {
    if (Test-Path $f) {
        Get-Content $f | ForEach-Object {
            if ($_ -match '^VERCEL_TOKEN=(.+)$') { $env:VERCEL_TOKEN = $matches[1].Trim() }
            if ($_ -match '^VERCEL_PROJECT_ID=(.+)$') { $env:VERCEL_PROJECT_ID = $matches[1].Trim() }
            if ($_ -match '^VERCEL_ORG_ID=(.+)$') { $env:VERCEL_ORG_ID = $matches[1].Trim() }
        }
    }
}

if (-not $env:VERCEL_TOKEN) {
    Write-Host "VERCEL_TOKEN not set. Add to .env (repo root or frontend/hexabill-ui):" -ForegroundColor Red
    Write-Host "  VERCEL_TOKEN=your_token_from_vercel_dashboard" -ForegroundColor Yellow
    Write-Host "  (Optional) VERCEL_PROJECT_ID=prj_xxxx  VERCEL_ORG_ID=team_xxxx" -ForegroundColor Yellow
    exit 1
}

# If project/org set, ensure .vercel/project.json points to that project (so deploy goes to hexa-bill-sw)
if ($env:VERCEL_PROJECT_ID) {
    $orgId = $env:VERCEL_ORG_ID
    if (-not $orgId) {
        # Try to keep existing orgId if project.json exists
        $pjPath = Join-Path $VercelDir "project.json"
        if (Test-Path $pjPath) {
            $pj = Get-Content $pjPath -Raw | ConvertFrom-Json
            $orgId = $pj.orgId
        }
    }
    if ($orgId) {
        if (-not (Test-Path $VercelDir)) { New-Item -ItemType Directory -Path $VercelDir -Force | Out-Null }
        @{ projectId = $env:VERCEL_PROJECT_ID; orgId = $orgId } | ConvertTo-Json | Set-Content (Join-Path $VercelDir "project.json") -Encoding UTF8
        Write-Host "Using project ID: $env:VERCEL_PROJECT_ID" -ForegroundColor Cyan
    }
}

Write-Host "Deploying to Vercel (production)..." -ForegroundColor Cyan
Push-Location $FrontendDir
try {
    # vercel deploy will build and deploy in one step (uses project settings from vercel.json or dashboard)
    # If .vercel directory exists but has wrong project, remove it first: Remove-Item -Recurse -Force .vercel
    npx vercel deploy --prod --yes --token=$env:VERCEL_TOKEN
    if ($LASTEXITCODE -ne 0) { throw "Deploy failed" }
    Write-Host "Deploy done! Check the URLs above and Vercel dashboard." -ForegroundColor Green
    Write-Host "If this deployed to the wrong project, remove .vercel directory and run again with correct VERCEL_PROJECT_ID in .env" -ForegroundColor Yellow
} finally {
    Pop-Location
}
