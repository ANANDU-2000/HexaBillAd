# Deploy HexaBill frontend directly to Vercel (no GitHub)
# Use when GitHub auto-deploy fails. Requires Vercel CLI and VERCEL_TOKEN.

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $ProjectRoot "frontend\hexabill-ui"

# Load VERCEL_TOKEN from .env if present
$EnvFiles = @(
    (Join-Path $ProjectRoot "backend\HexaBill.Api\.env"),
    (Join-Path $ProjectRoot ".env")
)
foreach ($f in $EnvFiles) {
    if (Test-Path $f) {
        Get-Content $f | ForEach-Object {
            if ($_ -match '^VERCEL_TOKEN=(.+)$') { $env:VERCEL_TOKEN = $matches[1].Trim() }
        }
        break
    }
}

Write-Host "Building frontend..." -ForegroundColor Cyan
Push-Location $FrontendDir
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }
    Write-Host "Build OK." -ForegroundColor Green
} finally {
    Pop-Location
}

if (-not $env:VERCEL_TOKEN) {
    Write-Host "VERCEL_TOKEN not set. Add to backend/HexaBill.Api/.env or run: `$env:VERCEL_TOKEN='your_token'" -ForegroundColor Red
    exit 1
}
Write-Host "Deploying to Vercel (production)..." -ForegroundColor Cyan
Push-Location $FrontendDir
try {
    npx vercel deploy --prod --yes
} finally {
    Pop-Location
}
