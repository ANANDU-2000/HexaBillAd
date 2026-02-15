# ========================================
# RENDER POSTGRESQL DATABASE FIX SCRIPT
# Purpose: Apply production database schema fixes to Render PostgreSQL
# Author: AI Assistant
# Date: 2025-11-15
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RENDER POSTGRESQL DATABASE FIX" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get PostgreSQL connection string from user
Write-Host "Enter your Render PostgreSQL connection string:" -ForegroundColor Yellow
Write-Host "Format: postgres://username:password@host:port/database" -ForegroundColor Gray
Write-Host ""
$connectionString = Read-Host "Connection String"

if ([string]::IsNullOrWhiteSpace($connectionString)) {
    Write-Host "❌ Connection string cannot be empty!" -ForegroundColor Red
    exit 1
}

# Parse connection string
if ($connectionString -match "postgres://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
    $username = $matches[1]
    $password = $matches[2]
    $host = $matches[3]
    $port = $matches[4]
    $database = $matches[5]
    
    Write-Host "✅ Connection string parsed successfully" -ForegroundColor Green
    Write-Host "   Host: $host" -ForegroundColor Gray
    Write-Host "   Port: $port" -ForegroundColor Gray
    Write-Host "   Database: $database" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "❌ Invalid connection string format!" -ForegroundColor Red
    exit 1
}

# Set PGPASSWORD environment variable
$env:PGPASSWORD = $password

# Path to SQL script
$sqlScriptPath = Join-Path $PSScriptRoot "FixProductionDatabase.sql"

if (-not (Test-Path $sqlScriptPath)) {
    Write-Host "❌ SQL script not found: $sqlScriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "📄 SQL Script: $sqlScriptPath" -ForegroundColor Cyan
Write-Host ""

# Check if psql is installed
try {
    $psqlVersion = & psql --version 2>&1
    Write-Host "✅ PostgreSQL Client: $psqlVersion" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ psql command not found!" -ForegroundColor Red
    Write-Host "Please install PostgreSQL client tools:" -ForegroundColor Yellow
    Write-Host "  Windows: https://www.postgresql.org/download/windows/" -ForegroundColor Gray
    Write-Host "  Or install via chocolatey: choco install postgresql" -ForegroundColor Gray
    exit 1
}

# Confirm execution
Write-Host "⚠️  This script will modify your production database!" -ForegroundColor Yellow
Write-Host "   Make sure you have a backup before proceeding." -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Do you want to continue? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "❌ Operation cancelled by user" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🚀 Executing database fixes..." -ForegroundColor Cyan
Write-Host ""

# Execute SQL script
try {
    $result = & psql -h $host -p $port -U $username -d $database -f $sqlScriptPath 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "✅ DATABASE FIX COMPLETED SUCCESSFULLY!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Restart your Render backend service" -ForegroundColor Gray
        Write-Host "2. Test the application to ensure all features work" -ForegroundColor Gray
        Write-Host "3. Monitor for any remaining errors" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Output:" -ForegroundColor Yellow
        Write-Host $result
    } else {
        Write-Host ""
        Write-Host "❌ DATABASE FIX FAILED!" -ForegroundColor Red
        Write-Host "Error output:" -ForegroundColor Yellow
        Write-Host $result
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Error executing SQL script: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clear password from environment
    $env:PGPASSWORD = ""
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
