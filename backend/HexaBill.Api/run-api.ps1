# Run HexaBill API with database migrations
# Use this to fix "Branches & Routes API not found" (404): ensures backend and DB are in sync.

$ErrorActionPreference = "Stop"
$apiDir = $PSScriptRoot

Write-Host "HexaBill API - Build, Migrate, Run" -ForegroundColor Cyan
Write-Host ""

# 1. Build
Write-Host "[1/3] Building..." -ForegroundColor Yellow
Set-Location $apiDir
dotnet build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. If the DLL is locked, stop the running API process first." -ForegroundColor Red
    exit 1
}

# 2. Apply migrations
Write-Host "[2/3] Applying database migrations..." -ForegroundColor Yellow
dotnet ef database update
if ($LASTEXITCODE -ne 0) {
    Write-Host "Migration failed. Check your connection string and database." -ForegroundColor Red
    exit 1
}

# 3. Run
Write-Host "[3/3] Starting API..." -ForegroundColor Yellow
Write-Host "API will listen on http://localhost:5000 (or PORT env var)." -ForegroundColor Green
Write-Host ""
dotnet run
