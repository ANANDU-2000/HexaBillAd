# PowerShell script to download Arabic fonts for PDF generation
# Run this script to automatically download and install required fonts

$fontsDir = "c:\Users\ACER\Downloads\Billing-App-main (2)\Billing-App-main\backend\HexaBill.Api\Fonts"

# Ensure Fonts directory exists
if (-not (Test-Path $fontsDir)) {
    New-Item -ItemType Directory -Path $fontsDir -Force | Out-Null
    Write-Host "✅ Created Fonts directory: $fontsDir" -ForegroundColor Green
}

Write-Host "📥 Downloading Noto Sans Arabic fonts from Google Fonts..." -ForegroundColor Cyan

# Download Noto Sans Arabic Regular
$regularUrl = "https://github.com/google/fonts/raw/main/ofl/notosansarabic/NotoSansArabic%5Bwdth%2Cwght%5D.ttf"
$regularPath = Join-Path $fontsDir "NotoSansArabic-Regular.ttf"

try {
    Invoke-WebRequest -Uri $regularUrl -OutFile $regularPath -UseBasicParsing
    Write-Host "✅ Downloaded: NotoSansArabic-Regular.ttf" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to download Regular font: $_" -ForegroundColor Red
    Write-Host "Please download manually from: https://fonts.google.com/noto/specimen/Noto+Sans+Arabic" -ForegroundColor Yellow
}

# Download Noto Sans Arabic Bold (using variable font)
$boldPath = Join-Path $fontsDir "NotoSansArabic-Bold.ttf"

try {
    # Copy regular font as bold (variable font includes all weights)
    Copy-Item -Path $regularPath -Destination $boldPath -Force
    Write-Host "✅ Created: NotoSansArabic-Bold.ttf (using variable font)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to create Bold font: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Font Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installed fonts in: $fontsDir" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Rebuild your application (dotnet build)" -ForegroundColor White
Write-Host "2. Deploy to production" -ForegroundColor White
Write-Host "3. Arabic text will now render correctly in PDFs" -ForegroundColor White
Write-Host ""

# List installed fonts
if (Test-Path $fontsDir) {
    Write-Host "Fonts in directory:" -ForegroundColor Cyan
    Get-ChildItem -Path $fontsDir -Filter "*.ttf" | ForEach-Object {
        $size = [math]::Round($_.Length / 1KB, 2)
        Write-Host "  ✓ $($_.Name) ($size KB)" -ForegroundColor Green
    }
}
